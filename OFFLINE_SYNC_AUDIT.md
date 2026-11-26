# OFFLINE SYNC & MULTI-TENANT AUDIT (Phase B, nhóm 2 và 3)

Trạng thái: AUDIT ONLY. Không sửa code, migration, RLS hay RPC.
Commit đối chiếu: `592c398`, nhánh `chc/rn-086-align`.
Kiểm chứng DB: BLOCKED (xem mục "Kiểm thử").

## Multi-tenant

### MT-01 (PASS theo đọc code): chuyển tenant là lựa chọn UI, DB vẫn là nguồn quyền
- `supabase/migrations/20260923000016_active_tenant_selection.sql`: `user_active_tenant` có FK `(user_id, tenant_id)` tới `memberships`. `select_active_tenant` kiểm tra membership (dòng ~45) và raise `42501` nếu không thuộc tenant.
- Hook `custom_access_token_hook` chỉ chọn tenant khi membership còn sống (dòng ~74-78). Membership bị thu hồi sẽ rơi về tenant đầu tiên còn lại.
- Mobile không dùng tenant_id local làm bằng chứng quyền: `App.tsx:65-66` đối chiếu với `getActiveTenantId` và `listMyTenants` từ DB, nếu không còn trong danh sách thì `activeTenantId = null` và chặn truy cập.

### MT-02 (PASS theo đọc code): cursor đồng bộ tách theo tenant
- `App.tsx:88` và `:101`: `createSecureCursorStore(SecureStore, activeTenantId, 'worker' | 'attendance')`. Cursor không bị lẫn giữa các tenant.

### MT-03 (PASS theo đọc code): đổi tenant bị chặn khi còn dữ liệu chưa đồng bộ
- `apps/mobile/src/auth/tenant-switch.ts`: `switchActiveTenant` gọi `outbox.countUnsynced()` và ném `UnsyncedBlockError` nếu `total > 0`. Đây là Policy A đã được owner duyệt.

### MT-04 (ghi nhận, rủi ro thấp): `user_active_tenant` cho phép `SELECT` từ `supabase_auth_admin`
- Đúng thiết kế để hook đọc. Quyền ghi chỉ qua RPC `select_active_tenant`. Đã có test: `supabase/tests/rls/tenant_switcher.test.sql:54-55` kiểm tra insert trực tiếp bị chặn. Chưa chạy lại được do DB BLOCKED.

## Offline/Sync

### SY-01 (ghi nhận, liên quan Attendance DEFERRED): mobile có sẵn attendance sync runtime
- `apps/mobile/src/sync/sync-runtime.ts` có `createAttendanceSyncRuntime`, và `App.tsx:96-104` đã nối vào UI.
- Owner đã chốt Attendance là DEFERRED/PENDING_APPROVAL. Phần này đi ngược quyết định đó, nhưng vẫn cần owner xác nhận có giữ hay không. Không tự gỡ.

### SY-02 (PASS theo đọc code): record có thay đổi local chưa push không bị ghi đè bởi pull
- `applyRemoteBatch` và `applyAttendanceRemoteBatch` bỏ qua các `recordId` còn trong outbox pending. Local thắng đến khi server xác nhận.

### SY-03 (PASS theo đọc code): pull và push chạy một lượt tại một thời điểm
- `createWorkerSyncRuntime` và `createAttendanceSyncRuntime` dùng `inFlight` để gộp các lần gọi `syncNow` đồng thời.
- Pull có giới hạn `MAX_PULL_PAGES = 100`, tránh vòng lặp vô hạn.

### SY-04 (ĐÃ XÁC MINH theo code, rủi ro thấp): replay pull là an toàn
- `apps/mobile/src/database/watermelon.ts:90-112` (worker) và `:195-217` (attendance): `applyRemote` là upsert theo `id`, ghi đè bằng trạng thái server và `version`. Replay cùng batch cho kết quả giống nhau.
- Hạn chế còn lại: không có guard "version mới hơn mới ghi". Chỉ rủi ro nếu một trang cũ được áp sau trang mới. Cursor ghi sau mỗi trang nên trường hợp này rất hẹp. Ghi nhận, chưa sửa.

### SY-05 (rủi ro vừa): transport tin cậy RLS, không lọc tenant
- `apps/mobile/src/sync/supabase-sync-transport.ts:58-59` ghi rõ tenant isolation dựa vào RLS của `workers`. Đúng với nguyên tắc DB là nguồn quyền. Tuy vậy, nếu RLS sai thì app không có lớp phòng vệ thứ hai.

### SY-06 (ghi nhận, liên quan DB-SEC-05): đường ghi trực tiếp không đi qua RPC
- Các bảng `workers` và `attendance` nhận write trực tiếp từ sync transport. Đây là cùng vấn đề đã ghi trong `DATABASE_SECURITY_AUDIT.md`.

## Gap và mục đã biết

| Mục | Trạng thái |
| --- | --- |
| Outbox theo tenant, hay toàn cục | Toàn cục (Policy A). Phù hợp quyết định owner. |
| Logout và xóa dữ liệu local | Chưa có chính sách đã duyệt. Không xóa dữ liệu chưa sync. |
| Mobile project list chỉ đọc theo tenant | Chưa xác minh trong đợt này. |
| Device/emulator Android | BLOCKED. |

## Kiểm thử

- `supabase test db`: **PASS** (đã xác minh sau commit `592c398`). Docker Desktop đã được khởi động, `supabase start` thành công, kết quả: 15 file, 140 test, `Result: PASS`. Log: `%TEMP%\partneros-gates\supabase-test-db.log`.

## Tiếp theo

1. Bật Docker Desktop, chạy `supabase start` và `supabase test db`, rồi ghi kết quả vào báo cáo này.
2. Kiểm tra idempotency của `applyRemote` (SY-04) và test `user_active_tenant` không ghi trực tiếp được (MT-04).
3. Owner quyết định SY-01 (Attendance sync runtime).
