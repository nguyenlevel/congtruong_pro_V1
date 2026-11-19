# TOMONI Construction / Partner OS – MVP Completion Audit

Chế độ: AUDIT ONLY. Không sửa code, migration, DB, RLS/RBAC, package hoặc cấu hình. Không commit.
Phạm vi bằng chứng: đọc cấu trúc repository, `.github/workflows/*.yml`, `supabase/migrations`, `supabase/tests`, `apps/*/src`, `packages/*/src`, `docs/*`. Kết quả test lấy từ các lần chạy đã ghi trong `docs/tiendo.md`; phiên này không chạy lại test.

Ký hiệu trạng thái: DESIGNED / IMPLEMENTED / TESTED / ACCEPTED theo nguyên tắc 6 của yêu cầu.

---

## 1. Tổng quan trạng thái dự án

- Sản phẩm **chưa đạt MVP Pilot**. Hiện là giai đoạn nền tảng: tenancy, RBAC một phần, sync engine và vertical slice module Worker.
- Mức đầy đủ bằng chứng: **thấp đến trung bình**. Không có log GitHub Actions, không có log Android build đầy đủ, không có bằng chứng chạy trên thiết bị/emulator, không có bằng chứng Supabase thật từ app.
- Không tính phần trăm hoàn thành tổng thể vì thiếu trọng số đáng tin cậy (theo yêu cầu tiendo.md).
- Không có chức năng nghiệp vụ nào trong 9 luồng cuối (chấm công → báo cáo) có code, schema hoặc test.

---

## 2. Danh sách module và trạng thái thực tế

| Module | Web | Mobile | API/Backend | DB/Migration | RLS/RBAC | Test | Trạng thái |
|---|---|---|---|---|---|---|---|
| Công ty (tenant) & dự án | Không có UI riêng | Không | Không có API riêng (Supabase trực tiếp) | `tenants`, `projects` (002) | Có tenant RLS | Không thấy test UI | IMPLEMENTED (DB) / NOT_STARTED (UI) |
| Công ty tham gia dự án (`project_companies`, nhà thầu chính/phụ) | Không | Không | Không | Có (007b, trigger thêm nhà thầu chính) | Có (007b, 15 test) | pgTAP | IMPLEMENTED; PENDING ACCEPTANCE |
| Nhân sự / Worker | Có (list, create, store) | Có (list, create offline) | Supabase trực tiếp qua `supabaseWorkerApi.ts` | Có (003, 006) | Có RLS tenant | `workers.test.sql`, unit vitest | IMPLEMENTED; TESTED (unit + pgTAP); thiết bị MISSING EVIDENCE |
| Nhà thầu phụ (`sub_contractors`) | Không | Không | Không | Không có migration | Không | Không | NOT_STARTED |
| Thành viên dự án (project RBAC) | Không | Không | Không | 007b, 008 | Có | pgTAP 007b, project_viewer | IMPLEMENTED; PENDING ACCEPTANCE (007b) |
| Chấm công | Không | Không | Không | Không | Không | Không | NOT_STARTED |
| Công việc & tiến độ | Không | Không | Không | Không | Không | Không | NOT_STARTED |
| Nhật ký công trường | Không | Không | Không | Không | Không | Không | NOT_STARTED |
| Vật tư cơ bản | Không | Không | Không | Không | Không | Không | NOT_STARTED |
| Báo cáo tổng hợp | Không | Không | Không | Không | Không | Không | NOT_STARTED |
| Mobile app (đăng nhập, home, sync) | – | Có (LoginPage, HomePage, App.tsx) | – | – | – | `sync-runtime.test.ts`, `supabase-sync-transport.test.ts` | IMPLEMENTED; device MISSING EVIDENCE |
| Offline DB + Outbox + Sync engine | – | WatermelonDB schema, `SyncOutboxModel` | Transport Supabase | 006 | – | `packages/sync-engine` (65 test theo tiendo, fake adapter) | IMPLEMENTED; TESTED (fake) |
| Đăng nhập & phân quyền | Có (`App.tsx` signIn) | Có (`signInWithPassword`) | Hook JWT (004) | 001–011 | Có, nhưng role literal, JWT TTL chưa rõ | pgTAP + `auth` unit | IMPLEMENTED; PENDING ACCEPTANCE |
| Audit log (M-E) | – | – | `write_audit` | 010, 011 | Có | 51 pgTAP (theo tiendo) | IMPLEMENTED + TESTED (DB local); PENDING ACCEPTANCE |
| Kiến trúc/CI | – | – | – | – | – | `architecture:check` | IMPLEMENTED (workflow có) |

