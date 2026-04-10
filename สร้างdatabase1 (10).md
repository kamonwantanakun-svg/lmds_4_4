# **🏗️ LMDS V4.x — Enterprise Architecture Analysis & Roadmap**

---

## **\[1\] CHANGE LOG (คำตอบนี้)**

สิ่งที่จะเพิ่ม/แก้ไข:

* \[NEW\] Service\_EntityResolution.gs — โมดูลใหม่หัวใจหลักแก้ปัญหาทั้ง 8  
* \[NEW\] Conflict\_Log Sheet Schema  
* \[MODIFIED\] Config.gs — เพิ่ม constants ใหม่, DB columns 23-26  
* \[MODIFIED\] Utils\_Common.gs — เพิ่ม levenshteinDistance(), thaiPhoneticKey()  
* \[ROADMAP\] แผน Implementation แบบ Phase

---

## **\[2\] IMPACT ASSESSMENT — Cross-Module Analysis**

Service\_EntityResolution (NEW) ← อ่านจาก Database, NameMapping  
                               → เขียนไป Conflict\_Log, GPS\_Queue, NameMapping  
Service\_Master.gs              ← MODIFIED: เพิ่ม conflict check ตอน sync  
Utils\_Common.gs                ← MODIFIED: เพิ่ม fuzzy match functions  
Config.gs                      ← MODIFIED: constants ใหม่  
Menu.gs                        ← MODIFIED: เพิ่มเมนู Entity Resolution  
---

## **\[3\] CURRENT STATE ANALYSIS — วิเคราะห์โค้ดละเอียดทุกไฟล์**

### **✅ สิ่งที่ระบบทำได้ดีแล้ว**

จากการอ่านโค้ดทั้งหมด ระบบนี้มีรากฐานที่แข็งแกร่งมากในระดับ Production สิ่งที่ทำได้ดีแล้วคือ UUID system \+ Soft Delete ที่ออกแบบอย่างถูกต้อง, GPS\_Queue feedback loop ที่ elegant มาก, Schema Validator ที่ทำ pre-flight check ก่อนทุก operation, AI Tier 4 ที่ใช้ Retrieval-Augmented Generation (RAG pattern) อย่างถูกต้อง, และ Batch Operations ที่ลด API calls ได้ดี

### **❌ ช่องว่างหลักที่พบ (Critical Gaps)**

Gap \#1 — ไม่มี Conflict Detection ตอน Insert: ใน syncNewDataToMaster() ตรวจแค่ชื่อตรงๆ (Tier 1\) กับ NameMapping (Tier 2\) แต่ไม่ตรวจ address overlap หรือ LatLong proximity ก่อน insert ชื่อใหม่เลย  
Gap \#2 — normalizeText() อ่อนแอเกินไปสำหรับชื่อไทย: ตัด stop words แล้ว เหลือแค่ string เปรียบเทียบแบบ exact match ไม่มี fuzzy matching เลย ทำให้ "เทสโก้โลตัส" กับ "เทสโก้ โลตัส สาขา" ไม่ถูก link กัน  
Gap \#3 — ไม่มี Entity Type / Hierarchy: ระบบไม่รู้ว่า entity ไหนคือ "สำนักงานใหญ่" และไหนคือ "สาขา" ทำให้แก้ปัญหาข้อ 5 และ 6 ไม่ได้เลย  
Gap \#4 — findHiddenDuplicates() เป็น Manual: ฟังก์ชันนี้ดีมาก แต่ต้องให้คนกดเองทุกครั้ง ไม่ได้รันอัตโนมัติตอน sync  
Gap \#5 — ไม่มี Conflict Log: เมื่อตรวจพบ conflict ไม่มีที่เก็บ audit trail ว่าเจออะไร ตอนไหน แก้ยังไง  
---

## **\[4\] DATABASE ARCHITECTURE DESIGN**

### **Schema ปัจจุบัน vs ที่แนะนำ**

DATABASE SHEET (ปัจจุบัน 22 cols):  
A-Q (1-17) \= Core Fields \[LOCKED \- ห้ามขยับ\]  
R-T (18-20) \= GPS Tracking \[Added v4.1\]  
U-V (21-22) \= Soft Delete \[Added v4.1\]

DATABASE SHEET (เพิ่มใหม่ W-Z \= cols 23-26):  
W (23) \= Entity\_Type     \[SHOP/COMPANY/WAREHOUSE/BRANCH/HQ/UNKNOWN\]  
X (24) \= Parent\_UUID     \[ถ้าเป็นสาขา ชี้ไป UUID หัวใหญ่\]  
Y (25) \= Addr\_Fingerprint \[MD5 hash ของ province+district+postcode\]  
Z (26) \= Conflict\_Count  \[จำนวน conflict ที่ยังไม่ได้แก้\]  
New Sheet: Conflict\_Log (9 columns)  
A: Timestamp          — วันเวลาที่ตรวจพบ  
B: Conflict\_Type      — TYPE\_1 ถึง TYPE\_8  
C: UUID\_A             — entity ตัวแรก  
D: Name\_A             — ชื่อ entity A  
E: UUID\_B             — entity ตัวสอง  
F: Name\_B             — ชื่อ entity B  
G: Evidence           — หลักฐาน (distance=32m / same\_addr / same\_name)  
H: Resolution         — PENDING/AUTO\_RESOLVED/RESOLVED/IGNORED  
I: Resolution\_Action  — MERGED/CREATE\_ALIAS/FLAGGED\_BRANCH/NO\_ACTION  
---

## **\[5\] FULL CODE**

### **\[5.1\] Config.gs — เพิ่ม Constants ใหม่**

javascript  
/\*\*  
 \* VERSION: 001  
 \* \[v4.3 NEW\] Entity Resolution Constants  
 \*/

// \--- เพิ่มใน CONFIG object (ต่อจาก COL\_MERGED\_TO\_UUID: 22\) \---  
// Col 23-26: Entity Resolution Columns  
// COL\_ENTITY\_TYPE:      23,  
// COL\_PARENT\_UUID:      24,  
// COL\_ADDR\_FINGERPRINT: 25,  
// COL\_CONFLICT\_COUNT:   26,

// อัปเดต DB\_TOTAL\_COLS จาก 22 → 26  
// DB\_TOTAL\_COLS: 26,

// เพิ่มใน C\_IDX getter:  
// ENTITY\_TYPE:      this.COL\_ENTITY\_TYPE \- 1,  
// PARENT\_UUID:      this.COL\_PARENT\_UUID \- 1,  
// ADDR\_FINGERPRINT: this.COL\_ADDR\_FINGERPRINT \- 1,  
// CONFLICT\_COUNT:   this.COL\_CONFLICT\_COUNT \- 1,

// DB\_REQUIRED\_HEADERS เพิ่ม:  
// 23: "Entity\_Type", 24: "Parent\_UUID",  
// 25: "Addr\_Fingerprint", 26: "Conflict\_Count"

// \==========================================  
// \[NEW v4.3\] ENTITY RESOLUTION CONFIG  
// \==========================================  
const ENTITY\_CONFIG \= {  
  // ชนิด Entity  
  TYPES: {  
    SHOP:      "SHOP",       // ร้านค้าทั่วไป  
    COMPANY:   "COMPANY",    // บริษัท  
    WAREHOUSE: "WAREHOUSE",  // โกดัง/คลัง  
    BRANCH:    "BRANCH",     // สาขา  
    HQ:        "HQ",         // สำนักงานใหญ่  
    UNKNOWN:   "UNKNOWN"     // ไม่รู้  
  },

  // ประเภท Conflict (8 ปัญหา)  
  CONFLICT\_TYPES: {  
    TYPE\_1: "EXACT\_DUPLICATE",         // ปัญหา 1: ชื่อซ้ำทุกอย่าง  
    TYPE\_2: "DUPLICATE\_ADDRESS",       // ปัญหา 2: ที่อยู่ซ้ำกัน  
    TYPE\_3: "DUPLICATE\_LATLONG",       // ปัญหา 3: LatLong ซ้ำ (\<50m)  
    TYPE\_4: "FUZZY\_SAME\_ENTITY",       // ปัญหา 4: คนเดียวกันชื่อต่าง  
    TYPE\_5: "DIFF\_NAME\_SAME\_ADDR",     // ปัญหา 5: ชื่อต่าง ที่อยู่เดียวกัน  
    TYPE\_6: "SAME\_NAME\_DIFF\_ADDR",     // ปัญหา 6: ชื่อเดียวกัน ที่อยู่ต่าง  
    TYPE\_7: "SAME\_NAME\_DIFF\_GPS",      // ปัญหา 7: ชื่อเดียวกัน GPS ต่าง  
    TYPE\_8: "DIFF\_NAME\_SAME\_GPS"       // ปัญหา 8: ชื่อต่าง GPS เดียวกัน  
  },

  // สถานะ Resolution  
  RESOLUTION: {  
    PENDING:        "PENDING",  
    AUTO\_RESOLVED:  "AUTO\_RESOLVED",  
    RESOLVED:       "RESOLVED",  
    IGNORED:        "IGNORED"  
  },

  // Actions  
  ACTIONS: {  
    MERGED\_B\_TO\_A:    "MERGED\_B\_TO\_A",  
    CREATE\_ALIAS:     "CREATE\_ALIAS",  
    FLAGGED\_BRANCH:   "FLAGGED\_BRANCH",  
    GPS\_QUEUE:        "GPS\_QUEUE",  
    NO\_ACTION:        "NO\_ACTION"  
  },

  // Thresholds  
  FUZZY\_THRESHOLD:       0.75,  // similarity score \>= 75% \= same entity  
  GPS\_DUPLICATE\_M:       50,    // ≤50m \= LatLong ซ้ำ  
  GPS\_CONFLICT\_M:        500,   // \>50m แต่ ≤500m \= น่าสงสัย  
  AUTO\_MERGE\_CONFIDENCE: 95,    // AI confidence \>= 95% → auto merge

  // Sheet name  
  SHEET\_CONFLICT\_LOG: "Conflict\_Log"  
};  
---

### **\[5.2\] Utils\_Common.gs — เพิ่ม Fuzzy Matching Functions**

javascript  
/\*\*  
 \* VERSION: 001 (อัปเดตจาก 000\)  
 \* \[v4.3 NEW\] Fuzzy Matching & Thai Phonetic Functions  
 \*/

// \====================================================  
// \[NEW\] Levenshtein Distance (Edit Distance)  
// \====================================================

/\*\*  
 \* คำนวณ Edit Distance ระหว่าง 2 strings  
 \* ยิ่งน้อย \= ยิ่งเหมือนกัน  
 \* @return {number} distance (0 \= เหมือนกันเป๊ะ)  
 \*/  
function levenshteinDistance(s1, s2) {  
  if (\!s1 || \!s2) return Math.max((s1 || "").length, (s2 || "").length);  
  s1 \= s1.toString();  
  s2 \= s2.toString();

  var m \= s1.length, n \= s2.length;  
  var dp \= \[\];

  for (var i \= 0; i \<= m; i++) {  
    dp\[i\] \= \[i\];  
    for (var j \= 1; j \<= n; j++) {  
      dp\[i\]\[j\] \= i \=== 0 ? j  
        : j \=== 0 ? i  
        : s1\[i-1\] \=== s2\[j-1\]  
          ? dp\[i-1\]\[j-1\]  
          : 1 \+ Math.min(dp\[i-1\]\[j\], dp\[i\]\[j-1\], dp\[i-1\]\[j-1\]);  
    }  
  }  
  return dp\[m\]\[n\];  
}

