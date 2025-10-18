// controllers/authController.js
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Otp = require('../models/Otp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const xss = require('xss');
const logger = require('../utils/logger');
const sendEmail = require('../utils/email');
const Notification = require('../models/Notification');

// ==========================
// 🔹 SEND OTP
// ==========================

const sendOtp = async (req, res) => {
  try {
    const email = xss(req.body.email?.toLowerCase()?.trim());
    const name = xss(req.body.name?.trim());
    const username = xss(req.body.username?.trim());
    const password = xss(req.body.password);

    if (!email || !name || !username || !password)
      return res.status(400).json({ msg: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });

    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username })
    ]);

    if (existingEmail) return res.status(400).json({ msg: 'Email already registered' });
    if (existingUsername) return res.status(400).json({ msg: 'Username already taken' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min

    await Otp.findOneAndUpdate({ email }, { code, expiresAt }, { upsert: true, new: true });

    const emailSent = await sendEmail({
      to: email,
      subject: 'Your Recharja OTP Code',
      html: `
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your OTP code is: <strong>${code}</strong></p>
        <p>This code will expire in 5 minutes.</p>
      `
    });

    if (!emailSent) return res.status(500).json({ msg: 'Failed to send OTP email' });

    logger.info(`OTP sent to ${email}: ${code}`);
    return res.json({ success: true, msg: 'OTP sent successfully' });
  } catch (err) {
    logger.error('sendOtp error:', err);
    return res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
};


// ==========================
// 🔹 VERIFY OTP & CREATE ACCOUNT
// ==========================
const verifyOtp = async (req, res) => {
  try {
    const email = xss(req.body.email?.toLowerCase()?.trim());
    const otp = xss(req.body.otp);
    const name = xss(req.body.name?.trim());
    const username = xss(req.body.username?.trim());
    const password = xss(req.body.password);

    if (!email || !otp || !name || !username || !password)
      return res.status(400).json({ msg: 'All fields are required' });

    if (password.length < 6)
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });

    // Check OTP validity
    const validOtp = await Otp.findOne({ email, code: otp });
    if (!validOtp || validOtp.expiresAt < Date.now())
      return res.status(400).json({ msg: 'Invalid or expired OTP' });

    // Check if user already exists
    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username })
    ]);

    if (existingEmail) return res.status(400).json({ msg: 'Email already registered' });
    if (existingUsername) return res.status(400).json({ msg: 'Username already taken' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
      verified: true
    });
    await newUser.save();

    // Create wallet
    await Wallet.create({ user: newUser._id });


    // -------------------------
    // CREATE WELCOME NOTIFICATION
    // -------------------------
    const welcomeNotif = new Notification({
      title: 'Welcome to Recharja!',
      message: `Hi ${newUser.name || newUser.email}, welcome aboard! Tap "Get Started" to explore our services.`,
      category: 'welcome',
      sub_category: 'welcome',
      forUser: newUser._id, // assign to this specific user
      read: false
    });
    
    await welcomeNotif.save();


    // Delete OTP record
    await Otp.deleteOne({ _id: validOtp._id });

// After creating the newUser and wallet
const token = jwt.sign(
  { id: newUser._id }, 
  process.env.JWT_SECRET, 
  { expiresIn: process.env.JWT_EXPIRE || '3d' }
);

// Set cookie
res.cookie('userToken', token, config.COOKIE_OPTIONS);

logger.info(`New user created: ${email}`);

// Return success with user info
return res.status(201).json({
  success: true,
  message: 'Account verified and created successfully',
  user: {
    id: newUser._id,
    name: newUser.name,
    email: newUser.email
  }
});

  } catch (err) {
    logger.error('verifyOtp error:', err);
    return res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
};


