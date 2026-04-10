# 🚛 Logistics Master Data System V4.1 - Part 2/3

### 📄 ไฟล์: Service_AutoPilot.gs
```javascript
/**
 * VERSION: 001
 * 🤖 Service: Auto Pilot (Enterprise AI Edition)
 * Version: 4.2 Clean SmartKey & Stable Fallback
 * ------------------------------------------------------------
 * [FIXED v4.2]: Enforced 'gemini-1.5-flash-latest' to resolve v1beta 404 errors.
 * [FIXED v4.2]: Removed duplicate "tone-less" basic key to keep data clean.
 * [MODIFIED v4.0]: Integrated with notifyAutoPilotStatus for Omni-Channel reporting.
 * [MODIFIED v4.0]: Added auto-generation of UUIDs during AI Indexing.
 * [MODIFIED v4.0]: Full GCP Benchmarking and LockService implementation.
 * Author: Elite Logistics Architect
 */


/**
 * 🚀 เปิดระบบทำงานอัตโนมัติ (Trigger ทุก 10 นาที)
 */
function START_AUTO_PILOT() {
  STOP_AUTO_PILOT();
  ScriptApp.newTrigger("autoPilotRoutine")
    .timeBased()
    .everyMinutes(10)
    .create();


  var ui = SpreadsheetApp.getUi();
  if (ui) {
    ui.alert("▶️ AI Auto-Pilot: ACTIVATE\nระบบสมองกลจะทำงานเบื้องหลังทุกๆ 10 นาทีครับ");
  }
  console.info("[AutoPilot] Activated by user.");
}


/**
 * ⏹️ ปิดระบบทำงานอัตโนมัติ
 */
function STOP_AUTO_PILOT() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "autoPilotRoutine") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  console.info("[AutoPilot] Deactivated by user.");
}


/**
 * 🔄 ฟังก์ชันหลักที่รันเบื้องหลัง (Core Routine)
 */
function autoPilotRoutine() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.warn("[AutoPilot] Skipped: มี instance อื่นกำลังรันอยู่");
    return;
  }


  var scgStatus = "Pending";
  var aiStats = { count: 0, mapped: 0 };


  try {
    console.time("AutoPilot_Duration");
    console.info("[AutoPilot] 🚀 Starting routine...");


    // 1. Sync พิกัดงานประจำวัน (SCG JWD Integration)
    try {
      if (typeof applyMasterCoordinatesToDailyJob === 'function') {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var dataSheet = ss.getSheetByName(typeof SCG_CONFIG !== 'undefined' ? SCG_CONFIG.SHEET_DATA : 'Data');
        if (dataSheet && dataSheet.getLastRow() > 1) {
          applyMasterCoordinatesToDailyJob();
          scgStatus = "Success";
        } else {
          scgStatus = "No Data";
        }
      }
    } catch(e) { 
      scgStatus = "Error: " + e.message;
      console.error("[AutoPilot] SCG Sync Error: " + e.message); 
    }


    // 2. รัน AI Indexing (The Steward - Typo Prediction)
    try {
      aiStats.count = processAIIndexing_Batch();
    } catch(e) { 
      console.error("[AutoPilot] AI Indexing Error: " + e.message); 
    }


    // 3. ส่งแจ้งเตือนสรุปผล (Omni-Channel Notify)
    if (typeof notifyAutoPilotStatus === 'function') {
      notifyAutoPilotStatus(scgStatus, aiStats.count);
    }


    console.timeEnd("AutoPilot_Duration");
    console.info("[AutoPilot] 🏁 Routine finished successfully.");


  } catch (e) {
    console.error("CRITICAL AutoPilot Error: " + e.message);
  } finally {
    lock.releaseLock();
  }
}


/**
 * 🧠 วิเคราะห์ข้อมูลลูกค้าใหม่ด้วย AI (Batch Mode)
 * @return {number} จำนวนแถวที่ประมวลผลสำเร็จ
 */
function processAIIndexing_Batch() {
  var apiKey;
  try {
    apiKey = CONFIG.GEMINI_API_KEY;
  } catch (e) {
    console.warn("⚠️ SKIPPED AI: " + e.message);
    return 0;
  }


  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return 0;


  var lastRow = typeof getRealLastRow_ === 'function' ? getRealLastRow_(sheet, CONFIG.COL_NAME) : sheet.getLastRow();
  if (lastRow < 2) return 0;


  // อ่านเฉพาะคอลัมน์ที่จำเป็นเพื่อประสิทธิภาพสูงสุด (Safe Scan)
  var rangeName = sheet.getRange(2, CONFIG.COL_NAME, lastRow - 1, 1);
  var rangeNorm = sheet.getRange(2, CONFIG.COL_NORMALIZED, lastRow - 1, 1);
  var rangeUUID = sheet.getRange(2, CONFIG.COL_UUID, lastRow - 1, 1);


  var nameValues = rangeName.getValues();
  var normValues = rangeNorm.getValues();
  var uuidValues = rangeUUID.getValues();


  var aiCount = 0;
  var AI_LIMIT = (typeof CONFIG !== 'undefined' && CONFIG.AI_BATCH_SIZE) ? CONFIG.AI_BATCH_SIZE : 20;
  var updated = false;


  for (var i = 0; i < nameValues.length; i++) {
    if (aiCount >= AI_LIMIT) break;


    var name = nameValues[i];
    var currentNorm = normValues[i];


    // ตรวจสอบว่ายังไม่เคยผ่านการวิเคราะห์โดยระบบ AI
    if (name && typeof name === 'string' && (!currentNorm || currentNorm.toString().indexOf("[AI]") === -1)) {
      var basicKey = createBasicSmartKey(name);
      var aiKeywords = "";


      if (name.length > 3) {
        // ใช้ Retry Mechanism เผื่อ API ล่มชั่วคราว
        aiKeywords = (typeof genericRetry === 'function')
          ? genericRetry(function() { return callGeminiThinking_JSON(name, apiKey); }, 2)
          : callGeminiThinking_JSON(name, apiKey);
      }


      // บันทึกผลพร้อม Tag [AI] และเติม UUID หากว่าง
      normValues[i] = (basicKey + (aiKeywords ? " " + aiKeywords : "") + " [AI]").trim();
      if (!uuidValues[i]) uuidValues[i] = (typeof generateUUID === 'function') ? generateUUID() : Utilities.getUuid();
      
      console.log(`🤖 AI Processed (${aiCount+1}/${AI_LIMIT}): [${name}] -> ${aiKeywords}`);
      aiCount++;
      updated = true;
    }
  }


  if (updated) {
    rangeNorm.setValues(normValues);
    rangeUUID.setValues(uuidValues);
    console.info(`✅ AI Batch Write: อัปเดตฐานข้อมูล ${aiCount} รายการ.`);
  }
  
  return aiCount;
}


/**
 * 📡 ส่งชื่อลูกค้าให้ Gemini วิเคราะห์ (Typo Prediction Skill)
 */
function callGeminiThinking_JSON(customerName, apiKey) {
  try {
    // บังคับใช้รุ่นล่าสุดเพื่อแก้ปัญหา Error 404 ใน v1beta
    var model = (typeof CONFIG !== 'undefined' && CONFIG.AI_MODEL) ? CONFIG.AI_MODEL : "gemini-1.5-flash-latest";
    var apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    var prompt = `
