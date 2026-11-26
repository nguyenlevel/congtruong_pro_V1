# ADR-001: Monorepo with Turborepo + pnpm

## Status

Accepted

## Context

Web, Mobile and multiple shared libraries must evolve together while keeping
deployable units isolated. AI agents need stable workspace boundaries.

## Decision

One monorepo (`partner-os-workspace`) using **Turborepo** for task orchestration
and caching, **pnpm** workspaces for dependency management. All code is
TypeScript.

## Alternatives

- Separate repositories per app/package (rejected: slow cross-repo typing, no shared contracts).
- npm/yarn workspaces (rejected: weaker install/lockfile guarantees for many packages).

## Consequences

- Single `pnpm install`; shared lockfile; per-package build/test/lint tasks.
- Boundaries enforced by the Architecture Guard (rules + CI) instead of repo walls.
- Requires team discipline not to drift — guards and ADRs keep this in check.

## Security Impact

Monorepo itself: centralizes secret management in `.env` files per app (gitignored).
Tenant/RBAC impact is described in the addendum below; the monorepo decision does not change it.

## Migration Impact

Initial scaffold only; no legacy data. Membership migrations (007a–007b) are described in the addendum.

---

## Addendum: Tenant membership model (RBAC theo Company / Project)

> Trạng thái: phần **Đã duyệt** được chủ dự án phê duyệt. Phần **Chưa duyệt** là đề xuất, chưa được
> phê duyệt và không được triển khai. Bước 007c trở đi **chưa được duyệt**.

### Đã duyệt (không được tự thay đổi)

| # | Quyết định |
| --- | --- |
| D1 | `PROJECT_MANAGER` chỉ dành cho Main Contractor. Nhân sự nhà thầu phụ không mặc định có role này. |
| D2 | Không tạo `CONTRACTOR_ADMIN`. Dùng `COMPANY_ADMIN` kết hợp scope: `COMPANY`, `PROJECT_COMPANY`, `PROJECT`. |
| D3 | `COMPANY_ADMIN` của nhà thầu phụ chỉ quản lý dữ liệu thuộc `PROJECT_COMPANY` được phân quyền. |
| D4 | `MAIN_BOD` → `PROJECT_VIEWER` (scope `PROJECT`): chỉ xem và xuất báo cáo, không ghi, không quản lý nhân sự, không mở rộng sang project khác. Không nâng quyền khi backfill. |
| D5 | `memberships.role` là **deprecated**. Không dùng cho authorization mới. Chỉ xóa trong migration riêng sau khi backfill, backend, RLS và test đều đạt. |
| D6 | Triển khai migration 007 theo từng bước 007a–007e, chạy pgTAP sau mỗi bước, báo cáo rồi mới sang bước sau. |
| D7 | Không xóa dữ liệu `memberships` cũ. Không tạo membership trùng. Không nâng quyền khi chuyển đổi. |
| D8 | Gitignore `apps/mobile/android/` và `apps/mobile/ios/` (Expo Prebuild). Cấu hình native cần thiết phải nằm trong Expo Config Plugin. |

### Đã duyệt bổ sung (Decision Review, phê duyệt qua chủ dự án)

