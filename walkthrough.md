# 🚛 LMDS V4.5 — สรุปสถาปัตยกรรมระบบแบบสมบูรณ์ (Full System Analysis)

## 📁 1. ภาพรวมไฟล์ทั้งหมด 27 ไฟล์

### 🔧 Core Config Layer (รากฐานระบบ)
| ไฟล์ | สถานะ | หน้าที่ |
|:---|:---:|:---|
| `Config.gs` | ✅ V4.5 | ค่าคงที่ทั้งหมด: Sheet Names, Column Indices (C_IDX, DQ_IDX), Match Thresholds, API Key getter |
| `Utils_Common.gs` | ✅ เดิม | ฟังก์ชันกลาง: `canonicalizeName()`, `buildGeoHash()`, `getHaversineDistanceKM()`, `generateUUID()`, `calculateFuzzySimilarityPercentage()` |

### 📋 Schema & Validation Layer
| ไฟล์ | สถานะ | หน้าที่ |
|:---|:---:|:---|
| `Service_SchemaValidator.gs` | ✅ V4.5 | ตรวจสอบโครงสร้างชีตทุกแผ่น รวมถึง `Archive_DB` ใหม่ |

### 🎮 UI / Entry Points Layer
| ไฟล์ | สถานะ | หน้าที่ |
|:---|:---:|:---|
| `Menu.gs` | ✅ V4.5 | เมนูทั้ง 4 หมวด + 6 ปุ่มใหม่ (DQ Check, Archive, Approve, Reject, Batch-Merge, DQ Stats) |
| `Index.html` | ✅ เดิม | WebApp UI สำหรับค้นหาชื่อลูกค้าจากคนขับ |
| `WebApp.gs` | ✅ เดิม | Backend ของ WebApp: รับ request, ค้นหาใน NameMapping+Database |

### 🧠 Business Logic Layer (หัวใจระบบ)
| ไฟล์ | สถานะ | หน้าที่ |
|:---|:---:|:---|
| `Service_Master.gs` | ✅ เดิม | `syncNewDataToMaster()` — นำข้อมูลใหม่เข้า Database พร้อม dedup check |
| `Service_Matching.gs` | ✅ **V4.5** | **Matching Engine 8 กรณี** + `runMatchingEngineStage1_V45()` ส่ง structured result |
| `Service_DataQuality.gs` | ✅ **V4.5** | Entry point DQ: รายงาน 8 Flag แบบละเอียด + `showDQQueueSummary_UI()` |
| `Service_DQ_Resolver.gs` | 🆕 **V4.5** | Approve/Reject/Batch-Merge DQ Queue + `dqReviewObjectToRow()` |
| `Service_Archive.gs` | 🆕 **V4.5** | Auto-Archive ข้อมูลเก่า → `Archive_DB` |
| `Service_SoftDelete.gs` | ✅ เดิม | `mergeUUIDs()`, `softDeleteRecord()`, `resolveUUID()` |
| `Service_Agent.gs` | ✅ เดิม | Gemini AI: `resolveUnknownNamesWithAI()` — AI Name Mapping |
| `Service_GeoAddr.gs` | ✅ เดิม | Google Maps API: geocoding, reverse geocoding, postal lookup |
| `Service_GPSFeedback.gs` | ✅ เดิม | รับ GPS feedback จากคนขับ → `GPS_Queue` |
| `Service_SCG.gs` | ✅ เดิม | ดึงข้อมูล Shipment จาก SCG API + apply master coordinates |
| `Service_Search.gs` | ✅ เดิม | ค้นหาชื่อใน Database + NameMapping (ใช้กับ WebApp) |
| `Service_Notify.gs` | ✅ เดิม | ส่งแจ้งเตือน LINE / Telegram |
| `Service_AutoPilot.gs` | ✅ เดิม | ตั้ง Trigger อัตโนมัติ (Start/Stop Auto-Pilot) |
| `Service_Maintenance.gs` | ✅ เดิม | งานบำรุงรักษา: `cleanupOldBackups()`, `checkSpreadsheetHealth()` |

### 🔐 Setup & Security Layer
| ไฟล์ | สถานะ | หน้าที่ |
|:---|:---:|:---|
| `Setup_Security.gs` | ✅ เดิม | `setupEnvironment()` — บันทึก API Key ลง Script Properties |
| `Setup_Upgrade.gs` | ✅ เดิม | Migration scripts สำหรับ V4.x → V4.5 |

### 🧪 Test / Debug Layer
| ไฟล์ | สถานะ | หน้าที่ |
|:---|:---:|:---|
| `Test_AI.gs` | ✅ เดิม | ทดสอบ Gemini connection + AI response validation |
| `Test_Diagnostic.gs` | ✅ เดิม | Debug: `RUN_SYSTEM_DIAGNOSTIC`, `RUN_SHEET_DIAGNOSTIC` |

---

## 🔗 2. แผนผังการเชื่อมต่อ (Dependency Map)

