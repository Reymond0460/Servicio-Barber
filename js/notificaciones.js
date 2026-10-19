/* =====================================================================
   AVISOS DE NUEVA RESERVA (solo panel de Diego, admin.html)
   Cuando llega una reserva mientras el panel está abierto, se muestra:
     1. un cartel dentro de la página,
     2. una notificación del navegador (si Diego dio permiso),
     3. un sonido corto,
     4. el título de la pestaña con el número de reservas nuevas.
   Si el panel está cerrado no avisa (eso requeriría el plan de pago de Firebase).
   ===================================================================== */
const Notificaciones = {
  nuevas: 0,                              // reservas nuevas sin ver
  tituloOriginal: document.title,

  // Pide permiso para mostrar notificaciones del navegador.
  async pedirPermiso() {
    if (!('Notification' in window)) return 'Este navegador no permite notificaciones.';
    const permiso = await Notification.requestPermission();
    return permiso === 'granted'
      ? 'Avisos activados. Deja esta pestaña abierta para recibirlos.'
      : 'Permiso denegado. Igual verás el cartel y oirás el sonido dentro de la página.';
  },

  // Se llama una vez por cada reserva nueva.
  avisar(reserva) {
    const texto = `${reserva.client} reservó ${reserva.svc} el ${reserva.date.slice(8)}-${reserva.date.slice(5, 7)} a las ${reserva.time}`;
    this.nuevas++;
    document.title = `(${this.nuevas}) Nueva reserva · ${this.tituloOriginal}`;
    this.cartel(texto);
    this.sonido();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nueva reserva', { body: texto, icon: 'img/logo.jpeg' });
    }
  },

  // Cartel en la esquina de la página.
  cartel(texto) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = '🔔 ' + texto;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 10000);
  },

  // Dos pitidos cortos (sin archivo de audio).
  sonido() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25].forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.15);
      });
    } catch (e) { /* el navegador puede bloquear el sonido hasta que se haga un clic */ }
  },

  // Al volver a la pestaña, se limpia el contador del título.
  limpiar() {
    this.nuevas = 0;
    document.title = this.tituloOriginal;
  }
};

window.addEventListener('focus', () => Notificaciones.limpiar());
