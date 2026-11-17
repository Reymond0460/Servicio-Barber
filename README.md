# DiegoStudioBarber · Página de reservas

Sitio de reservas para una barbería, hecho con HTML, CSS y JavaScript, con base de datos en Firebase (Firestore).

- **Página de clientes:** `index.html` (reservar hora, servicios, trabajos)
- **Panel de administración:** `admin.html` (agenda, cobros, servicios, clientes), con inicio de sesión
- **Páginas legales:** `politica-de-privacidad.html`, `cookies.html`, `terminos.html`

## Estructura

| Carpeta o archivo | Qué contiene |
|---|---|
| `css/` | Estilos, divididos en módulos numerados. Empieza por `css/estilos.css` |
| `scripts/` | `crear-demo.js`, que genera la versión demo |
| `js/` | `editor.js` (editor de horario del panel), `modo.js` y `demo.js` (versión demo), `data.js` (configuración y acceso a la base de datos), `reservas.js` (clientes), `admin.js` (panel), `notificaciones.js` (avisos), `firebase-config.js` |
| `img/` | Logo, fondo y fotos de trabajos |
| `firestore.rules` | Reglas de seguridad de la base de datos (se pegan en la consola de Firebase) |
| `firebase.json` | Configuración del hosting de Firebase |
| `documentos/` | Cotización (uso privado) |
| `instructivo/` | Instructivo de uso en PDF |

## Probar en el computador

Abrir la carpeta en VS Code y usar la extensión Live Server sobre `index.html`.

## Publicar

```
firebase deploy --only hosting,firestore:rules --project barber-diego
```

Las carpetas `documentos/` e `instructivo/` no se publican (ver `firebase.json`).

## Editor del panel: horario

En `admin.html`, al final del panel, el barbero tiene la sección **Mi horario**: días y horas de atención, duración de cada hora (30 a 120 min), pausa de almuerzo, días libres sueltos y hasta cuántos días adelante se reserva.

Se guarda en un solo documento de Firestore (`settings/sitio`). La página de clientes lo lee en tiempo real (`js/data.js` calcula las horas con `horasDelDia`). Si el documento no existe o no se puede leer, se usan los valores iniciales de `AJUSTES_BASE` en `js/data.js`. Requiere la regla `settings` de `firestore.rules`.

## Versión demo

Sitio aparte donde cualquiera puede probar la reserva y el panel **sin tocar los datos reales**: https://studiobarber-demo.web.app

- Usa datos de ejemplo guardados en el navegador de cada visitante (`js/demo.js`). No usa Firebase ni inicio de sesión.
- Se activa con `MODO_DEMO` en `js/modo.js`, que en la página real siempre queda en `false`.
- Para regenerarla y publicarla (después de cambiar algo):

```
node scripts/crear-demo.js
firebase deploy --only hosting,firestore:rules --config firebase.demo.json --project barber-diego
```

## Reglas de Firestore: SIEMPRE actualizadas

`firestore.rules` es la única fuente de las reglas. Los comandos de publicación de arriba usan
`--only hosting,firestore:rules`, así que **cada publicación sube también las reglas** (están enlazadas en
`firebase.json` y `firebase.demo.json`). Nunca publicar solo `hosting` ni editar las reglas a mano en la consola:
si se cambian en la consola, el próximo deploy las reemplaza por las del repositorio.
El agente de WhatsApp (repo auto-wsp2) verifica en su QA (`tests/test_produccion.py`) que las reglas publicadas
dejen leer `settings/sitio`, `services` y `slots`.

## Seguridad

La clave de Firebase de `js/firebase-config.js` es pública por diseño. La protección real está en `firestore.rules` y en el inicio de sesión del panel. **No subir contraseñas ni archivos de cuentas de servicio a este repositorio.**
