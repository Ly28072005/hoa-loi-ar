# Prototype công nợ phải thu Hoa Lợi

Toàn bộ thông tin là dữ liệu minh họa từ tệp tổng hợp được đính kèm. Các cấu hình DEMO, thuế, tài khoản, kết quả đối chiếu và lịch gửi không phải xác nhận thực tế của HTX.

## Màn hình đã dựng

- Ghi tăng: danh sách, tìm kiếm và lọc, chi tiết ba nhánh, xem hồ sơ, định khoản, cảnh báo hạn mức, kết quả và xử lý dở dang
- Ghi giảm: Khoản thanh toán với Ghi giảm / Cần phân bổ, Trả lại hàng bán, Giảm giá hàng bán, chi tiết căn cứ và hồ sơ dạng tab, ba cách phân bổ, sửa tài khoản Nợ có lý do, chi tiết Có 131 và số dư trước / sau
- Đối chiếu: ba thẻ truy cập, danh sách / chi tiết khách hàng, tiếp nhận / kết quả fixture tệp, kiểm tra bốn báo cáo AR / kết quả Bán hàng - AR, yêu cầu xác minh và phản hồi, vùng kiểm tra điều kiện chốt sổ
- Thông báo: chọn khoản nợ / xem trước, danh sách / tạo / sửa quy tắc, bật / tắt / xóa có xác nhận, danh sách chờ, xem nội dung, duyệt / gửi mô phỏng / thử lại, hủy nhắc và lịch sử
- Báo cáo: danh mục tìm theo tên, đủ năm nhóm và danh mục mẫu tương ứng, tham số / kết quả / xuất Excel / mở bản in. Thông báo mẫu 1 dùng chung thành phần và các cột với chức năng thông báo
- Chế độ demo: reset, nạp ca cô lập đúng dữ liệu ban đầu, ngày demo, cấu hình tuổi nợ / cảnh báo / mức độ, quét nhắc nợ, công tắc lỗi, bộ kiểm tra logic

Không có phê duyệt điều chỉnh CN04, tài khoản thực, API gửi tin hoặc cơ sở dữ liệu.

## Cấu trúc và nguyên tắc

- `src/data/mock.json`: toàn bộ JSON được trích nguyên dữ liệu từ phần 3 của tài liệu
- `src/store.ts`: store duy nhất, localStorage có schema version, các phép tính và giao dịch
- `src/scenarios.ts`: chạy các ca logic trên bản sao cô lập
- `scripts/test-logic.mjs`: kiểm tra logic tái chạy được bằng `node scripts/test-logic.mjs`
- Thông tin đã ghi nhận mới tác động khoản phải thu. Tiền chưa phân bổ không trừ trực tiếp hóa đơn. Phân bổ tiền đã ghi sổ không thêm bút toán hay giảm lại số dư khách hàng
- Lưu dở ghi tăng giữ mã xử lý và bút toán đã tạo. Ghi giảm thất bại không thay đổi bất kỳ phần dữ liệu của lượt ghi sổ
- Dữ liệu nền bắt đầu ở ngày demo 15/10/2026. Khoảng quá khứ không có đầy đủ lịch sử báo thiếu dữ liệu, không dùng số dư hiện tại để giả làm lịch sử

## Đã chạy thành công

### Kiểm tra mã

- `pnpm exec tsc --noEmit`
- `pnpm build` - có cảnh báo kích thước bundle lớn, không phải lỗi build
- `node scripts/test-logic.mjs`

### Ca trong JSON

| Ca | Kết quả thực hiện |
| --- | --- |
| E2E-01 | Logic và thao tác trình duyệt: KH-007 từ 7 triệu lên 9 triệu rồi về 0, báo cáo đồng bộ, thông báo bỏ khoản tất toán |
| UC01-NO-DUP | Logic: tiếp nhận BT-006 không tạo bút toán hoặc tăng lại số dư, lần hai bị chặn |
| UC01-PREPAID | Logic: CTBH-005 còn 7 triệu, không sinh lại PB-005 |
| UC02-PARTIAL | Logic: phân bổ đúng hạn sớm nhất, khách còn 2.240.000 VND |
| UC02-OVERPAY | Logic: hóa đơn tất toán, dư Có và tiền chưa phân bổ 760.000 VND |
| UC02-ADVANCE-THEN-INVOICE | Logic: trả trước - ghi tăng - phân bổ sau, không giảm lại số dư và không sinh bút toán phân bổ |
| UC02-RETURN-DISCOUNT | Logic: ba lần giảm đúng hóa đơn gốc, còn 648.000 VND |
| UC02-UNALLOCATED | Logic: số dư khách giảm, số còn nợ hóa đơn không giảm khi tiền chưa phân bổ |
| UC03-IMMUTABLE | Trình duyệt: không đồng ý, yêu cầu xác minh, ghi phản hồi Bán hàng và đối chiếu lại không đổi sổ, không tự Khớp |
| UC04-REVALIDATE | Logic và trình duyệt: giữ bản xem trước, ghi giảm tại màn khác, chặn lưu và xuất Excel số cũ, xem lại còn 6 triệu |
| UC04-REMINDER-SETTLED | Logic: khoản tất toán được gỡ khỏi hàng đợi và không gửi |

