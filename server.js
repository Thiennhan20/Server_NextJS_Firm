const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://next-js-firm.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Lưu trữ thông tin người dùng đang online
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Xử lý khi người dùng tham gia chat
  socket.on('user_join', (username) => {
    onlineUsers.set(socket.id, username);
    io.emit('user_list', Array.from(onlineUsers.values()));
    io.emit('chat_message', {
      type: 'system',
      content: `${username} đã tham gia phòng chat`,
      timestamp: new Date().toISOString()
    });
  });

  // Xử lý tin nhắn chat
  socket.on('chat_message', (message) => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      io.emit('chat_message', {
        type: 'user',
        username: username,
        content: message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Xử lý khi người dùng gửi hình ảnh
  socket.on('image_message', (imageData) => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      io.emit('chat_message', {
        type: 'image',
        username: username,
        content: imageData,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Xử lý khi người dùng ngắt kết nối
  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    if (username) {
      onlineUsers.delete(socket.id);
      io.emit('user_list', Array.from(onlineUsers.values()));
      io.emit('chat_message', {
        type: 'system',
        content: `${username} đã rời khỏi phòng chat`,
        timestamp: new Date().toISOString()
      });
    }
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('<h1>WebSocket Server is runningccccccccc</h1>');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 