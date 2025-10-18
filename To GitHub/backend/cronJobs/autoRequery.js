const Transaction = require('../models/Transaction');
const Airtime = require('../models/airtime');
const DataPurchase = require('../models/DataPurchase');
const Wallet = require('../models/Wallet');
const { requeryVTpassTransaction } = require('../services/providerClient');

let isRunning = false; // To prevent concurrent runs

async function logRequeryAttempt(txn, action) {
  const now = new Date();
  txn.attempts = (txn.attempts || 0) + 1;
  txn.lastAttempt = now;
  txn.requeryLogs = txn.requeryLogs || [];
  txn.requeryLogs.push({
    timestamp: now,
    action,
    attempt: txn.attempts,
  });
  await txn.save();
}

async function handleRequery(txn) {
  await logRequeryAttempt(txn, 'auto-requery');

  const result = await requeryVTpassTransaction(txn.reference);
  if (!result || result.code !== '000') {
    console.log(`[Requery] Skipped ${txn.reference} - Invalid or error response`);
    return;
  }

  const status = result.content.transactions.status.toLowerCase();
  console.log(`[Requery] ${txn.reference} → ${status}`);

  if (status === 'delivered') {
    txn.status = 'success';
    txn.failureReason = null;
    await txn.save();

    const model = txn.service === 'data' ? DataPurchase : Airtime;
    await model.updateOne(
      { request_id: txn.reference },
      { status: 'success' }
    );

  } else if (status === 'failed') {
    if (txn.status !== 'failed') {
      txn.status = 'failed';
      txn.failureReason = 'Confirmed failed from VTpass';

      const wallet = await Wallet.findById(txn.wallet);
      if (wallet) {
        wallet.balance += txn.amount;
        await wallet.save();
        console.log(`[Refund] Wallet credited for failed txn ${txn.reference}`);
      }

      const model = txn.service === 'data' ? DataPurchase : Airtime;
      await model.updateOne(
        { request_id: txn.reference },
        { status: 'failed' }
      );

      await txn.save();
    }
  }
}

async function requeryLoop() {
  if (isRunning) return;
  isRunning = true;

  try {
    while (true) {
      const pendingTxns = await Transaction.find({
        service: { $in: ['airtime', 'data'] },
        status: 'pending',
        attempts: { $lt: 3 },
      });

      if (pendingTxns.length === 0) {
        console.log('[Auto Requery] No pending transactions. Stopping requery loop.');
        break;
      }

      console.log(`[Auto Requery] Processing ${pendingTxns.length} pending transactions`);

      for (const txn of pendingTxns) {
        await handleRequery(txn);
      }

      await new Promise(resolve => setTimeout(resolve, 60 * 1000)); // 1 min delay
    }
  } catch (err) {
    console.error('[Auto Requery Error]', err.message || err);
  } finally {
    isRunning = false;
  }
}

async function checkAndStartRequery() {
  if (isRunning) return;

  const hasPending = await Transaction.exists({
    service: { $in: ['airtime', 'data'] },
    status: 'pending',
    attempts: { $lt: 3 },
  });

  if (hasPending) {
    console.log('[Auto Requery] Pending transactions found. Starting requery loop.');
    requeryLoop().catch(err => console.error('[Auto Requery Loop Error]', err));
  } else {
    console.log('[Auto Requery] No pending transactions on check.');
  }
}

// Initial check at server startup
checkAndStartRequery().catch(err => console.error('[Auto Requery Startup Error]', err));

// Export for external trigger
async function notifyNewPending() {
  console.log('[Auto Requery] notifyNewPending called');
  await checkAndStartRequery();
}

module.exports = { notifyNewPending };
