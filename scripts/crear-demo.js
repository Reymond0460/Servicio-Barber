/* =====================================================================
   GENERA LA VERSIÓN DEMO
   Copia la página a la carpeta "demo-build", activa el modo demo y evita que
   Google la indexe. No modifica los archivos de la página real.

   Uso (desde la carpeta del proyecto):
     node scripts/crear-demo.js
     firebase deploy --only hosting --config firebase.demo.json --project barber-diego
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'demo-build');

// Lo que forma parte de la página (no se copian documentos privados ni reglas).
const COPIAR = [
  'index.html', 'admin.html', 'politica-de-privacidad.html', 'cookies.html', 'terminos.html',
  'css', 'js', 'img'
];

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });

for (const item of COPIAR) {
  fs.cpSync(path.join(RAIZ, item), path.join(SALIDA, item), {
    recursive: true,
    filter: origen => !origen.endsWith('desktop.ini')
  });
}

// 1) Activar el modo demo.
const modo = path.join(SALIDA, 'js', 'modo.js');
const antes = fs.readFileSync(modo, 'utf8');
const despues = antes.replace('const MODO_DEMO = false;', 'const MODO_DEMO = true;');
if (antes === despues) throw new Error('No se encontró "const MODO_DEMO = false;" en js/modo.js');
fs.writeFileSync(modo, despues);

// 2) Ocultar los datos reales: la demo es pública y no debe mostrar el teléfono,
//    el Instagram ni la ubicación reales del negocio. Se aplica solo a la copia.
//    El orden importa: primero los textos más largos.
const REEMPLAZOS = [
  // Nombre del negocio: la demo se llama «StudioBarber»; la página real conserva «DiegoStudioBarber».
  ['DiegoStudioBarber', 'StudioBarber'],
  ['Corte realizado por Diego', 'Corte realizado por StudioBarber'],
  ['Panel de Diego', 'Panel de StudioBarber'],
  ['Panel · Diego', 'Panel · StudioBarber'],
  ['El responsable (Diego)', 'El responsable (el negocio)'],
  ['RAZÓN SOCIAL DE DIEGO', 'RAZÓN SOCIAL DEL NEGOCIO'],
  ['avísale a Diego para liberar', 'avísale al negocio para liberar'],
  ['Solo Diego, con correo', 'Solo el administrador, con correo'],
  ['administración de Diego', 'administración del negocio'],
  ['href="https://wa.me/56984195182" target="_blank" rel="noopener"', 'href="#"'],
  ['href="https://www.instagram.com/diegostudiobarber/" target="_blank" rel="noopener"', 'href="#"'],
  ['href="https://www.instagram.com/diegostudiobarber/"', 'href="#"'],
  // Datos inventados con aspecto real (ficticios): no pertenecen a ninguna persona ni negocio.
  ['+56 9 8419 5182', '+56 9 1234 5678'],
  ['@diegostudiobarber', '@barberia_demo'],
  ['San Miguel, Santiago', 'Calle Ejemplo 123, Santiago'],
  ['San Miguel', 'Santiago'],
  ['Brayan Mondaca G.', 'Desarrollador Demo']
];

// 3) Pedir a los buscadores que no la indexen, aplicar los reemplazos y
//    quitar Firebase: en la demo no se usa, así que no se cargan sus scripts
//    ni se publican los identificadores del proyecto.
const SDK_FIREBASE = /\s*<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>/g;
for (const archivo of fs.readdirSync(SALIDA).filter(f => f.endsWith('.html'))) {
  const ruta = path.join(SALIDA, archivo);
  let html = fs.readFileSync(ruta, 'utf8')
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="robots" content="noindex, nofollow">')
    .replace(SDK_FIREBASE, '')
    // En la demo no se muestra Instagram: se quitan el párrafo «Más trabajos en…» y el enlace del pie de página.
    .replace(/\s*<p class="note"[^>]*>Más trabajos en <a href="https:\/\/www\.instagram\.com\/[^"]*"[^>]*>[^<]*<\/a><\/p>/g, '')
    .replace(/ · <a href="https:\/\/www\.instagram\.com\/[^"]*"[^>]*>[^<]*<\/a>/g, '')
    // Quitar los comentarios HTML: pueden guardar enlaces o datos reales que se ven en "ver código fuente".
    .replace(/<!--[\s\S]*?-->/g, '');
  for (const [buscar, poner] of REEMPLAZOS) html = html.split(buscar).join(poner);
  fs.writeFileSync(ruta, html);
}
// Los mensajes que ve el cliente dentro de js/reservas.js también llevan los reemplazos.
for (const archivo of ['reservas.js']) {
  const ruta = path.join(SALIDA, 'js', archivo);
  let js = fs.readFileSync(ruta, 'utf8');
  for (const [buscar, poner] of REEMPLAZOS) js = js.split(buscar).join(poner);
  fs.writeFileSync(ruta, js);
}
// Configuración de Firebase vacía (la demo no se conecta a ninguna base de datos).
fs.writeFileSync(
  path.join(SALIDA, 'js', 'firebase-config.js'),
  '// Versión demo: no se usa Firebase.\nconst fdb = null;\n'
);
fs.writeFileSync(path.join(SALIDA, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

console.log('Demo generada en demo-build/');
