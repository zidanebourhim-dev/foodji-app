import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDSzSNjmM6f1ATtfoOm9OybIAQpQjKfleg",
  authDomain: "foodji-new.firebaseapp.com",
  projectId: "foodji-new",
  storageBucket: "foodji-new.firebasestorage.app",
  messagingSenderId: "332967788626",
  appId: "1:332967788626:web:9eab671b117e2033969f8b"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// On exporte tout d'un coup pour éviter le bug d'initialisation
export { db, auth };
export default app;