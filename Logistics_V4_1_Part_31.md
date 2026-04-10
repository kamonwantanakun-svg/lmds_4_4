# 🚛 Logistics Master Data System V4.1 - Part 3/3

### 📄 ไฟล์: Service_Agent.gs
```javascript
/**
 * VERSION: 001
 * 🕵️ Service: Logistics AI Agent (Enterprise Edition)
 * Codename: "The Steward"
 * Version: 4.0 Smart Resolution & Safe Concurrency
 * -----------------------------------------------------------
 * [PRESERVED]: Manual/Scheduled Triggers and basic typo prediction logic. [1, 23]
 * [FIXED v4.0]: Changed Full-Sheet write to Specific-Column write to prevent data collision. [10, 22]
 * [ADDED v4.0]: resolveUnknownNamesWithAI() - The Tier 4 Smart Resolution engine. [7, 20]
 * [MODIFIED v4.0]: AI Calls now enforce application/json and temperature 0.1 for stability. [6, 7, 24]
 * Author: Elite Logistics Architect
 */


var AGENT_CONFIG = {
  NAME: "Logistics_Agent_01",
  MODEL: (typeof CONFIG !== 'undefined' && CONFIG.AI_MODEL) ? CONFIG.AI_MODEL : "gemini-1.5-flash",
  BATCH_SIZE: (typeof CONFIG !== 'undefined' && CONFIG.AI_BATCH_SIZE) ? CONFIG.AI_BATCH_SIZE : 20,
  TAG: "[Agent_V4]", // Tag ประจำตัว Agent รุ่นใหม่ [16, 25]
  CONFIDENCE_THRESHOLD: 60 // ขั้นต่ำของคะแนนความมั่นใจที่จะยอมรับการจับคู่ [6, 7]
};


// ==========================================
// 1. AGENT TRIGGERS & CONTROLS
// ==========================================


/**
 * 👋 สั่ง Agent ให้ตื่นมาทำงานเดี๋ยวนี้ (Manual Trigger) [16, 26]
 */
function WAKE_UP_AGENT() {
  SpreadsheetApp.getUi().toast("🕵️ Agent: ผมตื่นแล้วครับ กำลังเริ่มวิเคราะห์ข้อมูล...", "AI Agent Started");
  try {
    runAgentLoop();
    SpreadsheetApp.getUi().alert("✅ Agent รายงานผล:\nวิเคราะห์ข้อมูลชุดล่าสุดเสร็จสิ้น (Batch Mode)");
  } catch (e) {
    SpreadsheetApp.getUi().alert("❌ Agent Error: " + e.message);
  }
}


/**
 * ⏰ ตั้งเวลาให้ Agent ตื่นมาทำงานเองทุก 10 นาที [27, 28]
 */
function SCHEDULE_AGENT_WORK() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runAgentLoop") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("runAgentLoop")
    .timeBased()
    .everyMinutes(10)
    .create();
  SpreadsheetApp.getUi().alert("✅ ตั้งค่าเรียบร้อย!\nThe Steward จะทำงานทุก 10 นาที");
}


// ==========================================
// 2. TIER 4: SMART RESOLUTION (NEW v4.0)
// ==========================================


/**
 * 🧠 [NEW v4.0] ฟังก์ชันส่งชื่อแปลกๆ ให้ AI วิเคราะห์จับคู่กับ Database
 * ใช้ความซับซ้อนระดับสูงในการลดระยะห่างทางความหมาย (Semantic Mapping) [7, 29]
 */
function resolveUnknownNamesWithAI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheetByName(typeof SCG_CONFIG !== 'undefined' ? SCG_CONFIG.SHEET_DATA : 'Data');
  var dbSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);


  if (!dataSheet || !dbSheet || !mapSheet) return;


  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { // ป้องกันการเขียนทับซ้อน [30, 31]
    SpreadsheetApp.getUi().alert("⚠️ ระบบคิวทำงาน", "มีระบบอื่นกำลังใช้งานอยู่ กรุณารอสักครู่", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }


  try {
    console.time("SmartResolution_Time");
    
    // 1. หาชื่อที่ยังจับคู่ไม่ได้จากชีต Data [32]
    var dLastRow = dataSheet.getLastRow();
    if (dLastRow < 2) return;
    var dataValues = dataSheet.getRange(2, 1, dLastRow - 1, 29).getValues();
    var unknownNames = new Set();
    dataValues.forEach(function(r) {
      var shipToName = r[33]; // Col K: ShipToName [34]
      var actualGeo = r[35];  // Col AA: LatLong_Actual
      if (shipToName && !actualGeo) {
        unknownNames.add(normalizeText(shipToName));
      }
    });


    var unknownsArray = Array.from(unknownNames).slice(0, AGENT_CONFIG.BATCH_SIZE);
    if (unknownsArray.length === 0) {
      SpreadsheetApp.getUi().alert("ℹ️ AI Standby: ไม่มีรายชื่อตกหล่นที่ต้องให้ AI วิเคราะห์ครับ");
      return;
    }


    // 2. ดึง Master Data มาเป็นบริบท (Context) ให้ AI [36]
    var mLastRow = dbSheet.getLastRow();
    var dbValues = dbSheet.getRange(2, 1, mLastRow - 1, Math.max(CONFIG.COL_NAME, CONFIG.COL_UUID)).getValues();
    var masterOptions = [];
    dbValues.forEach(function(r) {
      var name = r[CONFIG.C_IDX.NAME];
      var uid = r[CONFIG.C_IDX.UUID];
      if (name && uid) masterOptions.push({ "uid": uid, "name": name });
    });


    // 3. ส่งข้อมูลให้ Gemini ประมวลผลด้วยตรรกะล้วน (Temp 0.1) [6, 7, 37]
    var apiKey = CONFIG.GEMINI_API_KEY;
    var prompt = `You are an expert Thai Logistics Data Analyst.
