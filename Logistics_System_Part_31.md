# 🚛 Logistics Master Data System V4.0 - Part 3/3

### 📄 ไฟล์: Service_Agent.gs
```javascript
/**
 * VERSION: 000
 * 🕵️ Service: Logistics AI Agent (Enterprise Edition)
 * Codename: "The Steward"
 * Version: 4.0 Smart Resolution & Safe Concurrency
 * -------------------------------------------
 * [PRESERVED]: Manual/Scheduled Triggers and basic typo prediction logic.
 * [FIXED v4.0]: Changed Full-Sheet write to Specific-Column write to prevent data collision.
 * [ADDED v4.0]: resolveUnknownNamesWithAI() - The Tier 4 Smart Resolution engine 
 * that maps unknown names to Master_UIDs and auto-updates NameMapping.
 * [MODIFIED v4.0]: AI Calls now enforce application/json for system stability.
 * Author: Elite Logistics Architect
 */


var AGENT_CONFIG = {
  NAME: "Logistics_Agent_01",
  MODEL: (typeof CONFIG !== 'undefined' && CONFIG.AI_MODEL) ? CONFIG.AI_MODEL : "gemini-1.5-flash",
  BATCH_SIZE: (typeof CONFIG !== 'undefined' && CONFIG.AI_BATCH_SIZE) ? CONFIG.AI_BATCH_SIZE : 20, 
  TAG: "[Agent_V4]" // Tag ประจำตัว Agent รุ่นใหม่
};


// ==========================================
// 1. AGENT TRIGGERS & CONTROLS
// ==========================================


/**
 * 👋 สั่ง Agent ให้ตื่นมาทำงานเดี๋ยวนี้ (Manual Trigger)
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
 * ⏰ ตั้งเวลาให้ Agent ตื่นมาทำงานเองทุก 10 นาที
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
 * ถูกเรียกใช้โดยเมนู: 🧠 4️⃣ ส่งชื่อแปลกให้ AI วิเคราะห์ (Smart Resolution)
 */
function resolveUnknownNamesWithAI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheetByName(typeof SCG_CONFIG !== 'undefined' ? SCG_CONFIG.SHEET_DATA : 'Data');
  var dbSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
  
  if (!dataSheet || !dbSheet || !mapSheet) return;


  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    SpreadsheetApp.getUi().alert("⚠️ ระบบคิวทำงาน", "มีระบบอื่นกำลังใช้งานอยู่ กรุณารอสักครู่", SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }


  try {
    console.time("SmartResolution_Time");
    
    // 1. หาชื่อที่ยังจับคู่ไม่ได้จากชีต Data (ดูจากคอลัมน์พิกัดว่าว่างไหม)
    var dLastRow = dataSheet.getLastRow();
    if (dLastRow < 2) return;
    
    var dataValues = dataSheet.getRange(2, 1, dLastRow - 1, 29).getValues();
    var unknownNames = new Set();
    
    dataValues.forEach(function(r) {
      var shipToName = r[10]; // Col K: ShipToName
      var actualGeo = r[26];  // Col AA: LatLong_Actual (พิกัดที่ระบบหาได้)
      if (shipToName && !actualGeo) {
        unknownNames.add(normalizeText(shipToName));
      }
    });


    var unknownsArray = Array.from(unknownNames).slice(0, AGENT_CONFIG.BATCH_SIZE);
    if (unknownsArray.length === 0) {
      SpreadsheetApp.getUi().alert("ℹ️ AI Standby: ไม่มีรายชื่อตกหล่นที่ต้องให้ AI วิเคราะห์ครับ");
      return;
    }


    // 2. ดึง Master Data มาเป็นตัวเลือกให้ AI
    var mLastRow = dbSheet.getLastRow();
    var dbValues = dbSheet.getRange(2, 1, mLastRow - 1, Math.max(CONFIG.COL_NAME, CONFIG.COL_UUID)).getValues();
    var masterOptions = [];
    
    dbValues.forEach(function(r) {
      var name = r[CONFIG.C_IDX.NAME];
      var uid = r[CONFIG.C_IDX.UUID];
      if (name && uid) {
        masterOptions.push({ "uid": uid, "name": name });
      }
    });


    // Limit master options to 500 to save context window (Optional, Gemini 1.5 handles big context well)
    var masterSubset = masterOptions.slice(0, 500);


    SpreadsheetApp.getActiveSpreadsheet().toast(`กำลังส่ง ${unknownsArray.length} รายชื่อให้ AI วิเคราะห์...`, "🤖 Tier 4 AI", 10);


    // 3. ส่งข้อมูลให้ Gemini คิด (Prompt Engineering)
    var apiKey = CONFIG.GEMINI_API_KEY;
    var prompt = `
      You are an expert Thai Logistics Data Analyst.
      I have a list of 'unknown_names' from a daily delivery sheet. They contain typos, abbreviations, or missing branches.
      I also have a 'master_database' of valid delivery locations with their UIDs.
      
      Task: Match each unknown name to the most likely master database entry.
      If confidence is less than 60%, do not match it (skip it).
      
      Unknown Names: ${JSON.stringify(unknownsArray)}
      Master Database: ${JSON.stringify(masterSubset)}
      
      Output ONLY a JSON array of objects with this format:
      [ { "variant": "Unknown Name", "uid": "Matched UID", "confidence": 95 } ]
    `;


    var payload = {
      "contents": [{ "parts": [{ "text": prompt }] }],
      "generationConfig": { "responseMimeType": "application/json", "temperature": 0.1 }
    };


    var response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AGENT_CONFIG.MODEL}:generateContent?key=${apiKey}`, {
      "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true
    });


    var json = JSON.parse(response.getContentText());
    if (!json.candidates || json.candidates.length === 0) throw new Error("AI returned no results.");
    
    var aiResultText = json.candidates[0].content.parts[0].text;
    var matchedResults = JSON.parse(aiResultText);


    // 4. บันทึกผลลง NameMapping (5-Column Schema V4.0)
    var mapRows = [];
    var ts = new Date();
    
    if (Array.isArray(matchedResults) && matchedResults.length > 0) {
      matchedResults.forEach(function(match) {
        if (match.uid && match.confidence >= 60) {
          mapRows.push([
            match.variant,       // Variant_Name
            match.uid,           // Master_UID
            match.confidence,    // Confidence_Score
            "AI_Agent_V4",       // Mapped_By
            ts                   // Timestamp
          ]);
        }
      });
    }


    if (mapRows.length > 0) {
      mapSheet.getRange(mapSheet.getLastRow() + 1, 1, mapRows.length, 5).setValues(mapRows);
      
      // สั่งเคลียร์ Cache ค้นหา และ รันจับคู่พิกัดซ้ำทันที
      if (typeof clearSearchCache === 'function') clearSearchCache();
      if (typeof applyMasterCoordinatesToDailyJob === 'function') applyMasterCoordinatesToDailyJob();
      
      SpreadsheetApp.getUi().alert(`✅ AI ทำงานสำเร็จ!\nจับคู่รายชื่อสำเร็จ ${mapRows.length} รายการ และบันทึกลง NameMapping อัตโนมัติแล้ว`);
    } else {
      SpreadsheetApp.getUi().alert("ℹ️ AI ทำงานเสร็จสิ้น แต่ไม่สามารถจับคู่รายชื่อด้วยความมั่นใจเกิน 60% ได้ (ต้องตรวจสอบมือ)");
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
 * [FIXED v4.0]: Write ONLY the specific columns to prevent Data Collision
 */
function runAgentLoop() {
  console.time("Agent_Thinking_Time");
  
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    console.warn("Agent: ระบบกำลังทำงานอยู่แล้ว ข้ามรอบนี้");
    return;
  }


  try {
    if (!CONFIG.GEMINI_API_KEY) {
      console.error("Agent: Missing API Key");
      return;
    }


    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME); 
    if (!sheet) return;


    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    // [FIXED v4.0]: อ่านแค่คอลัมน์ที่จำเป็น ไม่โหลดทั้งตาราง
    var rangeName = sheet.getRange(2, CONFIG.COL_NAME, lastRow - 1, 1);
    var rangeNorm = sheet.getRange(2, CONFIG.COL_NORMALIZED, lastRow - 1, 1);
    var rangeUUID = sheet.getRange(2, CONFIG.COL_UUID, lastRow - 1, 1);


    var names = rangeName.getValues();
    var norms = rangeNorm.getValues();
    var uuids = rangeUUID.getValues();
    
    var jobsDone = 0;
    var isUpdated = false;


    for (var i = 0; i < names.length; i++) {
      if (jobsDone >= AGENT_CONFIG.BATCH_SIZE) break;


      var name = names[i][0];
      var currentNorm = norms[i][0];
      
      if (name && (!currentNorm || String(currentNorm).indexOf(AGENT_CONFIG.TAG) === -1)) {
        console.log(`Agent: Analyzing Row ${i+2} -> "${name}"`);
        
        var aiThoughts = "";
        try {
           aiThoughts = (typeof genericRetry === 'function') 
             ? genericRetry(function() { return askGeminiToPredictTypos(name); }, 2)
             : askGeminiToPredictTypos(name);
        } catch(e) {
           console.warn("AI Failed for " + name);
           continue; 
        }
        
        // Update Memory Arrays
        norms[i][0] = ((currentNorm ? currentNorm + " " : "") + aiThoughts + " " + AGENT_CONFIG.TAG).trim();
        
        if (!uuids[i][0]) {
          uuids[i][0] = generateUUID();
        }


        jobsDone++;
        isUpdated = true;
      }
    }
    
    // [FIXED v4.0]: เขียนกลับเฉพาะคอลัมน์ตัวเอง (Safe Write)
    if (isUpdated) {
      rangeNorm.setValues(norms);
      rangeUUID.setValues(uuids);
      console.log(`Agent: ✅ Batch Update Completed (${jobsDone} rows)`);
    } else {
      console.log("Agent: ไม่มีงานใหม่ (No pending rows)");
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
 * [MODIFIED v4.0]: Enforced JSON output for stability
 */
function askGeminiToPredictTypos(originalName) {
  var prompt = `
    Task: You are a Thai Logistics Search Agent.
    Input Name: "${originalName}"
    Goal: Generate search keywords including common typos, phonetic spellings, and abbreviations.
    Constraint: Output ONLY a JSON array of strings.
    Example Input: "บี-ควิก (สาขาลาดพร้าว)"
    Example Output: ["บีควิก", "บีขวิก", "บีวิก", "BeQuik", "BQuik", "B-Quik", "ลาดพร้าว", "BQuick"]
  `;


  var payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "responseMimeType": "application/json", "temperature": 0.4 }
  };


  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };


  var url = `https://generativelanguage.googleapis.com/v1beta/models/${AGENT_CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  var response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() !== 200) {
    throw new Error("Gemini API Error: " + response.getContentText());
  }


  var json = JSON.parse(response.getContentText());


  if (json.candidates && json.candidates[0].content) {
    var text = json.candidates[0].content.parts[0].text;
    var keywordsArray = JSON.parse(text);
    if (Array.isArray(keywordsArray)) {
       return keywordsArray.join(" "); // รวมเป็น String เพื่อเก็บลงช่อง Normalized
    }
  }
  
  return "";
}
```