| # | Quyết định |
| --- | --- |
| D-AUTH | Database là nguồn quyết định quyền. JWT không được là nguồn duy nhất. Claim chỉ dùng để hiển thị. |
| D-SM | Ánh xạ SITE_MANAGER theo `participation_type` của công ty trong project. Không tự nâng quyền SUBCONTRACTOR. Không tạo CONTRACTOR_ADMIN. |
| D-SM-M1 | SITE_MANAGER của MAIN_CONTRACTOR **không** tự động thành PROJECT_MANAGER. Phải rà soát từng tài khoản theo trách nhiệm thực tế và xác nhận thủ công. SITE_MANAGER của SUBCONTRACTOR ánh xạ theo định hướng SITE_SUPERVISOR, không có quyền quản lý nhân sự tự động. Nhà thầu phụ cần quản lý nhân sự dùng COMPANY_ADMIN scope `PROJECT_COMPANY`. |
| D-SYS | Quản trị hệ thống (MVP) qua Supabase Dashboard bởi người được ủy quyền. Không xây Platform Admin UI/endpoint. Không cấp cross-tenant mặc định qua SYS_ADMIN trong JWT. Thiết kế phải cho phép bổ sung quản trị hệ thống sau này. |
| D-SOFT | Giữ membership của project đã xóa mềm để bảo toàn lịch sử. Không cho truy cập dữ liệu nghiệp vụ khi `deleted_at` không null. |
| D-SOFT-M5 | MVP có khôi phục project trên Web. Người được phép: COMPANY_ADMIN của tenant sở hữu project, hoặc người được ủy quyền hợp lệ. Khôi phục không tự khôi phục membership đã thu hồi. Phải ghi lịch sử xóa và khôi phục. Không có push notification trong MVP. |
| D-REV | Thu hồi quyền tenant và project có hiệu lực ở lần kiểm tra tiếp theo, không phụ thuộc thời hạn JWT. Quyền được kiểm tra từ DB. Refresh token revocation là biện pháp bổ sung, chưa làm trong MVP. |
| D-AUD | Audit log được thiết kế ngay trong giai đoạn kiến trúc, migration riêng. Phải triển khai trước mọi chức năng quản trị đặc quyền hoặc thao tác cần audit. Không bắt buộc chặn 007c nếu 007c chỉ làm role mapping. |
| D-MIG | Không sửa migration 007b đã triển khai. Sửa soft-delete helper/policy bằng migration bổ sung, thiết kế và duyệt riêng trước khi chạy. |
| D-JWT | Giữ nguyên TTL JWT. Repo không khai báo `jwt_expiry` trong `supabase/config.toml`. Giá trị hiệu lực trên Supabase Dashboard **chưa xác minh**. |
| D-DATA | Ưu tiên staging có bản sao dữ liệu thật đã ẩn danh. Audit read-only trên production chỉ chạy khi có phê duyệt riêng. Không tự kết nối, sửa hoặc chạy migration trên production. |

### Mô hình thực thể

```
TENANT (1) ──< MEMBERSHIPS (user ↔ tenant, deprecated role)
  │
  └──< PROJECTS (tenant sở hữu project; có MAIN_CONTRACTOR)
           │
           └──< PROJECT_COMPANIES (project ↔ tenant; participation_type)
                    │
                    └──< PROJECT_MEMBERSHIPS (user, project, project_company, role, scope)

USER ──< MEMBERSHIPS          (một user nhiều tenant)
USER ──< PROJECT_MEMBERSHIPS  (một user nhiều project, nhiều role)
```

- **Tenant** = công ty đăng ký trên hệ thống (ranh giới bảo mật cao nhất).
- **Project** thuộc một tenant sở hữu; tenant sở hữu luôn là `MAIN_CONTRACTOR` của project.
- **PROJECT_COMPANIES** cho phép một project có nhiều công ty (MAIN_CONTRACTOR, SUBCONTRACTOR, ...). Một công ty có thể tham gia nhiều project.
- **PROJECT_MEMBERSHIPS** gắn user với `(project, project_company)` và role cụ thể. Một user có thể có role khác nhau ở các công trình khác nhau.

### Phạm vi role

| Scope | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `COMPANY` | Quản trị toàn bộ công ty | COMPANY_ADMIN của tenant |
| `PROJECT_COMPANY` | Quản trị công ty trong một công trình | COMPANY_ADMIN của nhà thầu phụ tại project X |
| `PROJECT` | Quản lý toàn bộ công trình | PROJECT_MANAGER, PROJECT_VIEWER của Main Contractor |

Ma trận role và scope đầy đủ phải nằm trong `packages/auth` và seed, không hard-code trong UI.

### Trạng thái triển khai (tính đến 2026-11-18)

