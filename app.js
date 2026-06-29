// ----------------------------------------------------
// ระบบจัดซื้อจัดจ้าง บสค. 60 - ไปรษณีย์ไทย
// สคริปต์หลักควบคุมการคำนวณและประมวลผล LocalStorage
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
        officeName: "ที่ทำการไปรษณีย์มาบตาพุด",
        officerName: "นายนิพล ทรัพย์หมื่นแสน",
        officerPosition: "หน.ปณ.มาบตาพุด",
        customLimits: {}
    },
    documents: [],
    inventory: []
};

// โหลดข้อมูลเริ่มต้นของแอปพลิเคชัน
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventHandlers();
    switchTab("dashboard");
});

function initApp() {
    const savedData = localStorage.getItem("thp_bergmoney_data");
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.settings) {
                appState.settings = parsed.settings;
                if (!appState.settings.customLimits) {
                    appState.settings.customLimits = {};
                }
                if (!appState.settings.officeName) appState.settings.officeName = "ที่ทำการไปรษณีย์มาบตาพุด";
                if (!appState.settings.officerName) appState.settings.officerName = "นายนิพล ทรัพย์หมื่นแสน";
                if (!appState.settings.officerPosition) appState.settings.officerPosition = "หน.ปณ.มาบตาพุด";
            }
            if (parsed.documents) appState.documents = parsed.documents;
            if (parsed.inventory) appState.inventory = parsed.inventory;
            if (parsed.durables) appState.durables = parsed.durables;
        } catch (e) {
            console.error("Error loading localStorage data", e);
        }
    } else {
        appState.durables = [
            { id: "CUR-001", code: "51090902-001", name: "กระดาษ A4 Double A 80g", category: "stationery", qty: 10, remark: "ใช้ประจำสำนักงาน" }
        ];
        // จำลองข้อมูลเพื่อความสวยงามในครั้งแรก
        appState.documents = [
            {
                id: "DOC-20260601",
                memoNumber: "85/2566",
                bskNumber: "123/2566",
                docDate: "2026-06-01",
                officeName: "ที่ทำการไปรษณีย์มาบตาพุด",
                officePhone: "088-987-8635",
                itemCategory: "stationery",
                hasQuotation: "true",
                items: [
                    { name: "กระดาษ A4 Double A 80g", lastDate: "2026-05-12", lastQty: 10, lastPrice: 135, qty: 10, price: 135 }
                ],
                total: 1350,
                requesterName: "นายนิพล ทรัพย์หมื่นแสน",
                requesterPosition: "หน.ปณ.มาบตาพุด",
                orderAuthority: "ตามคำสั่งที่ 4/2566",
                necessityReason: "เพื่อใช้ในงานปฏิบัติงาน"
            }
        ];
        
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
            }
        ];
        saveDataToStorage();
    }

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

    if (!appState.durables) {
        appState.durables = [
            { id: "CUR-001", code: "51090902-001", name: "กระดาษ A4 Double A 80g", category: "stationery", qty: 10, remark: "ใช้ประจำสำนักงาน" }
        ];
        saveDataToStorage();
    }

    renderLimitsSettingsTable();
    updateUIElements();
    
    // เชื่อมฟังก์ชัน Auto-suggest ช่องแรกเริ่มต้น
    bindAutoSuggest(document.querySelector("#formTableBody tr"));
}

function saveDataToStorage() {
    localStorage.setItem("thp_bergmoney_data", JSON.stringify(appState));
}

// ----------------------------------------------------
// ระบบผูก Event และ Action
// ----------------------------------------------------
function setupEventHandlers() {
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
        "inventory": "จัดการทะเบียนข้อมูลครุภัณฑ์",
        "monthly-report": "สรุปรายการซื้อและการจ้างประจำเดือน (แบบที่ 3)",
        "settings": "ตั้งค่าข้อมูลที่ทำการไปรษณีย์และรหัสหน่วยงาน"
    };
    document.getElementById("pageTitleText").innerText = titles[tabId] || "ระบบเบิกเงิน";

    if (tabId === "dashboard") {
        updateUIElements();
    } else if (tabId === "history") {
        renderHistoryTable();
    } else if (tabId === "inventory") {
        renderDurableTable();
    } else if (tabId === "monthly-report") {
        renderMonthlyReportTable();
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
// ระบบบันทึก บสค. 60 และคลังพัสดุ
// ----------------------------------------------------
function handleBskSubmit(e) {
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
        const lastDate = row.querySelector(".item-last-date").value;
        const lastQty = row.querySelector(".item-last-qty").value;
        const lastPrice = row.querySelector(".item-last-price").value;
        const qty = parseFloat(row.querySelector(".item-qty").value) || 1;
        const price = parseFloat(row.querySelector(".item-price").value) || 0;
        
        items.push({ name, durableCode, lastDate, lastQty, lastPrice, qty, price });
        total += qty * price;
    });

    const requesterName = document.getElementById("requesterName").value;
    const requesterPosition = document.getElementById("requesterPosition").value;

    const newDoc = {
        id: "DOC-" + Date.now(),
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
        necessityReason
    };

    // Auto-update durable stock quantity
    if (appState.durables && appState.durables.length > 0) {
        items.forEach(item => {
            if (item.durableCode) {
                const durable = appState.durables.find(d => d.code === item.durableCode);
                if (durable) {
                    durable.qty = (durable.qty || 0) + (parseInt(item.qty) || 0);
                }
            } else if (item.name) {
                const durable = appState.durables.find(d => d.name.trim().toLowerCase() === item.name.trim().toLowerCase());
                if (durable) {
                    durable.qty = (durable.qty || 0) + (parseInt(item.qty) || 0);
                }
            }
        });
        renderDurableTable();
    }

    appState.documents.push(newDoc);
    saveDataToStorage();

    alert("บันทึกข้อมูลคำขอจัดซื้อจัดจ้าง บสค. 60 เรียบร้อย!");
    
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
}

