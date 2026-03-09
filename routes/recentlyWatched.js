const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const recentlyWatchedController = require('../controllers/recentlyWatchedController');

// Get list for current user (most recent first, limited)
router.get('/', auth, recentlyWatchedController.getList);

// Upsert progress
router.post('/', auth, recentlyWatchedController.upsertProgress);

// Delete an item
router.delete('/', auth, recentlyWatchedController.deleteItem);

// Batch delete (bulkWrite) for better performance
router.post('/batch-delete', auth, recentlyWatchedController.batchDelete);

module.exports = router;
