// models/Promo.js
const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['all', 'airtime', 'data'], default: 'all' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Promo', promoSchema);
