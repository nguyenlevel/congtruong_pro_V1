# TIẾN ĐỘ DỰ ÁN – TOMONI CONSTRUCTION (Partner OS)

> Tài liệu theo dõi tiến độ tổng hợp. Không thay thế Task Tracker (`docs/3_TRACKER.md`), ADR hay tài liệu thiết kế.
> Mọi kết luận ghi nguồn bằng chứng. Mục chưa xác minh được giữ nguyên trạng thái cho đến khi có bằng chứng mới.

## Quy ước trạng thái

| Ký hiệu | Ý nghĩa |
|---|---|
| DESIGNED | Đã có thiết kế/quyết định tài liệu |
| IMPLEMENTED | Đã có code/migration trong repo |
| TESTED | Có bằng chứng test PASS được chạy và ghi nhận |
| ACCEPTED | Người dùng đã nghiệm thu bằng văn bản |
| IN_PROGRESS | Đang thực hiện |
| BLOCKED | Đang bị chặn (ghi rõ lý do) |
| NOT_STARTED | Chưa bắt đầu |
| UNVERIFIED | Chưa xác minh |
| MISSING EVIDENCE | Thiếu bằng chứng |
| WAITING FOR USER | Đang chờ người dùng cung cấp hoặc quyết định |

Nguyên tắc: IMPLEMENTED ≠ TESTED ≠ ACCEPTED. Không có mục nào được đánh dấu ACCEPTED trong báo cáo này.

---

## 1. Thông tin chung

| Mục | Nội dung | Nguồn |
|---|---|---|
| Tên dự án | TOMONI Construction / Partner OS | `README.md`, `docs/3_TRACKER.md` |
| Mục tiêu | Quản lý công trình: nhân sự, chấm công, công việc, nhật ký công trường, vật tư, báo cáo; web (admin) + mobile (offline-first) + Supabase | `docs/product/prd.md` |
| Phiên bản | UNVERIFIED – repo chưa có tag/version rõ ràng; `package.json` không đọc được version đáng tin cậy trong phiên này | — |
| Ngày giờ lập báo cáo | 2026-11-18 18:51 (+07) | Phiên làm việc hiện tại |
| Ngày cập nhật lần cuối | 2026-11-18 18:51 (+07) – lần tạo đầu tiên | — |
| Git branch | UNVERIFIED – thư mục không phải git repository (`fatal: not a git repository`) | Lệnh `git rev-parse`, `branch`, `status`, `log` chạy ngày 2026-11-18 |
| Git commit | UNVERIFIED – không có thông tin | như trên |
| Git remote | UNVERIFIED – không có thông tin | như trên |
| Phạm vi báo cáo | Toàn bộ repo tại thời điểm trên, gồm code, migration, tài liệu, test đã có | — |
| Mức đầy đủ dữ liệu | **Một phần.** Có code, tài liệu và kết quả test local; thiếu git, CI, log Android, bằng chứng thiết bị, dữ liệu thật | Xem mục 11 |

---

## 2. Tổng quan tiến độ

**Trạng thái tổng thể:** Đang triển khai giai đoạn nền tảng (monorepo, Supabase/RLS, sync nền tảng, module Worker vertical slice). Phần lớn module nghiệp vụ chưa bắt đầu.

**Đã có bằng chứng code/test (chạy trong phiên này):**
- `pnpm typecheck`: 10/10 task thành công (exit 0).
- `pnpm test` (vitest, unit + integration): 20 file, 65 test, PASS.

**Giai đoạn:**

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| Nền tảng monorepo, kiến trúc, guard | IMPLEMENTED | Workflow và script có trong repo; CI chưa có bằng chứng chạy |
| Supabase local + migration 001–007b, 008 | IMPLEMENTED; TESTED (theo tracker) | `test db` 33/33 ghi trong tracker, chưa chạy lại trong phiên này |
| Sync engine (packages/sync-engine) | IMPLEMENTED; TESTED ở mức unit/integration với fake | Chưa có test trên thiết bị |
| Module Worker (web + mobile vertical slice) | IMPLEMENTED (code có); TESTED mức unit | Chưa có bằng chứng trên thiết bị/emulator |
| Module 1, 3–13 | NOT_STARTED (theo tracker; không có code tương ứng đã xác minh) | Xem Mục 3 |
| Nghiệm thu bất kỳ hạng mục nào | Không có hạng mục nào ACCEPTED | — |

**Các giai đoạn đang thực hiện:** Sync engine và local DB mobile (tracker đánh dấu `[/]`); RBAC project-level (007b PENDING ACCEPTANCE).

**Đang bị chặn:**
- Android build: BLOCKED – Kotlin ICE trong `expo-autolinking-settings-plugin` (theo tracker/lịch sử; log đầy đủ chưa có). Nguyên nhân chưa xác định.
- Migration 007c trở đi: WAITING FOR USER – chưa được phép triển khai (người dùng chưa duyệt).
- Nghiệm thu 007b: WAITING FOR USER – trạng thái giữ IMPLEMENTED + TESTED – PENDING ACCEPTANCE.

**Mốc tiếp theo (theo ADR-001 và phê duyệt của người dùng):**
1. Cập nhật ADR-001 bản chính thức (đã có addendum, chờ chốt).
2. Thiết kế chi tiết M-A đến M-F (`docs/adr/ADR-001-migration-dossiers.md`, đã có bản nháp).
3. Audit read-only trên staging/bản sao ẩn danh (WAITING FOR USER – chưa xác nhận staging tồn tại).
4. Chỉ sau khi người dùng duyệt: triển khai 007c.

**Phần trăm hoàn thành:** CHƯA ĐỦ CƠ SỞ TÍNH. Không có trọng số đã được người dùng duyệt, không có danh sách hạng mục đầy đủ có trạng thái xác minh, và không có git/CI để đối chiếu.

---

## 3. Tiến độ theo module

Trạng thái theo bốn giai đoạn: Thiết kế / Lập trình / Kiểm thử / Nghiệm thu. Ghi "—" nếu không có bằng chứng.

| STT | Module | Phạm vi chức năng | Thiết kế | Code | Kiểm thử | Nghiệm thu | Trạng thái |
|---|---|---|---|---|---|---|---|
| 1 | Nền tảng & kiến trúc | Monorepo, guard kiến trúc, script | DESIGNED (`docs/0_ARCHITECTURE.md`, ADR-001) | IMPLEMENTED (`scripts/check-architecture.ts`, `package.json`) | TESTED một phần: `pnpm architecture:check` chưa chạy trong phiên này | — | IMPLEMENTED |
| 2 | Auth & phiên đăng nhập (mobile) | Đăng nhập Supabase, lưu token chunked SecureStore, gate session | DESIGNED (ADR, tracker) | IMPLEMENTED (`apps/mobile/src/auth/session.ts`, `chunked-secure-storage.ts`) | TESTED unit: `chunked-secure-storage.test.ts` trong 65 test PASS | — | IMPLEMENTED |
| 3 | Auth & phiên đăng nhập (web) | Đăng nhập web | DESIGNED | UNVERIFIED – chưa đọc đủ `apps/web/src/features/auth` | UNVERIFIED | — | UNVERIFIED |
| 4 | Sync engine (nền tảng) | Outbox, flush/pull, retry, conflict, cursor, audit | DESIGNED | IMPLEMENTED (`packages/sync-engine/src/**`) | TESTED unit/integration: `conflict.test.ts`, `retry.test.ts`, `create-sync-engine.test.ts`, `tests/integration/sync-engine-flow.test.ts` | — | IMPLEMENTED; TESTED (fake adapter) |
| 5 | Sync runtime mobile | `createWorkerSyncRuntime`, `useAutoSync` (gọi khi có mạng) | DESIGNED | IMPLEMENTED (`apps/mobile/src/sync/sync-runtime.ts`, `use-auto-sync.ts`, `App.tsx:36-53`) | TESTED unit: `sync-runtime.test.ts` | — | IMPLEMENTED; TESTED (fake) |
| 6 | Local DB mobile (WatermelonDB) | Schema, adapter, outbox | DESIGNED | IMPLEMENTED một phần (`apps/mobile/src/database/`); tracker ghi "còn native smoke test/migrations runtime" | UNVERIFIED trên thiết bị | — | IN_PROGRESS (theo tracker) |
| 7 | Module Worker – web | CRUD/vertical slice | DESIGNED | IMPLEMENTED (`apps/web/src/features/workers/`) | TESTED unit: `workersStore.test.ts` | — | IMPLEMENTED; TESTED (unit) |
| 8 | Module Worker – mobile | Tạo offline → outbox → list | DESIGNED | IMPLEMENTED (`apps/mobile/src/features/workers/`) | TESTED unit: `offline-worker.test.ts`; tracker ghi "đã xong" nhưng chưa có bằng chứng thiết bị | — | IMPLEMENTED; device MISSING EVIDENCE |
| 9 | Module Worker – DB | Bảng `workers`, RLS | DESIGNED | IMPLEMENTED (migration tương ứng + `supabase/tests/rls/workers.test.sql`) | TESTED theo tracker (`test db`) | — | IMPLEMENTED |
| 10 | Module Worker – `sub_contractors` DB | Bảng nhà thầu phụ | DESIGNED | NOT_STARTED (tracker chưa đánh dấu) | — | — | NOT_STARTED |
| 11 | RBAC – Tenant membership | `memberships`, role mapping, hook claims | DESIGNED (ADR-001) | IMPLEMENTED (`004`, `005`, `007a`) | TESTED theo tracker (`membership.test.sql`) | — | IMPLEMENTED; TESTED (DB local) |
| 12 | RBAC – PROJECT_VIEWER | Role mới | DESIGNED | IMPLEMENTED (`20260923000008_project_viewer_role.sql`) | TESTED theo tracker (`project_viewer.test.sql`, 7 test) | — | IMPLEMENTED; TESTED (DB local) |
| 13 | RBAC – Project membership (007b) | `project_companies`, `project_memberships`, helper, policy | DESIGNED | IMPLEMENTED (`20260923000009_project_memberships.sql`) | TESTED (DB local): `project_membership.test.sql` 15 test, tổng 33/33 theo tracker; **chưa chạy lại trong phiên này** | — | IMPLEMENTED + TESTED – PENDING ACCEPTANCE |
| 14 | RBAC – 007c/007d/007e | Role mapping SITE_MANAGER, soft-delete, v.v. | DESIGNED (dossier M-A…M-F) | NOT_STARTED | — | — | WAITING FOR USER (chưa được duyệt triển khai) |
| 15 | Audit log (M-E) | `audit_log` append-only, `write_audit`, allowlist payload, RLS đọc | DESIGNED (dossier M-E, đã duyệt) | IMPLEMENTED (`20260923000010_audit_log.sql`; bổ sung `20260923000011_audit_log_reference_check.sql`) | TESTED (DB local): `audit_log.test.sql` 8 test + `audit_log_reference.test.sql` 10 test; `test db` 51/51 PASS (7 file) sau `db reset` | — | IMPLEMENTED + TESTED (DB local) – PENDING ACCEPTANCE; chưa ACCEPTED |
| 16 | Module 1 (theo tracker) | — | UNVERIFIED | NOT_STARTED | — | — | NOT_STARTED |
| 17 | Modules 3–13 (theo tracker) | Chấm công, công việc, nhật ký công trường, vật tư, báo cáo, v.v. | UNVERIFIED (chỉ có PRD) | NOT_STARTED (tracker chưa đánh dấu; không có code tương ứng đã xác minh) | — | — | NOT_STARTED |
| 18 | Kotlin/Android build | Build Android | — | IMPLEMENTED (cấu trúc `apps/mobile/android/` có) | BLOCKED – Kotlin ICE, log thiếu | — | BLOCKED |

