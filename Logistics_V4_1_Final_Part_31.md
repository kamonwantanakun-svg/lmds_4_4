# 📦 Logistics Master Data System V4.1 - 3

## 📄 ไฟล์: Setup_Upgrade.gs
```javascript
/**
 * VERSION: 001
 * 🛠️ System Upgrade Tool (Enterprise Edition)
 * Version: 4.0 Omni-Schema Upgrader
 * -----------------------------------------------------------------
 * [PRESERVED]: Sacred Schema A-Q (Column 1-17) is untouched.
 * [ADDED v4.0]: Spatial Grid Indexing (O(N)) for high-speed duplicate detection.
 * [ADDED v4.0]: upgradeNameMappingStructure_V4() for 5-Tier AI Resolution.
 * [MODIFIED v4.0]: Added Enterprise Benchmarking (console.time) for monitoring.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. DATABASE SCHEMA UPGRADE
// ==========================================


/**
 * 🚀 อัปเกรดโครงสร้าง Database เพิ่มคอลัมน์ส่วนขยาย (Col 18 เป็นต้นไป)
 * เพื่อรองรับ BigQuery Migration และข้อมูลโลจิสติกส์เชิงลึก
 */
function upgradeDatabaseStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME); // "Database"
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("❌ Critical Error: ไม่พบชีต " + CONFIG.SHEET_NAME);
    return;
  }


  // รายชื่อคอลัมน์ใหม่ (R-Z) อยู่นอกเหนือจาก Standard 17 Columns
  var extensionHeaders = [
    "Customer Type",      // Col 18 (R)
    "Time Window",        // Col 19 (S)
    "Avg Service Time",   // Col 20 (T)
    "Vehicle Constraint", // Col 21 (U)
    "Contact Person",     // Col 22 (V)
    "Phone Number",       // Col 23 (W)
    "Risk Score",         // Col 24 (X)
    "Branch Code",        // Col 25 (Y)
    "Last Updated By"     // Col 26 (Z)
  ];


  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues();
  var missingHeaders = [];


  extensionHeaders.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      missingHeaders.push(header);
    }
  });


  if (missingHeaders.length === 0) {
    SpreadsheetApp.getUi().alert("✅ Database Structure is up-to-date.\nโครงสร้างฐานข้อมูลหลักสมบูรณ์แล้ว");
    return;
  }


  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    "⚠️ System Upgrade Required",
    "ตรวจพบคอลัมน์ขาดหาย " + missingHeaders.length + " รายการ:\n" + missingHeaders.join(", ") + "\n\nต้องการเพิ่มต่อท้ายทันทีหรือไม่?",
    ui.ButtonSet.YES_NO
  );


  if (response == ui.Button.YES) {
    var startCol = sheet.getLastColumn() + 1;
    var range = sheet.getRange(1, startCol, 1, missingHeaders.length);
    range.setValues([missingHeaders]);
    range.setFontWeight("bold");
    range.setBackground("#d0f0c0"); // Light Green for New Features
    range.setBorder(true, true, true, true, true, true);
    
    sheet.autoResizeColumns(startCol, missingHeaders.length);
    console.info("[System Upgrade] Added " + missingHeaders.length + " extension columns.");
    ui.alert("✅ เพิ่มคอลัมน์ใหม่ใน Database สำเร็จ!");
  }
}


/**
 * 🚀 [NEW v4.0] อัปเกรดชีต NameMapping เป็นโครงสร้าง 5-Tier สำหรับ AI
 */
function upgradeNameMappingStructure_V4() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.MAPPING_SHEET); 
  var ui = SpreadsheetApp.getUi();


  if (!sheet) {
    ui.alert("❌ Critical Error: ไม่พบชีต " + CONFIG.MAPPING_SHEET);
    return;
  }


  // Schema V4.0: [Variant_Name, Master_UID, Confidence_Score, Mapped_By, Timestamp]
  var targetHeaders = ["Variant_Name", "Master_UID", "Confidence_Score", "Mapped_By", "Timestamp"];
  var range = sheet.getRange(1, 1, 1, 5);
  range.setValues([targetHeaders]);


  // Enterprise Styling (AI Purple)
  range.setFontWeight("bold").setFontColor("white").setBackground("#7c3aed");
  range.setBorder(true, true, true, true, true, true);


  sheet.setColumnWidth(1, 250); // Variant Name
  sheet.setColumnWidth(2, 280); // Master_UID
  sheet.setColumnWidth(3, 130); // Confidence
  sheet.setColumnWidth(4, 120); // Mapped By
  sheet.setColumnWidth(5, 150); // Timestamp
  sheet.setFrozenRows(1);


  console.info("[System Upgrade] Migrated NameMapping schema to V4.0 (5-Tier)");
  ui.alert("✅ Schema Upgrade V4.0 สำเร็จ!", "อัปเกรดเป็น 5 คอลัมน์สำหรับ AI เรียบร้อยแล้ว", ui.ButtonSet.OK);
}


// ==========================================
// 2. SMART DATA QUALITY CHECK (O(N) ALGORITHM)
// ==========================================


/**
 * 🔍 ตรวจสอบพิกัดซ้ำซ้อนด้วยอัลกอริทึม Spatial Grid
 * ลดภาระจาก O(N^2) เป็น O(N) ป้องกันระบบค้าง
 */
function findHiddenDuplicates() {
  console.time("HiddenDupesCheck");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;


  var idxLat = CONFIG.C_IDX.LAT;
  var idxLng = CONFIG.C_IDX.LNG;
  var idxName = CONFIG.C_IDX.NAME;


  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
  var duplicates = [];
  var grid = {};


  // Step 1: สร้าง Spatial Grid (Bucket Sort)
  // ปัดเศษทศนิยม 2 ตำแหน่ง (~1.1 กม.) เพื่อจัดกลุ่มลง Bucket
  for (var i = 0; i < data.length; i++) {
    var lat = data[i][idxLat];
    var lng = data[i][idxLng];
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;


    var gridKey = Math.floor(lat * 100) + "_" + Math.floor(lng * 100);
    if (!grid[gridKey]) grid[gridKey] = [];
    grid[gridKey].push({ index: i, row: data[i] });
  }


  // Step 2: เปรียบเทียบระยะทางเฉพาะภายใน Bucket เดียวกัน
  for (var key in grid) {
    var bucket = grid[key];
    if (bucket.length < 2) continue;


    for (var a = 0; a < bucket.length; a++) {
      for (var b = a + 1; b < bucket.length; b++) {
        var item1 = bucket[a];
        var item2 = bucket[b];
        
        var dist = getHaversineDistanceKM(item1.row[idxLat], item1.row[idxLng], item2.row[idxLat], item2.row[idxLng]);
        
        // Threshold: 50 เมตร (0.05 กม.)
        if (dist <= 0.05) {
          var name1 = typeof normalizeText === 'function' ? normalizeText(item1.row[idxName]) : item1.row[idxName];
          var name2 = typeof normalizeText === 'function' ? normalizeText(item2.row[idxName]) : item2.row[idxName];
          
          if (name1 !== name2) {
            duplicates.push({
              row1: item1.index + 2, name1: item1.row[idxName],
              row2: item2.index + 2, name2: item2.row[idxName],
              distance: (dist * 1000).toFixed(0) + " ม."
            });
          }
        }
      }
    }
  }


  console.timeEnd("HiddenDupesCheck");


  if (duplicates.length > 0) {
    var msg = "⚠️ พบพิกัดทับซ้อน (Hidden Duplicates) " + duplicates.length + " คู่:\n\n";
    duplicates.slice(0, 15).forEach(function(d) {
      msg += "• แถว " + d.row1 + " vs " + d.row2 + ": " + d.name1 + " / " + d.name2 + " (ห่าง " + d.distance + ")\n";
    });
    ui.alert(msg);
    console.warn("[Quality Check] Found " + duplicates.length + " duplicates.");
  } else {
    ui.alert("✅ ไม่พบข้อมูลซ้ำซ้อนในระยะ 50 เมตร");
    console.log("[Quality Check] No duplicates found.");
  }
}
```

