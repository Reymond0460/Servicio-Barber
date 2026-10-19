# DiegoStudioBarber · Página de reservas

Sitio de reservas para una barbería, hecho con HTML, CSS y JavaScript, con base de datos en Firebase (Firestore).

- **Página de clientes:** `index.html` (reservar hora, servicios, trabajos)
- **Panel de administración:** `admin.html` (agenda, cobros, servicios, clientes), con inicio de sesión
- **Páginas legales:** `politica-de-privacidad.html`, `cookies.html`, `terminos.html`

## Estructura

| Carpeta o archivo | Qué contiene |
|---|---|
| `css/` | Estilos, divididos en módulos numerados. Empieza por `css/estilos.css` |
| `js/` | `data.js` (configuración y acceso a la base de datos), `reservas.js` (clientes), `admin.js` (panel), `notificaciones.js` (avisos), `firebase-config.js` |
| `img/` | Logo, fondo y fotos de trabajos |
| `firestore.rules` | Reglas de seguridad de la base de datos (se pegan en la consola de Firebase) |
| `firebase.json` | Configuración del hosting de Firebase |
| `documentos/` | Cotización (uso privado) |
| `instructivo/` | Instructivo de uso en PDF |

## Probar en el computador

Abrir la carpeta en VS Code y usar la extensión Live Server sobre `index.html`.

## Publicar

```
firebase deploy --only hosting --project barber-diego
```

Las carpetas `documentos/` e `instructivo/` no se publican (ver `firebase.json`).

## Seguridad

La clave de Firebase de `js/firebase-config.js` es pública por diseño. La protección real está en `firestore.rules` y en el inicio de sesión del panel. **No subir contraseñas ni archivos de cuentas de servicio a este repositorio.**
