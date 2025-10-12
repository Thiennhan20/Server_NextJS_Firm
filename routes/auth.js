const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const BlacklistedToken = require('../models/BlacklistedToken');
const AuthIdentity = require('../models/AuthIdentity');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
        // Gửi lại email xác thực
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = emailVerificationToken;
        await user.save();
        // Gửi email xác thực lại
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
          subject: 'Xác thực lại email tài khoản Movie 3D',
          html: `
            <div style="max-width:480px;width:95vw;margin:32px auto;padding:6vw 4vw 32px 4vw;background:linear-gradient(135deg,#181824 80%,#ffd600 100%);border-radius:24px;box-shadow:0 8px 32px #0005;font-family:'Segoe UI',sans-serif;text-align:center;box-sizing:border-box;">
              <img src='https://cdn-icons-png.flaticon.com/512/616/616490.png' alt='Film Reel' style='height:48px;max-width:80px;width:30vw;margin-bottom:20px;filter:drop-shadow(0 2px 8px #ffd60099);'/>
              <h2 style="color:#ffd600;margin-bottom:12px;font-size:clamp(1.2rem,4vw,2rem);font-weight:800;">Xin chào ${user.name}!</h2>
              <p style="color:#fff;font-size:clamp(1rem,2.5vw,1.2rem);margin-bottom:20px;">Email này đã đăng ký nhưng chưa xác thực.<br>Vui lòng xác thực email bằng cách nhấn vào nút bên dưới:</p>
              <a href="${verifyUrl}" style="display:inline-block;padding:14px 8vw;background:#ffd600;color:#222;font-weight:bold;font-size:clamp(1rem,2.5vw,1.3rem);border-radius:12px;text-decoration:none;margin:20px 0 12px 0;box-shadow:0 4px 16px #ffd60080;letter-spacing:1px;min-width:120px;">Xác thực Email</a>
              <p style="color:#fff;font-size:clamp(0.9rem,2vw,1.1rem);margin-top:20px;word-break:break-all;">Nếu nút không hoạt động, hãy copy link sau và dán vào trình duyệt:<br><span style='color:#ffd600;'>${verifyUrl}</span></p>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        return res.status(200).json({
          message: 'This email has already been registered but not yet verified. A verification email has been resent, please check your inbox.'
        });
        
      }
      return res.status(400).json({ message: 'User already exists' });
    }
    // Sinh token xác thực email
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    user = new User({
      name,
      email,
      password,
      emailVerificationToken,
      isEmailVerified: false
    });
    await user.save();

    // Gửi email xác thực
    // Cấu hình transporter (dùng Gmail demo, nên dùng biến môi trường thực tế)
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
      subject: 'Xác thực email tài khoản Movie 3D',
      html: `
        <div style="max-width:480px;width:95vw;margin:32px auto;padding:6vw 4vw 32px 4vw;background:linear-gradient(135deg,#181824 80%,#ffd600 100%);border-radius:24px;box-shadow:0 8px 32px #0005;font-family:'Segoe UI',sans-serif;text-align:center;box-sizing:border-box;">
          <img src='https://cdn-icons-png.flaticon.com/512/616/616490.png' alt='Film Reel' style='height:48px;max-width:80px;width:30vw;margin-bottom:20px;filter:drop-shadow(0 2px 8px #ffd60099);'/>
          <h2 style="color:#ffd600;margin-bottom:12px;font-size:clamp(1.2rem,4vw,2rem);font-weight:800;">Chào mừng ${name}!</h2>
          <p style="color:#fff;font-size:clamp(1rem,2.5vw,1.2rem);margin-bottom:20px;">Vui lòng xác thực email bằng cách nhấn vào nút bên dưới:</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:14px 8vw;background:#ffd600;color:#222;font-weight:bold;font-size:clamp(1rem,2.5vw,1.3rem);border-radius:12px;text-decoration:none;margin:20px 0 12px 0;box-shadow:0 4px 16px #ffd60080;letter-spacing:1px;min-width:120px;">Xác thực Email</a>
          <p style="color:#fff;font-size:clamp(0.9rem,2vw,1.1rem);margin-top:20px;word-break:break-all;">Nếu nút không hoạt động, hãy copy link sau và dán vào trình duyệt:<br><span style='color:#ffd600;'>${verifyUrl}</span></p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);

    return res.status(201).json({
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
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
      return res.status(403).json({ message: 'Tài khoản chưa xác thực email, vui lòng kiểm tra email để xác thực.' });
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
    
    res.json({
      token,
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

// Google login / link route (server verifies Google ID token)
router.post('/google-login', [
  body('credential').notEmpty().withMessage('Google credential (ID token) is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { credential } = req.body;

    // Verify Google ID token
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: 'Invalid Google token' });

    const email = payload.email;
    const sub = payload.sub;
    const name = payload.name;
    const avatar = payload.picture;
    const email_verified = payload.email_verified;

    // If there's already an identity with this providerUserId, log that user in
    let existingIdentity = await AuthIdentity.findOne({ provider: 'google', providerUserId: sub });
    if (existingIdentity) {
      const user = await User.findById(existingIdentity.userId);
      if (!user) {
        return res.status(400).json({ message: 'Linked user not found' });
      }
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      });
    }

    // No identity yet: try to find by email
    let user = await User.findOne({ email });

    if (!user) {
      // Create a user with a random password to satisfy schema
      const randomPassword = crypto.randomBytes(24).toString('hex');
      user = new User({
        name: name || email,
        email,
        password: randomPassword,
        avatar: avatar || '',
        isEmailVerified: !!email_verified,
        emailVerificationToken: ''
      });
      await user.save();

      await AuthIdentity.create({
        userId: user._id,
        provider: 'google',
        providerUserId: sub
      });

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(201).json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }
      });
    }

    // User exists but no Google identity yet
    const canAutoLink = email_verified === true || email_verified === 'true';
    if (!canAutoLink) {
      return res.status(409).json({
        message: 'Email is not verified by Google. Please verify email or login with password to link accounts.'
      });
    }

    // Ensure we persist updated name/avatar from Google when linking existing account
    if (name && user.name !== name) {
      user.name = name;
    }
    if (avatar && user.avatar !== avatar) {
      user.avatar = avatar;
    }
    await user.save();

    await AuthIdentity.create({
      userId: user._id,
      provider: 'google',
      providerUserId: sub
    });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // Unique index conflict for identity
      return res.status(409).json({ message: 'This Google account is already linked to another user.' });
    }
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
    return res.status(400).json({ message: 'Thiếu token hoặc email' });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
  // Nếu đã xác thực rồi, báo lỗi
  if (user.isEmailVerified) {
    return res.status(400).json({ message: 'Tài khoản đã được xác thực hoặc link đã hết hạn.' });
  }
  // Nếu chưa xác thực, kiểm tra token
  if (user.emailVerificationToken !== token) {
    return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
  user.isEmailVerified = true;
  user.emailVerificationToken = '';
  await user.save();
  return res.json({
    message: 'Xác thực email thành công! Bạn có thể đăng nhập.'
  });
});

