// cronJobs/requeryPaystack.js
const cron = require('node-cron');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

// 🔁 Run every 1 minute
cron.schedule('* * * * *', async () => {
  const pendings = await Transaction.find({
    service: 'wallet',
    status: 'pending',
    attempts: { $lt: 5 } // ⏱️ Maximum 5 requery attempts
  });

  if (!pendings.length) return;

  for (const txn of pendings) {
    try {
      // Increment requery attempt count
      txn.attempts = (txn.attempts || 0) + 1;
      txn.lastAttempt = new Date();

      // 🧠 Log this attempt
      txn.requeryLogs = txn.requeryLogs || [];
      txn.requeryLogs.push({
        timestamp: new Date(),
        action: 'auto-requery',
        attempt: txn.attempts
      });

      await txn.save();

      // 🔎 Re-verify with Paystack
      const { data } = await axios.get(
        `https://api.paystack.co/transaction/verify/${txn.reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET}`
          }
        }
      );

      const status = data.data.status;

      // ✅ Success
      if (status === 'success' && txn.status !== 'success') {
        txn.status = 'success';
        txn.description = '[Auto Requery] Wallet funded via Paystack';
        await txn.save();

        const wallet = await Wallet.findById(txn.wallet);
        if (wallet) {
          wallet.balance += txn.amount;
          await wallet.save();
        }

        console.log(`[SUCCESS] Credited wallet for ${txn.reference}`);
      }

      // ❌ Failed
      else if (status === 'failed') {
        txn.status = 'failed';
        txn.failureReason = '[Auto Requery] Paystack confirmed failed';
        await txn.save();

        console.log(`[FAILED] Marked failed for ${txn.reference}`);
      }

      // ⏳ Still pending — leave for next run
      else {
        console.log(`[PENDING] Still pending for ${txn.reference}`);
      }

    } catch (err) {
      console.error(`[ERROR] Requery failed for ${txn.reference}:`, err.message);
    }
  }
});