**Ghi chú:**
- "Nghiệm thu" cho mọi module: không có hạng mục nào ACCEPTED.
- Module 1 và 3–13 "NOT_STARTED" dựa trên tracker và việc không tìm thấy code tương ứng trong phiên đọc này; chưa rà soát toàn bộ cây thư mục từng module.

---

## 4. Tiến độ kỹ thuật

| Lĩnh vực | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|
| Frontend web | IMPLEMENTED (module Worker) | `apps/web/src/features/workers/`; `pnpm typecheck` web PASS; `vite build` PASS (log cũ 2026-11-18 12:50) | Chunk JS 500.85 kB (cảnh báo > 500 kB) |
| Mobile app | IMPLEMENTED (vertical slice Worker, auth, sync runtime) | `apps/mobile/src/**`; `pnpm typecheck` mobile PASS | Chưa có bằng chứng chạy trên thiết bị |
| Backend / API | UNVERIFIED | Dự án dùng Supabase trực tiếp; chưa đọc đủ `supabase/functions` | — |
| Database | IMPLEMENTED | `supabase/migrations/` (006, 007a, 008, 007b) | Xem Mục 5 |
| Authentication | IMPLEMENTED (mobile); UNVERIFIED (web) | `apps/mobile/src/auth/session.ts` | — |
| Authorization / RBAC / RLS | IMPLEMENTED một phần; TESTED (DB local, theo tracker) | `supabase/tests/rls/*.test.sql` | Hook `custom_access_token_hook` chọn một membership (`004`); chưa thay đổi theo chỉ đạo |
| Offline database | IN_PROGRESS | `apps/mobile/src/database/watermelon.ts` | Chưa có native smoke test |
| Outbox / Sync engine | IMPLEMENTED; TESTED (unit/integration với fake) | `packages/sync-engine/src/**`; 65 test PASS | Chưa có test trên Supabase thật từ app |
| Sync trigger từ app | IMPLEMENTED (code) | `App.tsx:36-53`, `use-auto-sync.ts` | Kích hoạt khi mount có mạng và khi offline → online; không có timer/retry từ hook |
| Tích hợp bên ngoài | UNVERIFIED | — | Không có bằng chứng |
| Build & triển khai | Build web/workspace PASS (cục bộ); deploy UNVERIFIED | `pnpm typecheck` 10/10; `apps/web/.turbo/turbo-build.log` | Không có deploy thật |
| CI/CD | MISSING EVIDENCE | 4 workflow tồn tại: `build-test.yml`, `db-test.yml`, `architecture-check.yml`, `deploy.yml` (`.github/workflows/`) | Không có log run GitHub Actions |
| Bảo mật & phân quyền | IN_PROGRESS | ADR-001, 007b; tracker mục 2.2 "chưa làm" | Chưa có security audit |

---

## 5. Tiến độ Database và Migration

Phân biệt: đã viết (file tồn tại) / đã chạy local / đã chạy staging / đã chạy production.

| Migration | Mục đích | Đã viết | Chạy local | Chạy staging | Chạy production | Kết quả test | Rollback đã kiểm tra | Cần nghiệm thu | Vấn đề |
|---|---|---|---|---|---|---|---|---|---|
| 001–005 (nền tảng, hook, RLS hardening) | Nền tảng, tenant, hook | Có | Có (theo tracker) | MISSING EVIDENCE | UNVERIFIED | Theo tracker | UNVERIFIED | Chưa | Hook chọn một membership; claims cố định đến khi JWT hết hạn |
| 006 | Migration sync/worker (theo tracker) | Có | Có; `test db` 11 test PASS (theo tracker) | MISSING EVIDENCE | UNVERIFIED | 11 pgTAP theo tracker | UNVERIFIED | Chưa | Chưa chạy lại trong phiên này |
| 007a (`unique(user_id)` bỏ) | Gỡ ràng buộc | Có | Có (theo tracker) | MISSING EVIDENCE | UNVERIFIED | `membership.test.sql` (theo tracker) | UNVERIFIED | Chưa | — |
| 008 `project_viewer_role` | Thêm role PROJECT_VIEWER | Có | Có | MISSING EVIDENCE | UNVERIFIED | 7 test (theo tracker) | UNVERIFIED | Chưa | — |
| 010 `audit_log` (M-E) | Bảng audit append-only, `write_audit`, allowlist payload | Có: `20260923000010_audit_log.sql` | Có: `db reset` OK; `test db` 41/41 PASS trên 6 file; kiểm bảo mật 10 kịch bản (local, transaction rollback) | Đã chạy trên DB local | Có – cần nghiệm thu | Có, đã kiểm trên DB local: bảng rỗng gỡ đủ đối tượng; bảng có dữ liệu bị từ chối, bảng còn nguyên. Sau đó `db reset` + `test db` 41/41 PASS | 8 test `audit_log.test.sql` + 10 kịch bản kiểm chứng (chưa đưa vào pgTAP) | Có – PENDING ACCEPTANCE. **Lỗ hổng:** `write_audit` không kiểm `project_company_id` thuộc `project_id` (K1, K2 được chấp nhận). Cần migration bổ sung riêng, chờ duyệt | Quyền đọc tạm dựa vào `SYS_ADMIN`, sẽ đổi ở M-A. Không có nhánh đọc theo project (đưa vào M-A/M-D) |
| 007b `project_memberships` | project_companies, project_memberships, helper | Có: `20260923000009_project_memberships.sql` | Có: `db reset` OK; `test db` 33/33 (theo tracker) | MISSING EVIDENCE | UNVERIFIED | 15 test `project_membership.test.sql` | Có rollback SQL (`supabase/rollbacks/20260923000009_project_memberships.down.sql`); đã chạy local (theo tracker) | **Có – PENDING ACCEPTANCE** | Audit backfill chỉ chạy trên DB rỗng (toàn bộ 0), không có dữ liệu thật để xác nhận backfill. `is_project_member` không lọc `projects.deleted_at`. Kiểm tra `is_main_contractor_manager` còn literal `'SITE_MANAGER'` |
| 007c | Role mapping SITE_MANAGER | Chưa | — | — | — | — | — | — | WAITING FOR USER (chưa duyệt) |
| 007d | Soft-delete / restore project | Chưa | — | — | — | — | — | — | WAITING FOR USER |
| 007e | Hardening / audit | Chưa | — | — | — | — | — | — | WAITING FOR USER |
| 011 `audit_log_reference_check` (M-E bổ sung) | `write_audit` kiểm `project_company_id` thuộc `project_id`, project tồn tại/chưa xóa, khớp tenant | Có: `20260923000011_audit_log_reference_check.sql` (redefine `write_audit`, không sửa 010) | Có: `audit_log_reference.test.sql` 10 test PASS; `test db` 51/51 PASS | Rollback `supabase/rollbacks/20260923000011_audit_log_reference_check.down.sql` chạy trong transaction ROLLBACK: hàm trở về bản 010 (0 kiểm tra mới), không đụng `audit_log` | Đã chạy trên DB local; rollback có dữ liệu chưa thực hiện (rollback chỉ thay hàm, không chạm bảng) | Chưa | IN_PROGRESS → hoàn tất kiểm thử local; chờ nghiệm thu M-E | 10 test: hợp lệ (tenant, project, both), sai (company thiếu project, company của project khác, company không tồn tại, tenant không sở hữu project, không phải thành viên, project đã xóa mềm, quyền đã thu hồi) | Chưa ACCEPTED | — |
| M-A…M-F | Dossier thiết kế | Có bản nháp: `docs/adr/ADR-001-migration-dossiers.md` | — | — | — | — | — | — | M-A: DESIGN ONLY / WAITING FOR USER APPROVAL; M-B…M-F chưa bắt đầu |

**Lưu ý:** Không có bằng chứng dữ liệu production hoặc staging. Mọi kết luận về backfill trên dữ liệu thật là **MISSING EVIDENCE**.

---

## 6. Kết quả kiểm thử

### 6.1 Chạy trong phiên này (2026-11-18)

| Lệnh | Thời điểm | Kết quả | Ghi chú |
|---|---|---|---|
| `pnpm test` (`vitest run`) | 2026-11-18 ~18:48 | **20/20 file PASS; 65/65 test PASS**; không FAIL | Quét `packages/*`, `apps/web`, `apps/mobile`, `tests/unit`, `tests/integration`; không quét `tests/e2e` |
| `pnpm typecheck` (turbo) | 2026-11-18 ~18:49 | **10/10 task thành công**, exit 0 | Không dùng cache |

Cảnh báo không phải lỗi: vite config loader native (`vitest.config.ts` dùng ESM).

### 6.2 Kết quả đã có từ trước (chỉ ghi nhận, chưa chạy lại)

| Nguồn | Nội dung | Mức xác minh |
|---|---|---|
| `apps/web/.turbo/turbo-build.log` (2026-11-18 12:50) | `vite build` thành công, 157 module, 3.99s | Log cục bộ, có bằng chứng |
| `apps/mobile/.turbo/turbo-build.log` và `turbo-typecheck.log` | Chỉ có dòng lệnh `tsc --noEmit`, không có kết quả | MISSING EVIDENCE |
| `supabase test db` (theo `docs/3_TRACKER.md`) | 33/33 PASS: helpers 3, membership 5, project_membership 15, project_viewer 7, workers 3 | UNVERIFIED trong phiên này; ghi theo tracker |
| Migration 006 `test db` | 11 pgTAP PASS (theo tracker) | UNVERIFIED trong phiên này |
| CI GitHub Actions (`db-test`, `build-test`) | Repo `nguyenlevel/congtruong_pro_V1` rỗng: 0 run, 0 workflow, 0 branch, 0 commit (kiểm tra 2026-11-19 09:44) | NOT FOUND (không có run để báo cáo) |
| Android build | Không có log | MISSING EVIDENCE |
| E2E (`tests/e2e/supabase-health.test.ts`) | Không chạy trong `pnpm test` (bị loại trừ) | MISSING EVIDENCE |
| Thiết bị/emulator | Không có bằng chứng | MISSING EVIDENCE |

### 6.3 Chưa được kiểm thử
- Sync trên thiết bị/emulator với Supabase thật.
- Offline thật (tắt mạng) và tự động đồng bộ khi bật lại.
- Retry, idempotency, xử lý xung đột trên dữ liệu thật.
- Các module 1, 3–13.
- Rollback 007b trên DB có dữ liệu thật.
- Đăng nhập/đăng xuất trên thiết bị.

---

## 7. Danh sách công việc còn tồn đọng