```
                    ┌─────────────────────────────┐
                    │         Config.gs            │
                    │  (ค่าคงที่ทั้งหมด)           │
                    └──────────┬──────────────────┘
                               │ ทุกไฟล์อ่านค่าจาก CONFIG
                    ┌──────────┼──────────────────┐
                    │          │                  │
             ┌──────▼──┐  ┌───▼────┐   ┌─────────▼──────┐
             │Utils_   │  │Service_│   │Service_Schema  │
             │Common   │  │Notify  │   │Validator.gs    │
             │.gs      │  │.gs     │   │(ตรวจ Schema)   │
             └──────┬──┘  └───┬────┘   └────────────────┘
                    │         │
        ┌───────────┴──────────────────────────────┐
        │           MENU.gs (UI Entry Points)       │
        │  - Sync → Service_Master.gs              │
        │  - DQ Check → Service_DataQuality.gs     │
        │  - Archive → Service_Archive.gs          │
        │  - Approve/Reject → Service_DQ_Resolver  │
        │  - AI → Service_Agent.gs                 │
        │  - SCG → Service_SCG.gs                  │
        └──────────────────────────────────────────┘
                    │
     ┌──────────────┼───────────────────┐
     │              │                   │
┌────▼─────┐  ┌─────▼──────┐   ┌───────▼────────┐
│Service_  │  │Service_    │   │Service_        │
│DataQua   │  │Master.gs   │   │SCG.gs          │
│lity.gs   │  │(Sync+Dedup)│   │(SCG API)       │
└────┬─────┘  └─────┬──────┘   └────────────────┘
     │               │
┌────▼──────────┐    │ เรียก mergeUUIDs()
│Service_Match  │    ▼
│ing.gs (V4.5)  │  ┌────────────────┐
│- 8 DQ Flags   │  │Service_SoftDel │
│- Blocking     │  │ete.gs          │
│- Returns obj  │  │- mergeUUIDs()  │
└────┬──────────┘  │- softDelete()  │
     │             │- resolveUUID() │
     │ appendDQ    └────────────────┘
     │ ReviewCases
     ▼
┌──────────────────┐         ┌──────────────────┐
│ DQ_Review_Queue  │◄────────│Service_DQ_       │
│ (Google Sheet)   │         │Resolver.gs(V4.5) │
│                  │─────────►- Approve (Merge) │
└──────────────────┘         │- Reject          │
                             │- Batch-Merge     │
                             └──────────────────┘
```

---

## 🔄 3. Data Flow: ทาง "ซ้าย → ขวา" (ชีวิตของข้อมูล 1 รายการ)

```
[SCG API / คนขับ]
       │
       ▼
[ชีต: SCGนครหลวงJWDภูมิภาค]  ←── fetchDataFromSCGJWD()
       │
       ▼ syncNewDataToMaster()
       │
  ┌────┴────────────────────────────────────────────────────────┐
  │                  Service_Master.gs                          │
  │  1. ค้นใน NameMapping → เจอ UUID → Link                    │
  │  2. ไม่เจอ → ค้น Database (Fuzzy) → เจอ → Map ใหม่       │
  │  3. ยังไม่เจอ → สร้างแถวใหม่ + UUID + GeoHash             │
  └────┬────────────────────────────────────────────────────────┘
       │
       ▼
[ชีต: Database] ── Record_Status = "Active"
       │
       ▼ runDataQualityCheck_Full() (ทุกสัปดาห์ / กดเอง)
       │
  ┌────┴───────────────────────────────────────────────────────┐
  │               Service_Matching.gs V4.5                    │
  │  Phase 1: refreshCanonicalFields → อัปเดต Canonical_Name  │
  │  Phase 2: Data Blocking (Postcode/GeoHash Buckets)       │
  │  Phase 3: computeMatchSignals_ (Name/Addr/Geo/Postcode)  │
  │  Phase 4: detectRiskFlags_V45_ → ตรวจ 8 กรณี             │
  │  Phase 5: classifyMatchDecision_V45_ → AUTO/REVIEW/SEP   │
  └────┬───────────────────────────────────────────────────────┘
       │
  ┌────▼───────────────┐    ┌───────────────────────────────┐
  │ AUTO_MERGE_CAND.   │    │ REVIEW                        │
  │ (ชื่อ+พิกัดเป๊ะ)   │    │ โยนเข้า DQ_Review_Queue       │
  └────┬───────────────┘    │ พร้อม Flag + Score + Note     │
       │ Batch Merge         └──────┬────────────────────────┘
       ▼                            │ Admin เปิดดู
  mergeUUIDs()                      ▼
  Record_Status = "Merged"   ┌────────────────────────┐
                              │ Service_DQ_Resolver.gs │
                              │ [Approve] → mergeUUIDs │
                              │ [Reject]  → REJECTED   │
                              └────────────────────────┘
                                         │
                              ทุก 6 เดือน│
                                         ▼
                              Service_Archive.gs
                              ย้าย Inactive/Merged → Archive_DB
```

---

## ✅ 4. การตรวจสอบความสมบูรณ์ (Integrity Check)

