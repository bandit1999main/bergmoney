// ----------------------------------------------------
// Firestore Service Layer - bergmoney
// Shared data model: all authenticated users access same data
// ----------------------------------------------------

import { db } from "./firebase-config.js";
import {
    doc, setDoc, getDoc, getDocs, addDoc, deleteDoc, updateDoc,
    collection, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// =====================================================
// Settings (single shared document)
// =====================================================

export async function saveSettings(settings) {
    await setDoc(doc(db, "appSettings", "main"), settings);
}

export async function loadSettings() {
    const snap = await getDoc(doc(db, "appSettings", "main"));
    return snap.exists() ? snap.data() : null;
}

// =====================================================
// Documents (BSK60 Purchase Requests)
// =====================================================

export async function addDocument(docData) {
    const ref = await addDoc(collection(db, "documents"), docData);
    return ref.id;
}

export async function getDocuments() {
    const q = query(collection(db, "documents"), orderBy("docDate", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fsDeleteDocument(docId) {
    await deleteDoc(doc(db, "documents", docId));
}

// =====================================================
// Inventory
// =====================================================

export async function addInventoryItem(item) {
    const ref = await addDoc(collection(db, "inventory"), item);
    return ref.id;
}

export async function getInventory() {
    const q = query(collection(db, "inventory"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fsDeleteInventoryItem(itemId) {
    await deleteDoc(doc(db, "inventory", itemId));
}

// =====================================================
// User Management
// =====================================================

export async function createOrUpdateUser(uid, userData) {
    await setDoc(doc(db, "users", uid), userData, { merge: true });
}

export async function getUser(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(uid, role) {
    await updateDoc(doc(db, "users", uid), { role });
}

export async function updateUserApproval(uid, approved) {
    await updateDoc(doc(db, "users", uid), { approved });
}

export async function removeUser(uid) {
    await deleteDoc(doc(db, "users", uid));
}

// =====================================================
// Utilities
// =====================================================

/**
 * ส่งออก serverTimestamp สำหรับใช้กำหนดเวลาสร้าง/ล็อกอิน
 */
export function getServerTimestamp() {
    return serverTimestamp();
}

/**
 * ย้ายข้อมูลจาก localStorage ไปยัง Firestore (ครั้งเดียว)
 */
export async function migrateLocalStorageToFirestore(localData) {
    if (localData.settings) {
        await saveSettings(localData.settings);
    }
    if (localData.documents && localData.documents.length > 0) {
        for (const item of localData.documents) {
            // ลบ id เดิมออก (Firestore จะสร้าง id ใหม่ให้อัตโนมัติ)
            const { id, ...data } = item;
            await addDocument(data);
        }
    }
    if (localData.inventory && localData.inventory.length > 0) {
        for (const item of localData.inventory) {
            const { id, ...data } = item;
            await addInventoryItem(data);
        }
    }
}

/**
 * ตรวจสอบว่า Firestore มีข้อมูลอยู่แล้วหรือไม่
 */
export async function checkIfDataExists() {
    const settings = await loadSettings();
    return settings !== null;
}