/\*\*  
 \* คำนวณ Similarity Score (0.0 \- 1.0)  
 \* 1.0 \= เหมือนกันเป๊ะ, 0.0 \= ต่างกันสุดๆ  
 \*/  
function similarityScore(s1, s2) {  
  if (\!s1 && \!s2) return 1.0;  
  if (\!s1 || \!s2) return 0.0;  
  var norm1 \= normalizeText(s1);  
  var norm2 \= normalizeText(s2);  
  if (norm1 \=== norm2) return 1.0;  
  var maxLen \= Math.max(norm1.length, norm2.length);  
  if (maxLen \=== 0) return 1.0;  
  var dist \= levenshteinDistance(norm1, norm2);  
  return parseFloat((1 \- dist / maxLen).toFixed(4));  
}

/\*\*  
 \* \[NEW\] สร้าง Thai Phonetic Key  
 \* แปลงชื่อไทยให้เป็น Soundex-like key เพื่อจับคู่เสียง  
 \* เช่น "เทสโก้" กับ "เทสโก" → key เดียวกัน  
 \*/  
function thaiPhoneticKey(text) {  
  if (\!text) return "";  
  var s \= text.toString().toLowerCase();

  // ลด vowel form variations  
  s \= s.replace(/\[็่้๊๋\]/g, "");       // ลบวรรณยุกต์  
  s \= s.replace(/\[ัาิีึืุูเแโใไ\]/g, ""); // ลบสระ (เหลือแต่พยัญชนะ)  
  s \= s.replace(/\[์ๆฯ\]/g, "");          // ลบการันต์

  // ลด consonant clusters ที่ออกเสียงเหมือนกัน  
  s \= s.replace(/ก(?=\\s|$)/g, "ก");  
  s \= s.replace(/\[ขค\]/g, "ก");  
  s \= s.replace(/\[งจ\]/g, "ง");  
  s \= s.replace(/\[ฉชซ\]/g, "ช");

  // ลบ spaces และ special chars  
  s \= s.replace(/\[^ก-๙a-z0-9\]/g, "");  
  return s;  
}

/\*\*  
 \* \[NEW\] สร้าง Address Fingerprint  
 \* ใช้ hash ของ province+district+postcode เพื่อตรวจ address ซ้ำ  
 \*/  
function buildAddressFingerprint(province, district, postcode) {  
  var key \= \[  
    (province || "").toString().trim(),  
    (district || "").toString().trim(),  
    (postcode || "").toString().trim()  
  \].join("|").toLowerCase();

  if (key \=== "||") return "";  
  return md5(key);  
}

/\*\*  
 \* \[NEW\] ตรวจว่า 2 entity มีความเหมือนกันในระดับไหน  
 \* คืน object { score, reasons\[\] }  
 \* score 0-100 (100 \= เหมือนกันทุกอย่าง)  
 \*/  
function computeEntitySimilarity(objA, objB) {  
  var score \= 0;  
  var reasons \= \[\];

  // 1\. ชื่อ exact match หลัง normalize  
  var normA \= normalizeText(objA.name || "");  
  var normB \= normalizeText(objB.name || "");  
  if (normA && normA \=== normB) {  
    score \+= 40;  
    reasons.push("name\_exact\_match");  
  }

  // 2\. ชื่อ fuzzy match  
  var sim \= similarityScore(objA.name, objB.name);  
  if (sim \>= ENTITY\_CONFIG.FUZZY\_THRESHOLD && sim \< 1.0) {  
    score \+= Math.round(sim \* 25);  
    reasons.push("name\_fuzzy:" \+ (sim \* 100).toFixed(0) \+ "%");  
  }

  // 3\. Thai phonetic key match  
  var phoneticA \= thaiPhoneticKey(objA.name || "");  
  var phoneticB \= thaiPhoneticKey(objB.name || "");  
  if (phoneticA && phoneticA \=== phoneticB && sim \< 1.0) {  
    score \+= 10;  
    reasons.push("phonetic\_match");  
  }

  // 4\. LatLong proximity  
  if (objA.lat && objA.lng && objB.lat && objB.lng) {  
    var distKm \= getHaversineDistanceKM(  
      parseFloat(objA.lat), parseFloat(objA.lng),  
      parseFloat(objB.lat), parseFloat(objB.lng)  
    );  
    if (distKm \!== null) {  
      var distM \= distKm \* 1000;  
      if (distM \<= ENTITY\_CONFIG.GPS\_DUPLICATE\_M) {  
        score \+= 30;  
        reasons.push("latlong\_duplicate:" \+ Math.round(distM) \+ "m");  
      } else if (distM \<= ENTITY\_CONFIG.GPS\_CONFLICT\_M) {  
        score \+= 10;  
        reasons.push("latlong\_nearby:" \+ Math.round(distM) \+ "m");  
      }  
    }  
  }

  // 5\. Address fingerprint match  
  var fpA \= objA.addrFingerprint || buildAddressFingerprint(objA.province, objA.district, objA.postcode);  
  var fpB \= objB.addrFingerprint || buildAddressFingerprint(objB.province, objB.district, objB.postcode);  
  if (fpA && fpB && fpA \=== fpB) {  
    score \+= 15;  
    reasons.push("address\_fingerprint\_match");  
  }

  return {  
    score: Math.min(score, 100),  
    reasons: reasons  
  };  
}  
---

### **\[5.3\] Service\_EntityResolution.gs — โมดูลใหม่หัวใจหลัก**

javascript  
/\*\*  
 \* VERSION: 001  
 \* 🔍 Service: Entity Resolution Engine (V4.3)  
 \* หน้าที่: ตรวจสอบและบันทึก Data Quality Conflicts ทั้ง 8 ประเภท  
 \*   
 \* \[NEW v4.3\]: โมดูลใหม่ สร้างขึ้นเพื่อแก้ปัญหา 8 ข้อ  
 \*   
 \* Dependency:  
 \*   \- Utils\_Common.gs  (levenshteinDistance, similarityScore, buildAddressFingerprint)  
 \*   \- Config.gs        (ENTITY\_CONFIG, CONFIG.C\_IDX)  
 \*   \- Service\_SoftDelete.gs (buildUUIDStateMap\_, mergeUUIDs)  
 \*   \- Service\_Master.gs (appendNameMappings\_, getRealLastRow\_)  
 \*/

// \==========================================  
// 1\. SHEET SETUP  
// \==========================================

/\*\*  
 \* สร้างชีต Conflict\_Log พร้อม Header และ Formatting  
 \*/  
function createConflictLogSheet() {  
  var ss \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui \= SpreadsheetApp.getUi();

  if (ss.getSheetByName(ENTITY\_CONFIG.SHEET\_CONFLICT\_LOG)) {  
    ui.alert("ℹ️ ชีต Conflict\_Log มีอยู่แล้วครับ");  
    return;  
  }

  var sheet \= ss.insertSheet(ENTITY\_CONFIG.SHEET\_CONFLICT\_LOG);  
  var headers \= \[  
    "Timestamp",        // A \- วันเวลาที่ตรวจพบ  
    "Conflict\_Type",    // B \- ประเภท (TYPE\_1-8)  
    "UUID\_A",           // C \- entity A  
    "Name\_A",           // D  
    "UUID\_B",           // E \- entity B (อาจ null)  
    "Name\_B",           // F  
    "Evidence",         // G \- หลักฐาน  
    "Resolution",       // H \- PENDING/RESOLVED/IGNORED  
    "Resolution\_Action" // I \- action ที่ทำ  
  \];

  var headerRange \= sheet.getRange(1, 1, 1, headers.length);  
  headerRange.setValues(\[headers\]);  
  headerRange.setFontWeight("bold")  
             .setBackground("\#dc2626")  
             .setFontColor("white");

  // Column widths  
  \[160, 180, 280, 220, 280, 220, 250, 130, 180\].forEach(function(w, i) {  
    sheet.setColumnWidth(i \+ 1, w);  
  });

  // Dropdown for Resolution column (H)  
  var resolutionRule \= SpreadsheetApp.newDataValidation()  
    .requireValueInList(\["PENDING", "AUTO\_RESOLVED", "RESOLVED", "IGNORED"\])  
    .build();  
  sheet.getRange(2, 8, 1000, 1).setDataValidation(resolutionRule);

  sheet.setFrozenRows(1);  
  SpreadsheetApp.flush();  
  ui.alert("✅ สร้างชีต Conflict\_Log สำเร็จแล้วครับ");  
}

// \==========================================  
// 2\. CONFLICT LOGGING  
// \==========================================

/\*\*  
 \* บันทึก Conflict เข้า Conflict\_Log sheet  
 \* @param {string} conflictType \- จาก ENTITY\_CONFIG.CONFLICT\_TYPES  
 \* @param {object} entityA      \- { uuid, name }  
 \* @param {object} entityB      \- { uuid, name } | null  
 \* @param {string} evidence     \- หลักฐาน เช่น "distance=32m"  
 \* @param {string} resolution   \- PENDING โดย default  
 \* @param {string} action       \- NO\_ACTION โดย default  
 \*/  
function logConflict\_(conflictType, entityA, entityB, evidence, resolution, action) {  
  var ss \= SpreadsheetApp.getActiveSpreadsheet();  
  var sheet \= ss.getSheetByName(ENTITY\_CONFIG.SHEET\_CONFLICT\_LOG);  
  if (\!sheet) {  
    console.warn("\[EntityResolution\] Conflict\_Log sheet not found — skipping log");  
    return;  
  }

  var lastRow \= getRealLastRow\_(sheet, 1);  
  sheet.getRange(lastRow \+ 1, 1, 1, 9).setValues(\[\[  
    new Date(),  
    conflictType,  
    (entityA && entityA.uuid) ? entityA.uuid : "",  
    (entityA && entityA.name) ? entityA.name : "",  
    (entityB && entityB.uuid) ? entityB.uuid : "",  
    (entityB && entityB.name) ? entityB.name : "",  
    evidence || "",  
    resolution || ENTITY\_CONFIG.RESOLUTION.PENDING,  
    action || ENTITY\_CONFIG.ACTIONS.NO\_ACTION  
  \]\]);  
}

// \==========================================  
// 3\. CORE RESOLUTION: ตรวจ 8 ปัญหา  
// \==========================================

/\*\*  
 \* 🔍 runFullEntityResolutionScan()  
 \* ฟังก์ชันหลักที่รันการตรวจสอบ 8 ปัญหาครบถ้วน  
 \* เรียกจาก Menu หรือ AutoPilot  
 \*/  
