// controllers/adminSettingsController

const Admin = require('../models/Admin');
const AdminSettings = require('../models/AdminSettings');
const bcrypt = require('bcryptjs');

// 🧠 Helper to get or create the settings document
async function getOrCreateSettings(adminEmail) {
  return await AdminSettings.findOneAndUpdate(
    {},
    { $setOnInsert: { adminEmail } },
    { new: true, upsert: true }
  );
}

// 📥 GET /api/admin/settings/settings
exports.getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings(req.admin.email);
    return res.json(settings);
  } catch (err) {
    console.error('GET /settings error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 📝 PUT /api/admin/settings/settings
exports.updateSettings = async (req, res) => {
  try {
    const {
      maintenanceMode,
      vtuApiKey,
      vtuApiEndpoint,
      webhookURL,
      adminEmail,
      twoFA,
      multiAdmin
    } = req.body;

    if (typeof adminEmail !== 'undefined') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
    }

    const update = {};
    if (typeof maintenanceMode !== 'undefined') update.maintenanceMode = maintenanceMode;
    if (typeof vtuApiKey !== 'undefined') update.vtuApiKey = vtuApiKey;
    if (typeof vtuApiEndpoint !== 'undefined') update.vtuApiEndpoint = vtuApiEndpoint;
    if (typeof webhookURL !== 'undefined') update.webhookURL = webhookURL;
    if (typeof adminEmail !== 'undefined') update.adminEmail = adminEmail;
    if (typeof twoFA !== 'undefined') update.twoFA = twoFA;
    if (typeof multiAdmin !== 'undefined') update.multiAdmin = multiAdmin;

    const settings = await AdminSettings.findOneAndUpdate(
      {},
      update,
      { new: true, upsert: true }
    );

    return res.json({ message: 'Settings updated successfully', settings });
  } catch (err) {
    console.error('PUT /settings error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// 🧑‍💻 PUT /api/admin/settings/account
exports.updateAdminAccount = async (req, res) => {
  try {
    const admin = req.admin;
    if (!admin) return res.status(404).json({ msg: 'Admin not found' });

    const { email, newPassword, confirmPassword, twoFA, multiAdmin } = req.body;

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ msg: 'Passwords do not match' });
      }
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(newPassword, salt);
    }

    if (email) admin.email = email;
    if (typeof twoFA !== 'undefined') admin.twoFA = twoFA;
    if (typeof multiAdmin !== 'undefined') admin.multiAdmin = multiAdmin;

    await admin.save();

    res.json({ msg: 'Admin settings updated successfully' });
  } catch (error) {
    console.error('Update admin settings error:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};
