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

// 2) Pedir a los buscadores que no la indexen.
for (const archivo of fs.readdirSync(SALIDA).filter(f => f.endsWith('.html'))) {
  const ruta = path.join(SALIDA, archivo);
  const html = fs.readFileSync(ruta, 'utf8').replace('<meta charset="utf-8">', '<meta charset="utf-8">\n  <meta name="robots" content="noindex, nofollow">');
  fs.writeFileSync(ruta, html);
}
fs.writeFileSync(path.join(SALIDA, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

console.log('Demo generada en demo-build/');