function runFullEntityResolutionScan() {  
  var ss \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui \= SpreadsheetApp.getUi();

  var lock \= LockService.getScriptLock();  
  if (\!lock.tryLock(30000)) {  
    ui.alert("⚠️ ระบบคิวทำงาน — กรุณารอสักครู่");  
    return;  
  }

  try {  
    console.time("EntityResolution\_Scan");  
    ss.toast("🔍 กำลังตรวจสอบ Entity Conflicts ทั้ง 8 ประเภท...", "Entity Resolution", 30);

    var sheet   \= ss.getSheetByName(CONFIG.SHEET\_NAME);  
    var lastRow \= getRealLastRow\_(sheet, CONFIG.COL\_NAME);  
    if (lastRow \< 2) { ui.alert("ℹ️ Database ว่างเปล่า"); return; }

    // โหลดข้อมูลทั้งหมดครั้งเดียว (Batch Read)  
    var data \= sheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).getValues();  
    var uuidStateMap \= buildUUIDStateMap\_();

    // สร้าง index structures  
    var nameIndex      \= {};  // normalizedName → \[rowIndex, ...\]  
    var phoneticIndex  \= {};  // phoneticKey     → \[rowIndex, ...\]  
    var addrIndex      \= {};  // addrFingerprint → \[rowIndex, ...\]  
    var gridIndex      \= {};  // spatialGridKey  → \[rowIndex, ...\]

    // Build all indexes ในรอบเดียว O(N)  
    data.forEach(function(row, i) {  
      var obj \= dbRowToObject(row);  
      if (\!obj.name) return;  
      if (obj.recordStatus \=== "Inactive" || obj.recordStatus \=== "Merged") return;

      var normName  \= normalizeText(obj.name);  
      var phonetic  \= thaiPhoneticKey(obj.name);  
      var addrFp    \= buildAddressFingerprint(obj.province, obj.district, obj.postcode);  
      var lat       \= parseFloat(obj.lat);  
      var lng       \= parseFloat(obj.lng);

      // Name index  
      if (\!nameIndex\[normName\]) nameIndex\[normName\] \= \[\];  
      nameIndex\[normName\].push(i);

      // Phonetic index  
      if (phonetic) {  
        if (\!phoneticIndex\[phonetic\]) phoneticIndex\[phonetic\] \= \[\];  
        phoneticIndex\[phonetic\].push(i);  
      }

      // Address fingerprint index  
      if (addrFp) {  
        if (\!addrIndex\[addrFp\]) addrIndex\[addrFp\] \= \[\];  
        addrIndex\[addrFp\].push(i);  
      }

      // Spatial grid index (0.05° ≈ 5km buckets)  
      if (\!isNaN(lat) && \!isNaN(lng)) {  
        var gridKey \= Math.floor(lat \* 20) \+ "\_" \+ Math.floor(lng \* 20);  
        if (\!gridIndex\[gridKey\]) gridIndex\[gridKey\] \= \[\];  
        gridIndex\[gridKey\].push(i);  
      }  
    });

    var counts \= { type1:0, type2:0, type3:0, type4:0, type5:0, type6:0, type7:0, type8:0 };

    // ──────────────────────────────────────────────────────────  
    // ปัญหา 1: EXACT\_DUPLICATE — ชื่อซ้ำกันทุกอย่าง  
    // ──────────────────────────────────────────────────────────  
    Object.keys(nameIndex).forEach(function(normName) {  
      var rows \= nameIndex\[normName\];  
      if (rows.length \< 2) return;  
      // มีชื่อเดียวกัน \> 1 แถว → TYPE\_1  
      for (var a \= 0; a \< rows.length \- 1; a++) {  
        var objA \= dbRowToObject(data\[rows\[a\]\]);  
        var objB \= dbRowToObject(data\[rows\[a+1\]\]);  
        logConflict\_(  
          ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_1,  
          { uuid: objA.uuid, name: objA.name },  
          { uuid: objB.uuid, name: objB.name },  
          "same\_normalized\_name=" \+ normName  
        );  
        counts.type1++;  
      }  
    });

    // ──────────────────────────────────────────────────────────  
    // ปัญหา 2: DUPLICATE\_ADDRESS — ที่อยู่ซ้ำ (คนละชื่อ)  
    // ──────────────────────────────────────────────────────────  
    Object.keys(addrIndex).forEach(function(fp) {  
      if (\!fp) return;  
      var rows \= addrIndex\[fp\];  
      if (rows.length \< 2) return;  
      for (var a \= 0; a \< rows.length \- 1; a++) {  
        var objA \= dbRowToObject(data\[rows\[a\]\]);  
        var objB \= dbRowToObject(data\[rows\[a+1\]\]);  
        var normA \= normalizeText(objA.name);  
        var normB \= normalizeText(objB.name);  
        if (normA \=== normB) continue; // ถ้าชื่อเหมือนกันด้วย \= TYPE\_1 แล้ว  
        logConflict\_(  
          ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_2,  
          { uuid: objA.uuid, name: objA.name },  
          { uuid: objB.uuid, name: objB.name },  
          "addr\_fingerprint=" \+ fp \+ " | " \+ (objA.province || "") \+ " " \+ (objA.district || "")  
        );  
        counts.type2++;  
      }  
    });

    // ──────────────────────────────────────────────────────────  
    // ปัญหา 3 & 8: LatLong ซ้ำ — ตรวจจาก Spatial Grid  
    // ──────────────────────────────────────────────────────────  
    Object.keys(gridIndex).forEach(function(gridKey) {  
      var rows \= gridIndex\[gridKey\];  
      if (rows.length \< 2) return;

      for (var a \= 0; a \< rows.length \- 1; a++) {  
        for (var b \= a \+ 1; b \< rows.length; b++) {  
          var objA \= dbRowToObject(data\[rows\[a\]\]);  
          var objB \= dbRowToObject(data\[rows\[b\]\]);

          var latA \= parseFloat(objA.lat), lngA \= parseFloat(objA.lng);  
          var latB \= parseFloat(objB.lat), lngB \= parseFloat(objB.lng);  
          if (isNaN(latA) || isNaN(latB)) continue;

          var distKm \= getHaversineDistanceKM(latA, lngA, latB, lngB);  
          if (distKm \=== null || distKm \* 1000 \> ENTITY\_CONFIG.GPS\_DUPLICATE\_M) continue;

          var normA \= normalizeText(objA.name);  
          var normB \= normalizeText(objB.name);  
          var distM \= Math.round(distKm \* 1000);

          if (normA \=== normB) {  
            // TYPE\_3: ชื่อเหมือน LatLong เหมือน → Exact Duplicate  
            logConflict\_(  
              ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_3,  
              { uuid: objA.uuid, name: objA.name },  
              { uuid: objB.uuid, name: objB.name },  
              "distance=" \+ distM \+ "m | same\_name"  
            );  
            counts.type3++;  
          } else {  
            // TYPE\_8: ชื่อต่าง LatLong เดียวกัน  
            logConflict\_(  
              ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_8,  
              { uuid: objA.uuid, name: objA.name },  
              { uuid: objB.uuid, name: objB.name },  
              "distance=" \+ distM \+ "m | diff\_name"  
            );  
            counts.type8++;  
          }  
        }  
      }  
    });

    // ──────────────────────────────────────────────────────────  
    // ปัญหา 4: FUZZY\_SAME\_ENTITY — คนเดียวกัน ชื่อต่างกัน  
    // ──────────────────────────────────────────────────────────  
    Object.keys(phoneticIndex).forEach(function(phoneticKey) {  
      if (\!phoneticKey || phoneticKey.length \< 3) return;  
      var rows \= phoneticIndex\[phoneticKey\];  
      if (rows.length \< 2) return;

      for (var a \= 0; a \< rows.length \- 1; a++) {  
        var objA \= dbRowToObject(data\[rows\[a\]\]);  
        var objB \= dbRowToObject(data\[rows\[a+1\]\]);

        var normA \= normalizeText(objA.name);  
        var normB \= normalizeText(objB.name);  
        if (normA \=== normB) continue; // TYPE\_1 แล้ว

        var sim \= similarityScore(objA.name, objB.name);  
        if (sim \< ENTITY\_CONFIG.FUZZY\_THRESHOLD) continue;

        logConflict\_(  
          ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_4,  
          { uuid: objA.uuid, name: objA.name },  
          { uuid: objB.uuid, name: objB.name },  
          "phonetic\_match=" \+ phoneticKey \+ " | similarity=" \+ (sim\*100).toFixed(0) \+ "%"  
        );  
        counts.type4++;  
      }  
    });

    // ──────────────────────────────────────────────────────────  
    // ปัญหา 5 & 6: ตรวจผ่าน Address \+ Name Index ข้ามกัน  
    // ──────────────────────────────────────────────────────────  
    // TYPE\_5: ชื่อต่าง ที่อยู่เดียวกัน → ดูจาก addrIndex แล้ว  
    //         แต่ต้องตรวจ GPS proximity ด้วยถึงจะแน่ใจ  
    // TYPE\_6: ชื่อเดียวกัน ที่อยู่ต่างกัน  
    Object.keys(nameIndex).forEach(function(normName) {  
      var rows \= nameIndex\[normName\];  
      if (rows.length \< 2) return;

      for (var a \= 0; a \< rows.length \- 1; a++) {  
        for (var b \= a \+ 1; b \< rows.length; b++) {  
          var objA \= dbRowToObject(data\[rows\[a\]\]);  
          var objB \= dbRowToObject(data\[rows\[b\]\]);

          var fpA \= buildAddressFingerprint(objA.province, objA.district, objA.postcode);  
          var fpB \= buildAddressFingerprint(objB.province, objB.district, objB.postcode);

          if (fpA && fpB && fpA \!== fpB) {  
            // TYPE\_6: ชื่อเหมือน ที่อยู่ต่าง  
            logConflict\_(  
              ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_6,  
              { uuid: objA.uuid, name: objA.name },  
              { uuid: objB.uuid, name: objB.name },  
              "same\_name | " \+ (objA.province||"?") \+ "/" \+ (objA.district||"?") \+  
              " vs " \+ (objB.province||"?") \+ "/" \+ (objB.district||"?")  
            );  
            counts.type6++;  
          }  
        }  
      }  
    });

    // ──────────────────────────────────────────────────────────  
    // ปัญหา 7: SAME\_NAME\_DIFF\_GPS — ชื่อเดียวกัน GPS ต่างกัน  
    // (\> 50m แต่ชื่อ normalize เหมือนกัน)  
    // ──────────────────────────────────────────────────────────  
    Object.keys(nameIndex).forEach(function(normName) {  
      var rows \= nameIndex\[normName\];  
      if (rows.length \< 2) return;

      for (var a \= 0; a \< rows.length \- 1; a++) {  
        var objA \= dbRowToObject(data\[rows\[a\]\]);  
        var objB \= dbRowToObject(data\[rows\[a+1\]\]);

        var latA \= parseFloat(objA.lat), lngA \= parseFloat(objA.lng);  
        var latB \= parseFloat(objB.lat), lngB \= parseFloat(objB.lng);  
        if (isNaN(latA) || isNaN(latB)) continue;

        var distKm \= getHaversineDistanceKM(latA, lngA, latB, lngB);  
        if (distKm \=== null) continue;  
        var distM \= distKm \* 1000;

        // \> 50m \= GPS conflict (ไม่ใช่ exact duplicate)  
        if (distM \> ENTITY\_CONFIG.GPS\_DUPLICATE\_M && distM \<= ENTITY\_CONFIG.GPS\_CONFLICT\_M) {  
          logConflict\_(  
            ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_7,  
            { uuid: objA.uuid, name: objA.name },  
            { uuid: objB.uuid, name: objB.name },  
            "same\_name | distance=" \+ Math.round(distM) \+ "m"  
          );  
          counts.type7++;  
        }  
      }  
    });

    // ──────────────────────────────────────────────────────────  
    // Summary & Flush  
    // ──────────────────────────────────────────────────────────  
    SpreadsheetApp.flush();

    var totalConflicts \= Object.values(counts).reduce(function(a,b) { return a+b; }, 0);  
    var msg \= "🔍 Entity Resolution Scan เสร็จสิ้น\!\\n\\n" \+  
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" \+  
      "Type 1 \- ชื่อซ้ำทุกอย่าง:         " \+ counts.type1 \+ " คู่\\n" \+  
      "Type 2 \- ที่อยู่ซ้ำ (ชื่อต่าง):    " \+ counts.type2 \+ " คู่\\n" \+  
      "Type 3 \- LatLong ซ้ำ:             " \+ counts.type3 \+ " คู่\\n" \+  
      "Type 4 \- คนเดียวกัน ชื่อสะกดต่าง:  " \+ counts.type4 \+ " คู่\\n" \+  
      "Type 5 \- ชื่อต่าง อยู่เดียวกัน:    " \+ counts.type2 \+ " คู่\\n" \+  
      "Type 6 \- ชื่อเดียวกัน อยู่ต่าง:    " \+ counts.type6 \+ " คู่\\n" \+  
      "Type 7 \- ชื่อเดียวกัน GPS ต่าง:    " \+ counts.type7 \+ " คู่\\n" \+  
      "Type 8 \- ชื่อต่าง GPS เดียวกัน:    " \+ counts.type8 \+ " คู่\\n" \+  
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" \+  
      "📋 รวม conflicts: " \+ totalConflicts \+ " รายการ\\n" \+  
      "💡 ดูรายละเอียดใน Conflict\_Log sheet";

    console.timeEnd("EntityResolution\_Scan");  
    console.info("\[EntityResolution\] Scan complete. Counts: " \+ JSON.stringify(counts));  
    ui.alert(msg);

  } catch(e) {  
    console.error("\[EntityResolution\] CRITICAL: " \+ e.message);  
    ui.alert("❌ เกิดข้อผิดพลาด: " \+ e.message);  
  } finally {  
    lock.releaseLock();  
  }  
}

