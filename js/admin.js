/* =====================================================================
   PANEL DE DIEGO (admin.html)
   Ingresos, agenda de hoy, clientes y servicios. Todo viene de Firestore
   en tiempo real. Nada se borra: lo "eliminado" queda guardado.
   ===================================================================== */

const $ = id => document.getElementById(id);
const hoy = dayKey(new Date());
const mesActual = hoy.slice(0, 7);          // ej. '2026-10'

// Datos que llegan de la base de datos.
const D = { services: [], appts: [], ingresos: [], clients: [] };
let moviendo = null;   // id de la reserva a la que Diego está cambiando la hora

// Selector para cambiar la hora de una reserva: muestra solo las horas libres de ese día.
function selectorHora(a) {
  // Horas del día según el horario del barbero, menos las que chocan con OTRAS reservas (la propia no cuenta).
  const tomadas = D.appts.filter(x => x.date === a.date && x.status !== 'noshow' && x.id !== a.id).map(x => x.time);
  const libres = horasDelDia(fechaDe(a.date)).filter(t => t !== a.time && !horaOcupada(t, tomadas));
  if (!libres.length) return `<div class="acts"><span class="note">No quedan horas libres hoy.</span><button data-a="cancel" data-id="${a.id}">Cancelar</button></div>`;
  return `
    <div class="acts">
      <label for="hora-${a.id}" class="note" style="margin:0">Nueva hora:</label>
      <select id="hora-${a.id}">${libres.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
      <button class="pay" data-a="confirm" data-id="${a.id}">Mover</button>
      <button data-a="cancel" data-id="${a.id}">Cancelar</button>
    </div>`;
}

function render() {
  const deHoy = D.appts.filter(a => a.date === hoy).sort((a, b) => (a.time < b.time ? -1 : 1));
  const cobrado = D.ingresos.filter(i => i.date === hoy).reduce((t, i) => t + i.amount, 0);
  const porCobrar = deHoy.filter(a => a.status === 'open').reduce((t, a) => t + a.price, 0);
  const delMes = D.ingresos.filter(i => (i.date || '').startsWith(mesActual)).reduce((t, i) => t + i.amount, 0);
  const noLlegaron = D.appts.filter(a => a.status === 'noshow').length;

  // Tarjetas de resumen.
  $('stats').innerHTML = `
    <div class="stat"><span>Cobrado hoy</span><b style="color:var(--accent)">${money(cobrado)}</b></div>
    <div class="stat"><span>Por cobrar hoy</span><b>${money(porCobrar)}</b></div>
    <div class="stat"><span>Ingresos del mes</span><b>${money(delMes)}</b></div>
    <div class="stat"><span>Horas liberadas (no llegó)</span><b>${noLlegaron}</b></div>`;

  // Agenda de hoy (las reservas "no llegó" quedan registradas, pero no ocupan la agenda).
  const visibles = deHoy.filter(a => a.status !== 'noshow');
  $('agenda').innerHTML = visibles.length ? visibles.map(a => `
    <div class="row ${a.status === 'done' ? 'done' : ''}">
      <div class="t">${a.time}</div>
      <div class="i"><b>${esc(a.client)}</b><small>${esc(a.svc)} · ${money(a.price)} · ${esc(a.phone)}</small></div>
      <div class="s">${a.status === 'done' ? 'Cobrado' : 'Pendiente'}</div>
      ${a.status === 'open' ? (moviendo === a.id ? selectorHora(a) : `
        <div class="acts">
          <button class="pay" data-a="pay" data-id="${a.id}">Cobrado</button>
          <button data-a="move" data-id="${a.id}">Cambiar hora</button>
          <button class="no" data-a="no" data-id="${a.id}">No llegó</button>
        </div>`) : ''}
    </div>`).join('') : '<div class="empty">No hay reservas para hoy.</div>';

  $('agenda').querySelectorAll('button').forEach(b => {
    b.onclick = async () => {
      const cita = D.appts.find(x => x.id === b.dataset.id);
      const acc = b.dataset.a;
      if (acc === 'move') { moviendo = cita.id; render(); return; }                 // abre el selector de hora
      if (acc === 'cancel') { moviendo = null; render(); return; }
      b.disabled = true;
      try {
        if (acc === 'pay') await Store.markPaid(cita);                              // cobrado -> ingresos
        if (acc === 'no') await Store.noShow(cita);                                 // no llegó -> hora libre, reserva guardada
        if (acc === 'confirm') {                                                    // mover a la hora elegida
          const nueva = $('hora-' + cita.id).value;
          if (nueva) await Store.move(cita, nueva);
          moviendo = null; render();
        }
      } catch (e) {
        if (e.message === 'TAKEN') { alert('Esa hora acaba de ser tomada. Elige otra.'); render(); }
        else mostrarErrorBD(e);
      }
    };
  });

  // Servicios activos y eliminados (los eliminados se pueden restaurar).
  const activos = D.services.filter(s => s.active !== false);
  const quitados = D.services.filter(s => s.active === false);
  $('svcs').innerHTML = activos.map(s => `
    <div class="row">
      <div class="i"><b>${esc(s.name)}</b><small style="color:var(--accent)">${money(s.price)}</small></div>
      <div class="acts"><button data-q="${s.id}">Quitar</button></div>
    </div>`).join('') || '<div class="empty">No hay servicios activos.</div>';
  $('svcs').querySelectorAll('button').forEach(b => { b.onclick = () => Store.removeService(b.dataset.q).catch(mostrarErrorBD); });

  $('removed').innerHTML = quitados.length ? `
    <h3 style="margin:24px 0 10px;font-size:16px;color:var(--mut)">Servicios eliminados (siguen guardados)</h3>
    ${quitados.map(s => `
      <div class="row" style="opacity:.8">
        <div class="i"><b>${esc(s.name)}</b><small>${money(s.price)}</small></div>
        <div class="acts">
          <button data-r="${s.id}">Restaurar</button>
          <button class="no" data-d="${s.id}" data-n="${esc(s.name)}">Eliminar</button>
        </div>
      </div>`).join('')}` : '';
  $('removed').querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      if (b.dataset.r) return Store.restoreService(b.dataset.r).catch(mostrarErrorBD);
      // Eliminar para siempre: pide confirmación porque no se puede deshacer.
      if (confirm(`¿Eliminar "${b.dataset.n}" para siempre? Esto no se puede deshacer.
Las reservas ya hechas con este servicio no se borran.`)) {
        Store.deleteServiceForever(b.dataset.d).catch(mostrarErrorBD);
      }
    };
  });

  // Clientes: los que más han venido primero.
  const clientes = [...D.clients].sort((a, b) => (b.visits || 0) - (a.visits || 0));
  $('clients').innerHTML = clientes.length ? clientes.map(c => `
    <div class="row">
      <div class="i"><b>${esc(c.name)}</b><small>${esc(c.phone)} · ${c.visits || 0} reservas · ${money(c.totalSpent || 0)} gastado</small></div>
      <div class="acts"><button class="no" data-e="${esc(c.phone)}" data-n="${esc(c.name)}">Borrar datos</button></div>
    </div>`).join('') : '<div class="empty">Aún no hay clientes.</div>';
  $('clients').querySelectorAll('button[data-e]').forEach(b => {
    b.onclick = () => {
      // Derecho de supresión: el cliente pidió que se borren sus datos personales.
      if (confirm(`¿Borrar los datos personales de "${b.dataset.n}"?
Se elimina su ficha y se quitan su nombre y teléfono de sus reservas. No se puede deshacer.`)) {
        Store.erasePersonalData(b.dataset.e).catch(mostrarErrorBD);
      }
    };
  });
}