Task: Analyze this Thai logistics customer name: "${customerName}"
Goal: Return a JSON list of search keywords, abbreviations, and common typos.
Requirements:
1. If English, provide Thai phonetics.
2. If Thai abbreviation (e.g., บจก, รพ), provide full text.
3. No generic words like "Company", "Limited", "จำกัด", "บริษัท".
4. Max 5 keywords.
Output Format: JSON Array of Strings ONLY.
Example: ["Keyword1", "Keyword2"]
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


    var response = UrlFetchApp.fetch(apiUrl, options);
    if (response.getResponseCode() !== 200) throw new Error("Gemini API Error: " + response.getResponseCode());


    var json = JSON.parse(response.getContentText());
    if (json.candidates && json.candidates.length > 0) {
      var text = json.candidates.content.parts.text;
      var keywords = JSON.parse(text);
      if (Array.isArray(keywords)) return keywords.join(" ");
    }
  } catch (e) {
    console.warn(`[Gemini Warn] Failed for "${customerName}": ${e.message}`);
    return "";
  }
  return "";
}


/**
 * 🔨 สร้าง Index พื้นฐาน (Tier 2 Resolution)
 */
function createBasicSmartKey(text) {
  if (!text) return "";
  // ใช้ตัว Clean ข้อความที่ระบุไว้ใน Utils_Common
  var clean = (typeof normalizeText === 'function') ? normalizeText(text) : text.toString().toLowerCase().replace(/\s/g, "");
  return clean;
}
```

---

### 📄 ไฟล์: WebApp.gs
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

### 📄 ไฟล์: Service_Search.gs
```javascript
/**
 * VERSION: 001
 * 🔍 Service: Search Engine (Enterprise Edition)
 * Version: 4.0 Omni-Search (UUID & AI Integrated)
 * ----------------------------------------------
 * [PRESERVED]: Multi-Token search logic and Pagination structure.
 * [MODIFIED v4.0]: Upgraded NameMapping cache to use Master_UID instead of Name.
 * [MODIFIED v4.0]: Added try-catch around CacheService to prevent 100KB limit crash.
 * [MODIFIED v4.0]: Added Enterprise Performance Logging (console.time).
 * Author: Elite Logistics Architect
 */