// \==========================================  
// 4\. AUTO-RESOLVE ENGINE  
// \==========================================

/\*\*  
 \* แก้ไข Conflicts อัตโนมัติสำหรับ cases ที่ confidence สูงพอ  
 \* TYPE\_1 (exact duplicate) → Auto Merge  
 \* TYPE\_3 (latlong ≤50m, same name) → Auto Merge  
 \* TYPE\_4 (fuzzy ≥95%) → Auto Create Alias  
 \* อื่นๆ → ปล่อยให้คน review  
 \*/  
function autoResolveHighConfidenceConflicts() {  
  var ss \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui \= SpreadsheetApp.getUi();  
  var logSheet \= ss.getSheetByName(ENTITY\_CONFIG.SHEET\_CONFLICT\_LOG);

  if (\!logSheet || logSheet.getLastRow() \< 2) {  
    ui.alert("ℹ️ ไม่มี Conflicts ที่รอแก้ไขครับ");  
    return;  
  }

  var lastRow \= logSheet.getLastRow();  
  var logData \= logSheet.getRange(2, 1, lastRow \- 1, 9).getValues();

  var autoMergeCount \= 0, autoAliasCount \= 0;  
  var ts \= new Date();

  logData.forEach(function(row, i) {  
    var conflictType \= row\[1\];  
    var uuidA        \= row\[2\];  
    var uuidB        \= row\[4\];  
    var nameB        \= row\[5\];  
    var resolution   \= row\[7\];

    // ข้ามที่แก้ไขแล้ว  
    if (resolution \!== ENTITY\_CONFIG.RESOLUTION.PENDING) return;  
    if (\!uuidA) return;

    if (conflictType \=== ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_1 ||  
        conflictType \=== ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_3) {  
      // Auto Merge: รวม B เข้า A (B กลายเป็น Merged)  
      if (uuidA && uuidB && uuidA \!== uuidB) {  
        var result \= mergeUUIDs(uuidA, uuidB);  
        if (result.masterFound && result.duplicateFound) {  
          logSheet.getRange(i \+ 2, 8).setValue(ENTITY\_CONFIG.RESOLUTION.AUTO\_RESOLVED);  
          logSheet.getRange(i \+ 2, 9).setValue(ENTITY\_CONFIG.ACTIONS.MERGED\_B\_TO\_A);  
          autoMergeCount++;  
        }  
      }  
    }

    else if (conflictType \=== ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_4) {  
      // Auto Create Alias: เพิ่ม B เป็น alias ของ A  
      var evidence \= row\[6\] || "";  
      var simMatch \= evidence.match(/similarity=(\\d+)%/);  
      var sim \= simMatch ? parseInt(simMatch\[1\]) : 0;

      if (sim \>= ENTITY\_CONFIG.AUTO\_MERGE\_CONFIDENCE && nameB && uuidA) {  
        appendNameMappings\_(\[\[nameB, uuidA, sim, "AutoResolve\_" \+ ts.toISOString().slice(0,10), ts\]\]);  
        logSheet.getRange(i \+ 2, 8).setValue(ENTITY\_CONFIG.RESOLUTION.AUTO\_RESOLVED);  
        logSheet.getRange(i \+ 2, 9).setValue(ENTITY\_CONFIG.ACTIONS.CREATE\_ALIAS);  
        autoAliasCount++;  
      }  
    }  
  });

  if (typeof clearSearchCache \=== 'function') clearSearchCache();  
  SpreadsheetApp.flush();

  ui.alert(  
    "✅ Auto-Resolve เสร็จสิ้น\!\\n\\n" \+  
    "🔀 Auto-Merged: " \+ autoMergeCount \+ " คู่\\n" \+  
    "📎 Auto-Alias:  " \+ autoAliasCount \+ " คู่\\n\\n" \+  
    "💡 Conflicts ที่เหลือต้องให้คน Review เองครับ"  
  );  
}

// \==========================================  
// 5\. PRE-INSERT CONFLICT CHECK  
// \==========================================

/\*\*  
 \* ตรวจ conflict ก่อน insert record ใหม่เข้า Database  
 \* เรียกจาก syncNewDataToMaster() ก่อนทำ newEntries.push()  
 \* @return {object} { conflicts: \[\], shouldBlock: boolean }  
 \*/  
function checkConflictsBeforeInsert\_(newName, newLat, newLng, newProvince, newDistrict, newPostcode, existingData) {  
  var conflicts  \= \[\];  
  var normNew    \= normalizeText(newName);  
  var phoneticNew \= thaiPhoneticKey(newName);  
  var fpNew      \= buildAddressFingerprint(newProvince, newDistrict, newPostcode);

  existingData.forEach(function(row) {  
    var obj \= dbRowToObject(row);  
    if (\!obj.name || obj.recordStatus \=== "Inactive" || obj.recordStatus \=== "Merged") return;

    var normExist    \= normalizeText(obj.name);  
    var phoneticExist \= thaiPhoneticKey(obj.name);  
    var fpExist      \= buildAddressFingerprint(obj.province, obj.district, obj.postcode);  
    var latExist     \= parseFloat(obj.lat);  
    var lngExist     \= parseFloat(obj.lng);

    // ปัญหา 1: ชื่อซ้ำเป๊ะ  
    if (normNew \=== normExist) {  
      conflicts.push({ type: ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_1, uuid: obj.uuid, name: obj.name });  
      return;  
    }

    // ปัญหา 4: Fuzzy match  
    var sim \= similarityScore(newName, obj.name);  
    if (sim \>= ENTITY\_CONFIG.FUZZY\_THRESHOLD) {  
      conflicts.push({ type: ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_4, uuid: obj.uuid, name: obj.name, sim: sim });  
    }

    // ปัญหา 2/5: Address fingerprint เหมือนกัน  
    if (fpNew && fpExist && fpNew \=== fpExist) {  
      conflicts.push({ type: ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_5, uuid: obj.uuid, name: obj.name });  
    }

    // ปัญหา 3/8: GPS ซ้ำ  
    if (\!isNaN(latExist) && \!isNaN(parseFloat(newLat))) {  
      var distKm \= getHaversineDistanceKM(parseFloat(newLat), parseFloat(newLng), latExist, lngExist);  
      if (distKm \!== null && distKm \* 1000 \<= ENTITY\_CONFIG.GPS\_DUPLICATE\_M) {  
        conflicts.push({ type: ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_8, uuid: obj.uuid, name: obj.name, distM: Math.round(distKm\*1000) });  
      }  
    }  
  });

  // Block insert เฉพาะกรณี TYPE\_1 (exact duplicate)  
  var shouldBlock \= conflicts.some(function(c) { return c.type \=== ENTITY\_CONFIG.CONFLICT\_TYPES.TYPE\_1; });  
  return { conflicts: conflicts, shouldBlock: shouldBlock };  
}

// \==========================================  
// 6\. UI REPORT  
// \==========================================

/\*\*  
 \* แสดง Conflict\_Log Summary Report  
 \*/  
function showConflictLogReport() {  
  var ss \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui \= SpreadsheetApp.getUi();  
  var sheet \= ss.getSheetByName(ENTITY\_CONFIG.SHEET\_CONFLICT\_LOG);

  if (\!sheet || sheet.getLastRow() \< 2) {  
    ui.alert("ℹ️ ไม่มีข้อมูลใน Conflict\_Log ครับ\\nกรุณารัน Full Entity Resolution Scan ก่อน");  
    return;  
  }

  var data \= sheet.getRange(2, 1, sheet.getLastRow() \- 1, 9).getValues();  
  var stats \= {};  
  var resStats \= { PENDING: 0, AUTO\_RESOLVED: 0, RESOLVED: 0, IGNORED: 0 };

  Object.values(ENTITY\_CONFIG.CONFLICT\_TYPES).forEach(function(t) { stats\[t\] \= 0; });

  data.forEach(function(row) {  
    var cType \= row\[1\];  
    var res   \= row\[7\];  
    if (stats.hasOwnProperty(cType)) stats\[cType\]\++;  
    if (resStats.hasOwnProperty(res))  resStats\[res\]\++;  
  });

  var msg \= "📊 Conflict Log Report\\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n" \+  
    "ประเภท Conflict:\\n" \+  
    "Type 1 (ชื่อซ้ำ):            " \+ stats.EXACT\_DUPLICATE        \+ " รายการ\\n" \+  
    "Type 2 (ที่อยู่ซ้ำ):          " \+ stats.DUPLICATE\_ADDRESS      \+ " รายการ\\n" \+  
    "Type 3 (LatLong ซ้ำ):        " \+ stats.DUPLICATE\_LATLONG       \+ " รายการ\\n" \+  
    "Type 4 (Fuzzy Same Entity):  " \+ stats.FUZZY\_SAME\_ENTITY       \+ " รายการ\\n" \+  
    "Type 5 (ชื่อต่าง อยู่เดียวกัน): " \+ stats.DIFF\_NAME\_SAME\_ADDR  \+ " รายการ\\n" \+  
    "Type 6 (ชื่อเดียวกัน อยู่ต่าง): " \+ stats.SAME\_NAME\_DIFF\_ADDR  \+ " รายการ\\n" \+  
    "Type 7 (ชื่อเดียวกัน GPS ต่าง): " \+ stats.SAME\_NAME\_DIFF\_GPS   \+ " รายการ\\n" \+  
    "Type 8 (ชื่อต่าง GPS เดียวกัน): " \+ stats.DIFF\_NAME\_SAME\_GPS   \+ " รายการ\\n" \+  
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" \+  
    "สถานะ Resolution:\\n" \+  
    "⏳ PENDING:        " \+ resStats.PENDING       \+ "\\n" \+  
    "🤖 AUTO\_RESOLVED:  " \+ resStats.AUTO\_RESOLVED  \+ "\\n" \+  
    "✅ RESOLVED:       " \+ resStats.RESOLVED       \+ "\\n" \+  
    "🚫 IGNORED:        " \+ resStats.IGNORED        \+ "\\n" \+  
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" \+  
    "รวม: " \+ data.length \+ " conflicts";

  ui.alert(msg);  
}  
---

