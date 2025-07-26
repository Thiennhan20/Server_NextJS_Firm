const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/BlacklistedToken');

const auth = async (req, res, next) => {
  try {
    // Try to get token from cookie first
    let token = req.cookies && req.cookies.token;
    
    // If no cookie token, try Authorization header (for Safari)
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({ message: 'No authentication token found' });
    }

    // Check if token exists in blacklist
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token has been invalidated' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(decoded.userId);
    if (!user || !user.tokens || !user.tokens.includes(token)) {
      return res.status(401).json({ message: 'Token is not valid for this user (possibly logged out from another device).' });
    }
    req.user = decoded; // Attach full decoded info (including userId) to request
    req.token = token; // Attach token to request (for logout later)
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

module.exports = auth; 