- 007a: đã bỏ `unique(user_id)` trên `memberships`. pgTAP đạt.
- 008 (`20260923000008_project_viewer_role.sql`, MAIN_BOD → PROJECT_VIEWER): đã triển khai với 7 test RLS. **Lưu ý:** đây là migration 008, không phải 007c. Nội dung 007c vẫn chưa được duyệt.
- 007b: đã triển khai `project_companies`, `project_memberships`, backfill, helper và RLS. Chi tiết tại `docs/3_TRACKER.md` mục 0.2.

### Chưa duyệt (đề xuất, không triển khai)

- **U1.** Ánh xạ `SITE_MANAGER` → `PROJECT_MANAGER` / `SITE_SUPERVISOR`: quy tắc đã duyệt (D-SM, D-SM-M1). Từng tài khoản **chưa được rà soát**. Không được tự ánh xạ.
- **U2.** Ánh xạ `SYS_ADMIN` → `COMPANY_ADMIN` (scope `COMPANY`): **không còn hiệu lực** theo D-SYS. Không tạo đường cross-tenant mặc định qua SYS_ADMIN.
- **U3.** Thu hẹp quyền WORKER tại 007d: không xem toàn bộ membership của công ty. Đã ghi nhận yêu cầu, chưa thiết kế chi tiết.
- **U4.** Backend tenant membership: xem mục bên dưới.
- **U5.** Custom access token hook: chuyển từ một membership sang tra cứu nhiều membership. Chưa triển khai.

### Đề xuất: Backend authorization cho tenant membership (chưa duyệt)

**Nguyên tắc:** quyền trên project chỉ đến từ một dòng `project_memberships` hợp lệ, trỏ tới `project_companies` hợp lệ. Tenant membership một mình không cấp quyền trên project nào.

**Các trường hợp biên**

| Trường hợp | Hành vi đề xuất |
| --- | --- |
| User thuộc tenant nhưng tenant chưa có project | Không truy cập dữ liệu project. Chỉ thấy thông tin tenant của chính mình. |
| User có membership ở nhiều tenant | Mỗi request chọn một tenant (claim hoặc header). RLS kiểm tra tenant đó. Không gộp quyền giữa tenant. |
| User tham gia nhiều project | Mỗi `project_memberships` độc lập. Quyền được tính theo từng project. |
| Một project có nhiều công ty | Mỗi công ty có `project_companies` riêng. Dữ liệu công ty A không lộ cho công ty B. |
| Tenant tham gia project nhưng không có `project_companies` hợp lệ (đã xóa mềm hoặc chưa được thêm) | Không có quyền. Helper trả rỗng. |
| User chuyển công ty | Xóa `project_memberships` của công ty cũ. Không tự cấp lại. Không để quyền cũ tồn tại sau khi chuyển. |
| Thu hồi quyền | Xóa hoặc đặt trạng thái revoked trên `project_memberships`. Token cũ vẫn hợp lệ đến khi hết hạn, nên helper phải kiểm tra bảng ở mỗi truy vấn, không chỉ dựa vào claim. |

**Truy vấn và phân quyền**

- Helper `security definer`, `search_path=''` (cùng mẫu migration 004) để tránh đệ quy RLS.
- Helper đề xuất: `my_tenant_ids()`, `is_project_member(project_id)`, `is_main_contractor_manager(project_id)`. Đã có trong 007b. Helper mới cần thêm: `has_project_company_role(project_company_id, role)`.
- API backend phải truy vấn `project_memberships` trực tiếp, không đọc role từ JWT cho quyết định project.

### Rủi ro và điểm cần duyệt

| Rủi ro | Mức | Ghi chú |
| --- | --- | --- |
| Custom hook chỉ lấy một membership (`order by created_at limit 1`) | Cao | Cần chuyển sang nhiều membership (U5). |
| Backfill chưa kiểm chứng trên dữ liệu thật | Cao | DB local rỗng. Xem tracker. |
| Soft-deleted project vẫn được backfill | Trung bình | Cần quyết định (xem bên dưới). |
| Worker chưa được thu hẹp | Trung bình | Thuộc 007d. |
| `memberships.role` vẫn tồn tại | Thấp | Deprecated, chưa dùng cho authorization mới. |