// ==========================
// 🔹 RESEND OTP
// ==========================
const resendOtp = async (req, res) => {
  try {
    const email = xss(req.body.email?.toLowerCase()?.trim());
    if (!email) return res.status(400).json({ msg: 'Email required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'Email already registered' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await Otp.findOneAndUpdate({ email }, { code, expiresAt }, { upsert: true, new: true });

    const emailSent = await sendEmail({
      to: email,
      subject: 'Your Recharja OTP Code',
      html: `<p>Your new OTP code is: <strong>${code}</strong></p><p>This code expires in 5 minutes.</p>`
    });

    if (!emailSent) return res.status(500).json({ msg: 'Failed to resend OTP email' });

    logger.info(`OTP resent to ${email}: ${code}`);
    return res.json({ success: true, msg: 'New OTP sent successfully' });
  } catch (err) {
    logger.error('resendOtp error:', err);
    return res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
};



// ==========================
// 🔹 REQUEST PASSWORD RESET
// ==========================
const requestPasswordReset = async (req, res) => {
  const email = xss(req.body.email?.toLowerCase()?.trim());
  if (!email) return res.status(400).json({ msg: 'Email is required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ msg: 'No account found with this email' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min

  await Otp.findOneAndUpdate(
    { email },
    { $set: { code, expiresAt: new Date(Date.now() + 5 * 60 * 1000), purpose: 'reset' } },
    { upsert: true, new: true }
  );

  const emailSent = await sendEmail({
    to: email,
    subject: 'Password Reset OTP',
    html: `<p>Your password reset code is: <strong>${code}</strong></p><p>Expires in 5 minutes.</p>`
  });

  if (!emailSent) return res.status(500).json({ msg: 'Failed to send OTP' });

  return res.json({ success: true, msg: 'Password reset OTP sent to email' });
};

// ==========================
// 🔹 VERIFY OTP FOR PASSWORD RESET
// ==========================
const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  const validOtp = await Otp.findOne({ email, code: otp, purpose: 'reset' });

  if (!validOtp || validOtp.expiresAt < Date.now())
    return res.status(400).json({ msg: 'Invalid or expired OTP' });

  // Optionally generate a temporary JWT to authorize password change
  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '10m' });
  return res.json({ success: true, token, msg: 'OTP verified. You can now reset your password' });
};

// ==========================
// 🔹 RESET PASSWORD
// ==========================
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ msg: 'Password must be at least 6 characters' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await Otp.deleteOne({ email, purpose: 'reset' }); // cleanup OTP

    return res.json({ success: true, msg: 'Password reset successfully' });
  } catch (err) {
    return res.status(400).json({ msg: 'Invalid or expired token' });
  }
};


// ==========================
// 🔹 LOGIN
// ==========================
const login = async (req, res) => {
  try {
    const emailOrUsername = xss(req.body.emailOrUsername?.trim());
    const password = xss(req.body.password);

    if (!emailOrUsername || !password)
      return res.status(400).json({ msg: 'Email/Username and password are required' });

    const input = emailOrUsername.toLowerCase();
    const user = await User.findOne({ $or: [{ email: input }, { username: input }] });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
    if (user.isDisabled) return res.status(403).json({ msg: 'Account disabled. Contact support.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '3d' });
    res.cookie('userToken', token, config.COOKIE_OPTIONS);

    return res.json({ success: true, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    logger.error('Login error:', err);
    return res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
};

// ==========================
// 🔹 GET CURRENT USER
// ==========================
const getMe = async (req, res) => {
  try {
    const token = req.cookies.userToken;
    if (!token) return res.status(401).json({ success: false, msg: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ success: false, msg: 'Unauthorized' });

    let responseData = {
      id: user._id,
      name: user.name,
      email: user.email,
      stats: user.stats,
      referral: user.referral,
      verified: user.verified
    };

    const page = req.query.page;
    if (page === 'personal-info') {
      responseData = {
        ...responseData,
        username: user.username,
        joinedAt: user.createdAt,
        referralCode: user.referral?.code || '',
        referralBonus: user.referral?.bonus || 0,
        isVerified: user.verified
      };
    }

    return res.json({ success: true, user: responseData });
  } catch (err) {
    logger.error('getMe error:', err);
    return res.status(401).json({ success: false, msg: 'Invalid or expired session' });
  }
};

// ==========================
// 🔹 LOGOUT
// ==========================
const logout = (req, res) => {
  const { COOKIE_OPTIONS } = config;
  const { maxAge, ...clearOptions } = COOKIE_OPTIONS;
  res.clearCookie('userToken', clearOptions);
  return res.json({ success: true, message: 'Logged out successfully' });
};

module.exports = {
  sendOtp,
  verifyOtp,
  resendOtp,
  login,
  getMe,
  logout,
  requestPasswordReset,
  verifyResetOtp,
  resetPassword
};
