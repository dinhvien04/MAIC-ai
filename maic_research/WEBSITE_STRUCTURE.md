# Cấu trúc website MAIC

Ngày kiểm tra: 2026-10-19. Tài khoản đang đăng nhập trên `maic.chat`: `nguyendinhvien`. Chế độ: chỉ đọc. Không đổi cài đặt, không nộp bài, không bắt đầu bài thi.

## Hai hệ thống tách nhau

| Hệ thống | URL gốc | Đăng nhập trong lần kiểm tra này |
| --- | --- | --- |
| 模课 (MAIC chính) | `https://maic.chat` | Có. Header hiện `nguyendinhvien`. |
| MAIC学生自主学习平台 / Learning Assistant | `https://learning-feal.maic.chat` | Không. Mở `/` bị chuyển tới `/login`. Phiên `maic.chat` không sang được site này. |

Nguồn: điều hướng trực tiếp trong trình duyệt Cursor, 2026-10-19.

## Cây điều hướng đã thấy

```text
模课  https://maic.chat
├── 课程广场          https://maic.chat/          (cùng URL với logo)
├── 我的学习          https://maic.chat/my_study
├── 关于              https://project.maic.chat?ref=https%3A%2F%2Fmaic.chat
├── menu tài khoản    không đổi URL (popover)
│   ├── 个人中心
│   ├── 切换账号
│   └── 退出登录  → hộp thoại 是否确定退出登录？
└── nút nổi Learning Assistant
    └── https://learning-feal.maic.chat/login

课程广场 / Future Learning A
└── thẻ khóa (không có href; click handler)
    └── /course_introduction/{courseId}     đã xác nhận với Project Intro A

course_introduction
├── 课程简介
├── 教学大纲
└── 目录
    └── bài tập
        └── /course/homework/{courseId}/{homeworkId}

Learning Assistant (chưa vào được sau login)
├── /login
├── /privacy
├── /terms
└── /forgot-password
```

Menu `个人中心 / 切换账号 / 退出登录` được thấy khi đăng xuất ngày 2026-10-18. Lần này không mở lại menu đó, để tránh bấm nhầm đăng xuất.

## Trang đã mở

### 1. 课程广场

- URL: `https://maic.chat/`
- Đường vào: link `课程广场` hoặc logo `模课`. Cả hai đều `href="/"`.
- Tiêu đề nhóm đang hiện: `Future Learning A`.
- Việc làm được: xem thẻ khóa, đổi ngôn ngữ `中文`, đổi giao diện sáng/tối, mở menu tài khoản, nhảy sang Learning Assistant.
- Nút đáng chú ý: link nav, nút icon không tên (theme), nút `点击图标跳转 MAIC学生自主学习平台`.
- URL có đổi khi sang trang khác. Trang này là client-rendered. Snapshot ngay sau khi chuyển trang thường trống, nội dung hiện sau khoảng 1–2 giây.
- Không thấy `iframe` hay `video` trên trang này.

14 thẻ, selector tương đối ổn định là `.footer` bên trong khối `.content`. Class dạng `sc-1e0d250-0` là styled-components, hash đổi theo bản build, không nên dùng làm selector chính.

| Khóa | Giảng viên trên thẻ |
| --- | --- |
| Project Intro A | Mr. Yu |
| The Major Schools of Educational Theory | 石中英 (Shi Zhongying) |
| Educational Psychology | Mr. Wei |
| Artificial Intelligence in Education | Jifan Yu |
| Educational Policy Analysis | Chuanyi Wang |
| Economics of Education | Fei Guo |
| sociology of education | 小群老师 |
| Statistics and Regression | 郭菲 |
| Causal Inference | 张羽 |
| Applications of Structural Equation Modeling | 魏军 |
| Qualitative Research | Manli Li |
| Towards Artificial General Intelligence (0822) | Zhiyuan Liu |
| Social Psychology | WANG Fei |
| Data Mining (0822) | 李涓子 |

Thẻ không phải thẻ `<a>`. Bấm chữ tên khóa trên `我的学习` không đổi URL.

### 2. 我的学习

