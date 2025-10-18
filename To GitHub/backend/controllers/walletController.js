// controllers/walletController.js
const axios       = require('axios');
const Wallet      = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const PAYSTACK_BASE   = 'https://api.paystack.co';
const BACKEND_URL     = process.env.BACKEND_URL;
const FRONTEND_URL    = process.env.FRONTEND_URL;

/**
 * @desc Get current user's wallet
 * @route GET /api/wallet
 * @access Private
 */
exports.getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user._id, balance: 0 });
    }
    return res.json(wallet);
  } catch (err) {
    console.error('getWallet error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc Initialize Paystack transaction
 * @route POST /api/wallet/fund
 * @access Private
 */
exports.fundWallet = async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 50) {
    return res.status(400).json({ message: 'Minimum funding amount is ₦50' });
  }

  try {
    const userId    = req.user._id;
    const reference = `fund-${uuidv4()}`;

    // Ensure wallet exists
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, balance: 0 });
    }

    // Create pending transaction
    await Transaction.create({
      wallet:      wallet._id,
      user:        userId,
      type:        'credit',
      amount,
      service:     'wallet',
      reference,
      status:      'pending',
      description: `Funding wallet via Paystack (₦${amount})`
    });

    // Initialize Paystack
    const { data } = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        reference,
        amount:       amount * 100,
        email:        req.user.email,
        callback_url: `${BACKEND_URL}/api/wallet/verify-payment`,
        metadata:     { userId }
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    return res.json({ authorization_url: data.data.authorization_url });
  } catch (err) {
    console.error('fundWallet error:', err.response?.data || err.message);
    return res.status(502).json({ message: 'Could not initialize payment' });
  }
};

/**
 * @desc Verify Paystack payment manually
 * @route GET /api/wallet/verify/:reference
 * @access Private
 */
exports.verifyPayment = async (req, res) => {
  const { reference } = req.params;
  const txn = await Transaction.findOne({ reference, service: 'wallet' });
  if (!txn) return res.status(404).json({ message: 'Transaction not found' });

  // ✅ Prevent double funding
  if (txn.status === 'success') {
    const wallet = await Wallet.findById(txn.wallet);
    return res.json({ success: true, balance: wallet.balance, message: 'Already confirmed' });
  }

  try {
    const { data } = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const status = data.data.status?.toLowerCase();

    if (status === 'success') {
      const wallet = await Wallet.findById(txn.wallet);

      // ✅ Confirm not funded already (double check)
      const alreadyFunded = await Transaction.findOne({
        reference,
        status: 'success',
        service: 'wallet'
      });
      if (alreadyFunded) {
        return res.json({ success: true, balance: wallet.balance, message: 'Already funded' });
      }

      txn.status      = 'success';
      txn.description = 'Wallet funded via Paystack (manual verify)';
      await txn.save();

      wallet.balance += txn.amount;
      await wallet.save();

      return res.json({ success: true, balance: wallet.balance });
    }

    if (status === 'failed') {
      txn.status        = 'failed';
      txn.failureReason = 'Paystack marked as failed';
      await txn.save();

      return res.status(400).json({ success: false, message: 'Payment failed' });
    }

    return res.status(202).json({ success: false, message: 'Payment still pending' });
  } catch (err) {
    console.error('verifyPayment error:', err.response?.data || err.message);
    return res.status(502).json({ message: 'Verification error' });
  }
};

/**
 * @desc Handle Paystack redirect to user after payment
 * @route GET /api/wallet/verify-payment
 * @access Public
 */
exports.verifyPaymentRedirect = async (req, res) => {
  const reference = req.query.reference;
  if (!reference) return res.redirect(`${FRONTEND_URL}/fail.html`);

  try {
    const { data } = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );

    const status = data.data.status?.toLowerCase();
    const txn = await Transaction.findOne({ reference, service: 'wallet' });
    if (!txn) return res.redirect(`${FRONTEND_URL}/fail.html`);

    // ✅ Prevent double funding
    if (txn.status === 'success') {
      return res.redirect(`${FRONTEND_URL}/success.html`);
    }

    if (status === 'success') {
      const wallet = await Wallet.findById(txn.wallet);

      txn.status      = 'success';
      txn.description = 'Wallet funded via Paystack';
      await txn.save();

      wallet.balance += txn.amount;
      await wallet.save();

      return res.redirect(`${FRONTEND_URL}/success.html`);
    }

    if (status === 'failed') {
      txn.status        = 'failed';
      txn.failureReason = 'Paystack redirect marked failed';
      await txn.save();
      return res.redirect(`${FRONTEND_URL}/fail.html`);
    }

    return res.redirect(`${FRONTEND_URL}/pending.html`);
  } catch (err) {
    console.error('verifyPaymentRedirect error:', err.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL}/fail.html`);
  }
};
