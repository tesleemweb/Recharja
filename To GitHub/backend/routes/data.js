// routes/data.js

const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { buyData, getVariations } = require('../controllers/dataController');

// Fetch bundles
router.get('/variations', auth, getVariations);

// Purchase data
router.post('/purchase', auth, buyData);

module.exports = router;
