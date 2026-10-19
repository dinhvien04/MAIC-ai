# MAIC Agent V1

Công cụ theo dõi tiến độ cho tài khoản MAIC trên Ubuntu 22.04. Bản này chỉ đọc các trang catalog đã biết, lưu kết quả vào SQLite, và tóm tắt file văn bản có sẵn trên máy.

Agent không học hộ, không bấm `开始学习` / `继续学习` / `去复习`, không nộp questionnaire, không bắt đầu bài thi, và không viết bài luận để nộp.

## Giới hạn kỹ thuật, lấy từ báo cáo trong `maic_research/`

- `maic.chat` và Learning Assistant (`learning-feal.maic.chat`) là hai site. Đăng nhập một site không sang site kia.
- 60 module bắt buộc không nằm trên `我的学习`. Trang đó chỉ có các khóa (đã thấy 14 khóa). Phần trăm khóa không được cộng thành tiến độ 60 module.
- Questionnaire và Final Exam nằm sau sidebar của Learning Assistant. Lần điều tra dừng ở `/login`, nên V1 không bịa trạng thái của chúng.
- Bài luận trên `maic.chat` có thể hiện file trong `我的作业` mà trạng thái vẫn là `未提交`. File gắn sẵn không được tính là đã nộp. Trang còn có thể hiện `超出作业提交时间无法提交`.
- Nút vào bài là `div`, không phải link. Bấm vào đó có thể ghi nhận thời gian học. V1 không bấm.
- Class `sc-...` đổi theo bản build. Parser dùng chữ trên trang: `已学习N%`, `授课教师`, `未提交`.
- Trang render sau khi tải. Chưa biết player bài học có video, iframe hay quiz.
- Không thấy CAPTCHA trên form đã mở. Nếu sau này có CAPTCHA, agent dừng.
- Mật khẩu không được nhập bởi agent và không được ghi vào SQLite. Profile trình duyệt nằm trong `data/browser-profile/`, đã được gitignore.

## Cài trên Ubuntu 22.04

Cần Python 3.10 (bản đi kèm Ubuntu 22.04) và các thư viện hệ thống của Chromium.

```bash
cd /đường/dẫn/tới/project
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
sudo python -m playwright install-deps chromium
```

`install-deps` cần `sudo` vì nó cài thư viện hệ thống. Nếu không có quyền sudo, cài gói mà Playwright in ra khi lệnh Chromium báo thiếu thư viện.

## Chạy

Giao diện:

```bash
source .venv/bin/activate
streamlit run maic_agent/app.py
```

Dòng lệnh:

```bash
python -m maic_agent scan
python -m maic_agent scan --fresh
python -m maic_agent summary duong/dan/ghi-chu.md
```

Lần quét đầu mở cửa sổ Chromium. Tự đăng nhập trên cửa sổ đó nếu thấy trang login. Agent không điền mật khẩu. Cửa sổ chờ tối đa khoảng 3 phút ở `我的学习`, rồi khoảng 30 giây ở Learning Assistant. Profile được giữ lại để lần sau không đăng nhập lại, chừng nào site còn nhận phiên.

`--headless` chỉ dùng khi profile đã đăng nhập. Không có màn hình thì không tự gõ được mật khẩu.

## Dữ liệu

SQLite: `data/maic_agent.sqlite`

Ảnh chụp trang: `data/screenshots/`

Scan bị dừng giữa chừng được đánh dấu `interrupted` hoặc `error`. Lần quét sau tiếp tục các bước chưa có kết quả `ok`, bắt đầu lại từ catalog, không từ giữa một bài thi.

## Kiểm thử không cần tài khoản

```bash
source .venv/bin/activate
pytest
```

Các test dùng văn bản mẫu trong `tests/fixtures/pages.py`. Chúng không mở `maic.chat`.

## Việc V1 cố ý không làm

- Không đánh dấu module đã học.
- Không tua video và không giả thời gian học.
- Không trả lời quiz, questionnaire, bài thi.
- Không chọn research task và không upload bài luận.
- Không xuất cookie hay access token.