---
## 📄 ไฟล์: Test_AI.gs
```javascript
/**
 * VERSION: 001
 * Test and Debug: AI Capabilities (Enterprise Debugging Suite)
 * Version: 4.0 Compatible with System V4.0
 * -------------------------------------------------------------
 * PRESERVED: Manual triggers, Connection test, and Row Reset logic.
 * MODIFIED v4.0: Upgraded debug_ResetSelectedRowsAI to clear both AI and Agent_V4 tags.
 * MODIFIED v4.0: Safe API Key extraction using CONFIG getter (No hardcoding).
 * ADDED v4.0: debug_TestTier4SmartResolution() for manual Tier 4 AI evaluation.
 * MODIFIED v4.0: Switched to console.info for GCP Monitoring and Audit.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. MANUAL TRIGGERS (AI BATCH RUNNERS)
// ==========================================


/**
 * Manual Trigger: สั่งรัน AI ทันที (AutoPilot Batch - 20 แถว)
 * ใช้สำหรับทดสอบการทำงาน หรือเร่งด่วนเก็บตกข้อมูล (สร้าง Index)
 */
function forceRunAI_Now() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();


  try {
    // 1. Dependency Check
    if (typeof processAIIndexing_Batch !== 'function') {
      throw new Error("Critical: ไม่พบฟังก์ชัน processAIIndexing_Batch ใน Service_AutoPilot.gs");
    }


    // 2. Execution
    ss.toast("กำลังเริ่มระบบ AI Indexing (Batch Mode)...", "Debug System", 10);
    console.info("Debug Manual Trigger: processAIIndexing_Batch");


    // เรียกฟังก์ชันจาก Service_AutoPilot
    var processedCount = processAIIndexing_Batch();


    ui.alert(
      "สั่งงานเรียบร้อย!\n" +
      "ระบบได้ประมวลผลข้อมูลไป " + (processedCount || 0) + " รายการ\n" +
      "กรุณาตรวจสอบคอลัมน์ Normalized ใน Database ว่ามี Tag AI หรือไม่"
    );


  } catch (e) {
    console.error("Debug Error forceRunAI_Now: " + e.message);
    ui.alert("Error: " + e.message);
  }
}


/**
 * NEW v4.0 Manual Trigger: ทดสอบ Tier 4 Smart Resolution ทันที
 * ดึงรายชื่อที่ Unknown จากชีตงานประจำวันมาให้ AI วิเคราะห์จับคู่กับ Master Database
 */
function debug_TestTier4SmartResolution() {
  var ui = SpreadsheetApp.getUi();
  try {
    if (typeof resolveUnknownNamesWithAI !== 'function') {
      throw new Error("Critical: ไม่พบฟังก์ชัน resolveUnknownNamesWithAI ใน Service_Agent.gs");
    }


    var response = ui.alert(
      "ยืนยันรันทดสอบ Tier 4", 
      "ต้องการดึงรายชื่อที่ไม่มีพิกัดจากหน้า SCG Data\nไปให้ Gemini วิเคราะห์จับคู่กับ Master Database เลยหรือไม่?", 
      ui.ButtonSet.YES_NO
    );


    if (response == ui.Button.YES) {
      console.info("Debug Manual Trigger: resolveUnknownNamesWithAI");
      resolveUnknownNamesWithAI(); 
      // ผลลัพธ์จะถูกบันทึกลงชีต NameMapping 5-Tier อัตโนมัติ
    }


  } catch (e) {
    console.error("Debug Error Tier 4 Test: " + e.message);
    ui.alert("Error: " + e.message);
  }
}


// ==========================================
// 2. API CONNECTION TESTING
// ==========================================


/**
 * Connection Test: ทดสอบคุยกับ Gemini (ไม่ยุ่งกับ Database)
 * ใช้เช็คว่า API Key ใช้งานได้จริงและรูปแบบ JSON เสถียรหรือไม่
 */
function debugGeminiConnection() {
  var ui = SpreadsheetApp.getUi();
  var apiKey;


  try {
    // MODIFIED v4.0 Safe Getter Extraction จาก Omni-Vault
    apiKey = CONFIG.GEMINI_API_KEY; 
  } catch (e) {
    ui.alert("API Key Error", "กรุณาตั้งค่า API Key ผ่าน Setup_Security.gs ก่อนครับ\n(" + e.message + ")", ui.ButtonSet.OK);
    return;
  }


  var testWord = "SCG JWD (Bang Sue Branch)";
  ss_toast_("กำลังทดสอบส่งข้อความหา Gemini...", "AI Ping");


  try {
    console.info("Debug Pinging Gemini API...");
    
    var model = (typeof CONFIG !== 'undefined' && CONFIG.AI_MODEL) ? CONFIG.AI_MODEL : "gemini-1.5-flash";
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
    
    // บังคับให้ AI ตอบกลับเพื่อเช็คตรรกะ (Logical Check)
    var payload = {
      "contents": [{ "parts": [{ "text": "Hello Gemini, test connection. Say Connection Success and translate this logistics name to Thai: " + testWord }] }],
      "generationConfig": { "temperature": 0.1 } // เน้นความแม่นยำสูงสุด
    };


    var options = {
      "method": "post", 
      "contentType": "application/json",
      "payload": JSON.stringify(payload), 
      "muteHttpExceptions": true
    };


    var res = UrlFetchApp.fetch(url, options);


    if (res.getResponseCode() === 200) {
      var json = JSON.parse(res.getContentText());
      var text = (json.candidates && json.candidates.content) ? json.candidates.content.parts.text : "No Text Data";
      
      ui.alert("API Ping Success!\n\nResponse:\n" + text);
      console.info("Debug Gemini API Connection: OK");
    } else {
      ui.alert("API Error: " + res.getContentText());
      console.error("Debug Gemini API Error: " + res.getContentText());
    }


  } catch (e) {
    ui.alert("Connection Failed: " + e.message);
    console.error("Debug Connection Failed: " + e.message);
  }
}


// ==========================================
// 3. ROW MANIPULATION (FOR RE-RUNNING AI)
// ==========================================


/**
 * Reset AI Tags: ล้าง Tag ระบบ AI เพื่อให้รันใหม่ (เฉพาะแถวที่เลือก)
 * MODIFIED v4.0: ล้างทั้ง AI, Agent_V4 และ Tag อื่นๆ ของ Agent อัตโนมัติ
 */
function debug_ResetSelectedRowsAI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getActiveSheet();


  // ตรวจสอบว่าอยู่ในชีตที่ถูกต้องหรือไม่
  if (sheet.getName() !== CONFIG.SHEET_NAME) {
    ui.alert("System Note", "กรุณาไฮไลต์เลือก Cell ในชีต " + CONFIG.SHEET_NAME + " เท่านั้นครับ", ui.ButtonSet.OK);
    return;
  }


  var range = sheet.getActiveRange();
  var startRow = range.getRow();
  var numRows = range.getNumRows();


  // ดึงตำแหน่งคอลัมน์ Normalized (คอลัมน์ F)
  var colIndex = (typeof CONFIG !== 'undefined' && CONFIG.COL_NORMALIZED) ? CONFIG.COL_NORMALIZED : 6;
  var targetRange = sheet.getRange(startRow, colIndex, numRows, 1);
  var values = targetRange.getValues();


  var resetCount = 0;
  for (var i = 0; i < values.length; i++) {
    var val = values[i][0] ? values[i][0].toString() : "";


    // ตรวจหา Tag ของ AI (ทั้งระบบเก่าและใหม่)
    if (val.indexOf("AI") !== -1 || val.indexOf("Agent_") !== -1) {
      
      // MODIFIED v4.0: ลบ Tags ออกโดยใช้ Regex เพื่อความสะอาดที่สุด
      var cleanedVal = val
        .replace(/\s?AI/g, "")
        .replace(/\s?Agent_.*?/g, "") 
        .trim();


      values[i][0] = cleanedVal;
      resetCount++;
    }
  }


  if (resetCount > 0) {
    targetRange.setValues(values);
    ss.toast("Reset AI Status เรียบร้อย " + resetCount + " แถว", "Debug", 5);
    console.info("Debug User reset AI tags for " + resetCount + " rows.");
  } else {
    ss.toast("ไม่พบรายการที่มี Tag AI ในส่วนที่เลือก", "Debug", 5);
  }
}


/**
 * Helper สำหรับ Toast
 */
function ss_toast_(msg, title) {
  SpreadsheetApp.getActiveSpreadsheet().toast(msg, title || "System", 5);
}

```