---

### 📄 ไฟล์: Setup_Security.gs
```javascript
/**
 * VERSION: 000
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
    
    // [MODIFIED v4.0]: ตรวจสอบความถูกต้องของ Key ขั้นสูง
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
 * VERSION: 000
 * 🧹 Service: System Maintenance & Alerts (Enterprise Edition)
 * หน้าที่: ดูแลรักษาความสะอาดไฟล์ ลบ Backup เก่า และแจ้งเตือนผ่าน LINE/Telegram
 * Version: 4.0 Omni-Alerts & Housekeeping
 * ---------------------------------------------
 * [PRESERVED]: 10M Cell Limit check and 30-day Backup retention logic.
 * [ADDED v4.0]: Fully implemented sendLineNotify() and sendTelegramNotify().
 * [MODIFIED v4.0]: Improved Regex for extracting dates from Backup sheets.
 * [MODIFIED v4.0]: Added LockService and GCP Console Logging.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. SYSTEM MAINTENANCE (HOUSEKEEPING)
// ==========================================


/**
 * 🗑️ ลบชีต Backup ที่เก่ากว่า 30 วัน (แนะนำให้ตั้ง Trigger รันทุกสัปดาห์)
 */
function cleanupOldBackups() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.warn("[Maintenance] ข้ามการทำงานเนื่องจากระบบอื่นกำลังใช้งานอยู่");
    return;
  }


  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var deletedCount = 0;
    var keepDays = 30; // เก็บย้อนหลัง 30 วัน
    var now = new Date();
    var deletedNames = [];


    sheets.forEach(function(sheet) {
      var name = sheet.getName();
      
      // ตรวจสอบชื่อชีตที่ขึ้นต้นด้วย "Backup_"
      if (name.startsWith("Backup_")) {
        // [MODIFIED v4.0]: แกะวันที่จากรูปแบบ Backup_DB_yyyyMMdd_HHmm
        var datePart = name.match(/(\d{4})(\d{2})(\d{2})/); // จับกลุ่ม ปี(4) เดือน(2) วัน(2)
        
        if (datePart && datePart.length === 4) {
          var year = parseInt(datePart[1]);
          var month = parseInt(datePart[2]) - 1; // JS Month starts at 0
          var day = parseInt(datePart[3]);
          
          var sheetDate = new Date(year, month, day);
          var diffTime = Math.abs(now - sheetDate);
          var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 


          if (diffDays > keepDays) {
            try {
              ss.deleteSheet(sheet);
              deletedCount++;
              deletedNames.push(name);
            } catch(e) {
              console.error("[Maintenance] Could not delete " + name + ": " + e.message);
            }
          }
        }
      }
    });


    if (deletedCount > 0) {
      var msg = `🧹 Maintenance Report:\nระบบได้ลบชีต Backup ที่เก่ากว่า ${keepDays} วัน จำนวน ${deletedCount} ชีตเรียบร้อยแล้ว`;
      console.info(`[Maintenance] Deleted ${deletedCount} old backups: ${deletedNames.join(", ")}`);
      
      // แจ้งเตือนผู้ดูแลระบบ
      sendLineNotify(msg);
      sendTelegramNotify(msg);
      SpreadsheetApp.getActiveSpreadsheet().toast(`ลบ Backup เก่าไป ${deletedCount} ชีต`, "Maintenance");
    } else {
      console.log("[Maintenance] No old backups to delete.");
    }
  } catch (err) {
    console.error("[Maintenance] Error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}


/**
 * 🏥 ตรวจสอบสุขภาพไฟล์ (Cell Limit Check)
 * แนะนำให้ตั้ง Trigger รันวันละ 1 ครั้ง
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
    var warn = `⚠️ CRITICAL WARNING: ไฟล์ใกล้เต็มแล้ว!\n\nการใช้งานปัจจุบันอยู่ที่ ${usagePercent.toFixed(2)}% (${totalCells.toLocaleString()} Cells)\nกรุณารันฟังก์ชันลบ Backup เก่า หรือย้ายข้อมูลไปยังไฟล์ใหม่ด่วนครับ`;
    
    // แจ้งเตือนฉุกเฉิน
    sendLineNotify(warn, true);
    sendTelegramNotify(warn);
    SpreadsheetApp.getUi().alert("⚠️ SYSTEM ALERT", warn, SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    // ถ้ารันมือผ่านเมนู ให้โชว์ Toast
    SpreadsheetApp.getActiveSpreadsheet().toast(`System Health OK (${usagePercent.toFixed(1)}%)`, "Health Check", 5);
  }
}


// ==========================================
// 2. OMNI-CHANNEL ALERTS (NEW v4.0)
// ==========================================


/**
 * 🔔 [ADDED v4.0] ฟังก์ชันส่งข้อความเข้า LINE Notify
 */
function sendLineNotify(message, isUrgent) {
  try {
    var token = PropertiesService.getScriptProperties().getProperty('LINE_NOTIFY_TOKEN');
    if (!token) return; // ถ้าไม่ตั้งค่าไว้ ให้ข้ามไปเงียบๆ


    var options = {
      "method": "post",
      "headers": {
        "Authorization": "Bearer " + token
      },
      "payload": {
        "message": (isUrgent ? "\n🚨 URGENT ALERT 🚨\n" : "\nℹ️ System Update\n") + message
      },
      "muteHttpExceptions": true
    };
    
    var response = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
    if (response.getResponseCode() !== 200) {
      console.warn("[LINE Notify Error] " + response.getContentText());
    }
  } catch (e) {
    console.error("[LINE Notify Exception] " + e.message);
  }
}


/**
 * ✈️ [ADDED v4.0] ฟังก์ชันส่งข้อความเข้า Telegram
 */
function sendTelegramNotify(message) {
  try {
    var props = PropertiesService.getScriptProperties();
    var botToken = props.getProperty('TG_BOT_TOKEN');
    var chatId = props.getProperty('TG_CHAT_ID');
    
    if (!botToken || !chatId) return; // ถ้าไม่ตั้งค่าไว้ ให้ข้ามไปเงียบๆ


    var url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
    var payload = {
      "chat_id": chatId,
      "text": "🚚 *Logistics Master System*\n\n" + message,
      "parse_mode": "Markdown"
    };


    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };


    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      console.warn("[Telegram Error] " + response.getContentText());
    }
  } catch (e) {
    console.error("[Telegram Exception] " + e.message);
  }
}
```