Task: Match unknown delivery names to the master database. 
Constraint: High logical reasoning. Output ONLY JSON array. 
Confidence Threshold: Skip if < ${AGENT_CONFIG.CONFIDENCE_THRESHOLD}%.
Unknown Names: ${JSON.stringify(unknownsArray)}
Master Database (Subset): ${JSON.stringify(masterOptions.slice(0, 500))}
Output Format: [{"variant": "Original Name", "uid": "UUID", "confidence": 95}]`;


    var payload = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": { "responseMimeType": "application/json", "temperature": 0.1 }
    };


    var response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AGENT_CONFIG.MODEL}:generateContent?key=${apiKey}`, {
      "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true
    });


    var json = JSON.parse(response.getContentText());
    if (!json.candidates) throw new Error("AI returned no results.");
    var matchedResults = JSON.parse(json.candidates.content.parts.text);


    // 4. บันทึกผลลง NameMapping 5-Tier Schema [9, 21]
    var mapRows = [];
    var ts = new Date();
    if (Array.isArray(matchedResults)) {
      matchedResults.forEach(function(match) {
        if (match.uid && match.confidence >= AGENT_CONFIG.CONFIDENCE_THRESHOLD) {
          mapRows.push([match.variant, match.uid, match.confidence, "AI_Agent_V4", ts]);
        }
      });
    }


    if (mapRows.length > 0) {
      mapSheet.getRange(mapSheet.getLastRow() + 1, 1, mapRows.length, 5).setValues(mapRows);
      if (typeof clearSearchCache === 'function') clearSearchCache(); // ล้างแคชเพื่อให้เห็นข้อมูลใหม่ [38, 39]
      if (typeof applyMasterCoordinatesToDailyJob === 'function') applyMasterCoordinatesToDailyJob(); 
      
      // แจ้งเตือนสถานะความสำเร็จ [13]
      if (typeof notifyAutoPilotStatus === 'function') notifyAutoPilotStatus("AI Successful", 0, mapRows.length);
      
      SpreadsheetApp.getUi().alert(`✅ AI ทำงานสำเร็จ!\nจับคู่รายชื่อสำเร็จ ${mapRows.length} รายการ และบันทึกลง NameMapping อัตโนมัติแล้ว`);
    } else {
      SpreadsheetApp.getUi().alert("ℹ️ AI วิเคราะห์แล้วแต่ไม่พบความมั่นใจที่เพียงพอในการจับคู่");
    }


  } catch (e) {
    console.error("[AI Smart Resolution Error]: " + e.message);
    SpreadsheetApp.getUi().alert("❌ เกิดข้อผิดพลาดในระบบ AI: " + e.message);
  } finally {
    lock.releaseLock();
    console.timeEnd("SmartResolution_Time");
  }
}


