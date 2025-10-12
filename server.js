const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const initializeWebSocket = require('./websocket');
const authRoutes = require('./routes/auth');
const commentRoutes = require('./routes/comments');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
console.log('Environment check:');
console.log('- MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
console.log('- Email User:', process.env.EMAIL_USER ? 'Set' : 'Not set');
console.log('- Email Pass:', process.env.EMAIL_PASS ? 'Set' : 'Not set');
console.log('- Client URL:', process.env.CLIENT_URL || 'Not set');
console.log('- Node Env:', process.env.NODE_ENV || 'Not set');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    console.error('❌ Please check your MONGODB_URI environment variable');
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Tạo HTTP server
const server = http.createServer(app);

// Khởi tạo WebSocket
initializeWebSocket(server);

// Route cơ bản để kiểm tra server
app.get('/', (req, res) => {
    res.send('<h1>WebSocket Server is running</h1>');
});

// Environment check endpoint
app.get('/api/env-check', (req, res) => {

  const envCheck = {
    mongodb: process.env.MONGODB_URI ? 'Set' : 'Not set',
    emailUser: process.env.EMAIL_USER ? 'Set' : 'Not set',
    emailPass: process.env.EMAIL_PASS ? 'Set' : 'Not set',
    clientUrl: process.env.CLIENT_URL || 'Not set',
    nodeEnv: process.env.NODE_ENV || 'Not set',
    port: process.env.PORT || 'Not set',
    timestamp: new Date().toISOString()
  };
  
  console.log('Environment check requested:', envCheck);
  res.json(envCheck);
});

// Email configuration test endpoint
app.get('/api/test-email-config', (req, res) => {
  const nodemailer = require('nodemailer');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(400).json({
      error: 'Email credentials not configured',
      emailUser: process.env.EMAIL_USER ? 'Set' : 'Not set',
      emailPass: process.env.EMAIL_PASS ? 'Set' : 'Not set'
    });
  }
  
  try {
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    res.json({
      message: 'Email configuration is valid',
      emailUser: process.env.EMAIL_USER,
      emailPass: 'Set',
      transporterCreated: true
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create email transporter',
      message: error.message
    });
  }
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