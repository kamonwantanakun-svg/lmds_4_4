# 📦 Logistics Master Data System V4.1 - 2

## 📄 ไฟล์: Service_Maintenance.gs
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
## 📄 ไฟล์: Service_Master.gs
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
## 📄 ไฟล์: Service_Notify.gs
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
## 📄 ไฟล์: Service_SCG.gs
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
## 📄 ไฟล์: Service_Search.gs
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
## 📄 ไฟล์: Setup_Security.gs
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
