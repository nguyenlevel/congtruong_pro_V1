# S.V. Jadhav Contractors (constrution-app) — Ghi chú tham chiếu

> Repo: `https://github.com/dvb99/Constrution-app` (clone local: `reference/constrution-app`)
> Stack gốc: Android Java thuần + SQLite/Firebase, 2 vai (Admin / Engineer).
> **Không copy code** — chỉ rút yêu cầu nghiệp vụ / flow.

## 1. Đóng góp cho module nào

| Module tracker | Mức đóng góp | Nội dung tham chiếu được |
|---|---|---|
| 7 — Giao việc & Nhật ký thi công | **CAO** | `sitereport`, `workInfo`, `Labor`, `ToDoList`, `namewithprogress` |
| 9 — QA/QC & Punchlist | TRUNG BÌNH | `siteinspection` (hình ảnh mô tả trang), `Table`, `Uptodate_Table` |
| 10 — Tài sản & Vật tư | **CAO** | `Equipment`, `equipmentInfo`, kho Godown Inventory |
| 12 — Giao tiếp & Thông báo | CAO | `Requirement`, `communication`, yêu cầu engineer → admin |
| 13 — Dashboard & Analytics | TRUNG BÌNH | Site Total, progress theo site |

## 2. Yêu cầu nghiệp vụ rút ra

### Quản lý công trường (site)
- Loại công trường: Pipeline, Road Pavement, Watertank (ESR/GSR), Building Construction.
- Admin tạo site + **gán kỹ sư phụ trách**; mỗi kỹ sư thấy các site được giao.
- Progress theo site: admin xem tiến độ công việc tổng hợp qua báo cáo hằng ngày (`namewithprogress`, `area_and_progress`).

### Nhật ký công trường hàng ngày (engineer cập nhật)
1. **Manpower hôm nay** (`Labor.java`) — số nhân công dùng trong ngày.
2. **Equipment Reading** (`equipmentInfo.java`) — chỉ số vận hành thiết bị.
3. **Any requirement** (`Requirement.java`) — nhu cầu cần admin đáp ứng.
4. `sitereport.java` — báo cáo site; `workInfo.java` — thông tin khối lượng công việc.

### Tài sản & vật tư
- `Equipment.java`: JCB, Tractor, concrete mixer … + vị trí thiết bị (equipment location).
- **Godown Inventory management**: kho tổng, theo dõi vật tư theo từng site (`aspect: Material used at specific site since inception`).

### Giao tiếp
- `communication.xml`: admin truyền đạt việc khẩn cấp; engineer gửi requirement; admin phản hồi nhanh.

## 3. Ghi nhận UX/flow đáng học

1. **Phân vai theo module**: Admin làm việc ở tầng tổng (tạo site, quản thành viên, xem báo cáo), engineer làm việc ở tầng chi tiết (cập nhật hằng ngày). Khớp hướng RBAC đang xây ở Partner OS.
2. **Báo cáo hằng ngày là nguồn dữ liệu progress**: mỗi ngày 1 bản ghi thao tác của engineer → nền cho Module 7 (nhật ký công trường) + Module 13.
3. **Requirement ↔ phản hồi admin** = vòng khép kín giao tiếp site — gợi ý cấu trúc Module 12.
4. Dashboard site: tổng hợp "Site Total" và progress theo area.

## 4. Giới hạn (không áp dụng trực tiếp)

- Java thuần + layout XML, không offline-first, không RLS, không test tự động.
- Không có duyệt/audit, không có lương/thanh toán.
- Dữ liệu nghiệp vụ chỉ ở mức ghi chú hàng ngày (chưa có khối lượng/quyết toán).

## 5. Nguồn

- README gốc: `reference/constrution-app/README.md`
- Activities: `reference/constrution-app/app/src/main/java/com/example/admin/constructionsite/**`
- Layouts: `reference/constrution-app/app/src/main/res/layout/activity_*.xml`