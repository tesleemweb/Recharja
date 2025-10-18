// routes/admin/users.js

const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const Wallet = require('../../models/Wallet');
const adminAuth = require('../../middleware/admin');

// GET ALL USERS
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    const results = await Promise.all(users.map(async (user) => {
      const wallet = await Wallet.findOne({ user: user._id });
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        isDisabled: user.isDisabled || false,
        balance: wallet?.balance || 0,
      };
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch users' });
  }
});

// ENABLE OR DISABLE USER
router.put('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.isDisabled = !user.isDisabled;
    await user.save();

    res.json({ msg: `User ${user.isDisabled ? 'disabled' : 'enabled'} successfully` });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to toggle user status' });
  }
});

// CREDIT OR DEBIT USER WALLET
router.put('/:id/wallet', adminAuth, async (req, res) => {
  const { amount, type } = req.body; // type: 'credit' or 'debit'
  try {
    const wallet = await Wallet.findOne({ user: req.params.id });
    if (!wallet) return res.status(404).json({ msg: 'Wallet not found' });

    if (type === 'credit') wallet.balance += amount;
    else if (type === 'debit') wallet.balance -= amount;
    else return res.status(400).json({ msg: 'Invalid type' });

    await wallet.save();
    res.json({ msg: `Wallet ${type}ed successfully`, balance: wallet.balance });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update wallet' });
  }
});

module.exports = router;