| STT | Công việc | Mức ưu tiên | Phụ thuộc | Trạng thái | Đề xuất tiếp theo |
|---|---|---|---|---|---|
| 1 | Người dùng nghiệm thu 007b | Cao | Quyết định của người dùng | WAITING FOR USER | Người dùng xem xét và xác nhận hoặc từ chối |
| 2 | Cung cấp log Android build đầy đủ (Kotlin ICE) | Cao | Máy build của người dùng | MISSING EVIDENCE | Cung cấp `android-build*.log`, `java -version`, `gradle-wrapper.properties` |
| 3 | Cung cấp thông tin git (repo gốc, branch, commit) | Cao | Người dùng | UNVERIFIED | Cung cấp repo hoặc output `git status`/`git log -5` |
| 4 | Cung cấp log GitHub Actions `db-test` và `build-test` | Cao | Quyền GitHub | MISSING EVIDENCE | Cung cấp link run gần nhất hoặc owner/repo |
| 5 | Xác minh sync trên emulator/thiết bị (online/offline) | Cao | Item 2 (môi trường Android) | MISSING EVIDENCE | Chạy kịch bản trên emulator sau khi build được |
| 6 | Cập nhật tracker dòng 29 (sync "chưa gọi tự động") theo code | Trung bình | Xác nhận của người dùng | WAITING FOR USER | Người dùng xác nhận trước khi cập nhật |
| 7 | Hoàn thiện ADR-001 bản chính thức | Trung bình | Duyệt M-A…M-F | WAITING FOR USER | Chốt sau khi người dùng duyệt |
| 8 | Thiết kế chi tiết M-A…M-F | Trung bình | — | IN_PROGRESS (bản nháp) | Hoàn thiện, chờ duyệt |
| 9 | Giá trị JWT TTL trên Dashboard | Đã có: 3600 giây (người dùng cung cấp) | Người dùng | USER-PROVIDED | Cần giữ nguyên theo D-JWT; không đổi cấu hình |
| 10 | Staging có dữ liệu ẩn danh và audit read-only | Trung bình | Người dùng | MISSING EVIDENCE | Xác nhận staging tồn tại và cung cấp quyền |
| 11 | Chạy lại `supabase test db` để xác minh 33/33 trong phiên hiện tại | Trung bình | Docker/Supabase local | UNVERIFIED | Chạy khi người dùng cho phép (lệnh có `db reset`) |
| 12 | Module 3–13 | Thấp (theo lộ trình) | Quyết định phạm vi | NOT_STARTED | Lập kế hoạch sau khi nền tảng ổn định |
| 13 | Security audit (tracker 2.2) | Trung bình | — | NOT_STARTED | Lập lịch sau 007 |
| 14 | Deploy và EAS packaging (tracker 2.3) | Thấp | Build Android | NOT_STARTED | Sau khi build Android ổn định |

---

## 8. Bug và rủi ro

### Critical
- Không ghi nhận lỗi Critical đã xác minh trong phiên này.

### High
- **H1 – Android build bị chặn (Kotlin ICE).** Bằng chứng: tracker và lịch sử phiên. Log `Caused by` chưa có. Ảnh hưởng: không build được APK/AAB, không test sync trên emulator. Xử lý đề xuất: cung cấp log (Mục 7 item 2); không đổi phiên bản Kotlin/AGP khi chưa có log.
- **H2 – Dữ liệu backfill chưa được xác minh.** Bằng chứng: `supabase/audit/project_membership_backfill_audit.sql` chỉ chạy trên DB rỗng (toàn bộ 0 theo tracker). Ảnh hưởng: không kết luận được backfill an toàn trên dữ liệu thật. Xử lý: audit read-only trên staging ẩn danh (chờ người dùng).
- **H3 – Hàm `is_project_member` không lọc project đã xóa mềm.** Bằng chứng: `supabase/migrations/20260923000009_project_memberships.sql` (helper ~dòng 83–102, theo ghi chú phiên trước). Ảnh hưởng: truy cập dữ liệu nghiệp vụ của project đã xóa mềm. Xử lý: đưa vào 007d theo quyết định Q1.3 đã nêu, chưa sửa 007b.
- **H4 – Literal role trong RLS và helper.** Bằng chứng: `is_main_contractor_manager` so sánh `'SITE_MANAGER'` (007b); policy 002–004 dùng literal `'SYS_ADMIN'`, `'SITE_MANAGER'`, `'SUB_CONTRACTOR'`, `'MAIN_BOD'`. Ảnh hưởng: đổi role mapping (007c) có thể làm sai quyền nếu không cập nhật đồng bộ. Xử lý: xử lý trong 007c sau khi được duyệt.
- **H5 – Thu hồi quyền phụ thuộc JWT.** Bằng chứng: hook chọn một membership (`004`), claims cố định đến khi JWT hết hạn. Ảnh hưởng: quyền cũ có thể còn hiệu lực đến khi token hết hạn. Xử lý: kiểm tra quyền từ DB là cơ chế bắt buộc theo D2 đã duyệt; cần đối chiếu thêm với code hiện tại.

### Medium
- **M1 – Trạng thái sync trong tracker mâu thuẫn với code.** Bằng chứng: `docs/3_TRACKER.md:29` ghi "chưa gọi tự động từ app", trong khi `apps/mobile/src/app/App.tsx:36-53` và `use-auto-sync.ts` cho thấy đã gọi. Xử lý: người dùng xác nhận trước khi sửa tracker.
- **M2 – `useAutoSync` không có retry/timer.** Bằng chứng: `apps/mobile/src/sync/use-auto-sync.ts`. Ảnh hưởng: nếu sync lỗi khi đang online, không có tự động thử lại từ hook. Xử lý: kiểm tra retry trong sync engine và bổ sung kiểm thử trên thiết bị.
- **M3 – Chưa có test trên thiết bị.** Bằng chứng: không có log emulator/thiết bị. Ảnh hưởng: không xác nhận được hành vi offline thật.
- **M4 – Chunk web 500.85 kB.** Bằng chứng: `apps/web/.turbo/turbo-build.log`. Ảnh hưởng: hiệu năng tải trang; không chặn chức năng.
- **M5 – Cấu hình `vitest.config.ts` dùng ESM trong môi trường CJS.** Bằng chứng: cảnh báo khi chạy `pnpm test`. Ảnh hưởng: cảnh báo, không lỗi hiện tại.

### Low
- **L1 – Không có git repo.** Ảnh hưởng: không kiểm chứng được lịch sử thay đổi.
- **L2 – Tracker tự ghi "Cập nhật lần cuối" nhưng có mục lỗi thời.** Bằng chứng: `docs/3_TRACKER.md` (xem M1).

---

## 9. Các quyết định đang chờ người dùng

Các mục dưới đây **chưa được phê duyệt**. Không chuyển thành quyết định đã duyệt trong báo cáo này.

| Mã | Nội dung | Trạng thái |
|---|---|---|
| 007b | Nghiệm thu migration project membership | WAITING FOR USER (giữ PENDING ACCEPTANCE) |
| 007c | Triển khai role mapping SITE_MANAGER | WAITING FOR USER – chưa được phép triển khai |
| 007d, 007e | Soft-delete/restore, hardening/audit | WAITING FOR USER |
| M-A…M-F | Duyệt thiết kế chi tiết | WAITING FOR USER |
| D-AUD | Thiết kế audit log trước chức năng đặc quyền | Chờ duyệt |
| ADR-001 | Cập nhật bản chính thức | WAITING FOR USER |
| Tracker dòng 29 | Sửa trạng thái sync theo code | WAITING FOR USER |
| JWT TTL | 3600 giây (1 giờ) theo người dùng cung cấp từ Supabase Dashboard; chưa đối chiếu được trong repo (`config.toml` không có `jwt_expiry`) | USER-PROVIDED (chưa độc lập xác minh) |
| Staging | Xác nhận tồn tại và cấp quyền audit read-only | WAITING FOR USER |

---

## 10. Kế hoạch giai đoạn tiếp theo

Thứ tự đề xuất (không phải quyết định đã duyệt):

1. **Thu thập bằng chứng còn thiếu** (chờ người dùng): log Android, log CI, thông tin git, JWT TTL.
2. **Nghiệm thu 007b** (người dùng quyết định) hoặc ghi nhận yêu cầu sửa.
3. **Hoàn thiện ADR-001 và M-A…M-F** theo phản hồi người dùng.
4. **Audit read-only trên staging ẩn danh** (khi có staging và quyền).
5. **Xử lý Android build** khi có log, rồi kiểm thử sync trên emulator (online/offline/retry/idempotency).
6. **Triển khai 007c** chỉ sau khi người dùng duyệt thiết kế.
7. **Sau 007c:** 007d (soft-delete, sửa helper bằng migration bổ sung), 007e.

**Điều kiện bắt đầu cho từng bước:** bước 1 cần người dùng cung cấp dữ liệu; bước 3 cần duyệt; bước 6 cần duyệt M-A…M-F và nghiệm thu 007b hoặc quyết định riêng.

**Tiêu chí hoàn thành:** mỗi bước có test PASS được chạy và ghi lại, và người dùng xác nhận nghiệm thu bằng văn bản.

---

## 11. Thông tin còn thiếu và cần bổ sung

| STT | Dữ liệu còn thiếu | Bằng chứng cần cung cấp | Người cần thực hiện | Ảnh hưởng đến đánh giá tiến độ |
|---|---|---|---|---|
| 1 | Git branch, commit, remote, thay đổi chưa commit | Repo gốc, hoặc output `git status`, `git log -5` | Người dùng | Không xác minh được trạng thái code theo commit; mục Git ở Mục 1 là UNVERIFIED |
| 2 | Kết quả GitHub Actions (`db-test`, `build-test`) | Link run gần nhất hoặc owner/repo | Người dùng | Không có TESTED từ CI; mọi kết quả CI là MISSING EVIDENCE |
| 3 | Log Android build và Kotlin ICE | `android-build*.log` đầy đủ, `java -version`, `gradle-wrapper.properties` | Người dùng | Không xác định được nguyên nhân BLOCKED; không xếp Android build là TESTED |
| 4 | Bằng chứng chạy trên thiết bị/emulator | Log hoặc ảnh chụp kịch bản online/offline/sync | Người dùng hoặc AI sau khi build được | Không xác nhận tính năng offline và sync hoạt động trên thiết bị |
| 5 | Chạy lại `supabase test db` trong phiên hiện tại | Output lệnh (cần cho phép `db reset` local) | Người dùng cho phép; AI thực hiện | Số 33/33 chỉ theo tracker; chưa tự xác minh |
| 6 | JWT TTL hiệu lực | Giá trị trên Supabase Dashboard | Người dùng | Ảnh hưởng đánh giá rủi ro H5 |
| 7 | Staging có dữ liệu ẩn danh | Xác nhận tồn tại, cấp quyền audit read-only | Người dùng | Không kết luận được backfill trên dữ liệu thật (H2) |
| 8 | Số lượng membership, tài khoản SITE_MANAGER/SYS_ADMIN | Kết quả audit read-only (chỉ sau khi có quyền) | Người dùng/DBA | Không tính được số liệu thực tế cho M-A…M-F |
| 9 | Phiên bản sản phẩm (version/tag) | Tag hoặc quy ước phiên bản | Người dùng | Mục "Phiên bản" là UNVERIFIED |
| 10 | Trạng thái module 1, 3–13 đã có code chưa | Xác nhận hoặc danh sách file đã biết | Người dùng hoặc AI rà soát thêm | Có thể đánh giá sai NOT_STARTED nếu có code chưa được rà soát |
| 11 | Bằng chứng web auth và web workflow | Kết quả test/chạy thử web | AI (rà soát) hoặc người dùng | Mục auth web là UNVERIFIED |
| 12 | Trạng thái nghiệm thu chính thức | Văn bản nghiệm thu của người dùng | Người dùng | Không có ACCEPTED nào được ghi nhận |

**Ảnh hưởng tổng thể:** Nếu thiếu các mục 1–3, báo cáo chưa thể kết luận về CI, build và trạng thái code theo commit. Nếu thiếu mục 4, không có bằng chứng cho tính năng offline/sync trên thiết bị. Nếu thiếu mục 6–8, không đánh giá được rủi ro RBAC và backfill trên dữ liệu thật.

---

## 12. Đánh giá của AI