---

### 📄 ไฟล์: Service_Notify.gs
```javascript
/**
 * VERSION: 000
 * 🔔 Service: Omni-Channel Notification Hub (Enterprise Edition)
 * Version: 4.0 Centralized Broadcaster
 * หน้าที่: ศูนย์กลางส่งแจ้งเตือนสถานะระบบและ Error เข้า LINE และ Telegram
 * ------------------------------------------------
 * [PRESERVED]: Dual-channel architecture and HTML escaping.
 * [REMOVED v4.0]: Setup functions removed (Delegated to Setup_Security.gs V4.0).
 * [MODIFIED v4.0]: Overrides basic notifiers in Module 14 with robust Try-Catch logic.
 * [MODIFIED v4.0]: Prevents API limits/errors from crashing main business flows.
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
  console.info(`[Notification Hub] Broadcasting message (Urgent: ${!!isUrgent})`);
  
  // รันแบบขนาน (จำลองใน GAS โดยใช้ Try-Catch แยกกัน)
  // ป้องกันกรณีช่องทางใดช่องทางหนึ่งตาย แล้วพาลให้อีกช่องทางไม่ส่ง
  
  try {
    sendLineNotify_Internal_(message, isUrgent);
  } catch (e) {
    console.error("[Notify Hub] LINE Broadcast Failed: " + e.message);
  }


  try {
    sendTelegramNotify_Internal_(message, isUrgent);
  } catch (e) {
    console.error("[Notify Hub] Telegram Broadcast Failed: " + e.message);
  }
}


// ==========================================
// 2. PUBLIC WRAPPERS (Overrides Module 14)
// ==========================================


/**
 * [MODIFIED v4.0] Wrapper สำหรับเขียนทับ (Override) ฟังก์ชันใน Service_Maintenance.gs
 * ทำให้ทุกการเรียกใช้ sendLineNotify ในระบบ วิ่งมาใช้ Logic ระดับ Enterprise ตัวนี้แทน
 */
function sendLineNotify(message, isUrgent) {
  sendLineNotify_Internal_(message, isUrgent);
}


/**
 * [MODIFIED v4.0] Wrapper สำหรับเขียนทับ (Override) ฟังก์ชันใน Service_Maintenance.gs
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
  var token = PropertiesService.getScriptProperties().getProperty('LINE_NOTIFY_TOKEN');
  if (!token) return; // Silent skip if not configured


  var prefix = isUrgent ? "🚨 URGENT ALERT:\n" : "🤖 SYSTEM REPORT:\n";
  var fullMsg = prefix + message;


  try {
    var response = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", {
      "method": "post",
      "headers": { "Authorization": "Bearer " + token },
      "payload": { "message": fullMsg },
      "muteHttpExceptions": true
    });
    
    if (response.getResponseCode() !== 200) {
      console.warn("[LINE API Error] " + response.getContentText());
    }
  } catch (e) {
    console.warn("[LINE Exception] " + e.message);
  }
}


/**
 * Internal: ยิง API เข้า Telegram อย่างปลอดภัย
 */
function sendTelegramNotify_Internal_(message, isUrgent) {
  var token = PropertiesService.getScriptProperties().getProperty('TG_BOT_TOKEN'); // ใช้ Key ตาม Setup_Security V4.0
  var chatId = PropertiesService.getScriptProperties().getProperty('TG_CHAT_ID');  // ใช้ Key ตาม Setup_Security V4.0
  
  // Fallback for V2.0 keys if still present
  if (!token) token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!chatId) chatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');


  if (!token || !chatId) return; // Silent skip if not configured


  // Format Message (HTML Style)
  var icon = isUrgent ? "🚨" : "🤖";
  var title = isUrgent ? "<b>SYSTEM ALERT</b>" : "<b>SYSTEM REPORT</b>";
  var htmlMsg = `${icon} ${title}\n\n${escapeHtml_(message)}`;


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
      console.warn("[Telegram API Error] " + response.getContentText());
    }
  } catch (e) {
    console.warn("[Telegram Exception] " + e.message);
  }
}


/**
 * Helper: Escape HTML special chars for Telegram to prevent formatting errors
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
 * สรุปยอดการทำงานส่งให้ผู้ดูแลระบบ
 */
function notifyAutoPilotStatus(scgStatus, aiCount, aiMappedCount) {
  // รองรับพารามิเตอร์ 3 ตัวเพื่อโชว์ผลลัพธ์ของ Tier 4 AI ด้วย
  var mappedMsg = aiMappedCount !== undefined ? `\n🎯 AI Tier-4 จับคู่สำเร็จ: ${aiMappedCount} ร้าน` : "";
  
  var msg = "------------------\n" +
            "✅ AutoPilot V4.0 รอบล่าสุด:\n" +
            "📦 ดึงงาน SCG: " + scgStatus + "\n" +
            "🧠 AI Indexing: " + aiCount + " รายการ" + 
            mappedMsg;
            
  sendSystemNotify(msg, false); 
}
```

