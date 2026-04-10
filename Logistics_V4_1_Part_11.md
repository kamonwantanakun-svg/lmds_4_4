# 🚛 Logistics Master Data System V4.1 - Part 1/3

## 🛠️ ขั้นตอนการอัปเกรดจาก V4.0 เป็น V4.1

1. **Backup**: สำรองข้อมูลใน Google Sheets เดิมก่อนเริ่มดำเนินการ
2. **Update Code**: นำโค้ดจากทั้ง 3 ส่วนนี้ไปวางทับโค้ดเดิมใน Google Apps Script
3. **API Key Check**: ตรวจสอบ API Key ใน `Setup_Security.gs` (V4.1 ต้องการ Key ที่ขึ้นต้นด้วย AIza และยาวกว่า 30 ตัวอักษร)
4. **System Integrity**: รันฟังก์ชัน `CONFIG.validateSystemIntegrity()` เพื่อตรวจสอบความพร้อม

### 📄 ไฟล์: Config.gs
```javascript
/**
 * VERSION: 001
 * 🚛 Logistics Master Data System - Configuration V4.0 (Enterprise Edition)
 * ------------------------------------------------------------------
 * [PRESERVED]: โครงสร้างเดิมคอลัมน์ A-Q ทั้งหมดได้รับการรักษาไว้ (Preservation Protocol)
 * [ADDED v4.0]: กำหนดคอลัมน์ NameMapping สำหรับ 5-Tier AI Resolution
 * [MODIFIED v4.0]: อัปเกรด AI_MODEL เป็นเวอร์ชันล่าสุดเพื่อความเสถียร
 * [MODIFIED v4.0]: อัปเกรดระบบ Logging เป็น console.log/error สำหรับ GCP Monitoring
 * Author: Elite Logistics Architect
 */


var CONFIG = {
  // --- SHEET NAMES ---
  SHEET_NAME: "Database",
  MAPPING_SHEET: "NameMapping",
  SOURCE_SHEET: "SCGนครหลวงJWDภูมิภาค",
  SHEET_POSTAL: "PostalRef", // สำคัญ: ใช้สำหรับ Service_GeoAddr ในการแกะที่อยู่ Offline [12]


  // --- 🧠 AI CONFIGURATION (SECURED) ---
  // วิธีตั้งค่า: รันฟังก์ชัน setupEnvironment() ในไฟล์ Setup_Security.gs [10]
  get GEMINI_API_KEY() {
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) throw new Error("CRITICAL ERROR: GEMINI_API_KEY is not set. Please run setupEnvironment() first.");
    return key;
  },
  USE_AI_AUTO_FIX: true,
  AI_MODEL: "gemini-1.5-flash", // แนะนำรุ่นมาตรฐานเพื่อความเสถียรของ Response Mime Type [6]
  AI_BATCH_SIZE: 20, // จำกัดจำนวนส่งให้ AI ครั้งละ 20 รายการเพื่อไม่ให้เกิน 6 นาที [10]


  // --- 🔴 DEPOT LOCATION (จุดเริ่มต้นคำนวณระยะทาง) ---
  DEPOT_LAT: 14.164688,
  DEPOT_LNG: 100.625354,


  // --- SYSTEM THRESHOLDS & LIMITS ---
  DISTANCE_THRESHOLD_KM: 0.05, // 50 เมตร สำหรับการจัดกลุ่ม (Clustering) [13]
  BATCH_LIMIT: 50,             // โควตา Geocoding ต่อรอบ
  DEEP_CLEAN_LIMIT: 100,       // จำนวนแถวที่ตรวจสอบความสมบูรณ์ต่อรอบ [14]
  API_MAX_RETRIES: 3,          // จำนวนครั้งที่จะลองใหม่ถ้า API ภายนอกล่ม
  API_TIMEOUT_MS: 30000,       // 30 วินาที
  CACHE_EXPIRATION: 21600,     // 6 ชั่วโมง (สำหรับผลลัพธ์ Google Maps) [14]


  // --- ⚠️ SACRED SCHEMA: DATABASE COLUMNS INDEX (1-BASED) ---
  // ห้ามขยับคอลัมน์ A-Q (1-17) โดยเด็ดขาด [14]-[15]
  COL_NAME: 1,       // A: ชื่อลูกค้า
  COL_LAT: 2,        // B: Latitude
  COL_LNG: 3,        // C: Longitude
  COL_SUGGESTED: 4,  // D: ชื่อที่ระบบแนะนำ (AI/Human)
  COL_CONFIDENCE: 5, // E: คะแนนความมั่นใจ
  COL_NORMALIZED: 6, // F: ชื่อที่ทำ Cleansing และ Keyword สำหรับค้นหา
  COL_VERIFIED: 7,   // G: สถานะตรวจสอบ (Checkbox)
  COL_SYS_ADDR: 8,   // H: ที่อยู่จากระบบต้นทาง
  COL_ADDR_GOOG: 9,  // I: ที่อยู่ยืนยันจาก Google Maps
  COL_DIST_KM: 10,   // J: ระยะทางจากคลัง (กม.)
  COL_UUID: 11,      // K: รหัสประจำตัว (Primary Key)
  COL_PROVINCE: 12,  // L: จังหวัด
  COL_DISTRICT: 13,  // M: อำเภอ
  COL_POSTCODE: 14,  // N: รหัสไปรษณีย์
  COL_QUALITY: 15,   // O: คะแนนคุณภาพข้อมูล (0-100)
  COL_CREATED: 16,   // P: วันที่สร้าง
  COL_UPDATED: 17,   // Q: วันที่แก้ไขล่าสุด


  // --- [NEW v4.0] NAMEMAPPING COLUMNS INDEX (1-BASED) ---
  // โครงสร้าง 5-Tier สำหรับ AI Resolution [16]
  MAP_COL_VARIANT: 1,    // A: Variant_Name
  MAP_COL_UID: 2,        // B: Master_UID
  MAP_COL_CONFIDENCE: 3, // C: Confidence_Score
  MAP_COL_MAPPED_BY: 4,  // D: Mapped_By
  MAP_COL_TIMESTAMP: 5,  // E: Timestamp


  // --- DATABASE ARRAY INDEX MAPPING (0-BASED) ---
  get C_IDX() {
    return {
      NAME: this.COL_NAME - 1, LAT: this.COL_LAT - 1, LNG: this.COL_LNG - 1,
      SUGGESTED: this.COL_SUGGESTED - 1, CONFIDENCE: this.COL_CONFIDENCE - 1,
      NORMALIZED: this.COL_NORMALIZED - 1, VERIFIED: this.COL_VERIFIED - 1,
      SYS_ADDR: this.COL_SYS_ADDR - 1, GOOGLE_ADDR: this.COL_ADDR_GOOG - 1,
      DIST_KM: this.COL_DIST_KM - 1, UUID: this.COL_UUID - 1,
      PROVINCE: this.COL_PROVINCE - 1, DISTRICT: this.COL_DISTRICT - 1,
      POSTCODE: this.COL_POSTCODE - 1, QUALITY: this.COL_QUALITY - 1,
      CREATED: this.COL_CREATED - 1, UPDATED: this.COL_UPDATED - 1
    };
  },


  // --- NAMEMAPPING ARRAY INDEX (0-BASED) ---
  get MAP_IDX() {
    return {
      VARIANT: this.MAP_COL_VARIANT - 1,
      UID: this.MAP_COL_UID - 1,
      CONFIDENCE: this.MAP_COL_CONFIDENCE - 1,
      MAPPED_BY: this.MAP_COL_MAPPED_BY - 1,
      TIMESTAMP: this.MAP_COL_TIMESTAMP - 1
    };
  }
};


// --- SCG SPECIFIC CONFIG --- [17]
const SCG_CONFIG = {
  SHEET_DATA: 'Data',
  SHEET_INPUT: 'Input',
  SHEET_EMPLOYEE: 'ข้อมูลพนักงาน',
  API_URL: 'https://fsm.scgjwd.com/Monitor/SearchDelivery',
  INPUT_START_ROW: 4,
  COOKIE_CELL: 'B1',
  SHIPMENT_STRING_CELL: 'B3',
  SHEET_MASTER_DB: 'Database',
  SHEET_MAPPING: 'NameMapping',
  JSON_MAP: {
    SHIPMENT_NO: 'shipmentNo',
    CUSTOMER_NAME: 'customerName',
    DELIVERY_DATE: 'deliveryDate'
  }
};


/**
 * [ENHANCED v4.0] System Health Check
 * ตรวจสอบความพร้อมของ Sheet และ Config ก่อนเริ่มงาน [8]-[18]
 */
CONFIG.validateSystemIntegrity = function() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var errors = [];


  // 1. Check Sheets Existence
  var requiredSheets = [this.SHEET_NAME, this.MAPPING_SHEET, SCG_CONFIG.SHEET_INPUT, this.SHEET_POSTAL];
  requiredSheets.forEach(function(name) {
    if (!ss.getSheetByName(name)) errors.push("Missing Sheet: " + name);
  });


  // 2. Check API Key ความปลอดภัยสูง
  try {
    var key = this.GEMINI_API_KEY;
    if (!key || key.length < 30 || !key.startsWith("AIza")) {
      errors.push("Invalid Gemini API Key format (Must start with 'AIza' and be > 30 chars)");
    }
  } catch (e) {
    errors.push("Gemini API Key is not set in ScriptProperties. Please run setupEnvironment() first.");
  }


  // 3. Report & Monitoring
  if (errors.length > 0) {
    var msg = "⚠️ SYSTEM INTEGRITY FAILED:\n" + errors.join("\n");
    console.error(msg); 
    throw new Error(msg);
  } else {
    console.log("✅ System Integrity: OK");
    return true;
  }
};
```