// Agregar un servicio nuevo.
$('add').onclick = async () => {
  const name = $('sn').value.trim();
  const price = parseInt($('sp').value.replace(/\D/g, ''), 10);
  if (!name || !(price > 0)) return;
  try { await Store.addService(name, price, $('sd').value.trim()); $('sn').value = ''; $('sp').value = ''; $('sd').value = '1 hora'; } catch (e) { mostrarErrorBD(e); }
};

// ---------- Inicio de sesión de Diego (Firebase Authentication) ----------
// Los datos se piden a la base de datos solo después de iniciar sesión.
let escuchando = false;
function conectar() {
  if (escuchando) return;
  escuchando = true;
  let sembrado = false;
  Store.onServices(l => {
    D.services = l; render();
    if (!l.length && !sembrado) { sembrado = true; Store.seedServices().catch(mostrarErrorBD); }  // primer servicio
  }, mostrarErrorBD);
  // Reservas: la primera lectura solo carga lo que ya existía; después, cada reserva nueva dispara el aviso.
  let conocidas = null;
  Store.onAppointments(l => {
    if (conocidas) l.filter(a => !conocidas.has(a.id) && a.status === 'open').forEach(a => Notificaciones.avisar(a));
    conocidas = new Set(l.map(a => a.id));
    D.appts = l; render();
  }, mostrarErrorBD);
  Store.onIngresos(l => { D.ingresos = l; render(); }, mostrarErrorBD);
  Store.onClients(l => { D.clients = l; render(); }, mostrarErrorBD);
  // Horario de atención (editor "Mi horario", ver js/editor.js)
  Store.onSettings(datos => { AJUSTES = fusionarAjustes(datos); edCargar(false); render(); }, edErrorAjustes);
}

edConstruir();   // arma las filas del editor de horario

if (MODO_DEMO) {
  // En la demo no hay inicio de sesión: el panel se muestra de inmediato con datos de ejemplo.
  $('login').hidden = true;
  $('panel').hidden = false;
  $('logout').hidden = true;
  conectar(); render();
} else {
  firebase.auth().onAuthStateChanged(user => {
    $('login').hidden = !!user;
    $('panel').hidden = !user;
    $('logout').hidden = !user;
    if (user) { conectar(); render(); }
  });
}

$('loginForm').onsubmit = async e => {
  e.preventDefault();
  $('loginMsg').textContent = 'Entrando…';
  try {
    await firebase.auth().signInWithEmailAndPassword($('email').value.trim(), $('pass').value);
    $('loginMsg').textContent = '';
    $('pass').value = '';
  } catch (err) {
    $('loginMsg').textContent = 'Correo o clave incorrectos.';
  }
};
$('logout').onclick = () => firebase.auth().signOut();

// ---------- Avisos de nuevas reservas ----------
// Botón para dar permiso a las notificaciones del navegador.
$('notif').onclick = async () => { $('notifMsg').textContent = await Notificaciones.pedirPermiso(); };
