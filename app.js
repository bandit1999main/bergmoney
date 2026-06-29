// ----------------------------------------------------
// ระบบจัดซื้อจัดจ้าง บสค. 60 - ไปรษณีย์ไทย
// v2.0 - Firebase Authentication & Firestore (Integrated)
// ----------------------------------------------------

import { loginWithGoogle, logout, onAuthChange } from "./auth.js";
import {
    saveSettings as fsSaveSettings,
    loadSettings as fsLoadSettings,
    addDocument as fsAddDocument,
    getDocuments as fsGetDocuments,
    updateDocument as fsUpdateDocument,
    fsDeleteDocument,
    addDurable,
    getDurables,
    saveDurable,
    fsDeleteDurable,
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
    car_repair_car: { name: "ซ่อมแซมบำรุงรักษาพาหนะ (รถยนต์)", limitPerRequest: 15000, limitPerMonth: Infinity, code: "51070601", label: "ค่าซ่อมบำรุงยานพาหนะ" },
    car_repair_bike: { name: "ซ่อมแซมบำรุงรักษาพาหนะ (รถจักรยานยนต์)", limitPerRequest: 3000, limitPerMonth: Infinity, code: "51070601", label: "ค่าซ่อมบำรุงยานพาหนะ" },
    car_repair_boat: { name: "ซ่อมแซมบำรุงรักษาพาหนะ (เรือยนต์)", limitPerRequest: 5000, limitPerMonth: Infinity, code: "51070601", label: "ค่าซ่อมบำรุงยานพาหนะ" },
    car_repair_twowheel: { name: "ซ่อมแซมบำรุงรักษาพาหนะ (รถเข็น/สองล้อลาก)", limitPerRequest: 1000, limitPerMonth: Infinity, code: "51070601", label: "ค่าซ่อมบำรุงยานพาหนะ" },
    public_utility: { name: "ติดตั้ง/ซ่อมแซมบำรุงรักษาอุปกรณ์สาธารณูปโภค", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070501", label: "ซ่อมแซมสาธารณูปโภค" }
};

let appState = {
    settings: {
        group: "group2",
        monthlyBudget: 30000,
        officeName: "ที่ทำการไปรษณีย์มาบตาพุด",
        officerName: "นายนิพล ทรัพย์หมื่นแสน",
        officerPosition: "หน.ปณ.มาบตาพุด",
        customLimits: {}
    },
    documents: [],
    inventory: [],
    durables: []
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
            // ผู้ใช้ใหม่ - แสดงหน้าจอลงทะเบียนกรอกข้อมูลส่วนตัว
            showRegisterScreen(user);
            return;
        } else {
            // อัปเดตเวลาเข้าใช้ล่าสุด
            await createOrUpdateUser(user.uid, {
                lastLoginAt: getServerTimestamp(),
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
        hideRegisterScreen();
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

        if (!hasFirestoreData && (parsed.documents?.length > 0 || parsed.inventory?.length > 0 || parsed.durables?.length > 0)) {
            const confirmMigrate = confirm(
                "พบข้อมูลเดิมในเครื่อง (localStorage)\n" +
                `- เอกสาร: ${parsed.documents?.length || 0} รายการ\n` +
                `- ครุภัณฑ์/พัสดุ: ${parsed.durables?.length || parsed.inventory?.length || 0} รายการ\n\n` +
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
    document.getElementById("registerScreen").classList.add("hidden");
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

function showRegisterScreen(user) {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("pendingScreen").classList.add("hidden");
    document.getElementById("registerScreen").classList.remove("hidden");
    document.getElementById("appWrapper").classList.remove("visible");

    // กรอกข้อมูลเบื้องต้น
    document.getElementById("regOfficerName").value = user.displayName || "";
    document.getElementById("regOfficerPosition").value = "";
    document.getElementById("regOfficeName").value = "ที่ทำการไปรษณีย์มาบตาพุด";
    document.getElementById("regOfficePhone").value = "088-987-8635";

    const registerForm = document.getElementById("registerForm");
    registerForm.onsubmit = async (e) => {
        e.preventDefault();

        const officerName = document.getElementById("regOfficerName").value.trim();
        const officerPosition = document.getElementById("regOfficerPosition").value.trim();
        const officeName = document.getElementById("regOfficeName").value.trim();
        const officePhone = document.getElementById("regOfficePhone").value.trim();

        try {
            // ตรวจสอบว่าเป็นผู้ใช้คนแรกในระบบหรือไม่
            const allUsers = await getAllUsers();
            const isFirstUser = allUsers.length === 0;

            const newProfile = {
                displayName: officerName,
                email: user.email || "",
                photoURL: user.photoURL || "",
                officerName,
                officerPosition,
                officeName,
                officePhone,
                role: isFirstUser ? "admin" : "user",
                approved: isFirstUser ? true : false,
                createdAt: getServerTimestamp(),
                lastLoginAt: getServerTimestamp()
            };

            await createOrUpdateUser(user.uid, newProfile);
            const userProfile = { id: user.uid, ...newProfile };

            hideRegisterScreen();

            if (!userProfile.approved) {
                showPendingScreen(user);
            } else {
                currentUser = user;
                currentUserProfile = userProfile;
                await checkAndMigrateLocalData();
                showMainApp();
                await initApp();
                setupEventHandlers();
                updateUserUI();
                switchTab("dashboard");
            }
        } catch (error) {
            console.error("Error during registration:", error);
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลลงทะเบียน: " + error.message);
        }
    };

    document.getElementById("regCancelBtn").onclick = handleLogout;
}

function hideRegisterScreen() {
    document.getElementById("registerScreen").classList.add("hidden");
}

function showPendingScreen(user) {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("registerScreen").classList.add("hidden");
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
        if (!appState.settings.officeName) appState.settings.officeName = "ที่ทำการไปรษณีย์มาบตาพุด";
        if (!appState.settings.officerName) appState.settings.officerName = "นายนิพล ทรัพย์หมื่นแสน";
        if (!appState.settings.officerPosition) appState.settings.officerPosition = "หน.ปณ.มาบตาพุด";
    }

    // โหลด Documents จาก Firestore
    appState.documents = await fsGetDocuments();

    // โหลด Durables จาก Firestore
    appState.durables = await getDurables();
    if (!appState.durables) {
        appState.durables = [];
    }

    // กำหนดวันที่เริ่มต้น
    const docDateInput = document.getElementById("docDate");
    if (docDateInput) docDateInput.value = new Date().toISOString().substring(0, 10);

    renderMonthSelectOptions();

    // ตั้งค่าฟอร์มการตั้งค่าตั้งต้น
    const setGroupInput = document.getElementById("setGroupName");
    if (setGroupInput) setGroupInput.value = appState.settings.group;

    const setMonthlyBudgetInput = document.getElementById("setMonthlyBudget");
    if (setMonthlyBudgetInput) setMonthlyBudgetInput.value = appState.settings.monthlyBudget;

    const setOfficeNameInput = document.getElementById("setOfficeName");
    if (setOfficeNameInput) setOfficeNameInput.value = appState.settings.officeName;

    const setOfficerNameInput = document.getElementById("setOfficerName");
    if (setOfficerNameInput) setOfficerNameInput.value = appState.settings.officerName;

    const setOfficerPositionInput = document.getElementById("setOfficerPosition");
    if (setOfficerPositionInput) setOfficerPositionInput.value = appState.settings.officerPosition;

    // ตั้งค่าดีฟอลต์ในหน้าฟอร์ม บสค.60 จากค่าตั้งค่าหน่วยงาน
    const officeNameInput = document.getElementById("officeName");
    if (officeNameInput) officeNameInput.value = appState.settings.officeName;

    const requesterNameInput = document.getElementById("requesterName");
    if (requesterNameInput) requesterNameInput.value = appState.settings.officerName;

    const requesterPositionInput = document.getElementById("requesterPosition");
    if (requesterPositionInput) requesterPositionInput.value = appState.settings.officerPosition;

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
 
    // เหตุการณ์เปลี่ยนเดือนแดชบอร์ด
    const dashFilter = document.getElementById("dashboardMonthFilter");
    if (dashFilter) {
        dashFilter.addEventListener("change", (e) => {
            updateUIElements(e.target.value);
        });
    }

    // เหตุการณ์แบบฟอร์มคำขออนุมัติ
    const bskForm = document.getElementById("bskForm");
    bskForm.addEventListener("submit", handleBskSubmit);

    document.getElementById("addItemBtn").addEventListener("click", addFormItemRow);
    document.getElementById("itemCategory").addEventListener("change", checkQuotaLimits);
    document.getElementById("formTableBody").addEventListener("input", handleTableInput);

    // Dialog จัดการครุภัณฑ์
    const addDurableBtn = document.getElementById("addDurableBtn");
    if (addDurableBtn) {
        addDurableBtn.addEventListener("click", () => {
            document.getElementById("durableForm").reset();
            document.getElementById("durableId").value = "";
            document.getElementById("durableModalTitle").innerText = "เพิ่มข้อมูลครุภัณฑ์";
            openModal("durableModal");
        });
    }
    const durableForm = document.getElementById("durableForm");
    if (durableForm) {
        durableForm.addEventListener("submit", handleDurableSubmit);
    }

    const importDurableBtn = document.getElementById("importDurableBtn");
    if (importDurableBtn) {
        importDurableBtn.addEventListener("click", () => {
            document.getElementById("durableImportFileInput").click();
        });
    }

    const durableImportFileInput = document.getElementById("durableImportFileInput");
    if (durableImportFileInput) {
        durableImportFileInput.addEventListener("change", importDurablesCSV);
    }

    const exportDurableBtn = document.getElementById("exportDurableBtn");
    if (exportDurableBtn) {
        exportDurableBtn.addEventListener("click", exportDurablesCSV);
    }

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
        "history": "เช็คสถานะการขออนุมัติ บสค. 60",
        "inventory": "จัดการทะเบียนข้อมูลครุภัณฑ์",
        "monthly-report": "สรุปรายการซื้อและการจ้างประจำเดือน (แบบที่ 3)",
        "settings": "ตั้งค่าข้อมูลที่ทำการไปรษณีย์และรหัสหน่วยงาน",
        "user-management": "จัดการผู้ใช้งานระบบ",
        "account-settings": "บัญชีผู้ใช้งาน"
    };
    document.getElementById("pageTitleText").innerText = titles[tabId] || "ระบบเบิกเงิน";

    if (tabId === "dashboard") {
        initDashboardMonthFilter();
        updateUIElements();
    } else if (tabId === "history") {
        renderHistoryTable();
    } else if (tabId === "inventory") {
        renderDurableTable();
    } else if (tabId === "monthly-report") {
        renderMonthlyReportTable();
    } else if (tabId === "user-management") {
        renderUserManagementTable();
    } else if (tabId === "account-settings") {
        updateUserUI();
    }
}

// ----------------------------------------------------
// ฟังก์ชัน Auto-suggest ค้นหาครุภัณฑ์/บิลเก่า
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

    if (!appState.durables || appState.durables.length === 0) {
        boxElement.style.display = "none";
        return;
    }

    const suggestions = appState.durables.filter(d => 
        d.name.toLowerCase().includes(val) || 
        d.code.toLowerCase().includes(val)
    );

    if (suggestions.length === 0) {
        boxElement.style.display = "none";
        return;
    }

    suggestions.forEach(d => {
        const div = document.createElement("div");
        div.className = "suggest-item";
        div.style.padding = "8px 12px";
        div.style.cursor = "pointer";
        div.style.borderBottom = "1px solid var(--border-color)";
        div.innerHTML = `<strong>${d.name}</strong> <span style="font-size:0.8rem; color:var(--text-secondary);">(${d.code})</span>`;

        div.addEventListener("click", () => {
            input.value = d.name;
            const row = input.closest("tr");
            
            const codeInput = row.querySelector(".item-durable-code");
            if (codeInput) codeInput.value = d.code;
            
            if (d.category) {
                const categorySelect = document.getElementById("itemCategory");
                if (categorySelect) {
                    categorySelect.value = d.category;
                    checkQuotaLimits();
                }
            }

            // ค้นหาประวัติจัดซื้อจัดจ้างครั้งล่าสุดสำหรับครุภัณฑ์ตัวนี้
            let lastDoc = null;
            let lastItem = null;
            for (let i = appState.documents.length - 1; i >= 0; i--) {
                const doc = appState.documents[i];
                const item = doc.items.find(it => it.name.trim() === d.name.trim());
                if (item) {
                    lastDoc = doc;
                    lastItem = item;
                    break;
                }
            }

            if (lastDoc && lastItem) {
                const lastDateInput = row.querySelector(".item-last-date");
                if (lastDateInput) lastDateInput.value = lastDoc.docDate;
                const lastQtyInput = row.querySelector(".item-last-qty");
                if (lastQtyInput) lastQtyInput.value = lastItem.qty;
                const lastPriceInput = row.querySelector(".item-last-price");
                if (lastPriceInput) lastPriceInput.value = lastItem.price;
            } else {
                const lastDateInput = row.querySelector(".item-last-date");
                if (lastDateInput) lastDateInput.value = "";
                const lastQtyInput = row.querySelector(".item-last-qty");
                if (lastQtyInput) lastQtyInput.value = "";
                const lastPriceInput = row.querySelector(".item-last-price");
                if (lastPriceInput) lastPriceInput.value = "";
            }
            
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
            <td>
                <input type="text" class="item-durable-code" placeholder="เช่น 51090902-001" style="width: 100%; margin-bottom: 4px;">
                <select class="item-log-type" style="width: 100%; font-size: 0.8rem; padding: 2px;">
                    <option value="main">⭐️ ตัวเครื่องหลัก (จัดซื้อ)</option>
                    <option value="consumable" selected>📦 วัสดุสิ้นเปลือง/หมึก/อะไหล่</option>
                    <option value="repair">🔧 จ้างซ่อมบำรุงรักษา</option>
                </select>
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
    const memoNumber = document.getElementById("memoNumber").value;
    const bskNumber = document.getElementById("bskNumber").value;
    const orderAuthority = document.getElementById("orderAuthority").value;
    const necessityReason = document.getElementById("necessityReason").value;
    const hasQuotation = document.querySelector('input[name="hasQuotation"]:checked').value;

    const items = [];
    let total = 0;
    const rows = document.querySelectorAll("#formTableBody tr");
    rows.forEach(row => {
        const name = row.querySelector(".item-name").value;
        const durableCode = row.querySelector(".item-durable-code").value.trim();
        const logTypeSelect = row.querySelector(".item-log-type");
        const logType = logTypeSelect ? logTypeSelect.value : "consumable";
        const lastDate = row.querySelector(".item-last-date").value;
        const lastQty = row.querySelector(".item-last-qty").value;
        const lastPrice = row.querySelector(".item-last-price").value;
        const qty = parseFloat(row.querySelector(".item-qty").value) || 1;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;

        items.push({ name, durableCode, logType, lastDate, lastQty, lastPrice, qty, price });
        total += qty * price;
    });

    const requesterName = document.getElementById("requesterName").value;
    const requesterPosition = document.getElementById("requesterPosition").value;

    const newDoc = {
        memoNumber,
        bskNumber,
        docDate,
        officeName,
        officePhone,
        itemCategory: category,
        hasQuotation,
        items,
        total,
        requesterName,
        requesterPosition,
        orderAuthority,
        necessityReason,
        createdBy: currentUser ? currentUser.email : "",
        createdAt: getServerTimestamp()
    };

    try {
    const editingId = document.getElementById("editingBskId").value;

    try {
        if (editingId) {
            // โหมดแก้ไข
            const existingDoc = appState.documents.find(doc => doc.id === editingId);
            newDoc.status = existingDoc ? (existingDoc.status || 'pending') : 'pending';
            
            await fsUpdateDocument(editingId, newDoc);
            
            newDoc.id = editingId;
            const index = appState.documents.findIndex(doc => doc.id === editingId);
            if (index !== -1) {
                appState.documents[index] = newDoc;
            }
            
            alert("บันทึกการแก้ไข บสค. 60 เรียบร้อย!");
            document.getElementById("editingBskId").value = "";
            document.getElementById("saveDocBtn").innerHTML = `<span class="material-symbols-outlined">save</span> บันทึกคำขอ บสค.60`;
        } else {
            // โหมดสร้างใหม่
            newDoc.status = 'pending';
            const firestoreId = await fsAddDocument(newDoc);
            newDoc.id = firestoreId;
            appState.documents.unshift(newDoc);
            alert("บันทึกข้อมูลคำขอจัดซื้อจัดจ้าง บสค. 60 รอการอนุมัติเรียบร้อย!");
        }

        // รีเซ็ตฟอร์ม
        document.getElementById("bskForm").reset();
        
        // ตั้งค่าดีฟอลต์ในหน้าฟอร์ม บสค.60 จากค่าตั้งค่าหน่วยงาน
        const offNameIn = document.getElementById("officeName");
        const reqNameIn = document.getElementById("requesterName");
        const reqPosIn = document.getElementById("requesterPosition");
        if (offNameIn) offNameIn.value = appState.settings.officeName;
        if (reqNameIn) reqNameIn.value = appState.settings.officerName;
        if (reqPosIn) reqPosIn.value = appState.settings.officerPosition;

        const orderAuthIn = document.getElementById("orderAuthority");
        const necReasonIn = document.getElementById("necessityReason");
        if (orderAuthIn) orderAuthIn.value = "ตามคำสั่งที่ 4/2566";
        if (necReasonIn) necReasonIn.value = "เพื่อใช้ในงานปฏิบัติงาน";

        document.getElementById("formTableBody").innerHTML = `
            <tr>
                <td style="text-align: center;">1</td>
                <td class="suggest-wrapper">
                    <input type="text" class="item-name" placeholder="ระบุรายละเอียดสิ่งของ (พิมพ์เพื่อค้นหาประวัติ)" required style="width: 100%;">
                    <div class="suggest-box"></div>
                </td>
                <td>
                    <input type="text" class="item-durable-code" placeholder="เช่น 51090902-001" style="width: 100%;">
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
// ทะเบียนข้อมูลครุภัณฑ์ (Firestore)
// ----------------------------------------------------
const DURABLE_STATUS = {
    active: { label: "ใช้งานปกติ", color: "#10B981", bgColor: "rgba(16, 185, 129, 0.12)" },
    broken: { label: "ชำรุดรอซ่อม", color: "#F59E0B", bgColor: "rgba(245, 158, 11, 0.12)" },
    repairing: { label: "อยู่ระหว่างซ่อม", color: "#3B82F6", bgColor: "rgba(59, 130, 246, 0.12)" },
    scrapped: { label: "แทงจำหน่าย/ชำรุดถาวร", color: "#6B7280", bgColor: "rgba(107, 114, 128, 0.12)" }
};

function getStatusBadge(status) {
    const s = DURABLE_STATUS[status || "active"] || DURABLE_STATUS.active;
    return `<span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600; color:${s.color}; background-color:${s.bgColor}; text-align:center; min-width:80px;">${s.label}</span>`;
}

function renderDurableTable() {
    const tbody = document.getElementById("durableTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (appState.durables.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">ไม่มีข้อมูลทะเบียนครุภัณฑ์</td></tr>`;
        return;
    }

    appState.durables.forEach(d => {
        const cat = BUDGET_RULES[d.category];
        const catName = cat ? cat.name : "-";
        const qtyVal = typeof d.qty !== 'undefined' ? parseInt(d.qty) : 0;
        const minQtyVal = typeof d.minQty !== 'undefined' ? parseInt(d.minQty) : 3;
        const statusBadge = getStatusBadge(d.status);

        let qtyDisplay = `<span>${qtyVal}</span>`;
        let rowStyle = "";

        if (qtyVal === 0) {
            qtyDisplay = `<span style="color: #E31837; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size:16px;">error</span> หมดคลัง</span>`;
            rowStyle = `style="background-color: rgba(227, 24, 55, 0.08);"`;
        } else if (qtyVal <= minQtyVal) {
            qtyDisplay = `<span style="color: #D97706; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size:16px;">warning</span> ${qtyVal} (ใกล้หมด)</span>`;
            rowStyle = `style="background-color: rgba(217, 119, 6, 0.08);"`;
        }

        const row = `
            <tr ${rowStyle}>
                <td style="font-weight:600;">${d.code}</td>
                <td>${d.name}</td>
                <td>${catName}</td>
                <td style="text-align:center;">${qtyDisplay}</td>
                <td style="text-align:center; color: var(--text-secondary); font-weight: 500;">${minQtyVal}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td>${d.remark || "-"}</td>
                <td>
                    <div style="display:flex; gap:0.35rem; justify-content:center;">
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem; background-color: var(--thp-blue); color: white; border: none;" onclick="showDurableHistory('${d.code}', '${d.name}')" title="ดูประวัติการซ่อมและจัดซื้อ">
                            <span class="material-symbols-outlined" style="font-size:16px;">history</span>
                        </button>
                        <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem;" onclick="editDurable('${d.id}')" title="แก้ไข">
                            <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                        </button>
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size:0.8rem;" onclick="deleteDurable('${d.id}')" title="ลบ">
                            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

async function handleDurableSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("durableId").value;
    const code = document.getElementById("durableCode").value.trim();
    const name = document.getElementById("durableName").value.trim();
    const category = document.getElementById("durableCategory").value;
    const qty = parseInt(document.getElementById("durableQty").value) || 0;
    const minQty = parseInt(document.getElementById("durableMinQty").value) || 0;
    const status = document.getElementById("durableStatus").value;
    const remark = document.getElementById("durableRemark").value.trim();

    const durableData = {
        code,
        name,
        category,
        qty,
        minQty,
        status,
        remark,
        updatedAt: getServerTimestamp()
    };

    try {
        if (id) {
            // โหมดแก้ไข
            await saveDurable(id, durableData);
            const durable = appState.durables.find(d => d.id === id);
            if (durable) {
                durable.code = code;
                durable.name = name;
                durable.category = category;
                durable.qty = qty;
                durable.minQty = minQty;
                durable.status = status;
                durable.remark = remark;
            }
            alert("แก้ไขข้อมูลครุภัณฑ์เรียบร้อย!");
        } else {
            // โหมดเพิ่มใหม่
            durableData.status = "active";
            durableData.createdAt = getServerTimestamp();
            const firestoreId = await addDurable(durableData);
            durableData.id = firestoreId;
            appState.durables.push(durableData);
            alert("เพิ่มข้อมูลครุภัณฑ์เรียบร้อย!");
        }

        closeModal("durableModal");
        renderDurableTable();
    } catch (error) {
        console.error("Error saving durable asset:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    }
}

window.editDurable = function(id) {
    const d = appState.durables.find(item => item.id === id);
    if (!d) return;

    document.getElementById("durableId").value = d.id;
    document.getElementById("durableCode").value = d.code;
    document.getElementById("durableName").value = d.name;
    document.getElementById("durableCategory").value = d.category;
    document.getElementById("durableQty").value = typeof d.qty !== 'undefined' ? d.qty : 0;
    document.getElementById("durableMinQty").value = typeof d.minQty !== 'undefined' ? d.minQty : 3;
    document.getElementById("durableStatus").value = d.status || "active";
    document.getElementById("durableRemark").value = d.remark || "";
    
    document.getElementById("durableModalTitle").innerText = "แก้ไขข้อมูลครุภัณฑ์";
    openModal("durableModal");
};

window.deleteDurable = async function(id) {
    if (confirm("คุณต้องการลบครุภัณฑ์รายการนี้?")) {
        try {
            await fsDeleteDurable(id);
            appState.durables = appState.durables.filter(item => item.id !== id);
            renderDurableTable();
            alert("ลบข้อมูลครุภัณฑ์เรียบร้อย");
        } catch (error) {
            console.error("Error deleting durable asset:", error);
            alert("เกิดข้อผิดพลาดในการลบ: " + error.message);
        }
    }
};

// ----------------------------------------------------
// ประวัติเอกสาร (Firestore)
// ----------------------------------------------------
function renderHistoryTable() {
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = "";

    if (appState.documents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-secondary);">ไม่มีประวัติเอกสารจัดทำอนุมัติ</td></tr>`;
        return;
    }

    appState.documents.forEach(doc => {
        const cat = BUDGET_RULES[doc.itemCategory];
        const dateFormatted = new Date(doc.docDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        const quotationBadge = doc.hasQuotation === "true"
            ? `<span style="background-color:rgba(16,185,129,0.15); color:#10B981; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">มี</span>`
            : `<span style="background-color:rgba(239,68,68,0.15); color:#EF4444; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">ไม่มี</span>`;

        const status = doc.status || "pending";
        let statusBadge = "";
        let actionsHtml = "";

        if (status === "approved") {
            statusBadge = `<span style="background-color:rgba(16,185,129,0.15); color:#10B981; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700; display:inline-block;">🟢 อนุมัติแล้ว</span>`;
            actionsHtml = `
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size:0.8rem;" onclick="window._printDocument('${doc.id}')">
                    <span class="material-symbols-outlined" style="font-size:16px;">print</span> พิมพ์
                </button>
                <button class="btn btn-danger" style="padding: 4px 10px; font-size:0.8rem;" onclick="window._deleteDocument('${doc.id}')">
                    <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ลบ
                </button>
            `;
        } else if (status === "rejected") {
            statusBadge = `<span style="background-color:rgba(239,68,68,0.15); color:#EF4444; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700; display:inline-block;">🔴 ไม่อนุมัติ</span>`;
            actionsHtml = `
                <button class="btn btn-danger" style="padding: 4px 10px; font-size:0.8rem;" onclick="window._deleteDocument('${doc.id}')">
                    <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ลบ
                </button>
            `;
        } else {
            statusBadge = `<span style="background-color:rgba(245,158,11,0.15); color:#F59E0B; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:700; display:inline-block;">🟡 รออนุมัติ</span>`;
            actionsHtml = `
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem; background-color:#10B981; color:white; border:none;" onclick="window.approveDocument('${doc.id}')" title="อนุมัติเอกสารเพื่อเข้าคลัง">
                    <span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> อนุมัติ
                </button>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size:0.8rem;" onclick="window.editDocument('${doc.id}')" title="แก้ไข">
                    <span class="material-symbols-outlined" style="font-size:16px;">edit</span> แก้ไข
                </button>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size:0.8rem;" onclick="window._deleteDocument('${doc.id}')" title="ปฏิเสธและลบทิ้ง">
                    <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ปฏิเสธ/ลบ
                </button>
            `;
        }

        const row = `
            <tr>
                <td style="font-weight:600;">บสค. 60 เลขที่ ${doc.bskNumber || doc.docNumber || "-"}</td>
                <td>${dateFormatted}</td>
                <td>${cat ? cat.name : "ทั่วไป"}</td>
                <td>${quotationBadge}</td>
                <td style="font-weight:700; color:var(--thp-red);">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td>${doc.requesterName}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:0.35rem; justify-content:center;">
                        ${actionsHtml}
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

window._deleteDocument = async function(docId) {
    if (confirm("ลบประวัติใบขออนุมัตินี้ออกจากฐานข้อมูลหรือไม่?")) {
        try {
            await fsDeleteDocument(docId);
            appState.documents = appState.documents.filter(doc => doc.id !== docId);
            renderHistoryTable();
            alert("ลบเอกสารออกจากฐานข้อมูลสำเร็จ");
        } catch (error) {
            console.error("Error deleting document:", error);
            alert("เกิดข้อผิดพลาดในการลบ: " + error.message);
        }
    }
};

window.editDocument = function(docId) {
    const doc = appState.documents.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById("editingBskId").value = doc.id;
    document.getElementById("officeName").value = doc.officeName || "";
    document.getElementById("officePhone").value = doc.officePhone || "";
    document.getElementById("docDate").value = doc.docDate || "";
    document.getElementById("memoNumber").value = doc.memoNumber || "";
    document.getElementById("bskNumber").value = doc.bskNumber || "";
    document.getElementById("itemCategory").value = doc.itemCategory || "";
    document.getElementById("orderAuthority").value = doc.orderAuthority || "";
    document.getElementById("necessityReason").value = doc.necessityReason || "";
    document.getElementById("requesterName").value = doc.requesterName || "";
    document.getElementById("requesterPosition").value = doc.requesterPosition || "";

    const hasQuot = doc.hasQuotation === "true";
    document.getElementById("quotationYes").checked = hasQuot;
    document.getElementById("quotationNo").checked = !hasQuot;

    const tbody = document.getElementById("formTableBody");
    tbody.innerHTML = "";

    doc.items.forEach((item, index) => {
        const rowCount = index + 1;
        const rowHtml = `
            <tr>
                <td style="text-align: center;">${rowCount}</td>
                <td class="suggest-wrapper">
                    <input type="text" class="item-name" value="${item.name || ""}" placeholder="ระบุรายละเอียดสิ่งของ (พิมพ์เพื่อค้นหาประวัติ)" required style="width: 100%;">
                    <div class="suggest-box"></div>
                </td>
                <td>
                    <input type="text" class="item-durable-code" value="${item.durableCode || ""}" placeholder="เช่น 51090902-001" style="width: 100%; margin-bottom: 4px;">
                    <select class="item-log-type" style="width: 100%; font-size: 0.8rem; padding: 2px;">
                        <option value="main" ${item.logType === 'main' ? 'selected' : ''}>⭐️ ตัวเครื่องหลัก (จัดซื้อ)</option>
                        <option value="consumable" ${item.logType === 'consumable' || !item.logType ? 'selected' : ''}>📦 วัสดุสิ้นเปลือง/หมึก/อะไหล่</option>
                        <option value="repair" ${item.logType === 'repair' ? 'selected' : ''}>🔧 จ้างซ่อมบำรุงรักษา</option>
                    </select>
                </td>
                <td><input type="date" class="item-last-date" value="${item.lastDate || ""}" style="width: 100%;"></td>
                <td><input type="number" class="item-last-qty" value="${item.lastQty || ""}" placeholder="จำนวน" style="width: 100%; text-align: center;"></td>
                <td><input type="number" class="item-last-price" value="${item.lastPrice || ""}" placeholder="0.00" min="0" step="0.01" style="width: 100%; text-align: right;"></td>
                <td><input type="number" class="item-qty" value="${item.qty || 1}" min="1" required style="width: 100%; text-align: center;"></td>
                <td><input type="number" class="item-price" value="${item.price || 0}" placeholder="0.00" min="0" step="0.01" required style="width: 100%; text-align: right;"></td>
                <td>
                    <button type="button" class="btn-icon-only remove-row-btn" style="margin: auto;">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", rowHtml);
        
        const rowElement = tbody.lastElementChild;
        bindAutoSuggest(rowElement);
    });

    document.getElementById("saveDocBtn").innerHTML = `<span class="material-symbols-outlined">edit</span> บันทึกการแก้ไข บสค.60`;
    switchTab("bsk60-form");
};

window.approveDocument = async function(docId) {
    const doc = appState.documents.find(d => d.id === docId);
    if (!doc) return;

    if (confirm(`คุณอนุมัติคำขอจัดซื้อจัดจ้าง บสค. 60 เลขที่ ${doc.bskNumber || doc.memoNumber} ใช่หรือไม่?\nการอนุมัติจะเพิ่มจำนวนสินค้าเข้าสู่ทะเบียนครุภัณฑ์โดยอัตโนมัติ`)) {
        try {
            doc.status = 'approved';
            await fsUpdateDocument(docId, { status: 'approved' });

            if (!appState.durables) appState.durables = [];

            for (const item of doc.items) {
                if (!item.durableCode || !item.durableCode.trim()) continue;

                let durable = appState.durables.find(d => d.code === item.durableCode.trim());

                if (durable) {
                    durable.qty = (parseInt(durable.qty) || 0) + (parseInt(item.qty) || 0);
                    await saveDurable(durable.id, durable);
                } else {
                    const newDurable = {
                        code: item.durableCode.trim(),
                        name: item.name.trim(),
                        category: doc.itemCategory || "stationery",
                        qty: parseInt(item.qty) || 0,
                        minQty: 3,
                        status: "active",
                        remark: "สร้างอัตโนมัติจากใบ บสค. 60 ที่ได้รับการอนุมัติ"
                    };
                    const firestoreId = await addDurable(newDurable);
                    newDurable.id = firestoreId;
                    appState.durables.push(newDurable);
                }
            }

            renderDurableTable();
            renderHistoryTable();
            alert("อนุมัติรายการและบันทึกครุภัณฑ์เข้าระบบเรียบร้อย!");

        } catch (error) {
            console.error("Error approving document:", error);
            alert("เกิดข้อผิดพลาดในการอนุมัติ: " + error.message);
        }
    }
};

// ----------------------------------------------------
// รายงานประจำเดือน
// ----------------------------------------------------
function renderMonthSelectOptions() {
    const select = document.getElementById("reportMonthSelect");
    select.innerHTML = "";

    const months = {};
    appState.documents.forEach(doc => {
        if (doc.docDate) {
            const monthYear = doc.docDate.substring(0, 7);
            months[monthYear] = true;
        }
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

    const monthlyDocs = appState.documents.filter(doc => doc.docDate && doc.docDate.startsWith(selectedMonth));
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
                    <td>${item.durableCode || "-"}</td>
                    <td>${cat ? cat.code : "-"}</td>
                    <td>บสค. 60 เลขที่ ${doc.bskNumber || doc.docNumber || "-"}</td>
                    <td>${doc.orderAuthority || "ตามคำสั่งที่ 4/2566"}</td>
                    <td>${dateFormatted}</td>
                    <td>${doc.necessityReason || "เพื่อใช้ในงานปฏิบัติงาน"}</td>
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
    let categoryCheckboxesHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin: 10px 0; font-size: 10pt; border: 1px solid #000000; padding: 10px 14px; border-radius: 4px; line-height: 1.35;">`;
    catKeys.forEach(k => {
        const isChecked = doc.itemCategory === k;
        const symbol = isChecked ? "[ ✓ ]" : "[ &nbsp; ]";
        const style = isChecked ? "font-weight: bold; color: #000000;" : "color: #000000;";
        categoryCheckboxesHtml += `<div style="${style}">${symbol} ${BUDGET_RULES[k].name}</div>`;
    });
    categoryCheckboxesHtml += `</div>`;

    printSection.innerHTML = `
        <div class="print-header" style="position: relative; display: flex; align-items: center; justify-content: center; height: 60px; border-bottom: 2px solid #000000; margin-bottom: 18px; padding-bottom: 6px;">
            <img src="thailand-post-logo.png" alt="ไปรษณีย์ไทย" class="print-logo" style="height: 48px; object-fit: contain; position: absolute; left: 0; bottom: 6px;">
            <div style="font-weight: bold; font-size: 20pt; margin-bottom: 0;">บันทึกข้อความ</div>
        </div>
        <table class="memo-table" style="font-size: 11pt; margin-bottom: 18px; width: 100%;">
            <tr>
                <td style="width: 15%; font-weight: bold;">หน่วยงาน:</td>
                <td style="width: 50%;">${doc.officeName}</td>
                <td style="width: 10%; font-weight: bold;">โทร:</td>
                <td style="width: 25%;">${doc.officePhone}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; width: 15%;">ที่:</td>
                <td style="width: 50%;">${doc.memoNumber || "-"}</td>
                <td style="width: 10%; font-weight: bold;">วันที่:</td>
                <td style="width: 25%;">${dateFormatted}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 6px;">เรื่อง:</td>
                <td colspan="3" style="border-bottom: 1px solid #000000; padding-bottom: 6px;">ขอความเห็นชอบการจัดซื้อ/จัดจ้าง (ที่มอบอำนาจการซื้อและการจ้าง ${doc.orderAuthority || 'ตามคำสั่ง ปณท ที่ 4/2566'})</td>
            </tr>
            <tr>
                <td style="font-weight: bold; padding-top: 6px;">เรียน:</td>
                <td colspan="3" style="padding-top: 6px;">ฝปข.2</td>
            </tr>
        </table>
        
        <p style="text-indent: 1.5cm; margin-bottom: 8px; font-size: 11pt; line-height: 1.35; text-align: justify;">
            ด้วย <b>${doc.officeName}</b> มีความจำเป็นต้องการจัดซื้อและจัดจ้างพัสดุบางประเภท (ที่มอบอำนาจการซื้อและการจ้าง ${doc.orderAuthority || 'ตามคำสั่ง ปณท ที่ 4/2566'}) ดังนี้:
        </p>

        ${categoryCheckboxesHtml}

        <div style="display: flex; gap: 30px; margin: 10px 0; font-weight: bold; font-size: 11pt;">
            <span>[ ${doc.hasQuotation === 'true' ? '✓' : '&nbsp;'} ] มีใบเสนอราคา</span>
            <span>[ ${doc.hasQuotation === 'false' ? '✓' : '&nbsp;'} ] ไม่มีใบเสนอราคา</span>
        </div>

        <table class="item-table" style="font-size: 10.5pt; border-collapse: collapse; width: 100%; margin: 14px 0;">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 5%; vertical-align: middle;">ลำดับ</th>
                    <th rowspan="2" style="vertical-align: middle;">รายการที่จัดซื้อ/จัดจ้าง</th>
                    <th colspan="3" style="text-align: center;">ซื้อ/จ้าง ครั้งล่าสุด</th>
                    <th colspan="2" style="text-align: center;">ซื้อ/จ้าง ครั้งนี้</th>
                    <th rowspan="2" style="width: 12%; vertical-align: middle;">หมายเหตุ</th>
                </tr>
                <tr>
                    <th style="font-size: 10.5pt; width: 12%;">ว.ด.ป.</th>
                    <th style="font-size: 10.5pt; width: 8%;">จำนวน/ปริมาณ</th>
                    <th style="font-size: 10.5pt; width: 12%;">จำนวนเงิน (บาท)</th>
                    <th style="font-size: 10.5pt; width: 8%;">จำนวน/ปริมาณ</th>
                    <th style="font-size: 10.5pt; width: 12%;">จำนวนเงิน (บาท)</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
                <tr>
                    <td colspan="6" style="text-align: right; font-weight: bold; padding: 5px 6px;">รวมเป็นเงินทั้งสิ้น</td>
                    <td style="text-align: right; font-weight: bold; padding: 5px 6px;">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                    <td></td>
                </tr>
            </tbody>
        </table>

        <p style="text-indent: 1.5cm; margin-bottom: 16px; font-size: 11pt; line-height: 1.35;">
            จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต หากเห็นชอบจักได้ดำเนินการตามที่ ปณท มอบอำนาจการซื้อและการจ้างไว้ให้ต่อไป จักขอบคุณยิ่ง
        </p>

        <div class="sig-section">
            <div class="sig-block" style="width: 45%; text-align: center; font-size: 11pt; line-height: 1.35;">
                <p style="margin-bottom: 8px;">(ลงชื่อ)..............................................................</p>
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
    const monthlyDocs = appState.documents.filter(doc => doc.docDate && doc.docDate.startsWith(selectedMonth));

    const dateObj = new Date(selectedMonth + "-01");
    const monthName = dateObj.toLocaleDateString("th-TH", { month: "long" });
    const yearName = dateObj.toLocaleDateString("th-TH", { year: "numeric" });
    const printSection = document.getElementById("printSection");

    let reportRowsHtml = "";
    let grandTotal = 0;
    let itemIndex = 1;

    if (monthlyDocs.length > 0) {
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
                        <td>${item.durableCode || "-"}</td>
                        <td>${cat ? cat.code : "-"}</td>
                        <td>บสค. 60 เลขที่ ${doc.bskNumber || doc.docNumber || "-"}</td>
                        <td>${doc.orderAuthority || "ตามคำสั่งที่ 4/2566"}</td>
                        <td>${dateFormatted}</td>
                        <td>${doc.necessityReason || "เพื่อใช้ในงานปฏิบัติงาน"}</td>
                        <td style="text-align: right;">${itemTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                    </tr>
                `;
            });
        });
    }

    const officeName = appState.settings.officeName || "ที่ทำการไปรษณีย์มาบตาพุด";
    const officePhone = (monthlyDocs.length > 0 && monthlyDocs[0].officePhone) ? monthlyDocs[0].officePhone : "088-987-8635";
    const officerPosition = appState.settings.officerPosition || "หัวหน้าที่ทำการไปรษณีย์มาบตาพุด";
    const todayFormatted = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    printSection.innerHTML = `
        <div class="print-header" style="position: relative; display: flex; align-items: center; justify-content: center; height: 60px; border-bottom: 2px solid #000000; margin-bottom: 18px; padding-bottom: 6px;">
            <img src="thailand-post-logo.png" alt="ไปรษณีย์ไทย" class="print-logo" style="height: 48px; object-fit: contain; position: absolute; left: 0; bottom: 6px;">
            <div style="font-weight: bold; font-size: 20pt; margin-bottom: 0;">บันทึกข้อความ</div>
        </div>
        <table class="memo-table" style="font-size: 11pt; margin-bottom: 18px; width: 100%;">
            <tr>
                <td style="width: 15%; font-weight: bold;">หน่วยงาน:</td>
                <td style="width: 50%;">${officeName}</td>
                <td style="width: 10%; font-weight: bold;">โทร:</td>
                <td style="width: 25%;">${officePhone}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; width: 15%;">ที่:</td>
                <td style="width: 50%;">ปณท ปข.2(21150)/......................................................</td>
                <td style="width: 10%; font-weight: bold;">วันที่:</td>
                <td style="width: 25%;">${todayFormatted}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 6px;">เรื่อง:</td>
                <td colspan="3" style="border-bottom: 1px solid #000000; padding-bottom: 6px;">บัญชีสรุปรายการซื้อและการจ้างประจำเดือน <b>${monthName} ${yearName}</b></td>
            </tr>
            <tr>
                <td style="font-weight: bold; padding-top: 6px;">เรียน:</td>
                <td colspan="3" style="padding-top: 6px;">ฝปข.2</td>
            </tr>
        </table>
        
        <p style="text-indent: 1.5cm; margin-bottom: 8px; font-size: 11pt; line-height: 1.35; text-align: justify;">
            ตามคำสั่ง ปณท ที่ 4/2566 เรื่อง มอบอำนาจการซื้อและการจ้างพัสดุบางประเภทให้หัวหน้าที่ทำการต่างๆ ของ บริษัท ไปรษณีย์จำกัด สั่ง ณ วันที่ 4 ตุลาคม พ.ศ. 2566 กำหนดให้ที่ทำการและศูนย์ไปรษณีย์ต่างๆ จัดทำบัญชีสรุปรายการซื้อและการจ้างให้สำนักงานไปรษณีย์ต้นสังกัดทราบอย่างช้าไม่เกิน วันที่ 10 ของเดือนถัดไปนั้น
        </p>
        <p style="text-indent: 1.5cm; margin-bottom: 12px; font-size: 11pt; line-height: 1.35;">
            ${officeName} ขอสรุปการซื้อและการจ้างประจำเดือน <b>${monthName}</b> <b>${yearName}</b> มาเพื่อทราบ
        </p>

        <p style="font-weight: bold; margin-bottom: 8px; font-size: 11pt;">มีการซื้อและการจ้างรายละเอียดดังนี้</p>

        <table class="item-table" style="font-size: 10pt; border-collapse: collapse; width: 100%; margin: 14px 0;">
            <thead>
                <tr>
                    <th style="width: 5%; padding: 4px;">No</th>
                    <th style="padding: 4px;">รายการ</th>
                    <th style="width: 12%; padding: 4px;">รหัสครุภัณฑ์</th>
                    <th style="width: 10%; padding: 4px;">รหัสบัญชี</th>
                    <th style="width: 18%; padding: 4px;">เลขที่ บสค.60</th>
                    <th style="width: 15%; padding: 4px;">คำสั่งอนุญาตซื้อ/จ้าง</th>
                    <th style="width: 10%; padding: 4px;">ว.ด.ป.</th>
                    <th style="width: 15%; padding: 4px;">เหตุความจำเป็น</th>
                    <th style="width: 12%; padding: 4px;">จำนวนเงิน</th>
                </tr>
            </thead>
            <tbody>
                ${reportRowsHtml ? reportRowsHtml : '<tr><td colspan="9" style="text-align: center; padding: 12px; color: #555;">ไม่มีรายการจัดซื้อจัดจ้างในเดือนนี้</td></tr>'}
                <tr>
                    <td colspan="8" style="text-align: right; font-weight: bold; padding: 5px 6px;">รวมเป็นเงิน</td>
                    <td style="text-align: right; font-weight: bold; padding: 5px 6px;">${grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        ${reportRowsHtml ? '' : '<p style="font-size: 11pt; margin-top: 10px; margin-bottom: 10px;">ไม่มีการซื้อและการจ้าง</p>'}

        <p style="font-size: 11pt; margin-top: 10px; margin-bottom: 16px;">จึงเรียนมาเพื่อโปรดทราบ</p>

        <div class="sig-section">
            <div class="sig-block" style="width: 45%; text-align: center; font-size: 11pt; line-height: 1.35;">
                <p style="margin-top: 40px; font-weight: bold; margin-bottom: 2px;">(${appState.settings.officerName || "นายนิพล ทรัพย์หมื่นแสน"})</p>
                <p>${officerPosition}</p>
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

// Expose to global scope
window._printDocument = printDocument;
window._deleteDocument = deleteDocument;

async function handleSettingsSubmit(e) {
    e.preventDefault();
    appState.settings.group = document.getElementById("setGroupName").value;
    appState.settings.monthlyBudget = parseFloat(document.getElementById("setMonthlyBudget").value) || 0;
    appState.settings.officeName = document.getElementById("setOfficeName").value.trim();
    appState.settings.officerName = document.getElementById("setOfficerName").value.trim();
    appState.settings.officerPosition = document.getElementById("setOfficerPosition").value.trim();

    // ปรับปรุงค่าดีฟอลต์ในฟอร์ม บสค.60 ทันที
    const officeNameInput = document.getElementById("officeName");
    if (officeNameInput) officeNameInput.value = appState.settings.officeName;

    const requesterNameInput = document.getElementById("requesterName");
    if (requesterNameInput) requesterNameInput.value = appState.settings.officerName;

    const requesterPositionInput = document.getElementById("requesterPosition");
    if (requesterPositionInput) requesterPositionInput.value = appState.settings.officerPosition;

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

function initDashboardMonthFilter() {
    const select = document.getElementById("dashboardMonthFilter");
    if (!select) return;
    
    const prevVal = select.value;
    select.innerHTML = "";

    const months = new Set();
    const currentMonth = new Date().toISOString().substring(0, 7);
    months.add(currentMonth);

    appState.documents.forEach(doc => {
        if (doc.docDate && doc.docDate.length >= 7) {
            months.add(doc.docDate.substring(0, 7));
        }
    });

    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));

    sortedMonths.forEach(m => {
        const [year, month] = m.split("-");
        const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
        const formatLabel = dateObj.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = formatLabel;
        select.appendChild(opt);
    });

    if (prevVal && sortedMonths.includes(prevVal)) {
        select.value = prevVal;
    } else {
        select.value = currentMonth;
    }
}

function updateUIElements(selectedMonth) {
    const filter = document.getElementById("dashboardMonthFilter");
    const currentMonthStr = selectedMonth || (filter ? filter.value : null) || new Date().toISOString().substring(0, 7);
    
    if (filter && filter.value !== currentMonthStr && Array.from(filter.options).some(o => o.value === currentMonthStr)) {
        filter.value = currentMonthStr;
    }

    const currentMonthDocs = appState.documents.filter(doc => doc.docDate && doc.docDate.startsWith(currentMonthStr));
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
    if (!tbody) return;
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
            .filter(doc => doc.docDate && doc.docDate.startsWith(currentMonthStr) && doc.itemCategory === key)
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
            if (parsed.documents || parsed.inventory || parsed.settings || parsed.durables) {
                const confirmImport = confirm(
                    "นำเข้าข้อมูลจะแทนที่ข้อมูลปัจจุบันบนระบบ Cloud\nดำเนินการต่อหรือไม่?"
                );
                if (!confirmImport) return;

                await migrateLocalStorageToFirestore(parsed);

                // โหลดข้อมูลใหม่จาก Firestore
                appState.documents = await fsGetDocuments();
                appState.durables = await getDurables();
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

// ----------------------------------------------------
// ระบบนำเข้าและส่งออกข้อมูลครุภัณฑ์เป็นไฟล์ CSV
// ----------------------------------------------------
function exportDurablesCSV() {
    if (!appState.durables || appState.durables.length === 0) {
        alert("ไม่มีข้อมูลครุภัณฑ์ที่จะส่งออก");
        return;
    }

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "รหัสครุภัณฑ์,ชื่อครุภัณฑ์/รายการ,หมวดหมู่รายจ่าย,จำนวน,หมายเหตุ\r\n";

    appState.durables.forEach(d => {
        const code = (d.code || "").replace(/"/g, '""');
        const name = (d.name || "").replace(/"/g, '""');
        const qty = d.qty || 0;
        const remark = (d.remark || "").replace(/"/g, '""');
        csvContent += `"${code}","${name}","${d.category}",${qty},"${remark}"\r\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `durable_assets_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function importDurablesCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/);
        
        let importCount = 0;
        let updateCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = parseCSVLine(line);
            if (cols.length < 2) continue;

            const code = cols[0].trim();
            const name = cols[1].trim();
            const categoryStr = cols[2] ? cols[2].trim() : "";
            const qty = cols[3] ? parseInt(cols[3].trim()) || 0 : 0;
            const remark = cols[4] ? cols[4].trim() : "";

            if (!code || !name) continue;

            const category = findCategoryKey(categoryStr);

            const existing = appState.durables.find(d => d.code === code);
            if (existing) {
                existing.name = name;
                existing.category = category;
                existing.qty = (existing.qty || 0) + qty;
                if (remark) existing.remark = remark;
                
                // อัปเดต Firestore
                await saveDurable(existing.id, {
                    name: existing.name,
                    category: existing.category,
                    qty: existing.qty,
                    remark: existing.remark
                });
                updateCount++;
            } else {
                const newDurable = {
                    code,
                    name,
                    category,
                    qty,
                    remark,
                    createdAt: getServerTimestamp()
                };
                
                // เพิ่มเข้า Firestore
                const firestoreId = await addDurable(newDurable);
                newDurable.id = firestoreId;
                appState.durables.push(newDurable);
                importCount++;
            }
        }

        renderDurableTable();
        alert(`นำเข้าครุภัณฑ์เสร็จสิ้น! เพิ่มใหม่ ${importCount} รายการ, อัปเดตยอดเดิม ${updateCount} รายการ`);
        
        e.target.value = "";
    };
    
    reader.readAsText(file, "UTF-8");
}

function findCategoryKey(str) {
    if (!str) return "stationery";
    const cleaned = str.trim().toLowerCase();
    
    if (BUDGET_RULES[cleaned]) {
        return cleaned;
    }
    
    for (const [key, rule] of Object.entries(BUDGET_RULES)) {
        if (rule.name.toLowerCase().includes(cleaned) || 
            rule.code.toLowerCase() === cleaned || 
            rule.label.toLowerCase().includes(cleaned)) {
            return key;
        }
    }
    
    return "stationery";
}

function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

window.showDurableHistory = function(durableCode, durableName) {
    const summaryDiv = document.getElementById("durableHistorySummary");
    const tbody = document.getElementById("durableHistoryTableBody");
    if (!summaryDiv || !tbody) return;

    summaryDiv.innerHTML = "";
    tbody.innerHTML = "";

    const d = appState.durables.find(item => item.code === durableCode);
    const qtyVal = d ? (d.qty || 0) : 0;
    const statusVal = d ? (d.status || "active") : "active";
    const statusText = getStatusBadge(statusVal);

    const logs = [];
    let totalExpense = 0;

    appState.documents.forEach(doc => {
        if (doc.items) {
            doc.items.forEach(item => {
                if (item.durableCode && item.durableCode.trim() === durableCode.trim()) {
                    const itemTotal = (item.qty || 0) * (item.price || 0);
                    totalExpense += itemTotal;
                    
                    let typeBadge = "";
                    const logType = item.logType || "";
                    if (logType === "main") {
                        typeBadge = `<span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600; color:#B45309; background-color:#FEF3C7; border: 1px solid #FCD34D;">⭐️ ตัวเครื่องหลัก</span>`;
                    } else if (logType === "repair") {
                        typeBadge = `<span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600; color:#1D4ED8; background-color:#DBEAFE; border: 1px solid #BFDBFE;">🔧 จ้างซ่อมบำรุง</span>`;
                    } else {
                        typeBadge = `<span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600; color:#047857; background-color:#D1FAE5; border: 1px solid #A7F3D0;">📦 วัสดุ/สิ้นเปลือง</span>`;
                    }

                    logs.push({
                        date: doc.docDate,
                        bskNumber: doc.bskNumber || doc.memoNumber || "-",
                        name: item.name,
                        qty: item.qty,
                        total: itemTotal,
                        typeBadge: typeBadge
                    });
                }
            });
        }
    });

    logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    summaryDiv.innerHTML = `
        <div><strong>ครุภัณฑ์/รายการ:</strong> ${durableName}</div>
        <div><strong>รหัสครุภัณฑ์:</strong> ${durableCode}</div>
        <div><strong>จำนวนคงเหลือในคลัง:</strong> ${qtyVal} ชิ้น</div>
        <div><strong>สถานะปัจจุบัน:</strong> ${statusText}</div>
        <div style="grid-column: 1 / -1; margin-top: 4px; border-top: 1px solid var(--border-color); padding-top: 8px;">
            <strong>ค่าใช้จ่ายสะสมทั้งหมดของครุภัณฑ์ชิ้นนี้:</strong> 
            <span style="color: var(--thp-red); font-weight: 700; font-size: 1.1rem;">
                ${totalExpense.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </span> บาท
        </div>
    `;

    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:var(--text-secondary);">ไม่มีประวัติการซื้อหรือการซ่อมแซมสำหรับครุภัณฑ์นี้</td></tr>`;
    } else {
        logs.forEach(log => {
            const dateFormatted = new Date(log.date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
            const row = `
                <tr>
                    <td>${dateFormatted}</td>
                    <td>บสค. 60 เลขที่ ${log.bskNumber}</td>
                    <td class="text-left">
                        <div style="display:flex; align-items:center; gap:8px;">
                            ${log.typeBadge}
                            <span>${log.name}</span>
                        </div>
                    </td>
                    <td style="text-align:center;">${log.qty}</td>
                    <td style="text-align:right; font-weight:600;">${log.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", row);
        });
    }

    openModal("durableHistoryModal");
};

window.printDashboardReport = function() {
    const filter = document.getElementById("dashboardMonthFilter");
    const selectedMonth = filter ? filter.value : new Date().toISOString().substring(0, 7);

    const dateObj = new Date(selectedMonth + "-01");
    const monthLabel = dateObj.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const printSection = document.getElementById("printSection");

    const currentMonthDocs = appState.documents.filter(doc => doc.docDate && doc.docDate.startsWith(selectedMonth));
    const totalSpentThisMonth = currentMonthDocs.reduce((sum, doc) => sum + doc.total, 0);
    const officeBudget = appState.settings.monthlyBudget || 30000;
    const remainingBudget = officeBudget - totalSpentThisMonth;

    let tableRowsHtml = "";
    const userGroup = appState.settings.group;

    Object.keys(BUDGET_RULES).forEach(key => {
        const rule = BUDGET_RULES[key];
        const reqLimit = getLimitPerRequest(key);
        let limitPerRequestText = "-";
        if (reqLimit !== undefined && reqLimit !== Infinity) {
            limitPerRequestText = `${reqLimit.toLocaleString()} ฿`;
        }

        const monthlyLimit = getLimitPerMonth(key, userGroup);
        let limitPerMonthText = "-";
        if (monthlyLimit !== undefined && monthlyLimit !== Infinity) {
            limitPerMonthText = `${monthlyLimit.toLocaleString()} ฿`;
        }

        const spentThisMonth = currentMonthDocs
            .filter(doc => doc.itemCategory === key)
            .reduce((sum, doc) => sum + doc.total, 0);

        const remaining = (monthlyLimit !== undefined && monthlyLimit !== Infinity) ? (monthlyLimit - spentThisMonth) : Infinity;
        let remainingText = remaining === Infinity ? "ไม่จำกัด" : `${remaining.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;

        let statusText = "พร้อมใช้งาน";
        if (remaining <= 0 && remaining !== Infinity) {
            statusText = "เต็มวงเงินแล้ว";
        } else if (remaining < 1000 && remaining !== Infinity) {
            statusText = "ใกล้เต็ม";
        }

        tableRowsHtml += `
            <tr>
                <td style="text-align: left; font-weight: bold; padding: 10px;">${rule.name}<br><span style="font-size: 8pt; color: #4A5568; font-weight: normal;">รหัสบัญชี: ${rule.code}</span></td>
                <td style="text-align: center; padding: 10px;">${limitPerRequestText}</td>
                <td style="text-align: center; padding: 10px;">${limitPerMonthText}</td>
                <td style="text-align: right; padding: 10px;">${spentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td style="text-align: right; padding: 10px; font-weight: bold;">${remainingText}</td>
                <td style="text-align: center; padding: 10px; font-weight: bold;">${statusText}</td>
            </tr>
        `;
    });

    const officeName = appState.settings.officeName || "ที่ทำการไปรษณีย์มาบตาพุด";
    const officerName = appState.settings.officerName || "นายนิพล ทรัพย์หมื่นแสน";
    const officerPosition = appState.settings.officerPosition || "หัวหน้าที่ทำการไปรษณีย์มาบตาพุด";

    printSection.innerHTML = `
        <div class="print-container" style="display: flex; flex-direction: column; justify-content: space-between; min-height: 27.7cm; box-sizing: border-box; padding: 0.5cm 1cm 1cm 1cm; font-family: 'Prompt', 'TH Sarabun New', sans-serif;">
            <div>
                <!-- Header -->
                <div class="print-header" style="position: relative; display: flex; align-items: center; justify-content: center; height: 60px; border-bottom: 2px solid #000000; margin-bottom: 18px; padding-bottom: 6px;">
                    <img src="thailand-post-logo.png" alt="ไปรษณีย์ไทย" class="print-logo" style="height: 48px; object-fit: contain; position: absolute; left: 0; bottom: 6px;">
                    <div style="font-weight: bold; font-size: 18pt; margin-bottom: 0;">รายงานสรุปงบประมาณและสถานะโควตาประจำเดือน</div>
                </div>

                <!-- Info Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11pt;">
                    <tr>
                        <td style="width: 12%; font-weight: bold; padding: 4px 0;">หน่วยงาน:</td>
                        <td style="width: 48%; padding: 4px 0;">${officeName}</td>
                        <td style="width: 15%; font-weight: bold; padding: 4px 0;">ประจำเดือน:</td>
                        <td style="width: 25%; padding: 4px 0;">${monthLabel}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 4px 0;">งบที่ทำการ:</td>
                        <td style="padding: 4px 0;">${officeBudget.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                        <td style="font-weight: bold; padding: 4px 0;">ใช้จริงสะสม:</td>
                        <td style="padding: 4px 0; color: #E31837; font-weight: bold;">${totalSpentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold; padding: 4px 0;">งบคงเหลือ:</td>
                        <td style="padding: 4px 0; font-weight: bold; color: #10B981;">${remainingBudget.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                        <td style="font-weight: bold; padding: 4px 0;">จำนวนคำขอ:</td>
                        <td style="padding: 4px 0;">${currentMonthDocs.length} รายการ</td>
                    </tr>
                </table>

                <div style="font-weight: bold; font-size: 11pt; margin-bottom: 8px;">สถานะการใช้งานงบประมาณแยกตามหมวดหมู่รายจ่าย</div>
                
                <!-- Table -->
                <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 9.5pt; text-align: center; border: 1px solid #CBD5E1;">
                    <thead>
                        <tr style="background-color: #F1F5F9; border-bottom: 2px solid #94A3B8;">
                            <th style="border: 1px solid #CBD5E1; padding: 8px; text-align: left; font-weight: bold;">ประเภทจัดซื้อจัดจ้าง/วัสดุ</th>
                            <th style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold;">วงเงินอนุมัติ/ครั้ง</th>
                            <th style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold;">วงเงินอนุมัติ/เดือน</th>
                            <th style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold;">ใช้จริงสะสม</th>
                            <th style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold;">คงเหลือใช้งาน</th>
                            <th style="border: 1px solid #CBD5E1; padding: 8px; font-weight: bold;">สถานะ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>

            <!-- Signature Section -->
            <div class="sig-section" style="margin-top: auto; display: flex; justify-content: flex-end; font-size: 11pt;">
                <div style="text-align: center; width: 300px; padding-top: 1.5cm;">
                    <p style="margin-bottom: 0.6cm;">ลงชื่อ............................................................</p>
                    <p style="margin: 0; font-weight: bold;">( ${officerName} )</p>
                    <p style="margin: 4px 0 0 0; color: #4A5568;">${officerPosition}</p>
                </div>
            </div>
        </div>
    `;

    window.print();
};
