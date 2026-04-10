# Tasks for LMDS Database & DQ Aggressive Plan

- [x] 1. Create a detailed Setup & Schema Guide (`Setup_Guide_V4_5.md`) explaining Sheet Names, Column Names, and Setup steps.
- [x] 2. Edit `Config.gs` to enforce stricter `GEMINI_API_KEY` rules (`startsWith("AIza")` and `length > 30`).
- [x] 3. Create `Service_Archive.gs` to handle moving old/Inactive records from Master DB to an Archive sheet.
- [x] 4. Edit `Menu.gs` to add UI buttons for Auto-Archive and sending weekly reports.
- [x] 5. Write `Walkthrough.md` explaining how the buttons work, how the DQ queue is processed, and troubleshooting.

## Phase 2: Core DQ Engine Implementation
- [x] 6. Review `Service_DataQuality.gs` and `Service_Matching.gs` to understand existing DQ pipeline.
- [x] 7. Enhance `Service_DataQuality.gs` with full 8-case DQ logic (Flags, Scoring, Queue writing).
- [x] 8. Create `Service_DQ_Resolver.gs` with UI wrappers for Approving/Rejecting DQ Queue items and Merging UUIDs.
- [x] 9. Add `Archive_DB` sheet column headers to `Config.gs` schema validation.
