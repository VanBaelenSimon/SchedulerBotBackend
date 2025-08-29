// ./routes/authRoutes.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

router.get('/discord', authController.discordLogin);

router.get('/discord/callback', authController.discordCallback);

router.get('/me', authController.discordMe);

router.post('/logout', authController.discordLogout);

module.exports = router;