# MILESTONE & TASK TRACKER (3_TRACKER.md) - PARTNER OS
**Dự án:** Partner OS - Multi-tenant, Offline-first Construction Management
**Quy ước trạng thái:** `[ ]` Chưa thực hiện | `[/]` Đang thực hiện | `[x]` Đã hoàn thành & kiểm tra thành công

> Base line: contract `docs/PARTNER_OS_ARCHITECTURE_AI_CODING_CONTRACT.md`.
> Cập nhật lần cuối: 2026-11-18 (hoàn thiện tài liệu 007b; chờ duyệt trước 007c).

---

## GIAI ĐOẠN 0: KHỞI TẠO NỀN TẢNG & KIẾN TRÚC

### 0.1 Môi trường Workspace & Cấu hình Monorepo
- [x] Monorepo Turborepo + pnpm (root scripts: dev/build/lint/typecheck/test/test:e2e)
- [x] Cấu trúc `apps/` + `packages/` theo contract §3 (web, mobile + 8 packages)
- [x] Công cụ chuẩn: `.prettierrc`, `eslint.config.mjs`, root `tsconfig.json`, `.env.example`
- [x] Arbitrary God Package `packages/shared-core` / `shared-ui` đã gỡ bỏ (contract §5)
- [x] Architecture Guard (`scripts/check-architecture.ts`) + check-dependencies + validate-env
- [x] CI workflows: `build-test.yml`, `architecture-check.yml`, `deploy.yml`
- [x] Governance `.ai/agents|rules|handover` + root `AGENTS.md` (thay `AI-GOVERNANCE`)
- [x] Docs restructure: `docs/architecture|adr|product|security|testing|operations` + 7 ADR

### 0.2 Hạ tầng Backend & Lớp dữ liệu Lõi
- [x] Khởi động Supabase Local (`npx supabase@3.2.0 start`; CLI 2.46.1 không parse được `config.toml`)
- [x] Migration 006 `workers.version` áp dụng qua `db reset`; `supabase test db` PASS (11 pgTAP tests)
- [x] Roles tĩnh tại `packages/auth/src/roles`
- [x] Zod Schemas tại `packages/contracts/src/schemas` (Worker + common)
- [x] Repository abstraction tại `packages/database`
- [/] WatermelonDB Local Schema + Worker/Outbox adapter tại `apps/mobile/src/database/` (đã tích hợp App; còn native smoke test/migrations runtime)
- [/] Khung Sync Engine (`packages/sync-engine`: outbox, queue, retry, conflict, cursor, audit) — có `createSyncEngine` (flush/pull/audit) + transport Supabase cho `worker` (`apps/mobile/src/sync`), mobile đã đăng nhập Supabase và tự sync qua `use-auto-sync`; chưa có bằng chứng chạy trên thiết bị/emulator
- [x] Migrations + RLS cơ bản (rbac, tenancy, workers) + seed + RLS tests stub
- [ ] Bổ sung bảng cho 13 module nghiệp vụ (chờ pipeline mỗi module)

#### 0.2a Migration 007 — RBAC theo Company / Project

> Quy ước mức xác minh: **IMPLEMENTED** (đã viết code/SQL) · **TESTED** (có test chạy được và đạt) ·
> **VERIFIED** (đã chạy thật trên DB local, có bằng chứng) · **ACCEPTED** (chủ dự án xác nhận) · **BLOCKED**.
> Không đánh dấu ACCEPTED nếu chưa có xác nhận của chủ dự án. Mọi số liệu dưới đây là DB local, không phải dữ liệu thật.