---

### 📄 ไฟล์: Menu.gs
```javascript
/**
 * VERSION: 001
 * 🖥️ MODULE: Menu UI Interface (Enterprise Edition)
 * Version: 4.0 Omni-Channel Control Center
 * ---------------------------------------------------
 * [FIXED v4.1]: Dynamic UI Alert pulling exact sheet names from CONFIG.
 * [ADDED v4.0]: Integrated Schema Upgrade & Diagnostic Tools.
 * [ADDED v4.0]: Deep linking support for WebApp Search.
 * Author: Elite Logistics Architect
 */


function onOpen() {
  var ui = SpreadsheetApp.getUi();


  // =================================================================
  // 🚛 เมนูชุดที่ 1: ระบบจัดการ Master Data (Operations)
  // =================================================================
  ui.createMenu('🚛 1. ระบบจัดการ Master Data')
    .addItem('1️⃣ ดึงลูกค้าใหม่ (Sync New Data)', 'syncNewDataToMaster_UI')
    .addItem('2️⃣ เติมข้อมูลพิกัด/ที่อยู่ (ทีละ 50)', 'updateGeoData_SmartCache')
    .addItem('3️⃣ จัดกลุ่มชื่อซ้ำ (Clustering)', 'autoGenerateMasterList_Smart')
    .addItem('🧠 4️⃣ ส่งชื่อแปลกให้ AI วิเคราะห์ (Smart Resolution)', 'runAIBatchResolver_UI')
    .addSeparator()
    .addItem('🚀 5️⃣ Deep Clean (ตรวจสอบความสมบูรณ์)', 'runDeepCleanBatch_100')
    .addItem('🔄 รีเซ็ตความจำปุ่ม 5 (เริ่มแถว 2 ใหม่)', 'resetDeepCleanMemory_UI')
    .addSeparator()
    .addItem('✅ 6️⃣ จบงาน (Finalize & Move to Mapping)', 'finalizeAndClean_UI')
    .addSeparator()
    .addSubMenu(ui.createMenu('🛠️ Admin & Repair Tools')
      .addItem('🔑 สร้าง UUID ให้ครบทุกแถว', 'assignMissingUUIDs')
      .addItem('🚑 ซ่อมแซม NameMapping (L3)', 'repairNameMapping_UI')
      .addItem('🔍 ตรวจพิกัดซ้ำซ้อน (Spatial Grid)', 'findHiddenDuplicates')
    )
    .addToUi();


  // =================================================================
  // 📦 เมนูชุดที่ 2: เมนูพิเศษ SCG (Daily Operation)
  // =================================================================
  ui.createMenu('📦 2. เมนูพิเศษ SCG')
    .addItem('📥 1. โหลดข้อมูล Shipment (+E-POD)', 'fetchDataFromSCGJWD')
    .addItem('🟢 2. อัปเดตพิกัด + ข้อมูลพนักงาน', 'applyMasterCoordinatesToDailyJob')
    .addSeparator()
    .addItem('📊 3. สร้างสรุปแยกตามเจ้าของสินค้า', 'buildOwnerSummary')
    .addItem('🚛 4. สร้างสรุปแยกตาม Shipment/รถ', 'buildShipmentSummary')
    .addSeparator()
    .addSubMenu(ui.createMenu('🧹 เมนูล้างข้อมูล (Dangerous Zone)')
      .addItem('⚠️ ล้างเฉพาะชีต Data', 'clearDataSheet_UI')
      .addItem('⚠️ ล้างเฉพาะชีต Input', 'clearInputSheet_UI')
      .addItem('⚠️ ล้างเฉพาะชีต สรุปผล', 'clearSummarySheet_UI')
      .addItem('🔥 ล้างทั้งหมด (Input+Data+สรุป)', 'clearAllSCGSheets_UI')
    )
    .addToUi();


  // =================================================================
  // 🤖 เมนูชุดที่ 3: ระบบอัตโนมัติ (Automation)
  // =================================================================
  ui.createMenu('🤖 3. ระบบอัตโนมัติ')
    .addItem('▶️ เปิดระบบช่วยเหลืองาน (Auto-Pilot)', 'START_AUTO_PILOT')
    .addItem('⏹️ ปิดระบบช่วยเหลือ', 'STOP_AUTO_PILOT')
    .addItem('🕵️ สั่ง AI ตื่นมาวิเคราะห์ทันที (Manual)', 'WAKE_UP_AGENT')
    .addToUi();


  // =================================================================
  // ⚙️ เมนูชุดที่ 4: System Admin
  // =================================================================
  ui.createMenu('⚙️ System Admin')
    .addItem('🏥 ตรวจสอบสถานะระบบ (Health Check)', 'runSystemHealthCheck')
    .addItem('🧹 ล้าง Backup เก่า (>30 วัน)', 'cleanupOldBackups')
    .addItem('📊 เช็คปริมาณข้อมูล (Cell Usage)', 'checkSpreadsheetHealth')
    .addSeparator()
    .addSubMenu(ui.createMenu('🚀 Upgrade Schema (V4.0)')
      .addItem('💎 อัปเกรดเป็น 5-Tier AI Mapping', 'upgradeNameMappingStructure_V4')
      .addItem('📂 ขยายคอลัมน์ส่วนขยาย Database (R-Z)', 'upgradeDatabaseStructure')
    )
    .addSubMenu(ui.createMenu('🏥 Diagnostics & Logs')
      .addItem('⚙️ สแกนเอนจิน (Phase 1)', 'RUN_SYSTEM_DIAGNOSTIC')
      .addItem('📂 สแกนโครงสร้างชีต (Phase 2)', 'RUN_SHEET_DIAGNOSTIC')
      .addItem('📡 ทดสอบการเชื่อมต่อ Gemini AI', 'debugGeminiConnection')
    )
    .addSeparator()
    .addItem('🔔 ตั้งค่า LINE Notify', 'setupLineToken')
    .addItem('✈️ ตั้งค่า Telegram Notify', 'setupTelegramConfig')
    .addItem('🔐 ตั้งค่า Gemini API Key', 'setupEnvironment')
    .addItem('📋 ตรวจสอบรหัสลับที่บันทึกไว้', 'checkCurrentKeyStatus')
    .addToUi();
}


// =================================================================
// 🛡️ SAFETY WRAPPERS (UI Logic Helpers)
// =================================================================


function syncNewDataToMaster_UI() {
  var ui = SpreadsheetApp.getUi();
  var sourceName = (typeof CONFIG !== 'undefined' && CONFIG.SOURCE_SHEET) ? CONFIG.SOURCE_SHEET : 'ชีตนำเข้า';
  var dbName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : 'Database';
  
  var result = ui.alert(
    'ยืนยันการดึงข้อมูลใหม่?',
    'ระบบจะดึงรายชื่อลูกค้าจากชีต "' + sourceName + '"\n' +
    'มาเพิ่มต่อท้ายในชีต "' + dbName + '"\n' +
    '(เฉพาะรายชื่อที่ยังไม่เคยมีในระบบ)\n\n' +
    'คุณต้องการดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    if (typeof syncNewDataToMaster === 'function') syncNewDataToMaster();
  }
}


function runAIBatchResolver_UI() {
  var ui = SpreadsheetApp.getUi();
  var batchSize = (typeof CONFIG !== 'undefined' && CONFIG.AI_BATCH_SIZE) ? CONFIG.AI_BATCH_SIZE : 20;
  
  var result = ui.alert(
    '🧠 ยืนยันการรัน AI Smart Resolution?',
    'ระบบจะรวบรวมชื่อที่ยังหาพิกัดไม่เจอ (สูงสุด ' + batchSize + ' รายการ)\n' +
    'ส่งให้ Gemini AI วิเคราะห์จับคู่กับ Master Database อัตโนมัติ\n\n' +
    'ต้องการเริ่มเลยหรือไม่?',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    if (typeof resolveUnknownNamesWithAI === 'function') {
      resolveUnknownNamesWithAI();
    } else {
      ui.alert('❌ Error: ไม่พบโมดูล Service_Agent.gs');
    }
  }
}


function finalizeAndClean_UI() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    '⚠️ ยืนยันการจบงาน (Finalize)?',
    'รายการที่ตรวจสอบพิกัดแล้วจะถูกย้ายไปเก็บที่ NameMapping และลบออกจาก Database\n' +
    'ข้อมูลต้นฉบับจะถูก Backup ไว้ในชีตใหม่\n\n' +
    'ยืนยันหรือไม่?',
    ui.ButtonSet.OK_CANCEL
  );
  if (result == ui.Button.OK) {
    if (typeof finalizeAndClean_MoveToMapping === 'function') finalizeAndClean_MoveToMapping();
  }
}


function resetDeepCleanMemory_UI() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    'ยืนยันการรีเซ็ต?',
    'ระบบจะลบหน่วยความจำ (Pointer) และเริ่มตรวจสอบความสมบูรณ์ข้อมูลตั้งแต่แถวที่ 2 ใหม่ในรอบถัดไป',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    if (typeof resetDeepCleanMemory === 'function') resetDeepCleanMemory();
  }
}


function clearAllSCGSheets_UI() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    '🔥 DANGER: ยืนยันการล้างข้อมูลประจำวัน?',
    'ชีต Input, Data และ สรุปผล จะถูกล้างว่างเปล่าเพื่อเริ่มงานวันใหม่!\n' +
    'การกระทำนี้ไม่สามารถกู้คืนได้\n\n' +
    'คุณแน่ใจใช่หรือไม่?',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    if (typeof clearAllSCGSheets === 'function') clearAllSCGSheets();
    // Fallback if combined function not exists
    else if (typeof clearDataSheet === 'function') {
       clearDataSheet();
       clearInputSheet();
       ui.alert('✅ ล้างข้อมูลเรียบร้อยแล้ว');
    }
  }
}


function clearDataSheet_UI() { confirmAction('ล้างชีต Data', 'ข้อมูลผลลัพธ์ Shipment ทั้งหมดจะหายไป', clearDataSheet); }
function clearInputSheet_UI() { confirmAction('ล้างชีต Input', 'รหัส Shipment และ Cookie ทั้งหมดจะหายไป', clearInputSheet); }
function clearSummarySheet_UI() { confirmAction('ล้างชีต สรุปผล', 'รายงานสรุปตามเจ้าของสินค้าและรถจะหายไป', function(){ 
  if(typeof clearSummarySheet === 'function') clearSummarySheet();
  if(typeof clearShipmentSummarySheet === 'function') clearShipmentSummarySheet();
}); }


function repairNameMapping_UI() { confirmAction('ซ่อมแซม NameMapping', 'ระบบจะลบแถวซ้ำและเติม UUID ให้ครบทุก Variant เพื่อความแม่นยำในการค้นหา', repairNameMapping_Full); }


function confirmAction(title, message, callbackFunction) {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(title, message, ui.ButtonSet.YES_NO);
  if (result == ui.Button.YES) {
    callbackFunction();
  }
}


function runSystemHealthCheck() {
  var ui = SpreadsheetApp.getUi();
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.validateSystemIntegrity) {
      CONFIG.validateSystemIntegrity();
      ui.alert(
        "✅ System Health: Excellent\n",
        "ระบบ Logistics V4.0 พร้อมทำงานสมบูรณ์ครับ!\n" +
        "- โครงสร้างชีต (Sacred Schema) ครบถ้วน\n" +
        "- การเชื่อมต่อ Gemini AI Engine: พร้อมใช้งาน",
        ui.ButtonSet.OK
      );
    } else {
      ui.alert("⚠️ System Warning", "ไม่พบฟังก์ชันตรวจสอบความสมบูรณ์ (CONFIG.validateSystemIntegrity)", ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert("❌ System Health: FAILED", e.message, ui.ButtonSet.OK);
  }
}
```

