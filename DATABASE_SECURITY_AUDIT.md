# DATABASE & SECURITY AUDIT (Phase B, nhóm 1)

Trạng thái: AUDIT ONLY. Không sửa code, migration, RLS hay RPC trong đợt này.
Phạm vi: migration 009, 012, 013, 017, 018, 019 (đọc), 020; seed `roles.sql`, `role_permissions.sql`.
Commit đối chiếu: `592c398` (VS-01), nhánh `chc/rn-086-align`.

## Findings

### DB-SEC-01 (P1): PROJECT_MANAGER gán được mọi role, không chỉ WORKER và PROJECT_VIEWER — FIXED_PENDING_ACCEPTANCE (migration 021, pgTAP `subcontractor_project_visibility.test.sql`, `supabase test db` PASS). Chưa ACCEPTED.
- Vị trí: `supabase/migrations/20260923000020_project_manager_members.sql:41-55` (`assert_can_touch_role`), áp dụng ở `add_project_member` (dòng 56+) và `update_project_member_role` (dòng 107+).
- Hành vi: hàm chỉ chặn `p_role in ('SITE_MANAGER', 'PROJECT_MANAGER')`. Mọi role khác trong bảng `roles` đều được gán.
- Bảng `roles` hiện có: `SYS_ADMIN`, `SITE_MANAGER`, `SUB_CONTRACTOR`, `WORKER`, `PROJECT_VIEWER` (`supabase/seed/roles.sql:4-8`), cộng `PROJECT_MANAGER` (migration 018).
- Quyết định đã duyệt (owner, mục 1 "CHỐT QUYỀN PROJECT_MANAGER"): PROJECT_MANAGER chỉ thêm, sửa, thu hồi WORKER và PROJECT_VIEWER.
- Hệ quả: PROJECT_MANAGER có thể cấp `SYS_ADMIN` hoặc `SUB_CONTRACTOR` cho người khác trong dự án. Việc leo thang thực tế còn phụ thuộc vào cách ứng dụng đọc `project_memberships.role`. **Chưa kiểm chứng** trong code đọc quyền. Mức độ: UNVERIFIED impact, nhưng vi phạm trực tiếp quyết định đã duyệt.
- Đề xuất (chưa áp dụng): đổi allowlist trong `assert_can_touch_role` thành chỉ `WORKER` và `PROJECT_VIEWER` cho nhánh PROJECT_MANAGER. Cần migration mới (không sửa 020), kèm pgTAP test cho `SYS_ADMIN`, `SUB_CONTRACTOR`, `SITE_MANAGER`, `PROJECT_MANAGER`. Cần owner phê duyệt trước khi triển khai.

### DB-SEC-02 (P2 → đã điều tra, không còn rủi ro trên DB hiện tại): literal `MAIN_BOD`
- Nguồn gốc: `20260923000002_init_tenancy.sql:92` và `20260923000004_rls_hardening.sql:196` (policy lịch sử, dùng `auth.jwt()->>'role'` / `current_app_role()`). Role được tạo ở seed/migration cũ.
- Vòng đời: `20260923000008_project_viewer_role.sql` chuyển toàn bộ membership `MAIN_BOD` sang `PROJECT_VIEWER` (quyền giữ nguyên: đọc và xuất báo cáo, không ghi), cập nhật policy workers, rồi xóa role `MAIN_BOD` (dòng 33). Pgtap `project_viewer.test.sql:17` xác nhận role đã bị xóa.
- Bằng chứng local (2026-11-23, `pg_proc`/`pg_policies`/`pg_constraint`): không còn hàm, policy hoặc constraint nào tham chiếu `MAIN_BOD`; `public.roles` có 0 dòng `MAIN_BOD`. Code web/mobile/packages không có literal `MAIN_BOD`.
- Kết luận: không có role chết nào có quyền trên DB hiện tại. Không sửa migration lịch sử; không thay đổi nghiệp vụ. Literal còn trong migration 002/004 là lịch sử, đã được thay thế.

### DB-SEC-03 (P1): SUBCONTRACTOR không thấy dự án mình tham gia — FIXED_PENDING_ACCEPTANCE (migration 021: policy `projects` SELECT thêm `is_participating_company`, chỉ mở ở mức project row; module data không mở rộng). Chưa kiểm tra ACL `has_function_privilege` trên DB thật. Chưa ACCEPTED.
- Vị trí: `20260923000013_soft_deleted_project_visibility.sql:7-10`. Policy `projects` chỉ cho xem trong tenant sở hữu và chưa bị xóa.
- Hệ quả: SUBCONTRACTOR không đọc được project qua RLS, dù có `project_companies` ACTIVE. Đây là quyết định nghiệp vụ, chưa có quyết định của owner. Không tự sửa.

