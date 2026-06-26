// ----------------------------------------------------
// ระบบจัดซื้อจัดจ้าง บสค. 60 - ไปรษณีย์ไทย
// v2.0 - Firebase Authentication & Firestore
// ----------------------------------------------------

import { loginWithGoogle, logout, onAuthChange } from "./auth.js";
import {
    saveSettings as fsSaveSettings,
    loadSettings as fsLoadSettings,
    addDocument as fsAddDocument,
    getDocuments as fsGetDocuments,
    fsDeleteDocument,
    addInventoryItem as fsAddInventoryItem,
    getInventory as fsGetInventory,
    fsDeleteInventoryItem,
    createOrUpdateUser,
    getUser,
    getAllUsers,
    updateUserRole,
    updateUserApproval,
    removeUser,
    getServerTimestamp,
    migrateLocalStorageToFirestore,
    checkIfDataExists
} from "./firestore-service.js";

// ----------------------------------------------------
// ค่าคงที่และกฎงบประมาณ
// ----------------------------------------------------
const BUDGET_RULES = {
    med: { name: "ซื้อยาเวชภัณฑ์และยาประจำตู้ยา", limitPerRequest: 1000, limitPerMonth: Infinity, code: "51020101", label: "ยาและเวชภัณฑ์" },
    stationery: { name: "วัสดุสิ้นเปลือง - เครื่องใช้สำนักงาน", limitPerRequest: Infinity, limitPerMonth: { group1: 3000, group2: 4000, group3: 5000 }, code: "51090902", label: "วัสดุสำนักงาน" },
    electricity: { name: "วัสดุอุปกรณ์ไฟฟ้า/ประปา/สาธารณูปโภค", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51090505", label: "วัสดุอุปกรณ์ไฟฟ้า/ประปา" },
    household: { name: "วัสดุสิ้นเปลือง - งานบ้านที่ใช้สิ้นเปลือง", limitPerRequest: Infinity, limitPerMonth: { group1: 3000, group2: 4000, group3: 5000 }, code: "51090501", label: "วัสดุงานบ้านงานครัว" },
    waste: { name: "กำจัดขยะ/สิ่งปฏิกูล/ลอกท่อระบายน้ำ", limitPerRequest: Infinity, limitPerMonth: 2000, code: "51099909", label: "กำจัดขยะและสิ่งปฏิกูล" },
    building: { name: "ซ่อมแซมบำรุงรักษาอาคารและสิ่งปลูกสร้าง", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070201", label: "ค่าบำรักษาสิ่งปลูกสร้าง" },
    machine: { name: "ซ่อมแซมบำรุงรักษาเครื่องจักรและอุปกรณ์", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070101", label: "ค่าซ่อมแซมบำรุงรักษาเครื่องจักร" },
    tool: { name: "ซ่อมแซมบำรุงรักษาเครื่องมือเครื่องใช้ทั่วไป", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070199", label: "ค่าซ่อมบำรุงเครื่องมือใช้สอย" },
    office_repair: { name: "ซ่อมแซมบำรุงรักษาเครื่องใช้สำนักงาน", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070104", label: "ซ่อมเครื่องใช้สำนักงาน" },
    car_repair: { name: "ซ่อมแซมบำรุงรักษายานพาหนะ", limitPerRequest: { car: 15000, bike: 3000, boat: 5000, twowheel: 1000 }, limitPerMonth: Infinity, code: "51070601", label: "ค่าซ่อมบำรุงยานพาหนะ" },
    public_utility: { name: "ติดตั้ง/ซ่อมแซมบำรุงรักษาอุปกรณ์สาธารณูปโภค", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070501", label: "ซ่อมแซมสาธารณูปโภค" }
};

let appState = {
    settings: {
        group: "group2",
        monthlyBudget: 30000,
        customLimits: {}
    },
    documents: [],
    inventory: []
};

let currentUser = null;
let currentUserProfile = null;

// ----------------------------------------------------
// จุดเริ่มต้น: ฟัง Auth State
// ----------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    setupAuthListener();
});

function setupAuthListener() {
    // ปุ่ม Google Sign-In
    document.getElementById("googleSignInBtn").addEventListener("click", handleGoogleSignIn);
    // ปุ่ม Logout (หน้ารอการอนุมัติ)
    document.getElementById("pendingLogoutBtn").addEventListener("click", handleLogout);

    // ฟัง Auth State เปลี่ยนแปลง
    onAuthChange(async (user) => {
        if (user) {
            await handleUserSignIn(user);
        } else {
            showAuthScreen();
        }
    });
}

async function handleGoogleSignIn() {
    const errorEl = document.getElementById("authError");
    const loadingEl = document.getElementById("authLoading");
    const btnEl = document.getElementById("googleSignInBtn");

    errorEl.style.display = "none";
    loadingEl.style.display = "block";
    btnEl.disabled = true;
    btnEl.style.opacity = "0.6";

    try {
        await loginWithGoogle();
        // onAuthStateChanged จะจัดการต่อ
    } catch (error) {
        loadingEl.style.display = "none";
        btnEl.disabled = false;
        btnEl.style.opacity = "1";

        if (error.code === "auth/popup-closed-by-user") {
            // ผู้ใช้ปิด popup เอง - ไม่ต้องแสดง error
            return;
        }
        errorEl.style.display = "block";
        errorEl.innerText = "เกิดข้อผิดพลาด: " + (error.message || "ไม่ทราบสาเหตุ");
    }
}

async function handleLogout() {
    try {
        await logout();
        currentUser = null;
        currentUserProfile = null;
        showAuthScreen();
    } catch (error) {
        console.error("Logout error:", error);
    }
}

async function handleUserSignIn(user) {
    try {
        let userProfile = await getUser(user.uid);

        if (!userProfile) {
            // ผู้ใช้ใหม่ - ตรวจสอบว่าเป็นคนแรกหรือไม่
            const allUsers = await getAllUsers();
            const isFirstUser = allUsers.length === 0;

            const newProfile = {
                displayName: user.displayName || "ไม่ระบุชื่อ",
                email: user.email || "",
                photoURL: user.photoURL || "",
                role: isFirstUser ? "admin" : "user",
                approved: isFirstUser ? true : false,
                createdAt: getServerTimestamp(),
                lastLoginAt: getServerTimestamp()
            };

            await createOrUpdateUser(user.uid, newProfile);
            userProfile = { id: user.uid, ...newProfile, role: newProfile.role, approved: newProfile.approved };
        } else {
            // อัปเดตเวลาเข้าใช้ล่าสุด
            await createOrUpdateUser(user.uid, {
                lastLoginAt: getServerTimestamp(),
                displayName: user.displayName || userProfile.displayName,
                photoURL: user.photoURL || userProfile.photoURL
            });
        }

        // ตรวจสอบการอนุมัติ
        if (!userProfile.approved) {
            showPendingScreen(user);
            return;
        }

        currentUser = user;
        currentUserProfile = userProfile;

        // ตรวจสอบข้อมูลเก่าใน localStorage สำหรับ Migration
        await checkAndMigrateLocalData();

        // ซ่อนหน้าจอ auth, แสดงแอปหลัก
        hideAuthScreen();
        hidePendingScreen();
        showMainApp();

        await initApp();
        setupEventHandlers();
        updateUserUI();
        switchTab("dashboard");

    } catch (error) {
        console.error("Error during sign-in flow:", error);
        alert("เกิดข้อผิดพลาดในการโหลดข้อมูล: " + error.message);
    }
}

// ตรวจสอบและย้ายข้อมูลจาก localStorage (ครั้งเดียว)
async function checkAndMigrateLocalData() {
    const migrated = localStorage.getItem("thp_bergmoney_migrated");
    if (migrated) return;

    const savedData = localStorage.getItem("thp_bergmoney_data");
    if (!savedData) {
        localStorage.setItem("thp_bergmoney_migrated", "true");
        return;
    }

    try {
        const parsed = JSON.parse(savedData);
        const hasFirestoreData = await checkIfDataExists();

        if (!hasFirestoreData && (parsed.documents?.length > 0 || parsed.inventory?.length > 0)) {
            const confirmMigrate = confirm(
                "พบข้อมูลเดิมในเครื่อง (localStorage)\n" +
                `- เอกสาร: ${parsed.documents?.length || 0} รายการ\n` +
                `- พัสดุ: ${parsed.inventory?.length || 0} รายการ\n\n` +
                "ต้องการย้ายข้อมูลไปยัง Cloud (Firebase) หรือไม่?"
            );

            if (confirmMigrate) {
                await migrateLocalStorageToFirestore(parsed);
                alert("ย้ายข้อมูลไปยัง Cloud เรียบร้อย!");
            }
        }

        localStorage.setItem("thp_bergmoney_migrated", "true");
    } catch (e) {
        console.error("Migration error:", e);
    }
}

// ----------------------------------------------------
// การแสดง/ซ่อนหน้าจอ
// ----------------------------------------------------
function showAuthScreen() {
    document.getElementById("authScreen").classList.remove("hidden");
    document.getElementById("pendingScreen").classList.add("hidden");
    document.getElementById("appWrapper").classList.remove("visible");

    // รีเซ็ตปุ่ม
    const btnEl = document.getElementById("googleSignInBtn");
    const loadingEl = document.getElementById("authLoading");
    btnEl.disabled = false;
    btnEl.style.opacity = "1";
    loadingEl.style.display = "none";
}

function hideAuthScreen() {
    document.getElementById("authScreen").classList.add("hidden");
}

function showPendingScreen(user) {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("pendingScreen").classList.remove("hidden");
    document.getElementById("appWrapper").classList.remove("visible");
    document.getElementById("pendingUserEmail").innerText = user.email || "";
}

function hidePendingScreen() {
    document.getElementById("pendingScreen").classList.add("hidden");
}

function showMainApp() {
    document.getElementById("appWrapper").classList.add("visible");
}

// อัปเดต UI ข้อมูลผู้ใช้ (sidebar, header, account settings)
function updateUserUI() {
    if (!currentUser || !currentUserProfile) return;

    const photoURL = currentUser.photoURL || "";
    const displayName = currentUser.displayName || "ไม่ระบุชื่อ";
    const email = currentUser.email || "";
    const role = currentUserProfile.role || "user";
    const roleTh = role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน";

    // Header
    document.getElementById("headerUserAvatar").src = photoURL;
    document.getElementById("headerUserName").innerText = displayName;

    // Sidebar
    document.getElementById("sidebarAvatar").src = photoURL;
    document.getElementById("sidebarUserName").innerText = displayName;
    document.getElementById("sidebarUserRole").innerText = roleTh;

    // Account Settings
    document.getElementById("accountAvatar").src = photoURL;
    document.getElementById("accountName").innerText = displayName;
    document.getElementById("accountEmail").innerText = email;

    const roleEl = document.getElementById("accountRole");
    roleEl.innerText = roleTh;
    roleEl.className = `role-badge ${role}`;

    // แสดง/ซ่อนเมนูจัดการผู้ใช้ (Admin เท่านั้น)
    const userMgmtMenu = document.getElementById("menuUserMgmt");
    if (role === "admin") {
        userMgmtMenu.style.display = "flex";
    } else {
        userMgmtMenu.style.display = "none";
    }
}

// ----------------------------------------------------
// โหลดข้อมูลเริ่มต้น (จาก Firestore)
// ----------------------------------------------------
async function initApp() {
    // โหลด Settings จาก Firestore
    const settings = await fsLoadSettings();
    if (settings) {
        appState.settings = settings;
        if (!appState.settings.customLimits) {
            appState.settings.customLimits = {};
        }
    }

    // โหลด Documents จาก Firestore
    appState.documents = await fsGetDocuments();

    // โหลด Inventory จาก Firestore
    appState.inventory = await fsGetInventory();

    // กำหนดวันที่เริ่มต้น
    const docDateInput = document.getElementById("docDate");
    if (docDateInput) docDateInput.value = new Date().toISOString().substring(0, 10);

    const invDateInput = document.getElementById("invDate");
    if (invDateInput) invDateInput.value = new Date().toISOString().substring(0, 10);

    renderMonthSelectOptions();

    // ตั้งค่าฟอร์มการตั้งค่าตั้งต้น
    const setGroupInput = document.getElementById("setGroupName");
    if (setGroupInput) setGroupInput.value = appState.settings.group;

    const setMonthlyBudgetInput = document.getElementById("setMonthlyBudget");
    if (setMonthlyBudgetInput) setMonthlyBudgetInput.value = appState.settings.monthlyBudget;

    renderLimitsSettingsTable();
    updateUIElements();

    // เชื่อมฟังก์ชัน Auto-suggest ช่องแรกเริ่มต้น
    bindAutoSuggest(document.querySelector("#formTableBody tr"));
}

// ----------------------------------------------------
// ระบบผูก Event และ Action
// ----------------------------------------------------
let eventHandlersSet = false;

function setupEventHandlers() {
    if (eventHandlersSet) return;
    eventHandlersSet = true;

    // การสลับแท็บ Sidebar
    document.querySelectorAll("aside .menu-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const tabId = e.currentTarget.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    // ปุ่มโหมดหน้าต่าง
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
        const body = document.body;
        body.classList.toggle("dark-theme");
        const isDark = body.classList.contains("dark-theme");
        document.getElementById("themeToggleBtn").querySelector("span").innerText = isDark ? "light_mode" : "dark_mode";
    });

    // เหตุการณ์แบบฟอร์มคำขออนุมัติ
    const bskForm = document.getElementById("bskForm");
    bskForm.addEventListener("submit", handleBskSubmit);

    document.getElementById("addItemBtn").addEventListener("click", addFormItemRow);
    document.getElementById("itemCategory").addEventListener("change", checkQuotaLimits);
    document.getElementById("formTableBody").addEventListener("input", handleTableInput);

    // Dialog จัดการคลังพัสดุ
    document.getElementById("addInventoryBtn").addEventListener("click", () => openModal("inventoryModal"));
    document.getElementById("inventoryForm").addEventListener("submit", handleInventorySubmit);

    // บันทึกการตั้งค่า
    document.getElementById("settingsForm").addEventListener("submit", handleSettingsSubmit);

    // การจัดการ Backup/Restore ข้อมูล
    document.getElementById("exportBtn").addEventListener("click", exportBackupData);
    document.getElementById("importBtn").addEventListener("click", () => {
        document.getElementById("importFileInput").click();
    });
    document.getElementById("importFileInput").addEventListener("change", importBackupData);

    document.getElementById("reportMonthSelect").addEventListener("change", renderMonthlyReportTable);
    document.getElementById("printReportBtn").addEventListener("click", printMonthlyReport);

    // ปุ่ม Logout (หน้า Account Settings)
    document.getElementById("logoutBtn").addEventListener("click", handleLogout);
}

function switchTab(tabId) {
    document.querySelectorAll("aside .menu-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".content .tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === tabId);
    });

    const titles = {
        "dashboard": "แดชบอร์ดสรุปงบประมาณและโควตาวงเงิน",
        "bsk60-form": "บันทึกข้อความขออนุมัติจัดซื้อจัดจ้าง บสค. 60",
        "history": "ประวัติคำขอจัดซื้อจัดจ้าง บสค. 60",
        "inventory": "บัญชีควบคุมพัสดุคลังพัสดุ (แบบที่ 2)",
        "monthly-report": "สรุปรายการซื้อและการจ้างประจำเดือน (แบบที่ 3)",
        "settings": "ตั้งค่าข้อมูลที่ทำการไปรษณีย์และรหัสหน่วยงาน",
        "user-management": "จัดการผู้ใช้งานระบบ",
        "account-settings": "บัญชีผู้ใช้งาน"
    };
    document.getElementById("pageTitleText").innerText = titles[tabId] || "ระบบเบิกเงิน";

    if (tabId === "dashboard") {
        updateUIElements();
    } else if (tabId === "history") {
        renderHistoryTable();
    } else if (tabId === "inventory") {
        renderInventoryTable();
    } else if (tabId === "monthly-report") {
        renderMonthlyReportTable();
    } else if (tabId === "user-management") {
        renderUserManagementTable();
    } else if (tabId === "account-settings") {
        updateUserUI();
    }
}

// ----------------------------------------------------
// ฟังก์ชัน Auto-suggest ค้นหาคลังพัสดุ/บิลเก่า
// ----------------------------------------------------
function bindAutoSuggest(row) {
    const nameInput = row.querySelector(".item-name");
    const suggestBox = row.querySelector(".suggest-box");

    nameInput.addEventListener("focus", () => showSuggestions(nameInput, suggestBox));
    nameInput.addEventListener("input", () => showSuggestions(nameInput, suggestBox));

    document.addEventListener("click", (e) => {
        if (!row.contains(e.target)) {
            suggestBox.style.display = "none";
        }
    });
}

function showSuggestions(input, boxElement) {
    const val = input.value.trim().toLowerCase();
    boxElement.innerHTML = "";

    const itemsHistory = [];
    const seen = new Set();

    appState.documents.forEach(doc => {
        doc.items.forEach(item => {
            const name = item.name.trim();
            if (!seen.has(name)) {
                seen.add(name);
                itemsHistory.push({
                    name: name,
                    lastDate: doc.docDate,
                    lastQty: item.qty,
                    lastPrice: item.price
                });
            }
        });
    });

    appState.inventory.forEach(inv => {
        const name = inv.name.trim();
        if (!seen.has(name) && inv.action === "receive") {
            seen.add(name);
            itemsHistory.push({
                name: name,
                lastDate: inv.date,
                lastQty: inv.qty,
                lastPrice: 0
            });
        }
    });

    const filtered = itemsHistory.filter(i => i.name.toLowerCase().includes(val));

    if (filtered.length === 0) {
        boxElement.style.display = "none";
        return;
    }

    filtered.forEach(item => {
        const div = document.createElement("div");
        div.className = "suggest-item";
        const dateFormatted = new Date(item.lastDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        div.innerHTML = `
            <strong>${item.name}</strong>
            <span class="suggest-item-desc">ครั้งล่าสุด: ${dateFormatted} | จำนวน: ${item.lastQty} | ${item.lastPrice ? `${item.lastPrice}฿` : 'ไม่มีประวัติราคา'}</span>
        `;

        div.addEventListener("click", () => {
            input.value = item.name;
            const row = input.closest("tr");
            row.querySelector(".item-last-date").value = item.lastDate;
            row.querySelector(".item-last-qty").value = item.lastQty;
            row.querySelector(".item-last-price").value = item.lastPrice || 0;

            boxElement.style.display = "none";
            calculateFormTotal();
        });

        boxElement.appendChild(div);
    });

    boxElement.style.display = "block";
}

// ----------------------------------------------------
// การคำนวณและตรวจสอบวงเงิน
// ----------------------------------------------------
function handleTableInput(e) {
    if (e.target.classList.contains("item-price") || e.target.classList.contains("item-qty")) {
        calculateFormTotal();
    }
}

function calculateFormTotal() {
    const rows = document.querySelectorAll("#formTableBody tr");
    let total = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        total += qty * price;
    });

    document.getElementById("formTotalDisplay").innerText = `${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
    document.getElementById("thaiBahtText").innerText = `(${arabicToThaiBaht(total)})`;

    checkQuotaLimits();
}

function checkQuotaLimits() {
    const category = document.getElementById("itemCategory").value;
    if (!category) return;

    const rows = document.querySelectorAll("#formTableBody tr");
    let total = 0;
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        total += qty * price;
    });

    const group = appState.settings.group;
    let isOverLimit = false;
    let message = "";

    const limitReq = getLimitPerRequest(category);
    if (limitReq !== undefined && limitReq !== Infinity) {
        if (typeof limitReq === "object") {
            message = `กรุณาตรวจสอบว่ายอดจัดซื้อยานพาหนะรายคันไม่เกินวงเงินสูงสุดครั้งละ (รถยนต์ 15,000฿ / จยย. 3,000฿)`;
        } else if (total > limitReq) {
            isOverLimit = true;
            message = `การจัดซื้อรายการนี้เกินขีดจำกัดอนุมัติครั้งละ ${limitReq.toLocaleString()} บาทตามค่ากำหนดวงเงิน`;
        }
    }

    const limitMonth = getLimitPerMonth(category, group);
    if (limitMonth !== undefined && limitMonth !== Infinity && !isOverLimit) {
        const currentMonthStr = document.getElementById("docDate").value.substring(0, 7);
        const spentThisMonth = appState.documents
            .filter(doc => doc.docDate.startsWith(currentMonthStr) && doc.itemCategory === category)
            .reduce((sum, doc) => sum + doc.total, 0);

        if (spentThisMonth + total > limitMonth) {
            isOverLimit = true;
            message = `งบรวมสะสมเดือนนี้เท่ากับ ${(spentThisMonth + total).toLocaleString()} บาท ซึ่งเกินวงเงินจำกัดต่อเดือนที่ ${limitMonth.toLocaleString()} บาท`;
        }
    }

    const warningBanner = document.getElementById("quotaWarning");
    const saveDocBtn = document.getElementById("saveDocBtn");

    if (isOverLimit) {
        warningBanner.style.display = "flex";
        document.getElementById("warningMessage").innerText = message;
        saveDocBtn.disabled = true;
        saveDocBtn.style.opacity = "0.5";
        saveDocBtn.style.cursor = "not-allowed";
        saveDocBtn.innerText = "ไม่สามารถบันทึกได้ (เกินวงเงินอนุมัติ)";
    } else {
        warningBanner.style.display = "none";
        saveDocBtn.disabled = false;
        saveDocBtn.style.opacity = "1";
        saveDocBtn.style.cursor = "pointer";
        saveDocBtn.innerHTML = `<span class="material-symbols-outlined">save</span> บันทึกคำขอ บสค.60`;
    }
}

function addFormItemRow() {
    const tbody = document.getElementById("formTableBody");
    const rowCount = tbody.querySelectorAll("tr").length + 1;
    const newRow = `
        <tr>
            <td style="text-align: center;">${rowCount}</td>
            <td class="suggest-wrapper">
                <input type="text" class="item-name" placeholder="ระบุรายละเอียดสิ่งของ (พิมพ์เพื่อค้นหาประวัติ)" required style="width: 100%;">
                <div class="suggest-box"></div>
            </td>
            <td><input type="date" class="item-last-date" style="width: 100%;"></td>
            <td><input type="number" class="item-last-qty" placeholder="จำนวน" style="width: 100%; text-align: center;"></td>
            <td><input type="number" class="item-last-price" placeholder="0.00" min="0" step="0.01" style="width: 100%; text-align: right;"></td>
            <td><input type="number" class="item-qty" value="1" min="1" required style="width: 100%; text-align: center;"></td>
            <td><input type="number" class="item-price" placeholder="0.00" min="0" step="0.01" required style="width: 100%; text-align: right;"></td>
            <td>
                <button type="button" class="btn-icon-only remove-row-btn" style="margin: auto;">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </td>
        </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", newRow);

    const rows = tbody.querySelectorAll("tr");
    const latestRow = rows[rows.length - 1];

    latestRow.querySelector(".remove-row-btn").addEventListener("click", (e) => {
        e.currentTarget.closest("tr").remove();
        reindexFormTable();
        calculateFormTotal();
    });

    bindAutoSuggest(latestRow);
    calculateFormTotal();
}