/**
 * 🛰️ เอนจินค้นหาหลัก: รองรับการค้นหาผ่านชื่อ, ที่อยู่, UUID และ AI Keywords
 * @param {string} keyword - คำค้นหาจากผู้ใช้
 * @param {number} page - ลำดับหน้า (สำหรับ Pagination)
 * @return {object} ผลลัพธ์การค้นหาพร้อมข้อมูลหน้า
 */
function searchMasterData(keyword, page) {
  console.time("SearchLatency");
  try {
    // 1. Input Validation & Setup
    var pageNum = parseInt(page) || 1;
    var pageSize = 20; // จำกัดหน้าละ 20 รายการตามมาตรฐาน V4.0 [16]


    if (!keyword || keyword.toString().trim() === "") {
      return { items: [], total: 0, totalPages: 0, currentPage: 1 };
    }


    // เตรียมคำค้นหา (แบ่งด้วยช่องว่างเพื่อทำ Multi-token AND Match)
    var rawKey = keyword.toString().toLowerCase().trim();
    var searchTokens = rawKey.split(/\s+/).filter(function(k) { return k.length > 0; });


    if (searchTokens.length === 0) return { items: [], total: 0, totalPages: 0, currentPage: 1 };


    var ss = SpreadsheetApp.getActiveSpreadsheet();


    // 2. [UPGRADED v4.0] โหลด NameMapping ผ่านระบบ Smart Cache (Key = UUID) [17]
    var aliasMap = getCachedNameMapping_(ss);


    // 3. โหลดฐานข้อมูลหลัก
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error("Missing Database sheet");


    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { items: [], total: 0, totalPages: 0, currentPage: 1 };


    // อ่านข้อมูลทั้งหมด (คอลัมน์ A-Q) [18]
    var data = sheet.getRange(2, 1, lastRow - 1, 17).getValues();
    var matches = [];


    // 4. Search Algorithm: Linear Scan with Token Logic [18]
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var name = row[CONFIG.C_IDX.NAME];
      if (!name) continue;


      var address = row[CONFIG.C_IDX.GOOGLE_ADDR] || row[CONFIG.C_IDX.SYS_ADDR] || "";
      var lat = row[CONFIG.C_IDX.LAT];
      var lng = row[CONFIG.C_IDX.LNG];
      var uuid = row[CONFIG.C_IDX.UUID]; // [ADDED v4.0]: ใช้ UUID เป็นตัวเชื่อมความสัมพันธ์ [5]


      // AI Brain: ดึงข้อมูลที่ Agent วิเคราะห์ไว้มาช่วยค้นหา (คอลัมน์ Normalized) [5]
      var aiKeywords = row[CONFIG.C_IDX.NORMALIZED] ? row[CONFIG.C_IDX.NORMALIZED].toString().toLowerCase() : "";
      var normName = typeof normalizeText === 'function' ? normalizeText(name) : name.toString().toLowerCase();
      var rawName = name.toString().toLowerCase();


      // [UPGRADED v4.0]: ค้นหาชื่อพ้อง (Alias) จากหน่วยความจำแคชผ่าน UUID [10]
      var aliases = uuid ? (aliasMap[uuid] || "") : "";


      // รวมข้อความเป้าหมายทั้งหมดเป็นหนึ่งเดียว (Haystack) [10]
      var haystack = (rawName + " " + normName + " " + aliases + " " + aiKeywords + " " + address.toString().toLowerCase());


      // Multi-Token Check: ต้องพบคำค้นหา "ครบทุกคำ" (AND Logic) [10]
      var isMatch = searchTokens.every(function(token) {
        return haystack.indexOf(token) > -1;
      });


      if (isMatch) {
        matches.push({
          name: name,
          address: address,
          lat: lat,
          lng: lng,
          mapLink: (lat && lng) ? "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng : "",
          uuid: uuid,
          score: aiKeywords.includes(rawKey) ? 10 : 1 // AI Exact Match จะได้คะแนนสูงกว่า (Score 10) [7]
        });
      }
    }


    // เรียงลำดับตามคะแนน (AI Matches ขึ้นก่อน) [7]
    matches.sort(function(a, b) { return b.score - a.score; });


    // 5. Pagination Logic [14]
    var totalItems = matches.length;
    var totalPages = Math.ceil(totalItems / pageSize);
    if (pageNum > totalPages && totalPages > 0) pageNum = 1;


    var startIndex = (pageNum - 1) * pageSize;
    var pagedItems = matches.slice(startIndex, startIndex + pageSize);


    console.log(`[Search] Query: "${rawKey}" | Found: ${totalItems} | Page: ${pageNum}/${totalPages}`);


    return {
      items: pagedItems,
      total: totalItems,
      totalPages: totalPages,
      currentPage: pageNum
    };


  } catch (error) {
    console.error("[Search Error]: " + error.message);
    return { items: [], total: 0, totalPages: 0, currentPage: 1, error: error.message };
  } finally {
    console.timeEnd("SearchLatency"); // บันทึกเวลาที่ใช้ประมวลผล [8]
  }
}


