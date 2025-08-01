# Streaming Server

Server WebSocket cho tính năng chat và livestream.

## Cài đặt

1. Cài đặt các dependencies:
```bash
npm install
```

2. Tạo file `.env` trong thư mục gốc với nội dung:
```
PORT=3001
```

## Chạy server

Để chạy server ở chế độ development (với nodemon):
```bash
npm run dev
```

Để chạy server ở chế độ production:
```bash
npm start
```

Server sẽ chạy trên port 3001 (hoặc port được cấu hình trong file .env).

## API Endpoints

Server sử dụng WebSocket với các events sau:

### Client -> Server
- `user_join`: Khi người dùng tham gia chat (gửi username)
- `chat_message`: Gửi tin nhắn chat
- `image_message`: Gửi hình ảnh

### Server -> Client
- `chat_message`: Nhận tin nhắn chat (bao gồm tin nhắn hệ thống)
- `user_list`: Danh sách người dùng đang online

## Cấu trúc tin nhắn

### Tin nhắn chat thông thường
```javascript
{
  type: 'user',
  username: 'username',
  content: 'message content',
  timestamp: '2024-01-01T00:00:00.000Z'
}
```

### Tin nhắn hệ thống
```javascript
{
  type: 'system',
  content: 'system message',
  timestamp: '2024-01-01T00:00:00.000Z'
}
```

### Tin nhắn hình ảnh
```javascript
{
  type: 'image',
  username: 'username',
  content: 'image data',
  timestamp: '2024-01-01T00:00:00.000Z'
}
``` #   S e r v e r _ N e x t J S _ F i r m 
 
 