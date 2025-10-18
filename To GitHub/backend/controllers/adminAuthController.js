// controllers/adminAuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const logger = require('../utils/logger');
const xss = require('xss');
const config = require('../config/env');

// 🔑 Register Admin
const register = async (req, res) => {
  try {
    // 🧼 Sanitize and validate input
    const username = xss(req.body.username?.trim());
    const email = xss(req.body.email?.toLowerCase().trim());
    const password = xss(req.body.password);

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please fill all fields' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const exists = await Admin.findOne({ username });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Username already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = new Admin({ username, email, password: hashedPassword });
    await admin.save();

    logger.info(`Admin registered: ${username}`);
    res.status(201).json({ success: true, message: 'Admin created successfully' });
  } catch (err) {
    logger.error('POST /register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 🔐 Admin login
const login = async (req, res) => {
  try {
    const username = xss(req.body.username?.trim());
    const password = xss(req.body.password);

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    });

    res.cookie('adminToken', token, config.COOKIE_OPTIONS);

    logger.info(`Admin logged in: ${username}`);

    res.json({
      success: true,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (err) {
    logger.error('POST /login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 👤 Get current admin info
const getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized' });
    res.json({ success: true, admin });
  } catch (err) {
    logger.error('GET /me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 🚪 Logout admin
const logout = (req, res) => {
  try {
    res.clearCookie('adminToken', config.CLEAR_COOKIE_OPTIONS);

    logger.info('Admin logged out');
    res.json({ success: true, message: 'Admin logged out successfully' });
  } catch (err) {
    logger.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 🔒 Change password
const changePassword = async (req, res) => {
  try {
    const newPassword = xss(req.body.newPassword);
    const confirmPassword = xss(req.body.confirmPassword);

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await Admin.findByIdAndUpdate(req.admin._id, { password: hash });

    logger.info(`Admin ${req.admin.username} changed password`);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    logger.error('PATCH /password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  changePassword
};
