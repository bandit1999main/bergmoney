// ----------------------------------------------------
// ระบบจัดซื้อจัดจ้าง บสค. 60 - ไปรษณีย์ไทย
// สคริปต์หลักและระบบฐานข้อมูล LocalStorage
// ----------------------------------------------------

// 1. กำหนดวงเงินและงบประมาณตามระเบียบ ปณท 4/2566
const BUDGET_RULES = {
    med: { name: "ซื้อยาเวชภัณฑ์และยาประจำตู้ยา", limitPerRequest: 1000, limitPerMonth: Infinity, code: "51020101", label: "ยาและเวชภัณฑ์" },
    stationery: { name: "วัสดุสิ้นเปลือง - เครื่องใช้สำนักงาน", limitPerRequest: Infinity, limitPerMonth: { group1: 3000, group2: 4000, group3: 5000 }, code: "51090902", label: "วัสดุสำนักงาน" },
    electricity: { name: "วัสดุอุปกรณ์ไฟฟ้า/ประปา/สาธารณูปโภค", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51090505", label: "วัสดุอุปกรณ์ไฟฟ้า/ประปา" },
    household: { name: "วัสดุสิ้นเปลือง - งานบ้านที่ใช้สิ้นเปลือง", limitPerRequest: Infinity, limitPerMonth: { group1: 3000, group2: 4000, group3: 5000 }, code: "51090501", label: "วัสดุงานบ้านงานครัว" },
    waste: { name: "กำจัดขยะ/สิ่งปฏิกูล/ลอกท่อระบายน้ำ", limitPerRequest: Infinity, limitPerMonth: 2000, code: "51099909", label: "กำจัดขยะและสิ่งปฏิกูล" },
    building: { name: "ซ่อมแซมบำรุงรักษาอาคารและสิ่งปลูกสร้าง", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070201", label: "ค่าบำรุงรักษาสิ่งปลูกสร้าง" },
    machine: { name: "ซ่อมแซมบำรุงรักษาเครื่องจักรและอุปกรณ์", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070101", label: "ค่าซ่อมแซมบำรุงรักษาเครื่องจักร" },
    tool: { name: "ซ่อมแซมบำรุงรักษาเครื่องมือเครื่องใช้ทั่วไป", limitPerRequest: Infinity, limitPerMonth: 5000, code: "51070199", label: "ค่าซ่อมบำรุงเครื่องมือใช้สอย" },
    office_repair: { name: "ซ่อมแซมปรจัดการ UI
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventHandlers();
    switchTab("dashboard");
});

// ฟังก์ชันเริ่มต้นโหลดฐานข้อมูลจาก LocalStorage
function initApp() {
    // ดึงข้อมูลการตั้งค่าและฐานข้อมูลเดิม
    const savedData = localStorage.getItem("thp_bergmoney_data");
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.settings) appState.settings = parsed.settings;
            if (parsed.documents) appState.documents = parsed.documents;
            if (parsed.inventory) appState.inventory = parsed.inventory;
        } catch (e) {
            console.error("Error loading localStorage data", e);
        }

        appState.inventory = [
            {
                id: "INV-001",
                date: "2026-06-02",
                name: "กระดาษ A4 Double A 80g",
                ref: "บสค.60 เลขที่ 85/2566",
                action: "receive",
                qty: 10,
                balance: 10,
                receiver: "นายสมชาย ใจดี",
                inspectors: "คณะกรรมการจัดซื้อ ปณ.มาบตาพุด",
                auditor: "นายนิพล ทรัพย์หมื่นแสน"
            },
            {
                id: "INV-002",
                date: "2026-06-10",
                name: "กระดาษ A4 Double A 80g",
                ref: "ใบเบิกพัสดุภายใน",
                action: "issue",
                qty: 2,
                balance: 8,
                receiver: "นางสาวสมศรี สวยงาม",
                inspectors: "-",
                auditor: "นายนิพล ทรัพย์หมื่นแสน"
            }
        ];
        saveDataToStorage();
    }

    // ตั้งค่าฟอร์มให้วันที่เริ่มต้นเป็นปัจจุบัน
    const docDateInput = document.getElementById("docDate");
    if (docDateInput) {
        docDateInput.value = new Date().toISOString().substring(0, 10);
    }
    
    // ตั้งค่าฟอร์มคลังสินค้าเป็นปัจจุบัน
    const invDateInput = document.getElementById("invDate");
    if (invDateInput) {
        invDateInput.value = new Date().toISOString().substring(0, 10);
    }

    // ใส่ตัวเลือกเดือนในหน้าสรุปรายเดือน
    renderMonthSelectOptions();
    
    // อัปเดตข้อมูลบนหน้าจอทั้งหมด
    updateUIElements();
}

function saveDataToStorage() {
    localStorage.setItem("thp_bergmoney_data", JSON.stringify(appState));
}

