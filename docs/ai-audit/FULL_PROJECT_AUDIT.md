# TOMONI / Partner OS — FULL PROJECT AUDIT & COMPLETION PLAN

- Ngày kiểm toán: 2026-11-25 (giờ +07)
- Chế độ: **AUDIT ONLY**. Không sửa code, migration, DB schema, RLS/RBAC; không commit/push/deploy; không xóa dữ liệu; không đánh dấu ACCEPTED.
- Nhánh/commit kiểm toán: `chore/rn-086-align` @ `683f52b` (nhánh **chưa có upstream**, trước `origin/main` 8 commit, trước `origin/chore/rn-086-align` @ `d249c50` 7 commit).
- Git status khi bắt đầu và kết thúc: chỉ có 2 mục untracked đã tồn tại từ trước — `docs/ai-audit/` (nay có thêm file này) và `files` (transcript PowerShell UTF-16, không phải dữ liệu; theo `docs/tiendo.md` dòng 39). Không đụng tới.
- Nguồn đối chiếu: `docs/PARTNER_OS_ARCHITECTURE_AI_CODING_CONTRACT.md`, `docs/3_TRACKER.md`, `docs/tiendo.md`, `docs/product/prd.md`, ADR-001…009, `MVP_COMPLETION_AUDIT.md`, `DATABASE_SECURITY_AUDIT.md`, `OFFLINE_SYNC_AUDIT.md`, code thực tế và các lệnh chạy lại trong phiên này.

Ký hiệu mức xác minh (không trộn lẫn): **IMPLEMENTED** (có code) · **TESTED** (có test chạy được và đạt) · **INTERNALLY_DONE** (AI coi là xong nội bộ, chưa có xác nhận chủ dự án) · **ACCEPTED** (chủ dự án xác nhận bằng văn bản) · **UNVERIFIED** / **BLOCKED** / **DEFERRED**.

---

## 1. Tổng quan hiện trạng

**Kết luận một dòng:** nền tảng (monorepo, tenancy/RBAC/RLS, audit, sync engine) **chắc và có test**, nhưng sản phẩm **chưa đạt MVP Pilot**: không có luồng nghiệp vụ end-to-end nào chạy được từ giao diện người dùng, mobile **chưa bao giờ chạy trên thiết bị/emulator**, và Android build **vẫn hỏng**.

| Hạng mục | Hiện trạng |
| --- | --- |
| Giai đoạn | Foundation + VS-01 (dự án/công ty/thành viên) ở mức PENDING_ACCEPTANCE; Worker + Attendance đã có code nhưng UI **chỉ đọc**. |
| Module nghiệp vụ PRD | 13 module: 0 module hoàn chỉnh; 2 module có một phần (Auth, HRM), 1 DEFERRED có code (Chấm công), 10 chưa có dòng code nào. |
| ACCEPTED | Chỉ migration 016 (tenant switcher) và ADR-008 theo xác nhận chủ dự án 2026-11-21 (`docs/3_TRACKER.md`, 016). **Mọi hạng mục khác là PENDING_ACCEPTANCE hoặc thấp hơn.** |
| Cổng chất lượng local | Tất cả **PASS** (xem 1.1). |
| Thiết bị/emulator | **Không có bằng chứng nào.** Android build FAILED (xác minh lại hôm nay). |
| CI GitHub | 11 run đều success, nhưng run mới nhất là `d249c50`; **migration 017–024, VS-01 web/mobile, attendance chưa từng chạy trên CI** (chưa push). |
| Môi trường hosted/staging | Chưa có bằng chứng; mọi migration chỉ chạy trên DB local. |

