// controllers/transactionController.js
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

// @desc    Get transaction history for current user
// @route   GET /api/wallet/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, msg: 'Wallet not found' });
    }

    const transactions = await Transaction.find({ wallet: wallet._id })
      .sort({ createdAt: -1 })
      .lean(); // ✅ faster, removes Mongoose overhead

    res.json({
      success: true,
      transactions
    });
  } catch (err) {
    console.error('Transaction History Error:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};

// @desc    Get single transaction by ID for current user
// @route   GET /api/wallet/transactions/:id
// @access  Private
exports.getTransactionById = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, msg: 'Wallet not found' });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      wallet: wallet._id
    }).lean(); // ✅ improves speed and security

    if (!transaction) {
      return res.status(404).json({ success: false, msg: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction
    });
  } catch (err) {
    console.error('Single Transaction Error:', err);
    res.status(500).json({ success: false, msg: 'Server error' });
  }
};