### 12.1 Sự kiện đã xác minh (VERIFIED)
- Repo không phải git repository tại thời điểm kiểm tra.
- `pnpm typecheck` 10/10 thành công; `pnpm test` 65/65 test PASS (20 file).
- Có 4 workflow CI trong `.github/workflows/`.
- App mobile gọi `createWorkerSyncRuntime` và `useAutoSync` khi đăng nhập (`apps/mobile/src/app/App.tsx:36-53`).
- Migration 007b, 008, 006, 007a tồn tại trong `supabase/migrations/`.
- Không có log build Android trong repo.

### 12.2 Nhận định của AI (không phải sự kiện đã xác minh)
- Dự án đang ở giai đoạn nền tảng; module nghiệp vụ chủ yếu chưa bắt đầu. Đánh giá này dựa trên tracker và việc không tìm thấy code tương ứng, chưa phải kiểm tra toàn bộ cây thư mục.
- Điểm làm tốt: kiến trúc tách rõ (domain, contracts, sync-engine), test unit và typecheck ổn định, RBAC có ADR và dossier trước khi triển khai.
- Vấn đề cần giải quyết: build Android bị chặn; bằng chứng CI và thiết bị thiếu; tracker có mâu thuẫn; helper RLS chưa lọc soft-delete; literal role trong RLS.
- Rủi ro tiến độ: nếu Android build không được xử lý, không kiểm thử được sync trên thiết bị; nếu backfill không có dữ liệu thật để audit, 007c và các bước sau có thể phải làm lại.
- Ưu tiên: thu thập bằng chứng còn thiếu (Mục 11), nghiệm thu 007b, duyệt M-A…M-F, sau đó mới triển khai 007c.

---

## 13. Nguồn bằng chứng

| Kết luận | Nguồn |
|---|---|
| Không phải git repository | Lệnh `git rev-parse --is-inside-work-tree`, `git remote -v`, `git branch --show-current`, `git status --short`, `git log -5 --oneline` (2026-11-18) → `fatal: not a git repository` |
| 4 workflow CI | `.github/workflows/build-test.yml`, `db-test.yml`, `architecture-check.yml`, `deploy.yml` |
| Nội dung `db-test` (supabase start/reset/test db) | `.github/workflows/db-test.yml` dòng 29–36 |
| Test PASS 65/65 | Lệnh `pnpm test` ngày 2026-11-18 ~18:48 (output: Test Files 20 passed, Tests 65 passed) |
| Typecheck 10/10 | Lệnh `pnpm typecheck` ngày 2026-11-18 ~18:49 (Tasks: 10 successful) |
| Web build OK | `apps/web/.turbo/turbo-build.log` (2026-11-18 12:50) |
| Mobile turbo log không có kết quả | `apps/mobile/.turbo/turbo-build.log`, `turbo-typecheck.log` (15 byte, chỉ có dòng lệnh) |
| Không có log Android | Tìm `*.log` toàn repo (ngoài node_modules) → chỉ có `.turbo/*.log` |
| Android Kotlin | `apps/mobile/android/build.gradle:11`, `apps/mobile/android/app/build.gradle:2`; `gradle.properties` không pin version Kotlin |
| Sync trigger từ app | `apps/mobile/src/app/App.tsx:36-53`; `apps/mobile/src/sync/use-auto-sync.ts` |
| Sync runtime gọi createSyncEngine | `apps/mobile/src/sync/sync-runtime.ts:83-85` |
| Mâu thuẫn tracker sync | `docs/3_TRACKER.md:29` (chưa gọi tự động) và `:82` (đã có tự sync) |
| Test sync và worker | `apps/mobile/src/sync/sync-runtime.test.ts`, `packages/sync-engine/src/engine/create-sync-engine.test.ts`, `tests/integration/sync-engine-flow.test.ts` |
| Trạng thái 007b | `docs/3_TRACKER.md` (33/33 theo tracker); migration `supabase/migrations/20260923000009_project_memberships.sql`; `supabase/tests/rls/project_membership.test.sql` |
| Migration 008 | `supabase/migrations/20260923000008_project_viewer_role.sql` |
| Rollback 007b | `supabase/rollbacks/20260923000009_project_memberships.down.sql` |
| Audit backfill chỉ DB rỗng | `supabase/audit/project_membership_backfill_audit.sql`; `docs/3_TRACKER.md` ghi kết quả 0 trên DB rỗng |
| Roles seed | `supabase/seed/roles.sql` (5 role: SYS_ADMIN, PROJECT_VIEWER, SITE_MANAGER, SUB_CONTRACTOR, WORKER) |
| Literal role trong RLS | `supabase/migrations/20260923000009_project_memberships.sql` (`is_main_contractor_manager`), `20260923000004_rls_hardening.sql` |
| Hook claims | `supabase/migrations/20260923000004_rls_hardening.sql` (hook chọn membership `order by created_at, id limit 1`) |
| JWT TTL chưa có | `supabase/config.toml` không có `jwt_expiry` |
| Dossier M-A…M-F | `docs/adr/ADR-001-migration-dossiers.md` |
| Permission matrix, Q-PM | `docs/adr/ADR-001-monorepo.md` |
| Phạm vi sản phẩm | `docs/product/prd.md` |

---

## 14. Lịch sử cập nhật

