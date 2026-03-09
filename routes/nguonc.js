const express = require('express');
const router = express.Router();
const nguoncController = require('../controllers/nguoncController');

// Search TV Show
router.get('/search-tv', nguoncController.searchTVShow);

// Search Movie
router.get('/search-movie', nguoncController.searchMovie);

module.exports = router;
