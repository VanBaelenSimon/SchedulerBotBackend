// ./routes/authRoutes.js
const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

router.get('/discord', authController.discordLogin);

router.get('/discord/callback', authController.discordCallback);

router.post('/discord/finalize', authController.discordFinalize);

router.get('/me', authController.discordMe);

router.post('/logout', authController.discordLogout);

module.exports = router;