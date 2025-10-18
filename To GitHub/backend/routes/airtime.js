// routes/airtime.js

const express = require('express');
const router = express.Router();
const { buyAirtime } = require('../controllers/airtimeController');
const auth = require('../middleware/auth');

// Securely handle airtime purchase
router.post('/purchase', auth, buyAirtime);

module.exports = router;
