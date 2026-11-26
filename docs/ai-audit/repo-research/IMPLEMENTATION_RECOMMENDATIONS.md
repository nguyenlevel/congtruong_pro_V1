# Khuyến nghị triển khai

Dựa trên nghiên cứu read-only. Không phải kế hoạch đã được phê duyệt. Mọi hạng mục sau MVP cần owner duyệt trước khi triển khai.

## 1. Repo đáng học nhất

1. **BuildSuite Core** (MIT): nghiệp vụ thi công thực tế và luồng thanh toán thầu phụ.
2. **OpenConstructionERP** (AGPL-3.0): thiết kế state machine và permission registry. Chỉ học ý tưởng.
3. **construction_erp**: tham khảo form nhật báo và quy trình duyệt đơn giản. Không tái sử dụng mã.

## 2. Module có thể tận dụng (ý tưởng, không copy mã)

| Module | Tham chiếu | Cách tận dụng trong TOMONI |
|---|---|---|
| Nhật ký thi công | OCE `daily_diary`, CE `daily_reports` | Entry theo ngày: thời tiết, nhân lực, hoạt động, vấn đề, ảnh; đồng bộ qua outbox |
| Thanh toán thầu phụ | BS `subcontractor_work_order`, `measurement_book`, `subcontractor_bill` | Chuỗi WO → đo khối lượng → bill, có retention và advance |
| Nghiệm thu / punchlist | OCE `punchlist`, CE `quality` | State machine open → assigned → in_progress → resolved → verified → closed |
| Sự cố an toàn | OCE `safety`, CE `safety` | Trạng thái sự cố và hành động khắc phục |
| Hỏi-đáp kỹ thuật | OCE `rfi` | Trạng thái và quy tắc hạn trả lời, dùng sau MVP |

## 3. Module TOMONI đang thiếu (theo PRD)

- Phân hệ 7 (nhật ký thi công) và phân hệ 9 (QA/QC punchlist) là hai khoảng trống quan trọng nhất sau MVP vì dùng trực tiếp trên mobile offline.
- Phân hệ 4 (HSE & TBM) đã có mô tả trong PRD nhưng chưa có bảng dữ liệu.

## 4. Chức năng tiết kiệm thời gian

- **Mẫu state machine** từ OCE: thiết kế sẵn bảng chuyển trạng thái giúp viết RLS và validator nhanh hơn.
- **Danh sách lý do chậm tiến độ** (BS `stage_delay_reason`): dùng làm dữ liệu gợi ý.
- **Checklist trường dữ liệu nhật báo** (CE `daily_reports`): dùng làm chuẩn đối chiếu khi thiết kế.

## 5. Không nên đưa vào MVP

- Tính lương, công nhật (phân hệ 5): phụ thuộc luật lao động, rủi ro pháp lý.
- Estimator AI, CAD/BIM, cost database (OCE): không thuộc phạm vi quản lý thi công.
- Kế toán, ledger (BS dùng ERPNext): TOMONI không thay thế kế toán.
- Chấm công (Attendance): vẫn DEFERRED theo tracker.
- Toàn bộ VS-02 đến VS-08: chưa được phê duyệt.

## 6. Kế hoạch triển khai đề xuất (chờ phê duyệt)

1. **Giữ VS-01** là phạm vi hiện tại; hoàn tất nghiệm thu theo tracker, không mở rộng.
2. **Sau khi owner phê duyệt VS-02**, ưu tiên nhật ký thi công (phân hệ 7) vì là chức năng offline thực tế nhất. Thiết kế theo [MODULE_VERTICAL_SLICE_PLAYBOOK.md](../../standards/MODULE_VERTICAL_SLICE_PLAYBOOK.md).
3. **Punchlist** (phân hệ 9) sau nhật ký, vì dùng chung ảnh và đồng bộ offline.
4. **HSE/TBM** (phân hệ 4) sau đó; cần quy định dữ liệu cá nhân trước khi lưu ảnh vi phạm.
5. **Thanh toán thầu phụ** (phân hệ 6, 11): thiết kế mô hình khối lượng trước; liên quan trực tiếp đến tiền.

## 7. Việc cần owner quyết định

- Chấp nhận để phân hệ 5 (lương, công nhật) ở sau MVP hay không.
- Có xin phép tác giả construction_erp để tái sử dụng mã hay không (đề xuất: không, chỉ học ý tưởng).
- Có muốn mô hình thanh toán thầu phụ kiểu BuildSuite hay không.
