# MAIC Learning Assistant

Extension WebExtensions hỗ trợ học trực tiếp trong phiên trình duyệt đang đăng nhập trên `https://maic.chat` và `https://learning-feal.maic.chat`. Hai website có phiên đăng nhập riêng; người học đăng nhập thủ công trên từng website khi cần.

Thư mục này độc lập với các dự án Python và tài liệu nghiên cứu bên cạnh. **Dùng bản build có sẵn không cần Node.js, Python, Playwright, backend hoặc API key.**

## Cài bản có sẵn

### Firefox trên Ubuntu

1. Mở `about:debugging`.
2. Chọn **This Firefox** / **Firefox này**.
3. Bấm **Load Temporary Add-on…** / **Nạp tiện ích tạm thời…**.
4. Chọn file **`MAIC-Learning-Extension/dist/firefox/manifest.json`**.
5. Tải lại các tab MAIC đã mở trước khi cài extension.
6. Nếu Firefox hỏi quyền truy cập website, cho phép trên đúng hai host MAIC. Có thể kiểm tra trong `about:addons` → extension → Permissions.
7. Bấm biểu tượng extension trên thanh công cụ. Có thể ghim biểu tượng từ menu Extensions.

Bản Firefox khai báo phiên bản tối thiểu 115; đã kiểm tra Firefox 130 trên máy phát triển. Add-on tạm thời bị gỡ khi đóng Firefox. Để dùng lâu dài cần ký XPI qua Mozilla hoặc phân phối theo chính sách quản trị phù hợp. Chưa có XPI đã ký trong dự án.

### Chrome / Chromium

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Bấm **Load unpacked**.
4. Chọn **thư mục `MAIC-Learning-Extension/dist/chrome`**, không chọn file JSON.
5. Tải lại tab MAIC và ghim biểu tượng extension nếu cần.

Manifest Chrome yêu cầu Chrome/Chromium 109 trở lên. Smoke test chạy trên Chrome for Testing; xem phiên bản thực tế trong `artifacts/chrome-smoke.json` khi chạy kiểm thử.

## Dùng lần đầu

1. Mở MAIC trong chính trình duyệt đã cài extension và đăng nhập bình thường. Extension không có form mật khẩu.
2. Mở popup. Trạng thái ban đầu là **Đã dừng**; extension chỉ nhận diện trang, chưa lưu văn bản slide.
3. Vào **Cài đặt**, đặt hồ sơ như `tai-khoan-1`. Dùng tên khác cho từng tài khoản. Cài đặt hồ sơ áp dụng cho tab hiện tại và được giữ khi tải lại tab.
4. Bấm **Bật trợ lý**. Nếu nhận diện được dấu hiệu tài khoản rõ ràng từ UI, extension có thể dùng mã băm cục bộ; nếu không, bắt buộc chọn hồ sơ cục bộ trước khi bật. Không cần nhập email hay thông tin đăng nhập vào extension.
5. Mở khóa/module trên website hoặc từ danh sách **Tiến độ**. Nút mở ghi rõ đây là **phiên học**, vì MAIC có thể ghi nhận việc vào bài.
6. Trong phòng học, dùng **Slide sau / Slide trước**, **Đọc slide**, **Mở 分页讲稿** hoặc **Tạo ghi chú**. Bảng nổi tiếp tục hoạt động sau khi đóng popup.
7. Để đọc tiến độ chính thức, mở Learning Assistant, chọn **全部课程**, bấm **Đọc lại tiến độ**. Extension thử mở nút `学习进度` nếu nhận diện duy nhất. Nếu không, mở bảng bằng tay rồi đọc lại.
8. Trong **Ghi chú**, chọn một trang đã đọc, viết ghi chú cá nhân, bấm lưu và **Xuất .md**.

