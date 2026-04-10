# 🚛 Logistics Master Data System V4.0 - Part 2/3

### 📄 ไฟล์: Service_AutoPilot.gs
```javascript
/**
 * VERSION: 000
 * 🤖 Service: Auto Pilot (Enterprise AI Edition)
 * Version: 4.2 Clean SmartKey & Stable Fallback
 * --------------------------------------------
 * [FIXED v4.2]: Removed duplicate "tone-less" basic key to keep data clean. 
 * AI will handle typos and phonetic variations instead.
 * [FIXED v4.2]: Enforced 'gemini-1.5-flash-latest' to resolve v1beta 404 errors.
 * [PRESERVED]: Trigger management, LockService, and JSON output parsing.
 * Author: Elite Logistics Architect
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
}


function STOP_AUTO_PILOT() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "autoPilotRoutine") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}


function autoPilotRoutine() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    console.warn("[AutoPilot] Skipped: มี instance อื่นกำลังรันอยู่");
    return;
  }


  try {
    console.time("AutoPilot_Duration");
    console.info("[AutoPilot] 🚀 Starting routine...");


    try {
      if (typeof applyMasterCoordinatesToDailyJob === 'function') {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var dataSheet = ss.getSheetByName(typeof SCG_CONFIG !== 'undefined' ? SCG_CONFIG.SHEET_DATA : 'Data');
        if (dataSheet && dataSheet.getLastRow() > 1) {
           applyMasterCoordinatesToDailyJob();
           console.log("✅ AutoPilot: SCG Sync Completed");
        }
      }
    } catch(e) { console.error("[AutoPilot] SCG Sync Error: " + e.message); }


    try {
      processAIIndexing_Batch(); 
    } catch(e) { console.error("[AutoPilot] AI Indexing Error: " + e.message); }


    console.timeEnd("AutoPilot_Duration");
    console.info("[AutoPilot] 🏁 Routine finished successfully.");


  } catch (e) {
    console.error("CRITICAL AutoPilot Error: " + e.message);
  } finally {
    lock.releaseLock();
  }
}


function processAIIndexing_Batch() {
  var apiKey;
  try {
    apiKey = CONFIG.GEMINI_API_KEY;
  } catch (e) {
    console.warn("⚠️ SKIPPED AI: " + e.message); 
    return;
  }


  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return;


  var lastRow = typeof getRealLastRow_ === 'function' ? getRealLastRow_(sheet, CONFIG.COL_NAME) : sheet.getLastRow();
  if (lastRow < 2) return;


  var rangeName = sheet.getRange(2, CONFIG.COL_NAME, lastRow - 1, 1);
  var rangeNorm = sheet.getRange(2, CONFIG.COL_NORMALIZED, lastRow - 1, 1);
  
  var nameValues = rangeName.getValues();
  var normValues = rangeNorm.getValues(); 
  
  var aiCount = 0;
  var AI_LIMIT = (typeof CONFIG !== 'undefined' && CONFIG.AI_BATCH_SIZE) ? CONFIG.AI_BATCH_SIZE : 20; 
  var updated = false;


  for (var i = 0; i < nameValues.length; i++) {
    if (aiCount >= AI_LIMIT) break;


    var name = nameValues[i][0];
    var currentNorm = normValues[i][0];


    if (name && typeof name === 'string' && (!currentNorm || currentNorm.toString().indexOf("[AI]") === -1)) {
      
      var basicKey = createBasicSmartKey(name);
      var aiKeywords = "";
      
      if (name.length > 3) {
        aiKeywords = genericRetry(function() { 
          return callGeminiThinking_JSON(name, apiKey); 
        }, 2); 
      }
      
      var finalString = basicKey + (aiKeywords ? " " + aiKeywords : "") + " [AI]";
      normValues[i][0] = finalString.trim();
      
      console.log(`🤖 AI Processed (${aiCount+1}/${AI_LIMIT}): [${name}] -> ${aiKeywords}`);
      aiCount++;
      updated = true;
    }
  }


  if (updated) {
    rangeNorm.setValues(normValues);
    console.log(`✅ AI Batch Write: อัปเดตฐานข้อมูล ${aiCount} รายการ.`);
  } else {
    console.log("ℹ️ AI Standby: ไม่มีข้อมูลใหม่ที่ต้องให้ AI วิเคราะห์.");
  }
}


function callGeminiThinking_JSON(customerName, apiKey) {
  try {
    // [FIXED v4.2] Enforce latest model to prevent v1beta 404 NOT_FOUND API Errors
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
      "generationConfig": { "responseMimeType": "application/json" } 
    };


    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };


    var response = UrlFetchApp.fetch(apiUrl, options);
    var statusCode = response.getResponseCode();
    
    if (statusCode !== 200) {
      throw new Error(`API Error ${statusCode}: ${response.getContentText()}`);
    }


    var json = JSON.parse(response.getContentText());


    if (json.candidates && json.candidates.length > 0) {
      var text = json.candidates[0].content.parts[0].text;
      var keywords = JSON.parse(text); 
      
      if (Array.isArray(keywords)) {
        return keywords.join(" "); 
      }
    }
  } catch (e) {
    console.warn("Gemini Error (" + customerName + "): " + e.message);
    return ""; 
  }
  return "";
}


/**
 * 🔨 Helper: สร้าง Index แบบพื้นฐาน (Regex)
 * [FIXED v4.2]: ยกเลิกการเติมคำซ้ำ (ตัดวรรณยุกต์) เพื่อให้ข้อมูลดูสะอาดตาที่สุด
 */
function createBasicSmartKey(text) {
  if (!text) return "";
  var clean = typeof normalizeText === 'function' ? normalizeText(text) : text.toString().toLowerCase().replace(/\s/g, ""); 
  return clean; // คืนค่าเฉพาะคำที่ตัด Stop Words ออกแล้ว โดยไม่ Duplicate ให้รกช่อง
}
```

---