---

## 3. Chức năng đã hoàn thành (có bằng chứng)

| # | Chức năng | Bằng chứng | Mức |
|---|---|---|---|
| F1 | Migration 001–011 áp dụng trên DB local | `db reset` 12 migration, seed OK (theo tiendo mục 14, dòng 10) | TESTED (local) |
| F2 | pgTAP RLS: 51 test, 7 file | Lịch sử tiendo dòng 10 | TESTED (local) |
| F3 | Module Worker web: list/create/store | Code `apps/web/src/features/workers/**`, `workersStore.test.ts` | TESTED (unit) |
| F4 | Module Worker mobile offline: tạo → outbox → list | `offline-worker.test.ts` | TESTED (unit); thiết bị chưa có |
| F5 | Sync engine: outbox, flush, retry, conflict, cursor | `packages/sync-engine/src/**`, các test trong `create-sync-engine.test.ts`, `retry.test.ts`, `conflict.test.ts` | TESTED (fake adapter) |
| F6 | Mobile gọi sync khi mount/online | `apps/mobile/src/app/App.tsx:36-53`, `use-auto-sync.ts:11` | IMPLEMENTED; không có bằng chứng thiết bị |
| F7 | Web typecheck, vite build | Log `apps/web/.turbo/turbo-build.log` (2026-11-18 12:50) | VERIFIED (log cũ, cần chạy lại) |
| F8 | Audit log append-only, write_audit có kiểm project/tenant/actor/payload | 010, 011, pgTAP | TESTED (local); PENDING ACCEPTANCE |

---

## 4. Chức năng còn thiếu

- Chấm công (check-in/out, ca làm, duyệt): NOT_STARTED.
- Giao việc, theo dõi tiến độ, cập nhật tiến độ bởi nhân viên: NOT_STARTED.
- Nhật ký công trường (thời tiết, nhân lực, hạng mục, ảnh): NOT_STARTED.
- Vật tư cơ bản (danh mục, nhập/xuất, ghi nhận tại công trường): NOT_STARTED.
- Báo cáo tổng hợp (chấm công, tiến độ, vật tư theo dự án/nhà thầu): NOT_STARTED.
- Nhà thầu phụ: bảng, UI, gán vào dự án: NOT_STARTED (`sub_contractors` chưa có migration).
- Quản lý công ty và dự án trên UI web: chưa có màn hình; chỉ có thao tác DB.
- Phân quyền theo role COMPANY_ADMIN / PROJECT_MANAGER / SITE_SUPERVISOR (M-A): DESIGN ONLY, chờ duyệt.
- Phân quyền đọc audit theo project (M-D/M-A): chưa thiết kế đầy đủ.
- Luồng đăng nhập trên web/mobile: có code, chưa có E2E.
- Build Android: BLOCKED (Kotlin ICE, không có log đầy đủ).
- Chạy thử trên Android emulator/thiết bị: NOT_STARTED / MISSING EVIDENCE.
- Chạy CI workflow `db-test`, `build-test`: không có log kết quả trong phiên này (MISSING EVIDENCE).

---

## 5. P0 blockers

Tổng cộng **8 P0 blockers**.

