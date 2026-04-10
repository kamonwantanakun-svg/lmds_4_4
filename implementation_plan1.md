# แผนการอัปเกรดระบบ Logistics Master Data (Data Quality & Deduplication Engine)

จากการวิเคราะห์ชุดโค้ด `lmds_4_1_1-main` และรับทราบเป้าหมายในการแก้ปัญหาข้อมูลคุณภาพ 8 ประการ (ชื่อซ้ำ, ที่อยู่ซ้ำ, จุดพิกัดซ้ำ และกรณีเชิงซ้อนอื่นๆ) เพื่อให้ระบบสามารถใช้งานได้อย่างยั่งยืนในระยะยาว นี่คือแผนการออกแบบสถาปัตยกรรมและโครงสร้างข้อมูลเชิงลึก

## User Review Required

> [!IMPORTANT]
> **การเปลี่ยนแปลงโครงสร้างตาราง (Schema Changes):** จะมีการเพิ่มคอลัมน์ใหม่ในชีต `Database` เพื่อใช้เป็นข้อมูลเบื้องหลังสำหรับการตัดสินใจ (Fingerprints, Scores) รวมถึงจะมีการสร้างชีตใหม่ `DQ_Review_Queue` เพื่อให้แอดมินใช้ตรวจสอบคิวข้อมูลที่สับสน ขอให้ยืนยันว่าการเพิ่มฟิลด์เหล่านี้จะไม่กระทบสูตรในโปรแกรมภายนอกที่ดึงข้อมูลไปใช้

> [!WARNING]
> **นโยบายการยุบรวมข้อมูล (Auto-Merge Policy):**
> เราจะตั้งเกณฑ์คะแนน (Decision Threshold) สำหรับการยุบรวม (Merge) ชุดข้อมูลที่มีความเสี่ยงต่ำ ให้อัตโนมัติที่คะแนนความเหมือน >= 90% (เช่น ชื่อตรงกัน 100% แต่ที่อยู่ต่างกันเล็กน้อย) ส่วนเคสที่กำกวม (เช่น กรณีที่ 5 คนละชื่อแต่ที่อยู่และพิกัดเดียวกัน) ระบบจะพักงานไว้ใน Review Queue ยืนยันว่าต้องการให้นำระบบคนตรวจสอบ (Human-in-the-loop) มาใช้งานใช่หรือไม่?

## Proposed Changes

การปรับปรุงจะถูกแบ่งออกเป็น 3 เลเยอร์หลัก: **1. โครงสร้าง Database**, **2. ส่วนทำความสะอาดและบีบอัดข้อมูล (Canonicalization)**, และ **3. เครื่องยนต์อัจฉริยะ (Matching Engine)** ที่ช่วยตัดสินใจใน 8 เคส

---

### โครงสร้างและคอนฟิก (Data Architecture & Configuration)
เพิ่ม Constants สำหรับคอลัมน์ใหม่ จัดการชีตใหม่ และตั้งค่าเกณฑ์ความแม่นยำ

#### [MODIFY] `Config.gs`
- **เพิ่มตัวแปรคอลัมน์ใหม่ใน `DB_REQUIRED_HEADERS`**:
  - `canonical_name` (ชื่อที่ตัดคำนำหน้า/สระส่วนเกิน)
  - `canonical_address` (ที่อยู่ที่เรียงลำดับใหม่และจัดฟอร์แมตแล้ว)
  - `name_fp` / `addr_fp` (กุญแจแฮชหรือ Fingerprint เพื่อแก้ปัญหาข้อ 1 และ 2)
  - `lat_norm` / `lng_norm` (พิกัดปัดเศษ 6 ตำแหน่งเพื่อแก้ปัญหาข้อ 3)
  - `dq_score`, `match_confidence`, `match_rule`, `review_status`
-ปรับลด/เพิ่มค่า `DB_TOTAL_COLS`

#### [MODIFY] `Setup_Upgrade.gs`
- เพิ่มฟังก์ชัน `ensureDedupColumnsV2()` เพื่อแทรกคอลัมน์ใหม่เข้าไปใน `Database` แบบปลอดภัย
- เพิ่มฟังก์ชัน `createDQReviewQueueSheet()` สำหรับสร้าง `DQ_Review_Queue`

---

### ระบบทำความสะอาดและสกัดฟินเกอร์พรินต์ (Canonicalization Pipeline)
เปลี่ยนข้อมูลดิบให้กลายเป็นข้อมูลที่คอมพิวเตอร์เปรียบเทียบได้ง่าย ช่วยแก้ปัญหา **ข้อ 4 (ชื่อเขียนไม่เหมือนกัน)**

#### [MODIFY] `Utils_Common.gs`
- **เพิ่มฟังก์ชัน `canonicalizeName(name)`**: แปลงเป็นพิมพ์เล็ก, ตัดคำย่อติดปาก (บจก., จำกัด, สาขา), รวม space
- **เพิ่มฟังก์ชัน `buildNameFingerprint(canonicalName)`**: ทำ Tokenization แยกคำและเรียงตัวอักษร 
- **เพิ่มฟังก์ชัน `canonicalizeAddress(addr)`**: ตัดลดคำว่า "ถ.", "ต.", "อ.", "จ." ให้เป็นมาตรฐานเดียวกัน 
- **เพิ่มฟังก์ชัน `buildAddressFingerprint(canonicalAddr)`**: สกัดเฉพาะ บ้านเลขที่+ตัวเลขในที่อยู่+รหัสไปรษณีย์ 
- **เพิ่มฟังก์ชันเปรียบเทียบ (Fuzzy String Similarity)**: เช่น `jaroWinklerSimilarity(s1, s2)` สำหรับคำนวณ % ความเหมือน

