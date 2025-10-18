const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  purpose: { type: String, default: 'reset' },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL: Auto delete when expired
  }
});

module.exports = mongoose.model('Otp', OtpSchema);