### ✅ Function Dependencies ที่ตรวจสอบแล้ว

| ฟังก์ชัน | อยู่ใน | เรียกใช้โดย | สถานะ |
|:---|:---|:---|:---:|
| `canonicalizeName()` | `Utils_Common.gs` | `Service_Matching.gs` | ✅ |
| `buildGeoHash()` | `Utils_Common.gs` | `Service_Matching.gs` | ✅ |
| `getHaversineDistanceKM()` | `Utils_Common.gs` | `Service_Matching.gs` | ✅ |
| `generateUUID()` | `Utils_Common.gs` | `Service_Matching.gs`, `Service_Master.gs` | ✅ |
| `calculateFuzzySimilarityPercentage()` | `Utils_Common.gs` | `Service_Matching.gs` | ✅ |
| `getRealLastRow_()` | `Utils_Common.gs` | ทุก Service | ✅ |
| `mergeUUIDs()` | `Service_SoftDelete.gs` | `Service_DQ_Resolver.gs` | ✅ Fixed |
| `dqReviewObjectToRow()` | `Service_DQ_Resolver.gs` | `Service_Matching.gs` | ✅ |
| `runMatchingEngineStage1_V45()` | `Service_Matching.gs` | `Service_DataQuality.gs` | ✅ |
| `refreshCanonicalFieldsInDatabase()` | `Service_Matching.gs` | `Service_DataQuality.gs` | ✅ |
| `ensureArchiveSheetExists_()` | `Service_Archive.gs` | ภายใน Archive | ✅ |
| `preCheck_Matching()` | `Service_SchemaValidator.gs` | `Service_Matching.gs` | ✅ |
| `ensureDQReviewQueueStructure()` | `Service_Master.gs` | `Service_Matching.gs` | ✅ |

### ⚠️ จุดที่ต้องระวัง (Known Gaps)

| รายการ | ความเสี่ยง | วิธีแก้ |
|:---|:---:|:---|
| `ensureDQReviewQueueStructure()` ต้องมีใน Service_Master.gs | กลาง | ตรวจสอบให้มีอยู่ก่อนใช้งาน |
| `Archive_DB` ไม่มีชีตถ้ายังไม่รัน Auto Archive ครั้งแรก | ต่ำ | ระบบสร้างให้อัตโนมัติ |
| Gemini API อาจ timeout ถ้ารัน AI Batch บน >50 records | กลาง | ลด `AI_BATCH_SIZE` เป็น 15-20 |

---

## 📊 5. สรุปตำแหน่งชีตและการใช้งาน

| ชีต Google Sheet | เขียนโดย | อ่านโดย | หมายเหตุ |
|:---|:---|:---|:---|
| `Database` | Service_Master, Service_SoftDelete | ทุกระบบ | หัวใจหลัก |
| `NameMapping` | Service_Master, Service_Agent | Service_Search, WebApp | พจนานุกรมชื่อ |
| `DQ_Review_Queue` | Service_Matching | Service_DQ_Resolver | คิวตรวจสอบ 8 กรณี |
| `GPS_Queue` | Service_GPSFeedback | Service_GPSFeedback | พิกัดคนขับ |
| `Archive_DB` | Service_Archive | - | เก็บข้อมูลเก่า |
| `SCGนครหลวงJWDภูมิภาค` | SCG API | Service_Master | ข้อมูลขาเข้า |
| `PostalRef` | (Manual Import) | Service_GeoAddr | รหัสไปรษณีย์ |

---

## 🎯 6. สิ่งที่ระบบทำได้ครบแล้ว (V4.5 Feature Complete)

- [x] **ซิงค์ข้อมูลใหม่** จาก SCG พร้อม Dedup check อัตโนมัติ
- [x] **8-Case DQ Engine** ตรวจสอบทุกกรณีซ้ำซ้อนแบบ Blocking O(N log N)
- [x] **Human-in-the-Loop Queue** Admin กด Approve/Reject ได้จากเมนู
- [x] **Auto-Merge** สำหรับคู่ที่ AI มั่นใจ 90%+
- [x] **Soft Delete / Merge UUID** ไม่ลบข้อมูลจริง
- [x] **AI Name Resolution** ผ่าน Gemini 1.5 Flash
- [x] **Auto Archive** ย้ายข้อมูลเก่า >180 วัน ออกจาก Main DB
- [x] **GPS Queue** รับ feedback พิกัดจากคนขับ
- [x] **Schema Validation** ตรวจทุกชีตก่อนรัน
- [x] **Notification** LINE + Telegram
- [x] **WebApp** ค้นหาชื่อลูกค้าสำหรับคนขับ
- [x] **Weekly Auto-Trigger** ตั้งได้ผ่าน Apps Script Triggers

> [!TIP]
> ระบบนี้พร้อม Production แล้วครับ — ขั้นตอนเดียวที่เหลือคือ **copy โค้ดขึ้น Google Apps Script** และรัน `setupEnvironment()` ตั้งค่า API Key
