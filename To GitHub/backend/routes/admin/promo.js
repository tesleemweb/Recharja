// routes/admin/promo.js
const express = require('express');
const router = express.Router();
const Promo = require('../../models/Promo');

// Set/update promo (POST)
router.post('/', async (req, res) => {
  try {
    const { title, text, type } = req.body;
    if (!title || !text || !type) return res.status(400).json({ success: false, message: 'Missing fields' });

    // Replace old promo (for simplicity, only one active promo)
    const promo = await Promo.findOneAndUpdate({}, { title, text, type }, { new: true, upsert: true });

    res.json({ success: true, promo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to save promo' });
  }
});

module.exports = router;