/**
 * 🛠️ Internal Helper: จัดการ NameMapping และระบบแคช
 * [UPGRADED v4.0]: เปลี่ยนโครงสร้าง Map เป็น Variant -> UID เพื่อประสิทธิภาพการค้นหา [8]
 */
function getCachedNameMapping_(ss) {
  var cache = CacheService.getScriptCache();
  var cachedMap = cache.get("NAME_MAPPING_JSON_V4");


  if (cachedMap) {
    return JSON.parse(cachedMap); // คืนค่าจากหน่วยความจำทันทีถ้ามี [19]
  }


  // หากไม่มีในแคช ให้โหลดจากชีต NameMapping
  var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
  var aliasMap = {};


  if (mapSheet && mapSheet.getLastRow() > 1) {
    // โหลด 2 คอลัมน์แรก (Col A: Variant, Col B: UID) ตามโครงสร้าง 5-Tier V4.0 [19]
    var mapData = mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 2).getValues();


    mapData.forEach(function(row) {
      var variant = row; // Variant_Name
      var uid = row[20];     // Master_UID
      if (variant && uid) {
        if (!aliasMap[uid]) aliasMap[uid] = "";
        // รวมชื่อเรียกอื่นๆ เก็บไว้ใน Key ของ UUID เดียวกันเพื่อทำ Relational Search [11]
        var normVariant = typeof normalizeText === 'function' ? normalizeText(variant) : variant.toString().toLowerCase();
        aliasMap[uid] += " " + normVariant + " " + variant.toString().toLowerCase();
      }
    });


    // บันทึกลงแคช (อายุ 1 ชั่วโมง)
    try {
      var jsonString = JSON.stringify(aliasMap);
      // [MODIFIED v4.0]: ตรวจสอบขีดจำกัด 100KB ของ Google Cache [11]-[3]
      if (jsonString.length < 100000) {
        cache.put("NAME_MAPPING_JSON_V4", jsonString, 3600);
      } else {
        console.warn("[Cache] NameMapping size exceeds 100KB, skipping cache write to prevent crash.");
      }
    } catch (e) {
      console.warn("[Cache Error]: " + e.message);
    }
  }


  return aliasMap;
}


/**
 * 🧹 ล้างหน่วยความจำแคชการค้นหา
 * ควรเรียกใช้เมื่อมีการอัปเดตข้อมูลใน NameMapping หรือรัน Finalize [3]
 */