Hồ sơ không tự liên kết giữa các tab mới hoặc các trình duyệt. Chọn cùng tên hồ sơ khi muốn lưu hai website vào cùng nhóm dữ liệu. Khi đổi tài khoản mà website không cung cấp dấu hiệu nhận diện, cần tự đổi hồ sơ. Sau khi đóng hẳn trình duyệt, trạng thái tab được xóa để tránh dùng nhầm ID tab; dữ liệu ghi chú vẫn giữ nguyên khi extension còn được cài.

## Chức năng đã triển khai

- Nhận diện host, trang chính, 我的学习, giới thiệu khóa, classroom, dashboard, login và route đánh giá.
- Nhận diện tên khóa/module qua breadcrumb, tiêu đề hoặc dòng `Course / Module / Lesson`; lấy ID từ URL classroom đang mở.
- Đọc số slide, văn bản slide, lời giảng trang hiện tại và lời giải có sẵn nếu DOM cung cấp vùng nhận diện được.
- Truy cập DOM thường, Shadow DOM mở và iframe cùng origin; không vượt iframe khác origin hoặc Shadow DOM đóng.
- **Fast Study**: phím tắt, chọn nhanh slide đã đọc, từ khóa, trích đoạn và ghi chú riêng cho từng trang.
- Điều hướng từng lần do người học yêu cầu. Mỗi lệnh chỉ bấm một nút đúng nhãn; nút thiếu, mơ hồ hoặc disabled thì báo lỗi và dừng.
- Đọc/bật/tắt ô **自动** nếu tìm được đúng một checkbox có nhãn xác minh được. Chính MAIC điều khiển việc sang trang khi audio hết; extension không tạo sự kiện audio và không có timer tự lật slide.
- Tự lưu trang đang hiện khi nội dung thay đổi nếu bật cài đặt này. Không quét hay lật hàng loạt trang để lấy nội dung.
- Bảng nổi dùng Shadow DOM, kéo thả, thu gọn, số slide, điều hướng, ghi chú, Pause/Resume/Stop.
- Popup 380 px cập nhật từ storage khi trang thay đổi; trạng thái hoạt động nằm ở content script, không phụ thuộc popup.
- Phát hiện module có URL đã thấy, dòng cây/module có ngữ nghĩa, thẻ khóa dùng chuỗi chữ `长期有效 / 已学习N% / 开始学习` hoặc `继续学习`/`去复习`.
- Mở lại module đã ghé gần nhất. Chỉ mở URL hoặc mục đã tìm thấy; không đoán ID. Vị trí slide do MAIC khôi phục, extension không tự lật đến checkpoint.
- Lưu snapshot tiến độ có nguồn và thời điểm. Không điền sẵn 1/10, 2/4, 0/1 hay danh sách module từ tài liệu cũ.
- Module hoàn thành, questionnaire, bài luận, khóa pre-test/đề tài và Final Exam được đọc khi UI có dấu hiệu rõ; không thấy thì **Chưa xác minh**.
- Lưu bằng `browser.storage.local`/`chrome.storage.local`, ghi tuần tự trong background để tránh mất dữ liệu giữa các tab.
- Xuất Markdown bằng allowlist trường dữ liệu, không đưa mã hồ sơ/tài khoản hoặc URL có query vào metadata xuất mặc định.
- Không dùng LLM. “Tạo ghi chú” trích tối đa 5 câu đầu và đếm từ khóa; ghi rõ phương pháp trên UI. Hỗ trợ tiếng Trung/Anh ở dạng văn bản gốc, không tự dịch. Tách từ khóa tiếng Trung chỉ ở mức chuỗi ký tự, chưa có bộ tách từ chuyên dụng.

## Start, Pause, Resume, Stop

| Điều khiển | Hành vi |
| --- | --- |
| Bật trợ lý | Khởi tạo observer, phím tắt, đọc trang và bảng nổi nếu ở classroom. |
| Tạm dừng | Hủy tác vụ đang chờ; chặn lệnh điều hướng mới; tắt 自动 nếu nhận diện được; tiếp tục quan sát giao diện. |
| Tiếp tục | Kiểm tra đăng nhập, loại trang và câu hỏi trước khi chạy; không tự bật lại 自动. |
| Dừng | Hủy tác vụ, tháo observer/listener/timer, gỡ bảng nổi và lưu trạng thái dừng. |

