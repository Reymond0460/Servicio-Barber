/* =====================================================================
   DATOS Y CONFIGURACIÓN + ACCESO A LA BASE DE DATOS (Firestore)
   Lo usan index.html (clientes) y admin.html (Diego).

   Colecciones en Firestore:
     services      servicios. "Quitar" solo los oculta (active:false); desde "Servicios eliminados" se pueden restaurar o borrar para siempre.
     appointments  reservas (cortes). status: 'open' | 'done' | 'noshow'. Solo Diego las ve.
     clients       clientes (id = teléfono sin símbolos): se crean al cobrar. Solo Diego.
     ingresos      un registro por cada cobro (monto, fecha, cliente). Solo Diego.
     slots         candado por día+hora para evitar que dos personas tomen la misma hora.
                   Es lo único que la página pública lee de las reservas (sin datos personales).

   Seguridad: ver firestore.rules. Los clientes solo pueden leer servicios y horas
   ocupadas, y crear reservas. Todo lo demás es solo para la cuenta de Diego.
   ===================================================================== */

// ---------- Configuración que puedes cambiar ----------
const TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const CLOSED_DAYS = [0];        // días sin atención (0 = domingo ... 6 = sábado)
const MAX_DAYS_AHEAD = 60;      // hasta cuántos días adelante se puede reservar
const POLICY_VERSION = '2026-10-19';   // cambia esta fecha cuando se modifique la política de privacidad
const MINUTOS_DE_GRACIA = 30;   // una hora sigue reservable hasta 30 min después de empezar
                                // (ej. a las 11:17 aún se puede reservar las 11:00; a las 11:45 ya no)

// ---------- Textos y utilidades ----------
const DOWS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const money = n => '$' + Number(n).toLocaleString('es-CL');
const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slotId = (date, time) => date + '_' + time.replace(':', '');
const phoneId = tel => tel.replace(/\D/g, '');

// ¿Ya pasó esta hora? (día = objeto Date, hora = '11:00'). Cuenta los minutos de gracia.
function horaPasada(dia, hora) {
  const [h, m] = hora.split(':').map(Number);
  const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m);
  return new Date() > new Date(inicio.getTime() + MINUTOS_DE_GRACIA * 60000);
}

// Teléfono chileno: acepta 912345678, 56912345678 o +56912345678 y lo deja como +56912345678.
// Devuelve null si no es válido.
function normalizarTelefono(texto) {
  let d = String(texto).replace(/\D/g, '');
  if (d.length === 9 && d[0] === '9') d = '56' + d;
  return /^569\d{8}$/.test(d) ? '+' + d : null;
}
const ts = () => firebase.firestore.FieldValue.serverTimestamp();