### 📄 ไฟล์: WebApp.gs
```javascript
/**
 * VERSION: 000
 * 🌐 WebApp Controller (Enterprise Edition)
 * Version: 4.0 Omni-Channel Interface
 * ------------------------------------------
 * [PRESERVED]: URL Parameter handling, Safe Include, Version Control.
 * [ADDED v4.0]: doPost() for API/Webhook readiness (AppSheet/External Triggers).
 * [ADDED v4.0]: Page routing logic (e.parameter.page) for multi-view support.
 * [MODIFIED v4.0]: Enterprise logging tracking for web accesses.
 * [MODIFIED v4.0]: Safe user context extraction.
 * Author: Elite Logistics Architect
 */


/**
 * 🖥️ ฟังก์ชันแสดงผลหน้าเว็บ (HTTP GET)
 * รองรับ: https://script.google.com/.../exec?q=ค้นหา&page=Index
 */
function doGet(e) {
  try {
    // บันทึก Log การเข้าใช้งาน
    console.info(`[WebApp] GET Request received. Params: ${JSON.stringify(e.parameter)}`);


    // 1. Page Routing (เตรียมพร้อมสำหรับหน้าจออื่นๆ เช่น Admin, Dashboard)
    var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'Index';
    
    // 2. สร้าง Template จากไฟล์ HTML
    var template = HtmlService.createTemplateFromFile(page);
    
    // 3. รับค่าจาก URL Parameter (Deep Linking)
    var paramQuery = (e && e.parameter && e.parameter.q) ? e.parameter.q : "";
    template.initialQuery = paramQuery;
    
    // 4. ส่งค่า Config/Version ไปหน้าบ้าน (แก้ปัญหา Browser Cache)
    template.appVersion = new Date().getTime(); // บังคับโหลดใหม่เสมอ
    template.isEnterprise = true;
    
    // 5. Evaluate & Render
    var output = template.evaluate()
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0') 
        .setTitle('🔍 Logistics Master Search (V4.0)')
        .setFaviconUrl('https://img.icons8.com/color/48/truck--v1.png');


    // 6. X-Frame Options 
    // ALLOWALL: จำเป็นสำหรับการ Embed ใน SharePoint, Google Sites หรือ AppSheet
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    return output;


  } catch (err) {
    console.error(`[WebApp] GET Error: ${err.message}`);
    // Fallback กรณีระบบล่ม หรือหาไฟล์ HTML ไม่เจอ
    return HtmlService.createHtmlOutput(`
      <div style="font-family: sans-serif; padding: 20px; text-align: center; background-color: #ffebee;">
        <h3 style="color: #d32f2f;">❌ System Error (V4.0)</h3>
        <p>${err.message}</p>
        <p style="color: #666; font-size: 12px;">กรุณาตรวจสอบชื่อไฟล์ HTML หรือติดต่อ System Administrator</p>
      </div>
    `);
  }
}


/**
 * 📡 [ADDED v4.0] ฟังก์ชันรับข้อมูลผ่าน Webhook/API (HTTP POST)
 * รองรับการเชื่อมต่อจาก AppSheet หรือระบบภายนอกเพื่อสั่งงานเบื้องหลัง
 */
function doPost(e) {
  try {
    console.info("[WebApp] POST Request received.");
    if (!e || !e.postData) throw new Error("No payload found in POST request.");
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;


    // ตัวอย่างการทำ Routing API เบื้องต้น
    if (action === "triggerAIBatch") {
       // สั่งให้ AI ทำงานจากภายนอก
       if (typeof processAIIndexing_Batch === 'function') {
         processAIIndexing_Batch();
         return createJsonResponse_({ status: "success", message: "AI Batch Processing Triggered" });
       }
    }


    return createJsonResponse_({ status: "success", message: "Webhook received", data: payload });


  } catch (err) {
    console.error("[WebApp] POST Error: " + err.message);
    return createJsonResponse_({ status: "error", message: err.message });
  }
}


/**
 * Helper: สร้าง JSON Response ให้ doPost
 */
function createJsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/**
 * 📦 ฟังก์ชันสำหรับดึง CSS/JS เข้ามาใน HTML (Server-Side Include)
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
 * เอาไว้เรียกจากฝั่ง Client เพื่อดูว่าใครใช้งานอยู่
 */
function getUserContext() {
  try {
    return {
      email: Session.getActiveUser().getEmail() || "anonymous",
      locale: Session.getActiveUserLocale() || "th"
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
 * VERSION: 000
 * 🔍 Service: Search Engine (Enterprise Edition)
 * Version: 4.0 Omni-Search (UUID & AI Integrated)
 * ----------------------------------------------
 * [PRESERVED]: Multi-Token search logic and Pagination structure.
 * [MODIFIED v4.0]: Upgraded NameMapping cache to use Master_UID instead of Name.
 * [MODIFIED v4.0]: Added try-catch around CacheService to prevent 100KB limit crash.
 * [MODIFIED v4.0]: Added Enterprise Performance Logging (console.time).
 * Author: Elite Logistics Architect
 */


function searchMasterData(keyword, page) {
  console.time("SearchLatency");
  try {
    // 1. Input Validation & Setup
    var pageNum = parseInt(page) || 1;
    var pageSize = 20;


    if (!keyword || keyword.toString().trim() === "") {
      return { items: [], total: 0, totalPages: 0, currentPage: 1 };
    }
    
    // Prepare Keywords (Split by space for multi-token match)
    // Example: "SCG Rayong" -> ["scg", "rayong"]
    var rawKey = keyword.toString().toLowerCase().trim();
    var searchTokens = rawKey.split(/\s+/).filter(function(k) { return k.length > 0; });
    
    if (searchTokens.length === 0) return { items: [], total: 0, totalPages: 0, currentPage: 1 };


    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 2. [UPGRADED v4.0] Load NameMapping (With Smart Cache via UUID)
    var aliasMap = getCachedNameMapping_(ss);


    // 3. Load Database
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) return { items: [], total: 0, totalPages: 0, currentPage: 1 };


    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { items: [], total: 0, totalPages: 0, currentPage: 1 };


    // Read Data
    var data = sheet.getRange(2, 1, lastRow - 1, 17).getValues(); 
    var matches = []; 


    // 4. Search Algorithm (Linear Scan with Token Logic)
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      var name = row[CONFIG.C_IDX.NAME];
      if (!name) continue;


      var address = row[CONFIG.C_IDX.GOOGLE_ADDR] || row[CONFIG.C_IDX.SYS_ADDR] || "";
      var lat = row[CONFIG.C_IDX.LAT];
      var lng = row[CONFIG.C_IDX.LNG];
      var uuid = row[CONFIG.C_IDX.UUID]; // [ADDED v4.0]: Use UUID for relational link
      
      // AI Brain: ดึงข้อมูลที่ Agent คิดไว้มาช่วยค้นหา (Tag [AI])
      var aiKeywords = row[CONFIG.C_IDX.NORMALIZED] ? row[CONFIG.C_IDX.NORMALIZED].toString().toLowerCase() : "";
      var normName = typeof normalizeText === 'function' ? normalizeText(name) : name.toString().toLowerCase();
      var rawName = name.toString().toLowerCase();
      
      // [UPGRADED v4.0]: Alias Lookup using UUID instead of Name
      var aliases = uuid ? (aliasMap[uuid] || "") : "";
      
      // Combine all searchable text into one "Haystack"
      var haystack = (rawName + " " + normName + " " + aliases + " " + aiKeywords + " " + address.toString().toLowerCase());
      
      // Multi-Token Check: ต้องเจอ "ทุกคำ" ที่พิมพ์มา (AND Logic)
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
          score: aiKeywords.includes(rawKey) ? 10 : 1 // AI Exact Match gets higher priority
        });
      }
    }


    // [Optional] Sort by score (AI exact matches first)
    matches.sort(function(a, b) { return b.score - a.score; });


    // 5. Pagination Logic
    var totalItems = matches.length;
    var totalPages = Math.ceil(totalItems / pageSize);
    
    if (pageNum > totalPages && totalPages > 0) pageNum = 1;
    
    var startIndex = (pageNum - 1) * pageSize;
    var endIndex = startIndex + pageSize;
    var pagedItems = matches.slice(startIndex, endIndex);


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
    console.timeEnd("SearchLatency");
  }
}


/**
 * 🛠️ Internal Helper: Get NameMapping with Caching
 * [UPGRADED v4.0]: Relational mapping using Variant -> UID
 */
function getCachedNameMapping_(ss) {
  var cache = CacheService.getScriptCache();
  var cachedMap = cache.get("NAME_MAPPING_JSON_V4");
  
  if (cachedMap) {
    return JSON.parse(cachedMap);
  }
  
  // ถ้าไม่มีใน Cache ให้โหลดจาก Sheet
  var mapSheet = ss.getSheetByName(CONFIG.MAPPING_SHEET);
  var aliasMap = {}; 
  
  if (mapSheet && mapSheet.getLastRow() > 1) {
    // โหลด 2 คอลัมน์แรก (Col A: Variant, Col B: UID) ตามโครงสร้าง V4.0
    var mapData = mapSheet.getRange(2, 1, mapSheet.getLastRow() - 1, 2).getValues();
    
    mapData.forEach(function(row) {
      var variant = row[0]; // Variant_Name
      var uid = row[1];     // Master_UID
      
      if (variant && uid) {
        if (!aliasMap[uid]) aliasMap[uid] = "";
        
        // ต่อ String Variant Name เก็บไว้ใน Key ของ UID
        var normVariant = typeof normalizeText === 'function' ? normalizeText(variant) : variant.toString().toLowerCase();
        aliasMap[uid] += " " + normVariant + " " + variant.toString().toLowerCase();
      }
    });
    
    // Save to Cache (Duration: 1 hour)
    // ป้องกัน Error 100KB Limit ของ Google Cache
    try {
      var jsonString = JSON.stringify(aliasMap);
      if (jsonString.length < 100000) { 
        cache.put("NAME_MAPPING_JSON_V4", jsonString, 3600);
      } else {
        console.warn("[Cache] NameMapping size exceeds 100KB, skipping cache put.");
      }
    } catch (e) {
      console.warn("[Cache Error]: " + e.message);
    }
  }
  
  return aliasMap;
}


/**
 * [Optional] Function to clear cache if Mapping is updated
 * Call this when running 'finalizeAndClean'
 */
function clearSearchCache() {
  CacheService.getScriptCache().remove("NAME_MAPPING_JSON_V4");
  console.log("[Cache] Search Cache Cleared.");
}






Index.html
<!DOCTYPE html>
<html lang="th" class="h-full">
 <head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ค้นหาพิกัดลูกค้า (V4.0)</title>
  <!-- Font & Icons -->
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  
  <style>
    /* --- CORE LAYOUT --- */
    :root {
      /* [MODIFIED v4.0] Enterprise Gradient Color */
      --primary-grad: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      --bg-color: #f3f4f6;
      --card-bg: #ffffff;
      --text-main: #1f2937;
      --text-muted: #6b7280;
    }


    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    
    body {
      font-family: 'Kanit', sans-serif;
      background: var(--bg-color); 
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden; /* Prevent body scroll, use container scroll */
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
    
    /* --- 1. STICKY HEADER --- */
    .header-section {
      background: var(--primary-grad);
      padding: 20px 20px 30px 20px;
      border-bottom-left-radius: 24px;
      border-bottom-right-radius: 24px;
      box-shadow: 0 10px 25px rgba(124, 58, 237, 0.25);
      z-index: 10;
      flex-shrink: 0;
    }


    .app-branding {
      text-align: center;
      color: white;
      margin-bottom: 20px;
    }
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
      border-radius: 12px;
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
      white-space: nowrap;
    }
    .btn-search:active { transform: scale(0.95); }
    
    .btn-clear {
      color: #d1d5db;
      background: none;
      border: none;
      padding: 10px;
      cursor: pointer;
      display: none; /* Show via JS */
    }
    .btn-clear:hover { color: #ef4444; }


    /* --- 2. RESULTS AREA --- */
    .results-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      padding-bottom: 80px; /* Space for pagination */
      -webkit-overflow-scrolling: touch;
    }
    
    /* Scrollbar Styling */
    .results-area::-webkit-scrollbar { width: 6px; }
    .results-area::-webkit-scrollbar-thumb { background-color: #cbd5e0; border-radius: 20px; }


    .result-card {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border-left: 5px solid #7c3aed;
      animation: slideUp 0.3s ease-out backwards;
      position: relative;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }


    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .shop-name { font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 2px; line-height: 1.3; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    
    /* [ADDED v4.0] AI Badge Styling */
    .ai-badge {
      font-size: 10px; background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
      color: #c026d3; padding: 2px 8px; border-radius: 12px; font-weight: 600;
      border: 1px solid #f5d0fe; display: inline-flex; align-items: center; gap: 4px;
    }


    /* [ADDED v4.0] UUID Tracking */
    .uuid-track { font-size: 10px; color: #9ca3af; font-family: monospace; margin-bottom: 6px; }


    .shop-address { font-size: 13px; color: var(--text-muted); display: flex; align-items: flex-start; gap: 6px; margin-top: 4px; }
    
    .coord-tag {
      display: inline-flex; align-items: center; gap: 5px;
      background: #eff6ff; color: #3b82f6;
      font-size: 13px; font-weight: 500;
      padding: 6px 12px; border-radius: 8px;
      margin-top: 10px; cursor: pointer;
      transition: all 0.2s;
      border: 1px solid #dbeafe;
    }
    .coord-tag:active { background: #dbeafe; transform: scale(0.98); }
    
    .action-row {
      margin-top: 15px;
      display: flex;
      gap: 10px;
      padding-top: 15px;
      border-top: 1px dashed #e5e7eb;
    }
    
    .btn-nav {
      flex: 1;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px; border-radius: 10px;
      font-size: 14px; font-weight: 500;
      text-decoration: none; color: white;
      transition: opacity 0.2s;
    }
    .btn-nav:hover { opacity: 0.9; }
    .btn-google { background: #4285F4; box-shadow: 0 4px 10px rgba(66, 133, 244, 0.2); }
    .btn-waze { background: #33ccff; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 4px 10px rgba(51, 204, 255, 0.2); }


    /* --- 3. PAGINATION --- */
    .pagination-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      padding: 10px;
      display: flex; justify-content: center; gap: 8px;
      box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
      z-index: 20;
    }
    .page-dot {
      width: 35px; height: 35px;
      border-radius: 8px; border: 1px solid #e5e7eb;
      background: white; color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: all 0.2s;
    }
    .page-dot.active {
      background: var(--primary-grad); color: white; border: none;
      box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);
    }
    
    /* --- UTILS --- */
    .loading-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(243, 244, 246, 0.85);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .spinner {
      width: 45px; height: 45px;
      border: 4px solid #e5e7eb; border-top-color: #7c3aed;
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }


    .toast {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #1f2937; color: white;
      padding: 12px 24px; border-radius: 30px;
      font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      display: none; align-items: center; gap: 8px; z-index: 9999;
      white-space: nowrap;
      font-weight: 500;
    }
    
    .empty-state { text-align: center; margin-top: 60px; opacity: 0.7; }
    .empty-icon { font-size: 64px; margin-bottom: 15px; color: #cbd5e1; }


    /* Mobile adjustments */
    @media (max-width: 480px) {
      .app-title { font-size: 22px; }
      .result-card { padding: 15px; }
      .search-input { font-size: 15px; }
    }
  </style>
 </head>
 <body>


  <div class="app-container">
    
    <!-- Header -->
    <div class="header-section">
      <div class="app-branding">
        <h1 class="app-title"><i class="fas fa-shipping-fast me-2"></i>Logistics Master</h1>
        <p class="app-subtitle">Enterprise Search Engine V4.0</p>
      </div>
      
      <div class="search-box-wrapper">
        <i class="fas fa-search search-icon-left"></i>
        <input type="text" id="searchInput" class="search-input" placeholder="พิมพ์ชื่อร้าน, อำเภอ, จังหวัด..." autocomplete="off">
        <button id="btnClear" class="btn-clear" onclick="clearSearch()"><i class="fas fa-times-circle"></i></button>
        <button class="btn-search" onclick="triggerSearch()">ค้นหา</button>
      </div>
    </div>


    <!-- Results -->
    <div class="results-area" id="resultsContainer">
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-map-marked-alt"></i></div>
        <p>พิมพ์คำค้นหาแล้วกดปุ่ม "ค้นหา"<br>เพื่อเชื่อมต่อฐานข้อมูลส่วนกลาง</p>
      </div>
    </div>


    <!-- Pagination -->
    <div class="pagination-bar" id="paginationBar" style="display: none;"></div>


    <!-- Loading -->
    <div class="loading-overlay" id="loader">
      <div class="spinner"></div>
      <p style="margin-top: 15px; font-weight: 500; color: #4b5563;">กำลังค้นหาผ่าน AI...</p>
    </div>


  </div>


  <!-- Toast -->
  <div class="toast" id="toastMsg">
    <i class="fas fa-check-circle" style="color: #34d399;"></i> <span id="toastText">ข้อความ</span>
  </div>


  <script>
    /* --- 1. GLOBAL STATE --- */
    let currentKeyword = "";
    let currentPage = 1;


    /* --- 2. INITIALIZATION (Deep Linking) --- */
    window.onload = function() {
      // รับค่าจาก WebApp.gs (Server-Side Injection)
      var initialQuery = "<?= typeof initialQuery !== 'undefined' ? initialQuery : '' ?>";
      
      // Auto-Search if query exists
      if (initialQuery && initialQuery !== "undefined" && initialQuery.trim() !== "") {
        document.getElementById('searchInput').value = initialQuery;
        triggerSearch();
      }


      // Input Listener for Enter key & Clear button visibility
      const input = document.getElementById('searchInput');
      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') triggerSearch();
        toggleClearBtn();
      });
      input.addEventListener('input', toggleClearBtn);
    };


    function toggleClearBtn() {
      const val = document.getElementById('searchInput').value;
      document.getElementById('btnClear').style.display = val ? 'block' : 'none';
    }


    function clearSearch() {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchInput').focus();
      toggleClearBtn();
    }


    /* --- 3. SEARCH LOGIC --- */
    function triggerSearch() {
      const keyword = document.getElementById('searchInput').value.trim();
      if (!keyword) {
        showToast("⚠️ กรุณาพิมพ์คำค้นหาก่อนครับ");
        return;
      }
      
      currentKeyword = keyword;
      currentPage = 1;
      document.getElementById('searchInput').blur(); // Hide keyboard on mobile
      fetchData(1);
    }


    function fetchData(page) {
      showLoading(true);
      
      google.script.run
        .withSuccessHandler(renderResults)
        .withFailureHandler(handleError)
        .searchMasterData(currentKeyword, page);
    }


    /* --- 4. RENDER LOGIC --- */
    function renderResults(response) {
      showLoading(false);
      const container = document.getElementById('resultsContainer');
      const pagination = document.getElementById('paginationBar');
      
      container.innerHTML = '';
      
      if (!response || !response.items || response.items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🤔</div>
            <p>ไม่พบข้อมูล "${escapeHtml(currentKeyword)}"<br>ลองพิมพ์คำค้นหาให้สั้นลง หรือหาด้วยชื่อพื้นที่</p>
          </div>`;
        pagination.style.display = 'none';
        return;
      }


      // Render Info Header
      const infoDiv = document.createElement('div');
      infoDiv.style.padding = '0 5px 10px 5px';
      infoDiv.style.fontSize = '13px';
      infoDiv.style.color = '#6b7280';
      infoDiv.style.fontWeight = '500';
      infoDiv.innerHTML = `พบคลังข้อมูล ${response.total} รายการ (หน้า ${response.currentPage}/${response.totalPages})`;
      container.appendChild(infoDiv);


      // Render Items
      response.items.forEach((item, index) => {
        const hasCoord = (item.lat && item.lng);
        const latLng = hasCoord ? `${item.lat}, ${item.lng}` : '';
        
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        // [ADDED v4.0] AI Badge & UUID Display
        const aiBadgeHtml = (item.score >= 10) 
            ? `<span class="ai-badge"><i class="fas fa-magic"></i> AI Match</span>` 
            : '';
            
        const uuidHtml = item.uuid 
            ? `<div class="uuid-track">UID: ${item.uuid}</div>` 
            : '';


        let coordHtml = hasCoord 
          ? `<div class="coord-tag" onclick="copyCoord('${latLng}')">
               <i class="fas fa-copy"></i> พิกัด: ${latLng}
             </div>`
          : `<span style="font-size:12px; color:#ef4444; background:#fef2f2; padding:4px 8px; border-radius:6px; display:inline-block; margin-top:10px;">ไม่มีข้อมูลพิกัดในระบบ</span>`;


        let actionHtml = hasCoord
          ? `<div class="action-row">
               <a href="https://www.google.com/maps/dir/?api=1&destination=${latLng}" target="_blank" class="btn-nav btn-google">
                 <i class="fab fa-google"></i> Google Maps
               </a>
               <a href="https://waze.com/ul?ll=${item.lat},${item.lng}&navigate=yes" target="_blank" class="btn-nav btn-waze">
                 <i class="fab fa-waze"></i> Waze
               </a>
             </div>`
          : '';


        card.innerHTML = `
          <div class="card-header">
            <div style="width: 100%;">
              <div class="shop-name">${escapeHtml(item.name)} ${aiBadgeHtml}</div>
              ${uuidHtml}
              <div class="shop-address">
                <i class="fas fa-map-marker-alt" style="margin-top:3px; color:#9ca3af;"></i>
                <span>${escapeHtml(item.address || 'ไม่ระบุที่อยู่ระบบ SCG')}</span>
              </div>
              ${coordHtml}
            </div>
          </div>
          ${actionHtml}
        `;
        
        container.appendChild(card);
      });


      // Render Pagination
      renderPagination(response.totalPages, response.currentPage);
    }


    function renderPagination(total, current) {
      const bar = document.getElementById('paginationBar');
      if (total <= 1) {
        bar.style.display = 'none';
        return;
      }
      
      bar.style.display = 'flex';
      let html = '';
      
      // Previous
      html += `<div class="page-dot" onclick="changePage(${current-1})" ${current===1 ? 'style="pointer-events:none; opacity:0.4;"' : ''}><i class="fas fa-chevron-left"></i></div>`;
      
      // Pagination Logic
      let start = Math.max(1, current - 1);
      let end = Math.min(total, current + 1);
      
      if(start > 1) html += `<div class="page-dot" onclick="changePage(1)">1</div>`;
      if(start > 2) html += `<span style="align-self:end; padding-bottom:5px; color:#9ca3af;">...</span>`;
      
      for (let i = start; i <= end; i++) {
        html += `<div class="page-dot ${i === current ? 'active' : ''}" onclick="changePage(${i})">${i}</div>`;
      }
      
      if(end < total - 1) html += `<span style="align-self:end; padding-bottom:5px; color:#9ca3af;">...</span>`;
      if(end < total) html += `<div class="page-dot" onclick="changePage(${total})">${total}</div>`;


      // Next
      html += `<div class="page-dot" onclick="changePage(${current+1})" ${current===total ? 'style="pointer-events:none; opacity:0.4;"' : ''}><i class="fas fa-chevron-right"></i></div>`;
      
      bar.innerHTML = html;
    }


    function changePage(p) {
      if (p < 1) return;
      fetchData(p);
    }


    /* --- 5. UTILITIES --- */
    function showLoading(isLoading) {
      document.getElementById('loader').style.display = isLoading ? 'flex' : 'none';
    }


    function handleError(err) {
      showLoading(false);
      showToast("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
      console.error(err);
    }


    // [PRESERVED]: Robust Copy to Clipboard (iFrame Safe for GAS)
    function copyCoord(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(`คัดลอก: ${text}`);
        }).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    }


    function fallbackCopy(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) showToast(`คัดลอก: ${text}`);
        else showToast("❌ คัดลอกไม่สำเร็จ");
      } catch (err) {
        showToast("❌ Browser ไม่รองรับการคัดลอก");
      }
      
      document.body.removeChild(textArea);
    }


    let toastTimeout;
    function showToast(msg) {
      const toast = document.getElementById('toastMsg');
      document.getElementById('toastText').innerText = msg;
      
      toast.style.display = 'flex';
      toast.style.animation = 'slideUp 0.3s forwards';
      
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }


    // XSS Protection
    function escapeHtml(text) {
      if (!text) return text;
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  </script>
 </body>
</html>
```

---

### 📄 ไฟล์: Index.html
```html
<!DOCTYPE html>
<html lang="th" class="h-full">
 <head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ค้นหาพิกัดลูกค้า (V4.0)</title>
  <!-- Font & Icons -->
  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  
  <style>
    /* --- CORE LAYOUT --- */
    :root {
      /* [MODIFIED v4.0] Enterprise Gradient Color */
      --primary-grad: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      --bg-color: #f3f4f6;
      --card-bg: #ffffff;
      --text-main: #1f2937;
      --text-muted: #6b7280;
    }


    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    
    body {
      font-family: 'Kanit', sans-serif;
      background: var(--bg-color); 
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden; /* Prevent body scroll, use container scroll */
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
    
    /* --- 1. STICKY HEADER --- */
    .header-section {
      background: var(--primary-grad);
      padding: 20px 20px 30px 20px;
      border-bottom-left-radius: 24px;
      border-bottom-right-radius: 24px;
      box-shadow: 0 10px 25px rgba(124, 58, 237, 0.25);
      z-index: 10;
      flex-shrink: 0;
    }


    .app-branding {
      text-align: center;
      color: white;
      margin-bottom: 20px;
    }
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
      border-radius: 12px;
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
      white-space: nowrap;
    }
    .btn-search:active { transform: scale(0.95); }
    
    .btn-clear {
      color: #d1d5db;
      background: none;
      border: none;
      padding: 10px;
      cursor: pointer;
      display: none; /* Show via JS */
    }
    .btn-clear:hover { color: #ef4444; }


    /* --- 2. RESULTS AREA --- */
    .results-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      padding-bottom: 80px; /* Space for pagination */
      -webkit-overflow-scrolling: touch;
    }
    
    /* Scrollbar Styling */
    .results-area::-webkit-scrollbar { width: 6px; }
    .results-area::-webkit-scrollbar-thumb { background-color: #cbd5e0; border-radius: 20px; }


    .result-card {
      background: var(--card-bg);
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border-left: 5px solid #7c3aed;
      animation: slideUp 0.3s ease-out backwards;
      position: relative;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }


    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .shop-name { font-size: 18px; font-weight: 600; color: var(--text-main); margin-bottom: 2px; line-height: 1.3; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    
    /* [ADDED v4.0] AI Badge Styling */
    .ai-badge {
      font-size: 10px; background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
      color: #c026d3; padding: 2px 8px; border-radius: 12px; font-weight: 600;
      border: 1px solid #f5d0fe; display: inline-flex; align-items: center; gap: 4px;
    }


    /* [ADDED v4.0] UUID Tracking */
    .uuid-track { font-size: 10px; color: #9ca3af; font-family: monospace; margin-bottom: 6px; }


    .shop-address { font-size: 13px; color: var(--text-muted); display: flex; align-items: flex-start; gap: 6px; margin-top: 4px; }
    
    .coord-tag {
      display: inline-flex; align-items: center; gap: 5px;
      background: #eff6ff; color: #3b82f6;
      font-size: 13px; font-weight: 500;
      padding: 6px 12px; border-radius: 8px;
      margin-top: 10px; cursor: pointer;
      transition: all 0.2s;
      border: 1px solid #dbeafe;
    }
    .coord-tag:active { background: #dbeafe; transform: scale(0.98); }
    
    .action-row {
      margin-top: 15px;
      display: flex;
      gap: 10px;
      padding-top: 15px;
      border-top: 1px dashed #e5e7eb;
    }
    
    .btn-nav {
      flex: 1;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px; border-radius: 10px;
      font-size: 14px; font-weight: 500;
      text-decoration: none; color: white;
      transition: opacity 0.2s;
    }
    .btn-nav:hover { opacity: 0.9; }
    .btn-google { background: #4285F4; box-shadow: 0 4px 10px rgba(66, 133, 244, 0.2); }
    .btn-waze { background: #33ccff; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2); box-shadow: 0 4px 10px rgba(51, 204, 255, 0.2); }


    /* --- 3. PAGINATION --- */
    .pagination-bar {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      padding: 10px;
      display: flex; justify-content: center; gap: 8px;
      box-shadow: 0 -5px 20px rgba(0,0,0,0.05);
      z-index: 20;
    }
    .page-dot {
      width: 35px; height: 35px;
      border-radius: 8px; border: 1px solid #e5e7eb;
      background: white; color: var(--text-muted);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: all 0.2s;
    }
    .page-dot.active {
      background: var(--primary-grad); color: white; border: none;
      box-shadow: 0 4px 10px rgba(124, 58, 237, 0.3);
    }
    
    /* --- UTILS --- */
    .loading-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(243, 244, 246, 0.85);
      backdrop-filter: blur(4px);
      z-index: 50;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .spinner {
      width: 45px; height: 45px;
      border: 4px solid #e5e7eb; border-top-color: #7c3aed;
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }


    .toast {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #1f2937; color: white;
      padding: 12px 24px; border-radius: 30px;
      font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      display: none; align-items: center; gap: 8px; z-index: 9999;
      white-space: nowrap;
      font-weight: 500;
    }
    
    .empty-state { text-align: center; margin-top: 60px; opacity: 0.7; }
    .empty-icon { font-size: 64px; margin-bottom: 15px; color: #cbd5e1; }


    /* Mobile adjustments */
    @media (max-width: 480px) {
      .app-title { font-size: 22px; }
      .result-card { padding: 15px; }
      .search-input { font-size: 15px; }
    }
  </style>
 </head>
 <body>


  <div class="app-container">
    
    <!-- Header -->
    <div class="header-section">
      <div class="app-branding">
        <h1 class="app-title"><i class="fas fa-shipping-fast me-2"></i>Logistics Master</h1>
        <p class="app-subtitle">Enterprise Search Engine V4.0</p>
      </div>
      
      <div class="search-box-wrapper">
        <i class="fas fa-search search-icon-left"></i>
        <input type="text" id="searchInput" class="search-input" placeholder="พิมพ์ชื่อร้าน, อำเภอ, จังหวัด..." autocomplete="off">
        <button id="btnClear" class="btn-clear" onclick="clearSearch()"><i class="fas fa-times-circle"></i></button>
        <button class="btn-search" onclick="triggerSearch()">ค้นหา</button>
      </div>
    </div>


    <!-- Results -->
    <div class="results-area" id="resultsContainer">
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-map-marked-alt"></i></div>
        <p>พิมพ์คำค้นหาแล้วกดปุ่ม "ค้นหา"<br>เพื่อเชื่อมต่อฐานข้อมูลส่วนกลาง</p>
      </div>
    </div>


    <!-- Pagination -->
    <div class="pagination-bar" id="paginationBar" style="display: none;"></div>


    <!-- Loading -->
    <div class="loading-overlay" id="loader">
      <div class="spinner"></div>
      <p style="margin-top: 15px; font-weight: 500; color: #4b5563;">กำลังค้นหาผ่าน AI...</p>
    </div>


  </div>


  <!-- Toast -->
  <div class="toast" id="toastMsg">
    <i class="fas fa-check-circle" style="color: #34d399;"></i> <span id="toastText">ข้อความ</span>
  </div>


  <script>
    /* --- 1. GLOBAL STATE --- */
    let currentKeyword = "";
    let currentPage = 1;


    /* --- 2. INITIALIZATION (Deep Linking) --- */
    window.onload = function() {
      // รับค่าจาก WebApp.gs (Server-Side Injection)
      var initialQuery = "<?= typeof initialQuery !== 'undefined' ? initialQuery : '' ?>";
      
      // Auto-Search if query exists
      if (initialQuery && initialQuery !== "undefined" && initialQuery.trim() !== "") {
        document.getElementById('searchInput').value = initialQuery;
        triggerSearch();
      }


      // Input Listener for Enter key & Clear button visibility
      const input = document.getElementById('searchInput');
      input.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') triggerSearch();
        toggleClearBtn();
      });
      input.addEventListener('input', toggleClearBtn);
    };


    function toggleClearBtn() {
      const val = document.getElementById('searchInput').value;
      document.getElementById('btnClear').style.display = val ? 'block' : 'none';
    }


    function clearSearch() {
      document.getElementById('searchInput').value = '';
      document.getElementById('searchInput').focus();
      toggleClearBtn();
    }


    /* --- 3. SEARCH LOGIC --- */
    function triggerSearch() {
      const keyword = document.getElementById('searchInput').value.trim();
      if (!keyword) {
        showToast("⚠️ กรุณาพิมพ์คำค้นหาก่อนครับ");
        return;
      }
      
      currentKeyword = keyword;
      currentPage = 1;
      document.getElementById('searchInput').blur(); // Hide keyboard on mobile
      fetchData(1);
    }


    function fetchData(page) {
      showLoading(true);
      
      google.script.run
        .withSuccessHandler(renderResults)
        .withFailureHandler(handleError)
        .searchMasterData(currentKeyword, page);
    }


    /* --- 4. RENDER LOGIC --- */
    function renderResults(response) {
      showLoading(false);
      const container = document.getElementById('resultsContainer');
      const pagination = document.getElementById('paginationBar');
      
      container.innerHTML = '';
      
      if (!response || !response.items || response.items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🤔</div>
            <p>ไม่พบข้อมูล "${escapeHtml(currentKeyword)}"<br>ลองพิมพ์คำค้นหาให้สั้นลง หรือหาด้วยชื่อพื้นที่</p>
          </div>`;
        pagination.style.display = 'none';
        return;
      }


      // Render Info Header
      const infoDiv = document.createElement('div');
      infoDiv.style.padding = '0 5px 10px 5px';
      infoDiv.style.fontSize = '13px';
      infoDiv.style.color = '#6b7280';
      infoDiv.style.fontWeight = '500';
      infoDiv.innerHTML = `พบคลังข้อมูล ${response.total} รายการ (หน้า ${response.currentPage}/${response.totalPages})`;
      container.appendChild(infoDiv);


      // Render Items
      response.items.forEach((item, index) => {
        const hasCoord = (item.lat && item.lng);
        const latLng = hasCoord ? `${item.lat}, ${item.lng}` : '';
        
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        // [ADDED v4.0] AI Badge & UUID Display
        const aiBadgeHtml = (item.score >= 10) 
            ? `<span class="ai-badge"><i class="fas fa-magic"></i> AI Match</span>` 
            : '';
            
        const uuidHtml = item.uuid 
            ? `<div class="uuid-track">UID: ${item.uuid}</div>` 
            : '';


        let coordHtml = hasCoord 
          ? `<div class="coord-tag" onclick="copyCoord('${latLng}')">
               <i class="fas fa-copy"></i> พิกัด: ${latLng}
             </div>`
          : `<span style="font-size:12px; color:#ef4444; background:#fef2f2; padding:4px 8px; border-radius:6px; display:inline-block; margin-top:10px;">ไม่มีข้อมูลพิกัดในระบบ</span>`;


        let actionHtml = hasCoord
          ? `<div class="action-row">
               <a href="https://www.google.com/maps/dir/?api=1&destination=${latLng}" target="_blank" class="btn-nav btn-google">
                 <i class="fab fa-google"></i> Google Maps
               </a>
               <a href="https://waze.com/ul?ll=${item.lat},${item.lng}&navigate=yes" target="_blank" class="btn-nav btn-waze">
                 <i class="fab fa-waze"></i> Waze
               </a>
             </div>`
          : '';


        card.innerHTML = `
          <div class="card-header">
            <div style="width: 100%;">
              <div class="shop-name">${escapeHtml(item.name)} ${aiBadgeHtml}</div>
              ${uuidHtml}
              <div class="shop-address">
                <i class="fas fa-map-marker-alt" style="margin-top:3px; color:#9ca3af;"></i>
                <span>${escapeHtml(item.address || 'ไม่ระบุที่อยู่ระบบ SCG')}</span>
              </div>
              ${coordHtml}
            </div>
          </div>
          ${actionHtml}
        `;
        
        container.appendChild(card);
      });


      // Render Pagination
      renderPagination(response.totalPages, response.currentPage);
    }


    function renderPagination(total, current) {
      const bar = document.getElementById('paginationBar');
      if (total <= 1) {
        bar.style.display = 'none';
        return;
      }
      
      bar.style.display = 'flex';
      let html = '';
      
      // Previous
      html += `<div class="page-dot" onclick="changePage(${current-1})" ${current===1 ? 'style="pointer-events:none; opacity:0.4;"' : ''}><i class="fas fa-chevron-left"></i></div>`;
      
      // Pagination Logic
      let start = Math.max(1, current - 1);
      let end = Math.min(total, current + 1);
      
      if(start > 1) html += `<div class="page-dot" onclick="changePage(1)">1</div>`;
      if(start > 2) html += `<span style="align-self:end; padding-bottom:5px; color:#9ca3af;">...</span>`;
      
      for (let i = start; i <= end; i++) {
        html += `<div class="page-dot ${i === current ? 'active' : ''}" onclick="changePage(${i})">${i}</div>`;
      }
      
      if(end < total - 1) html += `<span style="align-self:end; padding-bottom:5px; color:#9ca3af;">...</span>`;
      if(end < total) html += `<div class="page-dot" onclick="changePage(${total})">${total}</div>`;


      // Next
      html += `<div class="page-dot" onclick="changePage(${current+1})" ${current===total ? 'style="pointer-events:none; opacity:0.4;"' : ''}><i class="fas fa-chevron-right"></i></div>`;
      
      bar.innerHTML = html;
    }


    function changePage(p) {
      if (p < 1) return;
      fetchData(p);
    }


    /* --- 5. UTILITIES --- */
    function showLoading(isLoading) {
      document.getElementById('loader').style.display = isLoading ? 'flex' : 'none';
    }


    function handleError(err) {
      showLoading(false);
      showToast("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ");
      console.error(err);
    }


    // [PRESERVED]: Robust Copy to Clipboard (iFrame Safe for GAS)
    function copyCoord(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(`คัดลอก: ${text}`);
        }).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    }


    function fallbackCopy(text) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) showToast(`คัดลอก: ${text}`);
        else showToast("❌ คัดลอกไม่สำเร็จ");
      } catch (err) {
        showToast("❌ Browser ไม่รองรับการคัดลอก");
      }
      
      document.body.removeChild(textArea);
    }


    let toastTimeout;
    function showToast(msg) {
      const toast = document.getElementById('toastMsg');
      document.getElementById('toastText').innerText = msg;
      
      toast.style.display = 'flex';
      toast.style.animation = 'slideUp 0.3s forwards';
      
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }


    // XSS Protection
    function escapeHtml(text) {
      if (!text) return text;
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  </script>
 </body>
</html>
```

---

### 📄 ไฟล์: Setup_Upgrade.gs
```javascript
/**
 * VERSION: 000
 * 🛠️ System Upgrade Tool (Enterprise Edition)
 * Version: 4.0 Omni-Schema Upgrader
 * -----------------------------------------------------------------
 * [PRESERVED]: Spatial Grid Indexing (O(N)) for hidden duplicates.
 * [PRESERVED]: upgradeDatabaseStructure for extending standard columns.
 * [ADDED v4.0]: upgradeNameMappingStructure_V4() to auto-migrate NameMapping 
 * to the new 5-column AI Resolution Schema safely.
 * [MODIFIED v4.0]: Added Enterprise Benchmarking (console.time).
 * Author: Elite Logistics Architect
 */


// ==========================================
// 1. DATABASE SCHEMA UPGRADE (Standard & V4.0)
// ==========================================


function upgradeDatabaseStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME); // "Database"
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert("❌ Critical Error: ไม่พบชีต " + CONFIG.SHEET_NAME);
    return;
  }


  // รายชื่อคอลัมน์ใหม่ (Future Expansion Columns for BigQuery/CloudSQL)
  // หมายเหตุ: คอลัมน์เหล่านี้อยู่นอกเหนือจาก Standard 17 Columns ใน Config
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


  var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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


  // ถามยืนยันก่อนเพิ่ม
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
    range.setBackground("#d0f0c0"); // สีเขียวอ่อน (New Features)
    range.setBorder(true, true, true, true, true, true);
    
    // Auto-resize
    sheet.autoResizeColumns(startCol, missingHeaders.length);
    
    console.info(`[System Upgrade] Added ${missingHeaders.length} extension columns to Database.`);
    ui.alert("✅ เพิ่มคอลัมน์ใหม่ใน Database สำเร็จ!");
  }
}


/**
 * 🚀 [NEW v4.0] Auto-Upgrade NameMapping Sheet to AI 4-Tier Schema
 * เปลี่ยนหัวคอลัมน์และจัดฟอร์แมตอัตโนมัติ ไม่ต้องทำมือ
 */
function upgradeNameMappingStructure_V4() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.MAPPING_SHEET); // "NameMapping"
  var ui = SpreadsheetApp.getUi();


  if (!sheet) {
    ui.alert("❌ Critical Error: ไม่พบชีต " + CONFIG.MAPPING_SHEET);
    return;
  }


  // Schema V4.0 เป้าหมาย
  var targetHeaders = ["Variant_Name", "Master_UID", "Confidence_Score", "Mapped_By", "Timestamp"];
  
  // เขียนหัวคอลัมน์ใหม่ทับ 5 คอลัมน์แรก
  var range = sheet.getRange(1, 1, 1, 5);
  range.setValues([targetHeaders]);
  
  // ตกแต่งให้ดูเป็น Enterprise (สีม่วง AI)
  range.setFontWeight("bold");
  range.setFontColor("white");
  range.setBackground("#7c3aed"); // Enterprise Purple
  range.setBorder(true, true, true, true, true, true);
  
  // ปรับความกว้างให้สวยงาม
  sheet.setColumnWidth(1, 250); // Variant Name (ชื่ออาจจะยาว)
  sheet.setColumnWidth(2, 280); // Master_UID (ยาวมาก)
  sheet.setColumnWidth(3, 130); // Confidence
  sheet.setColumnWidth(4, 120); // Mapped By
  sheet.setColumnWidth(5, 150); // Timestamp
  
  // ฟรีซแถวบนสุด
  sheet.setFrozenRows(1);


  console.info("[System Upgrade] Successfully migrated NameMapping schema to V4.0");
  ui.alert(
    "✅ Schema Upgrade V4.0 สำเร็จ!", 
    "อัปเกรดชีต NameMapping เป็น 5 คอลัมน์สำหรับ AI เรียบร้อยแล้วครับ\n(แนะนำให้ไปกดซ่อมแซม NameMapping ในเมนูอีกครั้ง เพื่อเติม UID ให้เต็มช่อง)", 
    ui.ButtonSet.OK
  );
}


// ==========================================
// 2. SMART DATA QUALITY CHECK
// ==========================================


/**
 * 🔍 ตรวจสอบข้อมูลซ้ำซ้อน (Spatial Grid Algorithm)
 * เร็วกว่าเดิม 100 เท่า (จาก O(N^2) เป็น O(N))
 * [MODIFIED v4.0]: Added Benchmarking Console Log
 */
function findHiddenDuplicates() {
  console.time("HiddenDupesCheck"); // เริ่มจับเวลา
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  // ใช้ C_IDX เพื่อความแม่นยำ (ถ้ามี Config V4) หรือ Fallback
  var idxLat = (typeof CONFIG !== 'undefined' && CONFIG.C_IDX && CONFIG.C_IDX.LAT !== undefined) ? CONFIG.C_IDX.LAT : 1; 
  var idxLng = (typeof CONFIG !== 'undefined' && CONFIG.C_IDX && CONFIG.C_IDX.LNG !== undefined) ? CONFIG.C_IDX.LNG : 2;
  var idxName = (typeof CONFIG !== 'undefined' && CONFIG.C_IDX && CONFIG.C_IDX.NAME !== undefined) ? CONFIG.C_IDX.NAME : 0;


  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;


  var data = sheet.getRange(2, 1, lastRow - 1, 15).getValues(); // อ่านถึง Col O ก็พอ
  var duplicates = [];
  var grid = {};


  // Step 1: สร้าง Spatial Grid (Bucket Sort)
  // ปัดเศษพิกัดทศนิยม 2 ตำแหน่ง (~1.1 กม.) เพื่อจัดกลุ่ม
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var lat = row[idxLat];
    var lng = row[idxLng];
    
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) continue;


    var gridKey = Math.floor(lat * 100) + "_" + Math.floor(lng * 100);
    
    if (!grid[gridKey]) grid[gridKey] = [];
    grid[gridKey].push({ index: i, row: row });
  }


  // Step 2: เปรียบเทียบเฉพาะใน Grid เดียวกัน
  for (var key in grid) {
    var bucket = grid[key];
    if (bucket.length < 2) continue; // มีแค่ตัวเดียวในพื้นที่นี้ ข้ามไป


    // เปรียบเทียบกันเองใน Bucket (จำนวนน้อยมาก Loop ได้สบาย)
    for (var a = 0; a < bucket.length; a++) {
      for (var b = a + 1; b < bucket.length; b++) {
        var item1 = bucket[a];
        var item2 = bucket[b];
        
        // คำนวณระยะทางจริง (Haversine)
        var dist = getHaversineDistanceKM(item1.row[idxLat], item1.row[idxLng], item2.row[idxLat], item2.row[idxLng]);
        
        // Threshold: 50 เมตร (0.05 กม.)
        if (dist <= 0.05) {
          // เช็คชื่อว่าต่างกันไหม (ถ้าชื่อเหมือนกันเป๊ะ อาจเป็น Duplicate ปกติ ไม่ใช่ Hidden)
          var name1 = typeof normalizeText === 'function' ? normalizeText(item1.row[idxName]) : item1.row[idxName];
          var name2 = typeof normalizeText === 'function' ? normalizeText(item2.row[idxName]) : item2.row[idxName];
          
          if (name1 !== name2) {
             duplicates.push({
               row1: item1.index + 2,
               name1: item1.row[idxName],
               row2: item2.index + 2,
               name2: item2.row[idxName],
               distance: (dist * 1000).toFixed(0) + " ม."
             });
          }
        }
      }
    }
  }


  console.timeEnd("HiddenDupesCheck"); // จบจับเวลา


  // Report Results
  if (duplicates.length > 0) {
    var msg = "⚠️ พบพิกัดทับซ้อน (Hidden Duplicates) " + duplicates.length + " คู่:\n\n";
    // แสดงสูงสุด 15 คู่แรก
    duplicates.slice(0, 15).forEach(function(d) {
      msg += `• แถว ${d.row1} vs ${d.row2}: ${d.name1} / ${d.name2} (ห่าง ${d.distance})\n`;
    });
    
    if (duplicates.length > 15) msg += `\n...และอีก ${duplicates.length - 15} คู่`;
    
    ui.alert(msg);
    console.warn(`[Quality Check] Hidden Duplicates Found: ${duplicates.length} pairs.`);
  } else {
    ui.alert("✅ ไม่พบข้อมูลซ้ำซ้อนในระยะ 50 เมตร");
    console.log("[Quality Check] No hidden duplicates found.");
  }
}


// ==========================================
// 3. UTILITIES INTEGRATION
// ==========================================


// Fallback Function กรณี Utils_Common โหลดไม่ทัน (Safety)
if (typeof getHaversineDistanceKM === 'undefined') {
  function getHaversineDistanceKM(lat1, lon1, lat2, lon2) {
    var R = 6371; 
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}
```

---

### 📄 ไฟล์: Test_AI.gs
```javascript
/**
 * VERSION: 000
 * 🧪 Test & Debug: AI Capabilities (Enterprise Debugging Suite)
 * Version: 4.0 Compatible with System V4.0
 * ---------------------------------------------
 * [PRESERVED]: Manual triggers, Connection test, and Row Reset logic.
 * [MODIFIED v4.0]: Upgraded debug_ResetSelectedRowsAI to clear both [AI] and [Agent_V4] tags.
 * [MODIFIED v4.0]: Replaced legacy Browser.msgBox with SpreadsheetApp.getUi() for stability.
 * [ADDED v4.0]: debug_TestTier4SmartResolution() to manually trigger the new Tier 4 AI.
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
    // 1. Dependency Check
    if (typeof processAIIndexing_Batch !== 'function') {
      throw new Error("Critical: ไม่พบฟังก์ชัน 'processAIIndexing_Batch' ใน Service_AutoPilot.gs");
    }


    // 2. Execution
    ss.toast("🚀 กำลังเริ่มระบบ AI Indexing (Batch Mode)...", "Debug System", 10);
    console.info("[Debug] Manual Trigger: processAIIndexing_Batch");
    
    // เรียกฟังก์ชันจาก Service_AutoPilot
    processAIIndexing_Batch(); 
    
    ui.alert(
      "✅ สั่งงานเรียบร้อย!\n" +
      "ระบบได้ประมวลผลข้อมูลชุดล่าสุดเสร็จสิ้น\n" +
      "กรุณาตรวจสอบคอลัมน์ Normalized ใน Database ว่ามี Tag '[AI]' หรือไม่"
    );
    
  } catch (e) {
    console.error("[Debug Error] forceRunAI_Now: " + e.message);
    ui.alert("❌ Error: " + e.message);
  }
}


/**
 * 🧠 [NEW v4.0] Manual Trigger: ทดสอบ Tier 4 Smart Resolution ทันที
 */
function debug_TestTier4SmartResolution() {
  var ui = SpreadsheetApp.getUi();
  try {
    if (typeof resolveUnknownNamesWithAI !== 'function') {
      throw new Error("Critical: ไม่พบฟังก์ชัน 'resolveUnknownNamesWithAI' ใน Service_Agent.gs");
    }
    
    var response = ui.alert("🧠 ยืนยันรันทดสอบ Tier 4", "ต้องการดึงรายชื่อที่ไม่มีพิกัดจากหน้า SCG Data\nไปให้ Gemini วิเคราะห์จับคู่กับ Master Database เลยหรือไม่?", ui.ButtonSet.YES_NO);
    
    if (response == ui.Button.YES) {
      console.info("[Debug] Manual Trigger: resolveUnknownNamesWithAI");
      resolveUnknownNamesWithAI();
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
 * 📡 Connection Test: ทดสอบคุยกับ Gemini (ไม่ยุ่งกับ Database)
 * ใช้เช็คว่า API Key ใช้งานได้จริงหรือไม่
 */
function debugGeminiConnection() {
  var ui = SpreadsheetApp.getUi();
  var apiKey;
  
  try {
    // [MODIFIED v4.0] Safe Getter Extraction
    apiKey = CONFIG.GEMINI_API_KEY;
  } catch (e) {
    ui.alert("❌ API Key Error", "กรุณาตั้งค่า API Key ผ่าน Setup_Security.gs ก่อนครับ\n(" + e.message + ")", ui.ButtonSet.OK);
    return;
  }


  var testWord = "SCG (Bang Sue Branch)";
  ui.alert("📡 กำลังทดสอบส่งข้อความหา Gemini...\nInput: " + testWord);
  
  try {
    console.info("[Debug] Pinging Gemini API...");
    
    // Fallback: ยิง API เองเพื่อ Isolate ปัญหา (จะได้รู้ว่าผิดที่ฟังก์ชันหรือ API)
    var model = (typeof CONFIG !== 'undefined' && CONFIG.AI_MODEL) ? CONFIG.AI_MODEL : "gemini-1.5-flash";
    var url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    var payload = { 
      "contents": [{ "parts": [{ "text": `Hello Gemini, test connection. Say "Connection Success" and reply with Thai translation of ${testWord}` }] }] 
    };
    var options = {
      "method": "post", "contentType": "application/json",
      "payload": JSON.stringify(payload), "muteHttpExceptions": true
    };
    
    var res = UrlFetchApp.fetch(url, options);
    
    if (res.getResponseCode() === 200) {
      var json = JSON.parse(res.getContentText());
      var text = (json.candidates && json.candidates[0].content) ? json.candidates[0].content.parts[0].text : "No Text Data";
      ui.alert("✅ API Ping Success!\n\nResponse:\n" + text);
      console.log("[Debug] Gemini API Connection: OK");
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
 * 🔄 Reset AI Tags: ล้าง Tag ระบบ AI เพื่อให้รันใหม่ (เฉพาะแถวที่เลือก)
 * [MODIFIED v4.0]: ล้างทั้ง [AI] และ [Agent_V4]
 */
function debug_ResetSelectedRowsAI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getActiveSheet();
  
  if (sheet.getName() !== CONFIG.SHEET_NAME) {
    ui.alert("⚠️ System Note", "กรุณาไฮไลต์เลือก Cell ในชีต Database เท่านั้นครับ", ui.ButtonSet.OK);
    return;
  }
  
  var range = sheet.getActiveRange();
  var startRow = range.getRow();
  var numRows = range.getNumRows();
  
  // ใช้ C_IDX ถ้ามี หรือ Fallback
  var colIndex = (typeof CONFIG !== 'undefined' && CONFIG.COL_NORMALIZED) ? CONFIG.COL_NORMALIZED : 6; 
  
  var targetRange = sheet.getRange(startRow, colIndex, numRows, 1);
  var values = targetRange.getValues();
  
  var resetCount = 0;
  for (var i = 0; i < values.length; i++) {
    var val = values[i][0] ? values[i][0].toString() : "";
    
    // ตรวจหา Tag ของ AI (ทั้งระบบเก่าและใหม่)
    if (val.indexOf("[AI]") !== -1 || val.indexOf("[Agent_") !== -1) {
      
      // ลบ Tags ออก (ทิ้งคำที่ AI เติมไว้ได้ หรือจะลบให้ว่างเลยก็ได้)
      // V4.0 เราเลือกลบแค่ตัว Tag ออกเพื่อให้ AI เข้ามาประมวลผลซ้ำ
      var cleanedVal = val
        .replace(" [AI]", "").replace("[AI]", "")
        .replace(/\[Agent_.*?\]/g, "") // ลบ Tag รูปแบบ [Agent_xxx] ทั้งหมด
        .trim();
        
      values[i][0] = cleanedVal; 
      resetCount++;
    }
  }
  
  if (resetCount > 0) {
    targetRange.setValues(values);
    ss.toast("🔄 Reset AI Status เรียบร้อย " + resetCount + " แถว", "Debug", 5);
    console.log(`[Debug] Reset AI tags for ${resetCount} rows.`);
  } else {
    ss.toast("ℹ️ ไม่พบรายการที่มี Tag AI ในส่วนที่คุณไฮไลต์เลือกไว้", "Debug", 5);
  }
}
```

---

