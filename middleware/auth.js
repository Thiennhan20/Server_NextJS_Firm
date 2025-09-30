const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/BlacklistedToken');

const auth = async (req, res, next) => {
  try {
    // Chỉ đọc token từ Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No authentication token found' });
    }
    
    const token = authHeader.substring(7); // Bỏ 'Bearer ' prefix

    // Check if token exists in blacklist
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.userId);
    
    // Kiểm tra user tồn tại
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    req.user = decoded.userId; // Chỉ gán userId để tương thích với code hiện tại
    req.token = token; // Attach token to request (for logout later)
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Please authenticate' });
  }
};

module.exports = auth; 