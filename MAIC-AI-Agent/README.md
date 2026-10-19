# MAIC AI Learning Agent

Công cụ đọc bài trên MAIC và ghi chú. Chạy trên Ubuntu 22.04.

Agent không tự trả lời câu hỏi, không bấm `完成`, không tự lật hết slide để kéo phần trăm, và không ghi một module là đã học chỉ vì đã mở trang.

## Đã quan sát trên site

- Khóa nằm ở `https://maic.chat/my_study`. Tiến độ khóa là chữ `已学习N%`.
- `继续学习` mở trang giới thiệu khóa, chưa vào phòng học. Bấm đúng tên chương mới vào `/classroom/...`.
- Phòng học hiện `1/31`. Nút sang trang là `下一页` và `上一页`. Lời giảng trang hiện tại nằm ở `分页讲稿`.
- Trang có `单选题` hoặc `多选题` là chỗ người học tự làm.
- Nút `完成` thấy ở trang cuối của module đã học xong. Agent không bấm.
- Learning Assistant ở `https://learning-feal.maic.chat/dashboard` đếm module chính thức, ví dụ `已完成 1 / 共 10 个模块`. Số này phải quét lại, không hard-code.
- Lật một trang đã làm `maic.chat` tăng phần trăm chương, trong khi Learning Assistant vẫn để `0/1` cho đến khi module được ghi `已学完`.

## Cài

```bash
chmod +x setup.sh run.sh
./setup.sh
```

`setup.sh` tạo `.venv`, cài `requirements.txt`, rồi tải Chromium. Nếu thiếu thư viện hệ thống:

```bash
source .venv/bin/activate
sudo python -m playwright install-deps chromium
```

Sao chép `.env.example` thành `.env` nếu muốn ghi chú bằng API. Không có `MAIC_LLM_API_KEY` thì ghi chú vẫn được tạo bằng cách trích đoạn giảng.

## Chạy

```bash
./run.sh
```

Hoặc dòng lệnh, sau `source .venv/bin/activate`:

```bash
python main.py scan-courses
python main.py scan-progress
python main.py study --module "Introduction" --url "https://maic.chat/classroom/..."
python main.py next --module "Introduction"
python main.py prev --module "Introduction"
```

Cửa sổ Chromium dùng profile trong `data/browser-profile/`. Lần đầu tự đăng nhập trên cửa sổ đó. Agent không điền mật khẩu và không in cookie hay token. Thư mục `data/` không đưa vào git.

Trong phòng học, phím mũi tên trái và phải gọi `上一页` và `下一页`, trừ khi trang đang có câu hỏi hoặc nút `完成`.

## Ba lớp trạng thái

- AI đã đọc: đã lưu ghi chú của một trang.
- Người học đã xem ghi chú: bấm `Học tiếp` trên dashboard. Đây không phải `已学完`.
- Chính thức: chỉ đổi khi trang MAIC hoặc Learning Assistant hiện trạng thái hoàn thành lúc quét.

## Kiểm thử

```bash
source .venv/bin/activate
pytest
```

Test dùng văn bản mẫu và trang giả. Không mở tài khoản MAIC và không đổi tiến độ thật.

Chưa kiểm thử được lúc có phiên đăng nhập: quét `我的学习`, quét dashboard, mở phòng học, và phím mũi tên trên Chromium. Các phần đó cần tự đăng nhập.