| Lần | Ngày giờ (+07) | Phiên | Nội dung thay đổi | Ghi chú |
|---|---|---|---|---|
| 1 | 2026-11-18 18:51 | Tạo mới | Tạo `tiendo.md` từ bằng chứng đã xác minh trong phiên: git (không có), test vitest 65/65 PASS, typecheck 10/10, CI workflow tồn tại, sync trigger từ app, các mục thiếu được ghi UNVERIFIED/MISSING EVIDENCE | Không có thay đổi code, DB, migration, RLS, cấu hình hay tài liệu khác. Không có mục ACCEPTED |
| 2 | 2026-11-18 18:57 | Di chuyển | Chuyển file từ thư mục gốc sang `docs/tiendo.md` theo yêu cầu. Nội dung giữ nguyên | Không có thay đổi nội dung, code, DB, migration, RLS hay cấu hình. Không có mục ACCEPTED |
| 6 | 2026-11-18 19:15 | Thiết kế | Người dùng duyệt thứ tự triển khai M-E → M-A → M-B → M-C → M-D → M-F. Ghi vào `ADR-001-migration-dossiers.md` mục 14. Còn mở: danh sách trường `payload` của `audit_log` (T-ME-05) | Không có thay đổi code, DB, migration, RLS hay cấu hình. 007b vẫn IMPLEMENTED + TESTED – PENDING ACCEPTANCE. 007c chưa triển khai. Không có mục ACCEPTED |
| 5 | 2026-11-18 19:13 | Thiết kế | Bổ sung mục 13 vào `docs/adr/ADR-001-migration-dossiers.md`: SQL outline và test ID (T-MA-01 đến T-MF-05) cho M-A đến M-F, cùng phạm vi test chung và trạng thái mục 14. Chưa tạo migration, chưa chạy SQL, chưa sửa RLS, role, hook hay code | Không có thay đổi code, DB, migration, RLS hay cấu hình. 007b vẫn IMPLEMENTED + TESTED – PENDING ACCEPTANCE. 007c chưa triển khai. Không có mục ACCEPTED |
| 4 | 2026-11-18 19:02 | Thiết kế | Người dùng duyệt Q-D1 đến Q-D4 trong `docs/adr/ADR-001-migration-dossiers.md` (Q-D4: thêm `COMPANY_ADMIN`, `PROJECT_MANAGER`, `SITE_SUPERVISOR` vào `roles` ở M-A) và danh sách trường Q-PM-1/Q-PM-3. Chưa mở rộng SQL outline và test case ID; người dùng sẽ tự mở rộng hồ sơ M-A đến M-F | Không có thay đổi code, DB, migration, RLS hay cấu hình. 007c chưa triển khai. 007b vẫn IMPLEMENTED + TESTED – PENDING ACCEPTANCE. Không có mục ACCEPTED |
| 3 | 2026-11-18 18:59 | Quy trình | Ghi nhận yêu cầu: sau mỗi lần thực hiện việc gì (thay đổi file, chạy kiểm thử, có bằng chứng mới), AI chủ động cập nhật `docs/tiendo.md`, không chờ người dùng nhắc | Không có thay đổi code, DB, migration, RLS hay cấu hình. Không có mục ACCEPTED. Các mục UNVERIFIED/MISSING EVIDENCE giữ nguyên |
| 7 | 2026-11-18 19:30 | Triển khai M-E | Người dùng duyệt payload `audit_log` (project_id, project_company_id, target_user_id, reason, role_before, role_after) và cho chạy local. Tạo `supabase/migrations/20260923000010_audit_log.sql`, rollback và `supabase/tests/rls/audit_log.test.sql`. Chạy `npx supabase@3.2.0 start`, `db reset` (11 migration áp dụng OK, seed OK), `test db`: 6 file, 41 test, **PASS** | Chỉ thay đổi DB local (reset). Không chạy production. 007b vẫn IMPLEMENTED + TESTED – PENDING ACCEPTANCE. 007c/007d/007e chưa triển khai. Không có mục ACCEPTED. Lưu ý: lịch sử các dòng 3–6 không đúng thứ tự thời gian, giữ nguyên để không sửa lịch sử |
| 9 | 2026-11-18 19:45 | Kiểm chứng bảo mật M-E (local) | 10 kịch bản `write_audit`/RLS trong transaction ROLLBACK. Bị từ chối đúng: thiếu scope (22023), payload có khóa ngoài allowlist (22023), payload là mảng (22023), project-only bởi người không thuộc project (42501), ghi chéo tenant (42501), anon (42501), INSERT trực tiếp (42501). **Lỗ hổng xác nhận:** K1 `project_company_id` của project khác vẫn được chấp nhận; K2 `project_company_id` không tồn tại vẫn được chấp nhận. Chưa sửa migration 010; đề xuất migration bổ sung riêng, chờ duyệt | Chỉ thay đổi DB local, mọi thao tác trong transaction ROLLBACK. Không sửa migration/RLS/code. M-E vẫn IMPLEMENTED + TESTED – PENDING ACCEPTANCE; NOT DEPLOYED; chưa ACCEPTED. M-A chưa triển khai |
| 8 | 2026-11-18 20:10 | Kiểm chứng M-E (local) | Kiểm rollback trong transaction có ROLLBACK trên DB local: bảng có dữ liệu bị từ chối (`audit_log has rows`), bảng còn nguyên; bảng rỗng gỡ đủ đối tượng (làm ở bước trước). Kiểm RLS: bản ghi chỉ có `project_id` (tenant_id null) không đọc được bởi user tenant A (0 dòng); user bị xóa membership không đọc được (0 dòng). Phát hiện: `write_audit` không kiểm `project_company_id` thuộc project; RLS đọc không có nhánh project. Chưa có test cho các trường hợp này | Chỉ thay đổi DB local, mọi thao tác thử nằm trong transaction ROLLBACK. Không có thay đổi migration/RLS/code. M-E vẫn IMPLEMENTED + TESTED – PENDING ACCEPTANCE; NOT DEPLOYED. 007b vẫn PENDING ACCEPTANCE. Không có mục ACCEPTED |
| 10 | 2026-11-18 21:00 | Bổ sung M-E (local) | Rà soát 010 và xác nhận lỗ hổng K1/K2 (chỉ kiểm project_id/project_company_id tồn tại độc lập). Tạo migration `20260923000011_audit_log_reference_check.sql` (redefine `write_audit`, cùng chữ ký), rollback `.down.sql` (khôi phục bản 010, không xóa audit), pgTAP `audit_log_reference.test.sql` 10 test. Chạy `db reset` (11 → 12 migration, seed OK) và `test db`: 7 file, 51 test, **PASS**. Kiểm rollback trong transaction ROLLBACK: hàm trở về bản 010 | Chỉ thay đổi DB local. Không staging/production. Không sửa 010, RLS, role, hook hay code. M-E vẫn PENDING ACCEPTANCE; chưa ACCEPTED. Chưa kiểm rollback với dữ liệu audit thực tế (rollback không chạm bảng). M-A chỉ là bản thiết kế, chưa phê duyệt, chưa tạo migration |
| 11 | 2026-11-18 21:30 | Audit MVP | Tạo `MVP_COMPLETION_AUDIT.md` ở thư mục gốc: kiểm kê module, 8 P0 blocker, P1–P3, bảng bằng chứng, lộ trình, tiêu chí nghiệm thu, 9 quyết định cần duyệt. Đối chiếu code: không có module chấm công, công việc, nhật ký, vật tư, báo cáo, nhà thầu phụ; không có UI công ty/dự án; không có bug tracker | Chỉ đọc code, không chạy test lại, không sửa code/DB/migration/RLS/cấu hình. Không có mục ACCEPTED. M-E, 011, 007b giữ PENDING ACCEPTANCE. M-A giữ DESIGN ONLY / WAITING FOR USER APPROVAL |
| 12 | 2026-11-18 22:00 | Thu thập bằng chứng MVP (D) | Đã chạy `java -version`: lỗi "Failed setting boot class path" (JDK không khởi tạo được, phiên bản UNVERIFIED). `git rev-parse`: không phải git repository (exit 128), không có branch/commit/remote. Gradle wrapper: 9.4.1. Không tìm thấy log Android build/`Caused by` trong repo (chỉ có `.turbo` log web). Không tìm thấy cấu hình staging. CI: NOT ACCESSIBLE do thiếu owner/repo. JWT TTL: WAITING FOR USER. Cập nhật mục 12 `MVP_COMPLETION_AUDIT.md` thành bảng quyết định (A1–A4, B, C, D, E, F) | Chỉ đọc, không sửa code/DB/migration/RLS/JWT/cấu hình, không staging/production. Không đổi trạng thái M-E, 011, 007b (PENDING ACCEPTANCE). M-A giữ DESIGN ONLY / WAITING FOR USER APPROVAL. Không tăng % hoàn thành |
| 13 | 2026-11-19 09:20 | Thu thập bằng chứng Java và Android (D) | `where.exe java` → Temurin21-20260930 jdk-21.0.12.1+1. `java -version` lỗi "Failed setting boot class path". `lib\modules` thiếu. Không có `android-build*.log` trong repo | Chỉ đọc. Java: VERIFIED lỗi, nguyên nhân gốc UNVERIFIED. Android build: NOT FOUND |
| 14 | 2026-11-19 09:45 | Cập nhật JWT TTL | Người dùng cung cấp JWT TTL trên Supabase Dashboard = 3600 giây. Ghi nhận là USER-PROVIDED. Repo không có `jwt_expiry` trong `supabase/config.toml` nên không đối chiếu được từ code | Không đổi JWT TTL hay cấu hình. Chưa kiểm CI theo URL `https://github.com/nguyenlevel/congtruong_pro_V1.git` (còn pending). Không đổi trạng thái M-E, 007b, 011 |
| 15 | 2026-11-19 09:42 | Kiểm tra lại Java | `java -version` chạy trong terminal VS Code, output nguyên văn: "Error occurred during initialization of VM" / "Failed setting boot class path." (exit 1). Chưa chạy lệnh Gradle vì JVM chưa khởi tạo được. Không cài lại hay đổi Java theo chỉ đạo | Chỉ đọc. Android build log: chưa tạo (BLOCKED bởi Java). Chờ người dùng cài lại/sửa JDK rồi chạy lại |
| 16 | 2026-11-19 09:44 | Kiểm tra CI GitHub `nguyenlevel/congtruong_pro_V1` | Truy vấn GitHub API: `list_workflow_runs` = 0 run; `list_workflows` = 0; `list_branches` = rỗng; `list_commits` trả `409 Git Repository is empty`. Repo tồn tại nhưng chưa có commit, nên không có workflow run nào để báo cáo PASS/FAIL | Không có CI PASS. Trạng thái CI: NOT FOUND (repo rỗng). 4 workflow trong local chưa được đẩy lên remote. Không đổi code, DB, RLS, JWT, cấu hình. Không đổi trạng thái M-E, 007b, 011 |
| 17 | 2026-11-19 09:50 | Khởi tạo git và commit | Tạo git repo local (branch `main`), commit `5d16dab` gồm 222 file đã kiểm tra không chứa `.env`, keystore, `supabase/.temp`, `apps/web/dist`. Thêm remote `origin` = `https://github.com/nguyenlevel/congtruong_pro_V1.git`. `git push` thất bại: `Cannot prompt because user interactivity has been disabled` (exit 128), chưa có thông tin xác thực GitHub trên máy | PUSH: NOT DONE (chờ xác thực). `apps/mobile/android` bị `.gitignore` loại khỏi commit, nên Android project sẽ không có trên remote cho đến khi đổi quy tắc ignore (cần phê duyệt). Không đổi code, DB, RLS, JWT, cấu hình |
| 18 | 2026-11-19 10:05 | Java, Gradle, .gitignore, push | Cài Temurin 21.0.13.9 (winget). `java -version` = `Temurin-21.0.13+9` (VERIFIED). Đặt `JAVA_HOME` user = JDK 21.0.13.9 (thay JDK hỏng 21.0.12.1). `.gitignore`: bỏ ignore `apps/mobile/android`, thêm ignore `.gradle`, `local.properties`, keystore. Commit `9539064` chứa Android source. `gradlew assembleDebug` = **BUILD FAILED** (log: `apps/mobile/android/android-build.log`). Nguyên nhân gốc (VERIFIED): distribution Gradle 9.4.1 chứa `lib/kotlin-stdlib-2.3.0.jar` đưa vào compile classpath, còn plugin nội bộ `expo-modules-autolinking` (`expo-gradle-plugin/build.gradle.kts`) pin Kotlin 2.1.20 → lỗi "Incompatible classes"/"source must not be null" khi compile `expo-autolinking-settings-plugin`. RN 0.87.1 yêu cầu AGP 9.2.1 + Kotlin 2.2.0, nên không hạ Gradle về 8.x an toàn. Không có căn chỉnh cấu hình hợp lệ trong repo; cần upstream Expo hoặc phê duyệt đổi toolchain. Push: NOT DONE, môi trường tắt tương tác, không có thông tin xác thực GitHub (GCM chưa đăng nhập). | Android build: FAILED. Push: NOT DONE. GitHub CI: NOT FOUND (chưa có commit remote). M-E, 011, 007b giữ PENDING ACCEPTANCE. Không đổi migration, RLS, RBAC, JWT TTL |
| 19 | 2026-11-19 11:20 | Push GitHub và kiểm tra CI | Push `main` (commit `9539064`) lên `https://github.com/nguyenlevel/congtruong_pro_V1` thành công bằng PAT do người dùng cung cấp, dùng một lần qua URL, không lưu vào repo. `git ls-remote` xác nhận remote `refs/heads/main` = `9539064`. `origin` đã đặt lại URL sạch. CI (GitHub Actions, run `44452054855` và `44452054677`, 2026-11-19 03:31 UTC): "Architecture Guard" = SUCCESS; "Build & Test" = FAILURE ở step Lint (`eslint .`): 3 lỗi `@typescript-eslint/no-require-imports` trong `apps/mobile/plugins/with-gradle-wrapper.js`; Typecheck, Tests, Architecture guard, Build bị skip. | Push: DONE (VERIFIED). CI: Architecture Guard PASS; Build & Test FAIL (lint). Chưa sửa code: file plugin liên quan Gradle 9.4.1 nên chờ phê duyệt. PAT đã lộ trong chat, cần thu hồi. M-E, 011, 007b giữ PENDING ACCEPTANCE |
| 20 | 2026-11-19 11:46 | Sửa lint, push và xác nhận CI | Thêm override ESLint cho `apps/mobile/plugins/**/*.js` (commit `32072db`, giữ CommonJS). Local: lint, typecheck, test (65/65), architecture:check, build đều PASS. Push `9539064..32072db` thành công qua Credential Manager. CI Build & Test run `44460394646` = SUCCESS trên `32072db`. Đã cập nhật MVP_COMPLETION_AUDIT.md mục 5, 8. | Lint/CI Build & Test: PASS (VERIFIED). Android `assembleDebug` vẫn FAILED, chờ duyệt toolchain. PAT đã thu hồi (người dùng xác nhận). M-E, 011, 007b giữ PENDING ACCEPTANCE |
| 21 | 2026-11-19 11:52 | Kiểm tra môi trường db-test | Docker Engine 29.9.3 đang chạy. Supabase CLI không có trong PATH và không có trong package.json. Người dùng duyệt cài dạng devDependency: `pnpm add -D -w supabase` (supabase 3.2.0). | Môi trường: VERIFIED |
| 22 | 2026-11-19 12:00 | Chạy supabase start và supabase test db | `supabase start` OK (stack local, DB 127.0.0.1:54322). `supabase test db`: Files=7, Tests=51, Result: PASS. Cụ thể: helpers.sql ok; rls/audit_log, audit_log_reference, membership, project_membership, project_viewer, workers đều ok. CẢNH BÁO: `supabase/config.toml` có key `auth.expo_template` mà CLI 3.2.0 bỏ qua (không ảnh hưởng test). Không sửa migration, RLS, schema. | TESTED (pgTAP 51/51). M-E, migration 011, 007b giữ PENDING ACCEPTANCE; chưa ACCEPTED |
| 23 | 2026-11-19 15:00 | P1-04: `is_project_member` không lọc `projects.deleted_at` | Audit: hàm (migration 009) chỉ kiểm `project_memberships`; `write_audit` (011) đã kiểm `deleted_at` riêng. Policy `projects` SELECT (004) cũng không lọc `deleted_at`. Thêm `supabase/tests/rls/is_project_member.test.sql` (4 test: thành viên active, không phải thành viên, đã thu hồi, regression policy `project_companies`). Chưa chạy: Docker Desktop không chạy trong phiên này. Chưa tạo migration; bản sửa đề xuất chờ duyệt. | Chờ: chạy `npx supabase@3.2.0 test db` khi Docker chạy. Test soft-deleted chưa thêm vào vì sẽ fail trước migration |
| 24 | 2026-11-19 15:10 | Review gate P1-04 (chỉ đọc, không sửa file, không chạy migration) | (a) `audit_log_reference` ref-9 (project soft-deleted, expect 22023) đang PASS vì `is_project_member` chưa lọc `deleted_at`. Sau khi sửa hàm, ref-9 sẽ trả 42501; chưa có lần chạy nào ghi nhận FAIL. (b) Android `assembleDebug` FAILED: `SDK location not found`. Không có `ANDROID_HOME`/`local.properties`; SDK tồn tại tại `%LOCALAPPDATA%\Android\Sdk`. JDK 21.0.13 OK; Gradle wrapper 9.3.1; Kotlin 2.1.20. Lỗi Kotlin ICE cũ không tái hiện. Log: session files `android-build-review.log`. (c) Docker Desktop vẫn không chạy: pgTAP chưa chạy lại. (d) `supabase/config.toml` không khai báo `jwt_expiry`; giá trị 3600s chưa xác minh. | Chờ duyệt: migration 012; cách sửa ref-9; đặt `ANDROID_HOME` hoặc `local.properties`; nơi cấu hình JWT (config.toml hoặc Dashboard) |

