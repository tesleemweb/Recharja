const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  category: {
    type: String,
    enum: ['transaction', 'system', 'promotion', 'security', 'welcome'],
    required: true
  },
  sub_category: {
    type: String,
    enum: [
      'reward', 'offer', 'betting', 'data', 'airtime', 'fund',
      'referral', 'dstv', 'electricity', 'welcome', 'security', 'upgrade', 'cable', 'cashback'
    ],
    required: true
  },
  forUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  read: { type: Boolean, default: false },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);
