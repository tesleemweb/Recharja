// routes/admin/auth.js

const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/admin');
const {
  register,
  login,
  getMe,
  logout,
  changePassword
} = require('../../controllers/adminAuthController');

// 🔑 Register Admin
router.post('/register', register);

// 🔐 Login
router.post('/login', login);

// 👤 Get current admin
router.get('/me', adminAuth, getMe);

// 🚪 Logout
router.post('/logout', adminAuth, logout);

// 🔒 Change password
router.patch('/password', adminAuth, changePassword);

module.exports = router;
