/* =====================================================================
   EDITOR DE HORARIO DEL PANEL (admin.html, sección "Mi horario")
   Aquí el barbero elige qué días y horas atiende, la duración de cada hora,
   una pausa y sus días libres. Se guarda como un documento en Firestore
   (settings/sitio) y la página de clientes lo lee en tiempo real.

   Funciones (las usa js/admin.js):
     edConstruir()        arma las filas de los días (se llama una vez)
     edCargar(forzar)     llena los campos con lo guardado (solo la primera vez, o si forzar = true)
     edErrorAjustes(e)    avisa si no se pudieron leer los ajustes
   ===================================================================== */

const ED_DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0];   // la semana empieza en lunes
const ED_NOMBRES = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };

let edLibres = [];      // días libres que se están editando ('2026-12-25', ...)
let edListo = false;    // true cuando ya se llenaron los campos con lo guardado
let edVista = null;     // mes que muestra el calendario de días libres (primer día del mes)
let edModo = 'dia';     // 'dia' = un día por toque · 'rango' = varios días seguidos (primer y último toque)
let edInicioRango = null; // primer día tocado cuando se elige un rango

const edMensaje = (id, texto, ok) => { const m = $(id); m.textContent = texto; m.className = 'msg ' + (ok ? 'ok' : 'err'); };
const edDuracionTexto = m => (m < 60 ? m + ' min' : m === 60 ? '1 hora' : m === 90 ? '1 hora 30 min' : (m / 60) + ' horas');

/* ---------- Armado inicial ---------- */
function edConstruir() {
  $('ed-dias').innerHTML = ED_DIAS_ORDEN.map(d => `
    <div class="ed-dia" data-d="${d}">
      <label class="ed-check"><input type="checkbox" class="ed-abierto"> ${ED_NOMBRES[d]}</label>
      <span class="ed-par"><input type="time" class="ed-desde" step="900" aria-label="${ED_NOMBRES[d]} desde"> a <input type="time" class="ed-hasta" step="900" aria-label="${ED_NOMBRES[d]} hasta"></span>
    </div>`).join('');
  $('ed-duracion').innerHTML = DURACIONES.map(m => `<option value="${m}">${edDuracionTexto(m)}</option>`).join('');

  // Cuando un día se desmarca, sus horas se apagan
  $('ed-dias').addEventListener('change', e => {
    if (e.target.classList.contains('ed-abierto')) edAplicarAbierto(e.target.closest('.ed-dia'));
  });
  edIniciarCalendario();
  $('ed-guardar-horario').onclick = edGuardarHorario;
}

function edAplicarAbierto(fila) {
  const abierto = fila.querySelector('.ed-abierto').checked;
  fila.querySelectorAll('.ed-desde, .ed-hasta').forEach(i => { i.disabled = !abierto; });
  fila.classList.toggle('ed-cerrado', !abierto);
}

/* ---------- Llenar los campos con lo guardado ---------- */
function edCargar(forzar) {
  if (edListo && !forzar) return;     // no pisar lo que el barbero está escribiendo
  edListo = true;

  const h = AJUSTES.horario;
  document.querySelectorAll('.ed-dia').forEach(fila => {
    const cfg = h.dias[fila.dataset.d];
    fila.querySelector('.ed-abierto').checked = cfg.abierto;
    fila.querySelector('.ed-desde').value = cfg.desde;
    fila.querySelector('.ed-hasta').value = cfg.hasta;
    edAplicarAbierto(fila);
  });
  $('ed-duracion').value = String(h.duracionMin);
  $('ed-descanso-on').checked = h.descanso.activo;
  $('ed-descanso-desde').value = h.descanso.desde;
  $('ed-descanso-hasta').value = h.descanso.hasta;
  $('ed-adelante').value = h.diasAdelante;
  edLibres = [...h.diasLibres];
  edDibujarLibres();
}

/* ---------- Días libres ---------- */
const edClave = d => dayKey(d);
const edHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function edDibujarLibres() {
  $('ed-libres').innerHTML = edLibres.length
    ? edLibres.map(k => {
        const f = fechaDe(k);
        return `<span class="ed-chip">${DOWS[f.getDay()]} ${f.getDate()} ${MONTHS[f.getMonth()]} ${f.getFullYear()}
          <button type="button" data-k="${k}" aria-label="Quitar ${k}">×</button></span>`;
      }).join('')
    : '<span class="note">No tienes días libres cargados.</span>';
  $('ed-libres').querySelectorAll('button').forEach(b => {
    b.onclick = () => { edLibres = edLibres.filter(k => k !== b.dataset.k); edDibujarLibres(); };
  });
  $('ed-libre-texto').textContent = edLibres.length
    ? `${edLibres.length} día${edLibres.length === 1 ? '' : 's'} libre${edLibres.length === 1 ? '' : 's'} · tocar para cambiar`
    : 'Elegir fechas en el calendario';
  if (!$('ed-libre-cal').hidden) edDibujarCalendario();   // el calendario abierto se mantiene al día
}

