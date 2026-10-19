# Cơ chế hoàn thành một module

Ngày đọc: 2026-10-19. Module đã mở là module đã hoàn thành **Course Learning and Platform Guide**, trong khóa Project Intro A. Không mở module chưa học. Không bấm `完成`. Không nộp bài. Không sửa tài khoản.

## Module này nằm ở đâu

Trên Learning Assistant, nút xanh `Course Learning and Platform Guide` không mở bài. Bấm nút đó không đổi trang.

Bài mở từ `maic.chat`, sau khi bấm `去复习` của Project Intro A rồi bấm dòng bài có dấu đã học và chữ `已学完`.

URL phòng học, đã bỏ query:

`https://maic.chat/classroom/6a9a1de0899ece445f038e8d/6a9f6c6437cca4ad58d8db1c/6aa00abe670b264e2e6df077`

Thanh tiêu đề: `Project Intro A / Course Learning and Platform Guide / Course Learning and Platform Guide`.

## A. Một module hoạt động thế nào

Đây là một bài nhiều trang, không phải một file đơn.

Đang đứng ở trang **18/18**. Có nút `上一页`. Không thấy nút `下一页` ở trang cuối.

Nội dung nhìn thấy trên trang cuối:

- Một câu **单选题** đã chấm. Hệ thống ghi `答对啦~`, đáp án đúng là B.
- Một câu **多选题** đã chấm. Hệ thống ghi `不正确哦~`. Đáp án đã chọn là A. Đáp án đúng là A và C.
- Có `查看解析` ở cả hai câu.
- Có khung **AI Teacher**, thời điểm `2026-09-19 23:05:49`, giải thích vì sao câu nhiều lựa chọn chưa đủ.
- Dòng `内容由 AI 生成，请仔细甄别`.

Các lớp khác trên cùng màn hình:

- Nhiều khung nhúng `a2mpage`, đây là các trang slide. Trang cha không có thẻ `video`.
- Không thấy chữ `视频`, `PDF`, hay thời lượng phút trên trang cha.
- Có mục `分页讲稿`. Mở ra thì thấy lời giảng theo trang, đánh dấu `P1页` đến `P16页`.
- Có nhãn `勾选后，音频播放完毕将自动翻页`. Trang có audio. Chưa bật ô đó. Không có thẻ `audio` trên trang cha, nên file âm thanh có thể nằm trong khung slide.
- Có nút `自动`, `AI对话`, `课程列表`, `教师点评`, `高级设置`.
- Có nút `完成`. Nút không mang thuộc tính disabled. Không bấm nút này.

`分页讲稿` mô tả bài giảng là slide có lời nói, gồm cách đăng nhập MAIC, cài đặt thảo luận và giọng đọc, Learning Assistant, hệ thống đánh giá, chọn đề tài, rồi phần tùy chọn không tính điểm. Trang 18 là phần câu hỏi, không nằm trong các mốc `P1`–`P16`.

Module này đã `已学完` dù câu nhiều lựa chọn bị chấm sai. Điểm câu hỏi đúng hết không phải điều kiện để module này được ghi đã xong.

## B. MAIC xác nhận Completed thế nào

Đã thấy hai chỗ ghi nhận:

- Trong phòng học, bài đang ở trang cuối, câu hỏi đã có đáp án lưu, và có nút `完成`.
- Ngoài phòng học, dòng bài ghi `已学完`. Learning Assistant tính Project Intro A là `1/1` và toàn khóa là `1/10`.

Chưa thấy chữ nào nói server đánh dấu xong ngay khi mở trang cuối, khi audio chạy hết, hay chỉ khi bấm `完成`. Nút `完成` có trên trang đã học xong, nên không kết luận được là nút đó đã được bấm trước đây hay chỉ là nút để thoát.

Câu nhiều lựa chọn sai nhưng module vẫn `已学完`. Quan sát này chỉ đúng với module đã mở.