function renderDurableTable() {
    const tbody = document.getElementById("durableTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (appState.durables.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">ไม่มีข้อมูลทะเบียนครุภัณฑ์</td></tr>`;
        return;
    }

    appState.durables.forEach(d => {
        const cat = BUDGET_RULES[d.category];
        const catName = cat ? cat.name : "-";
        const qtyVal = typeof d.qty !== 'undefined' ? d.qty : 0;
        const row = `
            <tr>
                <td style="font-weight:600;">${d.code}</td>
                <td>${d.name}</td>
                <td>${catName}</td>
                <td style="text-align:center;">${qtyVal}</td>
                <td>${d.remark || "-"}</td>
                <td>
                    <div style="display:flex; gap:0.5rem; justify-content:center;">
                        <button class="btn btn-secondary" style="padding: 4px 10px; font-size:0.8rem;" onclick="editDurable('${d.id}')">
                            <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                        </button>
                        <button class="btn btn-danger" style="padding: 4px 10px; font-size:0.8rem;" onclick="deleteDurable('${d.id}')">
                            <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", row);
    });
}

function handleDurableSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("durableId").value;
    const code = document.getElementById("durableCode").value.trim();
    const name = document.getElementById("durableName").value.trim();
    const category = document.getElementById("durableCategory").value;
    const qty = parseInt(document.getElementById("durableQty").value) || 0;
    const remark = document.getElementById("durableRemark").value.trim();

    if (id) {
        // Edit mode
        const durable = appState.durables.find(d => d.id === id);
        if (durable) {
            durable.code = code;
            durable.name = name;
            durable.category = category;
            durable.qty = qty;
            durable.remark = remark;
        }
    } else {
        // Add mode
        const newDurable = {
            id: "CUR-" + Date.now(),
            code,
            name,
            category,
            qty,
            remark
        };
        appState.durables.push(newDurable);
    }

    saveDataToStorage();
    closeModal("durableModal");
    renderDurableTable();
}

window.editDurable = function(id) {
    const d = appState.durables.find(item => item.id === id);
    if (!d) return;

    document.getElementById("durableId").value = d.id;
    document.getElementById("durableCode").value = d.code;
    document.getElementById("durableName").value = d.name;
    document.getElementById("durableCategory").value = d.category;
    document.getElementById("durableQty").value = typeof d.qty !== 'undefined' ? d.qty : 0;
    document.getElementById("durableRemark").value = d.remark || "";
    
    document.getElementById("durableModalTitle").innerText = "แก้ไขข้อมูลครุภัณฑ์";
    openModal("durableModal");
};

window.deleteDurable = function(id) {
    if (confirm("คุณต้องการลบครุภัณฑ์รายการนี้?")) {
        appState.durables = appState.durables.filter(item => item.id !== id);
        saveDataToStorage();
        renderDurableTable();
    }
};

