# Instrucciones del proyecto

- Reglas de Firestore SIEMPRE actualizadas: `firestore.rules` es la fuente única. Publicar siempre con
  `firebase deploy --only hosting,firestore:rules ...` (nunca solo `hosting`). Si cambias reglas, colecciones o
  correos admin, recuérdale al usuario publicar en el mismo paso.
- La demo (studiobarber-demo) y la página real comparten Firestore `barber-diego` y el agente de WhatsApp
  (repo Reymond0460/auto-wsp2) lee/escribe `settings/sitio`, `services`, `slots` y `appointments`:
  cualquier cambio en esas colecciones o en `horasDelDia` (js/data.js) debe replicarse en `agent/agenda_web.py`.