---

### 📄 ไฟล์: Test_Diagnostic.gs
```javascript
/**
 * VERSION: 000
 * 🏥 System Diagnostic Tool (Enterprise Edition)
 * Version: 4.0 Deep Scan & Schema Validation
 * -----------------------------------------------------------------
 * [PRESERVED]: Two-phase diagnostic approach (Engine & Sheets).
 * [ADDED v4.0]: Validates NameMapping V4.0 5-Column schema.
 * [ADDED v4.0]: Validates PostalRef sheet existence.
 * [ADDED v4.0]: Deep scan for LINE and Telegram tokens.
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
    if (typeof CONFIG !== 'undefined') pass("System Variables: มองเห็นตัวแปร CONFIG");
    else fail("System Variables: มองไม่เห็นตัวแปร CONFIG");


    // 2. Utility Functions Check
    if (typeof md5 === 'function') pass("Core Utils: มองเห็นฟังก์ชัน md5()");
    else fail("Core Utils: มองไม่เห็นฟังก์ชัน md5()");


    if (typeof normalizeText === 'function') pass("Core Utils: มองเห็นฟังก์ชัน normalizeText()");
    else fail("Core Utils: มองไม่เห็นฟังก์ชัน normalizeText()");


    // 3. Geo Map API Check
    if (typeof GET_ADDR_WITH_CACHE === 'function') {
      try {
        var testGeo = GET_ADDR_WITH_CACHE(13.746, 100.539);
        if (testGeo && testGeo !== "Error") pass("Google Maps API: ทำงานปกติ (" + testGeo.substring(0, 20) + "...)");
        else warn("Google Maps API: โหลดได้แต่ส่งค่าแปลกๆ กลับมา");
      } catch (geoErr) {
        fail("Google Maps API: Error ระหว่างทดสอบ (" + geoErr.message + ")");
      }
    } else {
      fail("Google Maps API: ไม่พบฟังก์ชัน GET_ADDR_WITH_CACHE ใน Service_GeoAddr");
    }


    // 4. Security Vault Check (API Keys)
    var props = PropertiesService.getScriptProperties();
    
    // Gemini Key (V4.0 Safe Check)
    try {
      if (CONFIG && CONFIG.GEMINI_API_KEY) pass("AI Engine: ตรวจพบ GEMINI_API_KEY พร้อมใช้งาน");
    } catch (e) {
      fail("AI Engine: ไม่พบ GEMINI_API_KEY หรือตั้งค่าไม่ถูกต้อง (" + e.message + ")");
    }


    // Notifications Check
    if (props.getProperty('LINE_NOTIFY_TOKEN')) pass("Notifications: ตรวจพบ LINE Notify Token");
    else warn("Notifications: ยังไม่ได้ตั้งค่า LINE Notify");


    if (props.getProperty('TG_BOT_TOKEN') && props.getProperty('TG_CHAT_ID')) pass("Notifications: ตรวจพบ Telegram Config");
    else warn("Notifications: ยังไม่ได้ตั้งค่า Telegram");


    ui.alert("🏥 รายงานผลการสแกนระบบ (Engine V4.0):\n\n" + logs.join("\n"));
    console.info("[Diagnostic] Phase 1 (Engine) completed.");


  } catch (e) {
    console.error("[Diagnostic Error]: " + e.message);
    ui.alert("🚨 ระบบตรวจพบ Error ร้ายแรงระหว่างสแกน:\n" + e.message);
  }
}


// ==========================================
// 2. PHASE 2: DATA & STRUCTURE CHECK
// ==========================================


/**
 * 🕵️‍♂️ Sheet Diagnostic Tool (Phase 2: Data & Silent Exit Check)
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
    // 1. ตรวจสอบ Database Sheet
    var dbName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_NAME) ? CONFIG.SHEET_NAME : "Database";
    var dbSheet = ss.getSheetByName(dbName);
    if (dbSheet) {
      var rows = dbSheet.getLastRow();
      if (rows >= 2) pass("Master DB: พบชีต '" + dbName + "' (มีข้อมูล " + rows + " แถว)");
      else warn("Master DB: พบชีต '" + dbName + "' แต่ข้อมูลว่างเปล่า (มี " + rows + " แถว)");
    } else {
      fail("Master DB: ไม่พบชีตชื่อ '" + dbName + "' (ตรวจสอบเว้นวรรคท้ายชื่อด้วย)");
    }


    // 2. ตรวจสอบ Source Sheet
    var srcName = (typeof CONFIG !== 'undefined' && CONFIG.SOURCE_SHEET) ? CONFIG.SOURCE_SHEET : "SCGนครหลวงJWDภูมิภาค";
    var srcSheet = ss.getSheetByName(srcName);
    if (srcSheet) {
      pass("Source Data: พบชีต '" + srcName + "' (มีข้อมูล " + srcSheet.getLastRow() + " แถว)");
    } else {
      warn("Source Data: ไม่พบชีต '" + srcName + "'");
    }


    // 3. ตรวจสอบ Mapping Sheet (V4.0 Schema Check)
    var mapName = (typeof CONFIG !== 'undefined' && CONFIG.MAPPING_SHEET) ? CONFIG.MAPPING_SHEET : "NameMapping";
    var mapSheet = ss.getSheetByName(mapName);
    if (mapSheet) {
      var mapCols = mapSheet.getLastColumn();
      if (mapCols >= 5) {
        pass("Name Mapping: พบชีต '" + mapName + "' (โครงสร้าง 5 คอลัมน์ V4.0 ถูกต้อง)");
      } else {
        warn("Name Mapping: พบชีต '" + mapName + "' แต่มีแค่ " + mapCols + " คอลัมน์ (แนะนำให้ใช้เมนู Upgrade NameMapping เป็น V4.0)");
      }
    } else {
      fail("Name Mapping: ไม่พบชีต '" + mapName + "'");
    }


    // 4. ตรวจสอบ SCG Daily Data Sheet
    if (typeof SCG_CONFIG !== 'undefined') {
      var scgDataName = SCG_CONFIG.SHEET_DATA || "Data";
      var scgInputName = SCG_CONFIG.SHEET_INPUT || "Input";
      
      if (ss.getSheetByName(scgDataName)) pass("SCG Operation: พบชีต '" + scgDataName + "'");
      else warn("SCG Operation: ไม่พบชีต '" + scgDataName + "'");
      
      if (ss.getSheetByName(scgInputName)) pass("SCG Operation: พบชีต '" + scgInputName + "'");
      else warn("SCG Operation: ไม่พบชีต '" + scgInputName + "'");
    }


    // 5. ตรวจสอบ PostalRef Sheet (New V4.0 Requirement)
    var postalName = (typeof CONFIG !== 'undefined' && CONFIG.SHEET_POSTAL) ? CONFIG.SHEET_POSTAL : "PostalRef";
    if (ss.getSheetByName(postalName)) {
      pass("Geo Database: พบชีต '" + postalName + "' สำหรับอ้างอิงรหัสไปรษณีย์");
    } else {
      warn("Geo Database: ไม่พบชีต '" + postalName + "' (การแกะที่อยู่แบบ Offline อาจไม่แม่นยำ 100%)");
    }


    ui.alert("🕵️‍♂️ รายงานผลการสแกนชีต (Silent Exit Check):\n\n" + logs.join("\n"));
    console.info("[Diagnostic] Phase 2 (Sheets) completed.");


  } catch (e) {
    console.error("[Diagnostic Error]: " + e.message);
    ui.alert("🚨 เกิด Error ระหว่างตรวจสอบชีต:\n" + e.message);
  }
}
```

---