| Mã | Blocker | Bằng chứng | Ảnh hưởng |
|---|---|---|---|
| P0-01 | Android build BLOCKED (Kotlin ICE trong `expo-autolinking-settings-plugin`) | `docs/tiendo.md` H1; `apps/mobile/android/build.gradle:11`; không có log `Caused by` | Không cài được app lên thiết bị; không test sync trên emulator |
| P0-02 | Không có module nghiệp vụ lõi (chấm công, công việc, nhật ký, vật tư, báo cáo) | Mục 2, 4 | MVP không dùng được tại công trường |
| P0-03 | Không có bằng chứng sync end-to-end với Supabase thật từ app | `tiendo.md` mục 11 (fake adapter); không có log | Không xác nhận offline → online → Supabase |
| P0-04 | Không có bằng chứng thiết bị/emulator cho luồng offline Worker | `tiendo.md` dòng 57, 91, 114 | Không chứng minh được "tạo offline" |
| P0-05 | M-A chưa duyệt; role COMPANY_ADMIN/PROJECT_MANAGER/SITE_SUPERVISOR chưa có trong `roles`; `can_read_audit` vẫn dùng `'SYS_ADMIN'` | `supabase/seed/roles.sql`; `20260923000010_audit_log.sql` | Phân quyền theo công ty/dự án chưa vận hành; không ai đọc được audit đúng vai trò |
| P0-06 | Thu hồi quyền phụ thuộc JWT (H5): claim cố định đến khi token hết hạn; JWT TTL UNVERIFIED | `004` hook JWT; `supabase/config.toml` không có `jwt_expiry` | Quyền cũ có thể còn hiệu lực; chưa đạt yêu cầu "Backend API và RLS thực thi quyền thực tế" |
| P0-07 | Mâu thuẫn trạng thái sync trong tracker (dòng 29 vs 82) và tracker chưa khớp code | `docs/3_TRACKER.md:29`, `:82` | Không biết chức năng nào đã chạy; quyết định sai |
| P0-08 | Build & Test đã PASS trên `32072db` (run 44460394646); Architecture Guard PASS. Workflow `db-test` chưa có bằng chứng PASS | `.github/workflows/db-test.yml`, `build-test.yml` | Còn thiếu `db-test` |

Ghi chú: P0-06 là blocker bảo mật thật sự, cần quyết định thiết kế (kiểm tra quyền từ DB ở mỗi request, hoặc rút ngắn TTL). Không đưa vào code cho đến khi duyệt.

---

## 6. P1 (quan trọng trước khi triển khai rộng)

| Mã | Việc | Lý do |
|---|---|---|
| P1-01 | Hoàn thiện nghiệm thu 007b và M-E (PENDING ACCEPTANCE) | Không có nghiệm thu thì không có nền tảng RBAC/audit đã chấp nhận |
| P1-02 | Thêm migration `sub_contractors` và gán nhà thầu phụ vào `project_companies` | Yêu cầu MVP mục 3 |
| P1-03 | UI web quản lý công ty, dự án, thành viên dự án | Luồng 1–3 cần giao diện |
| P1-04 | Sửa `is_project_member` không lọc `projects.deleted_at` (lỗi H3). **Trạng thái:** audit xong; test active/không-thành-viên/thu hồi đã thêm (`is_project_member.test.sql`), chưa chạy vì Docker không chạy; bản sửa cần migration mới, chờ duyệt | Truy cập dự án đã xóa mềm |
| P1-05 | Chuyển `'SYS_ADMIN'` và role literal sang bảng `roles` (M-A) | Nhất quán RBAC |
| P1-06 | Sync retry/idempotency kiểm trên Supabase thật (integration test có Supabase local) | Yêu cầu mục 1 (phiên trước) |
| P1-07 | Xử lý logout: bảo toàn outbox `pending_sync`, cảnh báo người dùng | Yêu cầu mục 3 (phiên trước); hiện mobile còn giữ dữ liệu, chưa có policy đầy đủ |
| P1-08 | Chạy lại `lint`, `typecheck`, `test`, `architecture:check`, `build` và lưu log | Chưa có bằng chứng trong phiên này |
| P1-09 | Bug tracker: không tìm thấy file bug tracker riêng trong repo | Không có nơi theo dõi lỗi chính thức |

---

## 7. P2 / P3 (để sau MVP)

P2 (có thể sau MVP Pilot):
- Báo cáo nâng cao, xuất Excel/PDF.
- Chunk web 500 kB (cảnh báo tối ưu bundle).
- Tách audit đọc theo project với UI quản trị.
- Đồng bộ file ảnh nhật ký (nếu không cần cho pilot).
- Thông báo đẩy (push notification).

