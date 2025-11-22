// app/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 👇 REMPLACEZ CI-DESSOUS PAR VOS VRAIES CLÉS 👇
const firebaseConfig = {
    apiKey: "AIzaSyDqXN8tkXCnpXB_QdyHAUX6DzbsiT795FY",
    authDomain: "foodji-app.firebaseapp.com",
    projectId: "foodji-app",
    storageBucket: "foodji-app.firebasestorage.app",
    messagingSenderId: "760216056378",
    appId: "1:760216056378:web:594f079a9ccb031d033b03"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);