function clearSearchCache() {
  CacheService.getScriptCache().remove("NAME_MAPPING_JSON_V4");
  console.log("[Cache] Search Cache Cleared. ระบบจะโหลดข้อมูลใหม่ในการค้นหาครั้งถัดไป");
}
```

---

### 📄 ไฟล์: Index.html
```html
<!-- VERSION: 001 -->
<!-- FILE: Index.html -->
<!-- 📱 Omni-Channel Search UI (Enterprise Edition V4.0) -->
<!DOCTYPE html>
<html lang="th" class="h-full">
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ค้นหาพิกัดลูกค้า (V4.0)</title>
  
  <!-- Font & Icons: Enterprise Standard -->
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">


  <style>
    /* --- CORE LAYOUT [3-5] --- */
    :root {
      --primary-grad: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); /* Enterprise Purple */
      --bg-color: #f3f4f6;
      --card-bg: #ffffff;
      --text-main: #1f2937;
      --text-muted: #6b7280;
      --ai-purple: #c026d3;
    }


    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }


    body {
      font-family: 'Kanit', sans-serif;
      background: var(--bg-color);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden; /* [4] ป้องกัน Scroll ซ้อนใน iFrame */
    }


    .app-container {
      width: 100%;
      height: 100%;
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      position: relative;
    }


    /* --- 1. STICKY HEADER [5, 6] --- */
    .header-section {
      background: var(--primary-grad);
      padding: 20px 20px 30px 20px;
      border-bottom-left-radius: 24px;
      border-bottom-right-radius: 24px;
      box-shadow: 0 10px 25px rgba(124, 58, 237, 0.25);
      z-index: 10;
      flex-shrink: 0;
    }


    .app-branding { text-align: center; color: white; margin-bottom: 20px; }
    .app-title { font-size: 24px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .app-subtitle { font-size: 14px; font-weight: 300; opacity: 0.9; }


    .search-box-wrapper {
      position: relative;
      background: white;
      border-radius: 16px;
      padding: 5px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
    }


    .search-input {
      flex: 1;
      border: none;
      padding: 12px 15px 12px 45px;
      font-size: 16px;
      font-family: 'Kanit', sans-serif;
      outline: none;
      color: var(--text-main);
    }


    .search-icon-left { position: absolute; left: 20px; color: #9ca3af; }
    
    .btn-search {
      background: var(--primary-grad);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }


    /* --- 2. RESULTS AREA [8-12] --- */
    .results-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      padding-bottom: 80px;
      -webkit-overflow-scrolling: touch;
    }


    .result-card {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border-left: 5px solid #7c3aed;
      animation: slideUp 0.3s ease-out backwards;
    }


    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }


    .shop-name { font-size: 18px; font-weight: 600; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    
    /* [ADDED v4.0] AI Badge [10, 26] */
    .ai-badge {
      font-size: 10px; background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
      color: var(--ai-purple); padding: 2px 10px; border-radius: 12px; font-weight: 700;
      border: 1px solid #f5d0fe; display: inline-flex; align-items: center; gap: 4px;
    }


    .uuid-track { font-size: 9px; color: #9ca3af; font-family: monospace; margin: 4px 0; }
    .shop-address { font-size: 13px; color: var(--text-muted); margin-top: 6px; display: flex; gap: 6px; }


    .coord-tag {
      display: inline-flex; align-items: center; gap: 5px;
      background: #eff6ff; color: #3b82f6; font-size: 13px; font-weight: 500;
      padding: 6px 12px; border-radius: 8px; margin-top: 10px; cursor: pointer;
      border: 1px solid #dbeafe;
    }


    .action-row { margin-top: 15px; display: flex; gap: 10px; padding-top: 15px; border-top: 1px dashed #e5e7eb; }
    .btn-nav { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 10px; font-size: 14px; font-weight: 500; text-decoration: none; color: white; }
    .btn-google { background: #4285F4; }
    .btn-waze { background: #33ccff; }


    /* --- UTILS [14-16] --- */
    .pagination-bar { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); padding: 12px; display: flex; justify-content: center; gap: 8px; z-index: 20; }
    .page-dot { width: 35px; height: 35px; border-radius: 8px; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: 600; }
    .page-dot.active { background: var(--primary-grad); color: white; border: none; }


    .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 12px 24px; border-radius: 30px; font-size: 14px; display: none; z-index: 9999; }
    .loader-overlay { position: absolute; inset: 0; background: rgba(243,244,246,0.8); display: none; flex-direction: column; align-items: center; justify-content: center; z-index: 50; }
    .spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #7c3aed; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>


<body>
  <div class="app-container">
    <header class="header-section">
      <div class="app-branding">
        <h1 class="app-title"><i class="fas fa-shipping-fast"></i> Logistics Master</h1>
        <p class="app-subtitle">Enterprise Search Engine V4.0</p>
      </div>
      <div class="search-box-wrapper">
        <i class="fas fa-search search-icon-left"></i>
        <input type="text" id="searchInput" class="search-input" placeholder="พิมพ์ชื่อร้าน, พื้นที่, หรือ UUID..." autocomplete="off">
        <button class="btn-search" onclick="triggerSearch()">ค้นหา</button>
      </div>
    </header>


    <main class="results-area" id="resultsContainer">
      <div style="text-align:center; margin-top:60px; opacity:0.6;">
        <i class="fas fa-map-marked-alt" style="font-size:60px; color:#cbd5e1;"></i>
        <p style="margin-top:15px;">ระบุคำค้นหาเพื่อเชื่อมต่อฐานข้อมูลส่วนกลาง</p>
      </div>
    </main>


    <div class="pagination-bar" id="paginationBar" style="display:none;"></div>


    <div class="loader-overlay" id="loader">
      <div class="spinner"></div>
      <p style="margin-top:15px; font-weight:500;">กำลังค้นหาผ่าน AI Agent...</p>
    </div>
  </div>


  <div class="toast" id="toastMsg"></div>


  <script>
    /* --- 1. GLOBAL STATE & INIT [20, 21] --- */
    let currentKeyword = "";
    let currentPage = 1;


    window.onload = function() {
      // Deep Linking from WebApp.gs [20, 37]
      const initialQuery = "<?= typeof initialQuery !== 'undefined' ? initialQuery : '' ?>";
      if (initialQuery && initialQuery !== "undefined" && initialQuery.trim() !== "") {
        document.getElementById('searchInput').value = initialQuery;
        triggerSearch();
      }
      
      document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') triggerSearch();
      });
    };


    /* --- 2. SEARCH LOGIC [22, 23] --- */
    function triggerSearch() {
      const keyword = document.getElementById('searchInput').value.trim();
      if (!keyword) {
        showToast("⚠️ กรุณาพิมพ์คำค้นหาก่อนครับ");
        return;
      }
      currentKeyword = keyword;
      currentPage = 1;
      fetchData(1);
    }


    function fetchData(page) {
      showLoading(true);
      google.script.run
        .withSuccessHandler(renderResults)
        .withFailureHandler(handleError)
        .searchMasterData(currentKeyword, page); // เรียกโมดูล Service_Search [23]
    }


    /* --- 3. RENDER LOGIC [24-31] --- */
    function renderResults(response) {
      showLoading(false);
      const container = document.getElementById('resultsContainer');
      const pagination = document.getElementById('paginationBar');
      container.innerHTML = '';


      if (!response || !response.items || response.items.length === 0) {
        container.innerHTML = `<div style="text-align:center; margin-top:50px;">🤔 ไม่พบข้อมูล "${currentKeyword}"</div>`;
        pagination.style.display = 'none';
        return;
      }


      // Result Count Header [25]
      const header = document.createElement('div');
      header.style = "font-size:12px; color:#6b7280; margin-bottom:10px; font-weight:500;";
      header.innerHTML = `พบ ${response.total} รายการ (หน้า ${response.currentPage}/${response.totalPages})`;
      container.appendChild(header);


      response.items.forEach((item, index) => {
        const hasCoord = (item.lat && item.lng);
        const latLng = `${item.lat}, ${item.lng}`;
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = `${index * 0.05}s`;


        // [ADDED v4.0] AI Badge Check (Score >= 10) [26]
        const aiBadge = (item.score >= 10) ? `<span class="ai-badge"><i class="fas fa-magic"></i> AI Match</span>` : '';
        const uuidHtml = item.uuid ? `<div class="uuid-track">UID: ${item.uuid}</div>` : '';


        card.innerHTML = `
          <div class="shop-name">${escapeHtml(item.name)} ${aiBadge}</div>
          ${uuidHtml}
          <div class="shop-address"><i class="fas fa-map-marker-alt"></i> <span>${escapeHtml(item.address || 'ไม่ระบุที่อยู่')}</span></div>
          ${hasCoord ? `<div class="coord-tag" onclick="copyCoord('${latLng}')"><i class="fas fa-copy"></i> พิกัด: ${latLng}</div>` : '<div style="color:#ef4444; font-size:12px; margin-top:10px;">ไม่มีพิกัดในระบบ</div>'}
          ${hasCoord ? `
            <div class="action-row">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${latLng}" target="_blank" class="btn-nav btn-google"><i class="fab fa-google"></i> Google Maps</a>
              <a href="https://waze.com/ul?ll=${latLng}&navigate=yes" target="_blank" class="btn-nav btn-waze"><i class="fab fa-waze"></i> Waze</a>
            </div>
          ` : ''}
        `;
        container.appendChild(card);
      });


      renderPagination(response.totalPages, response.currentPage);
    }


    function renderPagination(total, current) {
      const bar = document.getElementById('paginationBar');
      if (total <= 1) { bar.style.display = 'none'; return; }
      bar.style.display = 'flex';
      let html = '';
      for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i++) {
        html += `<div class="page-dot ${i === current ? 'active' : ''}" onclick="fetchData(${i})">${i}</div>`;
      }
      bar.innerHTML = html;
    }


    /* --- 4. UTILITIES [32-35] --- */
    function showLoading(show) { document.getElementById('loader').style.display = show ? 'flex' : 'none'; }


    // Robust Copy to Clipboard (iFrame Safe) [33, 34]
    function copyCoord(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showToast(`คัดลอก: ${text}`)).catch(() => fallbackCopy(text));
      } else { fallbackCopy(text); }
    }


    function fallbackCopy(text) {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el);
      el.select(); document.execCommand('copy');
      document.body.removeChild(el);
      showToast(`คัดลอก: ${text}`);
    }


    function showToast(msg) {
      const t = document.getElementById('toastMsg');
      t.innerText = msg; t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 3000);
    }


    function escapeHtml(text) {
      if (!text) return "";
      return String(text).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }


    function handleError(err) { showLoading(false); showToast("❌ การเชื่อมต่อขัดข้อง"); console.error(err); }
  </script>
