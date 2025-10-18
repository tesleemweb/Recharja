const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies.userToken;
    if (!token) {
      return res.status(401).json({ msg: 'No token, access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Fetch user email as well as ID
    const user = await User.findById(decoded.id).select('_id email isDisabled');

    if (!user) {
      return res.status(401).json({ msg: 'Invalid token' });
    }

    if (user.isDisabled) {
      return res.status(403).json({ msg: 'Account disabled. Please contact support.' });
    }

    // Attach both id and email
    req.user = { _id: user._id.toString(), email: user.email };
    next();
  } catch (err) {
    console.error('JWT Auth Error:', err.message);
    return res.status(401).json({ msg: 'Token is not valid' });
  }
};