function reindexFormTable() {
    const rows = document.querySelectorAll("#formTableBody tr");
    rows.forEach((row, i) => {
        row.querySelector("td:first-child").innerText = i + 1;
    });
}

// ----------------------------------------------------
// ระบบบันทึก บสค. 60 (Firestore)
// ----------------------------------------------------
async function handleBskSubmit(e) {
    e.preventDefault();

    const category = document.getElementById("itemCategory").value;
    const docDate = document.getElementById("docDate").value;
    const officeName = document.getElementById("officeName").value;
    const officePhone = document.getElementById("officePhone").value;
    const docNumber = document.getElementById("docNumber").value;
    const hasQuotation = document.querySelector('input[name="hasQuotation"]:checked').value;

    const items = [];
    let total = 0;
    const rows = document.querySelectorAll("#formTableBody tr");
    rows.forEach(row => {
        const name = row.querySelector(".item-name").value;
        const lastDate = row.querySelector(".item-last-date").value;
        const lastQty = row.querySelector(".item-last-qty").value;
        const lastPrice = row.querySelector(".item-last-price").value;
        const qty = parseFloat(row.querySelector(".item-qty").value) || 1;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;

        items.push({ name, lastDate, lastQty, lastPrice, qty, price });
        total += qty * price;
    });

    const requesterName = document.getElementById("requesterName").value;
    const requesterPosition = document.getElementById("requesterPosition").value;

    const newDoc = {
        docNumber,
        docDate,
        officeName,
        officePhone,
        itemCategory: category,
        hasQuotation,
        items,
        total,
        requesterName,
        requesterPosition,
        createdBy: currentUser ? currentUser.email : "",
        createdAt: getServerTimestamp()
    };

    try {
        // บันทึกลง Firestore
        const firestoreId = await fsAddDocument(newDoc);
        newDoc.id = firestoreId;

        // อัปเดต state ในเครื่อง
        appState.documents.unshift(newDoc);

        alert("บันทึกข้อมูลคำขอจัดซื้อจัดจ้าง บสค. 60 เรียบร้อย!");

        // รีเซ็ตฟอร์ม
        document.getElementById("bskForm").reset();
        document.getElementById("formTableBody").innerHTML = `
            <tr>
                <td style="text-align: center;">1</td>
                <td class="suggest-wrapper">
                    <input type="text" class="item-name" placeholder="ระบุรายละเอียดสิ่งของ (พิมพ์เพื่อค้นหาประวัติ)" required style="width: 100%;">
                    <div class="suggest-box"></div>
                </td>
                <td><input type="date" class="item-last-date" style="width: 100%;"></td>
                <td><input type="number" class="item-last-qty" placeholder="จำนวน" style="width: 100%; text-align: center;"></td>
                <td><input type="number" class="item-last-price" placeholder="0.00" min="0" step="0.01" style="width: 100%; text-align: right;"></td>
                <td><input type="number" class="item-qty" value="1" min="1" required style="width: 100%; text-align: center;"></td>
                <td><input type="number" class="item-price" placeholder="0.00" min="0" step="0.01" required style="width: 100%; text-align: right;"></td>
                <td>
                    <button type="button" class="btn-icon-only remove-row-btn" style="margin: auto;">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </td>
            </tr>
        `;
        bindAutoSuggest(document.querySelector("#formTableBody tr"));
        calculateFormTotal();
        switchTab("history");
    } catch (error) {
        console.error("Error saving document:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    }
}

// ----------------------------------------------------
// คลังพัสดุ (Firestore)
// ----------------------------------------------------
function renderInventoryTable() {
    const tbody = document.getElementById("inventoryTableBody");
    tbody.innerHTML = "";

    if (appState.inventory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-secondary);">ไม่มีข้อมูลในคลังสินค้า</td></tr>`;
        return;
    }

    appState.inventory.forEach(inv => {
        const dateFormatted = new Date(inv.date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        const isReceive = inv.action === "receive";

        const row = `
            <tr>
                <td>${dateFormatted}</td>
                <td style="font-weight:600;">${inv.name}</td>
                <td>${inv.ref}</td>
                <td style="color:var(--success); font-weight:600;">${isReceive ? `+ ${inv.qty}` : '-'}</td>
                <td style="color:#EF4444; font-weight:600;">${!isReceive ? `- ${inv.qty}` : '-'}</td>
                <td style="font-weight:600;">${inv.balance}</td>
                <td>${inv.receiver || "-"}</td>
                <td>${inv.inspectors || "-"}</td>
                <td>${inv.auditor || "-"}</td>
                <td>
                    <button class="btn-icon-only" style="width:28px; height:28px; margin:auto;" onclick="window._deleteInventoryItem('${inv.id}')">
                        <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

async function handleInventorySubmit(e) {
    e.preventDefault();

    const date = document.getElementById("invDate").value;
    const name = document.getElementById("invName").value;
    const ref = document.getElementById("invRef").value;
    const action = document.getElementById("invAction").value;
    const qty = parseInt(document.getElementById("invQty").value) || 1;
    const receiver = document.getElementById("invReceiver").value;
    const inspectors = document.getElementById("invInspectors").value;
    const auditor = document.getElementById("invAuditor").value;

    const matchedItems = appState.inventory.filter(item => item.name === name);
    let lastBalance = 0;
    if (matchedItems.length > 0) {
        lastBalance = matchedItems[matchedItems.length - 1].balance;
    }

    let newBalance = lastBalance;
    if (action === "receive") {
        newBalance += qty;
    } else {
        if (qty > lastBalance) {
            alert(`สินค้าไม่เพียงพอเบิกจ่าย (คงคลังปัจจุบัน: ${lastBalance} หน่วย)`);
            return;
        }
        newBalance -= qty;
    }

    const newInvItem = {
        date,
        name,
        ref,
        action,
        qty,
        balance: newBalance,
        receiver,
        inspectors,
        auditor,
        createdBy: currentUser ? currentUser.email : "",
        createdAt: getServerTimestamp()
    };

    try {
        const firestoreId = await fsAddInventoryItem(newInvItem);
        newInvItem.id = firestoreId;
        appState.inventory.push(newInvItem);

        closeModal("inventoryModal");
        document.getElementById("inventoryForm").reset();
        renderInventoryTable();
    } catch (error) {
        console.error("Error saving inventory:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    }
}

async function deleteInventoryItem(itemId) {
    if (confirm("ต้องการลบพัสดุคลังรายการนี้?")) {
        try {
            await fsDeleteInventoryItem(itemId);
            appState.inventory = appState.inventory.filter(item => item.id !== itemId);
            renderInventoryTable();
        } catch (error) {
            console.error("Error deleting inventory:", error);
            alert("เกิดข้อผิดพลาดในการลบ: " + error.message);
        }
    }
}

// ----------------------------------------------------
// ประวัติเอกสาร (Firestore)
// ----------------------------------------------------
function renderHistoryTable() {
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = "";

    if (appState.documents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">ไม่มีประวัติเอกสารจัดทำอนุมัติ</td></tr>`;
        return;
    }

    appState.documents.forEach(doc => {
        const cat = BUDGET_RULES[doc.itemCategory];
        const dateFormatted = new Date(doc.docDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        const quotationBadge = doc.hasQuotation === "true"
            ? `<span style="background-color:rgba(16,185,129,0.15); color:#10B981; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">มี</span>`
            : `<span style="background-color:rgba(239,68,68,0.15); color:#EF4444; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">ไม่มี</span>`;

        const row = `
            <tr>
                <td style="font-weight:600;">บสค. 60 เลขที่ ${doc.docNumber}</td>
                <td>${dateFormatted}</td>
                <td>${cat ? cat.name : "ทั่วไป"}</td>
                <td>${quotationBadge}</td>
                <td style="font-weight:700; color:var(--thp-red);">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td>${doc.requesterName}</td>
                <td>
                    <div style="display:flex; gap:0.5rem; justify-content:center;">
                        <button class="btn btn-secondary" style="padding: 4px 10px; font-size:0.8rem;" onclick="window._printDocument('${doc.id}')">
                            <span class="material-symbols-outlined" style="font-size:16px;">print</span> พิมพ์
                        </button>
                        <button class="btn btn-danger" style="padding: 4px 10px; font-size:0.8rem;" onclick="window._deleteDocument('${doc.id}')">
                            <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ลบ
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

async function deleteDocument(docId) {
    if (confirm("ลบประวัติใบขออนุมัตินี้ออกจากฐานข้อมูล?")) {
        try {
            await fsDeleteDocument(docId);
            appState.documents = appState.documents.filter(doc => doc.id !== docId);
            renderHistoryTable();
        } catch (error) {
            console.error("Error deleting document:", error);
            alert("เกิดข้อผิดพลาดในการลบ: " + error.message);
        }
    }
}

// ----------------------------------------------------
// รายงานประจำเดือน
// ----------------------------------------------------
function renderMonthSelectOptions() {
    const select = document.getElementById("reportMonthSelect");
    select.innerHTML = "";

    const months = {};
    appState.documents.forEach(doc => {
        const monthYear = doc.docDate.substring(0, 7);
        months[monthYear] = true;
    });

    const currentMonth = new Date().toISOString().substring(0, 7);
    months[currentMonth] = true;

    Object.keys(months).sort().reverse().forEach(my => {
        const dateObj = new Date(my + "-01");
        const thaiMonthText = dateObj.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
        select.insertAdjacentHTML("beforeend", `<option value="${my}">${thaiMonthText}</option>`);
    });
}

function renderMonthlyReportTable() {
    const selectedMonth = document.getElementById("reportMonthSelect").value;
    const tbody = document.getElementById("monthlyReportTableBody");
    tbody.innerHTML = "";

    const monthlyDocs = appState.documents.filter(doc => doc.docDate.startsWith(selectedMonth));
    let grandTotal = 0;

    if (monthlyDocs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-secondary);">ไม่มีรายการซื้อขายในเดือนนี้</td></tr>`;
        document.getElementById("monthlyReportTotal").innerText = "0.00 ฿";
        return;
    }

    let itemIndex = 1;
    monthlyDocs.forEach(doc => {
        const cat = BUDGET_RULES[doc.itemCategory];

        doc.items.forEach(item => {
            const itemTotal = item.qty * item.price;
            grandTotal += itemTotal;
            const dateFormatted = new Date(doc.docDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

            const row = `
                <tr>
                    <td>${itemIndex++}</td>
                    <td style="font-weight:600;">${item.name} <span style="font-size:0.75rem; color:var(--text-secondary); display:block;">(จำนวน ${item.qty} ชิ้น)</span></td>
                    <td>-</td>
                    <td>${cat ? cat.code : "-"}</td>
                    <td>บสค. 60 เลขที่ ${doc.docNumber}</td>
                    <td>ตามคำสั่งที่ 4/2566</td>
                    <td>${dateFormatted}</td>
                    <td>เพื่อใช้ในกิจการหน่วยงาน</td>
                    <td style="text-align:right; font-weight:600;">${itemTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", row);
        });
    });

    document.getElementById("monthlyReportTotal").innerText = `${grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
}

// ----------------------------------------------------
// ระบบจัดพิมพ์
// ----------------------------------------------------
function printDocument(docId) {
    const doc = appState.documents.find(d => d.id === docId);
    if (!doc) return;

    const cat = BUDGET_RULES[doc.itemCategory];
    const printSection = document.getElementById("printSection");

    let itemsRowsHtml = "";
    doc.items.forEach((item, index) => {
        const lastDateFormatted = item.lastDate ? new Date(item.lastDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "-";
        const lastQtyText = item.lastQty ? `${item.lastQty}` : "-";
        const lastPriceText = item.lastPrice ? parseFloat(item.lastPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";

        itemsRowsHtml += `
            <tr>
                <td>${index + 1}</td>
                <td class="text-left">${item.name}</td>
                <td>${lastDateFormatted}</td>
                <td>${lastQtyText}</td>
                <td style="text-align: right;">${lastPriceText}</td>
                <td>${item.qty}</td>
                <td style="text-align: right;">${(item.qty * item.price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                <td>${item.remark || ""}</td>
            </tr>
        `;
    });
    const docDateObj = new Date(doc.docDate);
    const dateFormatted = docDateObj.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    const catKeys = Object.keys(BUDGET_RULES);
    let categoryCheckboxesHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin: 8px 0; font-size: 12pt; border: 1px solid #000000; padding: 8px 12px; border-radius: 4px; line-height: 1.3;">`;
    catKeys.forEach(k => {
        const isChecked = doc.itemCategory === k;
        const symbol = isChecked ? "[ ✓ ]" : "[ &nbsp; ]";
        const style = isChecked ? "font-weight: bold; color: #000000;" : "color: #000000;";
        categoryCheckboxesHtml += `<div style="${style}">${symbol} ${BUDGET_RULES[k].name}</div>`;
    });
    categoryCheckboxesHtml += `</div>`;

    printSection.innerHTML = `
        <div class="print-header" style="position: relative; display: flex; align-items: center; justify-content: center; height: 50px;">
            <img src="thailand-post-logo.png" alt="ไปรษณีย์ไทย" class="print-logo" style="height: 38px; object-fit: contain; position: absolute; left: 0; bottom: 6px;">
            <div style="font-weight: bold; font-size: 12pt; margin-bottom: 6px;">บันทึกข้อความ</div>
        </div>
        <table class="memo-table" style="font-size: 12pt;">
            <tr>
                <td style="width: 15%; font-weight: bold;">หน่วยงาน:</td>
                <td colspan="3">${doc.officeName} &nbsp;&nbsp; โทร. ${doc.officePhone}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; width: 15%;">ที่:</td>
                <td style="width: 45%;">${doc.docNumber || "-"}</td>
                <td style="width: 10%; font-weight: bold;">วันที่:</td>
                <td style="width: 30%;">${dateFormatted}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 6px;">เรื่อง:</td>
                <td colspan="3" style="border-bottom: 1px solid #000000; padding-bottom: 6px;">ขอความเห็นชอบการจัดซื้อ/จัดจ้าง (ที่มอบอำนาจการซื้อและการจ้างตามคำสั่ง ปณท ที่ 4/2566)</td>
            </tr>
            <tr>
                <td style="font-weight: bold; padding-top: 6px;">เรียน:</td>
                <td colspan="3" style="padding-top: 6px;">ฝปข.2</td>
            </tr>
        </table>

        <p style="text-indent: 1.5cm; margin-bottom: 6px; font-size: 12pt; line-height: 1.3;">
            ด้วย <b>ปณ.มาบตาพุด</b> มีความจำเป็นต้องการจัดซื้อและจัดจ้างพัสดุบางประเภท (ที่มอบอำนาจการซื้อและการจ้างตามคำสั่ง ปณท ที่ 4/2566) ดังนี้:
        </p>

        ${categoryCheckboxesHtml}

        <div style="display: flex; gap: 30px; margin: 8px 0; font-weight: bold; font-size: 12pt;">
            <span>[ ${doc.hasQuotation === 'true' ? '✓' : '&nbsp;'} ] มีใบเสนอราคา</span>
            <span>[ ${doc.hasQuotation === 'false' ? '✓' : '&nbsp;'} ] ไม่มีใบเสนอราคา</span>
        </div>

        <table class="item-table" style="font-size: 12pt; border-collapse: collapse; width: 100%;">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 5%; vertical-align: middle;">ลำดับ</th>
                    <th rowspan="2" style="vertical-align: middle;">รายการที่จัดซื้อ/จัดจ้าง</th>
                    <th colspan="3" style="text-align: center;">ซื้อ/จ้าง ครั้งล่าสุด</th>
                    <th colspan="2" style="text-align: center;">ซื้อ/จ้าง ครั้งนี้</th>
                    <th rowspan="2" style="width: 12%; vertical-align: middle;">หมายเหตุ</th>
                </tr>
                <tr>
                    <th style="font-size: 12pt; width: 12%;">ว.ด.ป.</th>
                    <th style="font-size: 12pt; width: 8%;">จำนวน/ปริมาณ</th>
                    <th style="font-size: 12pt; width: 12%;">จำนวนเงิน (บาท)</th>
                    <th style="font-size: 12pt; width: 8%;">จำนวน/ปริมาณ</th>
                    <th style="font-size: 12pt; width: 12%;">จำนวนเงิน (บาท)</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
                <tr>
                    <td colspan="6" style="text-align: right; font-weight: bold; padding: 4px 6px;">รวมเป็นเงินทั้งสิ้น</td>
                    <td style="text-align: right; font-weight: bold; padding: 4px 6px;">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>

        <p style="text-indent: 1.5cm; margin-bottom: 12px; font-size: 12pt; line-height: 1.3;">
            จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต หากเห็นชอบจักได้ดำเนินการตามที่ ปณท มอบอำนาจการซื้อและการจ้างไว้ให้ต่อไป จักขอบคุณยิ่ง
        </p>

        <div class="sig-section" style="margin-top: 15px; display: flex; justify-content: flex-end;">
            <div class="sig-block" style="width: 45%; text-align: center; font-size: 12pt; line-height: 1.3;">
                <p style="margin-bottom: 30px;">(ลงชื่อ)..............................................................</p>
                <p style="font-weight: bold;">(${doc.requesterName})</p>
                <p>${doc.requesterPosition}</p>
                <p style="margin-top: 5px;">............../............../..............</p>
            </div>
        </div>
    `;

    window.print();
}

function printMonthlyReport() {
    const selectedMonth = document.getElementById("reportMonthSelect").value;
    const monthlyDocs = appState.documents.filter(doc => doc.docDate.startsWith(selectedMonth));
    if (monthlyDocs.length === 0) {
        alert("ไม่มีข้อมูลที่จะพิมพ์ในเดือนที่เลือก");
        return;
    }

    const dateObj = new Date(selectedMonth + "-01");
    const thaiMonthText = dateObj.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const printSection = document.getElementById("printSection");

    let reportRowsHtml = "";
    let grandTotal = 0;
    let itemIndex = 1;

    monthlyDocs.forEach(doc => {
        const cat = BUDGET_RULES[doc.itemCategory];
        doc.items.forEach(item => {
            const itemTotal = item.qty * item.price;
            grandTotal += itemTotal;
            const dateFormatted = new Date(doc.docDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });

            reportRowsHtml += `
                <tr>
                    <td>${itemIndex++}</td>
                    <td class="text-left">${item.name}</td>
                    <td>-</td>
                    <td>${cat ? cat.code : "-"}</td>
                    <td>บสค. 60 เลขที่ ${doc.docNumber}</td>
                    <td>ตามคำสั่งที่ 4/2566</td>
                    <td>${dateFormatted}</td>
                    <td>เพื่อใช้ในงานปฏิบัติงาน</td>
                    <td style="text-align: right;">${itemTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        });
    });

    printSection.innerHTML = `
        <div class="print-header">
            <img src="thailand-post-logo.png" alt="ไปรษณีย์ไทย" class="print-logo" style="height: 38px; object-fit: contain;">
            <div style="font-weight: bold; font-size: 18pt;">แบบที่ 3</div>
        </div>
        <h2 style="text-align: center; margin-bottom: 8px; font-size: 18pt;">บัญชีสรุปรายการซื้อและการจ้างประจำเดือน</h2>
        <div style="text-align: center; margin-bottom: 15px; font-size: 15pt;">
            ที่ทำการ: <b>ที่ทำการไปรษณีย์มาบตาพุด</b> &nbsp;&nbsp;&nbsp; ประจำเดือน <b>${thaiMonthText}</b>
        </div>

        <table class="item-table" style="font-size: 13pt;">
            <thead>
                <tr>
                    <th style="padding: 4px;">ลำดับ</th>
                    <th style="padding: 4px;">รายการ</th>
                    <th style="padding: 4px;">รหัสครุภัณฑ์</th>
                    <th style="padding: 4px;">รหัสบัญชี</th>
                    <th style="padding: 4px;">เลขที่ บสค.60</th>
                    <th style="padding: 4px;">คำสั่งอนุมัติ</th>
                    <th style="padding: 4px;">ว.ด.ป.</th>
                    <th style="padding: 4px;">เหตุผลความจำเป็น</th>
                    <th style="padding: 4px;">จำนวนเงิน (บาท)</th>
                </tr>
            </thead>
            <tbody>
                ${reportRowsHtml}
                <tr>
                    <td colspan="8" style="text-align: right; font-weight: bold; padding: 6px;">รวมเงินทั้งสิ้น</td>
                    <td style="text-align: right; font-weight: bold; padding: 6px;">${grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        <div class="sig-section" style="margin-top: 25px;">
            <div class="sig-block" style="width: 45%; text-align: center; font-size: 15pt; line-height: 1.35;">
                <p style="margin-bottom: 35px;">ลงชื่อ..............................................................</p>
                <p style="font-weight: bold;">(นายนิพล ทรัพย์หมื่นแสน)</p>
                <p>หัวหน้าที่ทำการไปรษณีย์มาบตาพุด</p>
            </div>
        </div>
    `;

    window.print();
}

// ----------------------------------------------------
// UI Auxiliaries
// ----------------------------------------------------
window.openModal = function(modalId) {
    document.getElementById(modalId).classList.add("active");
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove("active");
};

// Expose to global scope สำหรับ inline onclick ใน dynamic HTML
window._printDocument = printDocument;
window._deleteDocument = deleteDocument;
window._deleteInventoryItem = deleteInventoryItem;

// Alias เดิมสำหรับ static HTML (onclick="closeModal(...)") 
// openModal/closeModal ถูกกำหนดด้านบนแล้ว

async function handleSettingsSubmit(e) {
    e.preventDefault();
    appState.settings.group = document.getElementById("setGroupName").value;
    appState.settings.monthlyBudget = parseFloat(document.getElementById("setMonthlyBudget").value) || 0;

    // บันทึกเพดานวงเงินรายหมวดหมู่
    const customLimits = {};
    document.querySelectorAll("#limitsSettingsTableBody .limit-req-input").forEach(input => {
        const cat = input.getAttribute("data-category");
        const val = input.value.trim();
        if (val !== "") {
            if (!customLimits[cat]) customLimits[cat] = {};
            customLimits[cat].limitPerRequest = parseFloat(val);
        }
    });

    document.querySelectorAll("#limitsSettingsTableBody .limit-month-input").forEach(input => {
        const cat = input.getAttribute("data-category");
        const val = input.value.trim();
        if (val !== "") {
            if (!customLimits[cat]) customLimits[cat] = {};
            customLimits[cat].limitPerMonth = parseFloat(val);
        }
    });

    appState.settings.customLimits = customLimits;

    try {
        await fsSaveSettings(appState.settings);
        alert("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!");
    } catch (error) {
        console.error("Error saving settings:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    }

    renderLimitsSettingsTable();
    updateUIElements();
    switchTab("dashboard");
}

function updateUIElements() {
    const currentMonthStr = new Date().toISOString().substring(0, 7);
    const currentMonthDocs = appState.documents.filter(doc => doc.docDate.startsWith(currentMonthStr));
    const totalSpentThisMonth = currentMonthDocs.reduce((sum, doc) => sum + doc.total, 0);

    document.getElementById("statCount").innerText = `${currentMonthDocs.length} รายการ`;
    document.getElementById("statTotal").innerText = `${totalSpentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;

    const remainingOfficeBudget = appState.settings.monthlyBudget - totalSpentThisMonth;
    const statBudgetElement = document.getElementById("statBudget");
    statBudgetElement.innerText = `${remainingOfficeBudget.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
    statBudgetElement.style.color = remainingOfficeBudget < 2000 ? "#EF4444" : "#10B981";

    renderBudgetQuotaTable(currentMonthStr);
}

function renderBudgetQuotaTable(currentMonthStr) {
    const tbody = document.getElementById("dashboardBudgetTableBody");
    tbody.innerHTML = "";

    const userGroup = appState.settings.group;

    Object.keys(BUDGET_RULES).forEach(key => {
        const rule = BUDGET_RULES[key];
        const reqLimit = getLimitPerRequest(key);
        let limitPerRequestText = "-";
        if (reqLimit !== undefined && reqLimit !== Infinity) {
            if (typeof reqLimit === "object") {
                limitPerRequestText = `รถ: ${reqLimit.car.toLocaleString()}฿ / จยย.: ${reqLimit.bike.toLocaleString()}฿`;
            } else {
                limitPerRequestText = `${reqLimit.toLocaleString()} ฿`;
            }
        }

        const monthlyLimit = getLimitPerMonth(key, userGroup);
        let limitPerMonthText = "-";
        if (monthlyLimit !== undefined && monthlyLimit !== Infinity) {
            limitPerMonthText = `${monthlyLimit.toLocaleString()} ฿`;
        }

        const spentThisMonth = appState.documents
            .filter(doc => doc.docDate.startsWith(currentMonthStr) && doc.itemCategory === key)
            .reduce((sum, doc) => sum + doc.total, 0);

        const remaining = (monthlyLimit !== undefined && monthlyLimit !== Infinity) ? (monthlyLimit - spentThisMonth) : Infinity;
        let remainingText = remaining === Infinity ? "ไม่จำกัดงบรายเดือน" : `${remaining.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;

        let statusBadge = `<span style="color:#10B981; font-weight:600;">พร้อมใช้งาน</span>`;
        if (remaining <= 0 && remaining !== Infinity) {
            statusBadge = `<span style="color:#EF4444; font-weight:600;">เต็มวงเงินแล้ว</span>`;
        } else if (remaining < 1000 && remaining !== Infinity) {
            statusBadge = `<span style="color:#F59E0B; font-weight:600;">ใกล้เต็ม</span>`;
        }

        const row = `
            <tr>
                <td style="font-weight:600;">${rule.name} <span style="font-size:0.75rem; color:var(--text-secondary); display:block;">รหัสบัญชี: ${rule.code}</span></td>
                <td>${limitPerRequestText}</td>
                <td>${limitPerMonthText}</td>
                <td style="font-weight:500;">${spentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td style="font-weight:600; color: ${remaining <= 0 ? '#EF4444' : 'inherit'}">${remainingText}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function exportBackupData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `THP-BergMoney-Backup-${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
}

async function importBackupData(e) {
    const fileReader = new FileReader();
    fileReader.onload = async function (event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (parsed.documents || parsed.inventory || parsed.settings) {
                const confirmImport = confirm(
                    "นำเข้าข้อมูลจะแทนที่ข้อมูลปัจจุบันบนระบบ Cloud\nดำเนินการต่อหรือไม่?"
                );
                if (!confirmImport) return;

                await migrateLocalStorageToFirestore(parsed);

                // โหลดข้อมูลใหม่จาก Firestore
                appState.documents = await fsGetDocuments();
                appState.inventory = await fsGetInventory();
                const settings = await fsLoadSettings();
                if (settings) appState.settings = settings;

                alert("นำเข้าข้อมูลสำรองเข้าระบบแล้ว!");
                updateUIElements();
            } else {
                alert("รูปแบบไฟล์สะสมไม่ถูกต้อง");
            }
        } catch (error) {
            alert("ไม่สามารถอ่านข้อมูลได้: " + error.message);
        }
    };
    fileReader.readAsText(e.target.files[0]);
}

// ----------------------------------------------------
// User Management (Admin Only)
// ----------------------------------------------------
async function renderUserManagementTable() {
    const tbody = document.getElementById("userManagementTableBody");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);"><span class="spinner" style="display:inline-block; width:16px; height:16px; border:2px solid #E2E8F0; border-top-color:var(--thp-red); border-radius:50%; animation:spin 0.8s linear infinite; vertical-align:middle; margin-right:0.5rem;"></span> กำลังโหลด...</td></tr>`;

    try {
        const users = await getAllUsers();
        tbody.innerHTML = "";

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">ไม่มีผู้ใช้ในระบบ</td></tr>`;
            return;
        }

        users.forEach(user => {
            const roleTh = user.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน";
            const roleBadgeClass = user.role === "admin" ? "admin" : "user";
            const statusTh = user.approved ? "อนุมัติแล้ว" : "รออนุมัติ";
            const statusBadgeClass = user.approved ? "approved" : "pending";

            let lastLoginText = "-";
            if (user.lastLoginAt) {
                try {
                    const d = user.lastLoginAt.toDate ? user.lastLoginAt.toDate() : new Date(user.lastLoginAt);
                    lastLoginText = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
                } catch (e) {
                    lastLoginText = "-";
                }
            }

            const isSelf = currentUser && user.id === currentUser.uid;

            let actionsHtml = "";
            if (isSelf) {
                actionsHtml = `<span style="color:var(--text-secondary); font-size:0.8rem;">ตัวคุณเอง</span>`;
            } else {
                if (!user.approved) {
                    actionsHtml += `<button class="btn btn-success" style="padding:3px 8px; font-size:0.75rem;" onclick="window._approveUser('${user.id}')"><span class="material-symbols-outlined" style="font-size:14px;">check</span> อนุมัติ</button> `;
                } else {
                    actionsHtml += `<button class="btn btn-secondary" style="padding:3px 8px; font-size:0.75rem;" onclick="window._rejectUser('${user.id}')"><span class="material-symbols-outlined" style="font-size:14px;">block</span> ระงับ</button> `;
                }

                const toggleRole = user.role === "admin" ? "user" : "admin";
                const toggleRoleTh = user.role === "admin" ? "ลดเป็นผู้ใช้" : "เลื่อนเป็น Admin";
                actionsHtml += `<button class="btn btn-secondary" style="padding:3px 8px; font-size:0.75rem;" onclick="window._changeUserRole('${user.id}', '${toggleRole}')"><span class="material-symbols-outlined" style="font-size:14px;">swap_horiz</span> ${toggleRoleTh}</button> `;
                actionsHtml += `<button class="btn btn-danger" style="padding:3px 8px; font-size:0.75rem;" onclick="window._removeUser('${user.id}')"><span class="material-symbols-outlined" style="font-size:14px;">delete</span></button>`;
            }

            const row = `
                <tr>
                    <td><img class="user-avatar" src="${user.photoURL || ''}" alt="" onerror="this.style.display='none'"></td>
                    <td style="font-weight:600;">${user.displayName || "ไม่ระบุ"}</td>
                    <td>${user.email || "-"}</td>
                    <td><span class="role-badge ${roleBadgeClass}">${roleTh}</span></td>
                    <td><span class="status-badge ${statusBadgeClass}">${statusTh}</span></td>
                    <td style="font-size:0.8rem;">${lastLoginText}</td>
                    <td>
                        <div style="display:flex; gap:0.25rem; justify-content:center; flex-wrap:wrap;">
                            ${actionsHtml}
                        </div>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", row);
        });
    } catch (error) {
        console.error("Error loading users:", error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#EF4444;">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
    }
}

// User management actions (exposed globally for inline onclick)
window._approveUser = async function(uid) {
    try {
        await updateUserApproval(uid, true);
        alert("อนุมัติผู้ใช้เรียบร้อย!");
        renderUserManagementTable();
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    }
};

window._rejectUser = async function(uid) {
    if (confirm("ต้องการระงับสิทธิ์ผู้ใช้นี้?")) {
        try {
            await updateUserApproval(uid, false);
            alert("ระงับสิทธิ์ผู้ใช้เรียบร้อย");
            renderUserManagementTable();
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    }
};

window._changeUserRole = async function(uid, newRole) {
    const roleTh = newRole === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน";
    if (confirm(`เปลี่ยนสิทธิ์เป็น "${roleTh}" ?`)) {
        try {
            await updateUserRole(uid, newRole);
            alert(`เปลี่ยนสิทธิ์เป็น "${roleTh}" เรียบร้อย!`);
            renderUserManagementTable();
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    }
};

window._removeUser = async function(uid) {
    if (confirm("ต้องการลบผู้ใช้นี้ออกจากระบบ?\n(การลบจะเอาสิทธิ์การเข้าถึงออก แต่ไม่ลบบัญชี Google)")) {
        try {
            await removeUser(uid);
            alert("ลบผู้ใช้ออกจากระบบเรียบร้อย");
            renderUserManagementTable();
        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    }
};

// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------
function arabicToThaiBaht(num) {
    if (num === 0) return "ศูนย์บาทถ้วน";
    const textNumber = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const textDigit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

    let parts = num.toFixed(2).split(".");
    let integerPart = parts[0];
    let decimalPart = parts[1];

    let result = "";

    if (parseInt(integerPart) > 0) {
        let length = integerPart.length;
        for (let i = 0; i < length; i++) {
            let digit = parseInt(integerPart.charAt(i));
            if (digit !== 0) {
                if (i === length - 1 && digit === 1 && length > 1) {
                    result += "เอ็ด";
                } else if (i === length - 2 && digit === 2) {
                    result += "ยี่";
                } else if (i === length - 2 && digit === 1) {
                    result += "";
                } else {
                    result += textNumber[digit];
                }
                result += textDigit[length - i - 1];
            }
        }
        result += "บาท";
    }

    if (parseInt(decimalPart) === 0) {
        result += "ถ้วน";
    } else {
        let length = decimalPart.length;
        for (let i = 0; i < length; i++) {
            let digit = parseInt(decimalPart.charAt(i));
            if (digit !== 0) {
                if (i === length - 1 && digit === 1 && length > 1 && decimalPart.charAt(0) !== '0') {
                    result += "เอ็ด";
                } else if (i === length - 2 && digit === 2) {
                    result += "ยี่";
                } else if (i === length - 2 && digit === 1) {
                    result += "";
                } else {
                    result += textNumber[digit];
                }
                result += textDigit[length - i - 1 + 1] === "สิบ" ? "สิบ" : "";
            }
        }
        result += "สตางค์";
    }

    return result;
}

function getLimitPerRequest(category) {
    if (appState.settings.customLimits && appState.settings.customLimits[category] && appState.settings.customLimits[category].limitPerRequest !== undefined) {
        return appState.settings.customLimits[category].limitPerRequest;
    }
    return BUDGET_RULES[category].limitPerRequest;
}

function getLimitPerMonth(category, group) {
    if (appState.settings.customLimits && appState.settings.customLimits[category] && appState.settings.customLimits[category].limitPerMonth !== undefined) {
        return appState.settings.customLimits[category].limitPerMonth;
    }
    const rawLimit = BUDGET_RULES[category].limitPerMonth;
    return typeof rawLimit === "object" ? rawLimit[group] : rawLimit;
}

function renderLimitsSettingsTable() {
    const tbody = document.getElementById("limitsSettingsTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    Object.keys(BUDGET_RULES).forEach(key => {
        const rule = BUDGET_RULES[key];
        const custom = (appState.settings.customLimits && appState.settings.customLimits[key]) ? appState.settings.customLimits[key] : {};

        const reqLimit = custom.limitPerRequest !== undefined ? custom.limitPerRequest : "";
        const monthLimit = custom.limitPerMonth !== undefined ? custom.limitPerMonth : "";

        let defaultReqPlaceholder = "";
        if (rule.limitPerRequest) {
            if (typeof rule.limitPerRequest === "object") {
                defaultReqPlaceholder = "ตามประเภทยานพาหนะ";
            } else if (rule.limitPerRequest === Infinity) {
                defaultReqPlaceholder = "ไม่จำกัด";
            } else {
                defaultReqPlaceholder = rule.limitPerRequest;
            }
        } else {
            defaultReqPlaceholder = "ไม่จำกัด";
        }

        let defaultMonthPlaceholder = "";
        if (rule.limitPerMonth) {
            if (typeof rule.limitPerMonth === "object") {
                const grp = appState.settings.group;
                defaultMonthPlaceholder = `${rule.limitPerMonth[grp]} (กลุ่ม)`;
            } else if (rule.limitPerMonth === Infinity) {
                defaultMonthPlaceholder = "ไม่จำกัด";
            } else {
                defaultMonthPlaceholder = rule.limitPerMonth;
            }
        } else {
            defaultMonthPlaceholder = "ไม่จำกัด";
        }

        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid var(--border-color)";
        row.innerHTML = `
            <td style="padding: 0.75rem; font-weight: 500; color: var(--text-primary);">${rule.name}</td>
            <td style="padding: 0.75rem; text-align: center; font-family: monospace; color: var(--text-secondary);">${rule.code}</td>
            <td style="padding: 0.75rem; text-align: right;">
                <input type="number" class="limit-req-input" data-category="${key}" value="${reqLimit}" placeholder="${defaultReqPlaceholder}" style="width: 130px; padding: 0.35rem 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); text-align: right; background-color: var(--bg-card); color: var(--text-primary);">
            </td>
            <td style="padding: 0.75rem; text-align: right;">
                <input type="number" class="limit-month-input" data-category="${key}" value="${monthLimit}" placeholder="${defaultMonthPlaceholder}" style="width: 130px; padding: 0.35rem 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); text-align: right; background-color: var(--bg-card); color: var(--text-primary);">
            </td>
        `;
        tbody.appendChild(row);
    });
}
