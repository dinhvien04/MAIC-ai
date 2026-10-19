# Điều tra 60 module bắt buộc trên MAIC

Ngày đọc: 2026-10-19. Tài khoản đang đăng nhập trên `https://maic.chat`: `nguyendinhvien`. Chỉ đọc trang. Không nộp bài, không đổi cài đặt, không viết code tự động.

## Kết luận ngắn

Trang `我的学习` không chứa danh sách 60 module. Lần này đếm được **14 khóa**, không phải 60 module. Vì danh sách 60 module không xuất hiện, **không thể nói đã hoàn thành bao nhiêu module bắt buộc, còn bao nhiêu, hay từng module hoàn thành bằng cách nào.**

Learning Assistant, nơi thông báo của TA nói là chỗ hiện bản đồ module sau pre-test, mở ra thì đứng ở trang đăng nhập. Phiên `maic.chat` không dùng được bên đó.

## 1. Số module tìm thấy

| Nơi đã mở | Kết quả |
| --- | --- |
| `https://maic.chat/my_study` | 14 khóa. Chữ "60" không có trên trang. |
| `https://maic.chat/course_introduction/6a9a1de0899ece445f038e8d` | Mục lục Project Intro A. Trang ghi `上架章节：3 章节`. Đây là chương của một khóa, không phải 60 module. |
| `https://learning-feal.maic.chat/` | Chuyển tới `/login`. Không thấy sidebar, Pre-test, Progress, hay bản đồ module. |
| `https://project.maic.chat/?ref=https%3A%2F%2Fmaic.chat` | Trang tin tức MAIC. Không thấy chữ 60 module. |

Số module bắt buộc nhìn thấy trên website trong lần này: **0 / 60**.

14 khóa trên `我的学习` là đơn vị khác. Không cộng chúng thành 60 module.

## 2. Đã hoàn thành bao nhiêu

Trong danh sách 60 module: **không xác định**, vì danh sách không có trên trang.

Trong 14 khóa nhìn thấy:

| Khóa | Trạng thái trên trang | Nút |
| --- | --- | --- |
| Project Intro A | `已学完`, `已学习100%` | `去复习` |
| The Major Schools of Educational Theory | `正在学习`, `已学习5%` | `继续学习` |
| 12 khóa còn lại | `正在学习`, `已学习0%` | `开始学习` |

12 khóa 0%: Data Mining (0822), Towards Artificial General Intelligence (0822), Qualitative Research, Economics of Education, Statistics and Regression, Applications of Structural Equation Modeling, Artificial Intelligence in Education, Social Psychology, sociology of education, Causal Inference, Educational Policy Analysis, Educational Psychology.

Mục lục Project Intro A, đã mở bằng URL giới thiệu khóa:

| Mục | Trạng thái trên trang |
| --- | --- |
| Course Learning and Platform Guide | `已学完` |
| Submit your final project here | `未提交` |
| Share Your Learning Experience with AI (Optional) | `未提交` |
| Share Your Daily Reflection Records (Optional) | `未提交` |
| Share Your Knowledge Sandbox (Optional) | `未提交` |

Khóa 100% vẫn có bài `未提交`. `已学习100%` không có nghĩa là bài luận đã nộp.

## 3. Còn lại bao nhiêu

Với 60 module bắt buộc: **không xác định.**

Với 14 khóa: 1 khóa ở `已学完`, 13 khóa chưa tới 100%. Con số 13 không phải số module còn thiếu.

## 4. Điều kiện hoàn thành một module

Chưa quan sát được bên trong player.

Đã thấy trên trang danh sách và trang giới thiệu:

- Tiến độ khóa hiện bằng `已学习N%` và thanh progress.
- Khóa được chuyển xuống nhóm `已学完` khi trang ghi `已学习100%`.
- Chương trong mục lục Project Intro A có nhãn `已学完` hoặc `未提交`.
- Trang giới thiệu khóa không có thẻ `video`, không có `iframe`, không có nút Complete/Finish, không có đồng hồ thời gian học.

Chưa thấy, nên không kết luận:

- Có bắt xem video hay không.
- Có phải xem hết video hay không.
- Có thời gian học tối thiểu hay không.
- Có quiz hoặc bài tập trong module hay không.
- Có nút hoàn thành trong bài học hay không.
- Tiến độ lưu lúc nào.
- Server xác nhận hoàn thành bằng tín hiệu nào ngoài chữ trên trang.

Bấm `去复习` bằng script không rời khỏi `我的学习`. Không bấm tiếp `开始学习` hoặc `继续学习`, vì các nút đó có thể ghi nhận lần học. Chưa có bằng chứng từ player.

## 5. Việc người học phải tự làm

- Đăng nhập Learning Assistant bằng email MAIC. Form đang hỏi `请输入MAIC登录邮箱`, mật khẩu, và checkbox điều khoản. Agent không nhập mật khẩu.
- Sau khi vào được, tự xem Pre-test, Progress và bản đồ module. Tin TA trước đó nói bản đồ 60 module hiện sau pre-test và sau khi chọn scheme. Lần này không mở được các màn đó, nên quy tắc ấy chưa được kiểm lại trên tài khoản.
- Tự học các bài. Chưa thấy bước nào trên website cho phép đánh dấu xong mà không vào bài.

## 6. Playwright có làm được gì

Đã thấy:

- `我的学习` đổi URL thật (`/my_study`) và đọc được tên khóa cùng phần trăm sau khi trang render.
- Thẻ khóa không có `href`. Nút `开始学习`, `继续学习`, `去复习` là `div`.
- Learning Assistant là host khác và không nhận phiên `maic.chat`.

Chưa thấy:

- Playwright có chuyển từ module này sang module kia trong player hay không.
- Trang player có lưu và học tiếp đúng chỗ hay không.
- Hành động nào trong player được tính là hoàn thành.

Có thể tự động phần đọc danh sách khóa và phần trăm. Không có căn cứ để tự động phần làm cho xong module.

## 7. Cách hoàn thành hợp lệ nhanh nhất

Chưa xác định được đường tắt hợp lệ, vì điều kiện trong player chưa hiện.

Đường đang thấy trên `maic.chat` chỉ là mở từng khóa bằng nút `继续学习` hoặc `开始学习` rồi học đến khi trang tự ghi `已学习100%` và `已学完`. Không thấy nút nào đánh dấu xong cả khóa từ `我的学习`. Không thấy cách bỏ qua thời gian học.

Đường tới đúng 60 module, theo việc đã thử hôm nay, bị chặn ở `/login` của Learning Assistant. Chưa được mô tả thành các bước bấm bên trong.

## 8. Chứng chỉ còn gì ngoài 60 module

Trên các trang MAIC đã mở hôm nay không có checklist chứng chỉ.

Các mục sau lấy từ tin TA 袁佳鑫 trong nhóm Lark Cohort B đã đọc trước đó, chưa thấy lại trên trang module hôm nay:

- 60 module bắt buộc.
- 2 questionnaire trước khóa.
- Post-test Survey 1 và Post-test Survey 2.
- Bài thi cuối trong `Assessment` trên Learning Assistant.
- Bài luận cuối.

Quy tắc điểm được một thành viên dán trong nhóm: không có điểm đậu riêng từng bài, tổng điểm từ 60 trở lên và xong mọi nhiệm vụ thì có chứng chỉ điện tử. Đây không phải chữ trên trang `我的学习`.

Bài luận của tài khoản này, ở lần đọc trang nộp trước đó trong cùng phiên làm việc, vẫn `未提交`, và trang có dòng `超出作业提交时间无法提交`. File gắn ở `我的作业` không làm trạng thái thành đã nộp. Lần điều tra này không mở lại trang nộp và không tải file mới.

## 9. Việc làm tiếp

1. Tự đăng nhập `https://learning-feal.maic.chat` trên trình duyệt Cursor.
2. Đọc Pre-test, Progress và bản đồ module, không bấm bắt đầu bài thi.
3. Khi danh sách 60 dòng hiện ra, đếm số đã xong và số còn lại từ chữ trên trang.
4. Mở một module đã học dở, chỉ để xem có video, quiz hay nút hoàn thành, rồi thoát, không tua đến hết và không nộp quiz.
5. Chưa viết bot. Chưa đủ điều kiện hoàn thành để thiết kế cách làm 60 module cho xong.
