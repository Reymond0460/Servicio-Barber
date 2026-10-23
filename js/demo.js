/* =====================================================================
   VERSIÓN DEMO
   Reemplaza la base de datos de Firebase por datos de ejemplo guardados en el
   navegador de cada visitante (localStorage). Así cualquiera puede probar la
   página y el panel sin tocar los datos reales. Solo se usa si MODO_DEMO es true
   (ver js/modo.js). Ofrece los mismos métodos que StoreFirebase en js/data.js.
   ===================================================================== */
const DEMO_KEY = 'barber_diego_demo_v1';
const demoOyentes = [];          // funciones que se avisan cuando cambian los datos

function demoSemilla() {
  const hoy = new Date();
  const dia = n => { const d = new Date(hoy); d.setDate(d.getDate() + n); return dayKey(d); };
  return {
    services: [
      { id: 's1', name: 'Corte de cabello', price: 10000, duration: '1 hora', active: true, n: 1 },
      { id: 's2', name: 'Corte + Barba', price: 15000, duration: '1 hora', active: true, n: 2 }
    ],
    appts: [
      { id: 'a1', date: dia(0), time: '10:00', client: 'Cliente Ejemplo 1', phone: '+56911111111', svc: 'Corte de cabello', price: 10000, status: 'done' },
      { id: 'a2', date: dia(0), time: '12:00', client: 'Cliente Ejemplo 2', phone: '+56922222222', svc: 'Corte de cabello', price: 10000, status: 'open' },
      { id: 'a3', date: dia(0), time: '15:00', client: 'Cliente Ejemplo 3', phone: '+56933333333', svc: 'Corte + Barba', price: 15000, status: 'open' },
      { id: 'a4', date: dia(1), time: '11:00', client: 'Cliente Ejemplo 4', phone: '+56944444444', svc: 'Corte de cabello', price: 10000, status: 'open' }
    ],
    ingresos: [
      { id: 'a1', date: dia(0), amount: 10000, svc: 'Corte de cabello', client: 'Cliente Ejemplo 1', phone: '+56911111111' },
      { id: 'i0', date: dayKey(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), amount: 180000, svc: 'Varios', client: 'Cliente Ejemplo', phone: '' }
    ],
    clients: [
      { id: '56911111111', name: 'Cliente Ejemplo 1', phone: '+56911111111', visits: 4, totalSpent: 40000 },
      { id: '56922222222', name: 'Cliente Ejemplo 2', phone: '+56922222222', visits: 2, totalSpent: 20000 }
    ]
  };
}

function demoLeer() {
  try { const g = JSON.parse(localStorage.getItem(DEMO_KEY)); if (g) return g; } catch (e) {}
  const s = demoSemilla(); demoGuardar(s, false); return s;
}
function demoGuardar(s, avisar = true) {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); } catch (e) {}
  if (avisar) demoOyentes.forEach(f => f());
}
// Si se cambia algo en otra pestaña (ej. se reserva en una y se mira el panel en otra), se avisa aquí.
window.addEventListener('storage', e => { if (e.key === DEMO_KEY) demoOyentes.forEach(f => f()); });

// Registra un oyente: se ejecuta ya y cada vez que cambian los datos.
function demoEscuchar(cb, extraer) {
  const f = () => cb(extraer(demoLeer()));
  demoOyentes.push(f);
  setTimeout(f, 0);
  return () => demoOyentes.splice(demoOyentes.indexOf(f), 1);
}
const demoId = () => 'd' + Date.now() + Math.floor(Math.random() * 1000);

