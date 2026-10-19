# Khả năng dùng Playwright

Ngày kiểm tra: 2026-10-19. Không xuất cookie, không đọc token, không đăng nhập hộ, không gọi lại API riêng, không quét lỗ hổng.

## Những gì trang cho thấy

| Hạng mục | Quan sát | Mức chắc |
| --- | --- | --- |
| Engine trang | Next.js App Router trên cả hai host. `maic.chat` có styled-components. Learning Assistant có chunk Turbopack và Vercel Analytics. | Chắc, nhìn từ URL script. |
| Trình duyệt thử | Trình duyệt tích hợp Cursor, điều khiển qua accessibility snapshot và DOM đã render. | Chắc. |
| Playwright cụ thể | Chưa cài và chưa chạy Playwright trong lần này. Nhận định dưới đây là từ hành vi DOM, chưa phải từ một script Playwright. | Giới hạn của lần kiểm tra. |
| Phiên `maic.chat` | Còn đăng nhập sau khi điều hướng nhiều URL cùng host. | Chắc. |
| Sang Learning Assistant | Không. `https://learning-feal.maic.chat/` chuyển tới `/login` dù `maic.chat` vẫn đang vào. | Chắc. |
| CAPTCHA | Không thấy trên form login Learning Assistant và không thấy trên các trang đã mở của `maic.chat`. | Chỉ đúng với các trang đã mở. |
| iframe | 0 trên trang chủ, `我的学习`, giới thiệu khóa, trang bài, và trang login Assistant. | Chưa biết player bài học. |
| video | 0 trên các trang catalog và trang bài. | Chưa vào chương. |
| Đổi URL | Có với các route đã liệt kê trong `WEBSITE_STRUCTURE.md`. Menu tài khoản và một số tab không đổi URL. | Chắc. |
| Render động | Snapshot ngay sau navigation thường chỉ còn nav. Nội dung khóa đến sau. | Chắc. |
| Giới hạn tần suất | Không thấy câu nào về rate limit trong UI đã mở. | Chưa biết. |

## Selector

Dùng được, tương đối ổn định:

- `a.menu` với chữ `课程广场`, `我的学习`, `关于`
- `a.logo`
- `.footer` và `.title` / `.subTitle` cho tên khóa
- chữ trạng thái `已学习`, `未提交`, `已学完`, `超出作业提交时间无法提交`
- role và nhãn form login Assistant: textbox email, textbox password, button `登录`

Không nên khóa vào class `sc-xxxxxxxx`. Đó là hash của styled-components, đổi khi build.

Nút `开始学习`, `继续学习`, `去复习` là `div`, không phải button trong accessibility tree. Playwright nên bấm theo text, rồi chờ URL hoặc một landmark của trang đích.

Thẻ khóa trên `课程广场` không có `href`. Bấm tên khóa trên `我的学习` trong lần này không điều hướng.

## Đăng nhập và phiên

Cách phù hợp với ràng buộc chỉ đọc:

1. Người dùng tự đăng nhập trong cửa sổ Playwright.
2. Script không đọc, không in, không lưu cookie hay access token ra file.
3. Context có thể giữ trên máy để lần sau còn phiên, nhưng file state đó là bí mật cục bộ, không đưa vào git và không gửi đi đâu.
4. Hết hạn thì dừng và hỏi người dùng đăng nhập lại.

Hai lần đăng nhập là hai origin:

- `maic.chat`: tài khoản, điện thoại hoặc email, cộng mật khẩu. Có tab OTP điện thoại.
- `learning-feal.maic.chat`: email MAIC, mật khẩu, và checkbox điều khoản.

Không có dấu hiệu SSO giữa hai origin trong lần thử này.

## Khó khăn đã thấy

- Trang hydrate chậm. Cần chờ text, không chờ mỗi `load`.
- Class hash làm selector CSS dễ gãy.
- Vào `继续学习` có thể ghi thời gian học hoặc tiến độ. Bot theo dõi tiến độ không được bấm nút đó chỉ để đếm chương, trừ khi người dùng đồng ý và script không bấm nút hoàn thành.
- Bài luận trên web đã bị chặn nộp. Bot không có gì để bấm nộp trên trang đó.
- Learning Assistant là nơi có 60 module, questionnaire và bài thi, nhưng đang cần login riêng.
- Player bài học, quiz trong module, và viewer file `预览` chưa được mở. Chưa biết chúng có iframe, PDF.js, hay player video riêng.
- Không thấy tài liệu công khai nào trên các trang này nói cho phép hay cấm automation.

## Việc Playwright làm được mà không đụng điểm

- Đọc `我的学习` và ghi phần trăm từng khóa.
- Đọc `目录` của một khóa khi URL giới thiệu đã biết, như Project Intro A.
- Đọc trang bài luận: trạng thái `未提交`, tên file đã gắn, dòng chặn nộp.
- Chụp ảnh các trang catalog để đối chiếu.
- Dừng khi gặp `/login`.

## Việc chưa được làm, kể cả khi viết bot sau này

- Tự đánh dấu module hoàn thành.
- Tua video hoặc giả thời gian học.
- Nộp quiz, questionnaire, hoặc bài thi.
- Bắt đầu bài thi có giờ.
- Đổi research task.
- Tải cookie ra ngoài máy.
- Vượt CAPTCHA nếu sau này trang thêm CAPTCHA.