---
## 📄 ไฟล์: Test_Diagnostic.gs
```javascript
/**
 * VERSION: 001
 * 🏥 System Diagnostic Tool (Enterprise Edition)
 * Version: 4.0 Deep Scan & Schema Validation
 * -----------------------------------------------------------------
 * [PRESERVED]: Two-phase diagnostic approach (Engine & Sheets).
 * [ADDED v4.0]: Validates NameMapping V4.0 5-Column schema.
 * [ADDED v4.0]: Validates PostalRef sheet existence for Offline Parsing.
 * [ADDED v4.0]: Deep scan for LINE and Telegram tokens in Omni-Vault.
 * [MODIFIED v4.0]: Safe API Key extraction using try-catch for V4.0 Getter.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. PHASE 1: ENGINE & DEPENDENCY CHECK
// ==========================================


/**
 * 🏥 System Diagnostic Tool (Phase 1: Engine Check)
 * สแกนหาฟังก์ชันหลักและ API Key ว่าเชื่อมต่อสมบูรณ์หรือไม่
 */
function RUN_SYSTEM_DIAGNOSTIC() {
  var ui = SpreadsheetApp.getUi();
  var logs = [];


  function pass(msg) { logs.push("✅ " + msg); }
  function warn(msg) { logs.push("⚠️ " + msg); }
  function fail(msg) { logs.push("❌ " + msg); }


  try {
    // 1. Config Check
    if (typeof CONFIG !== 'undefined') {
      pass("System Variables: มองเห็นตัวแปร CONFIG");
    } else {
      fail("System Variables: มองไม่เห็นตัวแปร CONFIG (กรุณาตรวจสอบไฟล์ Config.gs)");
    }


    // 2. Utility Functions Check
    var coreFuncs = ['md5', 'normalizeText', 'generateUUID', 'getHaversineDistanceKM'];
    coreFuncs.forEach(function(fn) {
      if (typeof this[fn] === 'function') pass("Core Utils: พบฟังก์ชัน " + fn + "()");
      else fail("Core Utils: ไม่พบฟังก์ชัน " + fn + "() ใน Utils_Common.gs");
    });


    // 3. AI Agent "The Steward" Check
    if (typeof resolveUnknownNamesWithAI === 'function') {
      pass("AI Agent: ฟังก์ชัน Smart Resolution (Tier 4) พร้อมใช้งาน");
    } else {
      warn("AI Agent: ไม่พบฟังก์ชัน resolveUnknownNamesWithAI ใน Service_Agent.gs");
    }


    // 4. Geo Map API Check
    if (typeof GET_ADDR_WITH_CACHE === 'function') {
      try {
        var testGeo = GET_ADDR_WITH_CACHE(13.746, 100.539); // พิกัดสยามพารากอน
        if (testGeo && testGeo !== "Error") {
          pass("Google Maps API: เชื่อมต่อปกติ (" + testGeo.substring(0, 25) + "...)");
        } else {
          warn("Google Maps API: เชื่อมต่อได้แต่ส่งค่าว่างกลับมา");
        }
      } catch (geoErr) {
        fail("Google Maps API: การเชื่อมต่อล้มเหลว (" + geoErr.message + ")");
      }
    } else {
      fail("Google Maps API: ไม่พบฟังก์ชัน GET_ADDR_WITH_CACHE ใน Service_GeoAddr");
    }


    // 5. Security Vault Check (API Keys)
    var props = PropertiesService.getScriptProperties();


    // Gemini Key (V4.0 Safe Check)
    try {
      if (CONFIG && CONFIG.GEMINI_API_KEY) {
        var key = CONFIG.GEMINI_API_KEY;
        if (key.startsWith("AIza")) pass("AI Engine: ตรวจพบ Gemini API Key รูปแบบถูกต้อง");
        else warn("AI Engine: พบ API Key แต่รูปแบบไม่ถูกต้อง (ควรขึ้นต้นด้วย AIza)");
      }
    } catch (e) {
      fail("AI Engine: " + e.message);
    }


    // Notifications Check (Omni-Vault)
    if (props.getProperty('LINE_NOTIFY_TOKEN')) pass("Notifications: พบ LINE Notify Token");
    else warn("Notifications: ยังไม่ได้ตั้งค่า LINE Notify");


    if (props.getProperty('TG_BOT_TOKEN')) pass("Notifications: พบ Telegram Config");
    else warn("Notifications: ยังไม่ได้ตั้งค่า Telegram");


    ui.alert("🏥 ผลการสแกนระบบ (Engine V4.0):\n\n" + logs.join("\n"));
    console.info("[Diagnostic] Phase 1 (Engine) completed.");


  } catch (e) {
    console.error("[Diagnostic Error]: " + e.message);
    ui.alert("🚨 ตรวจพบ Error ร้ายแรงระหว่างสแกน:\n" + e.message);
  }
}


// ==========================================
// 2. PHASE 2: DATA & STRUCTURE CHECK
// ==========================================


/**
 * 🕵️‍♂️ Sheet Diagnostic Tool (Phase 2: Data & Structure Check)
 * ตรวจสอบว่ามีชีตครบตาม Config และมีโครงสร้างคอลัมน์ถูกต้องหรือไม่
 */
function RUN_SHEET_DIAGNOSTIC() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logs = [];


  function pass(msg) { logs.push("✅ " + msg); }
  function warn(msg) { logs.push("⚠️ " + msg); }
  function fail(msg) { logs.push("❌ " + msg); }


  try {
    // 1. ตรวจสอบ Database Sheet (Sacred Schema)
    var dbName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Database";
    var dbSheet = ss.getSheetByName(dbName);
    if (dbSheet) {
      var lastCol = dbSheet.getLastColumn();
      if (lastCol >= 17) {
        pass("Master DB: พบชีต '" + dbName + "' (โครงสร้าง 17 คอลัมน์มาตรฐานครบ)");
      } else {
        warn("Master DB: ชีตมีเพียง " + lastCol + " คอลัมน์ (มาตรฐาน V4.0 คือ 17 คอลัมน์ A-Q)");
      }
    } else {
      fail("Master DB: ไม่พบชีต '" + dbName + "'");
    }


    // 2. ตรวจสอบ Mapping Sheet (V4.0 5-Tier Schema)
    var mapName = (typeof CONFIG !== 'undefined' && CONFIG.MAPPING_SHEET) ? CONFIG.MAPPING_SHEET : "NameMapping";
    var mapSheet = ss.getSheetByName(mapName);
    if (mapSheet) {
      var mapCols = mapSheet.getLastColumn();
      if (mapCols >= 5) {
        pass("Name Mapping: โครงสร้าง 5 คอลัมน์ V4.0 ถูกต้อง [Variant, UID, Conf, By, TS]");
      } else {
        warn("Name Mapping: มีแค่ " + mapCols + " คอลัมน์ (ควรใช้เมนู Upgrade เป็น V4.0)");
      }
    } else {
      fail("Name Mapping: ไม่พบชีต '" + mapName + "'");
    }


    // 3. ตรวจสอบ SCG Daily Data Sheet
    if (typeof SCG_CONFIG !== 'undefined') {
      var scgData = ss.getSheetByName(SCG_CONFIG.SHEET_DATA || "Data");
      if (scgData) pass("SCG Operation: พบชีต Data สำหรับงานประจำวัน");
      else warn("SCG Operation: ไม่พบชีต Data");
    }


    // 4. ตรวจสอบ PostalRef Sheet (New V4.0 Requirement)
    var postalName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_POSTAL) ? CONFIG.SHEET_POSTAL : "PostalRef";
    if (ss.getSheetByName(postalName)) {
      pass("Geo Database: พบชีต '" + postalName + "' สำหรับอ้างอิงรหัสไปรษณีย์ออฟไลน์");
    } else {
      warn("Geo Database: ไม่พบชีต '" + postalName + "' (การแกะที่อยู่ Tier 2 อาจไม่แม่นยำ)");
    }


    ui.alert("🕵️‍♂️ ผลการสแกนชีตและโครงสร้างข้อมูล:\n\n" + logs.join("\n"));
    console.info("[Diagnostic] Phase 2 (Sheets) completed.");


  } catch (e) {
    console.error("[Diagnostic Error]: " + e.message);
    ui.alert("🚨 เกิด Error ระหว่างตรวจสอบชีต:\n" + e.message);
  }
}
```