### 1.1 Bằng chứng chạy trong phiên này (2026-11-25)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm lint` (`eslint .`) | exit 0 |
| `pnpm typecheck --force` (không cache) | 10/10 task OK (17.2s) |
| `pnpm test` (vitest) | **29 file / 117 test PASS** |
| `pnpm architecture:check` | PASS |
| `pnpm build --force` | 10/10 OK. Web bundle `index-*.js` 520.21 kB (cảnh báo > 500 kB) |
| `npx supabase@3.2.0 test db` (DB local đang chạy sẵn) | **21 file / 193 test PASS** (`Result: PASS`). Không chạy `db reset` để không mất dữ liệu test local. |
| `gradlew assembleDebug` (`apps/mobile/android`) | **FAILED** sau 36s: `expo-autolinking-settings-plugin:compileKotlin` — "Class `kotlin.LazyKt__LazyKt` was compiled with an incompatible version of Kotlin. Actual metadata 2.3.0, compiler 2.1.0 can read up to 2.2.0", lớp nạp từ `gradle-9.4.1/lib/kotlin-stdlib-2.3.0.jar`. Log: `%TEMP%\tomoni-android-audit.log`. |
| `pnpm audit --prod` | 34 lỗ hổng (1 critical, 14 high, 13 moderate, 6 low), toàn bộ là phụ thuộc bắc cầu của Expo/React Native tooling (xem AUD-12) |
| Live DB (docker `supabase_db_partner-os`) | RLS **bật trên 13/13 bảng `public`**; mọi bảng đều có policy; 6 role trong `roles` |
| GitHub Actions (`nguyenlevel/congtruong_pro_V1`) | 11 run, tất cả `success` (Build & Test, Architecture Guard, Database pgTAP); mới nhất trên `d249c50` (PR #1) |
| Quét secret trong file tracked | Không có khóa thật; chỉ placeholder trong `.env.example`. `.env` bị `.gitignore` loại |
| Playwright E2E (`pnpm --filter @partner-os/web e2e`) | **KHÔNG chạy lại**: cần `E2E_PASSWORD` và tài khoản local tạo tay (xem AUD-10). Kết quả 3/3 PASS chỉ là ghi nhận lịch sử (tiendo dòng 44). |
| Emulator | `adb` có (`%LOCALAPPDATA%\Android\Sdk\platform-tools`), AVD `partner_os_api34` tồn tại, **0 thiết bị đang chạy**; không thể cài app vì build hỏng. Ghi chú "adb không có trong PATH" trong tracker/tiendo dòng 30–31 **đã lỗi thời**. |

### 1.2 Mức hoàn thiện theo tiêu chí nghiệm thu MVP Pilot (`MVP_COMPLETION_AUDIT.md` §11, đề xuất — chưa được chủ dự án duyệt)

| # | Tiêu chí | Đánh giá |
| --- | --- | --- |
| 1 | Công ty tạo dự án, thêm nhà thầu chính/phụ trên web | **PARTIAL**: thêm/sửa công ty tham gia có (RPC + UI); **không có chức năng tạo dự án/tenant** (AUD-04) |
| 2 | Thêm nhân sự vào dự án, phân vai trò theo dự án | **PARTIAL**: gán vai trò dự án có (nhập UUID thô); **không có UI tạo/sửa Worker** (AUD-01) |
| 3 | Worker đăng nhập mobile, chấm công online/offline, sync không trùng | **NOT MET**: không có UI tạo chấm công/worker, chưa có thiết bị, sync chưa idempotent (AUD-01/03/05) |
| 4 | Giao việc, cập nhật tiến độ | NOT STARTED |
| 5 | Nhật ký công trường, vật tư | NOT STARTED |
| 6 | Báo cáo tổng hợp | NOT STARTED |
| 7 | Cô lập dữ liệu giữa công ty/dự án | **MET ở mức DB** (pgTAP, 13/13 bảng RLS); thử 2 tài khoản thật chỉ ở E2E local |
| 8 | Thu hồi quyền có hiệu lực | **MET ở mức DB** (migration 014: quyền xác thực từ `memberships`); phía client UNVERIFIED |
| 9 | Logout không mất `pending_sync`, có cảnh báo | **NOT MET**: mobile không có nút đăng xuất (AUD-08) |
| 10 | Android build PASS, CI db-test + build-test PASS có log | **NOT MET**: Android FAILED; CI chỉ đến `d249c50` |
| 11 | Bằng chứng thiết bị/emulator | **NOT MET** |
| 12 | Nghiệm thu văn bản của chủ dự án | Chỉ 016/ADR-008 |

Không tính phần trăm hoàn thành tổng: chưa có trọng số được duyệt (đúng quy ước của `docs/tiendo.md`). Tỷ lệ tham khảo: 2/12 tiêu chí MET (cả hai chỉ ở mức DB), 2 PARTIAL, 3 NOT STARTED, 5 NOT MET.

---

## 2. Việc đã hoàn thành (kèm bằng chứng)

Mức dưới đây là IMPLEMENTED + TESTED **local**, trừ khi ghi khác. Không mục nào ACCEPTED ngoại trừ ghi chú.

| Mã | Hạng mục | Bằng chứng | Mức |
| --- | --- | --- | --- |
| D-01 | Monorepo Turborepo + pnpm; 8 package + 2 app; Architecture Guard 7 luật | `pnpm architecture:check` PASS hôm nay; CI Architecture Guard success | TESTED, CI |
| D-02 | Lint/typecheck/test/build gate | Mục 1.1; CI Build & Test success trên `32072db`, `d249c50` | TESTED, CI |
| D-03 | Schema tenancy: `tenants`, `organizations`, `projects`, `memberships`, `roles`, `permissions`, `workers`, `attendance`, `project_companies`, `project_memberships`, `audit_log`, `user_active_tenant` | 24 migration; 16 rollback (009–024); RLS bật 13/13 bảng (live DB) | TESTED |
| D-04 | RLS/RBAC: quyền lấy từ DB (`current_tenant_id`, `current_app_role` đọc `memberships`), JWT chỉ là bộ chọn; soft-delete project; gate `project_companies` ACTIVE | pgTAP 21 file / 193 test PASS; `soft_delete_tenant_context.test.sql`; ADR-008 | TESTED; 013–015 INTERNALLY_DONE |
| D-05 | Tenant switcher (DB RPC `select_active_tenant`, web dropdown, mobile guard chặn khi Outbox còn pending) | `tenant_switcher.test.sql`, `tenant-switch.test.ts` 8 ca | TESTED; **ACCEPTED** (016, chủ dự án 2026-11-21; thiết bị vẫn UNVERIFIED) |
| D-06 | Project RBAC: `PROJECT_MANAGER`, `PROJECT_VIEWER`; PM của MAIN_CONTRACTOR chỉ gán `WORKER`/`PROJECT_VIEWER`; PM của SUBCONTRACTOR không quản lý thành viên; SUBCONTRACTOR thấy dự án tham gia (chỉ mức project row) | 6 file pgTAP chuyên biệt; REST test bằng token thật (tiendo dòng 42) | TESTED; PENDING_ACCEPTANCE (017, 018, 020, 021) |
| D-07 | Audit log append-only + `write_audit` (allowlist 8 action, kiểm actor/tenant/membership/project) | `audit_log*.test.sql`, `add_project_member_and_write_audit_hardening.test.sql` (17 ca); ADR-009 | TESTED; PENDING_ACCEPTANCE (010, 011, 022, 023) |
| D-08 | Hardening DB-SEC-01/03/04/05/06 | Migration 021–024, pgTAP; `DATABASE_SECURITY_AUDIT.md` | TESTED; FIXED_PENDING_ACCEPTANCE |
| D-09 | VS-01 Web: danh sách/chi tiết dự án, CRUD công ty tham gia, quản lý thành viên | `supabaseProjectApi.test.ts` 10 ca; Playwright 3/3 (lịch sử) | TESTED (unit); E2E chỉ lịch sử; PENDING_ACCEPTANCE |
| D-10 | Contracts (Zod) cho Worker + Attendance + membership; domain rules/service | 8+4 test schema; 9 test attendance-service; 14 test domain | TESTED |
| D-11 | Sync engine (outbox, retry, cursor, audit event, conflict *types*) + transport Supabase worker/attendance + runtime + cursor tách theo tenant/recordType | 6+3+3 test engine/retry/conflict; `sync-runtime.test.ts`, `supabase-sync-transport.test.ts` (client giả) | TESTED với **fake/mock**; chưa test với Supabase thật |
| D-12 | Mobile: đăng nhập Supabase (SecureStore chunked), gate session cục bộ, nạp membership từ DB, danh sách dự án chỉ đọc | `chunked-secure-storage`, `memberships`, `project-read` test | TESTED (unit); UNVERIFIED trên thiết bị |
| D-13 | Web: đăng nhập, load member, danh sách Workers/Attendance (chỉ đọc) | `workersStore`, `attendanceStore` test | TESTED (unit) |
| D-14 | `jwt_expiry = 3600` ở `supabase/config.toml`; `enable_signup = false`; custom access token hook | Config; token thử `exp-iat=3600` (tiendo dòng 25) | TESTED local; hosted UNVERIFIED |

---

## 3. Việc chưa hoàn thành / đang có vấn đề

### 3.1 Danh sách phát hiện mới của đợt kiểm toán này (đã xác minh bằng đọc code + lệnh chạy)

| ID | Mức | Phát hiện | Bằng chứng |
| --- | --- | --- | --- |
| **AUD-01** | **P0** | **Không có đường UI nào tạo/sửa Worker hoặc Attendance, cả web lẫn mobile.** `createWorker`/`createWorkerOffline`/`createAttendance`/`createAttendanceOffline` chỉ được gọi trong test; các `*Page` chỉ render danh sách. Do đó Outbox → Sync gần như **không bao giờ được kích hoạt bởi người dùng**; tracker ghi `[x] Mobile: offline create` là **khẳng định quá mức** (chỉ đúng ở mức service + unit test). | `grep` toàn `apps/`: chỉ có `offline-worker.ts:10`, `offline-attendance.ts:10`, `worker-application.ts:17`, `attendance-application.ts:20` và test; `WorkersListPage.tsx` (web 53 dòng, mobile 105 dòng) không có form/`onPress`. |
| **AUD-02** | **P0** | **Mobile mở app lúc offline sẽ bị chặn.** `useSession` cho phép vào bằng phiên cục bộ, nhưng ngay sau đó `App.tsx` gọi `listMyTenants` (truy vấn `memberships`) và `getActiveTenantId` (RPC `current_tenant_id`) qua mạng; lỗi mạng → `accessError` → màn hình lỗi, không vào được danh sách cục bộ. Mâu thuẫn trực tiếp với "offline-first" và với chú thích của `useSession`. | `apps/mobile/src/app/App.tsx` (effect nạp tenants, nhánh `.catch`), `apps/mobile/src/auth/memberships.ts`. |
| **AUD-03** | **P0** | **Android build vẫn FAILED** (xác minh hôm nay): Gradle wrapper 9.4.1 nhúng `kotlin-stdlib 2.3.0` đè lên plugin nội bộ Expo biên dịch bằng Kotlin 2.1.x. Không có bất kỳ bản build/APK, không có chạy thiết bị. `adb` và AVD `partner_os_api34` **đã sẵn sàng**, nên blocker hiện chỉ còn là toolchain, không phải thiếu thiết bị. | Log `%TEMP%\tomoni-android-audit.log`; `apps/mobile/android/gradle/wrapper/gradle-wrapper.properties`. |
| **AUD-04** | **P0** | **Không có đường tạo tenant/dự án/người dùng ngoài SQL/seed.** Không có RPC `create_project`, không có form tạo dự án, `enable_signup=false` và không có luồng mời/onboard; thêm thành viên phải **gõ UUID người dùng thô** (`ProjectsPage`, e2e dùng UUID hard-code). Không thể onboard một công ty khách hàng. | `grep` RPC trong `supabase/migrations/` (không có create project/tenant); `ProjectsPage.tsx:226-247`; `vs01-members.spec.ts:6`. |
| **AUD-05** | **P1** | **Sync không idempotent.** `operationId` bị bỏ (`push(_operationId, …)`). Nếu server đã ghi nhưng ack mất, lần thử lại nhận `23505` (create) hoặc version-mismatch (update) → `acknowledged:false` → bản ghi thành `failed` vĩnh viễn dù dữ liệu đã lên server. `strategyForRecordType`/`Conflict` (ADR-005) **không được dùng ở đâu**: xung đột chỉ biểu hiện là push thất bại lặp lại, không có UI giải quyết. Record `failed` còn **chặn đổi tenant mãi mãi** (`countUnsynced`) mà không có cách retry/bỏ. | `supabase-sync-transport.ts:63-100`, `create-sync-engine.ts` (flush), `tenant-switch.ts`, grep không có caller của conflict. |
| **AUD-06** | **P1** | **Con trỏ pull theo `updated_at` với `gt` + `limit 50`**: các dòng cùng timestamp (insert hàng loạt trong một transaction) nằm vắt qua ranh giới trang sẽ **bị bỏ sót vĩnh viễn**. Thêm: một bản ghi remote không qua `Zod.parse` làm sập cả vòng sync (poison record), không có cách cách ly. | `supabase-sync-transport.ts` (`pull`), `sync-runtime.ts` (`parseRemote*`). |
| **AUD-07** | **P1** | **Không có lịch thử lại.** `useAutoSync` chỉ kích hoạt khi mount và khi offline→online; lỗi push lúc đang online không được thử lại đến khi đổi trạng thái mạng/khởi động lại. Không có backoff timer, không có chỉ báo trạng thái sync cho người dùng. | `use-auto-sync.ts`; `retry.ts` chỉ là chính sách, không có bộ lập lịch. |
| **AUD-08** | **P1** | **Mobile không có nút đăng xuất** (`signOut` trong `session.ts` không có caller) và **chưa có chính sách D-LOGOUT**. DB cục bộ/Outbox là toàn cục, không gắn người dùng: sau khi người dùng A rời máy, dữ liệu cục bộ của tenant còn nguyên cho người đăng nhập kế tiếp cùng tenant. | `App.tsx`, `session.ts:50`, `MVP_COMPLETION_AUDIT.md` D-LOGOUT (chưa trả lời). |
| **AUD-09** | **P1** | **Khoảng trống RBAC giữa DB và vai trò PM:** policy `workers`/`attendance` chỉ cho `SYS_ADMIN`, `SITE_MANAGER`, `SUB_CONTRACTOR` (+ `PROJECT_VIEWER` đọc workers). `PROJECT_MANAGER` (vai trò quản trị chính của VS-01) và `WORKER` **không đọc/ghi được** roster/chấm công, trong khi web vẫn hiển thị trang Workers cho PM (danh sách luôn rỗng). Ngoài ra RLS workers/attendance chỉ theo **tenant**, không theo project/membership. ADR-001 Q-PM-1 (đã duyệt) cho phép PM xem liên hệ nhân sự — chưa có policy hiện thực. **Đây là quyết định RBAC → chuyển PO, không tự sửa** (PO-03). | Live `pg_policies` (workers/attendance); `App.tsx` (render theo `role !== 'WORKER'`). |
| **AUD-10** | **P1** | **CI và tái lập E2E yếu:** (a) 7 commit gồm migration 017–024, VS-01, attendance **chưa push**, nhánh không có upstream → **mất công việc nếu hỏng máy** và chưa có CI; (b) Playwright không nằm trong CI; (c) E2E phụ thuộc tài khoản tạo tay + UUID hard-code + `E2E_PASSWORD`; seed không tạo auth user → `db reset` xong **không chạy được E2E**; (d) `tests/e2e/supabase-health.test.ts` bị skip; (e) CI không build mobile. | `git branch -vv`, `.github/workflows/*.yml`, `apps/web/e2e/vs01-members.spec.ts`, `supabase/seed/demo.sql`. |
| **AUD-11** | **P1** | **Khoảng trống kiểm thử:** 0 test component/page (web + mobile); store Watermelon thật chưa được test (chỉ port giả); sync transport chỉ test với client giả; không có test tích hợp với Supabase thật; E2E chỉ phủ luồng thành viên dự án (chưa có CRUD công ty, tenant switcher, worker, attendance, mobile). | Danh sách test (30 file); `tests/e2e` skip. |
| **AUD-12** | P2 | **Lỗ hổng phụ thuộc:** `pnpm audit --prod` 34 mục. Critical: `shell-quote` (qua `react-native>react-devtools-core`); high: `node-forge`, `picomatch`, `nanoid`, `source-map-js`, `brace-expansion`, `zod<4.6.6` (qua `expo>@expo/cli`). Đều là tooling dev-time của Expo/RN, chưa xác minh phơi nhiễm lúc chạy. | Đầu ra `pnpm audit --prod --json`. |
| **AUD-13** | P2 | **Attendance DEFERRED nhưng code đang nối vào cả hai app** (`App.tsx` web+mobile, `createAttendanceSyncRuntime`, migration 019/024). Cần chủ dự án chốt giữ/ẩn (SY-01 chưa có phản hồi). | `OFFLINE_SYNC_AUDIT.md` SY-01; `docs/3_TRACKER.md` Module 3. |
| **AUD-14** | P2 | **Quyền bảng ở mức Postgres:** `anon`/`authenticated` có đủ đặc quyền bảng (gồm `TRUNCATE`, vốn không bị RLS chặn) trên mọi bảng `public` — mặc định Supabase, PostgREST không lộ `TRUNCATE`, nên rủi ro thấp nhưng nên siết (defense-in-depth). ACL hàm `has_function_privilege` chưa có test pgTAP tự động. | Truy vấn `information_schema.role_table_grants` trên DB local. |
| **AUD-15** | P2 | **Tài liệu không nhất quán:** `MVP_COMPLETION_AUDIT.md` (mô tả "Chấm công NOT_STARTED", "8 P0", "adb thiếu") đã lỗi thời; tracker header "cập nhật 2026-11-18" nhưng nội dung đến 11-23; tracker Module 2 `[x] offline create` quá mức (AUD-01); PRD không có `PROJECT_MANAGER`; có 2 file `ADR-001-*`; `docs/tiendo.md` mục 9, 11 còn mục đã xử lý; lịch sử tiendo không theo thứ tự thời gian; `docs/operations/operations.md` chỉ 1.6 KB (chưa có runbook). | Đọc trực tiếp các tệp. |
| **AUD-16** | P2 | **Hiệu năng chưa được đo:** WatermelonDB @ 10k bản ghi, danh sách web/mobile không phân trang/ảo hóa (web tải toàn bộ). | Tracker 2.2 (`[ ]`); mã trang danh sách. |
| **AUD-17** | P3 | **Chất lượng UI/i18n:** chuỗi tiếng Việt hard-code ở 7 file `.tsx` (App, Login, TenantSwitcher, ProjectsPage…), `translate('vi', …)` cố định, chưa có chọn ngôn ngữ; web chuyển tenant hiển thị UUID thay vì tên (mobile hiển thị tên); web không có router (mọi trang xếp chồng); chunk web 520 kB. | Quét ký tự tiếng Việt trong `apps/**/*.tsx`. |
| **AUD-18** | P3 | **Chưa có quan sát/vận hành:** không có error reporting, không runbook sao lưu/khôi phục/rollback hosted, `deploy.yml` chỉ là placeholder, EAS chưa cấu hình (`eas.json` không tồn tại). Migration 001–008 không có rollback (chỉ 009–024). | `.github/workflows/deploy.yml`, thư mục `supabase/rollbacks`. |

### 3.2 Hạng mục cũ vẫn mở (kế thừa từ audit trước, đã đối chiếu)

| Mục | Tình trạng hiện nay |
| --- | --- |
| P0-01 Android build | **Vẫn FAILED** (AUD-03). |
| P0-03/04 Sync thật với Supabase + bằng chứng thiết bị | Chưa có (AUD-01/03/11). |
| P0-05 role `COMPANY_ADMIN`, `SITE_SUPERVISOR` (M-A) | M-A **NOT APPROVED**. `PROJECT_MANAGER` đã đi đường riêng (migration 018). `SITE_MANAGER` còn là role legacy mà policy workers/attendance vẫn phụ thuộc. |
| P0-06 Thu hồi quyền phụ thuộc JWT | Đóng ở mức DB (014 + pgTAP). Phía client UNVERIFIED. |
| P0-07 Mâu thuẫn tracker | Một phần còn (AUD-15). |
| P0-08 CI db-test | `db-test` đã success (run `44494086193`) nhưng **chỉ đến `d249c50`**. |
| Backfill 007b trên dữ liệu thật | MISSING EVIDENCE (chưa có staging). |
| Module `sub_contractors` | Chưa có bảng; mô hình hiện tại dùng `tenants` + `project_companies`. Chờ D-SUBCON. |
| Hosted Supabase (Dashboard JWT TTL, cấu hình auth) | UNVERIFIED. |

---

## 4. Mức hoàn thiện từng module

Thang: **L0** chưa có · **L1** thiết kế/DB · **L2** core + UI chỉ đọc hoặc một phần · **L3** vertical slice dùng được, có test, chưa chạy thiết bị · **L4** có bằng chứng thiết bị + E2E · **L5** ACCEPTED.

| Module / thành phần | DB/RLS | Core/Contracts | Web | Mobile/Offline | Test | Mức | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Nền tảng kiến trúc, CI | – | – | – | – | gate PASS | **L3** | CI chưa phủ commit mới |
| Tenancy / RBAC / RLS / audit | Có | Có | Có | Có | 193 pgTAP | **L3** (016: L5 mức DB) | PENDING_ACCEPTANCE phần lớn |
| 1. Auth & Onboarding | Hook JWT, tenant switcher | `packages/auth` | Login, chuyển tenant | Login, session cục bộ | unit | **L2** | Thiếu onboarding, mời user, quên mật khẩu, PIN/biometrics, QR, CCCD; offline cold-start hỏng (AUD-02) |
| VS-01 Dự án / công ty / thành viên | Có (009, 017–021) | – | CRUD công ty/thành viên, xem dự án | Danh sách dự án chỉ đọc | pgTAP + 10 unit + E2E lịch sử | **L3** | Thiếu tạo dự án (AUD-04); PENDING_ACCEPTANCE |
| 2. Hồ sơ nhân sự (HRM) | `workers` | Có | Danh sách chỉ đọc | Danh sách + service offline | unit/pgTAP | **L2** | Không có form (AUD-01); chưa chứng chỉ/hợp đồng/QR; PM không đọc được (AUD-09) |
| 3. Chấm công & vị trí | `attendance` (019, 024) | Có | Danh sách chỉ đọc | Danh sách + service offline + sync runtime | unit/pgTAP | **L2** · **DEFERRED** | GPS chưa làm; không có UI nhập |
| 4. An toàn lao động (HSE/TBM) | – | – | – | – | – | **L0** | |
| 5. Tính lương & công nhật | – | – | – | – | – | **L0** | |
| 6. Nhà thầu phụ (Hub) | Chưa có `sub_contractors` | – | – | – | – | **L0–L1** | Chờ D-SUBCON |
| 7. Giao việc & nhật ký thi công | – | – | – | – | – | **L0** | Cần Storage (ảnh) |
| 8. Tài liệu & bản vẽ | – | – | – | – | – | **L0** | `[storage]` bật trong config nhưng chưa dùng |
| 9. QA/QC & Punchlist | – | – | – | – | – | **L0** | |
| 10. Tài sản & vật tư | – | – | – | – | – | **L0** | |
| 11. Quyết toán & khối lượng | – | – | – | n/a (PRD: không mobile) | – | **L0** | |
| 12. Giao tiếp & thông báo | – | – | – | – | – | **L0** | |
| 13. Dashboard & analytics | – | – | – | – | – | **L0** | |
| Offline-first / Outbox / Sync | `version`, `updated_at` | `sync-engine` | n/a | Watermelon v4 + runtime | unit (fake) | **L2** | Chưa idempotent, chưa lập lịch, chưa thiết bị (AUD-05/06/07) |
| Android build / phân phối | – | – | – | – | – | **L0** | AUD-03 |

---

## 5. Lỗi và rủi ro cần khắc phục

| Mã | Rủi ro | Xác suất / Tác động | Giảm thiểu (task) |
| --- | --- | --- | --- |
| R1 | **Mất công việc**: 7 commit (migration 017–024, VS-01, attendance) chỉ nằm trên máy local, nhánh chưa upstream | Trung bình / **Cao** | T-01 |
| R2 | **Offline-first chưa từng được chứng minh**; lỗi AUD-01/02/03 khiến toàn bộ mô hình offline là giả thuyết | Cao / **Cao** | T-10 → T-14 |
| R3 | **Mất/kẹt dữ liệu sync** (AUD-05/06): ack mất, bỏ sót dòng cùng timestamp, record `failed` chặn tenant switch | Trung bình / **Cao** (công trường dùng offline dài) | T-20…T-23 |
| R4 | **Ngăn cách RLS chỉ theo tenant** cho workers/attendance: trong cùng tenant, mọi `SITE_MANAGER`/`SUB_CONTRACTOR` thấy mọi worker bất kể project/công ty tham gia | Trung bình / Trung bình–Cao | PO-03 → T-30 |
| R5 | **Vai trò PM không dùng được dữ liệu nhân sự** (AUD-09) → vertical slice sau này sẽ vấp lại | Cao / Trung bình | PO-03 |
| R6 | **Toolchain Android quá mới** (RN 0.87.1, Expo 57, Gradle 9.4.1, AGP 9.x) — lệch Kotlin giữa Gradle và plugin Expo; có thể cần nâng patch Expo hoặc ghim Gradle | Cao / Cao | T-10 |
| R7 | **Chưa có môi trường hosted/staging**; migration, backfill, cấu hình auth, JWT TTL thật chưa kiểm | Cao / Cao (khi pilot) | PO-07 → T-33 |
| R8 | **Drift tài liệu** làm quyết định sai (AUD-15), tracker nói "xong" cho thứ chưa dùng được | Cao / Trung bình | T-03 |
| R9 | **Chuỗi cung ứng** (AUD-12): 1 critical + 14 high trong tooling Expo/RN | Thấp–Trung bình / Trung bình | T-32 |
| R10 | **Mở rộng phạm vi**: PRD có 13 module, chủ dự án chưa duyệt D-SLICE; Attendance đang DEFERRED nhưng code đã lan vào UI | Trung bình / Cao | PO-01 |
| R11 | **Dữ liệu cục bộ lẫn người dùng** trên máy dùng chung (AUD-08) | Trung bình / Trung bình (dữ liệu nhân sự, PII) | PO-04 → T-24 |
| R12 | PAT GitHub từng lộ trong chat (tiendo dòng 19); người dùng đã xác nhận thu hồi — **cần xác minh lại ở GitHub Settings** | Thấp / Cao | Owner |

---

## 6. GAP so với MVP

Phạm vi MVP **chưa được chủ dự án phê duyệt chính thức** (D-SLICE: WAITING FOR INFORMATION; `FEATURE_GAP_ANALYSIS.md`: "MVP hiện tại là VS-01"). Bảng GAP dưới đây dùng khung đề xuất của `MVP_COMPLETION_AUDIT.md` §10–11 (VS-01 → VS-09) làm đường chuẩn.

| Slice đề xuất | Trạng thái | GAP chính |
| --- | --- | --- |
| VS-01 Auth/công ty/dự án/thành viên | L3, PENDING_ACCEPTANCE | Tạo dự án/tenant, mời user theo email, tên thay UUID, E2E mobile, nghiệm thu |
| VS-02 Nhân sự | L2 | Form tạo/sửa (web + mobile offline), quyền PM/WORKER, chứng chỉ/hợp đồng, QR (sau) |
| VS-03 Chấm công | L2, DEFERRED | Form nhập, duyệt, GPS (sau), quyết định giữ/ẩn |
| VS-04 Giao việc & tiến độ | L0 | Toàn bộ |
| VS-05 Nhật ký công trường | L0 | Toàn bộ, kèm ảnh offline + Storage |
| VS-06 Vật tư | L0 | Toàn bộ |
| VS-07 Nhà thầu phụ (Hub) | L0–L1 | Toàn bộ; quyết định D-SUBCON |
| VS-08 Báo cáo tổng hợp | L0 | Toàn bộ |
| VS-09 Offline & sync + Android | L2 | Idempotency, conflict UI, lập lịch, cold-start offline, build Android, bằng chứng thiết bị |
| Cross-cutting | – | CI cho commit mới, E2E tái lập, perf 10k, hosted env, vận hành |

Ngoài khung trên (PRD module 4, 5, 8, 9, 10, 11, 12, 13) **không nằm trong VS-01…09 đề xuất** → xem PO-01.

---

## 7. Backlog theo thứ tự ưu tiên

Quy ước: **P0** nghiêm trọng/chặn MVP · **P1** ưu tiên cao · **P2** trung bình · **P3** cải tiến. Agent: A=Architect, D=DBAgent, C=CoreAgent, W=WebAgent, M=MobileAgent. "PO" = cần chủ dự án quyết định trước (mục 9). Mỗi task kết thúc bằng gate đầy đủ (`pnpm lint`, `typecheck`, `test`, `architecture:check`, `build`, `supabase test db` khi đụng DB) và **không tự ghi ACCEPTED**.

### Wave A — Nền tảng quản trị (không cần PO, chạy song song, bắt đầu ngay)

| Task | Pri | Việc | Kết quả / Tiêu chí nghiệm thu | Phụ thuộc | Agent |
| --- | --- | --- | --- | --- | --- |
| **T-01** | P1 | Đẩy nhánh `chore/rn-086-align` lên remote và mở/cập nhật PR để chạy CI trên 017–024 *(cần chủ dự án cho phép push — mặc định audit không push)*. | Cả 3 workflow `success` trên HEAD; `db-test` chạy đủ 21 file/193 test; ghi run ID vào tiendo. | – | A |
| **T-02** | P1 | **E2E tái lập**: script `scripts/seed-local-e2e.ts` (chỉ chạy khi URL local) tạo tài khoản `pm.main`, `pm.sub`, `worker.sub` + dữ liệu qua Auth Admin API; bỏ UUID hard-code (tra theo email); thêm job Playwright vào CI với `supabase start`. | Máy sạch: `supabase db reset` → seed → `pnpm --filter @partner-os/web e2e` 3/3 PASS; CI job xanh; không có mật khẩu trong repo. | T-01 | W + D |
| **T-03** | P2 | Đồng bộ tài liệu: tracker (bỏ `[x]` quá mức Module 2; sửa ngày), `MVP_COMPLETION_AUDIT.md` (đánh dấu SUPERSEDED trỏ tới báo cáo này), tiendo mục 9/11 + thêm dòng lịch sử cho đợt audit, PRD thêm `PROJECT_MANAGER`, đổi tên ADR-001 trùng, xóa/ignore `files`. | Không còn mâu thuẫn giữa tracker/tiendo/PRD/báo cáo này; `pnpm format:check` sạch cho file đã đổi. | – | A |
| **T-05** | P1 | **Hồ sơ nghiệm thu** cho chủ dự án: một tài liệu liệt kê 007b, M-E (010–011), 012–015, 017, 018, 020, 021–024, VS-01 với bằng chứng/rollback/rủi ro còn lại. AI chỉ soạn; **chủ dự án quyết ACCEPTED**. | Tài liệu `docs/ai-audit/ACCEPTANCE_DOSSIER.md` có bảng 1 dòng/hạng mục, có lệnh tái chạy bằng chứng. | T-01 | A |

### Wave B — Mở khóa offline thật (P0)

| Task | Pri | Việc | Kết quả / Tiêu chí nghiệm thu | Phụ thuộc | Agent |
| --- | --- | --- | --- | --- | --- |
| **T-10** | **P0** | **Sửa toolchain Android**. Thứ tự thử: (1) ghim Gradle về bản có `kotlin-stdlib ≤ 2.2` tương thích Expo SDK 57 + AGP đang dùng; (2) nâng patch `expo`/`expo-modules-autolinking` trong SDK 57; (3) override phiên bản Kotlin cho `expo-gradle-plugin`. Không nâng major RN/Expo; nếu không thể thì chuyển PO (đổi stack). | `gradlew assembleDebug` exit 0; APK cài được vào AVD `partner_os_api34`; log lưu vào `docs/` hoặc session files; CI có job build mobile (typecheck + `assembleDebug` nếu khả thi). | – | M |
| **T-11** | **P0** | **Offline cold-start**: lưu bản chụp membership + tenant đang dùng trong SecureStore; khi offline dùng bản chụp (chỉ cho đọc/ghi cục bộ), khi online **luôn xác thực lại với DB** và áp dụng thu hồi (xóa quyền/khóa truy cập). Thêm trạng thái "offline" rõ ràng trong UI. | Unit test: cold-start không mạng vào được dữ liệu cục bộ; có mạng + bị thu hồi → chặn; emulator airplane-mode xác nhận (T-14). Không làm yếu D-REV/D-AUTH-CHECK. | – | M |
| **T-12** | **P0** | **Form tạo/sửa Worker** (mobile offline qua `createWorkerOffline`, web qua `createWorker`), kiểm quyền UI bằng `packages/auth`, i18n key mới (vi/en/ko), trạng thái lỗi/validation từ Zod. | E2E web tạo worker; mobile tạo offline → hiện trong danh sách ngay → có Outbox record; test component. *(PO-01 và PO-03 quyết định có làm trong MVP và ai được tạo.)* | PO-01, PO-03, T-11 | W + M + C |
| **T-13** | **P0** | **Hoàn thiện VS-01**: RPC `create_project` (SECURITY DEFINER, `search_path=''`, audit allowlist cập nhật + ADR), form tạo dự án web; **mời thành viên theo email** qua Edge Function dùng service role (không lộ key phía client) thay vì nhập UUID; hiển thị tên tenant. Mọi thứ kèm rollback và pgTAP. | pgTAP (ai được tạo, cross-tenant bị chặn); E2E: tạo dự án → thêm công ty → mời worker → worker đăng nhập; không có secret trong bundle. | PO-02 | D + W |
| **T-14** | **P0** | **Bằng chứng thiết bị/emulator** (kịch bản có kịch bản hóa): đăng nhập → tắt mạng → tạo worker → khởi động lại app → bật mạng → sync → kiểm Supabase → phát lại cùng thao tác không trùng; ảnh chụp + log `adb`. | Báo cáo bằng chứng lưu kèm, ghi trạng thái UNVERIFIED→VERIFIED cho từng bước; thất bại nào cũng mở task mới. | T-10, T-11, T-12 | M |

### Wave C — Độ đúng của đồng bộ (P1)

| Task | Pri | Việc | Kết quả / Tiêu chí nghiệm thu | Phụ thuộc | Agent |
| --- | --- | --- | --- | --- | --- |
| **T-20** | P1 | **Push idempotent**: sổ thao tác phía server (bảng `sync_operations(operation_id pk, tenant_id, record_type, record_id, result)` hoặc upsert theo `id`+kiểm `version` an toàn) và transport truyền `operationId`. | Test mô phỏng mất ack: phát lại cùng `operationId` → acknowledged, không tạo bản trùng, không rơi `failed`; pgTAP + vitest. Có rollback. | T-14 (khuyến nghị) | D + C + M |
| **T-21** | P1 | **Con trỏ keyset** `(updated_at, id)` thay `gt(updated_at)`; cách ly poison record (ghi lỗi, bỏ qua, báo cáo) thay vì sập cả vòng. | Test >50 dòng cùng timestamp qua nhiều trang: không sót; record hỏng không chặn record khác. | – | M + C |
| **T-22** | P1 | **Hiển thị và giải quyết xung đột**: dùng `strategyForRecordType` cho worker/attendance (mặc định `VERSION_CHECK` + `MANUAL`, theo ADR-005), trạng thái outbox `conflict/failed`, màn hình "Cần xử lý" (thử lại / giữ bản server / bỏ thay đổi), gỡ chặn đổi tenant có điều kiện. | Test: update cũ bị từ chối → xuất hiện trong danh sách xử lý; mọi lựa chọn đều có test; không ghi đè im lặng. | T-20 | M + C |
| **T-23** | P1 | **Lập lịch sync**: backoff mũ + jitter, chạy lại khi app trở về foreground, chỉ báo trạng thái (đã đồng bộ / đang chờ N / lỗi). | Test fake timer; emulator xác nhận tự thử lại sau lỗi mạng ngắt quãng. | T-20 | M |
| **T-24** | P1 | **Đăng xuất & dữ liệu cục bộ** theo quyết định PO-04: nút đăng xuất, cảnh báo khi còn `pending_sync`, chính sách xóa/giữ DB cục bộ theo người dùng, không bao giờ xóa Outbox chưa đồng bộ. | Test: logout khi còn pending bị cảnh báo; người dùng khác trên cùng máy không thấy dữ liệu người trước. | PO-04, T-22 | M |

### Wave D — Bảo mật & RBAC

| Task | Pri | Việc | Kết quả / Tiêu chí nghiệm thu | Phụ thuộc | Agent |
| --- | --- | --- | --- | --- | --- |
| **T-30** | P1 | Policy `workers`/`attendance` cho `PROJECT_MANAGER`, `WORKER`, phạm vi theo **project/công ty tham gia** theo quyết định PO-03 (migration mới, không sửa lịch sử). | pgTAP ma trận role × thao tác × tenant × project; rollback kiểm; ADR cập nhật. | PO-03 | D |
| **T-31** | P2 | Siết đặc quyền: `REVOKE ALL ON ALL TABLES … FROM anon` + default privileges, bỏ `TRUNCATE` cho `authenticated`; pgTAP kiểm `has_table_privilege` và `has_function_privilege` mọi RPC. | Test đạt; không làm vỡ PostgREST của `authenticated`; 193 test cũ vẫn PASS. | – | D |
| **T-32** | P2 | Phân loại 34 lỗ hổng: xác định cái nào vào bundle chạy; nâng patch Expo/RN hoặc `pnpm.overrides`; thêm `pnpm audit --prod` vào CI (cảnh báo, không chặn). | Bảng triage; 0 critical/high ảnh hưởng runtime; CI có bước audit. | T-10 | A |
| **T-33** | P2 | Checklist cấu hình **hosted** Supabase (JWT TTL, password policy, rate limit, SMTP, MFA admin, hook), xác minh trên staging. | Tài liệu + kết quả kiểm; khớp `config.toml`. | PO-07 | A + D |
| **T-34** | P2 | Đặt Attendance sau feature flag (ẩn khỏi UI/runtime) cho đến khi PO-01 trả lời; **không xóa code**. | Cờ tắt = không route/không sync attendance; test cả hai trạng thái. | PO-01 | W + M |

### Wave E — Chất lượng, hiệu năng, vận hành

| Task | Pri | Việc | Tiêu chí nghiệm thu | Phụ thuộc | Agent |
| --- | --- | --- | --- | --- | --- |
| **T-40** | P1 | Test component/page (web: Testing Library; mobile: RN Testing Library) cho Login, TenantSwitcher, List, Form; test Watermelon thật (adapter LokiJS) cho local store/outbox. | ≥ 1 test/trang chính; store test chạy trong `pnpm test`. | T-12 | W + M |
| **T-41** | P2 | Test tích hợp sync transport với Supabase local thật (thay `tests/e2e` bị skip), chạy trong CI. | Bộ test chạy trên `supabase start`; bao gồm cross-tenant, thu hồi, phát lại. | T-02, T-20 | C |
| **T-42** | P2 | Đo hiệu năng: seed 10k worker/attendance trong Watermelon, đo cold start, list, sync; thêm phân trang/ảo hóa danh sách web/mobile; đặt ngân sách. | Báo cáo số liệu + ngân sách đạt; `audit-docs` theo tracker 2.2. | T-14 | M + W |
| **T-43** | P3 | i18n hóa chuỗi cứng, chọn ngôn ngữ, router web + lazy load (giảm chunk), nhãn tenant thay UUID. | Không còn chuỗi cứng trong `.tsx`; chunk chính < 500 kB. | PO-09 | W + M |
| **T-44** | P3 | Quan sát & vận hành: error boundary + báo cáo lỗi, runbook backup/restore/rollback hosted, hoàn thiện `deploy.yml`/EAS. | Runbook + pipeline chạy thử trên staging. | PO-07 | A |

### Wave F — Phần MVP còn lại (chỉ sau khi PO-01 chốt phạm vi; mỗi slice theo `MODULE_VERTICAL_SLICE_PLAYBOOK.md`, một slice một lần)

Thứ tự đề xuất (từ `MVP_COMPLETION_AUDIT.md` §10 và `IMPLEMENTATION_RECOMMENDATIONS.md`): **T-50 Nhật ký công trường** (offline-thực tế nhất, cần Storage/ảnh) → **T-51 Giao việc & tiến độ** → **T-52 Vật tư cơ bản** → **T-53 Nhà thầu phụ (Hub)** → **T-54 Báo cáo tổng hợp** → **T-55 Chấm công hoàn chỉnh (nếu undefer)**. Mỗi slice: DB+RLS+rollback+pgTAP → Core/Contracts → Web/Mobile → sync → E2E + bằng chứng emulator; Definition of Done = gate đầy đủ + bằng chứng thiết bị; trạng thái cuối luôn dừng ở PENDING_ACCEPTANCE.

**Thứ tự thực thi tổng thể:** Wave A (T-01, T-02, T-03, T-05) ∥ T-10, T-11 → T-14 (khi có T-12) → Wave C (T-20 → T-21/T-22 → T-23 → T-24) → Wave D (T-30 khi có PO-03; T-31/T-32 bất cứ lúc nào) → Wave E (T-40 song song từ T-12; T-42 sau T-14) → Wave F từng slice. Cổng chuyển giai đoạn: **không mở slice mới khi chưa có T-14 PASS và T-20 PASS**.

---

## 8. Kế hoạch hoàn thiện (các mốc)

| Mốc | Nội dung | Điều kiện hoàn thành (đều phải có bằng chứng) |
| --- | --- | --- |
| **M0 — Ổn định nền** | T-01, T-02, T-03, T-05, T-31, T-32 | CI xanh trên toàn bộ commit hiện có; E2E tái lập; tài liệu nhất quán; hồ sơ nghiệm thu gửi chủ dự án |
| **M1 — Offline thật** | T-10, T-11, T-12, T-13, T-14 | APK chạy trên AVD; luồng tạo Worker offline → sync lên Supabase có bằng chứng; có thể tạo dự án và mời người dùng không cần SQL |
| **M2 — Sync đáng tin** | T-20…T-24, T-40, T-41 | Phát lại không trùng; không sót dòng; xung đột có UI; logout an toàn; test Watermelon thật |
| **M3 — Phân quyền dữ liệu nhân sự đúng** | T-30 (+ T-34) | Ma trận role × dữ liệu được duyệt và có pgTAP; Attendance theo quyết định PO-01 |
| **M4 — Slice nghiệp vụ MVP** | T-50…T-54 (theo phạm vi duyệt) | Mỗi slice đạt DoD; tiêu chí nghiệm thu 1–9 trong 1.2 đều MET |
| **M5 — Sẵn sàng Pilot** | T-33, T-42, T-43, T-44 | Staging chạy; perf đạt ngân sách; runbook; chủ dự án nghiệm thu bằng văn bản |

Đường găng: **T-10 (Android) → T-14 (bằng chứng thiết bị) → T-20 (idempotent) → slice nghiệp vụ**. Mọi slice nghiệp vụ mới trước khi qua T-14 sẽ chồng thêm rủi ro chưa kiểm chứng lên nền chưa chạy trên thiết bị.

---

## 9. Vấn đề thực sự cần Product Owner quyết định

Chỉ những mục thuộc nghiệp vụ, phạm vi, quyền người dùng, chi phí hoặc rủi ro không thể khôi phục. Mọi quyết định kỹ thuật khác (idempotency, con trỏ keyset, toolchain, test, hiệu năng…) AI tự quyết trong phạm vi đã duyệt.

| Mã | Câu hỏi | Đề xuất của AI (không tự áp dụng) | Chặn task |
| --- | --- | --- | --- |
| **PO-01** | **Phạm vi MVP và thứ tự slice (D-SLICE)**: MVP gồm slice nào? VS-02 (Nhân sự) và VS-03 (Chấm công) có được mở? 8 module PRD còn lại (HSE, lương, tài liệu, QA/QC, tài sản, quyết toán, thông báo, dashboard) có nằm ngoài MVP không? Attendance (DEFERRED nhưng đã nối UI/sync): **giữ nguyên, ẩn sau cờ, hay gỡ khỏi UI** (SY-01)? | MVP = VS-01 → VS-02 → Nhật ký → Giao việc → Vật tư → Báo cáo; Attendance ẩn sau cờ đến khi duyệt | T-12, T-34, Wave F |
| **PO-02** | **Ai được tạo tenant/dự án và cách onboard người dùng**: chỉ SYS_ADMIN? PM của nhà thầu chính tạo dự án? Mời bằng email (tự đăng ký tắt) hay admin tạo tài khoản? Phạm vi CRUD nhà thầu phụ (D-SUBCON)? | Chỉ SYS_ADMIN tạo tenant; PM của MAIN_CONTRACTOR tạo dự án trong tenant của mình; mời qua email | T-13 |
| **PO-03** | **Quyền với dữ liệu nhân sự/chấm công**: `PROJECT_MANAGER` và `WORKER` được đọc/ghi gì? Phạm vi theo tenant hay theo project/công ty tham gia? `SITE_MANAGER` (legacy) giữ hay thay (M-A)? Q-PM-1 (PM xem liên hệ nhân sự) được hiện thực đến mức nào? | PM đọc roster của các công ty tham gia project của mình (chỉ trường liên hệ cần thiết); WORKER chỉ đọc bản ghi của chính mình | T-12, T-30 |
| **PO-04** | **Chính sách đăng xuất & dữ liệu cục bộ (D-LOGOUT)**: chặn đăng xuất khi còn dữ liệu chưa đồng bộ hay cho phép kèm cảnh báo? Xóa DB cục bộ sau khi đồng bộ hết hay giữ? Máy dùng chung có được phép? | Cảnh báo, không bao giờ xóa Outbox chưa đồng bộ; xóa dữ liệu cục bộ của người dùng cũ sau khi đồng bộ sạch | T-24 |
| **PO-07** | **Môi trường hosted/staging và chi phí**: có tạo Supabase hosted (staging/production), EAS build, tên miền? Ngân sách? Cho phép audit read-only backfill 007b trên dữ liệu ẩn danh? | Tạo 1 staging trước; production chỉ sau M5 | T-33, T-44, backfill |
| **PO-08** | **Chuẩn bằng chứng thiết bị**: chủ dự án không dùng thiết bị thật (tiendo dòng 32). Chấp nhận **emulator `partner_os_api34`** làm bằng chứng nghiệm thu MVP hay bắt buộc ít nhất 1 thiết bị thật trước pilot? | Emulator cho MVP; 1 thiết bị thật trước pilot | T-14, M5 |
| **PO-09** | **Ngôn ngữ trong MVP**: chỉ tiếng Việt hay vi/en/ko (PRD nêu đa ngôn ngữ, dịch tự động ở Module 12)? | MVP chỉ vi + khung i18n; en/ko sau pilot | T-43 |
| **PO-10** | **Nghiệm thu (ACCEPTED)** các hạng mục PENDING_ACCEPTANCE: 007b, M-E (010–011), 012–015, 017, 018, 020, 021–024, VS-01; và **M-A (NOT APPROVED)**. Chỉ chủ dự án quyết; AI soạn hồ sơ ở T-05. | – | Tiến độ chính thức |

Các câu hỏi cũ đã được trả lời nên không lặp lại: PM của SUBCONTRACTOR không quản lý thành viên (đã duyệt), PROJECT_MANAGER chỉ gán WORKER/PROJECT_VIEWER (đã duyệt, đã hiện thực), không có restore project trong MVP (đã duyệt), tenant switcher phương án A (ACCEPTED), JWT TTL giữ nguyên (D-JWT).

---

## 10. Phụ lục — điều chưa xác minh trong đợt này

- Playwright E2E không chạy lại (thiếu tài khoản/`E2E_PASSWORD` tái lập — AUD-10).
- `supabase db reset` không chạy (tránh mất dữ liệu test local); pgTAP chạy trên DB đang có.
- Bất kỳ hành vi nào trên thiết bị/emulator, Supabase hosted, staging, dữ liệu thật.
- Phơi nhiễm thực tế của 34 lỗ hổng phụ thuộc (chưa phân tích đường chạy).
- Hiệu năng WatermelonDB và các danh sách ở quy mô lớn.
