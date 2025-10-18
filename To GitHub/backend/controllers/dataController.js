const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const DataTransaction = require('../models/DataPurchase');
const Pricing = require('../models/Pricing');
const { sendDataToAPI, getDataVariationPrice } = require('../services/providerClient');
const { notifyNewPending } = require('../cronJobs/autoRequery');
const FrequentNumber = require('../models/FrequentNumber');
const User = require('../models/User'); // ✅ Added

// Helper to track frequent numbers
async function trackFrequentNumber(userId, number, type) {
  try {
    const record = await FrequentNumber.findOne({ userId, number, type });
    if (record) {
      record.count += 1;
      await record.save();
    } else {
      await FrequentNumber.create({ userId, number, type, count: 1 });
    }
  } catch (err) {
    console.error('Error tracking frequent number:', err);
  }
}

exports.buyData = async (req, res) => {
  const { phone, network, variation_code } = req.body;
  if (!phone || !network || !variation_code) {
    return res.status(400).json({ message: 'Missing phone, network, or variation_code' });
  }

  try {
    const userId = req.user._id;
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    const plan = await Pricing.findOne({
      network: network.toUpperCase(),
      service: 'data',
      variationCode: variation_code
    });

    if (!plan) return res.status(400).json({ message: 'Invalid plan selected' });

    const amount = plan.price;
    if (wallet.balance < amount) return res.status(400).json({ message: 'Insufficient wallet balance' });

    const request_id = `data-${Date.now()}`;

    // Save old balance
    const oldBalance = wallet.balance;

    // Deduct balance
    wallet.balance -= amount;
    await wallet.save();

    // Create Transaction
    const transaction = await Transaction.create({
      wallet: wallet._id,
      user: userId,
      type: 'debit',
      amount,
      phone,
      service: 'data',
      status: 'pending',
      reference: request_id,
      description: `${plan.displayName || plan.plan} – ₦${amount}`,
      oldBalance,
      currentBalance: wallet.balance
    });

    // Create DataTransaction
    const dataTx = await DataTransaction.create({
      user: userId,
      wallet: wallet._id,
      phone,
      network,
      variationCode: variation_code,
      dataPlan: plan.displayName || plan.plan,
      amount,
      request_id,
      status: 'pending',
      providerRef: null,
      failureReason: null,
      oldBalance,
      currentBalance: wallet.balance
    });

    // Send request to provider
    const apiResult = await sendDataToAPI({ phone, network, variation_code, request_id });

    if (apiResult.success && apiResult.status === 'delivered') {
      transaction.status = 'success';
      transaction.providerRef = apiResult.ref || null;
      transaction.currentBalance = wallet.balance;
      await transaction.save();

      await DataTransaction.updateOne(
        { request_id },
        { status: 'success', providerRef: apiResult.ref || null, failureReason: null, currentBalance: wallet.balance }
      );

      // Track frequent number
      await trackFrequentNumber(userId, phone, 'data');

      // ✅ Update user's transaction stats (only for success)
      await User.findByIdAndUpdate(userId, {
        $inc: {
          'stats.transactions': 1,
          'stats.totalSpent': amount
        }
      });

      return res.json({
        success: true,
        message: 'Data purchased successfully',
        transaction,
        dataTransaction: dataTx
      });

    } else if (apiResult.status === 'pending') {
      transaction.status = 'pending';
      transaction.failureReason = 'VTpass pending';
      transaction.providerRef = apiResult.ref || null;
      await transaction.save();

      await DataTransaction.updateOne(
        { request_id },
        { providerRef: apiResult.ref || null }
      );

      notifyNewPending();
      return res.status(202).json({
        success: false,
        message: 'Data purchase is pending',
        transaction
      });

    } else {
      // Refund wallet on failure
      wallet.balance += amount;
      await wallet.save();

      transaction.status = 'failed';
      transaction.failureReason = apiResult.error || 'Provider error';
      transaction.providerRef = apiResult.ref || null;
      transaction.currentBalance = wallet.balance;
      await transaction.save();

      await DataTransaction.updateOne(
        { request_id },
        { status: 'failed', providerRef: apiResult.ref || null, failureReason: apiResult.error || 'Provider error', currentBalance: wallet.balance }
      );

      return res.status(502).json({
        success: false,
        message: 'Data purchase failed',
        error: apiResult.error || 'Provider error'
      });
    }

  } catch (err) {
    console.error('buyData error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/data/variations?network=...
exports.getVariations = async (req, res) => {
  const { network } = req.query;
  if (!network) return res.status(400).json({ message: 'Missing network query parameter' });

  try {
    const variations = await getDataVariationPrice(network);
    return res.json({ success: true, variations });
  } catch (err) {
    console.error('getVariations error:', err);
    return res.status(500).json({ message: 'Could not fetch variations' });
  }
};