**Cần chủ dự án quyết định**
1. Soft-deleted project: không backfill, hay backfill nhưng gắn trạng thái để RLS chặn?
2. Ánh xạ U1 và U2.
3. Cách kiểm chứng backfill trên dữ liệu thật (xem tracker).

---

## Đề xuất chờ duyệt: Permission matrix (M2)

> Chưa duyệt. Không viết RLS cho các quyền này trước khi chủ dự án phê duyệt bảng dưới.
> Ký hiệu: **R** đọc, **W** tạo/sửa, **A** duyệt, **M** quản lý nhân sự/phân quyền, **–** không có quyền,
> **Q** cần quyết định. Mọi quyền đều bị giới hạn bởi scope và bởi `deleted_at is null` của project.

| Module | COMPANY_ADMIN (COMPANY) | COMPANY_ADMIN (PROJECT_COMPANY) | PROJECT_MANAGER (PROJECT, Main) | SITE_SUPERVISOR (PROJECT_COMPANY) | PROJECT_VIEWER (PROJECT) |
| --- | --- | --- | --- | --- | --- |
| Nhân sự (workers) | R, W, M trong công ty | R, W, M trong PROJECT_COMPANY | R, W trong project. Thông tin liên hệ nhân sự thầu phụ: R giới hạn (Q-PM-1). Không M | R trong PROJECT_COMPANY; không M | R |
| Chấm công | R, W, A trong công ty | R, W, A trong PROJECT_COMPANY | R, W, A trong project | R, W cho đội của mình; không A | R |
| Công việc | R, W trong công ty | R, W trong PROJECT_COMPANY | R, W, A (giao việc) trong project | R, W trong PROJECT_COMPANY | R |
| Nhật ký công trường | R, W trong công ty | R, W trong PROJECT_COMPANY | R, W, A trong project | R, W trong PROJECT_COMPANY | R |
| Vật tư | R, W trong công ty | R, W trong PROJECT_COMPANY | R, W, A trong project | R trong PROJECT_COMPANY | R |
| Báo cáo / xuất | R, xuất trong công ty | R, xuất trong PROJECT_COMPANY | R, xuất báo cáo tổng hợp toàn project, gồm dữ liệu cần thiết của thầu phụ, có audit (Q-PM-3) | R trong PROJECT_COMPANY, không xuất | R, xuất trong project, có audit |
| Membership và role | M trong phạm vi được cấp | M trong PROJECT_COMPANY | M trong project được phân quyền, trừ membership/role SITE_MANAGER và PROJECT_MANAGER (Q-PM-2 đã sửa, migration 020) | – | – |
| Xóa mềm project | Theo quyền đã duyệt; không có khôi phục (restore) trong MVP | – | – | – | – |

**Quy tắc chung đề xuất**
- Không có role nào truy cập chéo tenant. Không có role nào truy cập chéo PROJECT_COMPANY, trừ PROJECT scope của Main Contractor.
- PROJECT_VIEWER không có quyền ghi, quản lý nhân sự hoặc phân quyền (D4).
- SITE_SUPERVISOR không có quyền quản lý nhân sự tự động (M1).
- WORKER nằm ngoài ma trận này. Thu hẹp quyền WORKER thuộc 007d.

**Quyết định Q-PM (đã duyệt có điều kiện, ngày 2026-11-18)**
- Q-PM-1 (đồng ý có giới hạn): PROJECT_MANAGER của Main Contractor xem thông tin liên hệ cần thiết của nhân sự thuộc các công ty tham gia project, phục vụ điều phối. Không truy cập nhân sự của project khác. Không xem thông tin cá nhân không cần thiết.
- Q-PM-2 (đã sửa theo quyết định của chủ dự án, addendum 2026-09-23): PROJECT_MANAGER thuộc MAIN_CONTRACTOR được xem, thêm, cập nhật và thu hồi thành viên dự án trong phạm vi project được phân quyền, và quản lý Project Companies theo permission matrix. Giới hạn bắt buộc: không cấp quyền cao hơn quyền của chính mình; không thay đổi quyền quản trị cấp COMPANY; không quản lý thành viên của tenant hoặc project khác; không tự cấp PROJECT_MANAGER; không thao tác với membership SITE_MANAGER hoặc PROJECT_MANAGER; mọi kiểm tra nằm ở DB/RPC/RLS.
- Q-PM-3 (đồng ý có giới hạn): PROJECT_MANAGER xuất báo cáo tổng hợp toàn project, gồm dữ liệu cần thiết của thầu phụ. Chỉ xuất dữ liệu của project đang quản lý. Thông tin cá nhân giới hạn theo mục đích. Mọi lần xuất phải ghi audit log (phụ thuộc D-AUD / M-E).