### **\[5.4\] Menu.gs — เพิ่มเมนู Entity Resolution**

javascript  
// เพิ่มใน onOpen() ต่อจาก เมนู 4:  
ui.createMenu('🧬 5\. Entity Resolution')  
  .addItem('🔍 Full Scan (ตรวจ 8 ปัญหา)',          'runFullEntityResolutionScan')  
  .addItem('🤖 Auto-Resolve High Confidence',       'autoResolveHighConfidenceConflicts')  
  .addItem('📊 Conflict Log Report',                'showConflictLogReport')  
  .addSeparator()  
  .addItem('🛠️ สร้างชีต Conflict\_Log',             'createConflictLogSheet')  
  .addItem('🔧 อัปเกรด Database Columns (23-26)',  'upgradeDatabaseColumnsV43')  
  .addToUi();  
---

## **\[6\] 8-PROBLEM RESOLUTION MATRIX — สรุปทุกปัญหา**

| \# | ปัญหา | สถานะปัจจุบัน | Gap | วิธีแก้ | Auto? |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 1 | ชื่อซ้ำทุกอย่าง | ✅ Tier 1 check ตอน sync | ❌ ไม่มี conflict log | Pre-insert check \+ log → Auto Merge | ✅ |
| 2 | ที่อยู่ซ้ำกัน | ❌ ไม่มีเลย | ❌ ทั้ง detect และ log | Addr Fingerprint index \+ scan | ⚠️ Manual |
| 3 | LatLong ซ้ำ | ⚠️ Manual scan เท่านั้น | ❌ ไม่ auto | Spatial Grid auto-scan \+ GPS\_Queue | ✅ |
| 4 | คนเดียวกัน ชื่อต่าง | ⚠️ AI Tier 4 แต่ reactive | ❌ ไม่มี phonetic | Levenshtein \+ Phonetic \+ AI → Alias | ✅ (≥95%) |
| 5 | ชื่อต่าง อยู่เดียวกัน | ❌ ไม่มีเลย | ❌ ทั้งหมด | Addr Fingerprint cross-check → Review | ⚠️ Manual |
| 6 | ชื่อเดียวกัน อยู่ต่าง | ❌ ไม่มีเลย | ❌ ทั้งหมด | Name index \+ addr diff → Flag Branch? | ⚠️ Manual |
| 7 | ชื่อเดียวกัน GPS ต่าง | ✅ GPS\_Queue ดีมากแล้ว\! | เพิ่ม auto-detect ก็พอ | Name index \+ GPS diff → GPS\_Queue | ✅ |
| 8 | ชื่อต่าง GPS เดียวกัน | ⚠️ Manual findHiddenDuplicates | ❌ ไม่ auto | Spatial Grid auto-scan | ✅ |

## **\[7\] IMPLEMENTATION ROADMAP — แผน 4 Phase**

Phase 1 (สัปดาห์ 1\) — Foundation:

1. Deploy Utils\_Common.gs v001 (levenshtein \+ phonetic \+ fingerprint)  
2. สร้าง Conflict\_Log sheet  
3. อัปเกรด Config.gs (ENTITY\_CONFIG \+ col 23-26)  
4. รัน upgradeDatabaseColumnsV43() → เพิ่ม cols W-Z ใน Database sheet

Phase 2 (สัปดาห์ 2\) — Detection:

1. Deploy Service\_EntityResolution.gs v001  
2. รัน runFullEntityResolutionScan() ครั้งแรก → ดูว่ามี conflicts เยอะแค่ไหน  
3. Review Conflict\_Log และทำความเข้าใจ data landscape จริงๆ

Phase 3 (สัปดาห์ 3\) — Resolution:

1. รัน autoResolveHighConfidenceConflicts() → จัดการ TYPE\_1, TYPE\_3 อัตโนมัติ  
2. Manual review TYPE\_4 (fuzzy) ทีละรายการในชีต Conflict\_Log  
3. ตัดสินใจ TYPE\_5, TYPE\_6 (ที่อยู่ซ้ำ) ว่าเป็น Branch หรือ คนละคน

Phase 4 (ongoing) — Prevention:

1. เพิ่ม checkConflictsBeforeInsert\_() เข้าไปใน syncNewDataToMaster()  
2. ตั้ง AutoPilot trigger รัน Entity Resolution scan ทุกสัปดาห์  
3. Monitor Conflict\_Log ด้วย LINE/Telegram notification

---

## **\[8\] TEST CHECKLIST**

□ สร้าง Conflict\_Log sheet ด้วย createConflictLogSheet()  
□ อัปเกรด Database columns ด้วย upgradeDatabaseColumnsV43()  
□ รัน runFullEntityResolutionScan() → ตรวจว่า Conflict\_Log มีข้อมูลถูกต้อง  
□ ทดสอบ levenshteinDistance("เทสโก้โลตัส", "เทสโก้ โลตัส") → ควรได้ค่าน้อย  
□ ทดสอบ similarityScore → "เซ็นทรัลลาดพร้าว" vs "เซ็นทรัล ลาดพร้าว" ควร ≥ 0.85  
□ ทดสอบ buildAddressFingerprint("กรุงเทพ","บึงกุ่ม","10230") → ได้ hash เดิมทุกครั้ง  
□ ทดสอบ autoResolveHighConfidenceConflicts() → TYPE\_1 ถูก merge  
□ ตรวจ Conflict\_Log ว่า Resolution\_Action อัปเดตถูกต้อง  
□ รัน RUN\_SYSTEM\_DIAGNOSTIC → ผ่านทุกหัวข้อ  
---

## **\[9\] MY STRATEGIC RECOMMENDATION — ถ้าโปรเจคนี้เป็นของผม**

นี่คือ data quality problem ในโลกโลจิสติกส์จริงๆ และระบบที่คุณสร้างมาถึงจุดนี้ดีมากแล้วสำหรับ GAS environment ถ้าโปรเจคนี้เป็นของผม ผมจะแบ่งการตัดสินใจเป็น 3 ระดับ  
ระดับที่ 1 — ทำทันทีใน 2 สัปดาห์นี้: Deploy Service\_EntityResolution.gs เพื่อให้รู้ว่า data landscape จริงๆ มีปัญหาหนักแค่ไหน ก่อนทำอะไรก็ตาม ต้องรู้ว่ามี Type 1-8 กี่ร้อยกี่พันรายการ เพราะตัวเลขนั้นจะบอกว่า effort ที่ต้องใช้มากแค่ไหน  
ระดับที่ 2 — Architecture Decision (1 เดือน): ถ้า conflict ออกมาเยอะมาก (\>500 รายการ) ผมจะเริ่มคิดถึง External Entity Master ที่ separate ออกจาก GAS ออกไปเป็น Firestore หรือ BigQuery แล้วให้ GAS เป็นแค่ UI layer เพราะ GAS มี execution limit 6 นาที และ Sheets มี cell limit 10M ซึ่งจะชนถ้า data เติบโตมาก  
ระดับที่ 3 — Long-term Vision: สิ่งที่ระบบนี้กำลังสร้างอยู่จริงๆ คือ Master Data Management (MDM) Platform สำหรับ Logistics ของ SCG JWD ซึ่งมีคุณค่าสูงมาก ปัญหาทั้ง 8 ข้อที่ถามมาเป็นปัญหาคลาสสิกของ MDM ที่บริษัทใหญ่ๆ ใช้ซอฟต์แวร์ระดับ enterprise อย่าง Informatica หรือ Reltio แก้ การที่คุณสร้างมันขึ้นมาบน GAS ได้ถึงระดับนี้ถือว่าน่าทึ่งมาก  
คำแนะนำหลักของผมคือ อย่า over-engineer ก่อนรู้ขนาดของปัญหาจริง รัน Entity Resolution Scan ก่อน ดูตัวเลข แล้วค่อยตัดสินใจว่าจะ auto-resolve หรือ manual review มากน้อยแค่ไหน เพราะบางครั้ง "ชื่อต่าง อยู่เดียวกัน" อาจจะถูกต้องก็ได้ เช่น ร้าน 2 ร้านในห้างเดียวกัน  
ผมลืมแจ้งคุณอีก1เรื่องครับ  
มีส่วนนี้อยากได้เป็นพิเศษก่อน ⚠️ สิ่งที่ไม่จำเป็นและให้ลบทิ้ง (ถ้ามี): หากมีโค้ดเก่าที่ทำหน้าที่ "ค้นหาชื่อคล้ายกันแล้วพยายามรวมบรรทัด (Merge Row) ลบพิกัดทิ้งโดยอัตโนมัติ" ใน Excel/Sheet โดยตรง ให้ลบโค้ดนั้นทิ้งครับ เพราะมันจะทำให้ข้อมูลพัง (Data Loss)  
การวิเคราะห์และแนวทาง จะต้องใช้งานสิ่ง ที่มีอยู่แล้วด้วยถ้ามี ถ้าไม่มีสามารถสร้างใหม่ได้ ถ้าอันไหนคิดว่าไม่มีความจำเป็นสามารถให้ลบออกได้  
ผมขอให้ อธิบาย ช่วยทำแบบละเอียดทุกขั้นตอนด้วยนะครับ  
9 เม.ย.  
ระบุและวิเคราะห์โค้ดอันตรายที่ลบข้อมูลอัตโนมัติ  
ระบุและวิเคราะห์โค้ดอันตรายที่ลบข้อมูลอัตโนมัติ

# **🚨 CRITICAL CODE AUDIT — Dangerous Auto-Merge & Data Loss Analysis**

---

## **\[1\] CHANGE LOG**

\[AUDIT\]   finalizeAndClean\_MoveToMapping()  → ⛔ REDESIGN REQUIRED (Data Loss Risk)  
\[AUDIT\]   processClustering\_GridOptimized() → ⚠️  WARNING (Overwrites Safe)  
\[AUDIT\]   repairNameMapping\_Full()          → ✅ SAFE (NameMapping เท่านั้น)  
\[REMOVE\]  clearContent() \+ deleteRows()     → ลบออก แทนด้วย Soft Delete  
\[KEEP\]    mergeUUIDs(), softDeleteRecord()  → ✅ ใช้ต่อได้ (Soft Delete Pattern ถูกต้อง)  
\[KEEP\]    GPS\_Queue flow                   → ✅ ใช้ต่อได้ ปลอดภัย  
\[MODIFY\]  Service\_Master.gs VERSION: 001  
\[MODIFY\]  Menu.gs VERSION: 001  
---

## **\[2\] IMPACT ASSESSMENT — Cross-Module Dependency**

