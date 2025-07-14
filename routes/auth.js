const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const BlacklistedToken = require('../models/BlacklistedToken');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const admin = require('../middleware/admin');

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Rate limiter: 5 requests per 10 minutes per IP
const rateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 600, // 10 minutes
});

const rateLimitMiddleware = (req, res, next) => {
  rateLimiter.consume(req.ip)
    .then(() => next())
    .catch(() => {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    });
};

// Register route
router.post('/register', [
  body('name').notEmpty().withMessage('Please enter your name'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      if (!user.isEmailVerified) {
        // Resend verification email
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = emailVerificationToken;
        await user.save();
        // Send verification email again
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Resend Email Verification for Movie 3D Account',
          html: `
            <div style="max-width:480px;width:95vw;margin:32px auto;padding:6vw 4vw 32px 4vw;background:linear-gradient(135deg,#181824 80%,#ffd600 100%);border-radius:24px;box-shadow:0 8px 32px #0005;font-family:'Segoe UI',sans-serif;text-align:center;box-sizing:border-box;">
              <img src='https://cdn-icons-png.flaticon.com/512/616/616490.png' alt='Film Reel' style='height:48px;max-width:80px;width:30vw;margin-bottom:20px;filter:drop-shadow(0 2px 8px #ffd60099);'/>
              <h2 style="color:#ffd600;margin-bottom:12px;font-size:clamp(1.2rem,4vw,2rem);font-weight:800;">Hello ${user.name}!</h2>
              <p style="color:#fff;font-size:clamp(1rem,2.5vw,1.2rem);margin-bottom:20px;">This email has been registered but not yet verified.<br>Please verify your email by clicking the button below:</p>
              <a href="${verifyUrl}" style="display:inline-block;padding:14px 8vw;background:#ffd600;color:#222;font-weight:bold;font-size:clamp(1rem,2.5vw,1.3rem);border-radius:12px;text-decoration:none;margin:20px 0 12px 0;box-shadow:0 4px 16px #ffd60080;letter-spacing:1px;min-width:120px;">Verify Email</a>
              <p style="color:#fff;font-size:clamp(0.9rem,2vw,1.1rem);margin-top:20px;word-break:break-all;">If the button does not work, please copy the following link and paste it into your browser:<br><span style='color:#ffd600;'>${verifyUrl}</span></p>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'This email is already registered but not yet verified. A new verification email has been sent, please check your inbox.' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }
    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    user = new User({
      name,
      email,
      password,
      emailVerificationToken,
      isEmailVerified: false
    });
    await user.save();

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your Movie 3D Account Email',
      html: `
        <div style="max-width:480px;width:95vw;margin:32px auto;padding:6vw 4vw 32px 4vw;background:linear-gradient(135deg,#181824 80%,#ffd600 100%);border-radius:24px;box-shadow:0 8px 32px #0005;font-family:'Segoe UI',sans-serif;text-align:center;box-sizing:border-box;">
          <img src='https://cdn-icons-png.flaticon.com/512/616/616490.png' alt='Film Reel' style='height:48px;max-width:80px;width:30vw;margin-bottom:20px;filter:drop-shadow(0 2px 8px #ffd60099);'/>
          <h2 style="color:#ffd600;margin-bottom:12px;font-size:clamp(1.2rem,4vw,2rem);font-weight:800;">Welcome ${name}!</h2>
          <p style="color:#fff;font-size:clamp(1rem,2.5vw,1.2rem);margin-bottom:20px;">Please verify your email by clicking the button below:</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 8vw;background:#ffd600;color:#222;font-weight:bold;font-size:clamp(1rem,2.5vw,1.3rem);border-radius:12px;text-decoration:none;margin:20px 0 12px 0;box-shadow:0 4px 16px #ffd60080;letter-spacing:1px;min-width:120px;">Verify Email</a>
          <p style="color:#fff;font-size:clamp(0.9rem,2vw,1.1rem);margin-top:20px;word-break:break-all;">If the button does not work, please copy the following link and paste it into your browser:<br><span style='color:#ffd600;'>${verifyUrl}</span></p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);

    // Register and log in (generate token, save to tokens)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    if (!user.tokens) user.tokens = [];
    if (user.tokens.length >= 2) {
      user.tokens.shift();
    }
    user.tokens.push(token);
    await user.save();
    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to false for local HTTP
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    return res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').exists().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Your account has not been email verified. Please check your email to verify.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Quản lý mảng tokens: tối đa 2 token
    if (!user.tokens) user.tokens = [];
    if (user.tokens.length >= 2) {
      user.tokens.shift(); // Xóa token cũ nhất (FIFO)
    }
    user.tokens.push(token);
    await user.save();
    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Để false khi chạy local HTTP
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout route
router.post('/logout', auth, async (req, res) => {
  try {
    const token = req.token; // Token được đính kèm vào req bởi middleware auth
    const decoded = jwt.decode(token); // Giải mã token để lấy thông tin expiresAt

    if (!decoded || !decoded.exp) {
      return res.status(400).json({ message: 'Invalid token provided' });
    }

    // Xóa token khỏi mảng tokens của user
    const user = await User.findById(req.user);
    if (user && user.tokens) {
      user.tokens = user.tokens.filter(t => t !== token);
      await user.save();
    }

    const expiresAt = new Date(decoded.exp * 1000); // Chuyển đổi timestamp Unix sang Date object

    const blacklistedToken = new BlacklistedToken({
      token,
      expiresAt,
    });

    await blacklistedToken.save();

    res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: false });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected route example
router.get('/profile', auth, async (req, res) => {
  try {
    // req.user chứa userId từ token đã được middleware auth đính kèm
    const user = await User.findById(req.user).select('-password'); // Không trả về mật khẩu
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Profile access error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Email verification
router.get('/verify-email', async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) {
    return res.status(400).json({ message: 'Missing token or email' });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
  // If already verified, error
  if (user.isEmailVerified) {
    return res.status(400).json({ message: 'Account already verified or link expired.' });
  }
  // If not verified, check token
  if (user.emailVerificationToken !== token) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
  user.isEmailVerified = true;
  user.emailVerificationToken = '';
  await user.save();
  return res.json({
    message: 'Email verification successful! You can now log in.'
  });
});

// API check email verified status
router.get('/check-email-verified', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: 'Missing email' });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ isEmailVerified: !!user.isEmailVerified });
});

// ================= WATCHLIST ENDPOINTS =================
// Add to watchlist
router.post('/watchlist', auth, async (req, res) => {
  try {
    const { id, title, poster_path } = req.body;
    if (!id || !title || !poster_path) {
      return res.status(400).json({ message: 'Missing movie information' });
    }
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Check duplicate
    if (user.watchlist.some(m => m.id === id)) {
      return res.status(400).json({ message: 'Movie already in watchlist' });
    }
    user.watchlist.push({ id, title, poster_path });
    await user.save();
    res.json({ message: 'Added to watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove from watchlist
router.delete('/watchlist', auth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing movie id' });
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.watchlist = user.watchlist.filter(m => m.id !== id);
    await user.save();
    res.json({ message: 'Removed from watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Lấy toàn bộ watchlist của user
router.get('/watchlist', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Route test quyền admin
router.get('/admin-only', auth, admin, (req, res) => {
  res.json({ message: 'You are admin!' });
});

module.exports = router; 