| 25 | 2026-11-19 15:55 | Docker + pgTAP; Android SDK; JWT TTL local | (a) Docker Desktop khởi động từ `%LOCALAPPDATA%\Programs\DockerDesktop`; `supabase test db` PASS 8 file / 55 test (gồm 4 test `is_project_member`). (b) Android: đặt `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk` (User scope). SDK không còn lỗi `SDK location not found`. Lỗi mới: `expo-modules-core:buildCMakeDebug[arm64-v8a]` FAILED, `ninja: manifest 'build.ninja' still dirty after 100 tries`. Xóa `.cxx` không khắc phục; không có file future-dated. Trạng thái BLOCKED. Chưa đổi Kotlin/Gradle/RN. (c) `supabase/config.toml`: thêm `jwt_expiry = 3600` trong `[auth]`; restart local; token thử nghiệm: `expires_in=3600`, `exp - iat = 3600`. Tài khoản thử đã xóa. (d) Hosted Dashboard: chưa kiểm tra (không có quyền truy cập từ phiên này) → UNVERIFIED. (e) Migration 012: chưa tạo/áp dụng; ref-9 chưa đổi. | Chờ duyệt: migration 012 và cách sửa ref-9; kiểm tra hosted Dashboard JWT expiry; hướng xử lý `build.ninja` |
| 26 | 2026-11-20 11:10 | Thiết kế Migration 012 (P1-04 / ref-9) và điều tra tiếp | (a) Đọc schema thực: `project_memberships` (009) không có cột `revoked_at`/`deleted_at`/`status`; thu hồi = xóa dòng; membership hợp lệ = tồn tại dòng. `project_companies` không có `deleted_at`/`revoked_at`. (b) `write_audit` (011): kiểm tra membership trước trạng thái project, để người ngoài nhận 42501 và không biết project đã xóa. (c) Thiết kế (chưa tạo file, chưa chạy): migration 012 viết lại `is_project_member` (join `projects`, lọc `deleted_at`) và `write_audit` (membership raw trước, rồi `deleted_at`). Rollback khôi phục nguyên văn 009/011. Test đề xuất: `supabase/tests/rls/write_audit_membership.test.sql`, 13 ca. (d) Rủi ro còn lại: policy SELECT `projects` (004) không lọc `deleted_at`; `current_tenant_id()` đọc JWT claim; `is_main_contractor_manager` không lọc `deleted_at`; `write_audit` không kiểm `project_companies.status`; owner/BYPASSRLS và ACL trên DB thật chưa xác minh (MISSING EVIDENCE). | DESIGNED. Chưa IMPLEMENTED, chưa TESTED. Chờ duyệt SQL migration 012, rollback và test matrix. Không ACCEPTED |
| 27 | 2026-11-20 12:00 | Migration 012 (P1-04): triển khai và kiểm thử local | (a) Tạo `supabase/migrations/20260923000012_is_project_member_soft_delete.sql` (`is_project_member` lọc `projects.deleted_at`; `write_audit` kiểm membership thô trước trạng thái project), `supabase/rollbacks/20260923000012_is_project_member_soft_delete.down.sql` (thân 009/011 sao chép và đối chiếu), `supabase/tests/rls/write_audit_membership.test.sql` (12 ca), thêm ca soft-delete vào `is_project_member.test.sql` (plan 5). (b) `supabase db reset` (local 127.0.0.1:54322): exit 0. (c) `supabase test db`: 9 file, 68 test, PASS (log `files/db-test-012-final.log`). (d) Rollback: áp `.down.sql` → `test db` FAIL đúng 1 ca (soft-delete `is_project_member`), log `files/db-test-rollback-negative.log`; sau đó reset và áp lại 012 → PASS. (e) Owner/ACL trên DB local: 4 hàm owner `postgres`, `rolbypassrls=t`, SECURITY DEFINER, EXECUTE cho `authenticated`/`service_role`, không cho PUBLIC/anon. (f) Quality gate: lint, typecheck, test 65/65, architecture:check đều exit 0. Lưu ý: 12 ca `write_audit` không phân biệt được trước/sau 012 (hành vi không đổi); chỉ ca soft-delete của `is_project_member` phân biệt. Chưa kiểm trên hosted. Chưa commit/push. Trạng thái: TESTED (local), chưa ACCEPTED | Chờ owner ACCEPT migration 012; commit khi được duyệt; policy SELECT `projects` (004) không lọc `deleted_at` (vấn đề độc lập, migration 013 đề xuất) |
| 28 | 2026-11-20 16:00 | P1-01/02/03/04 (AUTONOMOUS): migrations 013–015, rollback, pgTAP `soft_delete_tenant_context.test.sql` (13 ca), ADR-008 | Local: `db reset` exit 0; `supabase test db` 81/81 PASS (log `files/db-test-final-81.log`). Mutation: gỡ rollback 013–015 → 5 ca FAIL (`files/db-test-mutation-rolled-back.log`), restore bằng `db reset` → PASS. `pnpm lint`, `typecheck`, `test`, `architecture:check` exit 0. Chưa kiểm rollback từng file riêng; chưa kiểm web/mobile auth với current_tenant_id mới; chưa kiểm hosted | INTERNALLY_DONE (local). Chờ owner ACCEPT. Không commit/push. Blocker còn lại: Android Kotlin ICE (BLOCKED), CI/hosted (UNVERIFIED) |
| 29 | 2026-11-20 17:00 | Owner quyết định: không restore project trong MVP. Kiểm rollback 012 và 013–015 trong transaction (ROLLBACK, DB không đổi), so ACL/SECURITY/search_path. Thêm ca pgTAP membership đã thu hồi + claim cũ | `supabase test db` 82/82 PASS. Rollback 013–015: `current_tenant_id`/`current_app_role` về INVOKER như 004, ACL giữ nguyên. Rollback 012: ACL và search_path khớp trước thay đổi. Web/mobile: `remove` worker không dùng RETURNING. Nhiều tenant: web từ chối (BLOCKED: cần quyết định sản phẩm về chuyển tenant). ADR-008 đã cập nhật | Rollback 013–015 chưa chạy trên DB thật rồi re-apply (chỉ kiểm trong transaction). Chờ owner ACCEPT |
| 30 | 2026-11-20 18:00 | Tenant switcher MVP (phương án A: chặn chuyển tenant khi Outbox còn pending) | (a) Migration `20260923000016_active_tenant_selection.sql`: bảng `user_active_tenant` (FK composite tới `memberships`, RLS), RPC `select_active_tenant` (SECURITY DEFINER, DB xác thực membership), hook ưu tiên tenant đã chọn. Rollback `.down.sql` khôi phục hook gốc (004) và xóa object 016. (b) Web: `App.tsx` dropdown khi >1 tenant, gọi `selectActiveTenant`, remount theo `tenantId`. (c) Mobile: `apps/mobile/src/auth/tenant-switch.ts` chặn khi Outbox pending, gọi RPC rồi refresh session. (d) `supabase db reset` exit 0; `supabase test db` 95/95 PASS (`files/db-test-tenant-switch.log`); `tenant-switch.test.ts` 3/3 PASS (`files/mobile-tenant-switch-test.log`); lint, typecheck, test, architecture:check exit 0 (`files/gate-*-tenant.log`). (e) Rollback 016 kiểm trong transaction: RPC và bảng mất, hook về thân gốc, ROLLBACK giữ nguyên trạng thái DB. Chưa so md5 với thân 004 nguyên văn. | IMPLEMENTED + TESTED (DB, unit). UNVERIFIED: claim mới sau `refreshSession()` trên web/mobile thực tế; UI mobile chưa gắn switcher; kiểm tay trình duyệt chưa làm; hosted chưa kiểm. Chưa INTERNALLY_DONE. Chờ owner ACCEPT |
| 31 | 2026-11-20 19:00 | Mobile tenant lifecycle: membership loader, switcher gắn guard, cursor sync theo tenant | (a) `apps/mobile/src/auth/memberships.ts`: nạp tenant từ bảng `memberships` qua client đã xác thực, tenant đang dùng qua RPC `current_tenant_id`. (b) `apps/mobile/src/auth/TenantSwitcher.tsx`: đi qua guard `switchActiveTenant`; bị chặn thì sync một lượt rồi thử lại, còn pending thì hiện số lượng và giữ tenant cũ. (c) `App.tsx`: tenant không có trong danh sách DB thì chặn truy cập; `WorkersListPage` lọc theo `tenantId`. (d) `secure-cursor-store.ts`: key `sync.worker.cursor.<tenantId>`. (e) `countUnsynced()` (pending/failed/total) và schema v3 thêm cột tenant/project cho Outbox. (f) Test: `tenant-sync-isolation.test.ts` 3 ca (cursor tách tenant, mapping membership, lỗi DB); mobile vitest 24/24 PASS (gồm sync-runtime mất mạng và retry); typecheck, `pnpm lint`, `architecture:check` exit 0. | IMPLEMENTED + TESTED (unit). BLOCKED: emulator/thiết bị (adb chưa có). UNVERIFIED: test Watermelon store thật, restart app khi Outbox pending, test sync sau chuyển tenant cho revoke và A↔B chưa viết (mất mạng và retry đã có ở sync-runtime), RLS `memberships` cho chính user, claim mới sau `refreshSession()`. Chưa INTERNALLY_DONE. Chờ owner ACCEPT |
| 32 | 2026-11-21 10:00 | Kiểm tra cổng build và bằng chứng cuối (máy local, không thiết bị) | (a) `pnpm build` exit 0 (10/10 task; web Vite build OK, cảnh báo chunk 505 kB không chặn) (`files/build-final.log`). (b) `pnpm test` exit 0: 22 file, 79/79 PASS (`files/full-test-final.log`). (c) `supabase test db` exit 0: 95/95 PASS (`files/db-test-final.log`). (d) Supabase local `127.0.0.1:54322` (`files/supabase-status.log`). (e) Mobile sync-runtime: thêm ca mất mạng khi push rồi retry commit; vitest mobile 24/24. (f) ADR-008 và tracker 016 ghi ACCEPTED theo xác nhận chủ dự án 2026-11-21. | DONE (local). ACCEPTED theo xác nhận chủ dự án. BLOCKED: kiểm trên thiết bị/emulator Android (chủ dự án không dùng thiết bị). restart app khi Outbox pending, hosted Supabase chưa kiểm. Chưa INTERNALLY_DONE cho phần thiết bị. Chờ owner xác nhận |
| 33 | 2026-11-21 11:50 | Module 3 — Chấm công: vertical slice theo `docs/standards/MODULE_VERTICAL_SLICE_PLAYBOOK.md` | (a) DB: migration `20260923000019_init_attendance` (bảng `attendance`: tenant/project/worker, `work_date date`, status PRESENT/ABSENT/ON_LEAVE/HALF_DAY, check-in/out, note, version, `unique(tenant_id, worker_id, work_date)`, RLS dùng `current_tenant_id()`/`current_app_role()` theo ADR-008 + check worker cùng tenant) + rollback `.down.sql`. (b) pgTAP `attendance.test.sql` 6 ca (tenant isolation, cross-tenant insert, duplicate ngày, invalid status, worker ngoài tenant, role gate PROJECT_VIEWER) — **`supabase test db` 14 file / 128 test PASS** (lỗi ban đầu: đổi claim `app_role` không có tác dụng vì `current_app_role()` đọc từ `memberships` — sửa bằng `set role postgres` để mutate membership). (c) Core: entity/enum/rules/service attendance (`requireValidWorkDate`, `requireCheckOutAfterCheckIn`, note ≤ 500, `assertSameAttendanceTenant` alias tránh xung tên với worker) + Contracts schema/DTO/api/events + `AttendanceRepository` interface. (d) Web slice: api adapter, application service, zustand store (+3 test), `AttendancePage`; wire vào `App.tsx` (role khác WORKER). (e) Mobile slice: schema v4 + migration v4 `createTable attendance`, `AttendanceModel`, local store (insert/update/remove/applyRemote), `localAttendanceRepository` (outbox + version), `createAttendanceOffline` (+4 test), `AttendanceListPage`; wire vào `App.tsx`. (f) Sync: `createSupabaseAttendanceTransport` (push VERSION_CHECK/pull cursor, RLS là tenant boundary), `createAttendanceSyncRuntime` (flush/pull, skip record pending local); `secure-cursor-store` tách key theo recordType (`sync.<type>.cursor.<tenant>`). (g) i18n: `nav.attendance` vi/en/ko. (h) Gate: `pnpm typecheck` 10/10, `pnpm test` 27 file / 105 PASS, `eslint .` PASS, `pnpm architecture:check` PASS. | IMPLEMENTED + TESTED (DB, unit). UNVERIFIED: chạy trên thiết bị/emulator (Android BLOCKED), Watermelon store thật, hosted. Phần "Vị trí" (GPS) chưa làm (để giai đoạn sau). Chưa ACCEPTED. Không commit/push. |