/* ---------- Calendario para elegir los días libres ---------- */
function edIniciarCalendario() {
  const abrir = $('ed-libre-abrir'), panel = $('ed-libre-cal');
  abrir.onclick = () => edAbrirCalendario(panel.hidden);
  // Escape cierra el calendario
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { edAbrirCalendario(false); abrir.focus(); } });
}

function edAbrirCalendario(abrir) {
  const panel = $('ed-libre-cal');
  panel.hidden = !abrir;
  $('ed-libre-abrir').setAttribute('aria-expanded', String(abrir));
  if (abrir) {
    edVista = edVista || new Date(edHoy().getFullYear(), edHoy().getMonth(), 1);
    edInicioRango = null;
    edDibujarCalendario();
  }
}

function edDibujarCalendario() {
  const hoyD = edHoy(), ultimo = new Date(hoyD); ultimo.setDate(ultimo.getDate() + 365);
  const anio = edVista.getFullYear(), mes = edVista.getMonth();
  const inicio = new Date(anio, mes, 1 - ((new Date(anio, mes, 1).getDay() + 6) % 7));   // semana desde el lunes

  let celdas = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio); d.setDate(inicio.getDate() + i);
    const k = edClave(d);
    const fuera = d < hoyD || d > ultimo;
    const clases = ['cal-day'];
    if (d.getMonth() !== mes) clases.push('otro');
    if (d.getTime() === hoyD.getTime()) clases.push('hoy');
    if (edLibres.includes(k)) clases.push('sel');
    if (k === edInicioRango) clases.push('sel', 'ed-inicio');
    // Días en que el negocio ya no atiende por la semana (se ven apagados, igual se pueden marcar)
    const fila = document.querySelector(`.ed-dia[data-d="${d.getDay()}"] .ed-abierto`);
    if (fila && !fila.checked && !fuera) clases.push('ed-cierra');
    if (fuera) clases.push('off');
    celdas += `<button type="button" class="${clases.join(' ')}" data-k="${k}" ${fuera ? 'disabled' : ''} aria-pressed="${edLibres.includes(k)}" aria-label="${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}">${d.getDate()}</button>`;
  }

  $('ed-libre-cal').innerHTML = `
    <div class="ed-modos" role="group" aria-label="Cómo elegir los días">
      <button type="button" data-modo="dia" class="${edModo === 'dia' ? 'on' : ''}">Un día a la vez</button>
      <button type="button" data-modo="rango" class="${edModo === 'rango' ? 'on' : ''}">Varios días seguidos</button>
    </div>
    <p class="note" id="ed-cal-ayuda">${edModo === 'dia'
      ? 'Toca un día para marcarlo como libre. Tócalo otra vez para quitarlo.'
      : (edInicioRango ? 'Ahora toca el último día del período.' : 'Toca el primer día y luego el último; se marcan todos los de en medio.')}</p>
    <div class="cal-head">
      <b>${MONTHS_FULL[mes]} ${anio}</b>
      <div>
        <button type="button" id="ed-cal-prev" aria-label="Mes anterior" ${new Date(anio, mes, 0) >= hoyD ? '' : 'disabled'}>&#9650;</button>
        <button type="button" id="ed-cal-next" aria-label="Mes siguiente" ${new Date(anio, mes + 1, 1) <= ultimo ? '' : 'disabled'}>&#9660;</button>
      </div>
    </div>
    <div class="cal-grid cal-dows">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div>
    <div class="cal-grid" id="ed-cal-dias">${celdas}</div>
    <div class="ed-cal-pie">
      <span class="note">${edLibres.length} día${edLibres.length === 1 ? '' : 's'} libre${edLibres.length === 1 ? '' : 's'} elegido${edLibres.length === 1 ? '' : 's'}</span>
      <button type="button" class="btnline" id="ed-cal-listo">Listo</button>
    </div>`;

  $('ed-cal-prev').onclick = () => { edVista = new Date(anio, mes - 1, 1); edDibujarCalendario(); };
  $('ed-cal-next').onclick = () => { edVista = new Date(anio, mes + 1, 1); edDibujarCalendario(); };
  $('ed-cal-listo').onclick = () => { edAbrirCalendario(false); $('ed-libre-abrir').focus(); };
  $('ed-libre-cal').querySelectorAll('.ed-modos button').forEach(b => {
    b.onclick = () => { edModo = b.dataset.modo; edInicioRango = null; edDibujarCalendario(); };
  });
  $('ed-cal-dias').querySelectorAll('.cal-day').forEach(b => { b.onclick = () => edElegirDia(b.dataset.k); });
}