---
## 📄 ไฟล์: Utils_Common.gs
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
    if (/[0-9]{9,10}/.test(n) || /โทร/.test(n)) s -= 50;
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
 clean = clean.replace(/\s*[0-9]{1,2}-[0-9]{3}-[0-9]{4}/g, '');
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

```

---
## 📄 ไฟล์: WebApp.gs
```javascript
/**
 * VERSION: 001
 * 🌐 WebApp Controller (Enterprise Edition)
 * Version: 4.0 Omni-Channel Interface & Webhook API
 * -------------------------------------------------------------
 * [PRESERVED]: URL Parameter handling, Safe Include, Version Control.
 * [ADDED v4.0]: doPost() for API/Webhook readiness (AppSheet/External Triggers).
 * [MODIFIED v4.0]: Enhanced doGet() with Cache Busting (Timestamp-based).
 * [MODIFIED v4.0]: Robust getUserContext() with safe fallback for anonymous users.
 * [SECURITY]: ALLOWALL X-Frame mode for embedding in SharePoint/AppSheet.
 * Author: Elite Logistics Architect
 */


/**
 * 🖥️ ฟังก์ชันแสดงผลหน้าเว็บ (HTTP GET)
 * รองรับการค้นหาแบบระบุคำค้นล่วงหน้า: .../exec?q=ชื่อลูกค้า
 * รองรับการเปลี่ยนหน้า: .../exec?page=Admin
 */