| 36 | 2026-11-21 15:00 | VS-01 Web: CRUD Project Company và Project Members | (a) `supabaseProjectApi.ts`: `addProjectCompany`, `updateProjectCompany` (RPC `add_project_company`, `update_project_company`); `listProjectMembers` đọc `project_memberships` theo project (RLS quyết định phạm vi); `addProjectMember`, `updateProjectMemberRole`, `removeProjectMember` gọi RPC migration 020. (b) `ProjectsPage.tsx`: suspend/end/kích hoạt lại công ty (ẩn với MAIN_CONTRACTOR); danh sách thành viên, thêm, đổi role, thu hồi chỉ hiện với WORKER và PROJECT_VIEWER; DB vẫn là nơi kiểm tra quyền. (c) Test `supabaseProjectApi.test.ts` 10 ca (tổng web 115 PASS). (d) Gate: `pnpm lint` exit 0, `pnpm typecheck` exit 0, `pnpm test` 28 file / 115 PASS, `pnpm architecture:check` PASS, `pnpm build` exit 0. Chưa làm: Web E2E, Mobile project list, test UI component. | IMPLEMENTED + TESTED (unit, gate local). PENDING_ACCEPTANCE. UNVERIFIED: Web E2E, thiết bị. Không commit/push |
| 35 | 2026-11-21 14:00 | VS-01 Web: danh sách và chi tiết Project (chỉ đọc) | (a) `apps/web/src/features/projects/api/supabaseProjectApi.ts`: `listProjects(tenantId)` lọc `tenant_id` + `deleted_at is null`, lọc lại theo tenant ở client; `listProjectCompanies(projectId)`. (b) `ProjectsPage.tsx`: danh sách + chi tiết công ty tham gia; không có thao tác ghi. (c) `App.tsx`: mount cho role khác WORKER. (d) Test `supabaseProjectApi.test.ts` 3 ca. (e) Gate: `pnpm lint` exit 0, `pnpm typecheck` 10/10 exit 0, `pnpm test` 28 file / 108 PASS, `pnpm architecture:check` PASS, `pnpm build` 10/10 exit 0. Chưa làm: Mobile project list (đã chuyển sang dòng 36 cho phần CRUD). | IMPLEMENTED + TESTED (unit, gate local). PENDING_ACCEPTANCE. UNVERIFIED: Web E2E, thiết bị. Rủi ro đã biết: RLS `projects` chỉ cho xem tenant của mình, nên SUBCONTRACTOR chưa thấy dự án đã tham gia (chờ quyết định). Không commit/push. |
| 34 | 2026-11-21 13:00 | Quality gates, điều tra Attendance (chỉ đọc), cập nhật tài liệu sau migration 018/020 | (a) Quality gates tuần tự, đều exit 0: `pnpm lint`, `pnpm typecheck` 10/10, `pnpm test` 27 file / 105 PASS, `pnpm architecture:check`, `pnpm build` 10/10 (log `gate-*.log` ở thư mục gốc repo). (b) Attendance chỉ đọc: `supabase_migrations.schema_migrations` có version `20260923000019` (init_attendance) → migration 019 ĐÃ ÁP DỤNG ở DB local. Bảng `attendance` tồn tại; 4 policy (select/insert/update/delete) như migration. Không chạy db reset, không sửa migration 019 hay `attendance.test.sql`. (c) Test 6 (`PROJECT_VIEWER cannot insert attendance`): test đổi role bằng UPDATE `memberships` dưới `postgres` rồi insert dưới `authenticated`. Nguyên nhân thất bại ở lần chạy trước CHƯA XÁC MINH; lần chạy đầy đủ gần nhất ghi `ok`. Chưa chạy lại trong bước chỉ đọc này. (d) Ảnh hưởng VS-01: không có bằng chứng Attendance làm hỏng gate VS-01. Attendance vẫn DEFERRED/PENDING_APPROVAL. (e) Migration 017, 018, 020: TESTED (DB), PENDING_ACCEPTANCE. Không ACCEPTED. (f) ADR-001 addendum: dòng 221 còn sót ký tự lỗi `\\, \\)` mà công cụ edit không khớp được; BLOCKED ở phần này. | DONE (gates local). BLOCKED: ADR-001 dòng 221 (ký tự điều khiển). UNVERIFIED: nguyên nhân test 6 lần chạy trước, thiết bị Android, hosted Supabase. Không commit/push |