// ---------- Acceso a la base de datos ----------
const Store = {

  // Escucha los servicios en tiempo real (activos y eliminados).
  onServices(cb, onError) {
    return fdb.collection('services').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    }, onError);
  },

  // Crea el primer servicio (solo lo hace el panel de Diego si no hay ninguno).
  seedServices() {
    return fdb.collection('services').add({ name: 'Corte de cabello', price: 10000, duration: '1 hora', active: true, createdAt: ts() });
  },

  // Horas ocupadas (público: solo dice qué día y hora están tomados, sin datos de clientes).
  // Solo se piden las horas de hoy en adelante: así la página no lee todo el historial
  // y se mantiene dentro del uso gratuito de Firebase.
  onSlots(cb, onError) {
    return fdb.collection('slots').where('date', '>=', dayKey(new Date())).onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError);
  },

  // Solo Diego (con sesión iniciada): reservas, ingresos y clientes.
  onAppointments(cb, onError) {
    return fdb.collection('appointments').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError);
  },
  onIngresos(cb, onError) {
    return fdb.collection('ingresos').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError);
  },
  onClients(cb, onError) {
    return fdb.collection('clients').onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, onError);
  },

  // Crea una reserva. Usa una transacción: si la hora ya fue tomada, falla con 'TAKEN'.
  async book({ date, time, client, phone, service, consent }) {
    const slotRef = fdb.collection('slots').doc(slotId(date, time));
    const apptRef = fdb.collection('appointments').doc();
    await fdb.runTransaction(async tx => {
      const slot = await tx.get(slotRef);
      if (slot.exists) throw new Error('TAKEN');
      tx.set(slotRef, { apptId: apptRef.id, date, time });
      tx.set(apptRef, {
        date, time, client, phone,
        serviceId: service.id, svc: service.name, price: service.price,   // se guarda una copia del nombre y precio
        status: 'open', createdAt: ts(),
        // Constancia de que el cliente aceptó la política de privacidad (versión y fecha).
        consent: { accepted: !!consent, policyVersion: POLICY_VERSION, at: ts() }
      });
    });
  },

  // Diego marca "Cobrado": guarda el cobro en 'ingresos' y actualiza la ficha del cliente.
  async markPaid(appt) {
    const batch = fdb.batch();
    batch.update(fdb.collection('appointments').doc(appt.id), { status: 'done', paidAt: ts() });
    batch.set(fdb.collection('ingresos').doc(appt.id), {
      apptId: appt.id, date: appt.date, amount: appt.price, svc: appt.svc, client: appt.client, phone: appt.phone, createdAt: ts()
    });
    batch.set(fdb.collection('clients').doc(phoneId(appt.phone)), {
      name: appt.client, phone: appt.phone, lastVisit: appt.date, updatedAt: ts(),
      visits: firebase.firestore.FieldValue.increment(1),
      totalSpent: firebase.firestore.FieldValue.increment(appt.price)
    }, { merge: true });
    await batch.commit();
  },

  // "No llegó": la reserva queda guardada con status 'noshow' y la hora se libera.
  async noShow(appt) {
    const batch = fdb.batch();
    batch.update(fdb.collection('appointments').doc(appt.id), { status: 'noshow', noShowAt: ts() });
    batch.delete(fdb.collection('slots').doc(slotId(appt.date, appt.time)));
    await batch.commit();
  },

  // Cambia la reserva a otra hora del mismo día (si está libre).
  async move(appt, newTime) {
    const oldRef = fdb.collection('slots').doc(slotId(appt.date, appt.time));
    const newRef = fdb.collection('slots').doc(slotId(appt.date, newTime));
    await fdb.runTransaction(async tx => {
      const n = await tx.get(newRef);
      if (n.exists) throw new Error('TAKEN');
      tx.delete(oldRef);
      tx.set(newRef, { apptId: appt.id, date: appt.date, time: newTime });
      tx.update(fdb.collection('appointments').doc(appt.id), { time: newTime, movedFrom: appt.time });
    });
  },

  // Derecho de supresión: borra la ficha del cliente y anonimiza sus reservas e ingresos
  // (los montos quedan para la contabilidad, pero sin nombre ni teléfono).
  async erasePersonalData(telefono) {
    const id = phoneId(telefono);
    const [appts, ingresos] = await Promise.all([
      fdb.collection('appointments').where('phone', '==', telefono).get(),
      fdb.collection('ingresos').where('phone', '==', telefono).get()
    ]);
    const batch = fdb.batch();
    appts.forEach(d => batch.update(d.ref, { client: 'Cliente eliminado', phone: '', erasedAt: ts() }));
    ingresos.forEach(d => batch.update(d.ref, { client: 'Cliente eliminado', phone: '' }));
    batch.delete(fdb.collection('clients').doc(id));
    await batch.commit();
  },

  // Servicios: agregar, "quitar" (queda guardado, active:false) y restaurar.
  addService(name, price, duration) {
    return fdb.collection('services').add({ name, price, duration: duration || '1 hora', active: true, createdAt: ts() });
  },
  removeService(id) {
    return fdb.collection('services').doc(id).update({ active: false, removedAt: ts() });
  },
  // Borrado definitivo: solo para servicios que ya estaban eliminados (active:false).
  deleteServiceForever(id) {
    return fdb.collection('services').doc(id).delete();
  },
  restoreService(id) {
    return fdb.collection('services').doc(id).update({ active: true, removedAt: null });
  }
};

// Mensaje de error amistoso si la base de datos rechaza la conexión.
function mostrarErrorBD(err) {
  console.error(err);
  if (document.querySelector('.dberror')) return;
  const aviso = document.createElement('div');
  aviso.className = 'dberror';
  aviso.textContent = 'No se pudo conectar con la base de datos. Revisa las reglas de Firestore (archivo firestore.rules).';
  document.body.prepend(aviso);
}