P3 (ý tưởng tương lai):
- Đa ngôn ngữ đầy đủ (ngoài vi, en, ko đã có khung i18n).
- Tích hợp ERP/kế toán.
- Phân tích AI tiến độ.
- Chế độ offline cho web.

Lưu ý: các mục `packages/i18n` và `packages/ui` đã có khung; không ưu tiên mở rộng ngoài MVP.

---

## 8. Bảng kiểm thử và bằng chứng

| Hạng mục | Lệnh/nguồn | Kết quả đã ghi nhận | Bằng chứng | Trạng thái |
|---|---|---|---|---|
| pgTAP toàn bộ | `supabase test db` | 51/51 PASS, 7 file (theo tiendo dòng 10) | Ghi trong tiendo; không chạy lại | TESTED (local, lần cuối đã ghi) |
| Reset DB | `supabase db reset` | 12 migration + seed OK | tiendo dòng 10 | TESTED (local) |
| Vitest | `pnpm test` | 65/65 PASS (sync-engine, unit) | tiendo mục 11 | TESTED (unit) |
| Typecheck | `pnpm typecheck` | 10/10 PASS (theo tiendo) | tiendo dòng 113 | TESTED (theo tiendo, cần chạy lại) |
| Web build | `pnpm build` | Log cũ 2026-11-18 12:50 | `apps/web/.turbo/turbo-build.log` | UNVERIFIED (log cũ) |
| Android build | Gradle `assembleDebug` | FAILED | `apps/mobile/android/android-build.log` | Gradle 9.4.1 kéo kotlin-stdlib 2.3.0 vào classpath; Expo pin Kotlin 2.1.20. Cần duyệt hướng toolchain |
| CI Build & Test (run 44452054677, `9539064`) | `build-test.yml` | FAILED ở Lint | Lint: 3 lỗi `no-require-imports` | Đã sửa ở commit `32072db` |
| CI Build & Test (run 44460394646, `32072db`) | `build-test.yml` | PASS | GitHub Actions run | VERIFIED |
| CI Architecture Guard (run 44452054855) | `architecture-check.yml` | PASS | GitHub Actions | VERIFIED |
| Local (sau fix) | lint, typecheck, test, architecture:check, build | PASS | Output phiên này: 65/65 test, typecheck 10/10, build 10/10 | VERIFIED local, chưa xác nhận trên CI |
| E2E web/mobile | – | Không có | – | NOT_STARTED |
| Thiết bị/emulator | – | Không có | – | MISSING EVIDENCE |

---

## 9. Sơ đồ phụ thuộc

```
P0-01 Android build ──► P0-04 Device test offline ──► P1-06 Sync Supabase thật ──► E2E Worker
                                                              ▲
P0-03 Sync bằng chứng ────────────────────────────────────────┘
P0-06 Thu hồi quyền (JWT TTL) ──► P0-05 M-A duyệt ──► M-B ──► M-C ──► M-D ──► M-F
P1-01 Nghiệm thu 007b/M-E ──► M-A (cần chốt quyền nền)
P0-02 Chấm công ──► Công việc ──► Nhật ký ──► Vật tư ──► Báo cáo
   (mỗi module cần: schema + RLS + API/sync + UI + test)
P1-02 Nhà thầu phụ ──► P0-02 (chấm công/nhật ký theo project_company)
```

---

## 10. Lộ trình ưu tiên (đề xuất, chờ duyệt)

1. Thu thập bằng chứng: log Android, log CI, JWT TTL, metadata git. (Người dùng cung cấp.)
2. Xử lý P0-01 Android build khi có log.
3. Chạy lại toàn bộ gate (`lint`, `typecheck`, `test`, `architecture:check`, `build`, `test db`) và lưu log.
4. Chốt P0-06 (JWT TTL và cách kiểm quyền) và nghiệm thu 007b/M-E.
5. Thiết kế và duyệt M-A rồi các migration RBAC còn lại (M-B..M-F), đúng phê duyệt hiện có.
6. Một module nghiệp vụ đầu tiên đi đầy đủ chiều dọc: **Chấm công** (phụ thuộc Worker, project_company, RBAC). Gồm schema, RLS, sync, UI, test thiết bị.
7. Nhật ký công trường → Công việc & tiến độ → Vật tư → Nhà thầu phụ (nếu chưa làm sớm hơn) → Báo cáo.
8. E2E Worker trên emulator; sau đó pilot.

