# Tóm tắt điều tra

Ngày: 2026-10-19. Phạm vi: chỉ đọc `https://maic.chat` với tài khoản `nguyendinhvien`, rồi thử mở Learning Assistant. Không nộp bài, không làm khảo sát, không bắt đầu bài thi, không đổi task, không xuất cookie.

## Việc đã làm được

`maic.chat` và Learning Assistant là hai site. Phiên đang đăng nhập chỉ có hiệu lực trên `maic.chat`. Mở `https://learning-feal.maic.chat/` thì vào `/login`. Form xin email MAIC, mật khẩu, và checkbox điều khoản. Không thấy CAPTCHA trên form đó.

Trên `maic.chat`, nav có `课程广场` (`/`), `我的学习` (`/my_study`), `关于` (sang `project.maic.chat`). Trang chủ nhóm `Future Learning A` có 14 khóa. Trang học của tài khoản có cùng 14 khóa: Project Intro A đã 100%, một khóa 5%, mười hai khóa 0%.

Project Intro A có 3 chương đã lên kệ. Mục lục gồm chương hướng dẫn đã học xong, bài luận bắt buộc còn `未提交`, và ba mục chia sẻ tùy chọn còn `未提交`.

Bài luận nằm tại `/course/homework/6a9a1de0899ece445f038e8d/6a9f74e81243012c4b178901`. Hạn trên trang là 2026-10-18 23:59. Trang báo quá giờ nên không nộp được. File `MAIC_AI_Education_Research_Paper.docx` có trong `我的作业` nhưng trạng thái vẫn `未提交`. Đính kèm đề gồm `Rubric.docx` và `Task 1.docx` đến `Task 6.docx`. Nội dung các file đó chưa được mở.

TA đã trả lời trong nhóm: web đóng, nộp qua Tsinghua Cloud Drive, tên file bằng email đăng ký, trang đầu có tên và email. Hạn không trừ điểm theo thông báo 17/10 là trong ngày 19/10. Tin trả lời sáng 19/10 không nhắc lại hạn đó.

## Năm yêu cầu của chứng chỉ

| Yêu cầu | Kết quả lần này |
| --- | --- |
| 60 module | Chưa thấy trên tài khoản. TA nói chúng hiện sau pre-test trên Learning Assistant. |
| 2 questionnaire trước khóa | Chưa thấy trạng thái. Tên và link chỉ có trong tin nhóm. |
| Post-test 1 và 2 | Chưa thấy trạng thái. |
| Bài thi cuối | Chưa vào được `Assessment`. |
| Bài luận | Chưa nộp. File local trên trang bài không được tính. |

## Playwright

Đọc catalog và trang bài bằng Playwright là khả thi nếu người dùng tự đăng nhập và script chờ nội dung render. Selector nên dựa vào chữ và `a.menu`, không dựa vào class `sc-*`. Chưa thể đọc 60 module, questionnaire hay bài thi cho đến khi có phiên Learning Assistant. Không thiết kế bước xuất cookie hay tự hoàn thành bài.

## Chưa giải quyết

- Số chương và điều kiện hoàn thành bên trong 13 khóa chưa mở.
- Player có video, slide, quiz, thời gian học tối thiểu hay không.
- Task nghiên cứu nào đã được chọn.
- Bốn questionnaire và bài thi cuối của chính tài khoản này.
- File luận đã được tải lên Cloud Drive chưa.
- Nội dung `Rubric.docx` và sáu file task.
- Rate limit hoặc điều khoản cấm automation. UI đã xem không ghi điều này.

## Bước tiếp theo

1. Tự đăng nhập Learning Assistant trong trình duyệt, rồi yêu cầu đọc `Pre-test`, `Progress`, và `Assessment` mà không bấm bắt đầu bài thi.
2. Nếu `Final Exam` đòi bấm bắt đầu mới thấy đề, dừng và chỉ ghi lại câu cảnh báo.
3. Với bài luận, kiểm tra Cloud Drive bằng mắt: tên file đúng email đăng ký, trang đầu có tên và email, trạng thái `Uploaded`.
4. Chưa viết bot. Báo cáo này là đầu vào nếu sau này chỉ làm công cụ theo dõi tiến độ.

## Báo cáo

- [WEBSITE_STRUCTURE.md](WEBSITE_STRUCTURE.md)
- [MODULE_ANALYSIS.md](MODULE_ANALYSIS.md)
- [QUESTIONNAIRE_ANALYSIS.md](QUESTIONNAIRE_ANALYSIS.md)
- [ASSESSMENT_ANALYSIS.md](ASSESSMENT_ANALYSIS.md)
- [PAPER_REQUIREMENTS.md](PAPER_REQUIREMENTS.md)
- [PLAYWRIGHT_FEASIBILITY.md](PLAYWRIGHT_FEASIBILITY.md)
- [AUTOMATION_ARCHITECTURE.md](AUTOMATION_ARCHITECTURE.md)
- [PROGRESS_CHECKLIST.md](PROGRESS_CHECKLIST.md)