| Hạng mục | IMPLEMENTED | TESTED | VERIFIED | ACCEPTED | Bằng chứng / giới hạn |
| --- | --- | --- | --- | --- | --- |
| 007a — bỏ `unique(user_id)` trên `memberships` | [x] | [x] | [x] | [ ] | `membership.test.sql`; `db reset` + `test db` đạt |
| 008 — PROJECT_VIEWER (MAIN_BOD → PROJECT_VIEWER) | [x] | [x] | [x] | [ ] | `project_viewer.test.sql` (7 test) |
| 007b — `project_companies`, `project_memberships`, backfill, helper, RLS | [x] | [x] | [/] | [ ] | **IMPLEMENTED + TESTED – PENDING ACCEPTANCE**. Xem chi tiết bên dưới |
| 007b — rollback (`supabase/rollbacks/...down.sql`) | [x] | [ ] | [x] | [ ] | Đã chạy trên DB local: archive 1 dòng, bảng bị drop, chạy lại bị chặn, reset khôi phục đạt |
| 007b — audit backfill (`supabase/audit/...sql`) | [x] | [ ] | [/] | [ ] | Chạy được trên DB rỗng; mọi check = 0. Chưa đối chiếu dữ liệu thật |
| 007b — pgTAP CI (`.github/workflows/db-test.yml`) | [x] | [ ] | [ ] | [ ] | YAML chưa parse bằng công cụ; chưa chạy trên GitHub Actions |
| ADR-001 addendum (mô hình tenant membership) | [x] | n/a | n/a | [ ] | `docs/adr/ADR-001-monorepo.md`; phần đề xuất chưa duyệt |
| Thiết kế backend tenant membership | [x] (tài liệu) | n/a | n/a | [ ] | Chưa có code; chờ duyệt |
| 007c / 007d / 007e | [ ] | [ ] | [ ] | [ ] | **BLOCKED**: chờ chủ dự án duyệt. Không triển khai. |
| 012 — P1-04 `is_project_member` + `write_audit` loại project soft-deleted (`20260923000012`) | [x] | [x] | [x] | [ ] | `db reset` exit 0; `supabase test db` 68/68 PASS (local). Rollback đã áp và kiểm: 1 ca soft-delete FAIL đúng kỳ vọng; re-apply 012 đạt. ACL hai hàm không đổi sau rollback/re-apply. Chưa kiểm trên hosted. |
| 013 — P1-01/02 ẩn project soft-deleted (policy SELECT `projects`, `is_main_contractor_manager`) (`20260923000013`) | [x] | [x] | [x] | [ ] | `db reset` exit 0; pgTAP `soft_delete_tenant_context.test.sql` PASS trong 81/81. Mutation: gỡ 013–015 → 5 ca FAIL. Chưa kiểm rollback riêng từng file. Chưa kiểm trên hosted. |
| 014 — P1-04 xác thực tenant từ DB (`current_tenant_id`, `current_app_role`) (`20260923000014`) | [x] | [x] | [x] | [ ] | Pgtap (82/82 PASS): claim tenant không thuộc user → NULL; membership đã xóa + claim cũ → NULL; forged app_role bị bỏ qua. Tenant switcher MVP đã triển khai ở migration 016 (xem dòng 016). Rủi ro: client không có membership nhận NULL; luồng web/mobile UNVERIFIED. ADR-008. |
| 015 — P1-03 gate `project_companies` ACTIVE cho thao tác nghiệp vụ (`20260923000015`) | [x] | [x] | [x] | [ ] | Pgtap: ACTIVE true, SUSPENDED/ENDED false; audit ghi được với ENDED. Chưa có luồng nghiệp vụ nào gọi hàm gate. ADR-008. |
| 016 — Tenant switcher MVP, phương án A (`20260923000016`) | [x] | [x] | [/] | [ ] | `db reset` exit 0; pgTAP `tenant_switcher.test.sql` trong 95/95 PASS; `tenant-switch.test.ts` 3/3 PASS; lint/typecheck/test/architecture:check exit 0. Rollback 016 kiểm trong transaction (không áp lên DB giữ lại). UNVERIFIED: `refreshSession()` cấp claim mới trên web/mobile thực tế; UI mobile đã gắn switcher (xem dòng 014 và Mục 14 dòng 31); kiểm tay trình duyệt chưa làm; hosted chưa kiểm. Kiểm trên emulator/thiết bị: BLOCKED ( `adb` không có trong PATH, `ANDROID_HOME` chưa đặt) và chưa có test Watermelon store thật (UNVERIFIED). Mobile đã có loader membership từ DB (`apps/mobile/src/auth/memberships.ts`), switcher gắn guard (`apps/mobile/src/auth/TenantSwitcher.tsx`), cursor sync tách theo tenant; `vitest run` mobile 24/24 PASS; typecheck, lint, architecture:check exit 0. Web không có Outbox nên guard không áp dụng, ghi nhận rõ. Mobile guard test 8/8 (gồm record lỗi đang retry). ACCEPTED (chủ dự án xác nhận 2026-11-21; kiểm trên thiết bị Android vẫn BLOCKED/UNVERIFIED). ADR-008. |

**Bằng chứng kiểm thử (007b, lần chạy gần nhất):**
- `npx supabase@3.2.0 db reset`: OK, áp dụng migration 000002–000009 và seed.
- `npx supabase@3.2.0 test db`: **33/33 PASS** (helpers 3, membership 5, project_membership 15, project_viewer 7, workers 3).
- Cross-project, cross-company, cross-tenant, quyền worker và chặn ghi trực tiếp được kiểm trong `project_membership.test.sql`.

**Giới hạn xác minh (chưa làm được):**
- Backfill trên dữ liệu thật: DB local không có membership, nên không đối chiếu được số lượng trước/sau.
- CI pgTAP: chưa chạy trên GitHub Actions.
- Custom access token hook chưa đổi; vẫn chỉ lấy một membership.

