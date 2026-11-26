# FieldBook (contractor-app) — Ghi chú tham chiếu

> Repo: `https://github.com/Anuraj-IND/contractor-app` (clone local: `reference/contractor-app`)
> Stack gốc: MERN (MongoDB + Express + React + Node), Cloudinary cho ảnh.
> **Không copy code** — chỉ rút yêu cầu nghiệp vụ / mô hình dữ liệu tham khảo.

## 1. Đóng góp cho module nào

| Module tracker | Mức đóng góp | Nội dung tham chiếu được |
|---|---|---|
| 3 — Chấm công & Vị trí | **CAO** | Model `Attendance` + màn hình Attendance + LaborerHome |
| 5 — Tính lương & Công nhật | **CAO** | `User.defaultDailyWage`, `Attendance.wageForDay`, `advancePaidToday`, `manualTotalPaid`/`manualLeftToPay` |
| 6 — Nhà thầu phụ (Hub) | TRUNG BÌNH | Phân vai admin/laborer; Supplier (nhà cung cấp) |
| 10 — Tài sản & Vật tư | **CAO** | Model `Material` + `Supplier` + gắn vật tư vào project |
| 11 — Quyết toán & Khối lượng | **CAO** | Model `Invoice` + `Project.paymentHistory`, `amountReceivable` |
| 13 — Dashboard & Analytics | TRUNG BÌNH | Phép tính tổng trên dashboard |

## 2. Mô hình dữ liệu tham khảo (fieldbook)

### Project (`server/models/Project.model.js`)
- `customerId`, `title`, `siteAddress`, `city`, `serviceType[]`, `areaSqFt`, `ratePerSqFt`
- Tài chính: `totalCost`, `paidTillNow`, `amountReceivable` (auto = totalCost − đã trả), `paymentHistory[]` {amount, date, note, method: Cash|UPI|Bank Transfer|Cheque}
- `materials[]` {materialId, quantityUsed, note}; `assignedLaborers[]`
- `status`: Not Started | In Progress | Completed | On Hold; `startDate`, `expectedEndDate`, `completedDate`
- **Business rule tham khảo:** cấm xóa customer/project còn dư nợ; `completedDate` tự set khi Completed.

### Attendance (`server/models/Attendance.model.js`)
- `projectId`, `laborerId`, `date`, `present` (bool), `wageForDay`, `advancePaidToday`, `note`
- **Unique index `(projectId, laborerId, date)`** → chống trùng chấm công cùng ngày.
- Màn hình: lịch chấm công theo ngày, highlight Present(xanh)/Absent(đỏ).

### User / Laborer (`server/models/User.model.js`)
- `role`: admin | laborer; `phone`, `address`, `defaultDailyWage`, `isActive`
- Lương: `manualTotalPaid` (override tổng đã trả), `manualLeftToPay` (override còn nợ) — cho phép điều chỉnh tay khi có tạm ứng/nợ ngoài lề.
- Worker không email vẫn onboard được (optional email/password).

### Material (`server/models/Material.model.js`)
- `supplierId`, `name`, `unit`, `quantityPurchased`, `quantityAvailable`, `purchaseDate`, `pricePerUnit`
- Tài chính: `totalCost` (= price × qty), `amountPaid`, `balance` (= totalCost − amountPaid), `paidCompletely(bool)`, `paidCompletelyDate`.

### Supplier (`server/models/Supplier.model.js`)
- `companyName`, `contactPerson`, `phone`, `email`, `address`, `paymentHistory[]`
- Tổng hợp: `totalPurchased`, `totalPaid`, `balance`; `status`: Active | Cleared | Inactive (tự cập nhật theo balance).
- **Business rule tham khảo:** gộp trùng supplier theo số điện thoại, hợp nhất lịch sử thanh toán → cảnh báo cho việc deduplicate trong Partner OS.

### Invoice (`server/models/Invoice.model.js`)
- `invoiceNumber` (unique, sinh tự động — `server/utils/generateInvoiceNumber.js`), `projectId`, `customerId`, `issueDate`, `dueDate`
- `lineItems[]` {description, quantity, unitPrice, total}; `subtotal`, `tax`, `totalAmount`, `amountPaid`, `balance`, `paymentHistory[]`
- `status`: Draft | Sent | Partial | Paid | Overdue (tự tính từ số tiền: 0→Draft/Sent; balance 0→Paid; >0→Partial).
- Màn hình Invoices lọc bỏ tài khoản đã thanh toán (chỉ hiện pending collections).

## 3. Ghi nhận UX/flow đáng học

1. **Cấm xóa còn dư nợ** (customer/project/supplier) — ràng buộc toàn vẹn nghiệp vụ.
2. **Chấm công theo ngày + chống trùng** bằng unique index tự nhiên (project, worker, date).
3. **Worker portal** (LaborerHome): lịch cá nhân + upload ảnh site + thu nhập "đã nhận"/"còn lại".
4. **Auto-calc mọi số tiền** ở tầng model (subtotal/total/balance/status) → hạt giống cho Domain Rules của Partner OS (không để logic casino nằm rải rác UI).
5. **Payment history mở rộng được** qua method enum.
6. Dashboard: Active Projects, Total Revenue, Receivables, Supplier Dues, Pending Labor Payments + mini calendar.

## 4. Giới hạn (không áp dụng trực tiếp)

- MongoDB schema lỏng, không có RLS/multi-tenant/offline — toàn bộ phải thiết kế lại theo Supabase + WatermelonDB.
- Không có HSE, QA/QC, tài liệu/bản vẽ, nhật ký công trường chi tiết.
- Manual override lương là "băng keo" — ở Partner OS nên định nghĩa thêm bảng tạm ứng/nợ thay vì override số.
- Không có workflow duyệt (approval) — cần bổ sung theo `packages/auth` + audit log của dự án.

## 5. Nguồn

- README gốc: `reference/contractor-app/README.md`
- Models: `reference/contractor-app/server/models/{Project,Attendance,User,Material,Supplier,Invoice}.model.js`
- Pages: `reference/contractor-app/client/src/pages/{Attendance,LaborerHome,Dashboard,Invoices,Projects,Suppliers,Materials...}.jsx`