---

### 📄 ไฟล์: Service_Master.gs
```javascript
/**
 * VERSION: 001
 * 🧠 Service: Master Data Management (Enterprise Edition)
 * ------------------------------------------------------------------
 * [FIXED v4.1]: Created getRealLastRow_() to ignore pre-filled checkboxes.
 * [PRESERVED]: Spatial Grid Clustering, Deep Clean, and NameMapping Repair.
 * [MODIFIED v4.0]: Fully integrated with Sacred Schema A-Q and UUID system.
 * [ADDED v4.0]: Automatic cache clearing after data finalization.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. IMPORT & SYNC (Source to Master)
// ==========================================


/**
 * 🛠️ Helper หาแถวสุดท้ายจริงๆ โดยดูจากคอลัมน์ชื่อลูกค้า (ข้าม Checkbox)
 */
function getRealLastRow_(sheet, columnIndex) {
  var data = sheet.getRange(1, columnIndex, sheet.getMaxRows(), 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    if (data[i] !== "" && data[i] !== null && typeof data[i] !== 'boolean') {
      return i + 1;
    }
  }
  return 1;
}


function syncNewDataToMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var lock = LockService.getScriptLock();
  
  if (!lock.tryLock(15000)) {
    ui.alert("⚠️ ระบบคิวทำงาน", "มีผู้ใช้งานอื่นกำลังอัปเดตฐานข้อมูลอยู่ กรุณาลองใหม่ในอีก 15 วินาทีครับ", ui.ButtonSet.OK);
    return;
  }


  try {
    var sourceSheet = ss.getSheetByName(CONFIG.SOURCE_SHEET);
    var masterSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sourceSheet || !masterSheet) throw new Error("ไม่พบ Sheet (Source หรือ Database)");


    var SRC_IDX = { NAME: 12, LAT: 14, LNG: 15, SYS_ADDR: 18, DIST: 23, GOOG_ADDR: 24 };
    var lastRowM = getRealLastRow_(masterSheet, CONFIG.COL_NAME);
    var existingNames = new Set();


    if (lastRowM > 1) {
      masterSheet.getRange(2, CONFIG.COL_NAME, lastRowM - 1, 1).getValues()
        .forEach(function(r) { if (r) existingNames.add(normalizeText(r)); });
    }


    var lastRowS = sourceSheet.getLastRow();
    if (lastRowS < 2) { ui.alert("ℹ️ ไม่มีข้อมูลในชีตต้นทาง"); return; }


    var sData = sourceSheet.getRange(2, 1, lastRowS - 1, 25).getValues();
    var newEntries = [];
    var currentBatch = new Set();


    sData.forEach(function(row) {
      var name = row[SRC_IDX.NAME];
      var lat = row[SRC_IDX.LAT], lng = row[SRC_IDX.LNG];
      if (!name || !lat || !lng) return;


      var clean = normalizeText(name);
      if (!existingNames.has(clean) && !currentBatch.has(clean)) {
        var newRow = new Array(17).fill("");
        newRow[CONFIG.C_IDX.NAME] = name;
        newRow[CONFIG.C_IDX.LAT] = lat;
        newRow[CONFIG.C_IDX.LNG] = lng;
        newRow[CONFIG.C_IDX.VERIFIED] = false;
        newRow[CONFIG.C_IDX.SYS_ADDR] = row[SRC_IDX.SYS_ADDR];
        newRow[CONFIG.C_IDX.GOOGLE_ADDR] = row[SRC_IDX.GOOG_ADDR];
        newRow[CONFIG.C_IDX.DIST_KM] = typeof cleanDistance_Helper === 'function' ? cleanDistance_Helper(row[SRC_IDX.DIST]) : row[SRC_IDX.DIST];
        newRow[CONFIG.C_IDX.UUID] = generateUUID();
        newRow[CONFIG.C_IDX.CREATED] = new Date();
        newRow[CONFIG.C_IDX.UPDATED] = new Date();
        newEntries.push(newRow);
        currentBatch.add(clean);
      }
    });


    if (newEntries.length > 0) {
      masterSheet.getRange(lastRowM + 1, 1, newEntries.length, 17).setValues(newEntries);
      ui.alert("✅ นำเข้าข้อมูลใหม่สำเร็จ: " + newEntries.length + " รายการ");
    } else {
      ui.alert("👌 ฐานข้อมูลเป็นปัจจุบันแล้ว");
    }
  } catch (error) {
    console.error("Sync Error: " + error.message);
    ui.alert("❌ เกิดข้อผิดพลาด: " + error.message);
  } finally { lock.releaseLock(); }
}


// ==========================================
// 2. DATA MAINTENANCE & CLEANING
// ==========================================


function updateGeoData_SmartCache() { runDeepCleanBatch_100(); }


function runDeepCleanBatch_100() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;


  var lastRow = getRealLastRow_(sheet, CONFIG.COL_NAME);
  if (lastRow < 2) return;


  var props = PropertiesService.getScriptProperties();
  var startRow = parseInt(props.getProperty('DEEP_CLEAN_POINTER') || '2');
  if (startRow > lastRow) { 
    SpreadsheetApp.getUi().alert("🎉 ตรวจครบทุกแถวแล้ว (Pointer Reset)");
    props.deleteProperty('DEEP_CLEAN_POINTER');
    return; 
  }


  var endRow = Math.min(startRow + CONFIG.DEEP_CLEAN_LIMIT - 1, lastRow);
  var range = sheet.getRange(startRow, 1, endRow - startRow + 1, 17);
  var values = range.getValues();
  var origin = CONFIG.DEPOT_LAT + "," + CONFIG.DEPOT_LNG;
  var updatedCount = 0;


  for (var i = 0; i < values.length; i++) {
    var row = values[i], changed = false;
    var lat = row[CONFIG.C_IDX.LAT], lng = row[CONFIG.C_IDX.LNG];


    // 1. เติมที่อยู่ Google Maps (ถ้าขาด)
    if (lat && lng && !row[CONFIG.C_IDX.GOOGLE_ADDR]) {
      try {
        var addr = GET_ADDR_WITH_CACHE(lat, lng);
        if (addr && addr !== "Error") { row[CONFIG.C_IDX.GOOGLE_ADDR] = addr; changed = true; }
      } catch (e) { console.warn("Geo Error: " + e.message); }
    }


    // 2. คำนวณระยะทางจากคลัง
    if (lat && lng && !row[CONFIG.C_IDX.DIST_KM]) {
      var km = CALCULATE_DISTANCE_KM(origin, lat + "," + lng);
      if (km) { row[CONFIG.C_IDX.DIST_KM] = km; changed = true; }
    }


    // 3. ตรวจสอบ UUID และที่อยู่แยกส่วน
    if (!row[CONFIG.C_IDX.UUID]) { row[CONFIG.C_IDX.UUID] = generateUUID(); changed = true; }
    var gAddr = row[CONFIG.C_IDX.GOOGLE_ADDR];
    if (gAddr && (!row[CONFIG.C_IDX.PROVINCE] || !row[CONFIG.C_IDX.DISTRICT])) {
      var parsed = parseAddressFromText(gAddr);
      if (parsed && parsed.province) {
        row[CONFIG.C_IDX.PROVINCE] = parsed.province;
        row[CONFIG.C_IDX.DISTRICT] = parsed.district;
        row[CONFIG.C_IDX.POSTCODE] = parsed.postcode;
        changed = true;
      }
    }


    if (changed) { row[CONFIG.C_IDX.UPDATED] = new Date(); updatedCount++; }
  }


  if (updatedCount > 0) range.setValues(values);
  props.setProperty('DEEP_CLEAN_POINTER', (endRow + 1).toString());
  ss.toast("✅ Processed rows " + startRow + "-" + endRow + " (Updated: " + updatedCount + ")", "Deep Clean");
}


function resetDeepCleanMemory() {
  PropertiesService.getScriptProperties().deleteProperty('DEEP_CLEAN_POINTER');
  SpreadsheetApp.getActiveSpreadsheet().toast("🔄 Memory Reset: เริ่มตรวจสอบแถวที่ 2 ในรอบถัดไป", "System Ready");
}


// ==========================================
// 3. FINALIZATION & MAPPING
// ==========================================


function finalizeAndClean_MoveToMapping() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { ui.alert("⚠️ ระบบคิวทำงาน", "กรุณารอสักครู่", ui.ButtonSet.OK); return; }


  try {
    var masterSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
    var lastRow = getRealLastRow_(masterSheet, CONFIG.COL_NAME);
    if (lastRow < 2) return;


    var allData = masterSheet.getRange(2, 1, lastRow - 1, 17).getValues();
    var uuidMap = {};
    allData.forEach(function(row) {
      var uuid = row[CONFIG.C_IDX.UUID];
      if (uuid) {
        uuidMap[normalizeText(row[CONFIG.C_IDX.NAME])] = uuid;
        if (row[CONFIG.C_IDX.SUGGESTED]) uuidMap[normalizeText(row[CONFIG.C_IDX.SUGGESTED])] = uuid;
      }
    });


    // Backup ก่อนทำงาน
    masterSheet.copyTo(ss).setName("Backup_DB_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmm"));


    var rowsToKeep = [], mappingToUpload = [], processedNames = new Set();
    allData.forEach(function(row) {
      if (row[CONFIG.C_IDX.VERIFIED] === true) { rowsToKeep.push(row); }
      else if (row[CONFIG.C_IDX.SUGGESTED]) {
        var rawName = row[CONFIG.C_IDX.NAME];
        if (!processedNames.has(rawName)) {
          var targetUUID = uuidMap[normalizeText(row[CONFIG.C_IDX.SUGGESTED])] || row[CONFIG.C_IDX.UUID];
          mappingToUpload.push([rawName, targetUUID, 100, "Human", new Date()]);
          processedNames.add(rawName);
        }
      }
    });


    if (mappingToUpload.length > 0) {
      mapSheet.getRange(mapSheet.getLastRow() + 1, 1, mappingToUpload.length, 5).setValues(mappingToUpload);
      if (typeof clearSearchCache === 'function') clearSearchCache();
    }


    masterSheet.getRange(2, 1, lastRow, 17).clearContent();
    if (rowsToKeep.length > 0) masterSheet.getRange(2, 1, rowsToKeep.length, 17).setValues(rowsToKeep);
    ui.alert("✅ Finalize Complete\nNew Mappings: " + mappingToUpload.length);
  } catch (e) { ui.alert("❌ CRITICAL ERROR: " + e.message); } finally { lock.releaseLock(); }
}


// ==========================================
// 4. ADMIN & REPAIR TOOLS
// ==========================================


function assignMissingUUIDs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastRow = getRealLastRow_(sheet, CONFIG.COL_NAME);
  if (lastRow < 2) return;


  var range = sheet.getRange(2, CONFIG.COL_UUID, lastRow - 1, 1);
  var count = 0;
  var newValues = range.getValues().map(function(r) {
    if (!r) { count++; return [generateUUID()]; }
    return [r];
  });


  if (count > 0) { range.setValues(newValues); SpreadsheetApp.getUi().alert("✅ Generated " + count + " new UUIDs."); }
}


function repairNameMapping_Full() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  var dbSheet = ss.getSheetByName(CONFIG.SHEET_NAME), mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
  
  var dbData = dbSheet.getRange(2, 1, getRealLastRow_(dbSheet, CONFIG.COL_NAME) - 1, CONFIG.COL_UUID).getValues();
  var uuidMap = {};
  dbData.forEach(function(r) { if (r[CONFIG.C_IDX.UUID]) uuidMap[normalizeText(r[CONFIG.C_IDX.NAME])] = r[CONFIG.C_IDX.UUID]; });


  var mapRange = mapSheet.getRange(2, 1, Math.max(1, mapSheet.getLastRow() - 1), 5);
  var cleanList = [], seen = new Set();
  mapRange.getValues().forEach(function(r) {
    var normOld = normalizeText(r[CONFIG.MAP_IDX.VARIANT]);
    if (!normOld || seen.has(normOld)) return;
    var uid = r[CONFIG.MAP_IDX.UID] || uuidMap[normOld] || generateUUID();
    cleanList.push([r[CONFIG.MAP_IDX.VARIANT], uid, r[CONFIG.MAP_IDX.CONFIDENCE] || 100, r[CONFIG.MAP_IDX.MAPPED_BY] || "System_Repair", r[CONFIG.MAP_IDX.TIMESTAMP] || new Date()]);
    seen.add(normOld);
  });


  if (cleanList.length > 0) {
    mapSheet.getRange(2, 1, mapSheet.getLastRow(), 5).clearContent();
    mapSheet.getRange(2, 1, cleanList.length, 5).setValues(cleanList);
    ui.alert("✅ Repair Complete. Total: " + cleanList.length);
  }
}


function autoGenerateMasterList_Smart() { processClustering_GridOptimized(); }


function processClustering_GridOptimized() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastRow = getRealLastRow_(sheet, CONFIG.COL_NAME);
  if (lastRow < 2) return;


  var range = sheet.getRange(2, 1, lastRow - 1, 15), values = range.getValues();
  var clusters = [], grid = {};


  values.forEach(function(r, i) {
    var lat = r[CONFIG.C_IDX.LAT], lng = r[CONFIG.C_IDX.LNG];
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    var gridKey = Math.floor(lat * 10) + "_" + Math.floor(lng * 10);
    if (!grid[gridKey]) grid[gridKey] = [];
    grid[gridKey].push(i);
    if (r[CONFIG.C_IDX.VERIFIED] === true) clusters.push({ lat: lat, lng: lng, name: r[CONFIG.C_IDX.SUGGESTED] || r[CONFIG.C_IDX.NAME], rowIndexes: [i], hasLock: true, gridKey: gridKey });
  });


  values.forEach(function(r, i) {
    if (r[CONFIG.C_IDX.VERIFIED] === true || !r[CONFIG.C_IDX.LAT]) return;
    var myKey = Math.floor(r[CONFIG.C_IDX.LAT] * 10) + "_" + Math.floor(r[CONFIG.C_IDX.LNG] * 10);
    var found = false;
    clusters.forEach(function(c) {
      if (!found && c.gridKey === myKey && getHaversineDistanceKM(r[CONFIG.C_IDX.LAT], r[CONFIG.C_IDX.LNG], c.lat, c.lng) <= CONFIG.DISTANCE_THRESHOLD_KM) {
        c.rowIndexes.push(i); found = true;
      }
    });
    if (!found) clusters.push({ lat: r[CONFIG.C_IDX.LAT], lng: r[CONFIG.C_IDX.LNG], rowIndexes: [i], hasLock: false, gridKey: myKey });
  });


  var updateCount = 0;
  clusters.forEach(function(g) {
    var candidates = g.rowIndexes.map(function(idx) { return values[idx][CONFIG.C_IDX.NAME]; });
    var winner = g.hasLock ? g.name : getBestName_Smart(candidates);
    g.rowIndexes.forEach(function(idx) {
      if (values[idx][CONFIG.C_IDX.VERIFIED] !== true && (values[idx][CONFIG.C_IDX.SUGGESTED] !== winner || values[idx][CONFIG.C_IDX.CONFIDENCE] !== g.rowIndexes.length)) {
        values[idx][CONFIG.C_IDX.SUGGESTED] = winner;
        values[idx][CONFIG.C_IDX.CONFIDENCE] = g.rowIndexes.length;
        values[idx][CONFIG.C_IDX.NORMALIZED] = normalizeText(winner);
        updateCount++;
      }
    });
  });


  if (updateCount > 0) { range.setValues(values); ss.toast("✅ จัดกลุ่มสำเร็จ! (Updated: " + updateCount + " rows)", "Clustering"); }
}


function cleanDistance_Helper(val) {
  if (!val) return "";
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '').replace('km', '').trim()) || "";
}
```

