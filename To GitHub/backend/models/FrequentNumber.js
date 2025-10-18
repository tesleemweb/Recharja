const mongoose = require('mongoose');

const frequentNumberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['data', 'airtime'], required: true },
  number: { type: String, required: true },
  count: { type: Number, default: 1 },
}, { timestamps: true });

frequentNumberSchema.index({ userId: 1, type: 1, number: 1 }, { unique: true });

module.exports = mongoose.model('FrequentNumber', frequentNumberSchema);