- URL: `https://maic.chat/my_study`
- Đường vào: link `我的学习`, `href="/my_study"`. Link nhận class `menu active`.
- Hai nhóm nhìn thấy: `正在学习` và `已学完`.
- Mỗi khóa có `长期有效`, phần trăm `已学习N%`, và một nút chữ: `继续学习`, `开始学习`, hoặc `去复习`.
- Nút này là `div`, không phải `<button>` trong accessibility tree.
- Trang render động, cùng shell Next.js với trang chủ.

### 3. Giới thiệu khóa — Project Intro A

- URL: `https://maic.chat/course_introduction/6a9a1de0899ece445f038e8d`
- Đường vào: từ `我的学习`, nút `去复习` của khóa đã học xong. Lần này mở thẳng URL đã biết.
- Nhãn: `授课教师：Mr. Yu`, `上架章节：3 章节`, `已加入`.
- Tab/khối: `课程简介` (class `middle`), `教学大纲` (class `outline`), `目录` (`header_top_text`), `收起`.
- Bấm `教学大纲` không đổi URL và không đổi phần chữ của `目录`. Chưa thấy nội dung syllabus riêng.
- Không có `video` hay `iframe` trên trang giới thiệu.
- Chi tiết chương nằm trong `MODULE_ANALYSIS.md`.

### 4. Nộp bài luận

- URL: `https://maic.chat/course/homework/6a9a1de0899ece445f038e8d/6a9f74e81243012c4b178901`
- Tiêu đề: `Project Intro A_Final Project [Compulsory]_Submit your final project here`
- Có ô text `disabled` và `readonly` trong accessibility tree. Không dùng ô đó.
- Chi tiết yêu cầu nằm trong `PAPER_REQUIREMENTS.md`.

### 5. Learning Assistant

- URL sau khi mở gốc: `https://learning-feal.maic.chat/login`
- Title: `MAIC学生自主学习平台导学助手`
- Heading: `智能时代学习范式创新体验项目`, `MAIC 学生自主学习平台`, `清华大学教育学院`
- Form: email `请输入MAIC登录邮箱`, password `请输入密码`, checkbox `我已阅读并同意 《隐私协议》 和 《用户条款》`, nút `登录`, link `忘记密码?`
- Link: `/privacy`, `/terms`, `/forgot-password`
- Nút `EN` để đổi ngôn ngữ.
- Không thấy CAPTCHA, không thấy `iframe`.
- Không đăng nhập. Vì vậy chưa thấy Assessment, Pre-test, Progress, bản đồ 60 module, hay chỗ chọn research task.

### 6. Đăng nhập 模课

Đã thấy ở lần đăng nhập trước, URL `https://maic.chat/signin?redirect=%2F`.

- Heading: `欢迎来到模课`
- Tab: `账号密码登录`, `手机验证码登录`
- Ô: `账号、手机号或邮箱`, `请输入密码`
- Nút: `立即登录`
- Checkbox: `我已阅读并同意 用户协议 和 隐私政策`
- Link: `忘记密码`, đăng ký `没有模课个人账号？点击注册`

Lần kiểm tra này không mở lại trang đăng nhập vì phiên vẫn còn.

## Xác thực

| Site | Cách vào | Phiên lần này |
| --- | --- | --- |
| `maic.chat` | Tài khoản, số điện thoại hoặc email, cộng mật khẩu. Có tab mã OTP điện thoại. | Còn đăng nhập. |
| `learning-feal.maic.chat` | Email đăng nhập MAIC và mật khẩu, phải tick điều khoản. | Tường đăng nhập. Không dùng SSO từ `maic.chat`. |

## Hành vi URL và render

- Đổi URL thật: `/`, `/my_study`, `/course_introduction/{id}`, `/course/homework/{courseId}/{homeworkId}`, và toàn bộ host Learning Assistant.
- Không đổi URL: đổi theme, mở popover tài khoản, bấm `教学大纲` trên trang giới thiệu, bấm tên khóa trên `我的学习`.
- Cả hai site đều render phía client. `maic.chat` có chunk `main-app-*.js` của Next.js App Router và class styled-components (`sc-...`). Không có `#__NEXT_DATA__`.
- Learning Assistant cũng là Next.js (`/_next/static/chunks/`, có `turbopack` và `/_vercel/insights/script.js`).
