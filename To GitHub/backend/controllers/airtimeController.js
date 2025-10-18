const Airtime = require('../models/airtime');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { sendAirtimeToAPI } = require('../services/providerClient');
const { notifyNewPending } = require('../cronJobs/autoRequery');
const FrequentNumber = require('../models/FrequentNumber');
const User = require('../models/User');

// <== Helper to track frequent numbers
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

exports.buyAirtime = async (req, res) => {
  const { network, phone, amount } = req.body;

  try {
    if (!network || !phone || !amount || isNaN(amount) || amount < 50) {
      return res.status(400).json({
        message: 'Invalid input. Provide valid network, phone, and amount ≥ ₦50.'
      });
    }

    const userId = req.user._id;
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    if (wallet.balance < amount) return res.status(400).json({ message: 'Insufficient wallet balance' });

    const reference = `airtime-${Date.now()}`;
    const oldBalance = wallet.balance;

    const transaction = await Transaction.create({
      wallet: wallet._id,
      user: userId,
      type: 'debit',
      amount,
      phone,
      service: 'airtime',
      status: 'pending',
      reference,
      description: `₦${amount} Airtime – ${network}`,
      oldBalance,
      currentBalance: oldBalance
    });

    const apiResult = await sendAirtimeToAPI({ network, phone, amount });

    if (apiResult.success && apiResult.status === 'delivered') {
      wallet.balance -= amount;
      await wallet.save();

      // Update transaction with new balance
      transaction.status = 'success';
      transaction.providerRef = apiResult.ref || null;
      transaction.currentBalance = wallet.balance;
      await transaction.save();

      await Airtime.create({
        user: userId,
        network,
        phone,
        amount,
        status: 'success',
        providerRef: apiResult.ref || null
      });

      // Track frequent number
      await trackFrequentNumber(userId, phone, 'airtime');

      // ✅ Update user's transaction stats
      await User.findByIdAndUpdate(userId, {
        $inc: {
          'stats.transactions': 1,
          'stats.totalSpent': amount
        }
      });

      return res.json({
        success: true,
        message: 'Airtime purchased successfully',
        transaction
      });

    } else if (apiResult.status === 'pending') {
      transaction.status = 'pending';
      transaction.providerRef = apiResult.ref || null;
      transaction.failureReason = 'VTpass returned pending status';
      await transaction.save();

      notifyNewPending();

      return res.status(202).json({
        success: false,
        message: 'Airtime purchase is pending. We’ll requery it automatically shortly.',
        transaction
      });

    } else {
      transaction.status = 'failed';
      transaction.failureReason = apiResult.error || 'Unknown provider error';
      await transaction.save();

      return res.status(502).json({
        success: false,
        message: 'Airtime purchase failed',
        error: apiResult.error || 'Provider error'
      });
    }

  } catch (error) {
    console.error('buyAirtime error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
