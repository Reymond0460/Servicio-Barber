/* =====================================================================
   PÁGINA DEL CLIENTE (index.html)
   Flujo: servicio -> día (calendario) -> hora -> nombre y teléfono -> confirmar.
   Cada función "render..." dibuja una parte de la página.
   ===================================================================== */

let S = { services: [], slots: [] };   // datos que llegan de Firestore en tiempo real
let serviciosCargados = false;        // true cuando Firestore ya respondió (aunque no haya servicios)
const activos = () => S.services.filter(x => x.active !== false);   // servicios no eliminados
const $ = id => document.getElementById(id);

// Lo que el cliente va eligiendo.
const sel = {
  svc: 0,                       // posición del servicio elegido
  date: null,                   // día elegido (objeto Date)
  time: null,                   // hora elegida, ej. '11:00'
  name: '', phone: '',
  acepta: false,                // aceptó la política de privacidad
  done: false                   // true cuando ya confirmó
};

// Mes que está mostrando el calendario.
const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
// Último día en que se puede reservar (depende de lo que el barbero configuró en "Mi horario").
const ultimoDia = () => { const u = new Date(hoy); u.setDate(u.getDate() + AJUSTES.horario.diasAdelante); return u; };
let vista = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

// ¿Se puede reservar este día? (no pasado, dentro del límite, y el barbero atiende ese día)
const diaDisponible = d => d >= hoy && d <= ultimoDia() && diaAbierto(d);

/* ---------- Servicios ---------- */
function renderServicios() {
  if (!activos().length) {
    $('services').innerHTML = '<p class="note">' + (serviciosCargados ? 'Por ahora no hay servicios disponibles. Vuelve a intentar en unos minutos.' : 'Cargando servicios…') + '</p>';
    return;
  }
  $('services').innerHTML = activos().map((s, i) => `
    <button class="svc ${sel.svc === i ? 'sel' : ''}" data-i="${i}">
      <div class="top"><span class="n">${esc(s.name)}</span><span class="p">${money(s.price)}</span></div>
      <div class="d">${s.duration || ''}</div>
    </button>`).join('');
  $('services').querySelectorAll('button').forEach(b => {
    b.onclick = () => { sel.svc = +b.dataset.i; renderTodo(); };
  });
}

/* ---------- Calendario mensual (estilo calendario de Windows) ---------- */
function renderCalendario() {
  const anio = vista.getFullYear(), mes = vista.getMonth();

  // La semana empieza en lunes: getDay() da 0 para domingo, lo pasamos a 6.
  const primerDia = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const inicio = new Date(anio, mes, 1 - primerDia);   // primer cuadro de la grilla

  let celdas = '';
  for (let i = 0; i < 42; i++) {                       // 6 semanas x 7 días
    const d = new Date(inicio); d.setDate(inicio.getDate() + i);
    const clases = ['cal-day'];
    if (d.getMonth() !== mes) clases.push('otro');     // días de otro mes, en gris
    if (d.getTime() === hoy.getTime()) clases.push('hoy');
    if (sel.date && d.getTime() === sel.date.getTime()) clases.push('sel');
    const libre = diaDisponible(d);
    if (!libre) clases.push('off');
    celdas += `<button class="${clases.join(' ')}" data-t="${d.getTime()}" ${libre ? '' : 'disabled'}>${d.getDate()}</button>`;
  }

  const puedeAtras = new Date(anio, mes, 0) >= hoy;            // hay días en el mes anterior
  const puedeAdelante = new Date(anio, mes + 1, 1) <= ultimoDia();  // hay días en el mes siguiente

  $('cal').innerHTML = `
    <div class="cal-head">
      <b>${MONTHS_FULL[mes]} ${anio}</b>
      <div>
        <button id="prev" aria-label="Mes anterior" ${puedeAtras ? '' : 'disabled'}>&#9650;</button>
        <button id="next" aria-label="Mes siguiente" ${puedeAdelante ? '' : 'disabled'}>&#9660;</button>
      </div>
    </div>
    <div class="cal-grid cal-dows">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="cal-grid">${celdas}</div>`;

  $('prev').onclick = () => { vista = new Date(anio, mes - 1, 1); renderCalendario(); };
  $('next').onclick = () => { vista = new Date(anio, mes + 1, 1); renderCalendario(); };
  $('cal').querySelectorAll('.cal-day').forEach(b => {
    b.onclick = () => {
      sel.date = new Date(+b.dataset.t);
      sel.time = null;
      vista = new Date(sel.date.getFullYear(), sel.date.getMonth(), 1);
      renderTodo();
    };
  });
}

/* ---------- Horas del día elegido ---------- */
function renderHoras() {
  if (!sel.date) {
    $('slots').innerHTML = '<p class="note">Primero elige un día en el calendario.</p>';
    return;
  }
  // Una hora está ocupada si existe su candado en 'slots' (si Diego marca "no llegó", el candado se quita).
  const ocupadas = S.slots.filter(a => a.date === dayKey(sel.date)).map(a => a.time);
  // Las horas que ya pasaron (hoy) se muestran como no disponibles.
  if (sel.time && horaPasada(sel.date, sel.time)) sel.time = null;
  const horas = horasDelDia(sel.date);          // las horas que el barbero dejó disponibles ese día
  if (!horas.length) { $('slots').innerHTML = '<p class="note">No hay horas disponibles este día.</p>'; return; }
  $('slots').innerHTML = horas.map(t => {
    const ocupada = horaOcupada(t, ocupadas) || horaPasada(sel.date, t);
    return `<button class="slot ${ocupada ? 'busy' : ''} ${sel.time === t ? 'sel' : ''}" data-t="${t}">${t}</button>`;
  }).join('');
  $('slots').querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      if (b.classList.contains('busy')) return;        // hora ya tomada
      sel.time = b.dataset.t;
      renderTodo();
    };
  });
}