Lưu ý: không mở rộng nhiều module cùng lúc (theo chỉ đạo đã có).

---

## 11. Tiêu chí nghiệm thu MVP Pilot

1. Công ty tạo dự án, thêm nhà thầu chính và nhà thầu phụ trên web.
2. Thêm nhân sự vào dự án, phân vai trò theo dự án.
3. Worker đăng nhập mobile, chấm công online và offline; dữ liệu `pending_sync` lên Supabase khi có mạng, không trùng lặp khi sync lại.
4. Quản lý giao việc; Worker cập nhật tiến độ; web hiển thị đúng.
5. Nhật ký công trường và vật tư ghi nhận được, có đồng bộ.
6. Báo cáo tổng hợp đúng số liệu với dữ liệu thật.
7. Worker không đọc/ghi được dữ liệu công ty/dự án khác (pgTAP + thử thực tế trên hai tài khoản).
8. Thu hồi quyền có hiệu lực theo tiêu chí đã duyệt (không chỉ chờ JWT hết hạn nếu đã chọn kiểm DB).
9. Logout không xóa dữ liệu `pending_sync`; cảnh báo trước khi đăng xuất.
10. Android build PASS; CI `db-test` và `build-test` PASS có log.
11. Có bằng chứng trên thiết bị/emulator cho luồng 3.
12. Nghiệm thu bằng văn bản bởi chủ dự án. Không có mục nào tự chuyển sang ACCEPTED.

---

## 12. Quyết định cần người dùng phê duyệt

Trạng thái: APPROVED / NOT APPROVED / WAITING FOR INFORMATION. "Quyết định của tôi" để trống cho đến khi người dùng ghi quyết định.

