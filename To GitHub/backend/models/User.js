const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  verified: { type: Boolean, default: false },
  password: {
    type: String,
    required: true
  },
  isDisabled: {
    type: Boolean,
    default: false
  },
  stats: {
    transactions: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    referrals: { type: Number, default: 0 }
  },
  referral: {
    code: {
      type: String,
      default: function() { return this.username; }
    },
    bonus: { type: Number, default: 0 }
  }
  
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