// API kiểm tra trạng thái xác thực email
router.get('/check-email-verified', async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: 'Thiếu email' });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy user' });
  }
  return res.json({ isEmailVerified: !!user.isEmailVerified });
});

// ================= WATCHLIST ENDPOINTS =================
// Thêm phim vào watchlist
router.post('/watchlist', auth, async (req, res) => {
  try {
    const { id, title, poster_path } = req.body;
    if (!id || !title || !poster_path) {
      return res.status(400).json({ message: 'Thiếu thông tin phim' });
    }
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Kiểm tra trùng
    if (user.watchlist.some(m => m.id === id)) {
      return res.status(400).json({ message: 'Phim đã có trong watchlist' });
    }
    user.watchlist.push({ id, title, poster_path });
    await user.save();
    res.json({ message: 'Đã thêm vào watchlist', watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Xóa phim khỏi watchlist
router.delete('/watchlist', auth, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'Thiếu id phim' });
    const user = await User.findById(req.user);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.watchlist = user.watchlist.filter(m => m.id !== id);
    await user.save();
    res.json({ message: 'Đã xóa khỏi watchlist', watchlist: user.watchlist });
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

// ================= ADMIN API ENDPOINTS =================
// Lấy tất cả users (cho Django Admin)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password -emailVerificationToken');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Lấy user theo ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -emailVerificationToken');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Cập nhật user theo ID
router.put('/users/:id', async (req, res) => {
  try {
    const { name, email, avatar, isEmailVerified, watchlist } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Cập nhật thông tin
    if (name) user.name = name;
    if (email) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;
    if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;
    if (watchlist !== undefined) user.watchlist = watchlist;
    
    await user.save();
    
    // Trả về user đã cập nhật (không bao gồm password)
    const updatedUser = await User.findById(req.params.id).select('-password -emailVerificationToken');
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Xóa user theo ID
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 