---

### 📄 ไฟล์: Service_SCG.gs
```javascript
/**
 * VERSION: 001
 * 📦 Service: SCG Operation (Enterprise Edition)
 * Version: 5.0 ScanDocs + Summary Readiness
 * ---------------------------------------------------------
 * [PRESERVED v4.0]: API Retry Mechanism, LockService, Smart Branch Matching [1]
 * [PRESERVED v4.0]: AI NameMapping schema (Variant -> Master_UID -> Coordinates) [19]
 * [UPDATED v5.0]: checkIsEPOD() — Logic ใหม่รองรับ Invoice ทุกช่วงตัวเลข [5]
 * [UPDATED v5.0]: buildOwnerSummary() — เพิ่ม จำนวน_E-POD_ทั้งหมด [20]
 * [ADDED v5.0]: buildShipmentSummary() — สรุปตาม Shipment+TruckLicense [9]
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. MAIN OPERATION: FETCH DATA FROM FSM
// ==========================================


function fetchDataFromSCGJWD() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const lock = LockService.getScriptLock();
  
  // ป้องกันการรันซ้อนกัน (Lock 10 วินาที) [11]
  if (!lock.tryLock(10000)) {
    ui.alert("⚠️ ระบบคิวทำงาน", "มีผู้ใช้งานอื่นกำลังโหลดข้อมูล Shipment อยู่ กรุณารอสักครู่", ui.ButtonSet.OK);
    return;
  }


  try {
    const inputSheet = ss.getSheetByName(SCG_CONFIG.SHEET_INPUT);
    const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
    if (!inputSheet || !dataSheet) throw new Error("CRITICAL: ไม่พบชีต Input หรือ Data [10]");


    const cookie = inputSheet.getRange(SCG_CONFIG.COOKIE_CELL).getValue();
    if (!cookie) throw new Error("❌ กรุณาวาง Cookie ในช่อง " + SCG_CONFIG.COOKIE_CELL + " [11]");


    const lastRow = inputSheet.getLastRow();
    if (lastRow < SCG_CONFIG.INPUT_START_ROW) throw new Error("ℹ️ ไม่พบเลข Shipment ในชีต Input [21]");


    const shipmentNumbers = inputSheet
      .getRange(SCG_CONFIG.INPUT_START_ROW, 1, lastRow - SCG_CONFIG.INPUT_START_ROW + 1, 1)
      .getValues().flat().filter(String);


    if (shipmentNumbers.length === 0) throw new Error("ℹ️ รายการ Shipment ว่างเปล่า");


    const shipmentString = shipmentNumbers.join(',');
    inputSheet.getRange(SCG_CONFIG.SHIPMENT_STRING_CELL).setValue(shipmentString);


    const payload = { ShipmentNos: shipmentString };
    const options = { method: 'post', payload: payload, muteHttpExceptions: true, headers: { cookie: cookie } };


    ss.toast("กำลังเชื่อมต่อ SCG Server...", "System", 10);
    const responseText = fetchWithRetry_(SCG_CONFIG.API_URL, options, (CONFIG.API_MAX_RETRIES || 3)); [22]
    
    const json = JSON.parse(responseText);
    const shipments = json.data || [];
    if (shipments.length === 0) throw new Error("API ไม่พบข้อมูล Shipment (Data Empty) [23]");


    const allFlatData = [];
    let runningRow = 2;


    // กระบวนการคลายโครงสร้าง Data Flattening [7], [8]
    shipments.forEach(shipment => {
      const destSet = new Set();
      (shipment.DeliveryNotes || []).forEach(n => { if (n.ShipToName) destSet.add(n.ShipToName); });


      (shipment.DeliveryNotes || []).forEach(note => {
        (note.Items || []).forEach(item => {
          const row = [
            note.PurchaseOrder + "-" + runningRow, // ID_งานประจำวัน
            note.PlanDelivery ? new Date(note.PlanDelivery) : null,
            String(note.PurchaseOrder),
            String(shipment.ShipmentNo),
            shipment.DriverName,
            shipment.TruckLicense,
            String(shipment.CarrierCode),
            shipment.CarrierName,
            String(note.SoldToCode),
            note.SoldToName,
            note.ShipToName,
            note.ShipToAddress,
            note.ShipToLatitude + ", " + note.ShipToLongitude,
            item.MaterialName,
            item.ItemQuantity,
            item.QuantityUnit,
            item.ItemWeight,
            String(note.DeliveryNo),
            destSet.size, // จำนวนปลายทางใน Shipment นี้
            Array.from(destSet).join(", "), // รายชื่อปลายทาง
            "รอสแกน", "ยังไม่ได้ส่ง", "", 0, 0, 0, "", "", 
            shipment.ShipmentNo + "|" + note.ShipToName // ShopKey [24]
          ];
          allFlatData.push(row);
          runningRow++;
        });
      });
    });


    // คำนวณยอดรวมระดับร้านค้า (Aggregation) [25]
    const shopAgg = {};
    allFlatData.forEach(r => {
      const key = r[26];
      if (!shopAgg[key]) shopAgg[key] = { qty: 0, weight: 0, invoices: new Set(), epod: 0 };
      shopAgg[key].qty += Number(r[27]) || 0;
      shopAgg[key].weight += Number(r[28]) || 0;
      shopAgg[key].invoices.add(r[29]);
      if (checkIsEPOD(r[30], r[29])) shopAgg[key].epod++;
    });


    allFlatData.forEach(r => {
      const agg = shopAgg[r[26]];
      r[9] = agg.qty;
      r[17] = Number(agg.weight.toFixed(2));
      r[31] = agg.invoices.size - agg.epod; // จำนวน Invoice ที่ต้องสแกนจริง
      r[32] = `${r[30]} / รวม ${r[31]} บิล`;
    });


    // เขียนข้อมูลลงชีต Data [16]
    dataSheet.clear();
    const headers = ["ID_งานประจำวัน", "PlanDelivery", "InvoiceNo", "ShipmentNo", "DriverName", "TruckLicense", "CarrierCode", "CarrierName", "SoldToCode", "SoldToName", "ShipToName", "ShipToAddress", "LatLong_SCG", "MaterialName", "ItemQuantity", "QuantityUnit", "ItemWeight", "DeliveryNo", "จำนวนปลายทาง_System", "รายชื่อปลายทาง_System", "ScanStatus", "DeliveryStatus", "Email พนักงาน", "จำนวนสินค้ารวมของร้านนี้", "น้ำหนักสินค้ารวมของร้านนี้", "จำนวน_Invoice_ที่ต้องสแกน", "LatLong_Actual", "ชื่อเจ้าของสินค้า_Invoice_ที่ต้องสแกน", "ShopKey"];
    dataSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    
    if (allFlatData.length > 0) {
      dataSheet.getRange(2, 1, allFlatData.length, headers.length).setValues(allFlatData);
      dataSheet.getRange(2, 2, allFlatData.length, 1).setNumberFormat("dd/mm/yyyy");
    }


    // รันฟังก์ชันพ่วงหลังโหลดข้อมูลสำเร็จ [33]
    applyMasterCoordinatesToDailyJob();
    buildOwnerSummary();
    buildShipmentSummary();
    
    ui.alert(`✅ ดึงข้อมูลสำเร็จ!\n- จำนวนรายการ: ${allFlatData.length} แถว\n- จับคู่พิกัดและสร้างสรุปเรียบร้อย`);
    
  } catch (e) {
    console.error("[SCG API Error]: " + e.message);
    ui.alert("❌ เกิดข้อผิดพลาด: " + e.message);
  } finally { lock.releaseLock(); }
}


// ==========================================
// 2. COORDINATE MATCHING (RELATIONAL UUID)
// ==========================================


function applyMasterCoordinatesToDailyJob() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  const dbSheet = ss.getSheetByName(SCG_CONFIG.SHEET_MASTER_DB);
  const mapSheet = ss.getSheetByName(SCG_CONFIG.SHEET_MAPPING);
  if (!dataSheet || !dbSheet) return;


  const lastRow = dataSheet.getLastRow();
  if (lastRow < 2) return;


  // โหลด Master Data พร้อม UUID สำหรับ Relational Lookup [12], [34]
  const masterCoords = {};
  const masterUUIDCoords = {};
  if (dbSheet.getLastRow() > 1) {
    const dbData = dbSheet.getRange(2, 1, dbSheet.getLastRow() - 1, 15).getValues();
    dbData.forEach(r => {
      const name = r[CONFIG.C_IDX.NAME], lat = r[CONFIG.C_IDX.LAT], lng = r[CONFIG.C_IDX.LNG], uuid = r[CONFIG.C_IDX.UUID];
      if (name && lat && lng) {
        const coords = lat + ", " + lng;
        masterCoords[normalizeText(name)] = coords;
        if (uuid) masterUUIDCoords[uuid] = coords;
      }
    });
  }


  // โหลด NameMapping 5-Tier (Variant -> Master_UID) [28], [35]
  const aliasMap = {};
  if (mapSheet && mapSheet.getLastRow() > 1) {
    mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 2).getValues().forEach(r => {
      if (r && r[36]) aliasMap[normalizeText(r)] = r[36];
    });
  }


  const values = dataSheet.getRange(2, 1, lastRow - 1, 29).getValues();
  const latLongUpdates = [], bgUpdates = [];


  values.forEach(r => {
    let newGeo = "", bg = null;
    if (r[37]) {
      let rawName = normalizeText(r[37]);
      let targetUID = aliasMap[rawName];
      
      // Step 1: หาจาก UID (แม่นยำที่สุด) [4]
      if (targetUID && masterUUIDCoords[targetUID]) { newGeo = masterUUIDCoords[targetUID]; bg = "#b6d7a8"; }
      // Step 2: หาจากชื่อตรง
      else if (masterCoords[rawName]) { newGeo = masterCoords[rawName]; bg = "#b6d7a8"; }
      // Step 3: เดาจากชื่อสาขา (Smart Branch Matching) [5], [38]
      else {
        let branchMatch = tryMatchBranch_(r[37], masterCoords);
        if (branchMatch) { newGeo = branchMatch; bg = "#ffe599"; }
      }
    }
    latLongUpdates.push([newGeo]);
    bgUpdates.push([bg]);
  });


  dataSheet.getRange(2, 27, latLongUpdates.length, 1).setValues(latLongUpdates);
  dataSheet.getRange(2, 27, bgUpdates.length, 1).setBackgrounds(bgUpdates);
  ss.toast("✅ อัปเดตพิกัดเรียบร้อย", "System");
}


// ==========================================
// 3. E-POD LOGIC & HELPERS
// ==========================================


function checkIsEPOD(ownerName, invoiceNo) {
  if (!ownerName || !invoiceNo) return false;
  const owner = String(ownerName).toUpperCase();
  const inv = String(invoiceNo);


  // กลุ่ม 1: EPOD ทุกบิล [39], [6]
  const epodOwners = ["BETTERBE", "SCG EXPRESS", "เบทเตอร์แลนด์", "JWD TRANSPORT"];
  if (epodOwners.some(w => owner.includes(w.toUpperCase()))) return true;


  // กลุ่ม 2: เงื่อนไขพิเศษ DENSO [39], [40]
  if (owner.includes("DENSO") || owner.includes("เด็นโซ่")) {
    if (inv.includes("_DOC")) return false;
    if (/^\d+(-.*)?$/.test(inv)) return true;
  }
  return false;
}


function tryMatchBranch_(name, masterCoords) {
  const keywords = ["สาขา", "branch", "สำนักงาน", "store", "shop"];
  for (let k of keywords) {
    if (name.includes(k)) {
      let parts = name.split(k);
      if (parts.length > 0 && parts.length > 2) {
        let parentName = normalizeText(parts);
        if (masterCoords[parentName]) return masterCoords[parentName];
      }
    }
  }
  return null;
}


function fetchWithRetry_(url, options, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) return response.getContentText();
      throw new Error("HTTP " + response.getResponseCode());
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      Utilities.sleep(1000 * Math.pow(2, i));
      console.warn(`[SCG API] Retry attempt ${i+1} failed.`);
    }
  }
}


// ==========================================
// 4. REPORTING: OWNER & SHIPMENT SUMMARY
// ==========================================


function buildShipmentSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  if (!dataSheet || dataSheet.getLastRow() < 2) return;


  const data = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 29).getValues();
  const shipmentMap = {};


  data.forEach(r => {
    const shipmentNo = String(r[41]), truck = String(r[42]), owner = r[30], invoice = String(r[29]);
    if (!shipmentNo || !truck) return;
    const key = shipmentNo + "_" + truck;
    if (!shipmentMap[key]) shipmentMap[key] = { shipmentNo, truck, all: new Set(), epod: new Set() };
    if (!invoice) return;
    if (checkIsEPOD(owner, invoice)) shipmentMap[key].epod.add(invoice);
    else shipmentMap[key].all.add(invoice);
  });


  const summarySheet = ss.getSheetByName("สรุป_Shipment");
  if (!summarySheet) return;


  const rows = [];
  Object.keys(shipmentMap).sort().forEach(key => {
    const s = shipmentMap[key];
    rows.push([key, s.shipmentNo, s.truck, "", s.all.size, s.epod.size, new Date()]); [18]
  });


  if (rows.length > 0) {
    summarySheet.getRange(2, 1, summarySheet.getLastRow() || 1, 7).clearContent();
    summarySheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
  console.log(`[Shipment Summary v5.0] Built ${rows.length} rows.`);
}


function buildOwnerSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  if (!dataSheet || dataSheet.getLastRow() < 2) return;


  const data = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 29).getValues();
  const ownerMap = {};


  data.forEach(r => {
    const owner = r[30], invoice = String(r[29]);
    if (!owner || !invoice) return;
    if (!ownerMap[owner]) ownerMap[owner] = { all: new Set(), epod: new Set() };
    if (checkIsEPOD(owner, invoice)) ownerMap[owner].epod.add(invoice);
    else ownerMap[owner].all.add(invoice);
  });


  const summarySheet = ss.getSheetByName("สรุป_เจ้าของสินค้า");
  if (!summarySheet) return;


  const rows = [];
  Object.keys(ownerMap).sort().forEach(owner => {
    const o = ownerMap[owner];
    rows.push(["", owner, "", o.all.size, o.epod.size, new Date()]); [43]
  });


  if (rows.length > 0) {
    summarySheet.getRange(2, 1, summarySheet.getLastRow() || 1, 6).clearContent();
    summarySheet.getRange(2, 1, rows.length, 6).setValues(rows);
  }
}
```

