const express = require('express');
const router = express.Router();
const tmdbController = require('../controllers/tmdbController');

// TMDB proxy route
router.get('/', tmdbController.proxyTmdbRequest);

module.exports = router;
