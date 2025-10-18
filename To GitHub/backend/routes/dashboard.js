// routes/user/dashboard.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

router.get('/dashboard', auth, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user });

    if (!wallet) {
      return res.status(404).json({ msg: 'Wallet not found' });
    }

    const walletId = wallet._id;

    const transactions = await Transaction.find({ wallet: walletId })
      .sort({ createdAt: -1 })
      .limit(5);

    const totalTransactions = await Transaction.countDocuments({ wallet: walletId });

    const totalAmountAgg = await Transaction.aggregate([
      { $match: { wallet: walletId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const totalAmount = totalAmountAgg[0]?.total || 0;

    res.json({
      walletBalance: wallet.balance,
      totalTransactions,
      totalAmountSpent: totalAmount,
      recentTransactions: transactions.map(tx => {
        const label = tx.type === 'credit'
          ? tx.description || 'Wallet funded'
          : tx.description || 'Payment';

        return {
          type: tx.type,
          amount: tx.amount,
          label
        };
      })
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Failed to load dashboard data' });
  }
});

module.exports = router;