// Un toque sobre un día del calendario
function edElegirDia(k) {
  if (edModo === 'dia') {
    edLibres = edLibres.includes(k) ? edLibres.filter(x => x !== k) : [...edLibres, k].sort();
  } else if (!edInicioRango) {
    edInicioRango = k;                                            // primer toque: empieza el período
  } else {
    const [desde, hasta] = [edInicioRango, k].sort();             // segundo toque: se marcan todos los días
    const hoyD = edHoy(), nuevos = new Set(edLibres);
    for (let d = fechaDe(desde), n = 0; edClave(d) <= hasta && n < 366; d.setDate(d.getDate() + 1), n++) {
      if (d >= hoyD) nuevos.add(edClave(d));
    }
    edLibres = [...nuevos].sort();
    edInicioRango = null;
  }
  edMensaje('ed-msg-horario', 'Cambiaste tus días libres. Pulsa «Guardar horario» para que queden.', true);
  edDibujarLibres();                                              // redibuja chips y calendario
}

/* ---------- Guardar horario ---------- */
function edLeerHorario() {
  const dias = {};
  for (const fila of document.querySelectorAll('.ed-dia')) {
    const abierto = fila.querySelector('.ed-abierto').checked;
    const desde = fila.querySelector('.ed-desde').value, hasta = fila.querySelector('.ed-hasta').value;
    if (abierto && !(horaValida(desde) && horaValida(hasta) && aMin(hasta) > aMin(desde))) {
      return { error: `${ED_NOMBRES[fila.dataset.d]}: la hora de cierre debe ser después de la de apertura.` };
    }
    dias[fila.dataset.d] = { abierto, desde: horaValida(desde) || '10:00', hasta: horaValida(hasta) || '20:00' };
  }
  const dd = $('ed-descanso-desde').value, dh = $('ed-descanso-hasta').value, pausa = $('ed-descanso-on').checked;
  if (pausa && !(horaValida(dd) && horaValida(dh) && aMin(dh) > aMin(dd))) return { error: 'La pausa debe terminar después de empezar.' };
  const adelante = parseInt($('ed-adelante').value, 10);
  if (!(adelante >= 7 && adelante <= 365)) return { error: 'Los días hacia adelante deben ser entre 7 y 365.' };
  return {
    horario: {
      dias, duracionMin: Number($('ed-duracion').value),
      descanso: { activo: pausa, desde: horaValida(dd) || '13:00', hasta: horaValida(dh) || '14:00' },
      diasLibres: [...edLibres], diasAdelante: adelante
    }
  };
}

// Cuántas reservas futuras quedarían fuera del nuevo horario (no se borran, solo se avisa)
function edReservasFuera(horario) {
  const prueba = fusionarAjustes({ horario });
  return D.appts.filter(a => a.status === 'open' && a.date >= hoy && !horasDelDia(fechaDe(a.date), prueba).includes(a.time)).length;
}

async function edGuardarHorario() {
  const r = edLeerHorario();
  if (r.error) return edMensaje('ed-msg-horario', r.error, false);
  const fuera = edReservasFuera(r.horario);
  $('ed-guardar-horario').disabled = true;
  try {
    await Store.saveSettings({ horario: r.horario });
    AJUSTES = fusionarAjustes({ horario: r.horario });
    edCargar(true);
    edMensaje('ed-msg-horario', '¡Horario guardado! Ya lo ven tus clientes.' + (fuera ? ` Ojo: ${fuera} reserva(s) futura(s) quedaron fuera del nuevo horario; siguen vigentes, revísalas en la agenda.` : ''), true);
  } catch (e) { edErrorGuardar('ed-msg-horario', e); }
  $('ed-guardar-horario').disabled = false;
}

function edErrorGuardar(id, e) {
  console.error(e);
  const permiso = e && /permission/i.test(String(e.code || e.message));
  edMensaje(id, permiso
    ? 'No se pudo guardar: falta publicar las reglas de Firestore (archivo firestore.rules) o tu cuenta no tiene permiso.'
    : 'No se pudo guardar. Intenta de nuevo.', false);
}

// Si no se pueden leer los ajustes, el editor sigue funcionando con los valores iniciales
function edErrorAjustes(e) {
  console.warn('No se pudieron leer los ajustes', e && e.code);
  edCargar(false);
  edMensaje('ed-msg-horario', 'Aún no se pueden leer ni guardar los ajustes (falta publicar las reglas de Firestore).', false);
}