// ==========================================
// 3. BACKGROUND TYPO PREDICTION LOOP
// ==========================================


/**
 * 🔄 Agent Loop (Optimized Safe Batch Processing V4.0)
 * วิเคราะห์คำพิมพ์ผิดเพื่อสร้างดัชนีการค้นหา (Omni-Search Index) [14, 22]
 */
function runAgentLoop() {
  console.time("Agent_Thinking_Time");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;


  try {
    if (!CONFIG.GEMINI_API_KEY) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) return;


    var lastRow = (typeof getRealLastRow_ === 'function') ? getRealLastRow_(sheet, CONFIG.COL_NAME) : sheet.getLastRow();
    if (lastRow < 2) return;


    // [FIXED v4.0]: เขียนกลับเฉพาะคอลัมน์ที่จำเป็น เพื่อป้องกัน Data Collision [1, 10, 40]
    var rangeName = sheet.getRange(2, CONFIG.COL_NAME, lastRow - 1, 1);
    var rangeNorm = sheet.getRange(2, CONFIG.COL_NORMALIZED, lastRow - 1, 1);
    var rangeUUID = sheet.getRange(2, CONFIG.COL_UUID, lastRow - 1, 1);


    var names = rangeName.getValues();
    var norms = rangeNorm.getValues();
    var uuids = rangeUUID.getValues();
    var jobsDone = 0, isUpdated = false;


    for (var i = 0; i < names.length; i++) {
      if (jobsDone >= AGENT_CONFIG.BATCH_SIZE) break;
      var name = names[i];
      var currentNorm = norms[i];


      // ตรวจสอบว่าเคยผ่านการวิเคราะห์โดย Agent รุ่นนี้หรือยัง [19]
      if (name && (!currentNorm || String(currentNorm).indexOf(AGENT_CONFIG.TAG) === -1)) {
        console.log(`Agent: Analyzing "${name}"`);
        var aiThoughts = "";
        try {
          aiThoughts = (typeof genericRetry === 'function')
            ? genericRetry(function() { return askGeminiToPredictTypos(name); }, 2)
            : askGeminiToPredictTypos(name);
        } catch(e) { continue; }


        norms[i] = ((currentNorm ? currentNorm + " " : "") + aiThoughts + " " + AGENT_CONFIG.TAG).trim();
        if (!uuids[i]) uuids[i] = generateUUID(); // เติม UUID อัตโนมัติถ้าไม่มี [41, 42]
        jobsDone++;
        isUpdated = true;
      }
    }


    if (isUpdated) {
      rangeNorm.setValues(norms);
      rangeUUID.setValues(uuids);
      console.log(`Agent: ✅ Batch Update Completed (${jobsDone} rows)`);
    }
  } catch (e) {
    console.error("Agent Fatal Error: " + e.message);
  } finally {
    lock.releaseLock();
    console.timeEnd("Agent_Thinking_Time");
  }
}


/**
 * 📡 Skill: การคาดเดาคำผิด (Typos Prediction)
 * บังคับ Output เป็น JSON เพื่อความเสถียรของระบบ [11, 24]
 */
function askGeminiToPredictTypos(originalName) {
  var prompt = `Task: Generate Thai logistics search keywords/typos for: "${originalName}". 
Output ONLY a JSON array of strings. 
Example: ["Keyword1", "Keyword2"]`;


  var payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "responseMimeType": "application/json", "temperature": 0.4 }
  };


  var options = {
    "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true
  };


  var url = `https://generativelanguage.googleapis.com/v1beta/models/${AGENT_CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  var response = UrlFetchApp.fetch(url, options);


  if (response.getResponseCode() !== 200) throw new Error("Gemini API Error");


  var json = JSON.parse(response.getContentText());
  if (json.candidates && json.candidates.content) {
    var text = json.candidates.content.parts.text;
    var keywordsArray = JSON.parse(text);
    if (Array.isArray(keywordsArray)) return keywordsArray.join(" ");
  }
  return "";
}
```