#### [MODIFY] `Service_GeoAddr.gs`
- **เพิ่มฟังก์ชัน `normalizeLatLng(lat, lng)`**: สกัดเฉพาะตัวเลข (ป้องกันอักขระแปลกปลอม), ตรวจความถูกต้องขอบเขต (Range), หากคลาดเคลื่อนแบบสลับ Lat/Lng ให้สลับกลับอัตโนมัติ

---

### เครื่องยนต์แยกแยะ (Data Quality & Matching Engine)
ชั้นลอจิกสำคัญที่วิเคราะห์ความคล้ายคลึงและผูกกฎเหล็กแก้ปัญหาตั้งแต่ **ข้อ 1 ถึงข้อ 8**

#### [NEW] `Service_DataQuality.gs`
รวมลอจิกการทำ Deduplication โดยเฉพาะ:
- **ฟังก์ชัน `scoreCandidatePair(a, b)`**: คำนวณความเหมือน 4 มิติ (`S_name`, `S_addr`, `S_geo`, `S_postcode`) และรวมเป็น `FinalScore`
- **ฟังก์ชัน `detectEightCasePattern(a, b)`**: วิเคราะห์เจาะจง 8 เคส:
  1. ชื่อซ้ำเป๊ะ (`name_fp` ตรงกัน)
  2. ที่อยู่ซ้ำเป๊ะ (`addr_fp` ตรงกัน)
  3. LatLong ซ้ำเป๊ะ (ปัดทศนิยม 5 ตำแหน่งแล้วตรงกัน)
  4. ชื่อเขียนต่างกัน (Fuzzy Score เล็กน้อย) -> หากที่อยู่และพิกัดเหมือนกันให้ผูก Alias
  5. ต่างชื่อแต่ที่อยู่เดียวกัน -> บังคับ `REVIEW_REQUIRED` (หรือติดแท็ก `CO_LOCATED`) ป้องกันรวมผิดบริษัท
  6. ชื่อเดียวกันแต่ที่อยู่ต่างกัน -> ตรวจสอบว่า `S_geo` ไกลไขไหม ถ้าไกลเป็นคนละสาขาแยก `UUID`
  7. ชื่อเดียวกันแต่ LatLong คนละที่ -> ส่ง Audit / แจ้ง GPS Queue
  8. คนละชื่อคนละที่อยู่แต่พิกัดเดียวกัน (ตึกเดียวกัน) -> ห้าม Merge, สร้าง Location Hub Cluster
- **ฟังก์ชัน `decideMatch(score, riskFlags)`**: จัดสถานะเป็น `AUTO_ACCEPT`, `REVIEW_REQUIRED` หรือ `KEEP_SEPARATE`
- **ฟังก์ชัน `pushToDQReviewQueue(caseObj)`**: ดันเคสที่ตัดสินใจไม่ได้ไปให้คนคัดกรอง

#### [MODIFY] `Service_Master.gs`
- ผูกระบบ Deduplication เข้ากับกระบวนการ `syncNewDataToMaster()`
- ก่อนที่จะสร้างแผ่นข้อมูลใหม่ลง Database ให้โยนผ่าน `Service_DataQuality.gs` เพื่อประเมินก่อน หากพบว่าเป็นตัวซ้ำ (Duplicate) แบบ `AUTO_ACCEPT` ให้ดึงเข้ากระบวนการ Update ทันที แทนที่จะชี้ Insert

---

## Open Questions

1. **โควต้าการเชื่อมต่อ (Google Apps Script Quotas):** ในกระบวนการทำ String Similarity เปรียบเทียบข้อมูลใหม่กับข้อมูลทั้งหมดในฐาน อาจก่อให้เกิดปัญหา Time limits (6 นาที) ของ Apps Script หากมีของใหม่เยอะๆ ผมจะใช้ระบบ Batch Limits และลดสัดส่วนดัชนี (Blocking/Indexing) เข้ามาช่วย รับข้อจำกัดนี้ได้ไหมครับ?
2. **Review Queue UI:** เมื่อข้อมูลไปตกใน `DQ_Review_Queue` แอดมินสามารถเข้าไปกดยืนยัน (Approve/Reject) เป็น Dropdown list ได้เลย แล้วจะมี Script Trigger คอยจับตาดูเพื่ออัปเดต Database จริง ถือว่ามีประสบการณ์ที่ดีสำหรับผู้ใช้หรือไม่?

## Verification Plan

### Automated Tests
- จะทำการสร้าง UAT Mockup Data ในสคริปต์ `Test_Diagnostic.gs` เพื่อจำลองเคส 1-8 
- ตรวจสอบว่าระบบสามารถ Assign สถานะ `REVIEW_REQUIRED` และ `AUTO_ACCEPT` ได้ตามหลักการ

### Manual Verification
- ขอให้ท่านลอง Sync Data ชุดใหม่ที่จงใจให้มี *ชื่อซ้ำแต่ตกหล่นคำนำหน้า*, หรือ *พิกัดซ้ำแต่คนละชื่อ*
- ตรวจสอบผ่านชีต `DQ_Review_Queue` ว่าหน้าตาสามารถทำงานได้จริงและสะท้อนตรรกะทั้งหมด
