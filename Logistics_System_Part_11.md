# 🚛 Logistics Master Data System V4.0 - Part 1/3

## 🛠️ ขั้นตอนการติดตั้ง (Setup Guide)

1. สร้างโปรเจกต์ใหม่ใน [Google Apps Script](https://script.google.com/)
2. สร้างไฟล์ตามชื่อที่ระบุ (Script .gs หรือ HTML .html)
3. Copy โค้ดจากทั้ง 3 ส่วนไปวางในไฟล์ที่สร้างขึ้น
4. รันฟังก์ชัน `setupEnvironment()` ใน `Setup_Security.gs` เพื่อตั้งค่า API Key

### 📄 ไฟล์: Config.gs
```javascript
/**
 * VERSION: 000
 * 🚛 Logistics Master Data System - Configuration V4.0 (Enterprise Edition)
 * ------------------------------------------------------------------
 * [PRESERVED]: โครงสร้างเดิมทั้งหมดได้รับการรักษาไว้ (Preservation Protocol)
 * [ADDED v4.0]: กำหนดคอลัมน์ NameMapping สำหรับ 4-Tier Smart Resolution
 * [ADDED v4.0]: ตัวแปรควบคุม AI Batch Size และ Cache Expiration
 * [MODIFIED]: อัปเกรดระบบ Logging เป็น console.log/error สำหรับ GCP Monitoring
 * Author: Elite Logistics Architect
 */


var CONFIG = {
  // --- SHEET NAMES ---
  SHEET_NAME: "Database",
  MAPPING_SHEET: "NameMapping",
  SOURCE_SHEET: "SCGนครหลวงJWDภูมิภาค",
  SHEET_POSTAL: "PostalRef", // รองรับ Service_GeoAddr


  // --- 🧠 AI CONFIGURATION (SECURED) ---
  // วิธีตั้งค่า: รันฟังก์ชัน setupEnvironment() ในไฟล์ Setup_Security.gs
  get GEMINI_API_KEY() {
    var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!key) throw new Error("CRITICAL ERROR: GEMINI_API_KEY is not set. Please run setupEnvironment() first.");
    return key;
  },
  USE_AI_AUTO_FIX: true,
  AI_MODEL: "gemini-1.5-flash", 
  AI_BATCH_SIZE: 20, // [ADDED v4.0]: จำกัดจำนวนส่งให้ AI ครั้งละ 20 รายการเพื่อไม่ให้เกิน 6 นาที


  // --- 🔴 DEPOT LOCATION ---
  DEPOT_LAT: 14.164688, 
  DEPOT_LNG: 100.625354,


  // --- SYSTEM THRESHOLDS & LIMITS ---
  DISTANCE_THRESHOLD_KM: 0.05, 
  BATCH_LIMIT: 50,  
  DEEP_CLEAN_LIMIT: 100,
  API_MAX_RETRIES: 3,       // จำนวนครั้งที่จะลองใหม่ถ้า API SCG ล่ม
  API_TIMEOUT_MS: 30000,    // เวลา Timeout (30 วิ)
  CACHE_EXPIRATION: 21600,  // [ADDED v4.0]: เวลา Cache (วินาที) -> 6 ชั่วโมง (สำหรับ Geo Maps)


  // --- DATABASE COLUMNS INDEX (1-BASED) ---
  COL_NAME: 1,       // A: ชื่อลูกค้า
  COL_LAT: 2,        // B: Latitude
  COL_LNG: 3,        // C: Longitude
  COL_SUGGESTED: 4,  // D: ชื่อที่ระบบแนะนำ
  COL_CONFIDENCE: 5, // E: ความมั่นใจ
  COL_NORMALIZED: 6, // F: ชื่อที่ Clean แล้ว
  COL_VERIFIED: 7,   // G: สถานะตรวจสอบ (Checkbox)
  COL_SYS_ADDR: 8,   // H: ที่อยู่จากระบบต้นทาง
  COL_ADDR_GOOG: 9,  // I: ที่อยู่จาก Google Maps
  COL_DIST_KM: 10,   // J: ระยะทางจากคลัง
  COL_UUID: 11,      // K: Unique ID
  COL_PROVINCE: 12,  // L: จังหวัด
  COL_DISTRICT: 13,  // M: อำเภอ
  COL_POSTCODE: 14,  // N: รหัสไปรษณีย์
  COL_QUALITY: 15,   // O: Quality Score
  COL_CREATED: 16,   // P: วันที่สร้าง (Created)
  COL_UPDATED: 17,   // Q: วันที่แก้ไขล่าสุด (Updated)


  // --- [NEW v4.0] NAMEMAPPING COLUMNS INDEX (1-BASED) ---
  // เตรียมโครงสร้างให้ AI ทำการ Map ชื่อสกปรกเข้ากับชื่อจริง
  MAP_COL_VARIANT: 1,    // A: Variant_Name (ชื่อแปลกๆ เช่น บจก. เอบีซี, เอบีซี จำกัด)
  MAP_COL_UID: 2,        // B: Master_UID (รหัสอ้างอิง Database หรือชื่อจริง)
  MAP_COL_CONFIDENCE: 3, // C: Confidence_Score (ความมั่นใจ AI 0-100)
  MAP_COL_MAPPED_BY: 4,  // D: Mapped_By (Human / AI)
  MAP_COL_TIMESTAMP: 5,  // E: Timestamp (เวลาที่อัปเดต)


  // --- DATABASE ARRAY INDEX MAPPING (0-BASED) ---
  get C_IDX() {
    return {
      NAME: this.COL_NAME - 1,
      LAT: this.COL_LAT - 1,
      LNG: this.COL_LNG - 1,
      SUGGESTED: this.COL_SUGGESTED - 1,
      CONFIDENCE: this.COL_CONFIDENCE - 1,
      NORMALIZED: this.COL_NORMALIZED - 1,
      VERIFIED: this.COL_VERIFIED - 1,
      SYS_ADDR: this.COL_SYS_ADDR - 1,
      GOOGLE_ADDR: this.COL_ADDR_GOOG - 1,
      DIST_KM: this.COL_DIST_KM - 1,
      UUID: this.COL_UUID - 1,
      PROVINCE: this.COL_PROVINCE - 1,
      DISTRICT: this.COL_DISTRICT - 1,
      POSTCODE: this.COL_POSTCODE - 1,
      QUALITY: this.COL_QUALITY - 1,
      CREATED: this.COL_CREATED - 1,
      UPDATED: this.COL_UPDATED - 1
    };
  },


  // --- [NEW v4.0] NAMEMAPPING ARRAY INDEX (0-BASED) ---
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


// --- SCG SPECIFIC CONFIG ---
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
  
  // Mapping คอลัมน์ของ SCG JSON Response
  JSON_MAP: {
    SHIPMENT_NO: 'shipmentNo',
    CUSTOMER_NAME: 'customerName',
    DELIVERY_DATE: 'deliveryDate'
  }
};


/**
 * [ENHANCED v4.0] System Health Check
 * ตรวจสอบความพร้อมของ Sheet และ Config ก่อนเริ่มงาน
 */
CONFIG.validateSystemIntegrity = function() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var errors = [];


  // 1. Check Sheets Existence (เพิ่มการตรวจสอบ SHEET_POSTAL)
  var requiredSheets = [this.SHEET_NAME, this.MAPPING_SHEET, SCG_CONFIG.SHEET_INPUT, this.SHEET_POSTAL];
  requiredSheets.forEach(function(name) {
    if (!ss.getSheetByName(name)) errors.push("Missing Sheet: " + name);
  });


  // 2. Check API Key
  try {
    var key = this.GEMINI_API_KEY; 
    if (!key || key.length < 20) errors.push("Invalid Gemini API Key format");
  } catch (e) {
    errors.push("Gemini API Key is not set in ScriptProperties. Please run setupEnvironment() first.");
  }


  // 3. Report
  if (errors.length > 0) {
    var msg = "⚠️ SYSTEM INTEGRITY FAILED:\n" + errors.join("\n");
    console.error(msg); // [MODIFIED]: ใช้ console.error สำหรับ Enterprise Monitoring
    throw new Error(msg);
  } else {
    console.log("✅ System Integrity: OK"); // [MODIFIED]: ใช้ console.log
    return true;
  }
};
```

---

### 📄 ไฟล์: Menu.gs
```javascript
/**
 * VERSION: 000
 * 🖥️ MODULE: Menu UI Interface
 * Version: 4.1 Enterprise Edition (UI Text Fix)
 * ---------------------------------------------------
 * [FIXED v4.1]: Dynamic UI Alert pulling exact sheet names from CONFIG.
 * Author: Elite Logistics Architect
 */


function onOpen() {
  var ui = SpreadsheetApp.getUi();
  
  // =================================================================
  // 🚛 เมนูชุดที่ 1: ระบบจัดการ Master Data (Operation)
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
      )
      .addToUi();


  // =================================================================
  // 📦 เมนูชุดที่ 2: เมนูพิเศษ SCG (Daily Operation)
  // =================================================================
  ui.createMenu('📦 2. เมนูพิเศษ SCG') 
    .addItem('📥 1. โหลดข้อมูล Shipment (+E-POD)', 'fetchDataFromSCGJWD')
    .addItem('🟢 2. อัปเดตพิกัด + อีเมลพนักงาน', 'applyMasterCoordinatesToDailyJob')
    .addSeparator()
    .addSubMenu(ui.createMenu('🧹 เมนูล้างข้อมูล (Dangerous Zone)')
    .addItem('⚠️ ล้างเฉพาะชีต Data', 'clearDataSheet_UI')
    .addItem('⚠️ ล้างเฉพาะชีต Input', 'clearInputSheet_UI')
    .addItem('⚠️ ล้างเฉพาะชีต สรุป_เจ้าของสินค้า', 'clearSummarySheet_UI') // ← เพิ่ม
    .addItem('🔥 ล้างทั้งหมด (Input + Data + สรุป)', 'clearAllSCGSheets_UI') // ← แก้ชื่อ
)
    .addToUi();


  // =================================================================
  // 🤖 เมนูชุดที่ 3: ระบบอัตโนมัติ (Automation)
  // =================================================================
  ui.createMenu('🤖 3. ระบบอัตโนมัติ')
    .addItem('▶️ เปิดระบบช่วยเหลืองาน (Auto-Pilot)', 'START_AUTO_PILOT')
    .addItem('⏹️ ปิดระบบช่วยเหลือ', 'STOP_AUTO_PILOT')
    .addToUi();


  // =================================================================
  // ⚙️ เมนูชุดที่ 4: System Admin
  // =================================================================
  ui.createMenu('⚙️ System Admin')
    .addItem('🏥 ตรวจสอบสถานะระบบ (Health Check)', 'runSystemHealthCheck')
    .addItem('🧹 ล้าง Backup เก่า (>30 วัน)', 'cleanupOldBackups')
    .addItem('📊 เช็คปริมาณข้อมูล (Cell Usage)', 'checkSpreadsheetHealth')
    .addSeparator()
    .addItem('🔔 ตั้งค่า LINE Notify', 'setupLineToken')
    .addItem('✈️ ตั้งค่า Telegram Notify', 'setupTelegramConfig')
    .addItem('🔐 ตั้งค่า API Key (Setup)', 'setupEnvironment')
    .addToUi();
}


// =================================================================
// 🛡️ SAFETY WRAPPERS
// =================================================================


/**
 * Wrapper: ยืนยันก่อนดึงข้อมูลลูกค้าใหม่
 * [FIXED v4.1]: ปรับข้อความให้ดึงชื่อจากตัวแปร Config จริงๆ
 */
function syncNewDataToMaster_UI() {
  var ui = SpreadsheetApp.getUi();
  var sourceName = (typeof CONFIG !== 'undefined' && CONFIG.SOURCE_SHEET) ? CONFIG.SOURCE_SHEET : 'ชีตนำเข้า';
  var dbName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : 'Database';
  
  var result = ui.alert(
    'ยืนยันการดึงข้อมูลใหม่?',
    'ระบบจะดึงรายชื่อลูกค้าจากชีต "' + sourceName + '"\nมาเพิ่มต่อท้ายในชีต "' + dbName + '"\n(เฉพาะรายชื่อที่ยังไม่เคยมีในระบบ)\n\nคุณต้องการดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    syncNewDataToMaster();
  }
}


function runAIBatchResolver_UI() {
  var ui = SpreadsheetApp.getUi();
  var batchSize = (typeof CONFIG !== 'undefined' && CONFIG.AI_BATCH_SIZE) ? CONFIG.AI_BATCH_SIZE : 20;
  
  var result = ui.alert(
    '🧠 ยืนยันการรัน AI Smart Resolution?',
    'ระบบจะรวบรวมชื่อที่ยังหาพิกัดไม่เจอ/ไม่รู้จัก (สูงสุด ' + batchSize + ' รายการ)\nส่งให้ Gemini AI วิเคราะห์และจับคู่กับ Database อัตโนมัติ\n\nต้องการเริ่มเลยหรือไม่?',
    ui.ButtonSet.YES_NO
  );
  
  if (result == ui.Button.YES) {
    if (typeof resolveUnknownNamesWithAI === 'function') {
       resolveUnknownNamesWithAI();
    } else {
       ui.alert(
         '⚠️ System Note', 
         'ฟังก์ชัน AI (Service_Agent.gs) กำลังอยู่ระหว่างการติดตั้ง (Coming soon!)\nกรุณารออัปเดตโมดูลถัดไปครับ', 
         ui.ButtonSet.OK
       );
    }
  }
}


function finalizeAndClean_UI() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    '⚠️ ยืนยันการจบงาน (Finalize)?',
    'รายการที่ติ๊กถูก "Verified" จะถูกย้ายไปยัง NameMapping และลบออกจาก Database\nข้อมูลต้นฉบับจะถูก Backup ไว้\n\nยืนยันหรือไม่?',
    ui.ButtonSet.OK_CANCEL
  );
  if (result == ui.Button.OK) {
    finalizeAndClean_MoveToMapping();
  }
}


function resetDeepCleanMemory_UI() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    'ยืนยันการรีเซ็ต?',
    'ระบบจะเริ่มตรวจสอบ Deep Clean ตั้งแต่แถวแรกใหม่\nใช้ในกรณีที่ต้องการ Re-check ข้อมูลทั้งหมด',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    resetDeepCleanMemory();
  }
}


function clearDataSheet_UI() {
  confirmAction('ล้างชีต Data', 'ข้อมูลผลลัพธ์ทั้งหมดจะหายไป', clearDataSheet);
}


function clearInputSheet_UI() {
  confirmAction('ล้างชีต Input', 'ข้อมูลนำเข้า (Shipment) ทั้งหมดจะหายไป', clearInputSheet);
}


function clearAllSCGSheets_UI() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    '🔥 DANGER: ยืนยันการล้างข้อมูลทั้งหมด?',
    'ชีต Input และ Data จะถูกล้างว่างเปล่า!\nกรุณาตรวจสอบว่าเซฟงานแล้ว หรือไม่ต้องการข้อมูลชุดนี้แล้วจริงๆ',
    ui.ButtonSet.YES_NO
  );
  if (result == ui.Button.YES) {
    clearAllSCGSheets();
  }
}


function repairNameMapping_UI() {
  confirmAction('ซ่อมแซม NameMapping', 'ระบบจะลบแถวซ้ำและเติม UUID ให้ครบ', repairNameMapping_Full);
}


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
        "ระบบพร้อมทำงานสมบูรณ์ครับ!\n- โครงสร้างชีตครบถ้วน\n- เชื่อมต่อ API (Gemini) พร้อมใช้งาน",
        ui.ButtonSet.OK
      );
    } else {
      ui.alert("⚠️ System Warning", "Config check skipped (CONFIG.validateSystemIntegrity ไม่ทำงาน)", ui.ButtonSet.OK);
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
 * VERSION: 000
 * 🧠 Service: Master Data Management
 * Version: 4.1 Checkbox Bugfix
 * -----------------------------------------------------------
 * [FIXED v4.1]: Created getRealLastRow_() to ignore pre-filled checkboxes.
 * Data will now append exactly after the last actual customer name.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. IMPORT & SYNC
// ==========================================


/**
 * 🛠️ [NEW v4.1] Helper หาแถวสุดท้ายจริงๆ โดยดูจากคอลัมน์ชื่อลูกค้า (ข้าม Checkbox)
 */
function getRealLastRow_(sheet, columnIndex) {
  var data = sheet.getRange(1, columnIndex, sheet.getMaxRows(), 1).getValues();
  for (var i = data.length - 1; i >= 0; i--) {
    // ถ้าช่องนั้นไม่ว่างเปล่า ไม่เป็น null และไม่เป็น boolean (Checkbox)
    if (data[i][0] !== "" && data[i][0] !== null && typeof data[i][0] !== 'boolean') {
      return i + 1;
    }
  }
  return 1; // ถ้าชีตว่างเปล่าเลย
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
    
    if (!sourceSheet || !masterSheet) { 
      ui.alert("❌ CRITICAL: ไม่พบ Sheet (Source หรือ Database)"); 
      return; 
    }


    var SRC_IDX = { 
      NAME: 12,      // Col 13 (M)
      LAT: 14,       // Col 15 (O)
      LNG: 15,       // Col 16 (P)
      SYS_ADDR: 18,  // Col 19 (S)
      DIST: 23,      // Col 24 (X)
      GOOG_ADDR: 24  // Col 25 (Y)
    };


    // [FIXED v4.1] ใช้ getRealLastRow_ เพื่อหลบ Checkbox ที่ทำเผื่อไว้ล่วงหน้า
    var lastRowM = getRealLastRow_(masterSheet, CONFIG.COL_NAME);
    var existingNames = new Set(); 
    
    // Load Existing Names
    if (lastRowM > 1) {
      var mData = masterSheet.getRange(2, CONFIG.COL_NAME, lastRowM - 1, 1).getValues();
      mData.forEach(function(r) { 
        if (r[0]) existingNames.add(normalizeText(r[0])); 
      });
    }


    var lastRowS = sourceSheet.getLastRow();
    if (lastRowS < 2) {
      ui.alert("ℹ️ ไม่มีข้อมูลในชีตต้นทาง");
      return;
    }
    
    // Read Source Data
    var sData = sourceSheet.getRange(2, 1, lastRowS - 1, 25).getValues();
    var newEntries = [];
    var currentBatch = new Set(); 


    sData.forEach(function(row) {
      var name = row[SRC_IDX.NAME];
      var lat = row[SRC_IDX.LAT];
      var lng = row[SRC_IDX.LNG];
      
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
        newRow[CONFIG.C_IDX.DIST_KM] = cleanDistance_Helper(row[SRC_IDX.DIST]); 
        
        newRow[CONFIG.C_IDX.UUID] = generateUUID(); 
        newRow[CONFIG.C_IDX.CREATED] = new Date(); 
        newRow[CONFIG.C_IDX.UPDATED] = new Date();
        
        newEntries.push(newRow);
        currentBatch.add(clean);
      }
    });


    if (newEntries.length > 0) {
      // เขียนต่อท้ายบรรทัดจริงๆ ไม่ใช่บรรทัด Checkbox
      masterSheet.getRange(lastRowM + 1, 1, newEntries.length, 17).setValues(newEntries);
      console.log("Sync Complete: Added " + newEntries.length + " rows.");
      ui.alert("✅ นำเข้าข้อมูลใหม่สำเร็จ: " + newEntries.length + " รายการ\nต่อท้ายที่แถว " + (lastRowM + 1));
    } else {
      ui.alert("👌 ฐานข้อมูลเป็นปัจจุบันแล้ว (ไม่มีข้อมูลลูกค้าใหม่จากชีตต้นทาง)");
    }


  } catch (error) {
    console.error("Sync Error: " + error.message);
    ui.alert("❌ เกิดข้อผิดพลาด: " + error.message);
  } finally {
    lock.releaseLock(); 
  }
}


function cleanDistance_Helper(val) {
  if (!val) return "";
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '').replace('km', '').trim()) || "";
}


// ==========================================
// (ส่วนที่เหลือทั้งหมดดึงมาจาก V4.0 เหมือนเดิม เพื่อให้ครบไฟล์)
// ==========================================


function updateGeoData_SmartCache() { runDeepCleanBatch_100(); }
function autoGenerateMasterList_Smart() { processClustering_GridOptimized(); }


function runDeepCleanBatch_100() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;


  var lastRow = getRealLastRow_(sheet, CONFIG.COL_NAME);
  if (lastRow < 2) return;


  var props = PropertiesService.getScriptProperties();
  var startRow = parseInt(props.getProperty('DEEP_CLEAN_POINTER') || '2');
  
  if (startRow > lastRow) {
    ui.alert("🎉 ตรวจครบทุกแถวแล้ว (Pointer Reset)");
    props.deleteProperty('DEEP_CLEAN_POINTER');
    return;
  }


  var endRow = Math.min(startRow + CONFIG.DEEP_CLEAN_LIMIT - 1, lastRow);
  var numRows = endRow - startRow + 1;
  
  var range = sheet.getRange(startRow, 1, numRows, 17);
  var values = range.getValues();
  
  var origin = CONFIG.DEPOT_LAT + "," + CONFIG.DEPOT_LNG;
  var updatedCount = 0;


  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var lat = row[CONFIG.C_IDX.LAT];
    var lng = row[CONFIG.C_IDX.LNG];
    var changed = false;


    if (lat && lng && !row[CONFIG.C_IDX.GOOGLE_ADDR]) {
      try {
        var addr = GET_ADDR_WITH_CACHE(lat, lng); 
        if (addr && addr !== "Error") {
          row[CONFIG.C_IDX.GOOGLE_ADDR] = addr;
          changed = true;
        }
      } catch (e) { console.warn("Geo Error: " + e.message); }
    }


    if (lat && lng && !row[CONFIG.C_IDX.DIST_KM]) {
      var km = CALCULATE_DISTANCE_KM(origin, lat + "," + lng); 
      if (km) { row[CONFIG.C_IDX.DIST_KM] = km; changed = true; }
    }
    
    if (!row[CONFIG.C_IDX.UUID]) { 
      row[CONFIG.C_IDX.UUID] = generateUUID(); 
      row[CONFIG.C_IDX.CREATED] = row[CONFIG.C_IDX.CREATED] || new Date(); 
      changed = true; 
    }


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


    if (changed) {
       row[CONFIG.C_IDX.UPDATED] = new Date();
       updatedCount++;
    }
  }


  if (updatedCount > 0) range.setValues(values);
  props.setProperty('DEEP_CLEAN_POINTER', (endRow + 1).toString());
  ss.toast("✅ Processed rows " + startRow + "-" + endRow + " (Updated: " + updatedCount + ")", "Deep Clean");
}


function resetDeepCleanMemory() {
  PropertiesService.getScriptProperties().deleteProperty('DEEP_CLEAN_POINTER');
  SpreadsheetApp.getActiveSpreadsheet().toast("🔄 Memory Reset: ระบบถูกรีเซ็ต จะเริ่มตรวจสอบแถวที่ 2 ในรอบถัดไป", "System Ready");
}


function finalizeAndClean_MoveToMapping() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { 
    ui.alert("⚠️ ระบบคิวทำงาน", "มีผู้ใช้งานอื่นกำลังแก้ไขฐานข้อมูล กรุณารอสักครู่", ui.ButtonSet.OK);
    return;
  }


  try {
    var masterSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
    
    if (!masterSheet || !mapSheet) { ui.alert("❌ Error: Missing Sheets"); return; }
    
    var lastRow = getRealLastRow_(masterSheet, CONFIG.COL_NAME);
    if (lastRow < 2) { ui.alert("ℹ️ Database is empty."); return; }


    var allData = masterSheet.getRange(2, 1, lastRow - 1, 17).getValues();
    var uuidMap = {};
    
    allData.forEach(function(row) {
      var uuid = row[CONFIG.C_IDX.UUID];
      if (uuid) {
        var n = normalizeText(row[CONFIG.C_IDX.NAME]);
        var s = normalizeText(row[CONFIG.C_IDX.SUGGESTED]);
        if (n) uuidMap[n] = uuid;
        if (s) uuidMap[s] = uuid;
      }
    });


    var backupName = "Backup_DB_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmm");
    masterSheet.copyTo(ss).setName(backupName);


    var rowsToKeep = [];       
    var mappingToUpload = []; 
    var processedNames = new Set(); 


    for (var i = 0; i < allData.length; i++) {
      var row = allData[i];
      var rawName = row[CONFIG.C_IDX.NAME];
      var suggestedName = row[CONFIG.C_IDX.SUGGESTED];
      var isVerified = row[CONFIG.C_IDX.VERIFIED];    
      var currentUUID = row[CONFIG.C_IDX.UUID];


      if (isVerified === true) {
        rowsToKeep.push(row); 
      } 
      else if (suggestedName && suggestedName !== "") {
        if (rawName !== suggestedName && !processedNames.has(rawName)) {
          var targetUUID = uuidMap[normalizeText(suggestedName)] || currentUUID;
          var mapRow = new Array(5).fill("");
          mapRow[CONFIG.MAP_IDX.VARIANT] = rawName;
          mapRow[CONFIG.MAP_IDX.UID] = targetUUID;
          mapRow[CONFIG.MAP_IDX.CONFIDENCE] = 100;
          mapRow[CONFIG.MAP_IDX.MAPPED_BY] = "Human";
          mapRow[CONFIG.MAP_IDX.TIMESTAMP] = new Date();
          
          mappingToUpload.push(mapRow);
          processedNames.add(rawName);
        }
      }
    }


    if (mappingToUpload.length > 0) {
      var lastRowMap = mapSheet.getLastRow();
      mapSheet.getRange(lastRowMap + 1, 1, mappingToUpload.length, 5).setValues(mappingToUpload);
    }


    masterSheet.getRange(2, 1, lastRow, 17).clearContent();
    
    if (rowsToKeep.length > 0) {
      masterSheet.getRange(2, 1, rowsToKeep.length, 17).setValues(rowsToKeep);
      ui.alert("✅ Finalize Complete:\n- New Mappings: " + mappingToUpload.length + "\n- Active Master Data: " + rowsToKeep.length);
    } else {
      masterSheet.getRange(2, 1, allData.length, 17).setValues(allData);
      ui.alert("⚠️ Warning: No Verified rows found. Data restored to original state.");
    }
  } catch (e) {
    console.error("Finalize Error: " + e.message);
    ui.alert("❌ CRITICAL WRITE ERROR: " + e.message + "\nPlease check Backup Sheet.");
  } finally {
    lock.releaseLock();
  }
}


function assignMissingUUIDs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastRow = getRealLastRow_(sheet, CONFIG.COL_NAME);
  if (lastRow < 2) return;


  var range = sheet.getRange(2, CONFIG.COL_UUID, lastRow - 1, 1);
  var values = range.getValues();
  var count = 0;


  var newValues = values.map(function(r) {
    if (!r[0]) {
      count++;
      return [generateUUID()];
    }
    return [r[0]];
  });


  if (count > 0) {
    range.setValues(newValues);
    ui.alert("✅ Generated " + count + " new UUIDs.");
  } else {
    ui.alert("ℹ️ All rows already have UUIDs.");
  }
}


function repairNameMapping_Full() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var dbSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
  
  var dbData = dbSheet.getRange(2, 1, getRealLastRow_(dbSheet, CONFIG.COL_NAME) - 1, CONFIG.COL_UUID).getValues();
  var uuidMap = {};
  dbData.forEach(function(r) {
    if (r[CONFIG.C_IDX.UUID]) {
       uuidMap[normalizeText(r[CONFIG.C_IDX.NAME])] = r[CONFIG.C_IDX.UUID];
    }
  });


  var mapRange = mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 5);
  var mapValues = mapRange.getValues();
  var cleanList = [];
  var seen = new Set();


  mapValues.forEach(function(r) {
    var oldN = r[CONFIG.MAP_IDX.VARIANT];
    var uid = r[CONFIG.MAP_IDX.UID];
    var conf = r[CONFIG.MAP_IDX.CONFIDENCE] || 100; 
    var by = r[CONFIG.MAP_IDX.MAPPED_BY] || "System_Repair";
    var ts = r[CONFIG.MAP_IDX.TIMESTAMP] || new Date();
    
    var normOld = normalizeText(oldN);
    if (!normOld) return;
    
    if (!uid) uid = uuidMap[normalizeText(r[1])] || generateUUID();
    
    if (!seen.has(normOld)) {
      seen.add(normOld);
      var mapRow = new Array(5).fill("");
      mapRow[CONFIG.MAP_IDX.VARIANT] = oldN;
      mapRow[CONFIG.MAP_IDX.UID] = uid;
      mapRow[CONFIG.MAP_IDX.CONFIDENCE] = conf;
      mapRow[CONFIG.MAP_IDX.MAPPED_BY] = by;
      mapRow[CONFIG.MAP_IDX.TIMESTAMP] = ts;
      cleanList.push(mapRow);
    }
  });


  if (cleanList.length > 0) {
    mapSheet.getRange(2, 1, mapSheet.getLastRow(), 5).clearContent();
    mapSheet.getRange(2, 1, cleanList.length, 5).setValues(cleanList);
    ui.alert("✅ Repair Complete. Total Mappings: " + cleanList.length);
  } else {
    ui.alert("ℹ️ No repair needed or mapping is empty.");
  }
}


function processClustering_GridOptimized() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastRow = getRealLastRow_(sheet, CONFIG.COL_NAME);
  if (lastRow < 2) return;


  var range = sheet.getRange(2, 1, lastRow - 1, 15); 
  var values = range.getValues();
  
  var clusters = [];      
  var grid = {};          


  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var lat = r[CONFIG.C_IDX.LAT];
    var lng = r[CONFIG.C_IDX.LNG];
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;


    var gridKey = Math.floor(lat * 10) + "_" + Math.floor(lng * 10);
    
    if (!grid[gridKey]) grid[gridKey] = [];
    grid[gridKey].push(i);


    if (r[CONFIG.C_IDX.VERIFIED] === true) {
      clusters.push({
        lat: lat,
        lng: lng,
        name: r[CONFIG.C_IDX.SUGGESTED] || r[CONFIG.C_IDX.NAME],
        rowIndexes: [i],
        hasLock: true,
        gridKey: gridKey
      });
    }
  }


  for (var i = 0; i < values.length; i++) {
    if (values[i][CONFIG.C_IDX.VERIFIED] === true) continue; 


    var lat = values[i][CONFIG.C_IDX.LAT];
    var lng = values[i][CONFIG.C_IDX.LNG];
    if (!lat || !lng) continue;


    var myGridKey = Math.floor(lat * 10) + "_" + Math.floor(lng * 10);
    var found = false;


    for (var c = 0; c < clusters.length; c++) {
      if (clusters[c].gridKey === myGridKey) { 
        var dist = getHaversineDistanceKM(lat, lng, clusters[c].lat, clusters[c].lng);
        if (dist <= CONFIG.DISTANCE_THRESHOLD_KM) {
          clusters[c].rowIndexes.push(i);
          found = true;
          break;
        }
      }
    }


    if (!found) {
      clusters.push({
        lat: lat,
        lng: lng,
        rowIndexes: [i],
        hasLock: false,
        name: null,
        gridKey: myGridKey
      });
    }
  }


  var updateCount = 0;
  clusters.forEach(function(g) {
    var candidateNames = [];
    g.rowIndexes.forEach(function(idx) { 
        var rawName = values[idx][CONFIG.C_IDX.NAME];
        var existingSuggested = values[idx][CONFIG.C_IDX.SUGGESTED];
        candidateNames.push(rawName); 
        if (existingSuggested && existingSuggested !== rawName) {
            candidateNames.push(existingSuggested, existingSuggested, existingSuggested);
        }
    });


    var winner = g.hasLock ? g.name : getBestName_Smart(candidateNames);
    var confidence = g.rowIndexes.length; 


    g.rowIndexes.forEach(function(idx) {
      if (values[idx][CONFIG.C_IDX.VERIFIED] !== true) {
         var currentSuggested = values[idx][CONFIG.C_IDX.SUGGESTED];
         var currentConfidence = values[idx][CONFIG.C_IDX.CONFIDENCE];
         
         if (currentSuggested !== winner || currentConfidence !== confidence) {
             values[idx][CONFIG.C_IDX.SUGGESTED] = winner;
             values[idx][CONFIG.C_IDX.CONFIDENCE] = confidence;
             values[idx][CONFIG.C_IDX.NORMALIZED] = normalizeText(winner);
             updateCount++;
         }
      }
    });
  });


  if (updateCount > 0) {
    range.setValues(values);
    ss.toast("✅ จัดกลุ่มสำเร็จ! พร้อมอัปเกรดชื่อที่ฉลาดขึ้น (Updated: " + updateCount + " rows)", "Clustering V4.1");
  } else {
    ss.toast("ℹ️ ข้อมูลจัดกลุ่มเรียบร้อยดีอยู่แล้ว ไม่มีการเปลี่ยนแปลง", "Clustering V4.1");
  }
}
```

---

### 📄 ไฟล์: Service_SCG.gs
```javascript
/**
 * VERSION: 000
 * 📦 Service: SCG Operation (Enterprise Edition)
 * Version: 5.0 ScanDocs + Summary Readiness
 * ---------------------------------------------------------
 * [PRESERVED v4.0]: API Retry Mechanism, LockService, Smart Branch Matching
 * [PRESERVED v4.0]: AI NameMapping schema (Variant -> Master_UID -> Coordinates)
 * [UPDATED v5.0]: checkIsEPOD() — Logic ใหม่รองรับ Invoice ทุกช่วงตัวเลข
 * [UPDATED v5.0]: buildOwnerSummary() — เพิ่ม จำนวน_E-POD_ทั้งหมด
 * [ADDED v5.0]: buildShipmentSummary() — สรุปตาม Shipment+TruckLicense
 * [ADDED v5.0]: clearShipmentSummarySheet() + UI
 * [UPDATED v5.0]: clearAllSCGSheets_UI() — ล้าง 4 ชีต
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. MAIN OPERATION: FETCH DATA
// ==========================================


function fetchDataFromSCGJWD() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();


  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    ui.alert("⚠️ ระบบคิวทำงาน", "มีผู้ใช้งานอื่นกำลังโหลดข้อมูล Shipment อยู่ กรุณารอสักครู่", ui.ButtonSet.OK);
    return;
  }


  try {
    const inputSheet = ss.getSheetByName(SCG_CONFIG.SHEET_INPUT);
    const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
    if (!inputSheet || !dataSheet) throw new Error("CRITICAL: ไม่พบชีต Input หรือ Data");


    const cookie = inputSheet.getRange(SCG_CONFIG.COOKIE_CELL).getValue();
    if (!cookie) throw new Error("❌ กรุณาวาง Cookie ในช่อง " + SCG_CONFIG.COOKIE_CELL);


    const lastRow = inputSheet.getLastRow();
    if (lastRow < SCG_CONFIG.INPUT_START_ROW) throw new Error("ℹ️ ไม่พบเลข Shipment ในชีต Input");


    const shipmentNumbers = inputSheet
      .getRange(SCG_CONFIG.INPUT_START_ROW, 1, lastRow - SCG_CONFIG.INPUT_START_ROW + 1, 1)
      .getValues().flat().filter(String);


    if (shipmentNumbers.length === 0) throw new Error("ℹ️ รายการ Shipment ว่างเปล่า");


    const shipmentString = shipmentNumbers.join(',');
    inputSheet.getRange(SCG_CONFIG.SHIPMENT_STRING_CELL).setValue(shipmentString).setHorizontalAlignment("left");


    const payload = {
      DeliveryDateFrom: '', DeliveryDateTo: '', TenderDateFrom: '', TenderDateTo: '',
      CarrierCode: '', CustomerCode: '', OriginCodes: '', ShipmentNos: shipmentString
    };


    const options = {
      method: 'post', payload: payload, muteHttpExceptions: true, headers: { cookie: cookie }
    };


    ss.toast("กำลังเชื่อมต่อ SCG Server...", "System", 10);
    console.log(`[SCG API] Fetching data for ${shipmentNumbers.length} shipments.`);
    const responseText = fetchWithRetry_(SCG_CONFIG.API_URL, options, (CONFIG.API_MAX_RETRIES || 3));


    const json = JSON.parse(responseText);
    const shipments = json.data || [];


    if (shipments.length === 0) throw new Error("API Return Success แต่ไม่พบข้อมูล Shipment (Data Empty)");


    ss.toast("กำลังแปลงข้อมูล " + shipments.length + " Shipments...", "Processing", 5);
    const allFlatData = [];
    let runningRow = 2;


    shipments.forEach(shipment => {
      const destSet = new Set();
      (shipment.DeliveryNotes || []).forEach(n => { if (n.ShipToName) destSet.add(n.ShipToName); });
      const destListStr = Array.from(destSet).join(", ");


      (shipment.DeliveryNotes || []).forEach(note => {
        (note.Items || []).forEach(item => {
          const dailyJobId = note.PurchaseOrder + "-" + runningRow;
          const row = [
            dailyJobId,
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
            destSet.size,
            destListStr,
            "รอสแกน",
            "ยังไม่ได้ส่ง",
            "",
            0, 0, 0,
            "",
            "",
            shipment.ShipmentNo + "|" + note.ShipToName
          ];
          allFlatData.push(row);
          runningRow++;
        });
      });
    });


    const shopAgg = {};
    allFlatData.forEach(r => {
      const key = r[28];
      if (!shopAgg[key]) shopAgg[key] = { qty: 0, weight: 0, invoices: new Set(), epod: 0 };
      shopAgg[key].qty += Number(r[14]) || 0;
      shopAgg[key].weight += Number(r[16]) || 0;
      shopAgg[key].invoices.add(r[2]);
      if (checkIsEPOD(r[9], r[2])) shopAgg[key].epod++;
    });


    allFlatData.forEach(r => {
      const agg = shopAgg[r[28]];
      const scanInv = agg.invoices.size - agg.epod;
      r[23] = agg.qty;
      r[24] = Number(agg.weight.toFixed(2));
      r[25] = scanInv;
      r[27] = `${r[9]} / รวม ${scanInv} บิล`;
    });


    const headers = [
      "ID_งานประจำวัน", "PlanDelivery", "InvoiceNo", "ShipmentNo", "DriverName",
      "TruckLicense", "CarrierCode", "CarrierName", "SoldToCode", "SoldToName",
      "ShipToName", "ShipToAddress", "LatLong_SCG", "MaterialName", "ItemQuantity",
      "QuantityUnit", "ItemWeight", "DeliveryNo", "จำนวนปลายทาง_System", "รายชื่อปลายทาง_System",
      "ScanStatus", "DeliveryStatus", "Email พนักงาน",
      "จำนวนสินค้ารวมของร้านนี้", "น้ำหนักสินค้ารวมของร้านนี้", "จำนวน_Invoice_ที่ต้องสแกน",
      "LatLong_Actual", "ชื่อเจ้าของสินค้า_Invoice_ที่ต้องสแกน", "ShopKey"
    ];


    dataSheet.clear();
    dataSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");


    if (allFlatData.length > 0) {
      dataSheet.getRange(2, 1, allFlatData.length, headers.length).setValues(allFlatData);
      dataSheet.getRange(2, 2, allFlatData.length, 1).setNumberFormat("dd/mm/yyyy");
      dataSheet.getRange(2, 3, allFlatData.length, 1).setNumberFormat("@");
      dataSheet.getRange(2, 18, allFlatData.length, 1).setNumberFormat("@");
    }


    applyMasterCoordinatesToDailyJob();
    buildOwnerSummary();
    buildShipmentSummary();


    console.log(`[SCG API] Successfully imported ${allFlatData.length} records.`);
    ui.alert(`✅ ดึงข้อมูลสำเร็จ!\n- จำนวนรายการ: ${allFlatData.length} แถว\n- จับคู่พิกัด: เรียบร้อย`);


  } catch (e) {
    console.error("[SCG API Error]: " + e.message);
    ui.alert("❌ เกิดข้อผิดพลาด: " + e.message);
  } finally {
    lock.releaseLock();
  }
}


// ==========================================
// 2. COORDINATE MATCHING (V4.0)
// ==========================================


function applyMasterCoordinatesToDailyJob() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  const dbSheet = ss.getSheetByName(SCG_CONFIG.SHEET_MASTER_DB);
  const mapSheet = ss.getSheetByName(SCG_CONFIG.SHEET_MAPPING);
  const empSheet = ss.getSheetByName(SCG_CONFIG.SHEET_EMPLOYEE);


  if (!dataSheet || !dbSheet) return;
  const lastRow = dataSheet.getLastRow();
  if (lastRow < 2) return;


  const masterCoords = {};
  const masterUUIDCoords = {};


  if (dbSheet.getLastRow() > 1) {
    const maxCol = Math.max(CONFIG.COL_NAME, CONFIG.COL_LAT, CONFIG.COL_LNG, CONFIG.COL_UUID);
    const dbData = dbSheet.getRange(2, 1, dbSheet.getLastRow() - 1, maxCol).getValues();
    dbData.forEach(r => {
      const name = r[CONFIG.C_IDX.NAME];
      const lat = r[CONFIG.C_IDX.LAT];
      const lng = r[CONFIG.C_IDX.LNG];
      const uuid = r[CONFIG.C_IDX.UUID];
      if (name && lat && lng) {
        const coords = lat + ", " + lng;
        masterCoords[normalizeText(name)] = coords;
        if (uuid) masterUUIDCoords[uuid] = coords;
      }
    });
  }


  const aliasMap = {};
  if (mapSheet && mapSheet.getLastRow() > 1) {
    mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 2).getValues().forEach(r => {
      if (r[0] && r[1]) aliasMap[normalizeText(r[0])] = r[1];
    });
  }


  const empMap = {};
  if (empSheet && empSheet.getLastRow() > 1) {
    empSheet.getRange(2, 1, empSheet.getLastRow() - 1, 8).getValues().forEach(r => {
      if (r[1] && r[6]) empMap[normalizeText(r[1])] = r[6];
    });
  }


  const values = dataSheet.getRange(2, 1, lastRow - 1, 29).getValues();
  const latLongUpdates = [];
  const bgUpdates = [];
  const emailUpdates = [];


  values.forEach(r => {
    let newGeo = "";
    let bg = null;
    let email = r[22];


    if (r[10]) {
      let rawName = normalizeText(r[10]);
      let targetUID = aliasMap[rawName];
      if (targetUID && masterUUIDCoords[targetUID]) {
        newGeo = masterUUIDCoords[targetUID];
        bg = "#b6d7a8";
      } else if (masterCoords[rawName]) {
        newGeo = masterCoords[rawName];
        bg = "#b6d7a8";
      } else {
        let branchMatch = tryMatchBranch_(rawName, masterCoords);
        if (branchMatch) { newGeo = branchMatch; bg = "#ffe599"; }
      }
    }


    latLongUpdates.push([newGeo]);
    bgUpdates.push([bg]);


    if (r[4]) {
      const cleanDriver = normalizeText(r[4]);
      if (empMap[cleanDriver]) email = empMap[cleanDriver];
    }
    emailUpdates.push([email]);
  });


  dataSheet.getRange(2, 27, latLongUpdates.length, 1).setValues(latLongUpdates);
  dataSheet.getRange(2, 27, bgUpdates.length, 1).setBackgrounds(bgUpdates);
  dataSheet.getRange(2, 23, emailUpdates.length, 1).setValues(emailUpdates);


  ss.toast("✅ อัปเดตพิกัดและข้อมูลพนักงานเรียบร้อย", "System");
}


// ==========================================
// 3. UTILITIES & HELPERS
// ==========================================


function fetchWithRetry_(url, options, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) return response.getContentText();
      throw new Error("HTTP " + response.getResponseCode() + ": " + response.getContentText());
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      Utilities.sleep(1000 * Math.pow(2, i));
      console.warn(`[SCG API] Retry attempt ${i + 1} failed. Retrying...`);
    }
  }
}


function tryMatchBranch_(name, masterCoords) {
  const keywords = ["สาขา", "branch", "สำนักงาน", "store", "shop"];
  for (let k of keywords) {
    if (name.includes(k)) {
      let parts = name.split(k);
      if (parts.length > 0 && parts[0].length > 2) {
        let parentName = normalizeText(parts[0]);
        if (masterCoords[parentName]) return masterCoords[parentName];
      }
    }
  }
  return null;
}


/**
 * [UPDATED v5.0] ตรวจสอบ E-POD
 * กลุ่ม 1: EPOD ทุก Invoice — BETTERBE, SCG EXPRESS, เบทเตอร์แลนด์, JWD TRANSPORT
 * กลุ่ม 2: DENSO — ตรวจ Invoice ด้วย (ตัวเลขล้วน + ไม่มี _DOC)
 */
function checkIsEPOD(ownerName, invoiceNo) {
  if (!ownerName || !invoiceNo) return false;
  const owner = String(ownerName).toUpperCase();
  const inv = String(invoiceNo);


  const epodOwners = ["BETTERBE", "SCG EXPRESS", "เบทเตอร์แลนด์", "JWD TRANSPORT"];
  if (epodOwners.some(w => owner.includes(w.toUpperCase()))) return true;


  if (owner.includes("DENSO") || owner.includes("เด็นโซ่")) {
    if (inv.includes("_DOC")) return false;
    if (/^\d+(-.*)?$/.test(inv)) return true;
    return false;
  }


  return false;
}


function normalizeText(text) {
  if (!text) return "";
  return text.toString().toLowerCase().replace(/\s+/g, "").trim();
}


// ==========================================
// 4. BUILD SUMMARY: เจ้าของสินค้า [UPDATED v5.0]
// ==========================================


function buildOwnerSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  if (!dataSheet || dataSheet.getLastRow() < 2) return;


  const data = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 29).getValues();


  const COL_INVOICE = 2;
  const COL_SOLDTO  = 9;


  const ownerMap = {};


  data.forEach(r => {
    const owner   = r[COL_SOLDTO];
    const invoice = String(r[COL_INVOICE]);


    if (!owner) return;
    if (!ownerMap[owner]) {
      ownerMap[owner] = { all: new Set(), epod: new Set() };
    }
    if (!invoice) return;


    if (checkIsEPOD(owner, invoice)) {
      ownerMap[owner].epod.add(invoice);
      return;
    }
    ownerMap[owner].all.add(invoice);
  });


  const summarySheet = ss.getSheetByName("สรุป_เจ้าของสินค้า");
  if (!summarySheet) {
    SpreadsheetApp.getUi().alert("❌ ไม่พบชีต สรุป_เจ้าของสินค้า กรุณาสร้างชีตก่อน");
    return;
  }


  const summaryLastRow = summarySheet.getLastRow();
  if (summaryLastRow > 1) {
    summarySheet.getRange(2, 1, summaryLastRow - 1, 6).clearContent().setBackground(null);
  }


  const rows = [];
  Object.keys(ownerMap).sort().forEach(owner => {
    const o = ownerMap[owner];
    rows.push([
      "",           // Col A: SummaryKey ← ว่าง ใส่เองได้
      owner,        // Col B: SoldToName
      "",           // Col C: PlanDelivery ← ว่าง ใส่เองได้
      o.all.size,   // Col D: จำนวน_ทั้งหมด (ต้องสแกน)
      o.epod.size,  // Col E: จำนวน_E-POD_ทั้งหมด
      new Date()    // Col F: LastUpdated
    ]);
  });


  if (rows.length > 0) {
    summarySheet.getRange(2, 1, rows.length, 6).setValues(rows);
    summarySheet.getRange(2, 4, rows.length, 2).setNumberFormat("#,##0");
    summarySheet.getRange(2, 6, rows.length, 1).setNumberFormat("dd/mm/yyyy HH:mm");
  }


  console.log(`[Owner Summary v5.0] Built ${rows.length} owner rows.`);
}


// ==========================================
// 5. BUILD SUMMARY: Shipment [ADDED v5.0]
// ==========================================


function buildShipmentSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  if (!dataSheet || dataSheet.getLastRow() < 2) return;


  const data = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 29).getValues();


  const COL_INVOICE  = 2;
  const COL_SOLDTO   = 9;
  const COL_SHIPMENT = 3;
  const COL_TRUCK    = 5;


  const shipmentMap = {};


  data.forEach(r => {
    const shipmentNo = String(r[COL_SHIPMENT]);
    const truck      = String(r[COL_TRUCK]);
    const owner      = r[COL_SOLDTO];
    const invoice    = String(r[COL_INVOICE]);


    if (!shipmentNo || !truck) return;


    const key = shipmentNo + "_" + truck;
    if (!shipmentMap[key]) {
      shipmentMap[key] = { shipmentNo: shipmentNo, truck: truck, all: new Set(), epod: new Set() };
    }


    if (!invoice) return;


    if (checkIsEPOD(owner, invoice)) {
      shipmentMap[key].epod.add(invoice);
      return;
    }
    shipmentMap[key].all.add(invoice);
  });


  const summarySheet = ss.getSheetByName("สรุป_Shipment");
  if (!summarySheet) {
    SpreadsheetApp.getUi().alert("❌ ไม่พบชีต สรุป_Shipment กรุณาสร้างชีตก่อน");
    return;
  }


  const summaryLastRow = summarySheet.getLastRow();
  if (summaryLastRow > 1) {
    summarySheet.getRange(2, 1, summaryLastRow - 1, 7).clearContent().setBackground(null);
  }


  const rows = [];
  Object.keys(shipmentMap).sort().forEach(key => {
    const s = shipmentMap[key];
    rows.push([
      key,          // Col A: ShipmentKey ← Key ใน AppSheet
      s.shipmentNo, // Col B: ShipmentNo
      s.truck,      // Col C: TruckLicense
      "",           // Col D: PlanDelivery ← ว่าง ใส่เองได้
      s.all.size,   // Col E: จำนวน_ทั้งหมด (ต้องสแกน)
      s.epod.size,  // Col F: จำนวน_E-POD_ทั้งหมด
      new Date()    // Col G: LastUpdated
    ]);
  });


  if (rows.length > 0) {
    summarySheet.getRange(2, 1, rows.length, 7).setValues(rows);
    summarySheet.getRange(2, 5, rows.length, 2).setNumberFormat("#,##0"); // Col E, F
    summarySheet.getRange(2, 7, rows.length, 1).setNumberFormat("dd/mm/yyyy HH:mm"); // Col G
  }


  console.log(`[Shipment Summary v5.0] Built ${rows.length} shipment rows.`);
}


// ==========================================
// 6. CLEAR FUNCTIONS
// ==========================================


function clearDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCG_CONFIG.SHEET_DATA);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow > 1 && lastCol > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent().setBackground(null);
  }
}


function clearSummarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("สรุป_เจ้าของสินค้า");
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent().setBackground(null);
  }
}


function clearShipmentSummarySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("สรุป_Shipment");
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent().setBackground(null);
  }
}


function clearSummarySheet_UI() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '⚠️ ยืนยันการล้างข้อมูล',
    'ต้องการล้างข้อมูลในชีต สรุป_เจ้าของสินค้า ใช่ไหม?\n(Header ยังคงอยู่)',
    ui.ButtonSet.YES_NO
  );
  if (result === ui.Button.YES) {
    clearSummarySheet();
    SpreadsheetApp.getUi().alert('✅ ล้างข้อมูล สรุป_เจ้าของสินค้า เรียบร้อยแล้ว');
  }
}


function clearShipmentSummarySheet_UI() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '⚠️ ยืนยันการล้างข้อมูล',
    'ต้องการล้างข้อมูลในชีต สรุป_Shipment ใช่ไหม?\n(Header ยังคงอยู่)',
    ui.ButtonSet.YES_NO
  );
  if (result === ui.Button.YES) {
    clearShipmentSummarySheet();
    SpreadsheetApp.getUi().alert('✅ ล้างข้อมูล สรุป_Shipment เรียบร้อยแล้ว');
  }
}


/**
 * [UPDATED v5.0] ล้างทั้งหมด: Input + Data + สรุป_เจ้าของสินค้า + สรุป_Shipment
 */
function clearAllSCGSheets_UI() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '🔥 ยืนยันการล้างข้อมูลทั้งหมด',
    'ต้องการล้างข้อมูลใน:\n- Input\n- Data\n- สรุป_เจ้าของสินค้า\n- สรุป_Shipment\nทั้งหมดหรือไม่?\nการกระทำนี้กู้คืนไม่ได้',
    ui.ButtonSet.YES_NO
  );


  if (result === ui.Button.YES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();


    const inputSheet = ss.getSheetByName(SCG_CONFIG.SHEET_INPUT);
    if (inputSheet) {
      inputSheet.getRange(SCG_CONFIG.COOKIE_CELL).clearContent();
      inputSheet.getRange(SCG_CONFIG.SHIPMENT_STRING_CELL).clearContent();
      const lastRow = inputSheet.getLastRow();
      if (lastRow >= SCG_CONFIG.INPUT_START_ROW) {
        inputSheet.getRange(
          SCG_CONFIG.INPUT_START_ROW, 1,
          lastRow - SCG_CONFIG.INPUT_START_ROW + 1, 1
        ).clearContent();
      }
    }


    clearDataSheet();
    clearSummarySheet();
    clearShipmentSummarySheet();


    ui.alert('✅ ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว\n(Input + Data + สรุป_เจ้าของสินค้า + สรุป_Shipment)');
  }
}
```

---

### 📄 ไฟล์: Service_GeoAddr.gs
```javascript
/**
 * VERSION: 000
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
 * แกะรหัสไปรษณีย์ จังหวัด และอำเภอ จากที่อยู่ดิบ
 */
function parseAddressFromText(fullAddress) {
  var result = { province: "", district: "", postcode: "" };
  if (!fullAddress) return result;
  
  var addrStr = fullAddress.toString().trim();
  
  // 1. หารหัสไปรษณีย์ก่อน (ตัวเลข 5 หลักติดกัน)
  var zipMatch = addrStr.match(/(\d{5})/);
  if (zipMatch && zipMatch[1]) {
    result.postcode = zipMatch[1];
  }
  
  // 2. ลองหาจาก Database PostalRef (ถ้ามี)
  var postalDB = getPostalDataCached();
  if (postalDB && result.postcode && postalDB.byZip[result.postcode]) {
    var infoList = postalDB.byZip[result.postcode];
    if (infoList.length > 0) {
       result.province = infoList[0].province;
       result.district = infoList[0].district;
       return result; // ถ้าเจอใน DB จบเลย แม่นยำสุด
    }
  }


  // 3. FALLBACK: ถ้าไม่มี DB หรือหาไม่เจอ ให้ใช้ Regex แกะจาก Text ทันที (อัปเกรด Regex V4.0)
  var provMatch = addrStr.match(/(?:จ\.|จังหวัด)\s*([ก-๙a-zA-Z0-9]+)/i);
  if (provMatch && provMatch[1]) {
    result.province = provMatch[1].trim();
  }
  
  var distMatch = addrStr.match(/(?:อ\.|อำเภอ|เขต)\s*([ก-๙a-zA-Z0-9]+)/i);
  if (distMatch && distMatch[1]) {
    result.district = distMatch[1].trim();
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
// 3. 🗺️ GOOGLE MAPS FORMULAS (Amit Agarwal)
// ==========================================


const _mapsMd5 = (key = "") => {
  const code = key.toLowerCase().replace(/\s/g, "");
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key)
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
 * [MODIFIED v4.0]: ป้องกัน Error กรณี String ของ Maps Directions เกิน 100KB
 */
const _mapsSetCache = (key, value) => {
  try {
    const expirationInSeconds = (typeof CONFIG !== 'undefined' && CONFIG.CACHE_EXPIRATION) ? CONFIG.CACHE_EXPIRATION : 21600; // 6 hours
    if (value && value.toString().length < 90000) { 
       CacheService.getDocumentCache().put(_mapsMd5(key), value, expirationInSeconds);
    }
  } catch (e) {
    console.warn("[Geo Cache Warn]: Could not cache key " + key + " - " + e.message);
  }
};


/**
 * 2.3 Calculate the travel time between two locations on Google Maps.
 * @customFunction
 */
const GOOGLEMAPS_DURATION = (origin, destination, mode = "driving") => {
  if (!origin || !destination) throw new Error("No address specified!");
  if (origin.map) return origin.map(o => GOOGLEMAPS_DURATION(o, destination, mode));
  
  const key = ["duration", origin, destination, mode].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150); // API Throttling protection
  const { routes: [data] = [] } = Maps.newDirectionFinder()
    .setOrigin(origin)
    .setDestination(destination)
    .setMode(mode)
    .getDirections();
  
  if (!data) throw new Error("No route found!");
  
  const { legs: [{ duration: { text: time } } = {}] = [] } = data;
  _mapsSetCache(key, time);
  return time;
};


/**
 * 2.1 Calculate the distance between two locations on Google Maps.
 * @customFunction
 */
const GOOGLEMAPS_DISTANCE = (origin, destination, mode = "driving") => {
  if (!origin || !destination) throw new Error("No address specified!");
  if (origin.map) return origin.map(o => GOOGLEMAPS_DISTANCE(o, destination, mode));
  
  const key = ["distance", origin, destination, mode].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { routes: [data] = [] } = Maps.newDirectionFinder()
    .setOrigin(origin)
    .setDestination(destination)
    .setMode(mode)
    .getDirections();
    
  if (!data) throw new Error("No route found!");
  
  const { legs: [{ distance: { text: distance } } = {}] = [] } = data;
  _mapsSetCache(key, distance);
  return distance;
};


/**
 * 2.4 Get the latitude and longitude of any address on Google Maps.
 * @customFunction
 */
const GOOGLEMAPS_LATLONG = (address) => {
  if (!address) throw new Error("No address specified!");
  if (address.map) return address.map(a => GOOGLEMAPS_LATLONG(a));
  
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


/**
 * 2.5 Get the full address of any zip code or partial address on Google Maps.
 * @customFunction
 */
const GOOGLEMAPS_ADDRESS = (address) => {
  if (!address) throw new Error("No address specified!");
  if (address.map) return address.map(a => GOOGLEMAPS_ADDRESS(a));
  
  const key = ["address", address].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { results: [data = null] = [] } = Maps.newGeocoder().geocode(address);
  if (data === null) throw new Error("Address not found!");
  
  const { formatted_address } = data;
  _mapsSetCache(key, formatted_address);
  return formatted_address;
};


/**
 * 2.2 Use Reverse Geocoding to get the address of a point location.
 * @customFunction
 */
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


/**
 * 2.6 Get the country name of an address on Google Maps.
 * @customFunction
 */
const GOOGLEMAPS_COUNTRY = (address) => {
  if (!address) throw new Error("No address specified!");
  if (address.map) return address.map(a => GOOGLEMAPS_COUNTRY(a));


  const key = ["country", address].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { results: [data = null] = [] } = Maps.newGeocoder().geocode(address);
  if (data === null) throw new Error("Address not found!");
  
  const [{ short_name, long_name } = {}] = data.address_components.filter(
    ({ types: [level] }) => level === "country"
  );
  if (!short_name) throw new Error("Country not found!");
  
  const answer = `${long_name} (${short_name})`;
  _mapsSetCache(key, answer);
  return answer;
};


/**
 * 2.7 Find the driving direction between two locations on Google Maps.
 * @customFunction
 */
const GOOGLEMAPS_DIRECTIONS = (origin, destination, mode = "driving") => {
  if (!origin || !destination) throw new Error("No address specified!");
  
  const key = ["directions", origin, destination, mode].join(",");
  const value = _mapsGetCache(key);
  if (value !== null) return value;


  Utilities.sleep(150);
  const { routes = [] } = Maps.newDirectionFinder()
    .setOrigin(origin)
    .setDestination(destination)
    .setMode(mode)
    .getDirections();
    
  if (!routes.length) throw new Error("No route found!");
  
  const directions = routes
    .map(({ legs }) => {
      return legs.map(({ steps }) => {
        return steps.map((step) => {
          return step.html_instructions
            .replace("><", "> <")
            .replace(/<[^>]+>/g, "");
        });
      });
    })
    .join(", ");
    
  _mapsSetCache(key, directions);
  return directions;
};


// ==========================================
// 4. 🔗 BACKEND INTEGRATION (System Calls V4.0)
// ==========================================


/**
 * Wrapper for Backend System: Reverse Geocode
 * ดึงพิกัด Lat, Lng มาแปลเป็นที่อยู่
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
 * Wrapper for Backend System: Calculate Distance
 * ดึงระยะทางจากสูตรคุณ Amit แล้วแปลง "1,250.5 km" ให้เหลือแค่ "1250.50" (ตัวเลขล้วน)
 */
function CALCULATE_DISTANCE_KM(origin, destination) {
  try {
    var distanceText = GOOGLEMAPS_DISTANCE(origin, destination, "driving");
    if (!distanceText) return "";
    
    // [FINAL POLISH] กำจัดลูกน้ำ (,) ออกก่อน แล้วค่อยกรองเฉพาะตัวเลขและจุดทศนิยม
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
 * VERSION: 000
 * 🛠️ Utilities: Common Helper Functions
 * Version: 4.0 Enterprise Edition (AI & Batch Preparedness)
 * ------------------------------------------------------
 * [PRESERVED]: Hashing, Haversine Math, Fuzzy Matching, and Smart Naming.
 * [ADDED v4.0]: chunkArray() helper for AI Batch Processing.
 * [MODIFIED v4.0]: Enhanced normalizeText() with more logistics-specific stop words.
 * [MODIFIED v4.0]: genericRetry() upgraded with Enterprise-grade console logging.
 * Author: Elite Logistics Architect
 */


// ====================================================
// 1. Hashing & ID Generation
// ====================================================


function md5(key) {
  if (!key) return "empty_hash";
  var code = key.toString().toLowerCase().replace(/\s/g, "");
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, code)
    .map(function(char) { return (char + 256).toString(16).slice(-2); })
    .join("");
}


function generateUUID() {
  return Utilities.getUuid();
}


// ====================================================
// 2. Text Processing & Normalization
// ====================================================


/**
 * [MODIFIED v4.0]: เพิ่ม Stop words สำหรับงาน Logistics (โกดัง, คลังสินค้า, อาคาร ฯลฯ)
 * ทำหน้าที่เป็น Tier 2 Resolution (Clean Text)
 */
function normalizeText(text) {
  if (!text) return "";
  var clean = text.toString().toLowerCase();
  
  var stopWordsPattern = /บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วน|จำกัด|มหาชน|ส่วนบุคคล|ร้าน|ห้าง|สาขา|สำนักงานใหญ่|store|shop|company|co\.?|ltd\.?|inc\.?|จังหวัด|อำเภอ|ตำบล|เขต|แขวง|ถนน|ซอย|นาย|นาง|นางสาว|โกดัง|คลังสินค้า|หมู่ที่|หมู่|อาคาร|ชั้น/g;
  clean = clean.replace(stopWordsPattern, "");


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


function parseThaiDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  var parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parts[2], parseInt(parts[1]) - 1, parts[0]);
  }
  return null;
}


// ====================================================
// 3. 🧠 Smart Naming Logic
// ====================================================


function getBestName_Smart(names) {
  if (!names || names.length === 0) return "";
  
  var nameScores = {};
  var bestName = names[0];
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
    
    if (/(บริษัท|บจก|หจก|บมจ)/.test(n)) s += 5; 
    if (/(จำกัด|มหาชน)/.test(n)) s += 5;        
    if (/(สาขา)/.test(n)) s += 5;               
    
    var openBrackets = (n.match(/\(/g) || []).length;
    var closeBrackets = (n.match(/\)/g) || []).length;
    
    if (openBrackets > 0 && openBrackets === closeBrackets) {
      s += 5; 
    } else if (openBrackets !== closeBrackets) {
      s -= 30; 
    }
    
    if (/[0-9]{9,10}/.test(n) || /โทร/.test(n)) s -= 30; 
    if (/ส่ง|รับ|ติดต่อ/.test(n)) s -= 10;                
    
    var len = n.length;
    if (len > 70) {
      s -= (len - 70); 
    } else if (len < 5) {
      s -= 10;         
    } else {
      s += (len * 0.1);
    }


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
  clean = clean.replace(/\s*โทร\.?\s*[0-9-]{9,12}/g, '');
  clean = clean.replace(/\s*0[0-9]{1,2}-[0-9]{3}-[0-9]{4}/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}


// ====================================================
// 4. Geo Math & Fuzzy Matching
// ====================================================


function getHaversineDistanceKM(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  var R = 6371; 
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return parseFloat((R * c).toFixed(3)); 
}


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


  for (var i = 0; i <= len1; i += 1) { track[0][i] = i; }
  for (var j = 0; j <= len2; j += 1) { track[j][0] = j; }


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
 * [MODIFIED v4.0]: Enterprise Logging
 */
function genericRetry(func, maxRetries) {
  for (var i = 0; i < maxRetries; i++) {
    try { return func(); } 
    catch (e) {
      if (i === maxRetries - 1) {
        console.error("[GenericRetry] FATAL ERROR after " + maxRetries + " attempts: " + e.message);
        throw e;
      }
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
 * แบ่ง Array ขนาดใหญ่เป็นก้อนเล็กๆ เพื่อป้องกัน Google Apps Script Timeout
 */
function chunkArray(array, chunkSize) {
  var results = [];
  for (var i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
}
```

---