---

### 📄 ไฟล์: Setup_Security.gs
```javascript
/**
 * VERSION: 001
 * 🔐 Security Setup Utility (Enterprise Edition)
 * Version: 4.0 Omni-Vault (Safe Storage & Validation)
 * -----------------------------------------------------------------
 * [PRESERVED]: PropertiesService for secure credential storage.
 * [MODIFIED v4.0]: Upgraded validation to check for "AIza" prefix for Gemini.
 * [MODIFIED v4.0]: Changed resetEnvironment to selectively delete keys (preventing full wipe).
 * [ADDED v4.0]: setupLineToken() & setupTelegramConfig() to support Menu V4.0.
 * [MODIFIED v4.0]: Switched to console.info for GCP Audit Logging.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. GEMINI AI (CORE SECURITY)
// ==========================================


/**
 * 🔐 ตั้งค่า Gemini API Key อย่างปลอดภัย
 * ห้ามแก้ Config.gs เพื่อใส่ Key โดยตรงเด็ดขาด!
 */
function setupEnvironment() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    '🔐 Security Setup: Gemini API',
    'กรุณากรอก Gemini API Key (ต้องขึ้นต้นด้วย AIza...):\nสามารถรับฟรีได้ที่ Google AI Studio',
    ui.ButtonSet.OK_CANCEL
  );


  if (response.getSelectedButton() == ui.Button.OK) {
    var key = response.getResponseText().trim();
    
    // [MODIFIED v4.0]: ตรวจสอบความถูกต้องของ Key ขั้นสูง (มาตรฐาน Google Cloud)
    if (key.length > 30 && key.startsWith("AIza")) {
      // Save to Script Properties (Hidden & Secure)
      PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
      ui.alert('✅ บันทึก API Key สำเร็จ!\nระบบ AI พร้อมใช้งานแล้วครับ');
      console.info("[Security Audit] User updated GEMINI_API_KEY.");
    } else {
      ui.alert('❌ API Key ไม่ถูกต้อง', 'Key ของ Gemini ต้องขึ้นต้นด้วย "AIza" และมีความยาวที่ถูกต้อง กรุณาลองใหม่ครับ', ui.ButtonSet.OK);
      console.warn("[Security Audit] Failed attempt to update GEMINI_API_KEY (Invalid format).");
    }
  } else {
    console.info("[Security Audit] Setup cancelled by user.");
  }
}


// ==========================================
// 2. NOTIFICATION TOKENS (NEW v4.0)
// ==========================================


/**
 * 🔔 [ADDED v4.0] ตั้งค่า LINE Notify Token
 * รองรับเมนู V4.0 ที่ประกาศไว้ใน Menu.gs
 */
function setupLineToken() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    '🔔 Setup: LINE Notify',
    'กรุณากรอก LINE Notify Token ของกลุ่มที่ต้องการให้ระบบแจ้งเตือน:',
    ui.ButtonSet.OK_CANCEL
  );


  if (response.getSelectedButton() == ui.Button.OK) {
    var token = response.getResponseText().trim();
    if (token.length > 20) {
      PropertiesService.getScriptProperties().setProperty('LINE_NOTIFY_TOKEN', token);
      ui.alert('✅ บันทึก LINE Token สำเร็จ!');
      console.info("[Security Audit] User updated LINE_NOTIFY_TOKEN.");
    } else {
      ui.alert('❌ Token สั้นเกินไป กรุณาตรวจสอบอีกครั้ง');
    }
  }
}


/**
 * ✈️ [ADDED v4.0] ตั้งค่า Telegram Config (Bot Token & Chat ID)
 */
function setupTelegramConfig() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();


  var resBot = ui.prompt('✈️ Setup: Telegram', '1. กรุณากรอก Bot Token (เช่น 123456:ABC-DEF...):', ui.ButtonSet.OK_CANCEL);
  if (resBot.getSelectedButton() !== ui.Button.OK) return;
  var botToken = resBot.getResponseText().trim();


  var resChat = ui.prompt('✈️ Setup: Telegram', '2. กรุณากรอก Chat ID (เช่น -100123456789):', ui.ButtonSet.OK_CANCEL);
  if (resChat.getSelectedButton() !== ui.Button.OK) return;
  var chatId = resChat.getResponseText().trim();


  if (botToken && chatId) {
    props.setProperty('TG_BOT_TOKEN', botToken);
    props.setProperty('TG_CHAT_ID', chatId);
    ui.alert('✅ บันทึก Telegram Config สำเร็จ!');
    console.info("[Security Audit] User updated Telegram configurations.");
  } else {
    ui.alert('❌ ข้อมูลไม่ครบถ้วน ยกเลิกการบันทึก');
  }
}


// ==========================================
// 3. MAINTENANCE & AUDIT
// ==========================================


/**
 * 🗑️ [MODIFIED v4.0] ล้างค่าเฉพาะระบบที่ต้องการ (Safe Reset)
 * ป้องกันการเผลอลบ Token สำคัญอื่นๆ ที่ไม่ได้เกี่ยวข้อง
 */
function resetEnvironment() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '⚠️ Danger Zone',
    'คุณต้องการล้างรหัส API Key ของ Gemini ใช่หรือไม่?\n(ระบบจะลบเฉพาะ GEMINI_API_KEY เท่านั้น)',
    ui.ButtonSet.YES_NO
  );


  if (response == ui.Button.YES) {
    PropertiesService.getScriptProperties().deleteProperty('GEMINI_API_KEY');
    ui.alert('🗑️ ล้างการตั้งค่า Gemini API Key เรียบร้อยแล้ว');
    console.info("[Security Audit] User DELETED GEMINI_API_KEY.");
  }
}


/**
 * 🏥 ตรวจสอบสถานะการเชื่อมต่อ (System Secrets Status)
 * ใช้ตรวจเช็คว่าเราลืมใส่ Key ไหนไปบ้าง โดยไม่เปิดเผย Key จริง
 */
function checkCurrentKeyStatus() {
  var props = PropertiesService.getScriptProperties();
  var geminiKey = props.getProperty('GEMINI_API_KEY');
  var lineToken = props.getProperty('LINE_NOTIFY_TOKEN');
  var tgBot = props.getProperty('TG_BOT_TOKEN');
  var ui = SpreadsheetApp.getUi();


  var statusMsg = "📊 **System Secrets Status**\n\n";


  if (geminiKey) {
    // [MODIFIED v4.0]: แสดงเฉพาะ 4 ตัวท้ายเพื่อความปลอดภัย
    statusMsg += "🟢 Gemini AI: READY (Ends with ..." + geminiKey.slice(-4) + ")\n";
  } else {
    statusMsg += "🔴 Gemini AI: NOT SET\n";
  }


  if (lineToken) {
    statusMsg += "🟢 LINE Notify: READY\n";
  } else {
    statusMsg += "⚪ LINE Notify: NOT SET\n";
  }


  if (tgBot) {
    statusMsg += "🟢 Telegram: READY\n";
  } else {
    statusMsg += "⚪ Telegram: NOT SET\n";
  }


  ui.alert("System Health Check", statusMsg, ui.ButtonSet.OK);
  console.info("[Security Audit] Secrets status checked by user.");
}
```

