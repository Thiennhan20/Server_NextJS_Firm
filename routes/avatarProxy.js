const express = require('express');
const router = express.Router();
const avatarController = require('../controllers/avatarController');

/**
 * Proxy endpoint for external avatars (Google)
 * Caches and optimizes external images
 */
router.get('/proxy', avatarController.proxyAvatar);

/**
 * Clear cache endpoint (for admin/debugging)
 */
router.post('/clear-cache', avatarController.clearCache);

module.exports = router;
