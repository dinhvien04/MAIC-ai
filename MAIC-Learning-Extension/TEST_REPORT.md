# Báo cáo kiểm thử

Ngày: 19/10/2026. Phạm vi: extension trong thư mục này; không sửa các dự án Python hoặc tài liệu nghiên cứu bên cạnh.

## Kết quả bản bàn giao

| Lệnh | Kết quả |
| --- | --- |
| `npm run build` | Thành công; tạo cả `dist/chrome` và `dist/firefox`, mỗi thư mục có manifest và các script/UI thực tế. |
| `npm test` | **30 passed, 0 failed, 0 skipped**. |
| `npm run smoke:chrome` | **10 nhóm kiểm tra đạt**, Chrome/155.0.8059.79; không có page error. |
| `npm run smoke:firefox` | Firefox 130 chấp nhận bản MV3 dưới dạng temporary add-on. |
| `npm run lint:firefox` | **0 errors, 1 warning**: `MISSING_DATA_COLLECTION_PERMISSIONS`. |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities trong dependency runtime. |

Các lỗi của những lượt triển khai trước đã được sửa; bảng trên ghi kết quả chạy cuối sau khi build lại.

## Nội dung test tự động

- URL/host allowlist, phân loại trang, nhận diện classroom và ID module.
- Slide counter hợp lệ/mơ hồ, tên module, nội dung slide và transcript đúng trang.
- Generated div, thẻ khóa MAIC không có href, nút bị disabled và mở mục người dùng chọn.
- Shadow DOM mở, iframe slide cùng origin, báo hạn chế khác origin; loại iframe chat không liên quan khỏi ghi chú.
- Không gộp nhiều slide đang gắn trên DOM thành nội dung của một slide.
- Phân biệt số trang/duyệt bài với hoàn thành module; tiến độ lấy từ UI, kiểm tra phạm vi 全部课程.
- Phát hiện câu hỏi, giữ nguyên đáp án và không nộp/bấm hoàn thành.
- Start/Pause/Resume/Stop, hủy thao tác chờ, chống NEXT lặp, tắt 自动 khi Pause.
- Mở bảng tiến độ chỉ đọc, SPA chuyển route, đăng nhập hết hạn, thay tài khoản và khôi phục sau reload.
- Phím tắt không bắt sự kiện trong trường nhập liệu.
- Lưu tuần tự, dữ liệu tách hồ sơ, giữ ghi chú cá nhân khi đọc lại, xuất Markdown bằng trường cho phép.
- Promise API Firefox, callback API Chrome, nguồn gửi popup/content và chống nhầm URL tab.
- Manifest MV3, file build, giới hạn host và background khác nhau giữa Firefox/Chrome.

## Kiểm tra Chrome thật với trang mẫu

Smoke chạy bằng Chrome for Testing với profile riêng. Mọi request MAIC của tab thử được trả bằng HTML fixture cục bộ; không gọi máy chủ MAIC và không sử dụng tài khoản thật.

Đã kiểm tra worker/content script nạp thành công, mặc định chưa bật, bảng nổi Shadow DOM, next/previous, mở transcript và tạo ghi chú, 自动/Pause/Resume, popup giao tiếp với tab đang học, ghi chú còn sau reload, khôi phục ở trạng thái tạm dừng, đọc progress dashboard và Stop không phụ thuộc popup.

Tệp được tạo khi chạy smoke:

- `artifacts/chrome-smoke.json`: phiên bản browser và các nhóm kiểm tra.
- `artifacts/popup-chrome.png`: ảnh popup được render thực tế trên fixture.
- `artifacts/firefox-smoke.json`: kết quả Firefox chấp nhận add-on tạm.

## Phạm vi kiểm tra Firefox

Đã nạp extension bằng remote debugger của Firefox 130 với profile dùng riêng, sau đó đóng trình duyệt thử và xóa profile. Đây là kiểm tra cài/nạp add-on, **chưa phải kiểm tra toàn bộ tương tác UI trên Firefox**. Các hành vi API khác nhau có test mock riêng.

Cảnh báo lint xuất phát từ lựa chọn hỗ trợ Firefox 115+ cho bản nạp cục bộ. Trường khai báo dữ liệu dành cho Firefox 140+/AMO chưa được thêm vào manifest này. Cần xử lý trước khi ký/phát hành qua AMO; xem giải thích và nguồn chính thức trong README.

## Cần xác minh trên MAIC thật

Chưa sử dụng tài khoản MAIC thật để kiểm tra extension. Cần người dùng cài và mở trang đang đăng nhập để đối chiếu:

1. Đọc popup và số trang trước khi điều hướng.
2. Đối chiếu breadcrumb, iframe `a2mpage`, vùng `分页讲稿` và checkbox `自动` của player hiện hành.
3. Mở bảng 学习进度, chọn 全部课程 và đối chiếu số liệu với snapshot.
4. Người học chủ động thử một lần Next/Previous trong bài đang học; việc này có thể được MAIC ghi nhận vào tiến độ duyệt bài.
5. Quan sát tạm dừng khi tới câu hỏi, tự làm các thao tác đánh giá trên website.

Không suy ra hoàn thành từ slide cuối. Không xác minh các điều kiện hoàn thành chưa biết bằng cách tự làm/nộp bài. Nếu vùng DOM chưa nhận diện chắc chắn, extension báo chẩn đoán thay vì đoán dữ liệu hoặc thử nhiều lần bấm.