**Hệ quả cho triển khai:** "Thông tin liên hệ cần thiết" và "dữ liệu cần thiết" phải được định nghĩa thành danh sách cột cụ thể trước khi viết RLS/view (chưa đủ thông tin, xem hồ sơ migration). Mục này vẫn là đề xuất chờ duyệt cho đến khi chủ dự án duyệt danh sách cột.

## Đề xuất chờ duyệt: Thiết kế migration bổ sung M-A đến M-F

> Mỗi migration có hồ sơ riêng, rollback riêng, pgTAP riêng và được duyệt trước khi tạo. Không đánh số 007c trong các đề xuất này.
> Hồ sơ chi tiết (schema, RLS, backfill, rollback, pgTAP, rủi ro, điều kiện nghiệm thu) nằm tại [ADR-001-migration-dossiers.md](./ADR-001-migration-dossiers.md).

| Mã | Mục tiêu | Phụ thuộc | Nội dung chính | Rollback | pgTAP tối thiểu |
| --- | --- | --- | --- | --- | --- |
| **M-A** | Lớp ánh xạ role một chỗ | Permission matrix được duyệt | Bảng `role_migration_reviews` (membership hoặc project_membership id, role cũ, role đề xuất, role quyết định, người duyệt, thời điểm duyệt). Chỉ tạo đề xuất cho SITE_MANAGER. Chuyển đổi chỉ khi có `decided_role` do người duyệt nhập. Không có hàm nào tự quyết. | Drop bảng review sau khi archive. Không đổi dữ liệu membership. | Không tự chuyển khi chưa có quyết định; quyết định không được nâng quyền; mỗi bản ghi chỉ có một quyết định. |
| **M-B** | Soft-delete | D-SOFT, D-MIG | `create or replace` helper 007b thêm `deleted_at is null`. Viết lại policy của `projects` và mọi bảng con có `project_id`. Danh sách bảng phải lấy bằng truy vấn `information_schema` trước khi viết. | Khôi phục định nghĩa cũ từ file rollback. | Project đã xóa mềm không đọc/ghi được bằng role nghiệp vụ; membership của nó vẫn còn. |
| **M-C** | Bỏ đường cross-tenant qua SYS_ADMIN | D-SYS | Viết lại policy 001–004 dùng literal `'SYS_ADMIN'`. Không thay bằng quyền toàn cục khác. Quản trị hệ thống chỉ qua Dashboard. | Khôi phục policy cũ từ file rollback. | Không có SYS_ADMIN trong JWT đọc được tenant khác; test `membership.test.sql`, `workers.test.sql` cập nhật theo mô hình mới. |
| **M-D** | Lịch sử xóa mềm (đã bỏ restore khỏi MVP) | M-B | Chỉ ghi lịch sử xóa mềm project. Không triển khai hàm restore (quyết định của chủ dự án). | Archive `project_history`, drop hàm. | Thao tác xóa mềm có history; không có đường khôi phục project trong MVP. |
| **M-E** | Audit log append-only | D-AUD | Bảng `audit_log` (id, occurred_at, actor_user_id, action, target_type, target_id, tenant_id, project_id, project_company_id, payload jsonb, request_id). Không có policy update/delete; revoke grant update/delete; trigger chặn update/delete. Ghi qua hàm security definer. Đọc: COMPANY_ADMIN của tenant. | Không có rollback xóa dữ liệu audit. Rollback chỉ gỡ hàm ghi khi chưa có dữ liệu. | Không update/delete được; người ngoài tenant không đọc được; hàm ghi từ chối actor không hợp lệ. |
| **M-F** | Chuyển policy tenant từ claim sang DB | D-AUTH, M-A, M-B, M-C | Helper `my_tenant_ids()` và `has_project_role(...)` đọc `memberships` và `project_memberships`. Viết lại policy đang dùng `current_tenant_id()`/`current_app_role()`. Hook giữ nguyên trong giai đoạn này (không đổi theo yêu cầu). | Khôi phục policy cũ từ file rollback. | Thu hồi membership có hiệu lực ngay ở truy vấn kế tiếp, dù JWT cũ còn hạn; không cross-tenant; không cross-company. |

