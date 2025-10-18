// routes/admin/requery.js
const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/admin');
const Transaction = require('../../models/Transaction');
const Airtime = require('../../models/airtime');
const DataPurchase = require('../../models/DataPurchase');
const Wallet = require('../../models/Wallet');
const { requeryVTpassTransaction } = require('../../services/providerClient');

router.post('/requery', adminAuth, async (req, res) => {
  const { reference, service } = req.body;
  // service should be 'airtime' or 'data'
  if (!reference || !['airtime','data'].includes(service)) {
    return res.status(400).json({ message: 'Missing or invalid reference/service' });
  }

  const tx = await Transaction.findOne({ reference });
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });

  try {
    const vtResult = await requeryVTpassTransaction(reference);
    if (vtResult.code !== '000' || !vtResult.content?.transactions?.status) {
      return res.status(502).json({ message: 'No valid VTpass response', vtResult });
    }

    const rawStatus = vtResult.content.transactions.status.toLowerCase();
    const isSuccess = rawStatus === 'delivered';
    const isFailure = rawStatus === 'failed';

    // If still pending, just report back
    if (!isSuccess && !isFailure) {
      return res.status(200).json({
        message: 'Transaction still pending according to VTpass',
        status: rawStatus
      });
    }

    // On confirmed success or failure, update ledger
    tx.status = isSuccess ? 'success' : 'failed';
    tx.failureReason = isFailure ? 'Confirmed failed via admin requery' : null;
    tx.providerRef = vtResult.content.transactions.transactionId || tx.providerRef;
    await tx.save();

    // On failure, refund immediately
    if (isFailure) {
      const wallet = await Wallet.findById(tx.wallet);
      if (wallet) {
        wallet.balance += tx.amount;
        await wallet.save();
      }
    }

    // Update service‑specific record
    const Model = service === 'data' ? DataPurchase : Airtime;
    await Model.updateOne(
      { providerRef: reference },
      {
        status: tx.status,
        failureReason: tx.failureReason
      },
      { upsert: true }
    );

    // Fetch updated service record to return
    const updatedServiceRecord = await Model.findOne({ providerRef: reference });
    return res.json({
      success: true,
      message: `Transaction marked as ${tx.status}`,
      transaction: tx,
      serviceRecord: updatedServiceRecord
    });

  } catch (err) {
    console.error('Admin requery error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