---

### 📄 ไฟล์: Service_Maintenance.gs
```javascript
/**
 * VERSION: 001
 * 🧹 Service: System Maintenance & Alerts (Enterprise Edition)
 * หน้าที่: ดูแลรักษาความสะอาดไฟล์ ลบ Backup เก่า และแจ้งเตือนสุขภาพระบบ
 * Version: 4.0 Omni-Alerts & Housekeeping
 * -------------------------------------------------------------
 * [PRESERVED]: 10M Cell Limit check and 30-day Backup retention logic.
 * [MODIFIED v4.0]: Improved Regex for extracting dates from Backup sheets (yyyyMMdd).
 * [MODIFIED v4.0]: Integrated with Service_Notify for Centralized Broadcasting.
 * [ADDED v4.0]: Added LockService and GCP Console Logging for audit trails.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. SYSTEM MAINTENANCE (HOUSEKEEPING)
// ==========================================


/**
 * 🗑️ ลบชีต Backup ที่เก่ากว่า 30 วัน
 * แนะนำ: ตั้ง Trigger รันทุกสัปดาห์ (Weekly Maintenance)
 */
function cleanupOldBackups() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { // ป้องกันการรันซ้อนกัน
    console.warn("[Maintenance] ข้ามการทำงานเนื่องจากระบบอื่นกำลังใช้งานอยู่");
    return;
  }


  try {
    console.info("[Maintenance] Starting backup cleanup...");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var deletedCount = 0;
    var keepDays = 30; // มาตรฐานองค์กร: เก็บย้อนหลัง 30 วัน
    var now = new Date();
    var deletedNames = [];


    sheets.forEach(function(sheet) {
      var name = sheet.getName();
      // ตรวจสอบชีตที่สร้างจากกระบวนการ Finalize & Clean
      if (name.startsWith("Backup_")) {
        // [MODIFIED v4.0]: Regex ขั้นสูงสำหรับแกะวันที่ ปี(4) เดือน(2) วัน(2)
        var datePart = name.match(/(\d{4})(\d{2})(\d{2})/); 
        
        if (datePart && datePart.length === 4) {
          var year = parseInt(datePart[16]);
          var month = parseInt(datePart[17]) - 1; // JavaScript Month เริ่มที่ 0 (Jan)
          var day = parseInt(datePart[18]);
          var sheetDate = new Date(year, month, day);
          
          var diffTime = Math.abs(now - sheetDate);
          var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));


          if (diffDays > keepDays) {
            try {
              ss.deleteSheet(sheet);
              deletedCount++;
              deletedNames.push(name);
            } catch(e) {
              console.error("[Maintenance] Failed to delete " + name + ": " + e.message);
            }
          }
        }
      }
    });


    if (deletedCount > 0) {
      var reportMsg = `🧹 Maintenance Report:\nระบบได้ลบชีต Backup ที่เก่ากว่า ${keepDays} วัน จำนวน ${deletedCount} ชีตเรียบร้อยแล้ว`;
      console.info(`[Maintenance] Successfully deleted ${deletedCount} backups.`);
      
      // ส่งแจ้งเตือนผ่านช่องทางรวม (Omni-Channel Notify)
      if (typeof sendSystemNotify === 'function') {
        sendSystemNotify(reportMsg, false);
      }
      SpreadsheetApp.getActiveSpreadsheet().toast(`ลบ Backup เก่าไป ${deletedCount} ชีต`, "System Maintenance");
    } else {
      console.log("[Maintenance] No old backups to delete.");
    }


  } catch (err) {
    console.error("[Maintenance Error] " + err.message);
  } finally {
    lock.releaseLock();
  }
}


/**
 * 🏥 ตรวจสอบสุขภาพไฟล์ (Cell Limit Check)
 * ป้องกันปัญหาระบบค้างเนื่องจากข้อมูลเกิน 10 ล้านเซลล์
 */
function checkSpreadsheetHealth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Google Sheets Limit: 10 Million Cells (Enterprise Standard)
  var cellLimit = 10000000; 
  var totalCells = 0;
  var sheetCount = 0;


  ss.getSheets().forEach(function(s) {
    totalCells += (s.getMaxRows() * s.getMaxColumns());
    sheetCount++;
  });


  var usagePercent = (totalCells / cellLimit) * 100;
  var msg = `🏥 System Health Report:\n- จำนวนชีต: ${sheetCount}\n- การใช้งาน: ${totalCells.toLocaleString()} Cells\n- อัตราการใช้: ${usagePercent.toFixed(2)}%`;
  
  console.info(`[System Health] Usage: ${usagePercent.toFixed(2)}% (${totalCells}/${cellLimit} cells)`);


  if (usagePercent > 80) {
    var warnMsg = `⚠️ CRITICAL WARNING: ไฟล์ใกล้เต็มแล้ว!\n\nการใช้งานปัจจุบันอยู่ที่ ${usagePercent.toFixed(2)}% (${totalCells.toLocaleString()} Cells)\nกรุณารันฟังก์ชันลบ Backup เก่า หรือย้ายข้อมูลไปยัง BigQuery ด่วนครับ`;
    
    // แจ้งเตือนฉุกเฉินเข้า LINE/Telegram
    if (typeof sendSystemNotify === 'function') {
      sendSystemNotify(warnMsg, true);
    }
    SpreadsheetApp.getUi().alert("⚠️ SYSTEM ALERT", warnMsg, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    // ถ้ารันมือผ่านเมนู ให้โชว์ Toast แจ้งสถานะปกติ
    ss.toast(`Spreadsheet Health OK (${usagePercent.toFixed(1)}%)`, "Health Check", 5);
  }
}


// ==========================================
// 2. FALLBACK ALERTS (DEPRECATED: Use Service_Notify)
// ==========================================


/**
 * หมายเหตุ: ฟังก์ชันด้านล่างนี้มีไว้เพื่อความเข้ากันได้ย้อนหลัง (Backward Compatibility)
 * ระบบ V4.0 จะทำการ Override (เขียนทับ) ฟังก์ชันเหล่านี้ด้วย Service_Notify.gs อัตโนมัติ
 */
function sendLineNotify(message, isUrgent) {
  if (typeof sendLineNotify_Internal_ === 'function') {
    sendLineNotify_Internal_(message, isUrgent);
  } else {
    console.warn("Service_Notify not found. Local alert failed.");
  }
}


function sendTelegramNotify(message) {
  if (typeof sendTelegramNotify_Internal_ === 'function') {
    sendTelegramNotify_Internal_(message, false);
  } else {
    console.warn("Service_Notify not found. Local alert failed.");
  }
}
```

