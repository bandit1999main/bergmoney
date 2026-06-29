// ----------------------------------------------------
// Authentication Module - Google Sign-In Only
// bergmoney - ไปรษณีย์ไทย
// ----------------------------------------------------

import { auth } from "./firebase-config.js";
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const googleProvider = new GoogleAuthProvider();

/**
 * ลงชื่อเข้าใช้ด้วย Google (Popup)
 */
export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (error) {
        console.error("Google sign-in error:", error);
        throw error;
    }
}

/**
 * ออกจากระบบ
 */
export async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        throw error;
    }
}

/**
 * ติดตาม Auth State (ล็อกอิน/ล็อกเอาท์)
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบัน
 */
export function getCurrentUser() {
    return auth.currentUser;
}