**Thứ tự đề xuất:** M-A → M-B → M-C → M-D → M-E → M-F. M-E có thể đi sau M-D nhưng phải trước mọi chức năng quản trị đặc quyền (D-AUD). 007c chỉ được thiết kế sau khi M-A được duyệt, và không được gộp với M-F.

**Điều kiện chung trước khi chạy bất kỳ migration nào**
1. Backup và snapshot đã có.
2. Audit read-only trên staging (dữ liệu ẩn danh) đã chạy và có báo cáo.
3. pgTAP đạt trên `db reset` và trong CI (`db-test.yml`).
4. Chủ dự án duyệt hồ sơ migration.

**Chưa xác minh**
- TTL JWT thực tế trên Dashboard.
- Có staging với dữ liệu ẩn danh hay chưa.
- Số lượng membership và tài khoản SITE_MANAGER, SYS_ADMIN thật.
- Danh sách bảng con có `project_id`.
## Addendum: PROJECT_MANAGER và SITE_MANAGER (migration 018)

Ngày: 2026-09-23. Trạng thái: TESTED (DB, local). Chưa ACCEPTED (chờ owner nghiệm thu).

- **PROJECT_MANAGER** được thêm bằng migration `20260923000018_project_manager_role.sql`. Quyền: `project.read`, `project.write`, `contractor.read`, `contractor.write`, `report.export`. Không có `safety.approve` và `incident.approve`.
- **SITE_MANAGER** là legacy role, giữ nguyên. Không đổi tên, không xóa, không tự chuyển membership sang PROJECT_MANAGER (D-SM-M1).
- `is_main_contractor_manager` chấp nhận SITE_MANAGER và PROJECT_MANAGER. Hành vi cũ của SITE_MANAGER được giữ và có regression test.
- Quản lý thành viên dự án: PROJECT_MANAGER của MAIN_CONTRACTOR được quản lý thành viên trong project được phân quyền (migration 020, quyết định Q-PM-2 đã sửa). Không được tạo hoặc thay đổi membership SITE_MANAGER/PROJECT_MANAGER; SITE_MANAGER giữ nguyên hành vi cũ.\
- **Migration 020** `20260923000020_project_manager_members.sql` (TESTED DB, PENDING_ACCEPTANCE): thêm `update_project_member_role`, cho PROJECT_MANAGER của MAIN_CONTRACTOR thêm/sửa/thu hồi membership trong project được phân quyền. Không cấp hoặc thay đổi SITE_MANAGER/PROJECT_MANAGER, không chạm role COMPANY. Rollback: `supabase/rollbacks/20260923000020_project_manager_members.down.sql`.
- **Attendance** (migration 019): DEFERRED/PENDING_APPROVAL, chưa triển khai và chưa nghiệm thu.
- COMPANY_ADMIN và SITE_SUPERVISOR chưa có trong DB và **không** được thêm trong 018. Chưa chứng minh được nhu cầu và tính tương thích.
- Restore project không thuộc MVP (quyết định của owner). Các mô tả restore trong M-D/D-SOFT-M5 cần được coi là đã bỏ.
- Kiểm chứng: `supabase db reset` thành công. `supabase test db` có `project_manager_role.test.sql` (11 case) pass. Rollback đã chạy thành công khi chưa có membership PROJECT_MANAGER, sau đó migration được áp dụng lại.