| 37 | 2026-11-23 09:40 | Phase B audit (chỉ đọc, không sửa code/migration/RLS): DB/Security và Multi-tenant/Offline-Sync; bật Docker, `supabase start`, `supabase test db` | (a) Docker Desktop khởi động từ `%LOCALAPPDATA%\Programs\DockerDesktop`; `supabase start` exit 0. (b) `supabase test db` (commit `592c398`): **15 file / 140 test, Result: PASS** (log `%TEMP%\partneros-gates\supabase-test-db.log`). (c) Báo cáo mới: `DATABASE_SECURITY_AUDIT.md`, `OFFLINE_SYNC_AUDIT.md` (gốc repo). (d) Phát hiện: DB-SEC-01 PROJECT_MANAGER gán được mọi role (`assert_can_touch_role`, migration 020:41-55) lệch quyết định owner, cần migration mới — chưa áp dụng; DB-SEC-03 SUBCONTRACTOR không thấy project tham gia (migration 013:7-10) — quyết định RLS, chờ owner; SY-01 attendance sync đã có trên mobile (`sync-runtime.ts`) dù Attendance DEFERRED; SY-04 `applyRemote` idempotent (`watermelon.ts:90-112`, `:195-217`); MT-04 đã có test `tenant_switcher.test.sql:54`. (e) Chưa làm: Mobile project list chỉ đọc, Web E2E, Android thiết bị (BLOCKED). | IMPLEMENTED (audit) + TESTED (pgTAP local 140/140). AUDIT_DONE cho nhóm DB/Security và Multi-tenant/Offline-Sync. UNVERIFIED: ACL thực tế (`has_function_privilege`), Web E2E, thiết bị Android. DB-SEC-01 BLOCKED chờ owner duyệt migration. Không ACCEPTED. Không commit/push |
| 38 | 2026-11-23 12:00 | DB-SEC-01 (PROJECT_MANAGER chỉ gán WORKER/PROJECT_VIEWER) và DB-SEC-03 (SUBCONTRACTOR thấy dự án tham gia); Mobile project list chỉ đọc | (a) Migration `20260923000021_project_manager_scope_and_participant_visibility.sql` (+ rollback `.down.sql`): `assert_can_touch_role` chặn PROJECT_MANAGER với role ngoài WORKER/PROJECT_VIEWER; `is_participating_company()`; policy `projects` SELECT thêm điều kiện tham gia và `deleted_at is null`. (b) pgTAP `subcontractor_project_visibility.test.sql` 11 ca. (c) Mobile: `features/projects` (service `listProjectsForTenant`, `ProjectListPage` loading/empty/error), gắn vào `App.tsx`. (d) Gate: `pnpm lint`, `pnpm typecheck`, `pnpm test` (29 file / 117 PASS), `pnpm architecture:check`, `pnpm build` đều exit 0; `supabase test db` 16 file / 151 PASS; mobile `tsc --noEmit` exit 0. Chưa làm: Web E2E, Mobile trên thiết bị, ACL `has_function_privilege`, cập nhật ADR cho migration 021. | IMPLEMENTED + TESTED (pgTAP, unit, gate local). PENDING_ACCEPTANCE. UNVERIFIED: ACL, Web E2E, thiết bị. BLOCKED: Android thiết bị. Không ACCEPTED. Không commit/push |
| 41 | 2026-11-23 11:40 | Tạo tài khoản test LOCAL (Auth Admin API + SQL local) và Web E2E smoke VS-01 qua trình duyệt | (a) Tài khoản local (chỉ DB `127.0.0.1:54322`/API `54321`, không phải production): `pm.main@local.test` (PROJECT_MANAGER, tenant LOCAL_TEST_MAIN), `pm.sub@local.test` (PROJECT_MANAGER, tenant LOCAL_TEST_SUB), `worker.sub@local.test` (WORKER, tenant LOCAL_TEST_SUB). Mật khẩu do owner nắm trong trao đổi, không ghi vào repo. (b) Dữ liệu: dự án `Local Test Site A`, MAIN_CONTRACTOR ACTIVE + SUBCONTRACTOR ACTIVE, project_memberships PROJECT_MANAGER cho 2 PM. (c) API: đăng nhập 3/3 OK, mật khẩu sai bị từ chối; `projects` visible: pm.main 1, pm.sub 1, worker.sub 1. (d) UI (Playwright qua trình duyệt): đăng nhập pm.main OK, hiển thị vai trò PROJECT_MANAGER, chi tiết dự án có công ty tham gia và thành viên; dropdown vai trò thành viên chỉ có WORKER, PROJECT_VIEWER. (e) Chưa làm trong đợt này: DB-SEC-02/04/05/06 triển khai, Playwright framework, Android. | PARTIAL: E2E smoke VS-01 PASS (local). Không ACCEPTED. Không commit/push |
| 42 | 2026-11-23 11:50 | VS-01 RPC write-path test trên local (REST, token thật từng PM) cho `add_project_member` / `remove_project_member`, và kiểm tra visibility SUBCONTRACTOR | (a) pm.main thêm `worker.sub` WORKER vào công ty SUB: OK. (b) pm.main gán SUB_CONTRACTOR, SYS_ADMIN, PROJECT_MANAGER: bị từ chối `42501 project manager cannot assign or change this role`. (c) pm.main gán WORKER vào công ty của user chưa thuộc tenant: bị từ chối `22023`. (d) pm.sub (PM nhà thầu phụ) thêm thành viên: bị từ chối `42501 not allowed to manage project members`; đây là thiết kế migration 020 (`assert_member_manager` chỉ cho quản lý của MAIN_CONTRACTOR). (e) Thu hồi bằng `remove_project_member`: OK, bản ghi membership còn 0. (f) Sau thu hồi, `worker.sub` vẫn thấy dự án vì tenant SUB đang ACTIVE tham gia dự án (đúng chính sách DB-SEC-03); quyền ghi/xem dữ liệu module cần kiểm tra riêng. Đã dọn dữ liệu test. (g) UI (trình duyệt, `pm.main`): thêm `worker.sub` WORKER vào công ty SUB qua form web, hiển thị đúng; thu hồi qua nút, danh sách trở về 2 PM. | IMPLEMENTED + TESTED (REST và UI local). PENDING_ACCEPTANCE. UNVERIFIED: E2E framework chính thức, Android thiết bị. Không ACCEPTED. Không commit/push |
| 43 | 2026-11-23 12:10 | Thiết lập Playwright E2E cho web (`apps/web/playwright.config.ts`, `apps/web/e2e/vs01-members.spec.ts`, script `pnpm --filter @partner-os/web e2e`) | (a) Chạy `playwright test` trên Vite local `http://localhost:5173` với Supabase local: 1 test PASS (`pm.main` đăng nhập, mở dự án `Local Test Site A`, dropdown vai trò thành viên chỉ có WORKER/PROJECT_VIEWER, không có SYS_ADMIN/COMPANY_ADMIN/SITE_MANAGER/PROJECT_MANAGER/SUB_CONTRACTOR). (b) `pnpm --filter @partner-os/web typecheck`: exit 0. (c) `pnpm --filter @partner-os/web build`: thành công (chỉ cảnh báo chunk size). (d) Chưa có E2E cho ghi companies CRUD, tenant switcher, `pm.sub`. | PARTIAL: E2E VS-01 smoke PASS (local). PENDING_ACCEPTANCE. Không ACCEPTED. Không commit/push |
| 44 | 2026-11-23 12:30 | Mở rộng E2E VS-01 (thêm/thu hồi thành viên qua UI) và sửa pgTAP test 14 phụ thuộc dữ liệu | (a) Playwright `apps/web/e2e/vs01-members.spec.ts`: 2 PASS (`pm.main` chỉ thấy WORKER/PROJECT_VIEWER; `pm.main` thêm `worker.sub` WORKER vào công ty SUBCONTRACTOR qua form, hiển thị, thu hồi, biến mất). Cập nhật sau: gap `pm.sub` đã đóng. `listProjects()` bỏ lọc tenant và dựa vào RLS; dự án của đơn vị khác hiển thị nhãn "Tham gia (chỉ xem)", không render companies/members/form quản lý. Test 3 chuyển từ `fixme` sang PASS. `pnpm e2e`: 3/3 PASS. Vitest loại trừ `e2e/**`; web tsc exit 0, Vitest 16/16, build OK. (b) pgTAP `project_company_member_management.test.sql` test 14 FAIL trên DB local vì đếm tuyệt đối `project_member.removed` (have 5, want 1) do dữ liệu test thủ công và E2E tích lũy. Sửa: đếm chênh lệch so với mốc chụp dưới role postgres trước khi remove. Không đổi logic migration. (c) `supabase test db`: 16 file / 151 PASS. (d) `pnpm test`: PASS. `pnpm architecture:check`: PASS. Typecheck web: exit 0. | PENDING_ACCEPTANCE. KNOWN GAP ĐÃ ĐÓNG (pm.sub xem dự án chỉ đọc, E2E 3/3). Build web: exit 0. Không ACCEPTED. Không commit/push |
| 45 | 2026-11-23 12:20 | Kiểm chứng quyền child-table cho công ty SUBCONTRACTOR tham gia | Thêm `supabase/tests/rls/subcontractor_child_visibility.test.sql` (9 ca): participant không có membership không thấy `project_companies`; có membership thấy dòng công ty mình và không thấy membership của người khác; roster `workers` của tenant MAIN bị ẩn với tenant SUB; người ngoài công ty không thấy `project_companies`; membership bị thu hồi thì project vẫn thấy qua công ty ACTIVE nhưng `project_companies` bị ẩn. Ca 4 ban đầu lệch vì trigger `projects_add_main_contractor` tự thêm dòng MAIN_CONTRACTOR; đã sửa kỳ vọng đếm dòng của tenant SUB. Không đổi migration/policy. `supabase test db`: 17 file / 160 PASS. | PENDING_ACCEPTANCE. Không ACCEPTED. Không commit/push. Workers: ca kiểm tra dùng role WORKER (policy roster không cấp cho WORKER), nên đây là kiểm tra tenant isolation yếu, chưa chứng minh quyền roster của SUB_CONTRACTOR |
| 46 | 2026-11-23 12:30 | Mobile Project List căn chỉnh chính sách participant | `apps/mobile/src/features/projects/services/project-read.ts`: `listVisibleProjects` đọc `projects` (bỏ lọc `tenant_id` và join `project_companies`), dựa vào RLS, loại `deleted_at`. Trước đây đọc `project_companies` theo tenant nên participant không có membership sẽ thấy rỗng. `ProjectListPage` bỏ prop `tenantId`, chỉ đọc, có loading/empty/error. `App.tsx`, `index.ts`, và test được cập nhật. Gate: mobile vitest projects 2/2, mobile tsc exit 0, root `pnpm test` 117/117, `pnpm architecture:check` PASS, `supabase test db` 17 file / 160 PASS. | PENDING_ACCEPTANCE. Chưa xác minh trên thiết bị/emulator (BLOCKED). Chưa có test RLS riêng cho đường `projects` của mobile; dựa vào `subcontractor_project_visibility.test.sql`. Không ACCEPTED. Không commit/push. || 47 | 2026-11-23 13:00 | Chặn PM của công ty SUBCONTRACTOR quản lý Project Members (phê duyệt nghiệp vụ) | Kiểm tra DB: `is_main_contractor_manager` (migration 018) và `assert_member_manager` (migration 020) đã chặn SUB PM; `project_memberships` chỉ có policy SELECT (migration 009), không có DML. Không tìm thấy lỗ hổng DB. Thiếu là test: thêm `supabase/tests/rls/subcontractor_pm_project_members.test.sql` (11 test: roster chỉ thấy dòng của mình, add/update/remove RPC bị 42501, insert/update/delete trực tiếp không ảnh hưởng dòng, control MAIN PM vẫn sửa được). Thêm E2E `pm.sub` kiểm tra không có form thêm, nút Thu hồi, hay dòng WORKER trong chi tiết. Gate: `supabase test db` 18 file / 171 PASS (exit 1 chỉ do WARN `auth.expo_template`); `pnpm e2e` 3/3 PASS; root `pnpm test` 117/117; `pnpm architecture:check` PASS. | PENDING_ACCEPTANCE. Chưa kiểm thử mobile/sync cho đường ghi Project Members (mobile không có đường ghi này; đã grep `apps/mobile` và `packages/sync-engine`: không có `project_memberships`). DB-SEC-06 (ba định nghĩa `add_project_member`) vẫn mở. Không ACCEPTED. Không commit/push. || 40 | 2026-11-23 11:00 | Web smoke test local (không phải E2E đầy đủ): khởi động Vite dev (`localhost:5173`) với `VITE_SUPABASE_URL=http://127.0.0.1:54321`, mở trình duyệt | (a) Supabase local đang chạy (API 54321). (b) Trang đăng nhập "Partner OS — Web Admin" render đúng (form Email/Mật khẩu). (c) Luồng đăng nhập và VS-01 (Company, Project, Members, Tenant Switcher, quyền PROJECT_MANAGER) **BLOCKED**: seed không có tài khoản dev, và không tự tạo tài khoản auth trong DB local khi chưa được duyệt. Cần owner cung cấp tài khoản dev local hoặc duyệt script seed test. (Cập nhật: phần BLOCKED này đã được xử lý ở dòng 41.) (d) Đã dừng Vite server sau kiểm tra. | PARTIAL (smoke render). Web E2E đầy đủ BLOCKED. Không ACCEPTED. Không commit/push |
| 48 | 2026-11-23 14:00 | DB-SEC-06 (hợp nhất `add_project_member`) và DB-SEC-04 (allowlist `write_audit`) trên DB local | (a) Đọc chỉ: `add_project_member` có 3 định nghĩa (017/018/020), bản 020 có hiệu lực; `write_audit` là SECURITY DEFINER, không kiểm tra action. (b) Migration mới: `20260925000022_consolidate_add_project_member.sql` và `20260925000023_write_audit_action_allowlist.sql` (kèm `.down.sql`). Allowlist 8 action từ RPC production (ADR-009). Không sửa migration lịch sử. (c) Fixture `REF`, `TEST`, `WA`, `SDV_STATUS_CHANGE` đổi sang action hợp lệ (`audit_log_reference`, `audit_log`, `write_audit_membership`, `soft_delete_tenant_context`). (d) pgTAP mới `add_project_member_and_write_audit_hardening.test.sql` (17 test). (e) Gate: `supabase test db` 19 file / 188 PASS; `pnpm test` 117/117; `pnpm architecture:check` PASS. (f) Quyền local: `authenticated` EXECUTE; `anon`/`PUBLIC` không EXECUTE. | IMPLEMENTED + TESTED local. PENDING_ACCEPTANCE. Chưa commit/push. Không ACCEPTED. |
| 49 | 2026-11-25 11:40 | DB-SEC-05 (phần attendance UPDATE): siết quyền sửa chấm công | (a) Lỗ hổng: policy `attendance update within own tenant` (migration 019:57) chỉ kiểm tra tenant, WORKER và PROJECT_VIEWER sửa được. (b) Migration `20260925000024_attendance_update_role_gate.sql` (+ `.down.sql`): UPDATE chỉ cho SYS_ADMIN, SITE_MANAGER, SUB_CONTRACTOR, khớp INSERT. Không sửa migration 019 hay `attendance.test.sql`. (c) pgTAP mới `attendance_update_role_gate.test.sql` (3 ca: WORKER 0 dòng, PROJECT_VIEWER 0 dòng, SITE_MANAGER 1 dòng). (d) Gate: `supabase test db` 20 file / 191 PASS; `pnpm test` 117/117; `pnpm architecture:check` PASS; mobile `vitest` 30/30 PASS; mobile `tsc --noEmit` không lỗi. (e) Còn mở: `workers` ghi trực tiếp từ client, chưa có RPC. | IMPLEMENTED + TESTED local. PENDING_ACCEPTANCE. BLOCKED: Android thiết bị/emulator. Không ACCEPTED. Không commit/push. |
| 39 | 2026-11-23 13:00 | Đợt xác nhận owner: cập nhật ADR-008 (mục migration 021), đổi trạng thái Attendance trong tracker sang DEFERRED, rà soát DB-SEC-02/04/05/06 (chỉ đọc, outline) | (a) `docs/adr/ADR-008-...md`: thêm mục migration 021, giữ nguyên dòng ACCEPTED. (b) `docs/3_TRACKER.md`: Module 3 Attendance `[ ] DEFERRED (đến VS-03)`. Không sửa code/migration 019/`attendance.test.sql`. (c) Web E2E: không có cấu hình Playwright/script e2e trong `apps/web` — **BLOCKED/NOT RUN**, chưa cài framework (cần owner duyệt). (d) Git `files`: là file log PowerShell UTF-16 (transcript lỗi `check-architecture`), không phải dữ liệu người dùng; không xóa, không commit. (e) Outline DB-SEC-02/04/05/06 trình owner, chưa triển khai. | DOC_UPDATED. Không ACCEPTED. Không commit/push |
**Quy tắc cập nhật từ đây:** Mỗi lần có thay đổi code hoặc kết quả xác minh mới, đọc lại file này, đối chiếu với code, tracker và test, cập nhật mục bị ảnh hưởng, ghi thêm dòng vào Mục 14. Giữ nguyên mục UNVERIFIED/MISSING EVIDENCE cho đến khi có bằng chứng. Không tự đánh dấu ACCEPTED.