**Rủi ro còn lại:**
1. Custom access token hook dùng `order by created_at limit 1`. User nhiều công ty chỉ có một claim. Cần thay bằng tra cứu `project_memberships` (chưa triển khai, cần duyệt).
2. Soft-deleted project vẫn được backfill. Cần quyết định.
3. Quyền Worker và Subcontractor chưa thu hẹp đầy đủ (thuộc 007d).
4. Ánh xạ `SITE_MANAGER` và `SYS_ADMIN` chưa được duyệt (thuộc 007c).
5. `memberships.role` còn tồn tại, deprecated; sẽ xóa ở migration riêng sau khi đủ điều kiện.
6. Backend/API hiện tại chưa được chuyển sang kiểm tra quyền qua `project_memberships`.

**Cần chủ dự án duyệt:** (a) quy tắc soft-deleted project; (b) U1, U2 trong ADR-001; (c) cách kiểm chứng backfill trên dữ liệu thật; (d) chấp nhận 007b (ACCEPTED).

---

## GIAI ĐOẠN 1: TRIỂN KHAI 13 PHÂN HỆ NGHIỆP VỤ

> Quy trình mỗi Module: DBAgent SQL+RLS → CoreAgent Zod+models → Web/MobileAgent UI.

### Module 1: Auth & Onboarding — `[ ]`
### Module 2: Hồ sơ Nhân sự (HRM & Worker Profile)
- [x] **Core:** `WorkerSchema`, status-transition rules + WorkerRepository interface
- [x] **Web:** vertical slice — Worker list feature (api adapter, app service, zustand store, page)
- [x] **Mobile:** vertical slice — offline create (validate → local repo → outbox) + list page
- [x] **Mobile:** đăng nhập Supabase (chunked SecureStore), gate session, `createWorkerSyncRuntime` tự sync khi có mạng (`use-auto-sync`)
- [ ] **Mobile:** kiểm chứng trên thiết bị/emulator; chưa enforce role WORKER như web
- [ ] **DB/RLS:** bảng `sub_contractors` + more HRM columns (next)
- [ ] **Web:** Upload chứng chỉ & cảnh báo hết hạn
- [ ] **Mobile:** Thẻ công nhân QR & tra cứu kỹ năng
### Module 3: Chấm công & Vị trí — `[ ]` DEFERRED (đến VS-03; code hiện có giữ nguyên, không ACCEPTED)
- [ ] **Attendance — DEFERRED / PENDING_APPROVAL (quyết định owner, chưa nghiệm thu):** chưa triển khai thêm, không mở rộng VS-03. Phần đã có bên dưới giữ nguyên, không ACCEPTED.
- [x] **DB/RLS:** migration `20260923000019_init_attendance` + rollback + pgTAP `attendance.test.sql` (6 test: tenant isolation, cross-tenant insert, duplicate (tenant,worker,date), invalid status, worker ngoài tenant, role gate) — `supabase test db` 128/128 PASS
- [x] **Core:** `Attendance` entity/status enum, rules (workDate, check-out ≥ check-in, note ≤ 500), service, `AttendanceSchema` + DTO (Create/Update/ListQuery) + `AttendanceApi` + events + `AttendanceRepository` interface
- [x] **Web:** vertical slice — supabase api adapter, application service, zustand store (+3 test), `AttendancePage`; wire vào `App.tsx`
- [x] **Mobile:** vertical slice — schema v4 (bảng `attendance`) + migration v4, `AttendanceModel`, local store, `localAttendanceRepository` (outbox), `createAttendanceOffline` (+4 test), `AttendanceListPage`; wire vào `App.tsx`
- [x] **Sync:** `createSupabaseAttendanceTransport` (push/pull, VERSION_CHECK), `createAttendanceSyncRuntime` (cursor tách theo tenant + recordType)
- [x] i18n: key `nav.attendance` (vi/en/ko)
- [ ] Vị trí (GPS/location) — để giai đoạn sau; chưa verify trên thiết bị; chưa ACCEPTED
### Module 4: An toàn Lao động (HSE & TBM) — `[ ]`
### Module 5: Tính lương & Công nhật — `[ ]`
### Module 6: Nhà thầu phụ (Hub) — `[ ]`
### Module 7: Giao việc & Nhật ký thi công — `[ ]`
### Module 8: Tài liệu & Bản vẽ — `[ ]`
### Module 9: QA/QC & Punchlist — `[ ]`
### Module 10: Tài sản & Vật tư — `[ ]`
### Module 11: Quyết toán & Khối lượng — `[ ]`
### Module 12: Giao tiếp & Thông báo — `[ ]`
### Module 13: Dashboard & Analytics — `[ ]`

---

