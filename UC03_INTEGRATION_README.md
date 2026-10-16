# HTX Hoa Lợi – Ghép lại UC03 (Đối chiếu công nợ)

## Nội dung bản tích hợp
- Nguồn: `Tạo prototype tương tác.zip` – 5 Use Case; `Web prototype cho công nợ.zip` – UC03 mới của Luân.
- Giữ **nguyên tệp** và **nguyên nội dung mã nguồn** của UC01 (`Increase.tsx`), UC02 (`Reduction.tsx`), UC04 (`Notifications.tsx`), UC05 (`Reports.tsx`), `App.tsx`, `store.ts`, `ui.tsx`, `index.css`, dữ liệu mock và các kịch bản demo của hệ thống gốc.
- Thay **duy nhất** nội dung `src/Reconcile.tsx` thành adapter cho UC03 của Luân.
- Thêm `src/uc03/Reconciliation.tsx`, `reconciliationModel.ts`, `ui.tsx`, `money.ts` và `uc03-isolated.css`.
- Không chép đè `App.tsx`, `package.json`, `index.css`, `store.ts` của Luân.

## Vì sao dùng Shadow DOM
UC03 của Luân có `.sidebar`, `.card`, `.button`, `.topbar`, `.table-wrap`, `:root` và các tên class trùng với hệ thống tổng. CSS của UC03 được bơm vào ShadowRoot để không làm thay đổi style của bốn Use Case khác. Sidebar chung vẫn do `src/App.tsx` điều khiển.

## Dữ liệu mẫu và giới hạn hiện tại
UC03 của Luân sử dụng các fixture/số liệu mô phỏng riêng từ `src/uc03/reconciliationModel.ts`, lưu trong `localStorage` khóa `hoaloi-uc03-merged-v1`, KHÔNG tự cập nhật từ `hoaloi-ar-prototype-v3` của bốn UC còn lại. Đây là giới hạn có chủ ý để không gây ghi đè/phá hủy dữ liệu nền của hệ thống cũ. Nếu yêu cầu UC03 đối chiếu giao dịch phát sinh thực tế từ UC01, UC02, UC04 và UC05, phải có giai đoạn tích hợp **mô hình dữ liệu chung** và kiểm thử riêng; chưa được làm trong bản thay giao diện này.

## Chạy thử bên ngoài Figma
1. Giải nén ZIP, mở terminal tại thư mục chứa `package.json`.
2. Cài Node.js phiên bản tương thích, chạy `npm install` hoặc `pnpm install` theo lockfile.
3. `npm run dev` → mở địa chỉ URL Vite hiển thị để thử năm UC.
4. `npm run build` để biên dịch; các lỗi TS/build nếu có cần xử lý trước khi đẩy lên Figma Make.
5. Nếu nhập Figma Make, đưa cả dự án đã ghép vào **Make file mới/bản sao** để tránh ghi đè bản gốc. Tùy giao diện tài khoản, sử dụng GitHub import hoặc đưa mã vào môi trường code; một ZIP không phải lúc nào cũng là tệp có thể bấm Open trực tiếp trong Make.

## Checklist kiểm tra
- [ ] Sidebar đủ năm mục, không nhân đôi header/sidebar khi mở UC03.
- [ ] UC01, UC02, UC04, UC05 giao diện và chức năng không đổi.
- [ ] UC03 mở được ba nhánh: đối chiếu khách hàng, từ tệp ngoài, nội bộ Bán hàng-AR; trạng thái và thao tác dùng fixture Luân.
- [ ] F5/tải lại UC03 không phá dữ liệu của các UC khác.
- [ ] Kiểm tra trên màn hình desktop và laptop; thử mobile.
- [ ] Nếu cần đồng bộ số liệu xuyên UC, lập task tích hợp tiếp theo, không xem đây là chức năng đã xong.

## Kiểm thử đi kèm
- `node scripts/test-logic.mjs`: logic của hệ thống tổng.
- `node --test tests/uc03-reconciliation.test.mjs`: 4 nhóm test UC03 tương ứng 8 khách hàng mẫu.
- `tests/uc03-reconciliation.test.mjs` dùng TypeScript đã là `devDependency`.
- Đổi khách hàng tạo mới mặc định thành `KH-008` vì `KH-007` đã có trong fixture của Luân.
