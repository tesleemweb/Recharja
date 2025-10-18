// File: models/Pricing.js

const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
  network: {
    type: String,
    required: true,
    trim: true
  },
  service: {
    type: String,
    enum: ['airtime', 'data'],
    required: true
  },

  // Plan info
  plan: {
    type: String,
    default: null
  },
  variationCode: {
    type: String,
    default: null,
    index: true
  },

  // Pricing
  price: {
    type: Number,
    default: 0
  },
  cost: {
    type: Number,
    default: 0
  },
  fixedAmount: {
    type: Number,
    default: null
  },
  minAmount: {
    type: Number,
    default: null
  },
  maxAmount: {
    type: Number,
    default: null
  },
  discountPercentage: {
    type: Number,
    default: null
  },

  // Source & status
  source: {
    type: String,
    enum: ['vtpass', 'custom'],
    default: 'custom'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Frontend display
  display_name: {            // matches your JSON
    type: String,
    default: null
  },

  provider_name: {           // raw provider name from API
    type: String,
    default: null
  },

  validity: {                // number of days
    type: Number,
    default: null
  },

  description: {
    type: String,
    default: null
  },
  category: {
    type: String,
    default: null
  }

}, { timestamps: true });

module.exports = mongoose.model('Pricing', pricingSchema);