## GIAI ĐOẠN 2: KIỂM THỬ, TỐI ƯU & TRIỂN KHAI

### 2.1 Kiểm thử Tự động
- [x] Unit tests: Zod schemas, domain rules (worker transitions), auth guards, retry/conflict, i18n, shared-utils, zustand store
- [x] Integration tests: sync-engine flow + worker use-case (fake adapter) (`tests/integration/`)
- [ ] E2E thật (cần Supabase live): `tests/e2e/` (hiện skip khi chưa cấu hình env)
- [x] Chạy `supabase test db` khi có local DB (`tests/rls/workers.test.sql` PASS)

### 2.2 Kiểm toán & Bảo mật
- [ ] Kiểm tra toàn bộ RLS chặn rò rỉ Multi-tenant cho mọi bảng
- [ ] Kiểm toán hiệu năng WatermelonDB @ 10k records
- [ ] Xuất báo cáo vào `audit-docs/`

### 2.3 CI/CD & Đóng gói
- [x] GitHub workflow `build-test.yml` + `architecture-check.yml`
- [ ] Deploy Web lên Production (proxy `deploy.yml`)
- [ ] Đóng gói APK/IPA (EAS) — workflow stub trong `deploy.yml`

### 2.4 Phase B audit (2026-11-23)
- [x] DB/Security audit — [DATABASE_SECURITY_AUDIT.md](../DATABASE_SECURITY_AUDIT.md): AUDIT_DONE, TESTED (pgTAP 140/140 PASS, DB local).
- [x] Multi-tenant và Offline/Sync audit — [OFFLINE_SYNC_AUDIT.md](../OFFLINE_SYNC_AUDIT.md): AUDIT_DONE.
- [x] DB-SEC-01: PROJECT_MANAGER chỉ gán WORKER/PROJECT_VIEWER — IMPLEMENTED + TESTED (migration 021, pgTAP). PENDING_ACCEPTANCE.
- [x] PM của SUBCONTRACTOR không quản lý Project Members (quyết định nghiệp vụ đã duyệt) — DB/RPC/RLS đã chặn; pgTAP `subcontractor_pm_project_members.test.sql` (11 test) + E2E `pm.sub` PASS. PENDING_ACCEPTANCE.
- [x] DB-SEC-03: SUBCONTRACTOR thấy dự án tham gia (ACTIVE/SUSPENDED/ENDED, không soft-delete) — IMPLEMENTED + TESTED (migration 021, pgTAP). PENDING_ACCEPTANCE.
- [x] VS-01 RPC thành viên (local REST, 2026-11-23): PM của MAIN_CONTRACTOR chỉ gán WORKER/PROJECT_VIEWER; PM SUB bị từ chối quản lý thành viên (thiết kế migration 020). Chi tiết: tiendo dòng 42. PENDING_ACCEPTANCE.
- [x] DB-SEC-04 (write_audit allowlist 8 action, migration 20260925000023) và DB-SEC-06 (consolidate add_project_member, migration 20260925000022): IMPLEMENTED + TESTED local (`supabase test db` 19 file / 188 PASS; `pnpm test` 117/117; `pnpm architecture:check` PASS). ADR-009. PENDING_ACCEPTANCE.
- [x] DB-SEC-05 (attendance UPDATE): migration 20260925000024 siết quyền UPDATE; pgTAP PASS (FIXED_PENDING_ACCEPTANCE). Còn mở: workers ghi trực tiếp từ client, chưa có RPC.
- [ ] DB-SEC-02 (MAIN_BOD): đã điều tra, không còn tham chiếu live; chờ acceptance. Attendance giữ DEFERRED.
- [ ] Android thiết bị/emulator: BLOCKED (không có thiết bị). Không đánh dấu PASS.
- [x] Web E2E VS-01 (Playwright 1.49.1, local 2026-11-23): 2 PASS (PM MAIN chỉ thấy WORKER/PROJECT_VIEWER; thêm và thu hồi worker SUB qua UI), 1 PASS (PM SUB là người tham gia thấy dự án ở chế độ chỉ xem, không có form quản lý; gap cũ đã đóng, danh sách web dựa vào RLS). `pnpm e2e` 3/3 PASS. Chưa bao gồm CRUD công ty và tenant switcher. PENDING_ACCEPTANCE. Android thiết bị — BLOCKED.
- [x] Mobile project list chỉ đọc theo tenant — IMPLEMENTED + TESTED (unit 2 ca, typecheck, lint). Thiết bị: UNVERIFIED/BLOCKED. PENDING_ACCEPTANCE.
- [ ] Web E2E — UNVERIFIED. Android thiết bị — BLOCKED.
- Migration 017, 018, 020: TESTED (DB), PENDING_ACCEPTANCE. Không ACCEPTED.
