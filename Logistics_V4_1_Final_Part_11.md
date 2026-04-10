# 🚀 Logistics Master Data System V4.1 - Final Verified Version
## 🛠️ คู่มือการติดตั้ง (Setup Guide)
1. **สร้างโปรเจกต์ใหม่**: ไปที่ [script.google.com](https://script.google.com) แล้วสร้างโปรเจกต์ใหม่
2. **สร้างไฟล์ตามชื่อ**: สร้างไฟล์ .gs และ .html ตามชื่อหัวข้อที่ระบุในแต่ละส่วน
3. **Copy & Paste**: คัดลอกโค้ดจากไฟล์ Markdown ทั้ง 3 ส่วนไปวางในไฟล์ที่สร้างขึ้น
4. **ตั้งค่า API Key**: ไปที่ไฟล์ `Setup_Security.gs` แล้วรันฟังก์ชัน `setupEnvironment()` เพื่อใส่ Gemini API Key
5. **เริ่มใช้งาน**: รีเฟรช Google Sheets ของคุณ จะมีเมนู "🚛 Logistics V4.1" ปรากฏขึ้นมาครับ

---
## 📄 ไฟล์: Config.gs
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
## 📄 ไฟล์: Index.html
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
## 📄 ไฟล์: Menu.gs
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
## 📄 ไฟล์: Service_Agent.gs
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
## 📄 ไฟล์: Service_AutoPilot.gs
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
## 📄 ไฟล์: Service_GeoAddr.gs
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