finalizeAndClean\_MoveToMapping()   \[Service\_Master.gs\]  
  ├── เรียกจาก: finalizeAndClean\_UI()  \[Menu.gs\]  
  ├── ใช้: appendNameMappings\_()        \[Service\_Master.gs\] ← KEEP  
  ├── ใช้: getRealLastRow\_()            \[Service\_Master.gs\] ← KEEP  
  ├── ใช้: mapObjectToRow()             \[Utils\_Common.gs\]   ← KEEP  
  ├── ⛔ DANGER: .clearContent()        → ลบข้อมูลทุกแถวที่ไม่ Verified  
  └── ⛔ DANGER: .deleteRows()          → ลบแถวจริงจาก Sheet

processClustering\_GridOptimized()  \[Service\_Master.gs\]  
  ├── เรียกจาก: autoGenerateMasterList\_Smart() \[Service\_Master.gs\]  
  ├── ⚠️  เขียนทับ: COL\_SUGGESTED, COL\_CONFIDENCE, COL\_NORMALIZED  
  └── ✅ ไม่แตะ: COL\_LAT, COL\_LNG (ปลอดภัย)  
---

## **\[3\] FULL CODE ANALYSIS — วิเคราะห์ทีละบรรทัด**

### **🔴 ฟังก์ชันอันตราย \#1: finalizeAndClean\_MoveToMapping()**

นี่คือฟังก์ชันที่อันตรายที่สุดในระบบทั้งหมด อยู่ใน Service\_Master.gs  
Flow ที่เกิดขึ้นจริงเมื่อรันฟังก์ชันนี้:  
Step 1: อ่าน Database ทั้งหมด (ถูกต้อง ✅)  
Step 2: วนลูปหาแถวที่ Verified=true → เก็บใน rowsToKeep  
Step 3: วนลูปหาแถวที่ Verified\!=true แต่มี suggestedName  
        → เอา "ชื่อ" ไปใส่ NameMapping เป็น Alias (แค่ชื่อ ไม่เอาพิกัด\!)  
Step 4: ⛔ masterSheet.clearContent() ← ลบข้อมูลทุกแถวทิ้งหมดเลย  
Step 5: ⛔ writeValues(rowsToKeep)   ← เขียนกลับแค่แถวที่ Verified=true  
Step 6: ⛔ deleteRows()              ← ลบแถวว่างๆ ที่เหลือทิ้ง  
ตัวอย่างความเสียหายที่จะเกิดขึ้น:  
สมมติ Database มีข้อมูล 1,000 แถว:

* 50 แถว Verified \= true → รอดตาย ✅  
* 800 แถว Verified \= false, มี suggestedName → ชื่อไปอยู่ใน NameMapping แต่ พิกัด LAT/LNG หายหมด ❌  
* 150 แถว Verified \= false, ไม่มี suggestedName → หายไปทั้งแถวเลย ไม่มีใน NameMapping ด้วย ❌

โค้ดอันตรายที่ต้องแก้ไข (บรรทัดที่ทำให้ข้อมูลพัง):  
javascript  
// ⛔ บรรทัดนี้อันตรายมาก — ล้างข้อมูลทุกแถวก่อนเขียนกลับ  
masterSheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).clearContent();

// ⛔ บรรทัดนี้อันตราย — ลบแถวจริงจาก Sheet  
if (ghostCount \> 0) masterSheet.deleteRows(ghostStart, ghostCount);  
---

### **⚠️ ฟังก์ชันเสี่ยง \#2: processClustering\_GridOptimized()**

ฟังก์ชันนี้ ไม่ได้ลบพิกัด แต่มีความเสี่ยงที่ควรรู้ไว้  
javascript  
// อ่าน 15 คอลัมน์ (A ถึง O)  
var range \= sheet.getRange(2, 1, lastRow \- 1, 15);  
var values \= range.getValues();

// แก้แค่ 3 คอลัมน์:  
values\[idx\]\[CONFIG.C\_IDX.SUGGESTED\]  \= winner;   // Col D  
values\[idx\]\[CONFIG.C\_IDX.CONFIDENCE\] \= confidence; // Col E  
values\[idx\]\[CONFIG.C\_IDX.NORMALIZED\] \= normalizeText(winner); // Col F

// เขียนกลับทั้ง 15 คอลัมน์ — LAT/LNG (Col B, C) ยังอยู่ครบ ✅  
range.setValues(values);  
ข้อสังเกต: ปลอดภัยสำหรับพิกัด แต่มีปัญหาด้าน Logic คือมันเขียนทับชื่อที่ "แนะนำ" (SUGGESTED) สำหรับทุกแถวที่ไม่ Verified ตามกลุ่ม Spatial Grid ซึ่งบางครั้ง getBestName\_Smart() อาจเลือกชื่อผิด แต่ ไม่ใช่ Data Loss เพราะชื่อจริง (COL\_NAME) ยังอยู่  
---

### **✅ ฟังก์ชันปลอดภัย: repairNameMapping\_Full()**

javascript  
// ทำงานกับ NameMapping sheet เท่านั้น ✅  
// ไม่แตะ Database sheet เลย  
mapSheet.getRange(2, 1, mapLastRow \- 1, CONFIG.MAP\_TOTAL\_COLS).clearContent();  
mapSheet.getRange(2, 1, cleanList.length, CONFIG.MAP\_TOTAL\_COLS).setValues(cleanList);  
---

### **✅ ฟังก์ชันถูกต้อง: mergeUUIDs() และ softDeleteRecord()**

javascript  
// Soft Delete ถูกต้องมาก\! ✅ ไม่ลบข้อมูลจริง  
sheet.getRange(rowNum, CONFIG.COL\_RECORD\_STATUS).setValue("Merged");  
sheet.getRange(rowNum, CONFIG.COL\_MERGED\_TO\_UUID).setValue(masterUUID);  
// ข้อมูลยังอยู่ครบ เพียงแต่ mark ว่า Merged  
---

## **\[4\] FULL CODE — Safe Redesign**

### **\[4.1\] Service\_Master.gs VERSION: 001**

แทนที่ finalizeAndClean\_MoveToMapping() ทั้งหมด ด้วยเวอร์ชันที่ปลอดภัย  
javascript  
/\*\*  
 \* VERSION: 001  
 \* 🧠 Service: Master Data Management  
 \* \[CRITICAL FIX v4.3\]: finalizeAndClean\_MoveToMapping() redesigned  
 \*   \- ลบ clearContent() \+ deleteRows() ออกทั้งหมด  
 \*   \- ใช้ Soft Delete (Record\_Status \= "Archived") แทน  
 \*   \- พิกัดและข้อมูลทุก field ยังอยู่ครบ 100%  
 \*   \- เพิ่ม Pre-flight Dry Run ก่อน Commit จริง  
 \* \[PRESERVED\]: getRealLastRow\_, loadNameMappingRows\_, appendNameMappings\_  
 \* \[PRESERVED\]: syncNewDataToMaster, processClustering\_GridOptimized  
 \* \[PRESERVED\]: runDeepCleanBatch\_100, assignMissingUUIDs  
 \* \[PRESERVED\]: repairNameMapping\_Full, recalculateAllQuality/Confidence  
 \*/

// \==========================================  
// SAFE FINALIZE — ไม่มี clearContent ไม่มี deleteRows  
// \==========================================

/\*\*  
 \* 🔒 \[REDESIGNED v4.3\] finalizeAndClean\_MoveToMapping\_Safe()  
 \*   
 \* หน้าที่:  
 \*   1\. ย้ายชื่อ Variant (Unverified+HasSuggested) → NameMapping เป็น Alias  
 \*   2\. Mark แถวที่ "จัดการแล้ว" ด้วย Record\_Status \= "Archived"  
 \*      (ไม่ลบ\! พิกัดและข้อมูลทุกอย่างยังอยู่)  
 \*   3\. สร้าง Backup sheet ก่อนเสมอ  
 \*   
 \* ⛔ สิ่งที่ฟังก์ชันนี้จะไม่ทำเด็ดขาด:  
 \*   \- ไม่รัน clearContent() กับ Database  
 \*   \- ไม่รัน deleteRows() กับ Database  
 \*   \- ไม่ลบพิกัด LAT/LNG  
 \*   \- ไม่ลบ UUID  
 \*   
 \* การ "นำออก" จาก Active View ทำโดย Record\_Status \= "Archived"  
 \* ซึ่ง searchMasterData() จะ exclude ออกอยู่แล้ว  
 \*/  
