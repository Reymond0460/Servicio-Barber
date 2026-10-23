/* =====================================================================
   TEXTOS Y SECCIONES DE LA PÁGINA (index.html)
   El barbero elige desde su panel ("Mi página") qué textos cambiar y qué mostrar u ocultar.
   Esta función lo aplica sobre la página. Reglas:
     - Un texto vacío NO se toca: queda lo que dice index.html.
     - Todo se escribe con textContent (nunca como HTML), así que nada de lo que se escriba puede
       meter código en la página.
   Elementos de index.html que usa:
     data-aj="nombre | ciudad | insignia | titulo | subtitulo | etiquetas | whatsapp | instagram"
     data-aj-bloque="whatsapp | instagram | instagram-nota"  (se ocultan con los interruptores)
     data-aj-nav="servicios | trabajos"                      (enlaces del menú)
   ===================================================================== */

// '56912345678' -> '+56 9 1234 5678' (si no tiene formato chileno, se muestra con +)
function formatoWhatsapp(digitos) {
  const m = /^56(9)(\d{4})(\d{4})$/.exec(digitos);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : '+' + digitos;
}

function aplicarPagina(p) {
  const todos = sel => [...document.querySelectorAll(sel)];
  const ocultar = (el, ocultoSiTrue) => { if (el) el.hidden = !!ocultoSiTrue; };
  const m = p.mostrar;

  // Textos sencillos
  if (p.nombre) {
    todos('[data-aj="nombre"]').forEach(e => { e.textContent = p.nombre; });
    document.title = `${p.nombre} · Reserva tu hora`;
    todos('.herologo').forEach(i => { i.alt = p.nombre; });
  }
  if (p.ciudad) todos('[data-aj="ciudad"]').forEach(e => { e.textContent = p.ciudad; });
  if (p.insignia) todos('[data-aj="insignia"]').forEach(e => { e.textContent = p.insignia; });
  if (p.subtitulo) todos('[data-aj="subtitulo"]').forEach(e => { e.textContent = p.subtitulo; });

  // Título grande: cada línea escrita queda en su propia línea
  if (p.titulo) {
    todos('[data-aj="titulo"]').forEach(e => {
      e.textContent = '';
      p.titulo.split(/\r?\n/).forEach((linea, i) => {
        if (i) e.appendChild(document.createElement('br'));
        e.appendChild(document.createTextNode(linea));
      });
    });
  }

  // Etiquetas (separadas por comas)
  if (p.etiquetas) {
    todos('[data-aj="etiquetas"]').forEach(e => {
      e.textContent = '';
      p.etiquetas.split(',').map(t => t.trim()).filter(Boolean).slice(0, 8).forEach(t => {
        const s = document.createElement('span');
        s.textContent = t;
        e.appendChild(s);
      });
    });
  }

  // WhatsApp e Instagram (solo se aceptan números y un usuario válido, ya limpiados en fusionarAjustes)
  if (p.whatsapp) {
    todos('a[data-aj="whatsapp"]').forEach(a => {
      a.href = 'https://wa.me/' + p.whatsapp;
      a.textContent = 'WhatsApp ' + formatoWhatsapp(p.whatsapp);
    });
  }
  if (p.instagram) {
    todos('a[data-aj="instagram"]').forEach(a => {
      a.href = 'https://www.instagram.com/' + p.instagram + '/';
      a.textContent = '@' + p.instagram;
    });
  }

  // Interruptores: qué se muestra y qué se oculta
  ocultar(document.getElementById('servicios'), !m.servicios);
  todos('[data-aj-nav="servicios"]').forEach(e => ocultar(e, !m.servicios));
  ocultar(document.getElementById('trabajos'), !m.trabajos);
  todos('[data-aj-nav="trabajos"]').forEach(e => ocultar(e, !m.trabajos));
  todos('[data-aj="insignia"]').forEach(e => ocultar(e, !m.insignia));
  todos('[data-aj="etiquetas"]').forEach(e => ocultar(e, !m.etiquetas));
  todos('[data-aj-bloque="whatsapp"]').forEach(e => ocultar(e, !m.whatsapp));
  todos('[data-aj-bloque="instagram"], [data-aj-bloque="instagram-nota"]').forEach(e => ocultar(e, !m.instagram));
  todos('[data-aj-sep]').forEach(e => ocultar(e, !(m.whatsapp && m.instagram)));  // el " · " solo si se ven los dos
}
