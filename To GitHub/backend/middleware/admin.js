//   middleware/admin.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

module.exports = async function (req, res, next) {
  const token = req.cookies.adminToken;

  if (!token) {
    return res.status(401).json({ msg: 'No token, admin access denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin) return res.status(401).json({ msg: 'Invalid admin token' });

    // Attach the full admin object to req.admin for easier access downstream
    req.admin = admin;

    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};
