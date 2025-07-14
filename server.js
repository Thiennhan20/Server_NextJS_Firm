const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const initializeWebSocket = require('./websocket');
const authRoutes = require('./routes/auth');

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'https://moviesaw.vercel.app'
];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // nếu bạn dùng cookie
}));
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);

// Tạo HTTP server
const server = http.createServer(app);

// Khởi tạo WebSocket
initializeWebSocket(server);

// Route cơ bản để kiểm tra server
app.get('/', (req, res) => {
    res.send('<h1>WebSocket Server is running</h1>');
});

// Lấy trạng thái của server
app.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    // Thực hiện truy vấn đơn giản tới database
    await mongoose.connection.db.admin().ping();
    const dbLatency = Date.now() - start; // ms
    res.status(200).json({
      status: 'OK',
      db: 'connected',
      dbLatency: dbLatency + 'ms'
    });
  } catch (err) {
    const dbLatency = Date.now() - start;
    res.status(500).json({
      status: 'ERROR',
      db: 'disconnected',
      dbLatency: dbLatency + 'ms'
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 