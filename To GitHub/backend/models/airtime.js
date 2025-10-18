const mongoose = require('mongoose');

const AirtimeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  network: { type: String, required: true },
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  providerRef: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Airtime || mongoose.model('Airtime', AirtimeSchema);
