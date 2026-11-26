# ADR-008: Soft-delete visibility, project_companies status gate, DB-authoritative tenant context

Status: ACCEPTED (chủ dự án xác nhận 2026-11-21, dựa trên bằng chứng DB/unit local). Kiểm trên thiết bị/emulator Android: BLOCKED/UNVERIFIED, chủ dự án chấp nhận không kiểm trên thiết bị.

## Context

Audit P1 phát hiện:

- P1-01/02: policy SELECT `projects` và `is_main_contractor_manager` không lọc `deleted_at`.
- P1-03: không có điểm enforcement nào đọc `project_companies.status` (ACTIVE / SUSPENDED / ENDED).
- P1-04: `current_tenant_id()` và `current_app_role()` chỉ đọc JWT claim.

## Decisions

1. Project đã soft-delete (`deleted_at IS NOT NULL`) bị ẩn khỏi thành viên thông thường qua policy SELECT `projects` (migration 20260923000013). `is_main_contractor_manager` trả FALSE với project đã xóa. Không xóa dữ liệu, không mở khôi phục.
2. `project_companies.status`:
   - ACTIVE: cho phép thao tác nghiệp vụ theo quyền.
   - SUSPENDED / ENDED: giữ quyền đọc lịch sử, chặn thao tác nghiệp vụ mới.
   - Audit (`write_audit`) KHÔNG bị chặn theo status, để ghi nhận sự kiện quản trị và kết thúc.
   - Điểm enforcement: `can_run_project_company_business_write(project_company_id)` (migration 20260923000015). Các luồng ghi nghiệp vụ mới phải gọi hàm này. Hiện chưa có luồng nghiệp vụ nào, nên đây là điều kiện bắt buộc cho tương lai.
3. Database là nguồn xác thực membership tenant. `current_tenant_id()` chỉ trả tenant khi `memberships` có dòng `user_id = auth.uid()` khớp tenant trong claim (migration 20260923000014). `current_app_role()` lấy role từ `memberships` của tenant hiện tại, bỏ qua role trong claim. JWT claim chỉ là selector. Người dùng nhiều tenant được chọn bằng claim, nhưng mỗi tenant phải có membership thật.

## Restore decision (owner, 2026-11-20)

- MVP không có vai trò nào được khôi phục project đã xóa mềm. Không xây API, UI hoặc quyền restore.
- Không xóa vật lý project, project_memberships, project_companies, audit_log khi soft-delete.
- Phục hồi sau sự cố là quy trình quản trị kỹ thuật riêng, ngoài chức năng ứng dụng. AI coding không được tự thêm restore.

## Tenant context (verified in code)

- Web `loadAuthenticatedMember` (apps/web/src/features/auth/membership.ts) và `resolveMembership` (packages/auth/src/membership/index.ts) chọn membership theo claim `tenant_id` và trả danh sách `tenants`; claim lệch membership bị từ chối.
- Hệ quả trước đây: user nhiều tenant không vào được web. Hiện đã có tenant switcher MVP (xem mục bên dưới).

## Tenant switcher MVP (owner)

- Người dùng một tenant: tự chọn tenant. Nhiều tenant: danh sách tenant có membership, hiển thị tenant hiện tại, cho phép chuyển.
- Chọn tenant qua RPC `select_active_tenant` (migration 20260923000016, SECURITY DEFINER). RPC kiểm membership trong DB, trả 42501 nếu không phải thành viên. Bảng `user_active_tenant` chỉ lưu lựa chọn giao diện.
- Hook JWT ưu tiên tenant đã chọn nếu membership còn tồn tại; nếu không, dùng membership đầu tiên. Thu hồi membership khiến `current_tenant_id()` trả NULL ngay, dù JWT cũ còn hạn.
- Phương án A (owner): chặn chuyển tenant khi Outbox còn pending (`apps/mobile/src/auth/tenant-switch.ts`). Không xóa dữ liệu chưa đồng bộ.
- Cache, query state và dữ liệu WatermelonDB phải tách theo tenant; web remount danh sách theo `tenantId` (`apps/web/src/app/App.tsx`). Việc cách ly này mới được kiểm ở mức unit, chưa kiểm e2e.
- Trạng thái: IMPLEMENTED + TESTED (DB, unit). Mobile guard `switchActiveTenant` test 6/6: chặn khi pending, chặn khi failed chờ retry, mở lại sau khi drain, membership thu hồi bị từ chối, lỗi mạng giữ tenant cũ, A↔B. Mobile đã có luồng nạp membership (`apps/mobile/src/auth/memberships.ts`) và `TenantSwitcher` đi qua guard (`apps/mobile/src/auth/TenantSwitcher.tsx`). Cursor sync tách theo tenant. Chưa có test store Watermelon thật, chưa test restart app với Outbox pending, chưa kiểm trên emulator/thiết bị (BLOCKED: adb không có). Web không có Outbox nên guard không áp dụng. `refreshSession()` claim mới: UNVERIFIED. ACCEPTED theo xác nhận của chủ dự án (2026-11-21); thiết bị Android vẫn BLOCKED/UNVERIFIED.

