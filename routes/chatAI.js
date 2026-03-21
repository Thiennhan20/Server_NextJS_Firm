const express = require('express');
const router = express.Router();
const chatAIController = require('../controllers/chatAIController');

router.post('/chat', chatAIController.generateResponse);

module.exports = router;