---

### 📄 ไฟล์: Service_GeoAddr.gs
```javascript
/**
 * VERSION: 001
 * 🌍 Service: Geo Address & Google Maps Formulas (Enterprise Edition)
 * Version: 4.0 Omni-Geo Engine & API Hardening
 * -------------------------------------------------------
 * [PRESERVED]: Fully Integrated Google Maps Formulas by Amit Agarwal.
 * [PRESERVED]: 7 Custom Functions for Spreadsheet directly.
 * [MODIFIED v4.0]: Added Try-Catch to _mapsSetCache to prevent 100KB limits crash.
 * [MODIFIED v4.0]: Enterprise Audit Logging (GCP Console) for API Failures.
 * [MODIFIED v4.0]: Enhanced regex in parseAddressFromText for better Tier 2 parsing.
 * [FINAL POLISH]: Bulletproof distance calculation (handling commas in API response).
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. CONFIGURATION (Internal)
// ==========================================
const POSTAL_COL = {
  ZIP: 0,       // Col A (postcode)
  DISTRICT: 2,  // Col C (district)
  PROVINCE: 3   // Col D (province)
};


var _POSTAL_CACHE = null;


// ==========================================
// 2. 🧠 SMART ADDRESS PARSING LOGIC (Tier 2 Resolution)
// ==========================================


/**
 * แกะรหัสไปรษณีย์ จังหวัด และอำเภอ จากที่อยู่ดิบ (Tier 2 Resolution)
 */
function parseAddressFromText(fullAddress) {
  var result = { province: "", district: "", postcode: "" };
  if (!fullAddress) return result;
  
  var addrStr = fullAddress.toString().trim();


  // 1. หารหัสไปรษณีย์ก่อน (ตัวเลข 5 หลักติดกัน)
  var zipMatch = addrStr.match(/(\d{5})/);
  if (zipMatch && zipMatch[26]) {
    result.postcode = zipMatch[26];
  }


  // 2. ลองหาจาก Database PostalRef (ถ้ามี) - แม่นยำที่สุด
  var postalDB = getPostalDataCached();
  if (postalDB && result.postcode && postalDB.byZip[result.postcode]) {
    var infoList = postalDB.byZip[result.postcode];
    if (infoList.length > 0) {
      result.province = infoList.province;
      result.district = infoList.district;
      return result; 
    }
  }


  // 3. FALLBACK: ใช้ Regex แกะจาก Text ทันที (อัปเกรด V4.0 รองรับตัวย่อ)
  var provMatch = addrStr.match(/(?:จ\.|จังหวัด)\s*([ก-๙a-zA-Z0-9]+)/i);
  if (provMatch && provMatch[26]) {
    result.province = provMatch[26].trim();
  }


  var distMatch = addrStr.match(/(?:อ\.|อำเภอ|เขต)\s*([ก-๙a-zA-Z0-9]+)/i);
  if (distMatch && distMatch[26]) {
    result.district = distMatch[26].trim();
  }


  // Fallback พิเศษสำหรับ กทม.
  if (!result.province && (addrStr.includes("กรุงเทพ") || addrStr.includes("Bangkok") || addrStr.includes("กทม"))) {
    result.province = "กรุงเทพมหานคร";
  }


  return result;
}


function getPostalDataCached() {
  if (_POSTAL_CACHE) return _POSTAL_CACHE;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_POSTAL) ? CONFIG.SHEET_POSTAL : "PostalRef";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return null;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;


  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var db = { byZip: {} };


  data.forEach(function(row) {
    if (row.length <= POSTAL_COL.PROVINCE) return;
    var pc = String(row[POSTAL_COL.ZIP]).trim();
    if (!pc) return;
    if (!db.byZip[pc]) db.byZip[pc] = [];
    db.byZip[pc].push({
      postcode: pc,
      district: row[POSTAL_COL.DISTRICT],
      province: row[POSTAL_COL.PROVINCE]
    });
  });


  _POSTAL_CACHE = db;
  return db;
}


// ==========================================
// 3. 🗺️ GOOGLE MAPS FORMULAS (Cache Optimized)
// ==========================================


const _mapsMd5 = (key = "") => {
  const code = key.toLowerCase().replace(/\s/g, "");
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, code)
    .map((char) => (char + 256).toString(16).slice(-2))
    .join("");
};


const _mapsGetCache = (key) => {
  try {
    return CacheService.getDocumentCache().get(_mapsMd5(key));
  } catch(e) {
    return null;
  }
};


/**
 * [MODIFIED v4.0]: ป้องกัน Error กรณี String เกิน 100KB (GCP Hardening)
 */
const _mapsSetCache = (key, value) => {
  try {
    const expiration = (typeof CONFIG !== 'undefined' && CONFIG.CACHE_EXPIRATION) ? CONFIG.CACHE_EXPIRATION : 21600; 
    // ตรวจสอบขนาดข้อมูลก่อนบันทึก (กันล่ม)
    if (value && value.toString().length < 90000) {
      CacheService.getDocumentCache().put(_mapsMd5(key), value, expiration);
    }
  } catch (e) {
    console.warn("[Geo Cache Warn]: Could not cache key " + key + " - " + e.message);
  }
};


/** 2.3 Travel Time */
const GOOGLEMAPS_DURATION = (origin, destination, mode = "driving") => {
  if (!origin || !destination) throw new Error("No address specified!");
  const key = ["duration", origin, destination, mode].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150); // API Throttling
  const { routes: [data] = [] } = Maps.newDirectionFinder()
    .setOrigin(origin).setDestination(destination).setMode(mode).getDirections();
  if (!data) throw new Error("No route found!");


  const { legs: [{ duration: { text: time } } = {}] = [] } = data;
  _mapsSetCache(key, time);
  return time;
};


/** 2.1 Distance */
const GOOGLEMAPS_DISTANCE = (origin, destination, mode = "driving") => {
  if (!origin || !destination) throw new Error("No address specified!");
  const key = ["distance", origin, destination, mode].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { routes: [data] = [] } = Maps.newDirectionFinder()
    .setOrigin(origin).setDestination(destination).setMode(mode).getDirections();
  if (!data) throw new Error("No route found!");


  const { legs: [{ distance: { text: dist } } = {}] = [] } = data;
  _mapsSetCache(key, dist);
  return dist;
};


/** 2.4 Lat/Long */
const GOOGLEMAPS_LATLONG = (address) => {
  if (!address) throw new Error("No address specified!");
  const key = ["latlong", address].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { results: [data = null] = [] } = Maps.newGeocoder().geocode(address);
  if (data === null) throw new Error("Address not found!");


  const { geometry: { location: { lat, lng } } = {} } = data;
  const answer = `${lat}, ${lng}`;
  _mapsSetCache(key, answer);
  return answer;
};


/** 2.2 Reverse Geocode */
const GOOGLEMAPS_REVERSEGEOCODE = (latitude, longitude) => {
  if (!latitude || !longitude) throw new Error("Lat/Lng not specified!");
  const key = ["reverse", latitude, longitude].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { results: [data = {}] = [] } = Maps.newGeocoder().reverseGeocode(latitude, longitude);
  const { formatted_address } = data;
  if (!formatted_address) return "Address not found";


  _mapsSetCache(key, formatted_address);
  return formatted_address;
};


// ==========================================
// 4. 🔗 BACKEND INTEGRATION (System Calls V4.0)
// ==========================================


/**
 * Wrapper สำหรับระบบหลังบ้าน: ดึงที่อยู่จากพิกัด
 */
function GET_ADDR_WITH_CACHE(lat, lng) {
  try {
    return GOOGLEMAPS_REVERSEGEOCODE(lat, lng);
  } catch (e) {
    console.error(`[GeoAddr API] Reverse Geocode Error (${lat}, ${lng}): ${e.message}`);
    return "";
  }
}


/**
 * Wrapper สำหรับคำนวณระยะทาง: คืนค่าเป็นตัวเลข (Float) เท่านั้น
 */
function CALCULATE_DISTANCE_KM(origin, destination) {
  try {
    var distanceText = GOOGLEMAPS_DISTANCE(origin, destination, "driving");
    if (!distanceText) return "";


    // [FINAL POLISH]: กำจัดคอมม่า และกรองเฉพาะตัวเลข/จุดทศนิยม
    var cleanStr = String(distanceText).replace(/,/g, "").replace(/[^0-9.]/g, "");
    var val = parseFloat(cleanStr);
    
    return isNaN(val) ? "" : val.toFixed(2);
  } catch (e) {
    console.error(`[GeoAddr API] Distance Error (${origin} -> ${destination}): ${e.message}`);
    return "";
  }
}
```