const StoreDemo = {
  // Ajustes de horario (se guardan en el navegador, como todo en la demo)
  onSettings: (cb) => demoEscuchar(cb, s => s.settings || {}),
  async saveSettings(ajustes) {
    const s = demoLeer();
    s.settings = { horario: ajustes.horario };
    demoGuardar(s);
  },

  onServices: (cb) => demoEscuchar(cb, s => s.services.map(x => ({ ...x, createdAt: { seconds: x.n || 0 } }))),
  seedServices: () => Promise.resolve(),
  onSlots: (cb) => demoEscuchar(cb, s =>
    s.appts.filter(a => a.status !== 'noshow' && a.date >= dayKey(new Date())).map(a => ({ id: slotId(a.date, a.time), date: a.date, time: a.time }))),
  onAppointments: (cb) => demoEscuchar(cb, s => s.appts),
  onIngresos: (cb) => demoEscuchar(cb, s => s.ingresos),
  onClients: (cb) => demoEscuchar(cb, s => s.clients),

  async book({ date, time, client, phone, service }) {
    const s = demoLeer();
    if (s.appts.some(a => a.date === date && a.time === time && a.status !== 'noshow')) throw new Error('TAKEN');
    s.appts.push({ id: demoId(), date, time, client, phone, serviceId: service.id, svc: service.name, price: service.price, status: 'open' });
    demoGuardar(s);
  },
  async markPaid(appt) {
    const s = demoLeer();
    const a = s.appts.find(x => x.id === appt.id); if (a) a.status = 'done';
    s.ingresos.push({ id: appt.id, date: appt.date, amount: appt.price, svc: appt.svc, client: appt.client, phone: appt.phone });
    const id = phoneId(appt.phone);
    const c = s.clients.find(x => x.id === id);
    if (c) { c.visits = (c.visits || 0) + 1; c.totalSpent = (c.totalSpent || 0) + appt.price; }
    else s.clients.push({ id, name: appt.client, phone: appt.phone, visits: 1, totalSpent: appt.price });
    demoGuardar(s);
  },
  async noShow(appt) {
    const s = demoLeer();
    const a = s.appts.find(x => x.id === appt.id); if (a) a.status = 'noshow';
    demoGuardar(s);
  },
  async move(appt, newTime) {
    const s = demoLeer();
    if (s.appts.some(a => a.date === appt.date && a.time === newTime && a.status !== 'noshow')) throw new Error('TAKEN');
    const a = s.appts.find(x => x.id === appt.id); if (a) { a.movedFrom = a.time; a.time = newTime; }
    demoGuardar(s);
  },
  async erasePersonalData(telefono) {
    const s = demoLeer();
    s.appts.forEach(a => { if (a.phone === telefono) { a.client = 'Cliente eliminado'; a.phone = ''; } });
    s.ingresos.forEach(i => { if (i.phone === telefono) { i.client = 'Cliente eliminado'; i.phone = ''; } });
    s.clients = s.clients.filter(c => c.phone !== telefono);
    demoGuardar(s);
  },
  async addService(name, price, duration) {
    const s = demoLeer();
    s.services.push({ id: demoId(), name, price, duration: duration || '1 hora', active: true, n: Date.now() });
    demoGuardar(s);
  },
  async removeService(id) { const s = demoLeer(); const x = s.services.find(v => v.id === id); if (x) x.active = false; demoGuardar(s); },
  async restoreService(id) { const s = demoLeer(); const x = s.services.find(v => v.id === id); if (x) x.active = true; demoGuardar(s); },
  async deleteServiceForever(id) { const s = demoLeer(); s.services = s.services.filter(v => v.id !== id); demoGuardar(s); }
};

// ---------- Barra superior de aviso (solo en la demo) ----------
function mostrarBannerDemo() {
  const enAdmin = location.pathname.endsWith('admin.html');
  const b = document.createElement('div');
  b.className = 'demo-banner';
  b.innerHTML = `<span><b>VERSIÓN DEMO</b> · Los datos son de ejemplo y se guardan solo en tu navegador. Nada llega a la barbería real.</span>
    <span class="demo-acciones">
      <a href="${enAdmin ? 'index.html' : 'admin.html'}">${enAdmin ? 'Ver página de clientes' : 'Probar el panel de administración'}</a>
      <button type="button" id="demoReset">Reiniciar demo</button>
    </span>`;
  document.body.prepend(b);
  document.getElementById('demoReset').onclick = () => {
    if (confirm('¿Reiniciar la demo? Se borran tus pruebas y vuelven los datos de ejemplo.')) {
      try { localStorage.removeItem(DEMO_KEY); } catch (e) {}
      location.reload();
    }
  };
}
if (typeof MODO_DEMO !== 'undefined' && MODO_DEMO) {
  if (document.body) mostrarBannerDemo(); else document.addEventListener('DOMContentLoaded', mostrarBannerDemo);
}
