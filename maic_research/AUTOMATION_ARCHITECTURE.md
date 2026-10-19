# Kiến trúc đề xuất

Chưa triển khai. Tài liệu này chỉ là thiết kế sau lần đọc trang.

Bot không được học hộ, không được nộp bài tính điểm, và không được sửa trạng thái hoàn thành trên server.

## Mục tiêu hợp lệ

Theo dõi năm yêu cầu của chứng chỉ, chụp lại những gì trang đang hiện, và hỗ trợ người học đọc tài liệu họ đã mở. Mọi thao tác ghi, nộp, hoặc bắt đầu bài thi đều dừng để người dùng bấm.

## Thành phần

```text
Người dùng
  └── đăng nhập tay trong cửa sổ Chromium của Playwright
        └── bộ đọc chỉ đọc
              ├── maic.chat: 我的学习, course_introduction, trang homework
              └── learning-feal.maic.chat: sau khi người dùng tự đăng nhập
                    └── SQLite cục bộ
                          └── Streamlit: bảng tiến độ và ảnh chụp
```

FastAPI chỉ cần khi muốn tách UI và bộ đọc thành hai process. Với một người trên một máy, Streamlit gọi thẳng lớp đọc là đủ.

LLM, local hoặc API, chỉ được tóm tắt tài liệu người dùng đã mở và đã cho phép lưu. Không dùng LLM để trả lời quiz, làm bài thi, hay viết bản nộp cuối dưới tên học viên.

## Từng việc

### A. Khám phá khóa

Đọc `课程广场` và `我的学习`. Lưu tên khóa, giảng viên, URL nếu điều hướng tạo ra URL, và text nút `开始学习` / `继续学习` / `去复习`. Không bấm vào player.

### B. Theo dõi tiến độ

Mỗi lần chạy, ghi một dòng SQLite: thời điểm, tên khóa, phần trăm, nhóm `正在学习` hoặc `已学完`. Với Learning Assistant, sau khi có phiên hợp lệ, ghi trạng thái 60 module, bốn questionnaire và Final Exam đúng chữ trên màn hình. Nếu đang ở `/login` thì ghi `blocked_login`, không đoán.

### C. Tóm tắt tài liệu

Chỉ với file hoặc trang người dùng mở và đồng ý lưu, ví dụ `作业说明` đã hiện sẵn trên trang bài. Không tải hàng loạt bài học chỉ để cho model đọc. Không vượt tường đăng nhập.

### D. Bảng điều khiển

Năm hàng: 60 module, hai questionnaire trước khóa, hai post-test, bài thi cuối, bài luận. Mỗi hàng có trạng thái `confirmed`, `not_seen`, hoặc `blocked`, cộng URL và thời điểm đọc.

### E. Chạy tiếp sau khi dừng

SQLite lưu lần đọc cuối và URL cuối. Lần sau tiếp tục từ catalog, không từ giữa một bài thi. Nếu phiên hết hạn, dừng ở login.

### F. Ảnh xác minh

Mỗi trang catalog chụp một ảnh full page, lưu cạnh bản ghi SQLite. Ảnh để người dùng đối chiếu chữ `未提交` hoặc phần trăm, không để giả lập tiến độ.

### G. Ôn bài thi

Được phép: liệt kê chỗ vào `Assessment` và nhắc chưa đọc hướng dẫn vì đang vướng login. Không được: mở đề, trả lời, hoặc bắt đầu bài có giờ.

### H. Soạn bài luận

Được phép: giữ nguyên `作业说明` đã đọc, checklist độ dài, bố cục, và kênh Cloud Drive. Người học tự viết. Công cụ có thể góp ý bản nháp người học dán vào, và phải nói rõ góp ý không phải bản để nộp.

### I. Cổng duyệt trước khi nộp

Không có hàm nộp. Nếu sau này có thao tác upload, nút đó tắt mặc định. Người dùng phải xác nhận bằng một động tác riêng ngoài chat tự động, và script in lại tên file cùng URL trước khi làm gì. Trang hiện tại đang hiện `超出作业提交时间无法提交`, nên nhánh nộp trên `maic.chat` phải báo chặn, không thử bấm lại.

### J. Log và lỗi

Mỗi bước ghi: URL, chữ trạng thái đã khớp, ảnh, và exception. Lỗi selector thì dừng, không thử chuỗi click khác vào nút hoàn thành. Hết phiên thì một mã `auth_required`.

## Công nghệ

| Phần | Chọn | Lý do |
| --- | --- | --- |
| Ngôn ngữ | Python | Đủ cho Playwright, SQLite, Streamlit. |
| Trình duyệt | Playwright Chromium | Chờ nội dung động của Next.js được. |
| Dữ liệu | SQLite một file cục bộ | Một người học, không cần server. |
| UI | Streamlit | Bảng tiến độ nhanh, không cần viết frontend riêng. |
| API | FastAPI, tùy chọn | Chỉ khi tách worker đọc trang khỏi UI. |
| LLM | Gọi khi người dùng bật, với đoạn họ cung cấp | Không gắn vào vòng lặp nộp bài. |

## Ràng buộc thiết kế

- Không ghi `localStorage`, cookie, hay token ra báo cáo.
- Không cài extension.
- Không sửa hồ sơ.
- Không chạy song song nhiều tab vào cùng một bài học.
- Máy này là Ubuntu 22.04. Playwright cài bằng Python vẫn chạy được. Việc đó khác với app desktop ChatGPT, và không cần nâng cấp Ubuntu chỉ để đọc trang.