---

### 📄 ไฟล์: Service_Notify.gs
```javascript
/**
 * VERSION: 001
 * 🔔 Service: Omni-Channel Notification Hub (Enterprise Edition)
 * Version: 4.0 Centralized Broadcaster
 * หน้าที่: ศูนย์กลางส่งแจ้งเตือนสถานะระบบและ Error เข้า LINE และ Telegram
 * ------------------------------------------------
 * [PRESERVED]: Dual-channel architecture and HTML escaping. [1]
 * [REMOVED v4.0]: Setup functions removed (Delegated to Setup_Security.gs V4.0). [3]
 * [MODIFIED v4.0]: Overrides basic notifiers in Module 14 with robust Try-Catch logic. [1]
 * [MODIFIED v4.0]: Prevents API limits/errors from crashing main business flows. [3]
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. CORE SENDING LOGIC (Unified Broadcaster)
// ==========================================


/**
 * 📤 ฟังก์ชันส่งข้อความรวม (Broadcast V4.0)
 * ส่งเข้าทุกช่องทางที่ตั้งค่าไว้ (LINE และ/หรือ Telegram)
 * @param {string} message - ข้อความ
 * @param {boolean} isUrgent - เป็น Error หรือเรื่องด่วนหรือไม่
 */
function sendSystemNotify(message, isUrgent) {
  console.info(`[Notification Hub] Broadcasting message (Urgent: ${!!isUrgent})`); [14]


  // รันแบบขนาน (จำลองใน GAS โดยใช้ Try-Catch แยกกัน)
  // ป้องกันกรณีช่องทางใดช่องทางหนึ่งตาย แล้วพาลให้อีกช่องทางไม่ส่ง [5], [6]
  try {
    sendLineNotify_Internal_(message, isUrgent);
  } catch (e) {
    console.error("[Notify Hub] LINE Broadcast Failed: " + e.message); [6]
  }


  try {
    sendTelegramNotify_Internal_(message, isUrgent);
  } catch (e) {
    console.error("[Notify Hub] Telegram Broadcast Failed: " + e.message); [6]
  }
}


// ==========================================
// 2. PUBLIC WRAPPERS (Overrides Module 14)
// ==========================================


/**
 * [MODIFIED v4.0] Wrapper สำหรับเขียนทับ (Override) ฟังก์ชันใน Service_Maintenance.gs
 * ทำให้ทุกการเรียกใช้ sendLineNotify ในระบบ วิ่งมาใช้ Logic ระดับ Enterprise ตัวนี้แทน [10], [11]
 */
function sendLineNotify(message, isUrgent) {
  sendLineNotify_Internal_(message, isUrgent);
}


/**
 * [MODIFIED v4.0] Wrapper สำหรับเขียนทับ (Override) ฟังก์ชันใน Service_Maintenance.gs [15], [11]
 */
function sendTelegramNotify(message, isUrgent) {
  sendTelegramNotify_Internal_(message, isUrgent);
}


// ==========================================
// 3. INTERNAL CHANNEL HANDLERS
// ==========================================


/**
 * Internal: ยิง API เข้า LINE Notify อย่างปลอดภัย
 */
function sendLineNotify_Internal_(message, isUrgent) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_NOTIFY_TOKEN'); [15], [16]
  if (!token) return; // Silent skip if not configured


  var prefix = isUrgent ? "🚨 URGENT ALERT:\n" : "🤖 SYSTEM REPORT:\n"; [12], [16]
  var fullMsg = prefix + message;


  try {
    var response = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", {
      "method": "post",
      "headers": { "Authorization": "Bearer " + token },
      "payload": { "message": fullMsg },
      "muteHttpExceptions": true
    });


    if (response.getResponseCode() !== 200) {
      console.warn("[LINE API Error] " + response.getContentText()); [17]
    }
  } catch (e) {
    console.warn("[LINE Exception] " + e.message); [12], [17]
  }
}


/**
 * Internal: ยิง API เข้า Telegram อย่างปลอดภัย
 */
function sendTelegramNotify_Internal_(message, isUrgent) {
  var token = PropertiesService.getScriptProperties().getProperty('TG_BOT_TOKEN'); // ใช้ Key ตาม Setup_Security V4.0 [12], [17]
  var chatId = PropertiesService.getScriptProperties().getProperty('TG_CHAT_ID');  // ใช้ Key ตาม Setup_Security V4.0 [18]


  // Fallback for V2.0 keys if still present [19], [18]
  if (!token) token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!chatId) chatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');


  if (!token || !chatId) return; // Silent skip if not configured


  // Format Message (HTML Style)
  var icon = isUrgent ? "🚨" : "🤖"; [19], [18]
  var title = isUrgent ? "<b>SYSTEM ALERT</b>" : "<b>SYSTEM REPORT</b>";
  var htmlMsg = `${icon} ${title}\n\n${escapeHtml_(message)}`; [19], [20]


  try {
    var url = "https://api.telegram.org/bot" + token + "/sendMessage";
    var payload = {
      "chat_id": chatId,
      "text": htmlMsg,
      "parse_mode": "HTML"
    };


    var response = UrlFetchApp.fetch(url, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });


    if (response.getResponseCode() !== 200) {
      console.warn("[Telegram API Error] " + response.getContentText()); [20]
    }
  } catch (e) {
    console.warn("[Telegram Exception] " + e.message); [7], [9]
  }
}


/**
 * Helper: Escape HTML special chars for Telegram to prevent formatting errors [7], [9]
 */
function escapeHtml_(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


// ==========================================
// 4. SPECIFIC EVENT NOTIFIERS
// ==========================================


/**
 * [UPGRADED v4.0] Wrapper สำหรับ AutoPilot
 * สรุปยอดการทำงานส่งให้ผู้ดูแลระบบ [7], [9]
 */
function notifyAutoPilotStatus(scgStatus, aiCount, aiMappedCount) {
  // รองรับพารามิเตอร์ 3 ตัวเพื่อโชว์ผลลัพธ์ของ Tier 4 AI ด้วย [7], [8]
  var mappedMsg = aiMappedCount !== undefined ? `\n🎯 AI Tier-4 จับคู่สำเร็จ: ${aiMappedCount} ร้าน` : "";


  var msg = "------------------\n" +
            "✅ AutoPilot V4.0 รอบล่าสุด:\n" +
            "📦 ดึงงาน SCG: " + scgStatus + "\n" +
            "🧠 AI Indexing: " + aiCount + " รายการ" +
            mappedMsg; [21], [8]


  sendSystemNotify(msg, false);
}
```

---

### 📄 ไฟล์: Test_Diagnostic.gs
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

