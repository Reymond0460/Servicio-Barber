/* =====================================================================
   CONEXIÓN A FIREBASE
   Estos datos identifican el proyecto "barber-diego". No son secretos:
   la seguridad la dan las reglas de Firestore (archivo firestore.rules).
   ===================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyDm6HxU-Tl6ObUc9F-CfbKGWXPPU6BfkM8",
  authDomain: "barber-diego.firebaseapp.com",
  projectId: "barber-diego",
  storageBucket: "barber-diego.firebasestorage.app",
  messagingSenderId: "153564844324",
  appId: "1:153564844324:web:30f7acf8494b0f191023b1"
};

firebase.initializeApp(firebaseConfig);
const fdb = firebase.firestore();   // la base de datos