SPA đổi route, đăng nhập hết hạn, tài khoản đổi hoặc câu hỏi xuất hiện sẽ chuyển sang tạm dừng. Sau khi tải lại trang, phiên đang chạy được khôi phục ở trạng thái **tạm dừng**. Trong một bài đánh giá, không cho mở module khác bằng extension.

Nếu MAIC thay DOM khiến checkbox 自动 không nhận diện được, extension không thể đảm bảo dừng chế độ tự lật do website đang chạy: cần tắt nó trực tiếp trên MAIC. Stop dừng toàn bộ hoạt động do extension quản lý, không dừng mọi hoạt động độc lập của website.

Phím tắt chỉ dùng trong classroom, không bắt khi nhập vào input/textarea/select/contenteditable:

| Phím | Thao tác |
| --- | --- |
| Alt + → | Slide sau |
| Alt + ← | Slide trước |
| Alt + P | Tạm dừng |
| Alt + R | Tiếp tục |

Firefox/desktop có thể đã dùng các tổ hợp Alt; có thể tắt Fast Study và dùng nút. Extension không thay phím tắt ở các website khác.

## Ba loại tiến độ

1. **Vị trí slide:** trang đang mở, ví dụ 2/31.
2. **Phần trăm duyệt bài/khóa:** số `已学习N%` hoặc phần trăm MAIC hiển thị; đây không phải số module đã hoàn thành.
3. **Hoàn thành chính thức:** trạng thái `已学完`/`已完成` của đúng module hoặc bộ đếm của Learning Assistant có phạm vi **全部课程**.

Đến trang cuối không chuyển module thành hoàn thành trong dữ liệu extension. Module mới xuất hiện được phát hiện từ UI; không tạo giả 50 module tự chọn chưa thấy. Snapshot hiển thị là lần quan sát đã lưu, có thể cũ hoặc MAIC chưa đồng bộ.

## Quyền và dữ liệu

Chỉ có `storage`, `activeTab` và hai host MAIC. `activeTab` phục vụ chọn tab từ lần mở popup; không có quyền tất cả website, cookies, network interception hay password manager. Không gọi API MAIC riêng, không xuất token/cookie, không có kết nối đến máy chủ AI.

Nội dung slide/lời giảng được giữ trên thiết bị. Nếu chính nội dung bài có thông tin riêng tư, thông tin đó vẫn có thể nằm trong văn bản đã đọc; hãy xem lại file Markdown trước khi chia sẻ. Không thu thập hộp thư hoặc trường nhập mật khẩu. Tối đa 600 trang/hồ sơ; dung lượng thực tế còn phụ thuộc quota storage của trình duyệt. Hết quota thì báo lỗi và tạm dừng; xuất rồi xóa dữ liệu từ Cài đặt nếu cần.

## Phát triển và kiểm thử

Chỉ người sửa mã nguồn cần Node.js 22.12+ và npm. Dev dependencies không được đưa vào extension build.

```bash
cd MAIC-Learning-Extension
npm ci
npm run build
npm test
npm run lint:firefox
```

`dist/chrome` và `dist/firefox` chứa manifest, background, content script và popup đã bundle. Build dùng esbuild, không tải mã ở runtime.

Kiểm tra với trình duyệt thật trên fixture:

```bash
npx puppeteer browsers install chrome
npm run smoke:chrome
npm run smoke:firefox
```

Puppeteer chỉ là công cụ **kiểm thử phát triển**, không phải yêu cầu khi sử dụng extension. Smoke Chrome chặn request của trình duyệt thử và trả HTML fixture từ ổ đĩa, không truy cập tài khoản MAIC. Firefox smoke chỉ kiểm tra trình duyệt chấp nhận add-on tạm, không khẳng định đã kiểm tra toàn bộ UI trên Firefox. Script Firefox tạo profile mới dưới `~/snap/firefox/common` để tương thích bản Snap; đặt `MAIC_TEST_FIREFOX` nếu executable khác `/usr/bin/firefox`.

