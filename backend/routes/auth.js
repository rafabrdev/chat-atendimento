const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const { auth } = require('../middleware/auth');
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');

const router = express.Router();

// Rotas públicas
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

// Rotas privadas (requerem autenticação)
router.get('/profile', auth, getProfile);
router.patch('/profile', auth, updateProfile);
router.patch('/change-password', auth, changePassword);

module.exports = router;