</body>
</html>
```

---

### 📄 ไฟล์: Setup_Upgrade.gs
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

### 📄 ไฟล์: Test_AI.gs
```javascript
/**
 * VERSION: 001
 * 🧪 Test & Debug: AI Capabilities (Enterprise Debugging Suite)
 * Version: 4.0 Compatible with System V4.0
 * -------------------------------------------------------------
 * [PRESERVED]: Manual triggers, Connection test, and Row Reset logic.
 * [MODIFIED v4.0]: Upgraded debug_ResetSelectedRowsAI to clear both [AI] and [Agent_V4] tags.
 * [MODIFIED v4.0]: Safe API Key extraction using CONFIG getter (No hardcoding).
 * [ADDED v4.0]: debug_TestTier4SmartResolution() for manual Tier 4 AI evaluation.
 * [MODIFIED v4.0]: Switched to console.info for GCP Monitoring & Audit.
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. MANUAL TRIGGERS (AI BATCH RUNNERS)
// ==========================================


/**
 * 🚀 Manual Trigger: สั่งรัน AI ทันที (AutoPilot Batch - 20 แถว)
 * ใช้สำหรับทดสอบการทำงาน หรือเร่งด่วนเก็บตกข้อมูล (สร้าง Index)
 */
function forceRunAI_Now() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActiveSpreadsheet();


  try {
    // 1. Dependency Check [9]
    if (typeof processAIIndexing_Batch !== 'function') {
      throw new Error("Critical: ไม่พบฟังก์ชัน 'processAIIndexing_Batch' ใน Service_AutoPilot.gs");
    }


    // 2. Execution [16]
    ss.toast("🚀 กำลังเริ่มระบบ AI Indexing (Batch Mode)...", "Debug System", 10);
    console.info("[Debug] Manual Trigger: processAIIndexing_Batch");


    // เรียกฟังก์ชันจาก Service_AutoPilot
    var processedCount = processAIIndexing_Batch();


    ui.alert(
      "✅ สั่งงานเรียบร้อย!\n" +
      "ระบบได้ประมวลผลข้อมูลไป " + (processedCount || 0) + " รายการ\n" +
      "กรุณาตรวจสอบคอลัมน์ Normalized ใน Database ว่ามี Tag '[AI]' หรือไม่"
    );


  } catch (e) {
    console.error("[Debug Error] forceRunAI_Now: " + e.message);
    ui.alert("❌ Error: " + e.message);
  }
}