The Major Schools of Educational Theory trên `maic.chat` là `已学习5%`, còn trên Learning Assistant là `0/1`. Phần trăm dở của cả khóa không được tính là một module hoàn thành.

## C. Thao tác đọc và chuyển trang có thể tự động hóa

Playwright làm được các việc đã thử, vì chúng chỉ đọc hoặc chuyển trong bài đã xong:

- Mở `我的学习`, bấm `去复习` của khóa đã `已学习100%`.
- Bấm dòng bài có `已学完` để vào phòng học.
- Đọc `分页讲稿`.
- Thấy số trang `18/18`, nút `上一页`, và nút `完成`.

Chưa bấm `上一页`, nên chưa chứng minh bot lật được toàn bộ 18 trang. Chưa bật `自动`.

Không coi việc tự trả lời câu hỏi hoặc tự bấm `完成` ở module chưa học là thao tác đọc hợp lệ. Những việc đó ghi vào hồ sơ học.

## D. Việc người học phải làm

Với module đã xong, không còn việc bắt buộc trên màn hình này.

Với một module chưa học, trang này không mở ra để xem. Chưa có bằng chứng rằng mọi module đều là 18 trang slide cộng câu hỏi. Người học vẫn là người mở bài, nghe hoặc đọc, và trả lời nếu bài có câu hỏi.

Chat `AI对话` có trên phòng học. Không thấy chữ nào nói gửi chat là điều kiện để được `已学完`.

## E. Chưa xác minh

- Bấm `完成` có phải bước bắt buộc hay không.
- Audio có bắt buộc nghe hết mới sang trang hay không. Chỉ thấy tùy chọn tự sang trang khi audio hết.
- Có video trong khung slide hay không. Trang cha không có thẻ `video`.
- Module chưa học có cùng cấu trúc câu hỏi và nút `完成` hay không.
- Trả lời sai có chặn module khác hay không. Chỉ thấy module này vẫn `已学完` sau một câu sai.
- 50 module tự chọn có đang bị khóa trên tài khoản này hay không. Dashboard vẫn chỉ liệt kê 10 module.

## F. Agent hỗ trợ học hợp lệ

Agent có thể đọc `分页讲稿`, tóm tắt từng trang, và nhắc người học đang ở trang nào. Agent không nên tự chọn đáp án hoặc bấm `完成` thay người học.

Muốn biết module chưa học có đúng cấu trúc này không, cần mở một module trong chín module còn lại. Việc đó có thể ghi nhận tiến độ. Chưa mở. Cần xác nhận trước khi mở.

## Hoàn thành 10 module có mở thêm module không

Dashboard vẫn ghi `已完成 1 / 共 10 个模块`. Pre-test vẫn khóa với câu `学完全部必修模块后即可开始前测`. Đề tài vẫn `暂无课题（未解锁）`. Trang `测评系统` ghi pre-test chưa mở, và đề tài được chọn trong lúc làm pre-test.

Không có danh sách module thứ 11 đến thứ 60 trên dashboard.

Trong `分页讲稿` của chính module này, trang `P13页` nói sau khi chọn đề tài thì việc lớn tiếp theo là hoàn thành **50 elective modules**, chọn từ các khóa trên nền tảng, rồi dùng phần đã học để làm đề tài. Cùng trang nói Final Exam chỉ một lần làm, mở từ 24/09, hạn 4/10. Trang `P14页` nói bài luận 30 điểm, hạn 4/10, dài 5.000–8.000 chữ Trung hoặc 4.000–6.000 từ Anh.

Đó là lời trong bài giảng đã học, không phải danh sách đang mở trên tài khoản. Các mốc ngày trong bài giảng lệch với thông báo sau này của TA. Dashboard hiện tại không hiện 50 module tự chọn, nên chưa kết luận rằng học xong 10 module sẽ tự mở 50 module còn lại.
