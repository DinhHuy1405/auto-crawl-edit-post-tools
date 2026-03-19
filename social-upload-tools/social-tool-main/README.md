# Social Tool

Một bộ công cụ tự động hóa cho các tác vụ mạng xã hội được xây dựng bằng NestJS và Playwright.

## 🚀 Tính năng

Dự án bao gồm 4 công cụ chính:

### 1. Generate Image ChatGPT

Tự động tạo hình ảnh bằng ChatGPT DALL-E thông qua giao diện web.

### 2. Generate Audio AI Studio

Tự động tạo audio từ văn bản sử dụng Google AI Studio với nhiều giọng đọc khác nhau.

### 3. Post TikTok

Tự động đăng video lên TikTok Studio với các tùy chọn cấu hình đầy đủ.

### 4. Post Reels Facebook

Tự động đăng video lên Facebook Reels với khả năng chọn profile và tùy chỉnh mô tả.

## 📋 Yêu cầu hệ thống

- Node.js (v18 trở lên)
- Yarn package manager
- Git

## 🛠️ Cài đặt

1. Clone repository:

```bash
git clone <repository-url>
cd social-tool
```

2. Cài đặt dependencies:

```bash
yarn install
```

3. Build project:

```bash
yarn build
```

## 🎯 Cách sử dụng

### Generate Image ChatGPT

Tạo hình ảnh từ prompt sử dụng ChatGPT DALL-E:

```bash
# Development
yarn command:dev generate-image-chat-gpt src/commands/generate-image-chat-gpt/setting.json

# Production
yarn command generate-image-chat-gpt src/commands/generate-image-chat-gpt/setting.json
```

**Cấu hình setting.json:**

```json
{
  "is_close_browser": true,
  "show_browser": true,
  "delay_between_jobs": 1000,
  "jobs": [
    {
      "prompt": "Tạo cho tôi một bức ảnh của một con chim cánh cụt đang ngậm một cái bánh mì",
      "outputPath": "image.png"
    }
  ]
}
```

### Generate Audio AI Studio

Tạo audio từ văn bản với nhiều giọng đọc:

```bash
# Development
yarn command:dev generate-audio-aistudio src/commands/generate-audio-aistudio/setting.json

# Production
yarn command generate-audio-aistudio src/commands/generate-audio-aistudio/setting.json
```

**Cấu hình setting.json:**

```json
{
  "is_close_browser": true,
  "show_browser": true,
  "delay_between_jobs": 10000,
  "jobs": [
    {
      "style_instruction": "Read aloud in a warm and friendly tone",
      "prompt": "Xin chào, tôi là John Doe, tôi hiện đang ở Hà Nội",
      "voice": "Zephyr",
      "outputPath": "audio.wav"
    }
  ]
}
```

**Danh sách giọng đọc có sẵn:**

- Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe
- Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome
- Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar
- Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix
- Sadachbia, Sadaltager, Sulafat

### Post TikTok

Tự động đăng video lên TikTok Studio:

```bash
# Development
yarn command:dev post-tiktok src/commands/post-tiktok/setting.json

# Production
yarn command post-tiktok src/commands/post-tiktok/setting.json
```

**Cấu hình setting.json:**

```json
{
  "show_browser": true,
  "is_close_browser": false,
  "video_path": "public/video.mp4",
  "description": "This is a test video #test #test2 #test3",
  "audience": "Everyone",
  "is_ai_generated": true,
  "run_copyright_check": true,
  "is_comment_on": true,
  "is_duet_on": false,
  "is_stitch_on": true
}
```

**Tùy chọn Audience:**

- `Everyone`: Mọi người
- `Friends`: Bạn bè
- `OnlyYou`: Chỉ mình bạn

### Post Reels Facebook

Tự động đăng video lên Facebook Reels:

```bash
# Development
yarn command:dev post-reels-facebook src/commands/post-reels-facebook/setting.json

# Production
yarn command post-reels-facebook src/commands/post-reels-facebook/setting.json
```

**Cấu hình setting.json:**

```json
{
  "show_browser": true,
  "is_close_browser": false,
  "page": "Page test",
  "video_path": "public/video.mp4",
  "description": "Hello, world!"
}
```

**Các tham số:**

- `page`: Tên của Facebook Page hoặc Profile để đăng reels
- `video_path`: Đường dẫn đến file video cần đăng
- `description`: Mô tả cho reels

## ⚙️ Cấu hình

### Các tham số chung:

- `show_browser`: Hiển thị trình duyệt (true/false)
- `is_close_browser`: Tự động đóng trình duyệt sau khi hoàn thành (true/false)
- `delay_between_jobs`: Thời gian chờ giữa các tác vụ (milliseconds)

### Lưu ý quan trọng:

1. **Đăng nhập TikTok**: Khi sử dụng tool Post TikTok, bạn cần đăng nhập vào tài khoản TikTok. Đặt `show_browser: true` để có thể đăng nhập thủ công.

2. **Đăng nhập Facebook**: Khi sử dụng tool Post Reels Facebook, bạn cần đăng nhập vào tài khoản Facebook. Đặt `show_browser: true` để có thể đăng nhập thủ công.

3. **Đường dẫn file**: Đảm bảo đường dẫn file video trong setting là chính xác và file tồn tại.

4. **Prompt ChatGPT**: Sử dụng tiếng Việt hoặc tiếng Anh cho prompt tạo hình ảnh.

## 🧪 Scripts

```bash
# Development
yarn start:dev          # Chạy development server
yarn command:dev        # Chạy command trong development mode

# Production
yarn build              # Build project
yarn start:prod         # Chạy production server
yarn command            # Chạy command trong production mode

# Testing
yarn test               # Chạy unit tests
yarn test:e2e           # Chạy end-to-end tests

# Code quality
yarn lint               # Lint code
yarn format             # Format code
```

## 🏗️ Kiến trúc

```
src/
├── commands/                    # Các command chính
│   ├── generate-image-chat-gpt/ # Tool tạo hình ảnh
│   ├── generate-audio-aistudio/ # Tool tạo audio
│   ├── post-tiktok/            # Tool đăng TikTok
│   └── post-reels-facebook/    # Tool đăng Facebook Reels
├── utils/                       # Utilities
│   ├── browser.util.ts         # Browser utilities
│   └── common.util.ts          # Common utilities
├── app.module.ts               # Module chính
└── main.ts                     # Entry point
```

## 🔧 Dependencies

- **NestJS**: Framework backend
- **Playwright**: Browser automation
- **Axios**: HTTP client
- **nest-commander**: CLI framework

## 📝 License

UNLICENSED - Private project

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng tạo issue trên repository hoặc liên hệ trực tiếp.