### DB-SEC-04 (P2): `write_audit` cấp EXECUTE cho `authenticated` và không kiểm tra action — FIXED_PENDING_ACCEPTANCE
- Vị trí gốc: `20260923000012_is_project_member_soft_delete.sql:103-104`.
- Xử lý: migration `20260925000023_write_audit_action_allowlist.sql` (rollback `.down.sql`). Giữ nguyên kiểm tra actor, tenant, membership và project status. Thêm allowlist 8 action đang được RPC production phát ra (ADR-009). Action khác bị `22023 'audit action is not allowed'`.
- Quyền: `anon` và `PUBLIC` không có EXECUTE; `authenticated` có EXECUTE (đã kiểm tra trên DB local bằng `has_function_privilege`).
- Bằng chứng: pgTAP `add_project_member_and_write_audit_hardening.test.sql` và `write_audit_membership.test.sql`; `supabase test db` 19 file / 188 PASS.

### DB-SEC-05 (P2): `attendance` UPDATE cho mọi thành viên tenant — FIXED_PENDING_ACCEPTANCE (phần UPDATE)
- Lỗ hổng: policy `attendance update within own tenant` (`20260923000019_init_attendance.sql:57`) chỉ kiểm tra `tenant_id`, nên WORKER và PROJECT_VIEWER có thể sửa chấm công.
- Xử lý: migration `20260925000024_attendance_update_role_gate.sql` (rollback `.down.sql`) thay bằng policy chỉ cho SYS_ADMIN, SITE_MANAGER, SUB_CONTRACTOR, khớp quyền INSERT. Không sửa migration 019 hay `attendance.test.sql`.
- Bằng chứng: `supabase/tests/rls/attendance_update_role_gate.test.sql` (WORKER 0 dòng, PROJECT_VIEWER 0 dòng, SITE_MANAGER 1 dòng). `supabase test db` 20 file / 191 test PASS.
- `workers`: policy INSERT/UPDATE/DELETE đã giới hạn role từ migration 004 (kiểm tra live `pg_policies`). Bổ sung `supabase/tests/rls/workers_update_role_gate.test.sql` (WORKER 0 dòng, SITE_MANAGER 1 dòng). Client ghi trực tiếp vẫn dựa vào RLS; chưa tạo RPC vì không có lỗ hổng quyền.
- Attendance giữ DEFERRED.

### DB-SEC-06 (P3): trùng định nghĩa `add_project_member` — FIXED_PENDING_ACCEPTANCE
- `add_project_member` được định nghĩa ở 017, 018 và 020. Bản 020 có hiệu lực. Không sửa lịch sử.
- Xử lý: migration `20260925000022_consolidate_add_project_member.sql` (rollback `.down.sql`) khai báo lại thân hàm 020 một lần với REVOKE/GRANT rõ ràng. Không đổi hành vi.
- Bằng chứng local: một overload; SECURITY DEFINER; `search_path=""`; `authenticated` có EXECUTE; `anon`/`PUBLIC` không có EXECUTE. pgTAP trong `add_project_member_and_write_audit_hardening.test.sql`.

## Đã xác minh

- `is_project_member` loại trừ dự án đã soft-delete (migration 012).
- Các hàm `SECURITY DEFINER` đều có `set search_path = ''`. Quan sát từ 009, 012, 013, 017, 018, 020.
- RPC quyền dự án có kiểm tra `auth.uid()` và `assert_member_manager` (020:24-38).
- `REVOKE`/`GRANT` có mặt cho các RPC đã liệt kê; `project_member_manager_level` và `assert_can_touch_role` chỉ cấp cho nội bộ.

## Chưa xác minh

- Ứng dụng đọc role từ `project_memberships` hay từ JWT, và SYS_ADMIN cấp ở project có tạo quyền thực tế không.
- Chưa chạy `supabase test db` trong đợt này để đối chiếu với các test hiện có.
- Chưa kiểm tra ACL thực tế trên DB local (`has_function_privilege`), chỉ đối chiếu bằng migration.

## Tiếp theo

1. Owner quyết định DB-SEC-01 và DB-SEC-03.
2. Đọc RPC/RLS nhóm multi-tenant và offline (Phase B nhóm 2 và 3).
3. Chạy kiểm tra ACL thực tế và `supabase test db` khi owner xác nhận, vì Docker có thể cần khởi động.
