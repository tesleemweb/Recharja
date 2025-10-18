//routes/wallet.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getWallet,
  fundWallet,
  verifyPayment,
  verifyPaymentRedirect
} = require('../controllers/walletController');
const {
  getTransactions,
  getTransactionById
} = require('../controllers/transactionController');

// ✅ Public redirect handler for Paystack callback (must be before auth middleware)
router.get('/verify-payment', verifyPaymentRedirect);

// 🔒 Protected routes (auth applies below this line only)
router.use(auth);

// GET   /api/wallet                       → current user's wallet
router.get('/', getWallet);

// POST  /api/wallet/fund                  → initiate funding via Paystack
router.post('/fund', fundWallet);

// GET   /api/wallet/verify/:reference     → verify Paystack (private)
router.get('/verify/:reference', verifyPayment);

// Transaction history
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransactionById);

module.exports = router;
