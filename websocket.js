const { Server } = require('socket.io');

// Lưu trữ thông tin người dùng đang online
const onlineUsers = new Map();

function initializeWebSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ["https://moviesaw.vercel.app", "http://localhost:3000"],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

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

    return io;
}

module.exports = initializeWebSocket; 