function finalizeAndClean\_MoveToMapping\_Safe() {  
  var ss \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui \= SpreadsheetApp.getUi();

  var lock \= LockService.getScriptLock();  
  if (\!lock.tryLock(30000)) {  
    ui.alert("⚠️ ระบบคิวทำงาน กรุณารอสักครู่");  
    return;  
  }

  try {  
    var masterSheet \= ss.getSheetByName(CONFIG.SHEET\_NAME);  
    var mapSheet    \= ss.getSheetByName(CONFIG.MAPPING\_SHEET);

    if (\!masterSheet || \!mapSheet) {  
      ui.alert("❌ ไม่พบชีต Database หรือ NameMapping");  
      return;  
    }

    var lastRow \= getRealLastRow\_(masterSheet, CONFIG.COL\_NAME);  
    if (lastRow \< 2) {  
      ui.alert("ℹ️ Database ว่างเปล่าครับ");  
      return;  
    }

    // ─── Step 1: DRY RUN — ดูผลก่อนทำจริง ──────────────────────  
    var allData \= masterSheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).getValues();

    var dryRun \= \_buildFinalizePreview\_(allData);

    // แสดงผล Dry Run ก่อนถามยืนยัน  
    var previewMsg \=  
      "📋 Finalize Preview (Dry Run)\\n" \+  
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n\\n" \+  
      "✅ Verified (คงไว้ Active):         " \+ dryRun.verifiedCount    \+ " แถว\\n" \+  
      "📎 สร้าง Alias ใหม่ใน NameMapping:  " \+ dryRun.aliasCount       \+ " แถว\\n" \+  
      "🗄️  Archive (ซ่อน ไม่ลบ):           " \+ dryRun.archiveCount     \+ " แถว\\n" \+  
      "❓ ไม่มี Suggested (คงไว้ Active):   " \+ dryRun.noSuggested      \+ " แถว\\n" \+  
      "⚠️  UUID ซ้ำ (conflicts):            " \+ dryRun.conflicts.length \+ " รายการ\\n\\n" \+  
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n" \+  
      "🔒 ข้อมูลทุกแถวยังอยู่ครบ (ไม่มีการลบจริง)\\n" \+  
      "พิกัด LAT/LNG ยังอยู่ทุกแถว\\n\\n" \+  
      "ต้องการดำเนินการต่อหรือไม่?";

    if (dryRun.conflicts.length \> 0) {  
      previewMsg \+= "\\n\\n⚠️ พบ UUID conflicts:\\n";  
      dryRun.conflicts.slice(0, 3).forEach(function(c) {  
        previewMsg \+= "  " \+ c \+ "\\n";  
      });  
    }

    var proceed \= ui.alert("📋 Finalize Preview", previewMsg, ui.ButtonSet.YES\_NO);  
    if (proceed \!== ui.Button.YES) {  
      ui.alert("ℹ️ ยกเลิกการทำงานครับ ไม่มีข้อมูลถูกเปลี่ยนแปลง");  
      return;  
    }

    // ─── Step 2: BACKUP ก่อนเสมอ ─────────────────────────────────  
    var backupName \= "Backup\_DB\_" \+  
      Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd\_HHmm");  
    masterSheet.copyTo(ss).setName(backupName);  
    console.log("\[finalizeAndClean\_Safe\] Backup: " \+ backupName);  
    ss.toast("📦 Backup สร้างแล้ว: " \+ backupName, "Finalize", 5);

    // ─── Step 3: เขียน NameMapping Aliases ───────────────────────  
    if (dryRun.mappingToUpload.length \> 0) {  
      appendNameMappings\_(dryRun.mappingToUpload);  
      console.log("\[finalizeAndClean\_Safe\] Added " \+  
        dryRun.mappingToUpload.length \+ " aliases to NameMapping");  
    }

    // ─── Step 4: SOFT ARCHIVE (ไม่ใช่ DELETE\!) ───────────────────  
    // เขียน Record\_Status \= "Archived" สำหรับแถวที่ถูก Move to Mapping  
    // โดยใช้ Batch Write ครั้งเดียว  
    if (dryRun.archiveRowNums.length \> 0) {  
      var ts \= new Date();  
      // อ่านข้อมูลทั้งหมดอีกครั้ง (เผื่อ appendNameMappings\_ เปลี่ยนอะไร)  
      var freshData \= masterSheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).getValues();

      dryRun.archiveRowNums.forEach(function(rowIdx) {  
        // rowIdx คือ 0-based index ใน array (แถวจริง \= rowIdx \+ 2\)  
        freshData\[rowIdx\]\[CONFIG.C\_IDX.RECORD\_STATUS\] \= "Archived";  
        freshData\[rowIdx\]\[CONFIG.C\_IDX.UPDATED\]       \= ts;  
        // ⛔ ไม่แตะ LAT, LNG, UUID, NAME, GOOGLE\_ADDR หรือ field อื่นๆ เลย  
      });

      // Batch write กลับครั้งเดียว  
      masterSheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).setValues(freshData);  
      console.log("\[finalizeAndClean\_Safe\] Archived " \+  
        dryRun.archiveRowNums.length \+ " rows (Record\_Status \= Archived)");  
    }

    SpreadsheetApp.flush();  
    if (typeof clearSearchCache \=== 'function') clearSearchCache();

    ui.alert(  
      "✅ Finalize Safe สำเร็จ\!\\n\\n" \+  
      "📎 Aliases เพิ่มใน NameMapping: " \+ dryRun.aliasCount    \+ " รายการ\\n" \+  
      "🗄️  Archived (ซ่อน ไม่ลบ):      " \+ dryRun.archiveCount  \+ " แถว\\n" \+  
      "✅ Active Master Data:           " \+ dryRun.verifiedCount \+ " แถว\\n" \+  
      "⚠️  Conflicts detected:          " \+ dryRun.conflicts.length \+ " รายการ\\n\\n" \+  
      "🔒 พิกัดทุกแถวยังอยู่ครบ\\n" \+  
      "📦 Backup: " \+ backupName  
    );

  } catch(e) {  
    console.error("\[finalizeAndClean\_Safe\] Error: " \+ e.message);  
    ui.alert(  
      "❌ เกิดข้อผิดพลาด: " \+ e.message \+ "\\n\\n" \+  
      "💡 ตรวจสอบ Backup sheet ที่สร้างไว้ก่อนหน้าครับ\\n" \+  
      "ข้อมูลไม่ถูกลบเพราะระบบใหม่ใช้ Soft Archive"  
    );  
  } finally {  
    lock.releaseLock();  
  }  
}

/\*\*  
 \* Helper: สร้าง Preview ของสิ่งที่จะเกิดขึ้น (ไม่ทำจริง)  
 \* @return {object} preview result  
 \*/  
function \_buildFinalizePreview\_(allData) {  
  var uuidMap       \= {};  
  var uuidNameIndex \= {};  
  var conflicts     \= \[\];

  // Pass 1: สร้าง UUID map  
  allData.forEach(function(row) {  
    var obj  \= dbRowToObject(row);  
    var uuid \= obj ? obj.uuid : null;  
    var name \= obj ? obj.name : null;  
    var sugg \= obj ? obj.suggested : null;

    if (uuid) {  
      if (name) uuidMap\[normalizeText(name)\] \= uuid;  
      if (sugg) uuidMap\[normalizeText(sugg)\] \= uuid;  
      if (uuidNameIndex\[uuid\]) {  
        conflicts.push("UUID ซ้ำ: " \+ uuid.substring(0,8) \+  
          "... พบทั้ง '" \+ uuidNameIndex\[uuid\] \+ "' และ '" \+ name \+ "'");  
      } else {  
        uuidNameIndex\[uuid\] \= name;  
      }  
    }  
  });

  // Pass 2: จำแนกแต่ละแถว  
  var verifiedCount  \= 0;  
  var aliasCount     \= 0;  
  var archiveCount   \= 0;  
  var noSuggested    \= 0;  
  var mappingToUpload \= \[\];  
  var archiveRowNums  \= \[\];  // 0-based index  
  var processedNames  \= new Set();

  allData.forEach(function(row, i) {  
    var obj \= dbRowToObject(row);  
    if (\!obj || \!obj.name) return;

    // ข้ามแถวที่ Inactive หรือ Merged อยู่แล้ว  
    if (obj.recordStatus \=== "Inactive" || obj.recordStatus \=== "Merged" ||  
        obj.recordStatus \=== "Archived") return;

    if (obj.verified \=== true) {  
      // แถว Verified → คงไว้ Active ไม่ต้องทำอะไร  
      verifiedCount++;

    } else if (obj.suggested && obj.suggested \!== "" && obj.suggested \!== obj.name) {  
      // แถวที่มี Suggested → ย้ายชื่อเป็น Alias แล้ว Archive แถว  
      if (\!processedNames.has(normalizeText(obj.name))) {  
        var targetUUID \= uuidMap\[normalizeText(obj.suggested)\] || obj.uuid;

        if (targetUUID) {  
          mappingToUpload.push(mapObjectToRow({  
            variant:    obj.name,  
            uid:        targetUUID,  
            confidence: 100,  
            mappedBy:   "Human\_Finalize\_Safe",  
            timestamp:  new Date()  
          }));  
          aliasCount++;  
          processedNames.add(normalizeText(obj.name));  
        }  
      }  
      // Archive แถวนี้ (ไม่ลบ\! แค่ mark)  
      archiveRowNums.push(i);  
      archiveCount++;

    } else {  
      // ไม่มี Suggested → คงไว้ Active ไม่ต้องทำอะไร  
      noSuggested++;  
    }  
  });

  return {  
    verifiedCount:   verifiedCount,  
    aliasCount:      aliasCount,  
    archiveCount:    archiveCount,  
    noSuggested:     noSuggested,  
    conflicts:       conflicts,  
    mappingToUpload: mappingToUpload,  
    archiveRowNums:  archiveRowNums  
  };  
}

// \==========================================  
// RESTORE FROM ARCHIVE  
// \==========================================

/\*\*  
 \* \[NEW v4.3\] กู้คืนแถวที่ถูก Archive กลับมา Active  
 \* เรียกเมื่อต้องการ un-finalize หรือแก้ไขข้อผิดพลาด  
 \*/  
function restoreArchivedRecords\_UI() {  
  var ss  \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui  \= SpreadsheetApp.getUi();

  var sheet   \= ss.getSheetByName(CONFIG.SHEET\_NAME);  
  var lastRow \= getRealLastRow\_(sheet, CONFIG.COL\_NAME);  
  if (lastRow \< 2) return;

  var data    \= sheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).getValues();  
  var count   \= 0;  
  var ts      \= new Date();

  data.forEach(function(row, i) {  
    if (row\[CONFIG.C\_IDX.RECORD\_STATUS\] \=== "Archived") {  
      data\[i\]\[CONFIG.C\_IDX.RECORD\_STATUS\] \= "Active";  
      data\[i\]\[CONFIG.C\_IDX.UPDATED\]       \= ts;  
      count++;  
    }  
  });

  if (count \=== 0) {  
    ui.alert("ℹ️ ไม่พบแถวที่มีสถานะ Archived");  
    return;  
  }

  var confirm \= ui.alert(  
    "⚠️ ยืนยันการกู้คืน",  
    "พบ " \+ count \+ " แถวที่มีสถานะ Archived\\nต้องการเปลี่ยนกลับเป็น Active ทั้งหมดหรือไม่?",  
    ui.ButtonSet.YES\_NO  
  );  
  if (confirm \!== ui.Button.YES) return;

  sheet.getRange(2, 1, lastRow \- 1, CONFIG.DB\_TOTAL\_COLS).setValues(data);  
  SpreadsheetApp.flush();  
  if (typeof clearSearchCache \=== 'function') clearSearchCache();

  ui.alert("✅ กู้คืนสำเร็จ\! " \+ count \+ " แถวกลับมา Active แล้วครับ");  
}

// \==========================================  
// SCHEMA UPGRADE — เพิ่ม "Archived" status  
// \==========================================

/\*\*  
 \* \[NEW v4.3\] เพิ่ม "Archived" เข้า Data Validation dropdown  
 \* ของคอลัมน์ Record\_Status ใน Database sheet  
 \*/  
function upgradeRecordStatusValidation() {  
  var ss    \= SpreadsheetApp.getActiveSpreadsheet();  
  var ui    \= SpreadsheetApp.getUi();  
  var sheet \= ss.getSheetByName(CONFIG.SHEET\_NAME);

  if (\!sheet) { ui.alert("❌ ไม่พบ Database sheet"); return; }

  var lastRow \= Math.max(sheet.getLastRow(), 1001);  
  var statusRange \= sheet.getRange(2, CONFIG.COL\_RECORD\_STATUS, lastRow, 1);

  var rule \= SpreadsheetApp.newDataValidation()  
    .requireValueInList(\["Active", "Inactive", "Merged", "Archived"\])  
    .setAllowInvalid(false)  
    .build();

  statusRange.setDataValidation(rule);  
  SpreadsheetApp.flush();  
  ui.alert(  
    "✅ อัปเกรด Record\_Status Validation สำเร็จ\!\\n\\n" \+  
    "สถานะที่รองรับ:\\n" \+  
    "Active   \= ใช้งานปกติ\\n" \+  
    "Inactive \= ปิดการใช้งาน\\n" \+  
    "Merged   \= รวมเข้ากับ UUID อื่น\\n" \+  
    "Archived \= ถูก Finalize แล้ว (ซ่อน ไม่ลบ)"  
  );  
}

// \==========================================  
// ฟังก์ชันที่เหลือทั้งหมด PRESERVED จาก v4.2  
// \==========================================  
// getRealLastRow\_()                → PRESERVED ✅  
// loadDatabaseIndexByUUID\_()       → PRESERVED ✅  
// loadDatabaseIndexByNormalizedName\_() → PRESERVED ✅  
// loadNameMappingRows\_()           → PRESERVED ✅  
// appendNameMappings\_()            → PRESERVED ✅  
// syncNewDataToMaster()            → PRESERVED ✅  
// runDeepCleanBatch\_100()          → PRESERVED ✅  
// resetDeepCleanMemory()           → PRESERVED ✅  
// processClustering\_GridOptimized() → PRESERVED ✅ (ไม่แตะพิกัด)  
// repairNameMapping\_Full()         → PRESERVED ✅  
// assignMissingUUIDs()             → PRESERVED ✅  
// recalculateAllConfidence()       → PRESERVED ✅  
// recalculateAllQuality()          → PRESERVED ✅  
// fixCheckboxOverflow()            → PRESERVED ✅  
// showLowQualityRows()             → PRESERVED ✅  
---