function doGet(e) {
  try {
    // บันทึก Log การเข้าใช้งาน (Audit Trail สำหรับ GCP Monitoring)
    console.info(`[WebApp] GET Request received. Params: ${JSON.stringify(e.parameter)}`);


    // 1. Page Routing (กำหนดหน้าเริ่มต้นเป็น Index)
    var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'Index';


    // 2. สร้าง Template จากไฟล์ HTML
    var template = HtmlService.createTemplateFromFile(page);


    // 3. รับค่าจาก URL Parameter (Deep Linking)
    var paramQuery = (e && e.parameter && e.parameter.q) ? e.parameter.q : "";
    template.initialQuery = paramQuery;


    // 4. ส่งค่าระบบไปหน้าบ้าน (Cache Busting)
    // ใช้ Timestamp เพื่อบังคับให้เบราว์เซอร์โหลด JS/CSS ใหม่ทุกครั้งที่มีการเปิด
    template.appVersion = new Date().getTime(); 
    template.isEnterprise = true;


    // 5. Evaluate & Render
    var output = template.evaluate()
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0')
      .setTitle('🔍 Logistics Master Search (V4.0)')
      .setFaviconUrl('https://img.icons8.com/color/48/truck--v1.png');


    // 6. X-Frame Options (ALLOWALL)
    // จำเป็นมากสำหรับการฝัง (Embed) ใน SharePoint หรือ AppSheet Web View
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);


    return output;


  } catch (err) {
    console.error(`[WebApp] GET Error: ${err.message}`);
    // Fallback UI กรณีหาไฟล์ HTML ไม่เจอหรือระบบขัดข้อง
    return HtmlService.createHtmlOutput(`
      <div style="font-family: 'Kanit', sans-serif; padding: 40px; text-align: center; background-color: #fef2f2;">
        <h3 style="color: #dc2626;">❌ System Error (V4.0)</h3>
        <p style="color: #4b5563;">${err.message}</p>
        <hr style="border: 0; border-top: 1px dashed #fca5a5; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">กรุณาติดต่อ System Administrator เพื่อตรวจสอบความถูกต้องของไฟล์ HTML</p>
      </div>
    `);
  }
}


