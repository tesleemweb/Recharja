// routes/admin/adminSettings.js
const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/admin');
const {
  getSettings,
  updateSettings,
  updateAdminAccount
} = require('../../controllers/adminSettingsController');

// System-wide settings
router.get('/settings', adminAuth, getSettings);
router.put('/settings', adminAuth, updateSettings);

// Admin-specific account update (email, password, 2FA)
router.put('/account', adminAuth, updateAdminAccount);

module.exports = router;