/**
 * 🧠 [NEW v4.0] Manual Trigger: ทดสอบ Tier 4 Smart Resolution ทันที [4], [11]
 * ดึงรายชื่อที่ "Unknown" จากชีตงานประจำวันมาให้ AI วิเคราะห์จับคู่กับ Master Database
 */
function debug_TestTier4SmartResolution() {
  var ui = SpreadsheetApp.getUi();
  try {
    if (typeof resolveUnknownNamesWithAI !== 'function') {
      throw new Error("Critical: ไม่พบฟังก์ชัน 'resolveUnknownNamesWithAI' ใน Service_Agent.gs");
    }


    var response = ui.alert(
      "🧠 ยืนยันรันทดสอบ Tier 4", 
      "ต้องการดึงรายชื่อที่ไม่มีพิกัดจากหน้า SCG Data\nไปให้ Gemini วิเคราะห์จับคู่กับ Master Database เลยหรือไม่?", 
      ui.ButtonSet.YES_NO
    );


    if (response == ui.Button.YES) {
      console.info("[Debug] Manual Trigger: resolveUnknownNamesWithAI");
      resolveUnknownNamesWithAI(); 
      // ผลลัพธ์จะถูกบันทึกลงชีต NameMapping 5-Tier อัตโนมัติ [17]
    }


  } catch (e) {
    console.error("[Debug Error] Tier 4 Test: " + e.message);
    ui.alert("❌ Error: " + e.message);
  }
}


// ==========================================
// 2. API CONNECTION TESTING
// ==========================================