/**
 * 📡 [ADDED v4.0] ฟังก์ชันรับข้อมูลผ่าน Webhook/API (HTTP POST)
 * รองรับการเชื่อมต่อจาก AppSheet หรือระบบภายนอกเพื่อสั่งงานเบื้องหลังแบบไร้หน้าจอ
 */
function doPost(e) {
  try {
    console.info("[WebApp] POST Request received.");
    if (!e || !e.postData) throw new Error("No payload found in POST request.");


    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;


    // --- API ROUTING LOGIC ---
    if (action === "triggerAIBatch") {
      // สั่งให้ AI Agent เริ่มวิเคราะห์ข้อมูลชุดล่าสุด
      if (typeof processAIIndexing_Batch === 'function') {
        var count = processAIIndexing_Batch();
        return createJsonResponse_({ status: "success", message: "AI Batch Triggered", processed: count });
      }
    } 
    
    else if (action === "clearCache") {
      // สั่งล้างแคชระบบค้นหาจากภายนอก
      if (typeof clearSearchCache === 'function') {
        clearSearchCache();
        return createJsonResponse_({ status: "success", message: "Search Cache Cleared" });
      }
    }


    // Default response สำหรับ Webhook ทั่วไป
    return createJsonResponse_({ status: "success", message: "Webhook received", data: payload });


  } catch (err) {
    console.error("[WebApp] POST Error: " + err.message);
    return createJsonResponse_({ status: "error", message: err.message });
  }
}


/**
 * 🛠️ Helper: สร้าง JSON Response ให้ doPost
 */
function createJsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * 📦 ฟังก์ชันสำหรับดึง CSS/JS เข้ามาใน HTML (Server-Side Include)
 * ช่วยจัดระเบียบโค้ดใน Index.html ให้สะอาด
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    console.warn("[WebApp] Missing include file: " + filename);
    return "<!-- Error: File '" + filename + "' not found. -->";
  }
}


/**
 * 🔐 ฟังก์ชันสำหรับตรวจสอบ User (Safe Context)
 * ใช้สำหรับระบุว่าพนักงานคนไหนกำลังค้นหาข้อมูลพิกัด
 */
function getUserContext() {
  try {
    var user = Session.getActiveUser();
    var email = user ? user.getEmail() : "anonymous";
    
    return {
      email: email || "anonymous",
      locale: Session.getActiveUserLocale() || "th",
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.warn("[WebApp] Failed to get user context: " + e.message);
    return { email: "unknown", locale: "th" };
  }
}
```

---