// ----------------------------------------------------
// รายงานสรุปผลสถิติและประวัติขออนุมัติ
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
            ? `<span style="background-color:rgba(16,185,129,0.15); color:var(--success); padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">มี</span>`
            : `<span style="background-color:rgba(239,68,68,0.15); color:#EF4444; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">ไม่มี</span>`;

        const row = `
            <tr>
                <td style="font-weight:600;">
                    บสค. 60 เลขที่ ${doc.bskNumber || doc.docNumber || "-"}
                    <br>
                    <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary);">
                        บันทึกข้อความ เลขที่: ${doc.memoNumber || "-"}
                    </span>
                </td>
                <td>${dateFormatted}</td>
                <td>${cat ? cat.name : "ทั่วไป"}</td>
                <td>${quotationBadge}</td>
                <td style="font-weight:700; color:var(--thp-red);">${doc.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} ฿</td>
                <td>${doc.requesterName}</td>
                <td>
                    <div style="display:flex; gap:0.5rem; justify-content:center;">
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
    if (confirm("ลบประวัติใบขออนุมัตินี้ออกจากฐานข้อมูล?")) {
        const docToDelete = appState.documents.find(doc => doc.id === docId);
        if (docToDelete && docToDelete.items && appState.durables && appState.durables.length > 0) {
            docToDelete.items.forEach(item => {
                if (item.durableCode) {
                    const durable = appState.durables.find(d => d.code === item.durableCode);
                    if (durable) {
                        durable.qty = Math.max(0, (durable.qty || 0) - (parseInt(item.qty) || 0));
                    }
                } else if (item.name) {
                    const durable = appState.durables.find(d => d.name.trim().toLowerCase() === item.name.trim().toLowerCase());
                    if (durable) {
                        durable.qty = Math.max(0, (durable.qty || 0) - (parseInt(item.qty) || 0));
                    }
                }
            });
        }
        appState.documents = appState.documents.filter(doc => doc.id !== docId);
        saveDataToStorage();
        renderHistoryTable();
        renderDurableTable();
    }
}

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
    let categoryCheckboxesHtml = `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin: 10px 0; font-size: 10pt; border: 1px solid #000000; padding: 10px 14px; border-radius: 4px; line-height: 1.35;">`;
    catKeys.forEach(k => {
        const isChecked = doc.itemCategory === k;
        const symbol = isChecked ? "[ ✓ ]" : "[ &nbsp; ]";
        const style = isChecked ? "font-weight: bold; color: #000000;" : "color: #000000;";
        categoryCheckboxesHtml += `<div style="${style}">${symbol} ${BUDGET_RULES[k].name}</div>`;
    });
    categoryCheckboxesHtml += `</div>`;

    // ตารางแสดงเฉพาะรายการที่มีข้อมูลจริงโดยไม่เผื่อแถวว่างเพิ่มเติมตามที่ผู้ใช้ร้องขอ

    printSection.innerHTML = `
        <div class="print-header" style="position: relative; display: flex; align-items: center; justify-content: center; height: 60px; border-bottom: 2px solid #000000; margin-bottom: 18px; padding-bottom: 6px;">
            <img src="thailand-post-logo.png" alt="ไปรษณีย์ไทย" class="print-logo" style="height: 48px; object-fit: contain; position: absolute; left: 0; bottom: 6px;">
            <div style="font-weight: bold; font-size: 20pt; margin-bottom: 0;">บันทึกข้อความ</div>
        </div>
        <table class="memo-table" style="font-size: 11pt; margin-bottom: 18px;">
            <tr>
                <td style="width: 15%; font-weight: bold;">หน่วยงาน:</td>
                <td colspan="3">${doc.officeName} &nbsp;&nbsp; โทร. ${doc.officePhone}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; width: 15%;">ที่:</td>
                <td style="width: 45%;">${doc.memoNumber || doc.docNumber || "-"}</td>
                <td style="width: 10%; font-weight: bold;">วันที่:</td>
                <td style="width: 30%;">${dateFormatted}</td>
            </tr>
            <tr>
                <td style="font-weight: bold; border-bottom: 1px solid #000000; padding-bottom: 6px;">เรื่อง:</td>
                <td colspan="3" style="border-bottom: 1px solid #000000; padding-bottom: 6px;">ขอความเห็นชอบการจัดซื้อ/จัดจ้าง (ที่มอบอำนาจการซื้อและการจ้าง${doc.orderAuthority || 'ตามคำสั่ง ปณท ที่ 4/2566'})</td>
            </tr>
            <tr>
                <td style="font-weight: bold; padding-top: 6px;">เรียน:</td>
                <td colspan="3" style="padding-top: 6px;">ฝปข.2</td>
            </tr>
        </table>
        
        <p style="text-indent: 1.5cm; margin-bottom: 8px; font-size: 11pt; line-height: 1.35;">
            ด้วย <b>ปณ.มาบตาพุด</b> มีความจำเป็นต้องการจัดซื้อและจัดจ้างพัสดุบางประเภท (ที่มอบอำนาจการซื้อและการจ้าง${doc.orderAuthority || 'ตามคำสั่ง ปณท ที่ 4/2566'}) ดังนี้:
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
    const monthlyDocs = appState.documents.filter(doc => doc.docDate.startsWith(selectedMonth));

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

function handleSettingsSubmit(e) {
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
    
    saveDataToStorage();
    alert("บันทึกการตั้งค่าระบบเรียบร้อยแล้ว!");
    
    // อัปเดตข้อมูล UI และแดชบอร์ดตามค่าวงเงินใหม่
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
                alert("นำเข้าข้อมูลสำรองเข้าระบบแล้ว!");
                initApp();
            } else {
                alert("รูปแบบไฟล์สะสมไม่ถูกต้อง");
            }
        } catch (error) {
            alert("ไม่สามารถอ่านข้อมูลได้: " + error.message);
        }
    };
    fileReader.readAsText(e.target.files[0]);
}

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
        
        // Get limit value or blank string
        const reqLimit = custom.limitPerRequest !== undefined ? custom.limitPerRequest : "";
        const monthLimit = custom.limitPerMonth !== undefined ? custom.limitPerMonth : "";
        
        // Set placeholder showing default limit
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

function importDurablesCSV(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
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
                updateCount++;
            } else {
                appState.durables.push({
                    id: "CUR-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                    code,
                    name,
                    category,
                    qty,
                    remark
                });
                importCount++;
            }
        }

        saveDataToStorage();
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