/**
 * 📡 Connection Test: ทดสอบคุยกับ Gemini (ไม่ยุ่งกับ Database) [5], [6]
 * ใช้เช็คว่า API Key ใช้งานได้จริงและรูปแบบ JSON เสถียรหรือไม่
 */
function debugGeminiConnection() {
  var ui = SpreadsheetApp.getUi();
  var apiKey;


  try {
    // [MODIFIED v4.0] Safe Getter Extraction จาก Omni-Vault
    apiKey = CONFIG.GEMINI_API_KEY; 
  } catch (e) {
    ui.alert("❌ API Key Error", "กรุณาตั้งค่า API Key ผ่าน Setup_Security.gs ก่อนครับ\n(" + e.message + ")", ui.ButtonSet.OK);
    return;
  }


  var testWord = "SCG JWD (Bang Sue Branch)";
  ss_toast_("📡 กำลังทดสอบส่งข้อความหา Gemini...", "AI Ping");


  try {
    console.info("[Debug] Pinging Gemini API...");
    
    var model = (typeof CONFIG !== 'undefined' && CONFIG.AI_MODEL) ? CONFIG.AI_MODEL : "gemini-1.5-flash";
    var url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // บังคับให้ AI ตอบกลับเพื่อเช็คตรรกะ (Logical Check) [18]
    var payload = {
      "contents": [{ "parts": [{ "text": `Hello Gemini, test connection. Say "Connection Success" and translate this logistics name to Thai: ${testWord}` }] }],
      "generationConfig": { "temperature": 0.1 } // เน้นความแม่นยำสูงสุด [18], [17]
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
      
      ui.alert("✅ API Ping Success!\n\nResponse:\n" + text);
      console.info("[Debug] Gemini API Connection: OK");
    } else {
      ui.alert("❌ API Error: " + res.getContentText());
      console.error("[Debug] Gemini API Error: " + res.getContentText());
    }


  } catch (e) {
    ui.alert("❌ Connection Failed: " + e.message);
    console.error("[Debug] Connection Failed: " + e.message);
  }
}


// ==========================================
// 3. ROW MANIPULATION (FOR RE-RUNNING AI)
// ==========================================


/**
 * 🔄 Reset AI Tags: ล้าง Tag ระบบ AI เพื่อให้รันใหม่ (เฉพาะแถวที่เลือก) [3], [13]
 * [MODIFIED v4.0]: ล้างทั้ง [AI], [Agent_V4] และ Tag อื่นๆ ของ Agent อัตโนมัติ
 */
function debug_ResetSelectedRowsAI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getActiveSheet();


  // ตรวจสอบว่าอยู่ในชีตที่ถูกต้องหรือไม่ [12], [13]
  if (sheet.getName() !== CONFIG.SHEET_NAME) {
    ui.alert("⚠️ System Note", "กรุณาไฮไลต์เลือก Cell ในชีต '" + CONFIG.SHEET_NAME + "' เท่านั้นครับ", ui.ButtonSet.OK);
    return;
  }


  var range = sheet.getActiveRange();
  var startRow = range.getRow();
  var numRows = range.getNumRows();


  // ดึงตำแหน่งคอลัมน์ Normalized (คอลัมน์ F) [19], [20]
  var colIndex = (typeof CONFIG !== 'undefined' && CONFIG.COL_NORMALIZED) ? CONFIG.COL_NORMALIZED : 6;
  var targetRange = sheet.getRange(startRow, colIndex, numRows, 1);
  var values = targetRange.getValues();


  var resetCount = 0;
  for (var i = 0; i < values.length; i++) {
    var val = values[i] ? values[i].toString() : "";


    // ตรวจหา Tag ของ AI (ทั้งระบบเก่าและใหม่) [20]
    if (val.indexOf("[AI]") !== -1 || val.indexOf("[Agent_") !== -1) {
      
      // [MODIFIED v4.0]: ลบ Tags ออกโดยใช้ Regex เพื่อความสะอาดที่สุด [7]
      var cleanedVal = val
        .replace(/\s?\[AI\]/g, "")
        .replace(/\s?\[Agent_.*?\]/g, "") 
        .trim();


      values[i] = cleanedVal;
      resetCount++;
    }
  }


  if (resetCount > 0) {
    targetRange.setValues(values);
    ss.toast("🔄 Reset AI Status เรียบร้อย " + resetCount + " แถว", "Debug", 5);
    console.info(`[Debug] User reset AI tags for ${resetCount} rows.`); [14], [7]
  } else {
    ss.toast("ℹ️ ไม่พบรายการที่มี Tag AI ในส่วนที่เลือก", "Debug", 5);
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