### **\[4.2\] Service\_SchemaValidator.gs — เพิ่ม "Archived" status**

javascript  
/\*\*  
 \* VERSION: 001 (อัปเดตจาก 4.2 Phase A)  
 \* \[v4.3\] เพิ่ม "Archived" ใน Record\_Status validation  
 \*/

// ใน validateSheet\_() → เพิ่มการตรวจ Record\_Status ที่ถูกต้อง  
// ไม่มีการเปลี่ยนแปลงอื่น — PRESERVED ทั้งหมด  
---

### **\[4.3\] Service\_Search.gs — exclude Archived**

javascript  
/\*\*  
 \* VERSION: 001 (อัปเดตจาก 4.2 Phase B)  
 \* \[v4.3\] เพิ่ม exclude Archived status ใน searchMasterData()  
 \*/

// ใน searchMasterData() บรรทัดที่ filter recordStatus:  
// เดิม:  
//   if (recordStatus \=== "Inactive" || recordStatus \=== "Merged") continue;  
//  
// อัปเดตเป็น:  
//   if (recordStatus \=== "Inactive" ||   
//       recordStatus \=== "Merged"   ||   
//       recordStatus \=== "Archived") continue;  
//  
// แค่เพิ่ม "Archived" เข้าไปบรรทัดเดียว ที่เหลือ PRESERVED ทั้งหมด  
---

### **\[4.4\] Service\_SoftDelete.gs — เพิ่ม Archived ใน buildUUIDStateMap\_**

javascript  
/\*\*  
 \* VERSION: 001 (อัปเดตจาก 4.2 Phase A)  
 \* \[v4.3\] เพิ่ม Archived ใน isActiveFromMap\_ และ isActiveUUID\_  
 \*/

// ใน isActiveUUID\_() เดิม:  
//   return (status \=== "Active" || status \=== "");  
// อัปเดต:  
//   return (status \=== "Active" || status \=== "");  
//   // "Archived" ไม่ถือว่า Active — ถูกต้องแล้ว ✅ ไม่ต้องแก้

// ใน buildUUIDStateMap\_() — PRESERVED ✅  
// ใน resolveUUIDFromMap\_() — PRESERVED ✅  
// ใน isActiveFromMap\_()    — PRESERVED ✅ (Archived จะถือว่า inactive อยู่แล้ว)  
---

### **\[4.5\] Menu.gs VERSION: 001**

javascript  
/\*\*  
 \* VERSION: 001 (อัปเดตจาก 000\)  
 \* \[v4.3\] ใช้ finalizeAndClean\_MoveToMapping\_Safe แทนของเดิม  
 \*        เพิ่มเมนู Restore Archived \+ Schema Upgrade  
 \*/

// ใน onOpen() แก้ไขเมนูนี้:

// เดิม (อันตราย ⛔):  
// .addItem('✅ 6️⃣ จบงาน (Finalize & Move to Mapping)', 'finalizeAndClean\_UI')

// แก้เป็น (ปลอดภัย ✅):  
// .addItem('✅ 6️⃣ จบงาน SAFE (Finalize & Archive)', 'finalizeAndClean\_Safe\_UI')

// และเพิ่มใน Admin Tools:  
// .addItem('♻️ กู้คืน Archived Records',           'restoreArchivedRecords\_UI')  
// .addItem('🔧 อัปเกรด Record\_Status (v4.3)',       'upgradeRecordStatusValidation')

// ────────────────────────────────────────────  
// WRAPPER FUNCTIONS ใหม่  
// ────────────────────────────────────────────

function finalizeAndClean\_Safe\_UI() {  
  var ui \= SpreadsheetApp.getUi();  
  var result \= ui.alert(  
    '⚠️ ยืนยันการจบงาน (Finalize Safe)?',  
    '✅ ระบบใหม่จะ:\\n' \+  
    '• เพิ่ม Alias ใน NameMapping ✅\\n' \+  
    '• Mark แถวที่จัดการแล้วเป็น "Archived" ✅\\n' \+  
    '• สร้าง Backup ก่อนเสมอ ✅\\n\\n' \+  
    '🔒 ระบบใหม่จะไม่:\\n' \+  
    '• ลบพิกัด LAT/LNG ❌\\n' \+  
    '• ลบข้อมูลจาก Sheet ❌\\n' \+  
    '• รัน clearContent() ❌\\n' \+  
    '• รัน deleteRows() ❌\\n\\n' \+  
    'คุณต้องการดำเนินการต่อหรือไม่?',  
    ui.ButtonSet.OK\_CANCEL  
  );  
  if (result \== ui.Button.OK) {  
    finalizeAndClean\_MoveToMapping\_Safe();  
  }  
}

// ────────────────────────────────────────────  
// DEPRECATED: ฟังก์ชันเดิมที่ปลดระวางแล้ว  
// ไม่ได้ลบออก แต่ซ่อนจาก Menu และเพิ่ม warning  
// ────────────────────────────────────────────

/\*\*  
 \* @deprecated ใช้ finalizeAndClean\_MoveToMapping\_Safe() แทน  
 \* ⛔ ฟังก์ชันนี้มีความเสี่ยง Data Loss (clearContent \+ deleteRows)  
 \* คง code ไว้เพื่อ reference เท่านั้น ห้ามเรียกใช้จาก Menu  
 \*/  
function finalizeAndClean\_UI\_DEPRECATED() {  
  SpreadsheetApp.getUi().alert(  
    "⛔ ฟังก์ชันนี้ถูกปลดระวางแล้ว",  
    "กรุณาใช้ '✅ 6️⃣ จบงาน SAFE (Finalize & Archive)' แทนครับ\\n\\n" \+  
    "ฟังก์ชันเดิมมีความเสี่ยงทำให้พิกัดและข้อมูลหายได้",  
    SpreadsheetApp.getUi().ButtonSet.OK  
  );  
}  
---

## **\[5\] TEST CHECKLIST — ขั้นตอนทดสอบทีละขั้น**

ขั้นตอนที่ 1: Backup Manual ก่อนทดสอบ  
  □ Export Database sheet เป็น .xlsx ไว้ก่อนทดสอบทุกครั้ง  
  □ จดบันทึกจำนวนแถวปัจจุบัน (เช่น 1,000 แถว)  
  □ จดบันทึกจำนวน LAT/LNG ที่มีข้อมูล (เช่น 850 แถว)

ขั้นตอนที่ 2: Deploy โค้ดใหม่  
  □ อัปเดต Service\_Master.gs (VERSION: 001\)  
  □ อัปเดต Menu.gs (VERSION: 001\)  
  □ เพิ่ม "Archived" ใน Service\_Search.gs (1 บรรทัด)  
  □ รัน upgradeRecordStatusValidation()  
  □ รัน runFullSchemaValidation() → ต้องผ่านทุกชีต

ขั้นตอนที่ 3: ทดสอบ Dry Run ก่อน Commit  
  □ คลิก Menu → "✅ จบงาน SAFE"  
  □ ดู Preview ว่า จำนวนแถว Archived สมเหตุสมผลหรือไม่  
  □ ตรวจสอบ aliasCount ว่าตรงกับที่คาดไว้  
  □ กด "ยกเลิก" → ตรวจว่า Database ไม่มีอะไรเปลี่ยนแปลง

ขั้นตอนที่ 4: ทดสอบ Commit จริง  
  □ กด "ตกลง" ใน Finalize Safe  
  □ ตรวจสอบ:  
      \- จำนวนแถวใน Database ต้องเท่าเดิม (เช่น ยังคง 1,000 แถว)  
      \- LAT/LNG ต้องครบเท่าเดิม (ยังคง 850 แถว)  
      \- แถที่ Archived ต้องมี Record\_Status \= "Archived"  
      \- NameMapping ต้องมี aliases เพิ่มขึ้น

ขั้นตอนที่ 5: ทดสอบ Search ไม่เห็น Archived  
  □ ค้นหาชื่อที่รู้ว่าถูก Archive แล้ว  
  □ ผลลัพธ์ต้องไม่แสดง Archived records  
  □ แต่ถ้าค้นหา Alias → ต้องเจอ Master UUID แทน

ขั้นตอนที่ 6: ทดสอบ Restore  
  □ รัน restoreArchivedRecords\_UI()  
  □ ตรวจว่า Record\_Status กลับเป็น "Active" ครบ  
  □ ค้นหาใน WebApp → ต้องเห็นข้อมูลกลับมาครบ

ขั้นตอนที่ 7: ยืนยันว่าโค้ดเก่าถูก Disable  
  □ ตรวจ Menu → ต้องไม่มี "จบงาน" เดิม  
  □ ถ้ามีใครเรียก finalizeAndClean\_UI\_DEPRECATED() → ต้องเห็น Alert ⛔  
---

## **\[6\] สรุป — Before vs After**

| หัวข้อ | ก่อนแก้ ❌ | หลังแก้ ✅ |
| ----- | ----- | ----- |
| พิกัดแถวที่ไม่ Verified | หายหมด | ยังอยู่ครบ |
| แถวที่ไม่มี Suggested | หายหมดไม่มีร่องรอย | คงไว้ Active |
| การ "นำออก" จาก Active View | Hard Delete (deleteRows) | Soft Archive (Record\_Status) |
| กู้คืนได้หรือไม่ | ❌ กู้ไม่ได้ (ต้อง Restore Backup) | ✅ รัน Restore ได้ทันที |
| NameMapping Aliases | สร้างได้ ✅ | สร้างได้ ✅ เหมือนเดิม |
| Backup | ✅ มีอยู่แล้ว | ✅ ยังมีอยู่ |
| Search ไม่เห็น Archived | N/A | ✅ Excluded อัตโนมัติ |
| clearContent() | ✅ มี (อันตราย) | ❌ ลบออกแล้ว |
| deleteRows() | ✅ มี (อันตราย) | ❌ ลบออกแล้ว |

ช่วยสรุป และ ทำคู่มือ การใช้งาน ปุ่มต่างๆ ก่อน \- หลัง  
02:51  
Orchestrated comprehensive visual guide for button functions comparison  
Orchestrated comprehensive visual guide for button functions comparison  
คู่มือครบแล้วครับ สรุปสั้นๆ ที่สำคัญที่สุด:  
จุดเปลี่ยนหลักของ V4.3 มี 3 เรื่องคือ ปุ่ม "จบงาน" เดิมถูกแทนที่ด้วย "Finalize SAFE" ที่ไม่มีการลบข้อมูลจริงอีกต่อไป, เพิ่มเมนูที่ 5 ทั้งหมดสำหรับตรวจ 8 ปัญหา และเพิ่มสถานะ Archived เข้าไปเป็นสถานะที่ 4  
กฎเหล็กที่ต้องจำ คือห้ามใช้ปุ่ม Finalize เดิมเด็ดขาด ถ้าเจอในระบบให้ข้ามไปใช้ปุ่ม Finalize SAFE แทนทุกครั้ง  
ลำดับการทำงานประจำสัปดาห์ ที่แนะนำคือ Sync → GPS\_Queue → Full Scan → Auto-Resolve → Review Conflict\_Log ด้วยมือ ตามลำดับนั้น