// 3. จัดการสวิตช์แท็บและการโต้ตอบของผู้ใช้
function setupEventHandlers() {
    // Menu Tab Navigation
    document.querySelectorAll("aside .menu-item").forEach(item => {
        item.addEventListener("click", (e) => {
            const tabId = e.currentTarget.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    // Theme toggle
    document.getElementById("themeToggle").addEventListener("click", () => {
        const body = document.body;
        body.classList.toggle("light-theme");
        const isLight = body.classList.contains("light-theme");
        document.getElementById("themeToggle").querySelector("span").innerText = isLight ? "light_mode" : "dark_mode";
    });

    // Setup BskForm validation and total calculation
    const bskForm = document.getElementById("bskForm");
    bskForm.addEventListener("submit", handleBskSubmit);
    
    document.getElementById("addItemRowBtn").addEventListener("click", addFormItemRow);
    document.getElementById("itemCategory").addEventListener("change", checkQuotaLimits);
    document.getElementById("formItemsTableBody").addEventListener("input", handleTableInput);

    // Setup Inventory Modal Actions
    document.getElementById("addInventoryBtn").addEventListener("click", () => openModal("inventoryModal"));
    document.getElementById("inventoryForm").addEventListener("submit", handleInventorySubmit);

    // Settings Submit
    document.getElementById("settingsForm").addEventListener("submit", handleSettingsSubmit);

    // Export & Import Backup Data
    document.getElementById("exportData").addEventListener("click", exportBackupData);
    document.getElementById("importDataBtn").addEventListener("click", () => {
        document.getElementById("importFile").click();
    });
    document.getElementById("importFile").addEventListener("change", importBackupData);

    // Month Report update trigger
    document.getElementById("reportMonthSelect").addEventListener("change", () => {
        renderMonthlyReportTable();
    });
    document.getElementById("printMonthlyReportBtn").addEventListener("click", printMonthlyReport);
}

function switchTab(tabId) {
    document.querySelectorAll("aside .menu-item").forEach(item => {
        item.classList.toggle("active", item.getAttribute("data-tab") === tabId);
    });
    document.querySelectorAll(".main-content .tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === tabId);
    });

    // รีเฟรชข้อมูลตามหน้าแท็บที่เลือก
    if (tabId === "dashboard") {
        updateUIElements();
    } else if (tabId === "history") {
        renderHistoryTable();
    } else if (tabId === "inventory") {
        renderInventoryTable();
    } else if (tabId === "monthly-report") {
        renderMonthlyReportTable();
    } else if (tabId === "settings") {
        document.getElementById("setGroupName").value = appState.settings.group;
        document.getElementById("setMonthlyBudget").value = appState.settings.monthlyBudget;
    }
}

// 4. ระบบการคำนวณ ตรวจสอบวงเงิน และสรุปสถิติ (Dashboard)
function updateUIElements() {
    const currentMonthStr = new Date().toISOString().substring(0, 7); // yyyy-mm
    
    // กรองประวัติคำขอในเดือนปัจจุบัน
    const currentMonthDocs = appState.documents.filter(doc => doc.docDate.startsWith(currentMonthStr));
    const totalSpentThisMonth = currentMonthDocs.reduce((sum, doc) => sum + doc.total, 0);
    
    // อัปเดตสถิติด้านบนแดชบอร์ด
    document.getElementById("statCount").innerText = `${currentMonthDocs.length} รายการ`;
    document.getElementById("statTotal").innerText = `${totalSpentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
    
    const remainingOfficeBudget = appState.settings.monthlyBudget - totalSpentThisMonth;
    const statBudgetElement = document.getElementById("statBudget");
    statBudgetElement.innerText = `${remainingOfficeBudget.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
    statBudgetElement.style.color = remainingOfficeBudget < 2000 ? "var(--danger)" : "var(--success)";

    // เรนเดอร์ตารางสรุปงบประมาณและตรวจสอบโควตา
    renderBudgetQuotaTable(currentMonthStr);
}

function renderBudgetQuotaTable(currentMonthStr) {
    const tbody = document.getElementById("budgetLimitTableBody");
    tbody.innerHTML = "";

    const userGroup = appState.settings.group;

    Object.keys(BUDGET_RULES).forEach(key => {
        const rule = BUDGET_RULES[key];
        
        // คำนวณเงินอนุมัติสูงสุดต่อครั้ง
        let limitPerRequestText = "-";
        if (rule.limitPerRequest) {
            if (typeof rule.limitPerRequest === "object") {
                limitPerRequestText = `รถยนต์: ${rule.limitPerRequest.car.toLocaleString()}฿ / จยย.: ${rule.limitPerRequest.bike.toLocaleString()}฿`;
            } else {
                limitPerRequestText = `${rule.limitPerRequest.toLocaleString()} ฿`;
            }
        }

        // คำนวณเงินสูงสุดรวมต่อเดือน
        let monthlyLimit = 0;
        let limitPerMonthText = "-";
        if (rule.limitPerMonth) {
            if (typeof rule.limitPerMonth === "object") {
                monthlyLimit = rule.limitPerMonth[userGroup];
                limitPerMonthText = `${monthlyLimit.toLocaleString()} ฿ (กลุ่มที่ทำการ)`;
            } else {
                monthlyLimit = rule.limitPerMonth;
                limitPerMonthText = `${monthlyLimit.toLocaleString()} ฿`;
            }
        }

        // ค้นหาการใช้จ่ายจริงเดือนนี้ในหมวดนี้
        const spentThisMonth = appState.documents
            .filter(doc => doc.docDate.startsWith(currentMonthStr) && doc.itemCategory === key)
            .reduce((sum, doc) => sum + doc.total, 0);

        const remaining = monthlyLimit ? (monthlyLimit - spentThisMonth) : Infinity;
        let remainingText = remaining === Infinity ? "ไม่จำกัดงบรายเดือน" : `${remaining.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
        
        let statusBadge = `<span style="color:var(--success); font-weight:600;">พร้อมใช้งาน</span>`;
        if (remaining <= 0 && remaining !== Infinity) {
            statusBadge = `<span style="color:var(--danger); font-weight:600;">เต็มวงเงินแล้ว</span>`;
        } else if (remaining < 1000 && remaining !== Infinity) {
            statusBadge = `<span style="color:var(--warning); font-weight:600;">ใกล้เต็ม</span>`;
        }

        const row = `
            <tr>
                <td style="font-weight:600;">${rule.name} <span style="font-size:0.75rem; color:var(--text-secondary); display:block;">รหัสบัญชี: ${rule.code}</span></td>
                <td>${limitPerRequestText}</td>
                <td>${limitPerMonthText}</td>
                <td style="font-weight:500;">${spentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td style="font-weight:600; color: ${remaining <= 0 ? 'var(--danger)' : 'inherit'}">${remainingText}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function handleTableInput(e) {
    if (e.target.classList.contains("item-price") || e.target.classList.contains("item-qty")) {
        calculateFormTotal();
    }
    
    // ระบบ Auto-complete เมื่อคีย์ชื่อวัสดุแล้วดึงข้อมูล ซื้อ/จ้าง ครั้งล่าสุด
    if (e.target.classList.contains("item-name")) {
        const inputName = e.target.value.trim();
        const row = e.target.closest("tr");
        
        if (inputName.length > 1) {
            // 1. ค้นหาจากประวัติคลังสินค้า (Inventory) ก่อน
            const matchedInv = appState.inventory
                .filter(item => item.name.toLowerCase().includes(inputName.toLowerCase()) && item.action === "receive")
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // ล่าสุดขึ้นก่อน
                
            if (matchedInv.length > 0) {
                const latest = matchedInv[0];
                row.querySelector(".item-last-date").value = latest.date;
                row.querySelector(".item-last-qty").value = latest.qty;
                // คำนวณหาค่าเฉลี่ยหรือสืบค้นราคาจากเอกสารขอซื้อ (Doc) หากมี
                const matchedDoc = appState.documents.find(d => d.items.some(i => i.name === latest.name));
                if (matchedDoc) {
                    const docItem = matchedDoc.items.find(i => i.name === latest.name);
                    row.querySelector(".item-last-price").value = docItem.price;
                }
                return;
            }
            
            // 2. ค้นหาจากประวัติเอกสาร บสค.60 เก่า (Documents)
            const matchedDocItem = [];
            appState.documents.forEach(doc => {
                doc.items.forEach(item => {
                    if (item.name.toLowerCase().includes(inputName.toLowerCase())) {
                        matchedDocItem.push({
                            date: doc.docDate,
                            qty: item.qty,
                            price: item.price
                        });
                    }
                });
            });
            
            if (matchedDocItem.length > 0) {
                matchedDocItem.sort((a, b) => new Date(b.date) - new Date(a.date));
                const latest = matchedDocItem[0];
                row.querySelector(".item-last-date").value = latest.date;
                row.querySelector(".item-last-qty").value = latest.qty;
                row.querySelector(".item-last-price").value = latest.price;
            }
        }
    }
}

function addFormItemRow() {
    const tbody = document.getElementById("formItemsTableBody");
    const rowCount = tbody.querySelectorAll("tr").length + 1;
    const newRow = `
        <tr>
            <td style="text-align: center;">${rowCount}</td>
            <td><input type="text" class="item-name" placeholder="ระบุรายละเอียดสิ่งของ/บริการ" required></td>
            <td><input type="date" class="item-last-date" style="padding: 0.5rem;"></td>
            <td><input type="number" class="item-last-qty" placeholder="จำนวน" style="text-align: center; padding: 0.5rem;"></td>
            <td><input type="number" class="item-last-price" placeholder="0.00" min="0" step="0.01" style="text-align: right; padding: 0.5rem;"></td>
            <td><input type="number" class="item-qty" value="1" min="1" required style="text-align: center; padding: 0.5rem;"></td>
            <td><input type="number" class="item-price" placeholder="0.00" min="0" step="0.01" required style="text-align: right; padding: 0.5rem;"></td>
            <td style="text-align: center;">
                <button type="button" class="btn-icon btn-danger remove-row-btn" style="width:30px; height:30px; margin: auto;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                </button>
            </td>
        </tr>
    `;
    tbody.insertAdjacentHTML("beforeend", newRow);
    
    // ผูก Event ปุ่มลบแถว
    const rows = tbody.querySelectorAll("tr");
    rows[rows.length - 1].querySelector(".remove-row-btn").addEventListener("click", (e) => {
        e.currentTarget.closest("tr").remove();
        reindexFormTable();
        calculateFormTotal();
    });
    
    calculateFormTotal();
}



function reindexFormTable() {
    const rows = document.querySelectorAll("#formItemsTableBody tr");
    rows.forEach((row, i) => {
        row.querySelector("td:first-child").innerText = i + 1;
    });
}

function calculateFormTotal() {
    const rows = document.querySelectorAll("#formItemsTableBody tr");
    let total = 0;
    
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        total += qty * price;
    });

    document.getElementById("formTotalDisplay").innerText = `${total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
    document.getElementById("thaiBahtText").innerText = `(${arabicToThaiBaht(total)})`;
    
    // ตรวจสอบเงื่อนไขการใช้วงเงินเรียลไทม์
    checkQuotaLimits();
}

function checkQuotaLimits() {
    const category = document.getElementById("itemCategory").value;
    if (!category) return;

    const rows = document.querySelectorAll("#formItemsTableBody tr");
    let total = 0;
    rows.forEach(row => {
        const qty = parseFloat(row.querySelector(".item-qty").value) || 0;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        total += qty * price;
    });

    const rule = BUDGET_RULES[category];
    const group = appState.settings.group;
    let isOverLimit = false;
    let message = "";

    // 1. ตรวจสอบวงเงินต่อครั้ง
    if (rule.limitPerRequest) {
        if (typeof rule.limitPerRequest === "object") {
            // หมวดยานพาหนะ (ตรวจสอบตามประเภทที่กำหนดเป็นคู่มือ)
            message = `กรุณาตรวจสอบว่ายอดจัดซื้อจัดจ้างรายคันไม่เกินวงเงินอนุมัติครั้งละ (รถยนต์ 15,000฿ / จยย. 3,000฿)`;
            // ตรวจสอบกับชนิดวัสดุและบล็อคถ้าเกินกรณีทั่วไป
        } else if (total > rule.limitPerRequest) {
            isOverLimit = true;
            message = `การขอซื้อ/จ้างรายการนี้เกินขีดจำกัดอนุมัติสูงสุดครั้งละ ${rule.limitPerRequest.toLocaleString()} บาทตามคำสั่ง ปณท ที่ 4/2566`;
        }
    }

    // 2. ตรวจสอบวงเงินสูงสุดต่อเดือน
    if (rule.limitPerMonth && !isOverLimit) {
        let monthlyLimit = typeof rule.limitPerMonth === "object" ? rule.limitPerMonth[group] : rule.limitPerMonth;
        const currentMonthStr = document.getElementById("docDate").value.substring(0, 7);
        const spentThisMonth = appState.documents
            .filter(doc => doc.docDate.startsWith(currentMonthStr) && doc.itemCategory === category)
            .reduce((sum, doc) => sum + doc.total, 0);

        if (spentThisMonth + total > monthlyLimit) {
            isOverLimit = true;
            message = `งบประมาณรายเดือนรวมของหมวดนี้สะสมในเดือนปัจจุบันเกินขีดจำกัดอนุมัติสูงสุดต่อเดือนที่ ${monthlyLimit.toLocaleString()} บาท`;
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
        saveDocBtn.innerHTML = `<span class="material-symbols-outlined">save</span> บันทึกคำขออนุมัติ`;
    }
}
// 6. ระบบบันทึก บสค. 60 และบันทึกประวัติย้อนหลัง
function handleBskSubmit(e) {
    e.preventDefault();
    
    const category = document.getElementById("itemCategory").value;
    if (!category) {
        alert("กรุณาเลือกประเภทวัสดุสิ้นเปลือง/บริการด้วยครับ");
        return;
    }

    const docDate = document.getElementById("docDate").value;
    const officeName = document.getElementById("officeName").value;
    const officePhone = document.getElementById("officePhone").value;
    const docNumber = document.getElementById("docNumber").value;
    const hasQuotation = document.querySelector('input[name="hasQuotation"]:checked').value;
    
    // โหลดรายละเอียดตาราง
    const items = [];
    let total = 0;
    const rows = document.querySelectorAll("#formItemsTableBody tr");
    rows.forEach(row => {
        const name = row.querySelector(".item-name").value;
        const lastDate = row.querySelector(".item-last-date").value;
        const lastQty = row.querySelector(".item-last-qty").value;
        const lastPrice = row.querySelector(".item-last-price").value;
        const qty = parseFloat(row.querySelector(".item-qty").value) || 1;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        
        items.push({ 
            name, 
            lastDate, 
            lastQty, 
            lastPrice, 
            qty, 
            price 
        });
        total += qty * price;
    });

    const requesterName = document.getElementById("requesterName").value;
    const requesterPosition = document.getElementById("requesterPosition").value;

    const newDoc = {
        id: "DOC-" + Date.now(),
        docNumber,
        docDate,
        officeName,
        officePhone,
        itemCategory: category,
        hasQuotation,
        items,
        total,
        requesterName,
        requesterPosition
    };

    appState.documents.push(newDoc);
    saveDataToStorage();

    alert("บันทึกข้อมูลขออนุมัติ บสค. 60 สำเร็จแล้ว!");
    
    // รีเซ็ตฟอร์ม
    document.getElementById("bskForm").reset();
    document.getElementById("formItemsTableBody").innerHTML = `
        <tr>
            <td style="text-align: center;">1</td>
            <td><input type="text" class="item-name" placeholder="ระบุรายละเอียดสิ่งของ/บริการ" required></td>
            <td><input type="date" class="item-last-date" style="padding: 0.5rem;"></td>
            <td><input type="number" class="item-last-qty" placeholder="จำนวน" style="text-align: center; padding: 0.5rem;"></td>
            <td><input type="number" class="item-last-price" placeholder="0.00" min="0" step="0.01" style="text-align: right; padding: 0.5rem;"></td>
            <td><input type="number" class="item-qty" value="1" min="1" required style="text-align: center; padding: 0.5rem;"></td>
            <td><input type="number" class="item-price" placeholder="0.00" min="0" step="0.01" required style="text-align: right; padding: 0.5rem;"></td>
            <td style="text-align: center;">
                <button type="button" class="btn-icon btn-danger remove-row-btn" style="width:30px; height:30px; margin: auto;">
                    <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                </button>
            </td>
        </tr>
    `;
    calculateFormTotal();
    switchTab("history");
}

function renderHistoryTable() {
    const tbody = document.getElementById("historyTableBody");
    tbody.innerHTML = "";

    if (appState.documents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">ไม่มีประวัติการบันทึกขออนุมัติ</td></tr>`;
        return;
    }

    appState.documents.forEach(doc => {
        const cat = BUDGET_RULES[doc.itemCategory];
        const dateFormatted = new Date(doc.docDate).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        const quotationBadge = doc.hasQuotation === "true" 
            ? `<span style="background:rgba(16,185,129,0.15); color:var(--success); padding:3px 8px; border-radius:12px; font-size:0.75rem;">มี</span>`
            : `<span style="background:rgba(239,68,68,0.15); color:var(--danger); padding:3px 8px; border-radius:12px; font-size:0.75rem;">ไม่มี</span>`;

        const row = `
            <tr>
                <td>บสค. 60 เลขที่ ${doc.docNumber}</td>
                <td>${dateFormatted}</td>
                <td>${cat ? cat.name : "ทั่วไป"}</td>
                <td>${quotationBadge}</td>
                <td style="font-weight:600; color:var(--thp-red);">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td>${doc.requesterName}</td>
                <td>
                    <div class="action-group" style="justify-content:center;">
                        <button class="btn btn-secondary" style="padding: 4px 10px; font-size:0.8rem;" onclick="printDocument('${doc.id}')">
                            <span class="material-symbols-outlined" style="font-size:16px;">print</span> พิมพ์
                        </button>
                        <button class="btn btn-danger" style="padding: 4px 10px; font-size:0.8rem;" onclick="deleteDocument('${doc.id}')">
                            <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ลบ
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function deleteDocument(docId) {
    if (confirm("คุณแน่ใจว่าต้องการลบเอกสารขออนุมัติชิ้นนี้ใช่ไหม?")) {
        appState.documents = appState.documents.filter(doc => doc.id !== docId);
        saveDataToStorage();
        renderHistoryTable();
    }
}

// 7. บัญชีควบคุมวัสดุ (แบบที่ 2)
function renderInventoryTable() {
    const tbody = document.getElementById("inventoryTableBody");
    tbody.innerHTML = "";

    if (appState.inventory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-secondary);">ไม่มีข้อมูลสินค้าคงเหลือคลังพัสดุ</td></tr>`;
        return;
    }

    appState.inventory.forEach(inv => {
        const dateFormatted = new Date(inv.date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        const actionText = inv.action === "receive" 
            ? `<span style="color:var(--success); font-weight:600;">+ รับเข้า (${inv.qty})</span>` 
            : `<span style="color:var(--warning); font-weight:600;">- เบิกออก (${inv.qty})</span>`;

        const row = `
            <tr>
                <td>${dateFormatted}</td>
                <td style="font-weight:600;">${inv.name}</td>
                <td>${inv.ref}</td>
                <td>${inv.action === 'receive' ? inv.qty : '-'}</td>
                <td>${inv.action === 'issue' ? inv.qty : '-'}</td>
                <td style="font-weight:600;">${inv.balance}</td>
                <td>${inv.receiver || "-"}</td>
                <td style="font-size:0.8rem; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${inv.inspectors || "-"}</td>
                <td>${inv.auditor || "-"}</td>
                <td>
                    <button class="btn-icon btn-danger" style="width:25px; height:25px;" onclick="deleteInventoryItem('${inv.id}')">
                        <span class="material-symbols-outlined" style="font-size:14px;">delete</span>
                    </button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function handleInventorySubmit(e) {
    e.preventDefault();

    const date = document.getElementById("invDate").value;
    const name = document.getElementById("invName").value;
    const ref = document.getElementById("invRef").value;
    const action = document.getElementById("invAction").value;
    const qty = parseInt(document.getElementById("invQty").value) || 1;
    const receiver = document.getElementById("invReceiver").value;
    const inspectors = document.getElementById("invInspectors").value;
    const auditor = document.getElementById("invAuditor").value;

    // คำนวณหายอดคงคลังสะสม
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
            alert(`ไม่สามารถเบิกออกได้เนื่องจากจำนวนพัสดุในคลังไม่เพียงพอ (คงคลังปัจจุบัน: ${lastBalance} หน่วย)`);
            return;
        }
        newBalance -= qty;
    }

    const newInvItem = {
        id: "INV-" + Date.now(),
        date,
        name,
        ref,
        action,
        qty,
        balance: newBalance,
        receiver,
        inspectors,
        auditor
    };

    appState.inventory.push(newInvItem);
    saveDataToStorage();

    closeModal("inventoryModal");
    document.getElementById("inventoryForm").reset();
    renderInventoryTable();
}

function deleteInventoryItem(itemId) {
    if (confirm("ต้องการลบประวัติพัสดุคลังชิ้นนี้?")) {
        appState.inventory = appState.inventory.filter(item => item.id !== itemId);
        saveDataToStorage();
        renderInventoryTable();
    }
}

// 8. สรุปรายเดือนประจำเดือน (แบบที่ 3)
function renderMonthSelectOptions() {
    const select = document.getElementById("reportMonthSelect");
    select.innerHTML = "";

    const months = {};
    appState.documents.forEach(doc => {
        const monthYear = doc.docDate.substring(0, 7); // yyyy-mm
        months[monthYear] = true;
    });

    // เพิ่มเดือนปัจจุบันลงไปด้วยเพื่อให้เลือกได้หากยังไม่มี
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
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-secondary);">ไม่มีรายการจัดซื้อจัดจ้างสำหรับเดือนนี้</td></tr>`;
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
                    <td>${item.name} <span style="font-size:0.75rem; color:var(--text-secondary); display:block;">(จำนวน ${item.qty} ชิ้น)</span></td>
                    <td>-</td>
                    <td>${cat ? cat.code : "-"}</td>
                    <td>บสค. 60 เลขที่ ${doc.docNumber}</td>
                    <td>ตามคำสั่งที่ 4/2566</td>
                    <td>${dateFormatted}</td>
                    <td>เพื่อใช้ในกิจการและปฏิบัติงาน ณ ที่ทำการ</td>
                    <td style="text-align:right; font-weight:600;">${itemTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", row);
        });
    });

    document.getElementById("monthlyReportTotal").innerText = `${grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿`;
}

// 9. การตั้งค่าระบบ
function handleSettingsSubmit(e) {
    e.preventDefault();
    appState.settings.group = document.getElementById("setGroupName").value;
    appState.settings.monthlyBudget = parseFloat(document.getElementById("setMonthlyBudget").value) || 0;
    saveDataToStorage();
    alert("บันทึกการตั้งค่าเรียบร้อยแล้ว!");
    switchTab("dashboard");
}

// 10. ระบบสำรองข้อมูลและนำเข้าข้อมูล
function exportBackupData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `THP-BergMoney-Backup-${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
}

function importBackupData(e) {
    const fileReader = new FileReader();
    fileReader.onload = function (event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (parsed.documents || parsed.inventory || parsed.settings) {
                appState = {
                    settings: parsed.settings || appState.settings,
                    documents: parsed.documents || [],
                    inventory: parsed.inventory || []
                };
                saveDataToStorage();
                alert("นำเข้าข้อมูลสำรองเรียบร้อยแล้ว!");
                initApp();
            } else {
                alert("รูปแบบไฟล์สำรองไม่ถูกต้อง");
            }
        } catch (error) {
            alert("ไม่สามารถอ่านข้อมูลสำรองได้: " + error.message);
        }
    };
    fileReader.readAsText(e.target.files[0]);
}

// 11. ฟังก์ชันพิมพ์รายงาน บสค. 60 และ สรุปรายเดือน
function printDocument(docId) {
    const doc = appState.documents.find(d => d.id === docId);
    if (!doc) return;

    const cat = BUDGET_RULES[doc.itemCategory];
    const printSection = document.getElementById("printSection");

    // เตรียมรายการสินค้า
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
            </tr>
        `;
    });

    const docDateObj = new Date(doc.docDate);
    const dateFormatted = docDateObj.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

    // สร้างลิสต์ของประเภทวัสดุทั้งหมดและทำเครื่องหมายวงกลมติ๊กเลือกตามภาพแนบ
    const catKeys = Object.keys(BUDGET_RULES);
    let categoryCheckboxesHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 15px 0; font-size: 11pt; border: 1px solid #000; padding: 12px; border-radius: 6px;">`;
    catKeys.forEach(k => {
        const isChecked = doc.itemCategory === k;
        const symbol = isChecked ? "┠ ✔ ┨" : "┠ &nbsp;&nbsp;&nbsp; ┨";
        const style = isChecked ? "font-weight: bold; color: #000;" : "color: #555;";
        categoryCheckboxesHtml += `<div style="${style}">${symbol} ${BUDGET_RULES[k].name}</div>`;
    });
    categoryCheckboxesHtml += `</div>`;

    // ประกอบโครงสร้างบันทึกข้อความแบบฟอร์ม บสค. 60 ทางราชการไปรษณีย์ไทย (กรณีหัวหน้าอนุมัติภายใต้อำนาจ ปณท ที่ 4/2566)
    printSection.innerHTML = `
        <div class="print-header">
            <svg width="80" height="40" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0H100L85 30H15L0 0Z" fill="#E31837"/>
                <path d="M15 30H85L65 65H5L15 30Z" fill="#1A3B8B"/>
                <path d="M5 65H65L55 80H0L5 65Z" fill="#2c59b6"/>
            </svg>
            <div style="text-align: right; font-weight: bold; font-size: 18pt;">บันทึกข้อความ</div>
        </div>
        <table class="memo-table">
            <tr>
                <td style="width: 15%; font-weight: bold;">หน่วยงาน:</td>
                <td style="width: 55%;">${doc.officeName} &nbsp;&nbsp; โทร. ${doc.officePhone}</td>
                <td style="width: 10%; font-weight: bold;">ที่:</td>
                <td style="width: 20%;">${doc.docNumber || "-"}</td>
            </tr>
            <tr>
                <td style="font-weight: bold;">วันที่:</td>
                <td colspan="3">${dateFormatted}</td>
            </tr>
            <tr>
                <td style="font-weight: bold;">เรื่อง:</td>
                <td colspan="3">ขอความเห็นชอบการจัดซื้อ/จัดจ้าง (ที่มอบอำนาจการซื้อและการจ้างตามคำสั่ง ปณท ที่ 4/2566)</td>
            </tr>
            <tr>
                <td style="font-weight: bold;">เรียน:</td>
                <td colspan="3">ฝปข.2</td>
            </tr>
        </table>
        
        <p style="text-indent: 1.5cm; margin-bottom: 10px;">
            ด้วย <b>${doc.officeName}</b> มีความจำเป็นต้องการจัดซื้อและจัดจ้างพัสดุบางประเภท (ที่มอบอำนาจการซื้อและการจ้างตามคำสั่ง ปณท ที่ 4/2566) ดังนี้:
        </p>

        ${categoryCheckboxesHtml}

        <div style="display: flex; gap: 20px; margin-bottom: 10px; font-weight: bold;">
            <span>[ ${doc.hasQuotation === 'true' ? '✔' : '&nbsp;&nbsp;'} ] มีใบเสนอราคา</span>
            <span>[ ${doc.hasQuotation === 'false' ? '✔' : '&nbsp;&nbsp;'} ] ไม่มีใบเสนอราคา</span>
        </div>

        <table class="item-table" style="font-size: 11pt;">
            <thead>
                <tr>
                    <th rowspan="2" style="width: 5%; vertical-align: middle;">ลำดับ</th>
                    <th rowspan="2" style="vertical-align: middle;">รายการที่จัดซื้อ/จัดจ้าง</th>
                    <th colspan="3">ซื้อ/จ้าง ครั้งล่าสุด</th>
                    <th colspan="2">ซื้อ/จ้าง ครั้งนี้</th>
                </tr>
                <tr>
                    <th style="font-size: 9pt;">ว.ด.ป.</th>
                    <th style="font-size: 9pt;">จำนวน/ปริมาณ</th>
                    <th style="font-size: 9pt;">จำนวนเงิน (บาท)</th>
                    <th style="font-size: 9pt;">จำนวน/ปริมาณ</th>
                    <th style="font-size: 9pt;">จำนวนเงิน (บาท)</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRowsHtml}
                <tr>
                    <td colspan="6" style="text-align: right; font-weight: bold;">รวมเงินเป็นทั้งสิ้น</td>
                    <td style="text-align: right; font-weight: bold;">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td colspan="7" style="text-align: center; font-style: italic;">(${arabicToThaiBaht(doc.total)})</td>
                </tr>
            </tbody>
        </table>

        <p style="text-indent: 1.5cm; margin-bottom: 25px;">
            จึงเรียนมาเพื่อโปรดพิจารณาอนุญาต หากเห็นชอบจักได้ดำเนินการตามที่ ปณท มอบอำนาจการซื้อและการจ้างไว้ให้ต่อไป จักขอบคุณยิ่ง
        </p>

        <div class="signature-section">
            <div class="sig-block" style="margin-left: auto;">
                <p style="margin-bottom: 40px;">ลงชื่อ..............................................................</p>
                <p style="font-weight: bold;">(${doc.requesterName})</p>
                <p>${doc.requesterPosition}</p>
            </div>
        </div>
    `;

    // เรียกพิมพ์ในระดับเบราว์เซอร์
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
                    <td>เพื่อใช้ในงานทำการ</td>
                    <td style="text-align: right;">${itemTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
            `;
        });
    });

    // ออกแบบตาราง บัญชีสรุปรายการซื้อและการจ้างประจำเดือน (แบบที่ 3) ของ ปณท
    printSection.innerHTML = `
        <div class="print-header">
            <svg width="80" height="40" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0H100L85 30H15L0 0Z" fill="#E31837"/>
                <path d="M15 30H85L65 65H5L15 30Z" fill="#1A3B8B"/>
                <path d="M5 65H65L55 80H0L5 65Z" fill="#2c59b6"/>
            </svg>
            <div style="text-align: right; font-weight: bold; font-size: 16pt;">แบบที่ 3</div>
        </div>
        <h2 class="print-title">บัญชีสรุปรายการซื้อและการจ้างประจำเดือน</h2>
        <div style="text-align: center; margin-bottom: 20px; font-size: 14pt;">
            ที่ทำการ: <b>ที่ทำการไปรษณีย์มาบตาพุด</b>ประจำเดือน <b>${thaiMonthText}</b>
        </div>
        
        <table class="item-table" style="font-size: 11pt;">
            <thead>
                <tr>
                    <th>ลำดับ</th>
                    <th>รายการ</th>
                    <th>รหัสครุภัณฑ์</th>
                    <th>รหัสบัญชี</th>
                    <th>เลขที่ บสค.60</th>
                    <th>คำสั่งอนุมัติ</th>
                    <th>ว.ด.ป.</th>
                    <th>เหตุผลความจำเป็น</th>
                    <th>จำนวนเงิน (บาท)</th>
                </tr>
            </thead>
            <tbody>
                ${reportRowsHtml}
                <tr>
                    <td colspan="8" style="text-align: right; font-weight: bold;">รวมเงินทั้งสิ้น</td>
                    <td style="text-align: right; font-weight: bold;">${grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        <div class="signature-section">
            <div class="sig-block" style="margin-left: auto;">
                <p style="margin-bottom: 40px;">ลงชื่อ..............................................................</p>
                <p style="font-weight: bold;">(นายนิพล ทรัพย์หมื่นแสน)</p>
                <p>หัวหน้าที่ทำการไปรษณีย์มาบตาพุด</p>
            </div>
        </div>
    `;

    window.print();
}

// 12. ฟังก์ชันเสริมช่วยเหลือ
function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

// แปลงเลขอารบิกเป็นตัวเงินภาษาไทย
function arabicToThaiBaht(num) {
    if (num === 0) return "ศูนย์บาทถ้วน";
    const textNumber = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const textDigit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    
    let parts = num.toFixed(2).split(".");
    let integerPart = parts[0];
    let decimalPart = parts[1];

    let result = "";

    // จัดการจำนวนเต็ม
    if (parseInt(integerPart) > 0) {
        let length = integerPart.length;
        for (let i = 0; i < length; i++) {
            let digit = parseInt(integerPart.charAt(i));
            if (digit !== 0) {
                // คำนวณหลักหน่วยและหลักสิบพิเศษ
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

    // จัดการทศนิยม
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