| Mã | Nội dung | Đề xuất của AI | Quyết định của tôi | Tình trạng | Tác động đến MVP | Công việc tiếp theo |
|---|---|---|---|---|---|---|
| D-REV | Database là nguồn có thẩm quyền về authorization | Giữ | Giữ nguyên (người dùng, A.1) | APPROVED | Nền tảng cho mọi slice | Thiết kế hàm kiểm quyền DB dùng chung (chưa triển khai) |
| D-AUTH-CHECK | Thao tác bảo vệ kiểm quyền hiện hành từ DB, không chỉ JWT claim | Áp dụng cho thao tác ghi và đọc nhạy cảm | Giữ nguyên (người dùng, A.2) | APPROVED | Thu hồi quyền có hiệu lực ngay (đóng P0-06) | Hồ sơ cache/truy vấn hiệu quả (A.4) |
| D-JWT | Giữ JWT TTL hiện tại | Không rút TTL trong lúc chờ | Giữ nguyên (người dùng, A.3) | APPROVED | Giá trị TTL thực tế vẫn UNVERIFIED | Người dùng cung cấp giá trị TTL từ Dashboard |
| D-SLICE | Thứ tự vertical slice 1–9 | Đề xuất: (1) Auth/công ty/dự án/thành viên, (2) Nhân sự, (3) Chấm công, (4) Công việc & tiến độ, (5) Nhật ký, (6) Vật tư, (7) Báo cáo, (8) Offline & sync, (9) Tích hợp Android/Web | Thứ tự ưu tiên ban đầu, chưa phê duyệt triển khai (người dùng, B) | WAITING FOR INFORMATION | Quyết định toàn bộ lộ trình MVP | Rà soát dependencies (mục 9 báo cáo) rồi trình duyệt từng slice |
| D-MA | Duyệt triển khai M-A | Chưa đủ điều kiện duyệt triển khai | Chưa duyệt (người dùng, F) | NOT APPROVED | Chặn role COMPANY_ADMIN / PROJECT_MANAGER / SITE_SUPERVISOR | Hồ sơ M-A đã có; chờ văn bản duyệt |
| D-007B | Nghiệm thu 007b | Chưa nghiệm thu | Chưa nghiệm thu (người dùng, C) | NOT APPROVED | Giữ PENDING ACCEPTANCE | Người dùng xem bằng chứng pgTAP 15 test |
| D-ME | Nghiệm thu M-E (và migration 011) | Chưa nghiệm thu | Chưa nghiệm thu (người dùng, C) | NOT APPROVED | Giữ PENDING ACCEPTANCE | Người dùng xem bằng chứng 51/51 pgTAP và rollback |
| D-STAGING | Có môi trường staging hay không | Không tìm thấy cấu hình staging trong repo | Chưa trả lời | WAITING FOR INFORMATION | Ảnh hưởng xác nhận tích hợp thật | Người dùng xác nhận có staging Supabase hay không |
| D-ANDROID-LOG | Cung cấp log Android build đầy đủ | Không có log trong repo | Chưa cung cấp | WAITING FOR INFORMATION | P0-01 BLOCKED | Cung cấp log Android build đầy đủ (chứa `Caused by`), `where java`, kết quả `java -version` |
| D-CI-ACCESS | Cung cấp quyền/thông tin repo GitHub để đọc CI | Không xác định được owner/repo (không có git remote) | Chưa cung cấp | WAITING FOR INFORMATION | P0-08 MISSING EVIDENCE | Người dùng cung cấp owner/repo hoặc URL repo |
| D-TRACKER | Xác nhận tracker dòng 29 theo code | Sửa theo code sau khi người dùng xác nhận | Chưa trả lời | WAITING FOR INFORMATION | Mâu thuẫn P0-07 | Người dùng xác nhận |
| D-SUBCON | Phạm vi CRUD nhà thầu phụ trong MVP | CRUD đầy đủ là tối thiểu cho luồng 2 | Chưa trả lời | WAITING FOR INFORMATION | Ảnh hưởng slice 1 | Người dùng quyết định |
| D-LOGOUT | Chính sách logout và xóa dữ liệu local | Giữ outbox pending_sync, cảnh báo trước khi logout | Chưa trả lời | WAITING FOR INFORMATION | Yêu cầu bảo mật offline | Người dùng duyệt chi tiết |

---

## Kết luận (trả lời 7 câu hỏi)

1. **Mức đạt hiện tại:** Giai đoạn nền tảng (foundation). Có DB/RBAC một phần, sync engine và vertical slice Worker chạy bằng fake/unit. Chưa đạt MVP Pilot.
2. **Số P0 blockers:** 8.
3. **Module chưa có chức năng thực tế:** Chấm công, Công việc & tiến độ, Nhật ký công trường, Vật tư, Báo cáo tổng hợp, Nhà thầu phụ. Công ty/dự án chỉ có DB, chưa có UI.
4. **Chức năng chỉ có code, chưa tích hợp:** Sync engine với Supabase thật từ app; luồng offline Worker trên thiết bị; `useAutoSync` (chưa có retry/timer từ hook); đăng nhập web/mobile chưa có E2E; audit log chưa có caller từ app.
5. **Việc kéo dài dự án nhưng không cần cho MVP:** Thiết kế M-B..M-F đầy đủ trước khi có module nghiệp vụ; mở rộng i18n, UI kit; mở rộng audit đọc theo project trước khi có dữ liệu thật; tối ưu bundle web.
6. **Thứ tự tối ưu:** (1) Bằng chứng và Android build → (2) gate CI → (3) quyết định P0-06 và nghiệm thu 007b/M-E → (4) M-A → (5) Chấm công vertical slice → (6) Nhật ký, Công việc, Vật tư, Nhà thầu phụ → (7) Báo cáo → (8) E2E và pilot.
7. **Cần người dùng phê duyệt:** Mục 12 ở trên.

Không tuyên bố dự án sắp hoàn thành. Chưa có bằng chứng đủ cho MVP Pilot.