## Risks

- Client có claim tenant nhưng không có membership sẽ nhận NULL. Cần xác nhận luồng auth web/mobile (UNVERIFIED).
- Soft-delete từ web (`update({deleted_at})`) không được dùng `.select()`; nếu có RETURNING sau khi bị ẩn sẽ lỗi (UNVERIFIED trên toàn bộ client).
- `current_tenant_id()` được gọi theo từng row trong RLS; cần đo hiệu năng khi dữ liệu lớn.
- Chưa có thiết kế khôi phục project đã soft-delete.

## Migration 021 (DB-SEC-01/03, 2026-11-22)

- Lý do: PROJECT_MANAGER gán được SYS_ADMIN/SUB_CONTRACTOR qua `assert_can_touch_role`; công ty SUBCONTRACTOR tham gia dự án không đọc được dự án.
- Quyết định (owner): PROJECT_MANAGER chỉ gán WORKER và PROJECT_VIEWER; SITE_MANAGER giữ nguyên (legacy); SUB_CONTRACTOR là participation_type, không phải role. Công ty ACTIVE/SUSPENDED/ENDED đang tham gia được đọc dự án (không soft-deleted); không tham gia thì không đọc.
- Tác động: chỉ đổi `assert_can_touch_role` và policy SELECT của `projects`; thêm `is_participating_company(uuid)` (SECURITY DEFINER, `search_path=''`, execute cho authenticated). Policy ghi và dữ liệu module (workers, attendance) không mở rộng.
- Rollback: `supabase/rollbacks/20260923000021_project_manager_scope_and_participant_visibility.down.sql`.
- Kiểm thử: `supabase/tests/rls/subcontractor_project_visibility.test.sql` (11 test); `supabase test db` 16 file / 151 test PASS.
- Chưa xác nhận: quyền con (workers, attendance) cho công ty SUBCONTRACTOR tham gia; trạng thái ACCEPTED của ADR này vẫn thuộc phạm vi xác nhận trước đó, không áp dụng cho migration 021 cho đến khi owner nghiệm thu.
- Bổ sung 2026-11-23 (kiểm chứng local REST): PM MAIN thêm/thu hồi thành viên WORKER của tenant SUB OK; gán SUB_CONTRACTOR/SYS_ADMIN/PROJECT_MANAGER bị chặn; PM SUB bị chặn quản lý thành viên (thiết kế migration 020). Sau thu hồi, thành viên công ty SUB vẫn thấy dự án do chính sách công ty tham gia (đúng quyết định, không phải lỗi).

## Verification

- `supabase db reset`: exit 0.

- `supabase test db`: 81/81 PASS (68 cũ + 13 mới `soft_delete_tenant_context.test.sql`).
- Mutation check: gỡ rollback 013–015 làm 5 ca mới fail, khôi phục bằng `db reset` và PASS lại.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm architecture:check`: exit 0.
- Tenant switcher (migration 016): `supabase test db` 95/95 PASS (`files/db-test-tenant-switch.log`); mobile helper 3/3 PASS.
- Mobile vitest 24/24 PASS (6 file), gồm guard tenant 8 case và sync-runtime: mất mạng khi push giữ record chưa đồng bộ, retry sau đó commit. Typecheck mobile exit 0.
