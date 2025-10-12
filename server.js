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
app.use(cors({
  origin: [
    'https://moviesaw.vercel.app',
    'http://localhost:3000',
    'https://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} from ${req.get('origin') || req.get('host')}`);
  console.log('Headers:', {
    'content-type': req.get('content-type'),
    'authorization': req.get('authorization') ? 'Present' : 'Missing',
    'origin': req.get('origin'),
    'user-agent': req.get('user-agent')?.substring(0, 50) + '...'
  });
  
  // Log response when it's sent
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 ${req.method} ${req.path} -> ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log('Error response:', data);
    }
    return originalSend.call(this, data);
  };
  
  next();
});

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
    const transporter = nodemailer.createTransport({
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

// Test CORS endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.get('origin'),
    timestamp: new Date().toISOString()
  });
});

// Test registration endpoint
app.post('/api/test-register', (req, res) => {
  console.log('Test registration received:', req.body);
  res.json({
    message: 'Test registration successful',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
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