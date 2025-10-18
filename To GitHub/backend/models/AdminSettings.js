//  models/AdminSettings.js
const mongoose = require('mongoose');

const AdminSettingsSchema = new mongoose.Schema({
  maintenanceMode: { type: Boolean, default: false },
  vtuApiKey: { type: String, default: '' },
  vtuApiEndpoint: { type: String, default: '' },
  webhookURL: { type: String, default: '' },
  twoFA: { type: Boolean, default: false },
  multiAdmin: { type: Boolean, default: false },
  adminEmail: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('AdminSettings', AdminSettingsSchema);
