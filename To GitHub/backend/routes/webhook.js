// routes/webhook.js

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;

router.post('/paystack', express.json(), async (req, res) => {
  try {
    // Verify Paystack webhook signature (recommended for security)
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== hash) {
      console.warn('Invalid Paystack webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    // Handle only payment success and failure events
    if (event.event === 'charge.success' || event.event === 'charge.failed') {
      const {
        reference,
        amount: amountKobo,
        metadata: { userId } = {},
      } = event.data;

      if (!userId) {
        console.error('Paystack webhook missing userId in metadata');
        return res.status(400).send('Missing userId');
      }

      // Find or create wallet for user
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = await Wallet.create({ user: userId, balance: 0 });
      }

      // Convert amount from kobo to naira
      const amount = amountKobo / 100;

      // Try to find existing transaction by reference (to avoid duplicates)
      let transaction = await Transaction.findOne({ reference });

      if (!transaction) {
        // If no transaction exists yet, create one with pending status
        transaction = await Transaction.create({
          wallet: wallet._id,
          reference,
          type: 'credit',
          amount,
          description: `Funding wallet via Paystack (${reference})`,
          status: 'pending',
          createdAt: new Date(),
        });
      }

      if (event.event === 'charge.success') {
        // If transaction already success, ignore (idempotency)
        if (transaction.status === 'success') {
          return res.sendStatus(200);
        }

        // Update wallet balance and transaction status to success
        wallet.balance += amount;
        await wallet.save();

        transaction.status = 'success';
        transaction.updatedAt = new Date();
        await transaction.save();

        console.log(`Wallet funded: User ${userId}, Amount ₦${amount}, Ref: ${reference}`);

        return res.sendStatus(200);
      }

      if (event.event === 'charge.failed') {
        // Update transaction status to failed if not already set
        if (transaction.status !== 'failed') {
          transaction.status = 'failed';
          transaction.updatedAt = new Date();
          await transaction.save();

          console.log(`Payment failed: User ${userId}, Ref: ${reference}`);
        }
        return res.sendStatus(200);
      }
    }

    // Ignore other events
    return res.sendStatus(200);
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return res.status(500).send('Internal server error');
  }
});

module.exports = router;
