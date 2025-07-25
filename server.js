const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const initializeWebSocket = require('./websocket');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://moviesaw.vercel.app',
  'https://www.moviesaw.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Cho phép gửi cookie qua CORS
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie']
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
    // Remove all console.log and console.error lines
}); 