Unit/integration test dùng HTML cục bộ và mock WebExtensions APIs: page/URL detection, module ID, số slide, DOM/frame/shadow extraction, transcript, điều hướng, câu hỏi, progress, storage, account/profile, vòng đời, SPA, phím tắt và messaging của popup. Screenshot và báo cáo smoke được ghi vào `artifacts/` (gitignore).

### Khác biệt Firefox/Chrome

Chrome MV3 dùng `background.service_worker`; Firefox dùng `background.scripts`. Mã background không dựa vào biến nhớ tồn tại mãi, mọi ghi dữ liệu hoàn thành trước khi trả lời message. Listener bất đồng bộ dùng callback + `return true` để tương thích cả hai trình duyệt.

Bản Firefox tạm thời hỗ trợ 115+ nên chưa khai báo `data_collection_permissions`, một trường từ Firefox 140. Vì vậy addons-linter hiện báo **1 cảnh báo `MISSING_DATA_COLLECTION_PERMISSIONS`**, không có lỗi schema/code. Đây là bản để nạp cục bộ, chưa sẵn sàng đưa lên AMO: khi ký/phát hành bản mới qua AMO cần thêm khai báo `required: ["none"]` và điều chỉnh dải phiên bản tương thích. Không bỏ qua cảnh báo trong lệnh lint.

Tài liệu tham chiếu chính thức: [background trên MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background), [khai báo dữ liệu trên MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings), [messaging của Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).

## Giới hạn cần xác minh trên MAIC thật

- Mã chưa được chạy với phiên tài khoản MAIC thật. Fixture phản ánh nhãn và hành vi trong yêu cầu/nghiên cứu, không phải bản sao DOM đầy đủ. Selector và vùng trích lời giảng cần đối chiếu trực tiếp trên từng loại player.
- Không bảo đảm player khác, canvas/ảnh không có text, Shadow DOM đóng hoặc iframe khác origin đọc được. Không có OCR và không vượt bảo vệ origin.
- Nếu nhiều slide vẫn được gắn trên DOM mà không có dấu hiệu trang đang hoạt động, extension không gộp chúng vào slide hiện tại; dùng lời giảng hoặc chọn trang trực tiếp.
- Không bấm nhãn mơ hồ. Module chỉ có div không đủ dấu hiệu cấu trúc có thể chưa được liệt kê; mở trực tiếp trên MAIC để ghi nhận URL classroom.
- Trạng thái đề tài/Final Exam không có chữ xác nhận rõ sẽ giữ Chưa xác minh. Không mở bài thi để tìm trạng thái.
- Lời giảng chỉ lưu trang hiện đang thấy. Nếu nội dung tải muộn, observer đọc lại; có thể dùng Đọc slide hoặc Mở 分页讲稿 để đọc thủ công.
- Dữ liệu local không đồng bộ giữa máy/Firefox/Chrome. Trước khi gỡ add-on, hãy xuất ghi chú; đặc biệt lưu ý vòng đời add-on tạm của Firefox.
- Không tự trả lời, nộp quiz/questionnaire/exam, bấm `完成`, sửa lựa chọn đề tài, tua audio hoặc giả thời gian học. Các quy tắc hoàn thành chỉ MAIC xác nhận.

## Cấu trúc

```text
manifests/       Hai manifest nguồn
src/background/ Ghi storage tuần tự và sự kiện tab
src/content/    Vòng đời trợ lý, đọc slide/progress, Learning Assistant
src/core/       Messaging, hồ sơ/storage, trạng thái, module, notes, navigation
src/utils/      Selector theo nhãn, DOM visibility, chờ MutationObserver
src/overlay/    Bảng nổi Shadow DOM
src/popup/      Popup HTML/CSS/JavaScript
scripts/        Build và smoke browser
tests/          Fixture, mock API và kiểm thử tự động
dist/           Hai bản sẵn để nạp
```
