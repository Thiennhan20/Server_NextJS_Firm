const User = require('../models/User');

const admin = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user;
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = admin; 