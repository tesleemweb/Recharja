// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  wallet:        { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  type:          { type: String, enum: ['credit','debit'], required: true },
  amount:        { type: Number, required: true },
  reference:     { type: String, required: true, unique: true },
  phone:         { type: String },   // For airtime/data/wallet
  service:       { type: String },   // 'airtime' | 'data' | 'wallet' | etc
  status:        { type: String, enum: ['pending','success','failed'], default: 'pending' },
  description:   { type: String },
  providerRef:   { type: String },
  failureReason: { type: String },
  oldBalance: { type: Number },
  currentBalance: { type: Number },
  attempts:      { type: Number, default: 0 },
  lastAttempt:   { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
