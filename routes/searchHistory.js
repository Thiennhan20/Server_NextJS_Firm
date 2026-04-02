const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const searchHistoryController = require('../controllers/searchHistoryController');

// Get search history for current user
router.get('/', auth, searchHistoryController.getHistory);

// Sync (upsert) search history
router.post('/', auth, searchHistoryController.syncHistory);

// Clear all search history
router.delete('/', auth, searchHistoryController.clearHistory);

module.exports = router;
