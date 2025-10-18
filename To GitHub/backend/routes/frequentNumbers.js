const express = require('express');
const router = express.Router();
const FrequentNumber = require('../models/FrequentNumber');
const auth = require('../middleware/auth'); // your auth middleware

router.get('/', auth, async (req, res) => {
  const userId = req.user._id;
  const { type } = req.query;

  if (!type || !['data', 'airtime'].includes(type)) {
    return res.status(400).json({ status: 'error', message: "Invalid type. Must be 'data' or 'airtime'." });
  }

  try {
    const numbers = await FrequentNumber.find({ userId, type })
      .sort({ count: -1 })
      .limit(10);

    res.json({ status: 'success', type, frequentNumbers: numbers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

module.exports = router;
