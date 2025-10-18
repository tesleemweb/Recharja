// models/DataPurchase.js
const mongoose = require('mongoose');

const DataTransactionSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
  wallet:      { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  phone:       { type: String,                                    required: true },
  network:     { type: String,                                    required: true },
  variationCode: { type: String,                                  required: true },
  dataPlan:    { type: String,                                    required: true },
  amount:      { type: Number,                                    required: true },
  request_id:  { type: String,                                    required: true, unique: true },
  providerRef: { type: String },
  status:      { type: String, enum: ['pending','success','failed'], default: 'pending' },
  failureReason: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('DataPurchase', DataTransactionSchema);
