// routes/admin/history.js

const express   = require('express');
const router    = express.Router();
const adminAuth = require('../../middleware/admin');
const Airtime   = require('../../models/airtime');
const Data      = require('../../models/DataPurchase');

// GET all airtime purchases
router.get('/airtime', adminAuth, async (req, res) => {
  try {
    const txns = await Airtime.find().populate('user', 'name email');
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch airtime history' });
  }
});

// GET airtime purchases for a specific user
router.get('/airtime/:userId', adminAuth, async (req, res) => {
  try {
    const txns = await Airtime.find({ user: req.params.userId });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch user airtime history' });
  }
});

// GET all data purchases
router.get('/data', adminAuth, async (req, res) => {
  try {
    const txns = await Data.find().populate('user', 'name email');
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch data history' });
  }
});

// GET data purchases for a specific user
router.get('/data/:userId', adminAuth, async (req, res) => {
  try {
    const txns = await Data.find({ user: req.params.userId });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch user data history' });
  }
});


const Transaction = require('../../models/Transaction');
const Wallet = require('../../models/Wallet');
const { requeryVTpassTransaction } = require('../../services/providerClient');

// POST /api/admin/history/requery-airtime
router.post('/requery-airtime', adminAuth, async (req, res) => {
  const { reference } = req.body;
  if (!reference) {
    return res.status(400).json({ message: 'Reference is required' });
  }

  try {
    const txn = await Transaction.findOne({ reference });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });

    const result = await requeryVTpassTransaction(reference);
    const txnStatus = result?.content?.transactions?.status;

    if (txnStatus === 'delivered') {
      txn.status = 'success';
      txn.failureReason = null;
      await txn.save();

      await Airtime.updateOne(
        { providerRef: reference },
        { status: 'success' },
        { upsert: true }
      );

      return res.json({ success: true, message: 'Transaction marked as successful' });

    } else if (txnStatus === 'failed') {
      txn.status = 'failed';
      txn.failureReason = 'Confirmed failed from VTpass';
      await txn.save();

      const wallet = await Wallet.findById(txn.wallet);
      if (wallet) {
        wallet.balance += txn.amount;
        await wallet.save();
      }

      await Airtime.updateOne(
        { providerRef: reference },
        { status: 'failed' },
        { upsert: true }
      );

      return res.json({ success: true, message: 'Transaction marked as failed and refunded' });

    } else {
      return res.json({
        success: false,
        message: 'Transaction is still pending',
        vtpassStatus: txnStatus
      });
    }

  } catch (err) {
    console.error('Manual Requery Error:', err.message || err);
    return res.status(500).json({ message: 'Server error during requery' });
  }
});


module.exports = router;
