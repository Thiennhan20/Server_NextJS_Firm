const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const BlacklistedToken = require('../models/BlacklistedToken');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');

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
  rateLimitMiddleware,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  validateRequest
], async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Tạo token xác thực email
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    user = new User({
      name,
      email,
      password,
      isEmailVerified: false,
      emailVerificationToken
    });

    await user.save();

    // Gửi email xác thực (giả lập)
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${emailVerificationToken}&email=${encodeURIComponent(email)}`;
    // --- CHÚ Ý: ĐÂY LÀ CHỖ GỬI EMAIL XÁC THỰC ---
    // Để gửi email xác thực thực tế, hãy tích hợp thư viện gửi mail như nodemailer, sendgrid, mailgun...
    // Ví dụ với nodemailer:
    //   const sendEmail = require('../utils/sendEmail');
    //   await sendEmail(
    //     email,
    //     'Xác thực tài khoản Movie 3D',
    //     `<p>Chào ${name},</p><p>Vui lòng xác thực tài khoản bằng cách nhấn vào link sau:</p><a href="${verifyUrl}">${verifyUrl}</a>`
    //   );
    // Hiện tại chỉ log ra console để test:
    console.log(`Gửi email xác thực tới ${email}: ${verifyUrl}`);

    res.status(201).json({
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', [
  rateLimitMiddleware,
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').exists().withMessage('Password is required'),
  validateRequest
], async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Kiểm tra xác thực email
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Bạn cần xác thực email trước khi đăng nhập.' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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

    const expiresAt = new Date(decoded.exp * 1000); // Chuyển đổi timestamp Unix sang Date object

    const blacklistedToken = new BlacklistedToken({
      token,
      expiresAt,
    });

    await blacklistedToken.save();

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
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

// Xác thực email
router.get('/verify-email', async (req, res) => {
  const { token, email } = req.query;
  if (!token || !email) {
    return res.status(400).send('Thiếu token hoặc email');
  }
  const user = await User.findOne({ email, emailVerificationToken: token });
  if (!user) {
    return res.status(400).send('Token không hợp lệ hoặc đã hết hạn');
  }
  user.isEmailVerified = true;
  user.emailVerificationToken = '';
  await user.save();
  res.send('Xác thực email thành công! Bạn có thể đăng nhập.');
});

module.exports = router; 