// ----------------------------------------------------
// Firebase Configuration - bergmoney
// ไปรษณีย์ไทย ระบบจัดซื้อจัดจ้าง บสค. 60
// ----------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQTEfa3NmXNzIEtNz_p8B99-46ngUVCuY",
    authDomain: "bergmoney.firebaseapp.com",
    projectId: "bergmoney",
    storageBucket: "bergmoney.firebasestorage.app",
    messagingSenderId: "723384352528",
    appId: "1:723384352528:web:f6eace874d9d845c586f95",
    measurementId: "G-NMB8HBSV8C"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