/* ---------- Panel de datos y confirmación ---------- */
function renderResumen() {
  const s = activos()[sel.svc] || activos()[0];
  if (!s) { $('side').innerHTML = '<p class="note">' + (serviciosCargados ? 'Sin servicios disponibles por ahora.' : 'Cargando…') + '</p>'; return; }
  const dia = sel.date ? `${DOWS[sel.date.getDay()]} ${sel.date.getDate()} ${MONTHS[sel.date.getMonth()]}` : '—';

  // Pantalla final, después de confirmar.
  if (sel.done) {
    $('side').innerHTML = `
      <div class="ok">
        <h3>¡Hora reservada!</h3>
        <p style="font-size:17px;line-height:1.5">${esc(sel.name)}, te esperamos el <b>${dia}</b> a las <b>${sel.time}</b>. Pagas ${money(s.price)} en la barbería.</p>
        <p class="note">Si no puedes llegar, avísale a Diego para liberar la hora.</p>
        <button class="btnline" id="again" style="background:none;min-height:48px">Reservar otra hora</button>
      </div>`;
    $('again').onclick = () => { sel.done = false; sel.time = null; sel.name = ''; sel.phone = ''; sel.acepta = false; renderTodo(); };
    return;
  }

  const lista = () => sel.date && sel.time && sel.name.trim().length > 1 && normalizarTelefono(sel.phone) && sel.acepta;
  const mensaje = () => !sel.date ? 'Elige un día.'
    : !sel.time ? 'Elige una hora disponible.'
    : sel.name.trim().length < 2 ? 'Escribe tu nombre.'
    : !normalizarTelefono(sel.phone) ? 'Escribe un celular válido, ej. +56912345678.'
    : !sel.acepta ? 'Acepta la política de privacidad para continuar.'
    : 'No se cobra nada ahora.';

  $('side').innerHTML = `
    <h2 style="font-size:30px;margin-bottom:16px">3 · Tus datos</h2>
    <label for="n">Nombre</label><input id="n" placeholder="Tu nombre" value="${sel.name}">
    <label for="p">WhatsApp / teléfono</label><input id="p" type="tel" inputmode="tel" maxlength="12" placeholder="+56912345678" value="${sel.phone}">
    <label class="consent"><input type="checkbox" id="c" ${sel.acepta ? 'checked' : ''}>
      <span>He leído y acepto la <a href="politica-de-privacidad.html" target="_blank" rel="noopener">política de privacidad</a>. Usaremos mi nombre y celular solo para gestionar esta reserva.</span></label>
    <div class="sum">
      <div><span>Servicio</span><span>${esc(s.name)}</span></div>
      <div><span>Día</span><span>${dia}</span></div>
      <div><span>Hora</span><span>${sel.time || '—'}</span></div>
      <div class="tot"><span>Total a pagar en local</span><span>${money(s.price)}</span></div>
    </div>
    <button class="confirm ${lista() ? 'ready' : ''}" id="ok">Confirmar reserva</button>
    <div class="hint" id="hint">${mensaje()}</div>`;

  // Mientras escribe, actualizamos el botón sin redibujar todo (para no perder el cursor).
  const actualizar = () => {
    $('p').value = $('p').value.replace(/[^\d+]/g, '');   // solo números y el +
    sel.name = $('n').value; sel.phone = $('p').value;
    $('ok').classList.toggle('ready', !!lista());
    $('hint').textContent = mensaje();
  };
  $('n').oninput = actualizar;
  $('p').oninput = actualizar;
  $('c').onchange = () => { sel.acepta = $('c').checked; actualizar(); };

  $('ok').onclick = async () => {
    actualizar();
    if (!lista()) return;
    $('ok').disabled = true;
    $('hint').textContent = 'Guardando…';
    try {
      // Guarda la reserva, el cliente y el candado de la hora en Firestore.
      await Store.book({ date: dayKey(sel.date), time: sel.time, client: sel.name.trim(), phone: normalizarTelefono(sel.phone), service: s, consent: true });
      sel.done = true;
    } catch (e) {
      if (e.message === 'TAKEN') { sel.time = null; alert('Esa hora acaba de ser tomada. Elige otra.'); }
      else mostrarErrorBD(e);
    }
    renderTodo();
  };
}

function renderTodo() {
  renderServicios();
  renderCalendario();
  renderHoras();
  renderResumen();
}
// Conexión en tiempo real: cada vez que cambian los datos, se redibuja la página.
Store.onServices(list => { S.services = list; serviciosCargados = true; renderTodo(); }, mostrarErrorBD);
Store.onSlots(list => { S.slots = list; renderTodo(); }, mostrarErrorBD);

// Horario y textos que el barbero configuró en su panel. Si aún no se pueden leer (por ejemplo, antes de
// publicar las reglas de Firestore), no se muestra ningún error: la página usa los valores iniciales.
Store.onSettings(datos => {
  AJUSTES = fusionarAjustes(datos);
  if (sel.date && !diaDisponible(sel.date)) { sel.date = null; sel.time = null; }   // el barbero cerró ese día
  aplicarPagina(AJUSTES.pagina);
  renderTodo();
}, e => console.warn('No se pudieron leer los ajustes; se usan los valores iniciales.', e && e.code));
renderTodo();

// Cada minuto se revisa qué horas ya pasaron, sin tocar lo que el cliente está escribiendo.
setInterval(renderHoras, 60000);
