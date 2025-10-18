// routes/userPricing.js
const express = require('express');
const router = express.Router();
const Pricing = require('../models/Pricing');

// ✅ GET /api/user/pricing?network=mtn
router.get('/pricing', async (req, res) => {
  const { network } = req.query;

  if (!network) {
    return res.status(400).json({ error: 'Network is required' });
  }

  try {
    const plans = await Pricing.find({
      service: 'data',
      network: network.toUpperCase(),
      enabled: true,
      isActive: true
    }).sort({ price: 1 });

    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data plans' });
  }
});

module.exports = router;
