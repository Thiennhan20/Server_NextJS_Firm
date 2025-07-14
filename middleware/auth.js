const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/BlacklistedToken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token || (req.header('Authorization') && req.header('Authorization').replace('Bearer ', ''));
    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }
    // Check if token exists in blacklist
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    // Check if token exists in user's tokens array
    const user = await User.findById(decoded.userId);
    if (!user || !user.tokens || !user.tokens.includes(token)) {
      return res.status(401).json({ message: 'Token is not valid for this user' });
    }
    req.user = decoded.userId; // Attach user ID to request
    req.token = token; // Attach token to request (for logout later)
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

module.exports = auth; 