Nút kiểm tra logic trong Chế độ demo vẫn ghi UC03-IMMUTABLE là chưa tự động chạy bởi nút đó không thực thi trình duyệt. Không gắn nhãn đã kiểm thử UI chỉ từ một phép thử logic.

### Kiểm tra logic bổ sung

Đã chạy kiểm tra lưu dở ghi tăng và tiếp tục với bút toán cũ, lỗi hạch toán trước tạo bút toán, khóa kỳ, hủy nguồn, trùng nguồn, sai khách, thiếu hồ sơ, dữ liệu thay đổi, hoàn tác ghi giảm, thiếu hạn khi tự phân bổ, giảm vượt nợ gốc, thiếu lý do sửa tài khoản / chưa phân bổ, số dư báo cáo tại các ngày khác nhau, quét không trùng, gửi lỗi một phần, giảm nợ cần xác nhận lại, biến thanh toán chưa cấu hình và số đã trả trên thông báo không bị cộng nhầm từ phát sinh tăng.

### Kiểm tra trình duyệt Chromium

- Ghi tăng và ghi giảm thật qua UI, đọc store sau thao tác để kiểm chứng số dư và số bút toán
- Excel tải xuống được và được đọc lại bằng thư viện XLSX, có số liệu và tham số đúng kỳ
- localStorage khôi phục sau reload
- Tệp mẫu thiếu số tiền chặn toàn bộ lượt, mẫu hợp lệ so đủ bốn trường, hai dòng Khớp và các dòng sai lệch Chờ xử lý
- Kiểm tra bốn báo cáo không đủ căn cứ thì chặn, cấu hình ngưỡng thử và chọn phạm vi DEMO-KH-A đủ căn cứ thì mở kết quả nội bộ
- Tạo quy tắc trống báo lỗi, tên trùng sau trim và không phân biệt hoa thường bị chặn
- Quét chỉ tạo Chờ duyệt, quét lại không tạo trùng, gửi mô phỏng lỗi giữ bản retry và lịch sử, retry sau tắt lỗi thành công
- Cả năm nhóm báo cáo có kết quả trong phạm vi phù hợp, Mẫu 2 chưa có thì báo rõ
- Cửa sổ in mở với tiêu đề và dữ liệu báo cáo đang xem
- Điều hướng mobile và không tràn ngang trang tại 390px. Các bảng cuộn ngang bên trong
- Không có lỗi JavaScript runtime trong các lượt kiểm tra trên

## Chưa chạy hoặc giới hạn

- Chưa kiểm thử thủ công toàn bộ tổ hợp bật / tắt / xóa / đồng bộ quy tắc, mọi biểu mẫu sai hoặc toàn bộ thứ tự thao tác có thể có
- Chưa chạy toàn bộ công tắc lỗi bằng UI. Các lỗi giao dịch trọng yếu đã được kiểm tra ở mức logic như liệt kê trên
- Chưa kiểm thử Safari, Firefox, nhiều tab đồng thời, máy in vật lý hoặc hộp thoại lưu PDF trên máy người dùng
- PDF sử dụng chức năng In / Lưu PDF của trình duyệt, không có nút tải PDF trực tiếp. Không tạo tệp giả định dạng PDF
- Tệp ngoài chỉ dùng fixture có nhãn mô phỏng, không phân tích Excel / PDF bất kỳ
- Lịch chỉ mô phỏng quét bằng nút trong Chế độ demo, không chạy nền ngoài ứng dụng. Tần suất hỗ trợ hiện tại là hàng ngày
- Chưa có ngày phát sinh đơn mới trong JSON, điều kiện không có đơn mới lớn hơn 0 không tự giả định đủ điều kiện
- Không tự tính công nợ mặt hàng khi có giảm / thanh toán mà thiếu căn cứ theo dòng hàng. Không kết luận tất cả báo cáo AR đủ chỉ vì các tổng bằng nhau
- Không dựng mẫu thông báo 2, dữ liệu liên hệ, thuế thực tế, quy tắc chốt sổ chính thức hoặc đường dẫn thanh toán không có trong nguồn
