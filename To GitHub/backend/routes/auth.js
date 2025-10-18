const express = require('express');
const router = express.Router();

// ✅ Import controller functions
const { 
  sendOtp, 
  verifyOtp, 
  resendOtp, 
  login, 
  getMe, 
  logout,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword
} = require('../controllers/authController');

// ==========================
// Auth routes
// ==========================

// Signup / OTP
router.post('/send-otp', sendOtp);          // Request OTP for signup
router.post('/verify-otp', verifyOtp);      // Verify OTP & create account
router.post('/resend-otp', resendOtp);      // Resend OTP

// Login / Session
router.post('/login', login);               // Login
router.get('/me', getMe);                   // Get current user info
router.post('/logout', logout);             // Logout

// Password reset (OTP-based)
router.post('/password-reset/request', requestPasswordReset);  // Send reset OTP
router.post('/password-reset/verify', verifyResetOtp);         // Verify reset OTP
router.post('/password-reset/reset', resetPassword);           // Reset password with new password

module.exports = router;