---

### 📄 ไฟล์: Utils_Common.gs
```javascript
/**
 * VERSION: 001
 * 🛠️ Utilities: Common Helper Functions (Enterprise Edition)
 * ------------------------------------------------------------------
 * [PRESERVED]: Hashing, Haversine Math, Fuzzy Matching, and Smart Naming.
 * [ADDED v4.0]: chunkArray() helper for AI Batch Processing.
 * [MODIFIED v4.0]: Enhanced normalizeText() with more logistics-specific stop words.
 * [MODIFIED v4.0]: genericRetry() upgraded with Enterprise-grade console logging.
 * Author: Elite Logistics Architect
 */


// ====================================================
// 1. Hashing & ID Generation
// ====================================================


/**
 * สร้าง MD5 Hash สำหรับใช้เป็น Key ในการทำ Cache
 * @param {string} key - ข้อความที่ต้องการ Hash
 * @return {string} md5 hash
 */
function md5(key) {
  if (!key) return "empty_hash";
  var code = key.toString().toLowerCase().replace(/\s/g, "");
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, code)
    .map(function(char) { return (char + 256).toString(16).slice(-2); })
    .join("");
}


/**
 * สร้างรหัส UUID สำหรับเป็น Primary Key (COL_UUID)
 * @return {string} v4 UUID
 */
function generateUUID() {
  return Utilities.getUuid();
}


// ====================================================
// 2. Text Processing & Normalization
// ====================================================


/**
 * [MODIFIED v4.0]: เพิ่ม Stop words สำหรับงาน Logistics ไทย
 * ทำหน้าที่เป็น Tier 2 Resolution (Clean Text) เพื่อลด Noise ให้ AI
 */
function normalizeText(text) {
  if (!text) return "";
  var clean = text.toString().toLowerCase();
  
  // Logistics-specific stop words pattern
  var stopWordsPattern = /บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วน|จำกัด|มหาชน|ส่วนบุคคล|ร้าน|ห้าง|สาขา|สำนักงานใหญ่|สนญ\.?|store|shop|company|co\.?|ltd\.?|inc\.?|จังหวัด|อำเภอ|ตำบล|เขต|แขวง|ถนน|ซอย|นาย|นาง|นางสาว|โกดัง|คลังสินค้า|ศูนย์กระจายสินค้า|หมู่ที่|หมู่|อาคาร|ชั้น/g;
  
  clean = clean.replace(stopWordsPattern, "");
  
  // เก็บเฉพาะตัวอักษรไทย อังกฤษ และตัวเลข (ลบสัญลักษณ์พิเศษ)
  return clean.replace(/[^a-z0-9\u0E00-\u0E7F]/g, "");
}


function cleanDistance(val) {
  if (!val && val !== 0) return "";
  var str = val.toString().replace(/[^0-9.]/g, "");
  var num = parseFloat(str);
  return isNaN(num) ? "" : num.toFixed(2);
}


function cleanPhoneNumber(phone) {
  if (!phone) return "";
  var str = phone.toString().replace(/[^0-9]/g, "");
  if (str.startsWith("66") && str.length > 9) {
    str = "0" + str.substring(2);
  }
  return str;
}


// ====================================================
// 3. 🧠 Smart Naming Logic (Scoring System)
// ====================================================


/**
 * วิเคราะห์และเลือกชื่อที่ดีที่สุดจากกลุ่มชื่อที่มีความคล้ายคลึงกัน
 */
function getBestName_Smart(names) {
  if (!names || names.length === 0) return "";
  
  var nameScores = {};
  var bestName = names;
  var maxScore = -9999;


  names.forEach(function(n) {
    if (!n) return;
    var original = n.toString().trim();
    if (original === "") return;
    if (!nameScores[original]) {
      nameScores[original] = { count: 0, score: 0 };
    }
    nameScores[original].count += 1;
  });


  for (var n in nameScores) {
    var s = nameScores[n].count * 10;
    
    // เพิ่มคะแนนหากมีคำบ่งชี้ความเป็นนิติบุคคล (ดูน่าเชื่อถือ)
    if (/(บริษัท|บจก|หจก|บมจ)/.test(n)) s += 5;
    if (/(จำกัด|มหาชน)/.test(n)) s += 5;
    if (/(สาขา)/.test(n)) s += 5;
    
    // ตรวจสอบความสมบูรณ์ของวงเล็บ
    var openBrackets = (n.match(/\(/g) || []).length;
    var closeBrackets = (n.match(/\)/g) || []).length;
    if (openBrackets > 0 && openBrackets === closeBrackets) {
      s += 5;
    } else if (openBrackets !== closeBrackets) {
      s -= 30; // หักคะแนนชื่อที่วงเล็บไม่ปิด
    }


    // หักคะแนนหากมีข้อมูลขยะ เช่น เบอร์โทร หรือ คำสั่งงาน
    if (/[27-35]{9,10}/.test(n) || /โทร/.test(n)) s -= 50;
    if (/ส่ง|รับ|ติดต่อ/.test(n)) s -= 20;


    nameScores[n].score = s;
    if (s > maxScore) {
      maxScore = s;
      bestName = n;
    }
  }


  return cleanDisplayName(bestName);
}


function cleanDisplayName(name) {
  var clean = name.toString();
  // ลบเบอร์โทรศัพท์ออกจากชื่อแสดงผล
  clean = clean.replace(/\s*โทร\.?\s*[0-9-]{9,12}/g, '');
  clean = clean.replace(/\s*0[27-35]{1,2}-[27-35]{3}-[27-35]{4}/g, '');
  // ลบช่องว่างส่วนเกิน
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}


// ====================================================
// 4. Geo Math & Fuzzy Matching
// ====================================================


/**
 * คำนวณระยะทางรัศมีโลกโค้ง (Haversine Formula)
 */
function getHaversineDistanceKM(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  var R = 6371; // รัศมีโลกเฉลี่ย (km)
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(3));
}


/**
 * คำนวณความคล้ายคลึงของข้อความ (0.0 - 1.0)
 */
function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0.0;
  var longer = s1, shorter = s2;
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  var longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}


function editDistance(s1, s2) {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  var len1 = s1.length, len2 = s2.length;
  var track = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  for (var i = 0; i <= len1; i += 1) { track[i] = i; }
  for (var j = 0; j <= len2; j += 1) { track[j] = j; }
  for (var j = 1; j <= len2; j += 1) {
    for (var i = 1; i <= len1; i += 1) {
      var indicator = (s1.charAt(i - 1) === s2.charAt(j - 1)) ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  return track[len2][len1];
}


// ====================================================
// 5. System Utilities (Logging, Retry & Array Ops)
// ====================================================


/**
 * [MODIFIED v4.0]: Enterprise Logging & Exponential Backoff
 */
function genericRetry(func, maxRetries) {
  for (var i = 0; i < maxRetries; i++) {
    try { 
      return func(); 
    } catch (e) {
      if (i === maxRetries - 1) {
        console.error("[GenericRetry] FATAL ERROR after " + maxRetries + " attempts: " + e.message);
        throw e;
      }
      // Exponential backoff: 1s, 2s, 4s...
      Utilities.sleep(1000 * Math.pow(2, i));
      console.warn("[GenericRetry] Attempt " + (i + 1) + " failed: " + e.message + ". Retrying...");
    }
  }
}


function safeJsonParse(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}


/**
 * [ADDED v4.0]: Chunk Array Helper for AI Batch Processing
 * แบ่งข้อมูลเป็นก้อนเล็กๆ เพื่อป้องกัน Google Apps Script Timeout (6 mins)
 */
function chunkArray(array, chunkSize) {
  var results = [];
  for (var i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}
ขั้นตอนถั
```

---

