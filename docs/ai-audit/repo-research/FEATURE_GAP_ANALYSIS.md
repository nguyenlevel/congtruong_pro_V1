# Phân tích khoảng trống chức năng so với TOMONI

Đối chiếu 13 phân hệ trong [PRD](../../product/prd.md) và module trong [3_TRACKER.md](../../3_TRACKER.md) với hiện trạng TOMONI. Hiện trạng lấy từ migration (`supabase/migrations/`: `projects`, `project_companies`, `project_memberships`, `workers`, `attendance`, `audit_log`, ...), `packages/domain/src/entities/` (Attendance, Organization, Project, Worker) và tracker. Không chạy lại test trong báo cáo này.

Phân loại: **A** đã có và tốt · **B** có nhưng cần cải tiến · **C** cần cho MVP · **D** sau MVP · **E** không phù hợp.

Lưu ý: MVP hiện tại là VS-01 (RBAC thành viên dự án). Không mở rộng MVP, không triển khai VS-02 đến VS-08. Cột "Phân loại" chỉ là đề xuất, cần owner phê duyệt.

| # | Phân hệ PRD | Hiện trạng TOMONI | Repo tham chiếu | Phân loại đề xuất | Giá trị nghiệp vụ | Công sức dự kiến |
|---|---|---|---|---|---|---|
| 1 | Auth & onboarding | Auth, tenant, RBAC đã có (migration 001-021) | OCE `core/permissions.py` | A/B | Nền tảng | Đã có; cải thiện nhỏ |
| 2 | HRM / hồ sơ nhân sự | Bảng `workers`, `worker-service.ts` | CE `hr`, BS `crew`, `labour_trade` | B | Quản lý chứng chỉ, hợp đồng, cảnh báo hết hạn | Trung bình (ước tính 3-5 ngày) |
| 3 | Chấm công | DEFERRED; có bảng `attendance`, `attendance-service.ts` | BS `field_attendance`, `overtime_attendance_register` | DEFERRED | Tính công, OT | Không triển khai (chờ owner) |
| 4 | HSE & TBM | Chưa có | CE `safety` (TBM, incident, JSEA); OCE `safety` | D (sau VS-01) | Dashboard an toàn, giảm rủi ro | Lớn (ước tính 2-3 tuần) |
| 5 | Lương & công nhật | Chưa có | CE `manpower`; BS labour register | E cho MVP; D sau MVP | Phụ thuộc luật lao động từng nước | Rất lớn |
| 6 | Nhà thầu phụ (Hub) | Có `project_companies` (vai trò MC/SUB) | BS `subcontractor_work_order`, `subcontractor_bill` | B → D | Thanh toán khối lượng thầu phụ | Lớn; cần mô hình SOV |
| 7 | Giao việc & nhật ký | Chưa có | OCE `daily_diary` (`models.py:45-314`), CE `daily_reports` (Draft→Submitted→Approved), BS `task_progress_entry` | C | Nhật ký là lõi offline mobile | Lớn (ước tính 2-3 tuần) |
| 8 | Tài liệu & bản vẽ | Chưa có | OCE `documents`; BS dùng Frappe File | D | Quản lý phiên bản bản vẽ | Trung bình-lớn |
| 9 | QA/QC & punchlist | Chưa có | OCE `punchlist/service.py:99-126`, `inspections`; CE `quality/models.py:164` | D | Nghiệm thu, khắc phục lỗi | Trung bình |
| 10 | Tài sản & vật tư | Chưa có | CE `equipment`, `materials`; BS `machinery_usage` | D | Theo dõi máy móc | Trung bình |
| 11 | Quyết toán & khối lượng | Chưa có | BS `measurement_book`, `boq_wp_summary` | D | Đối soát khối lượng thanh toán | Lớn |
| 12 | Giao tiếp & thông báo | Chưa có | OCE `notifications`, `rfi`, `submittals` | D | Phản hồi RFI/hồ sơ | Trung bình |
| 13 | Dashboard & analytics | Chưa có | OCE `dashboards`; CE `dashboard` | D | Báo cáo quản lý | Trung bình |

## Chức năng bổ sung đề xuất (ngoài PRD 13 phân hệ)

| Chức năng | Nguồn | Phân loại đề xuất | Lý do |
|---|---|---|---|
| RFI với state machine | OCE `rfi/service.py:88-90` | D | Hữu ích cho hỏi-đáp kỹ thuật |
| Submittal (hồ sơ trình duyệt) | OCE `submittals/service.py:41-43` | D | Trùng một phần phân hệ 8 |
| Change order / scope change | BS `scope_change_order`, OCE `changeorders` | D | Gắn với phân hệ 11 |
| Estimate template / rate master | BS `estimate_template`, `construction_rate_master` | E cho MVP | Ngoài phạm vi quản lý thi công hiện tại |
| Estimator AI, CAD/BIM, cost database | OCE `ai_estimator`, `cad`, `bim_hub`, `costs` | E | Không thuộc định hướng TOMONI |
| Kế toán / ledger | BS (ERPNext), OCE `accounting_sync` | E | TOMONI không thay thế kế toán |

## Kết luận ngắn

- Với VS-01 đang chốt, **không có chức năng nào từ repo tham chiếu cần đưa vào ngay**. MVP không bị chặn bởi thiếu nghiệp vụ.
- Khoảng trống lớn nhất sau MVP: nhật ký thi công (7), HSE (4), punchlist (9).
- Các đánh giá dựa vào cấu trúc, model và state machine trong code. Chưa chạy test của repo tham chiếu nên chưa xác nhận hành vi thực tế.
