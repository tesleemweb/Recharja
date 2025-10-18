// routes/promo.js
const express = require('express');
const router = express.Router();
const Promo = require('../models/Promo');

// GET active promo
router.get('/', async (req, res) => {
  try {
    const promo = await Promo.findOne({});
    if (!promo) return res.json({ success: false, promo: null });

    res.json({ success: true, promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch promo' });
  }
});

module.exports = router;
