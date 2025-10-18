const express = require('express');
const router = express.Router();
const Notification = require('../../models/Notification');
const adminAuth = require('../../middleware/admin'); // Admin only
const auth = require('../../middleware/auth'); // NEW: regular user auth

// -----------------------------
// Admin routes (unchanged)
// -----------------------------
router.post('/create', adminAuth, async (req, res) => {
  try {
    const { title, message, category, sub_category, forUser } = req.body;
    if (!title || !message || !category || !sub_category) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const notification = new Notification({
      title,
      message,
      category,
      sub_category,
      forUser: forUser || null
    });
    await notification.save();
    res.json({ success: true, notification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error saving notification' });
  }
});

router.get('/admin', adminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.json({ success: true, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error deleting notification' });
  }
});

// -----------------------------
// User routes (cookie-based)
// -----------------------------

// Get all notifications for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({
      $or: [
        { forUser: null },       // Global
        { forUser: userId }      // Specific user
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
});

// Mark one or multiple notifications as read
router.patch('/mark-read', auth, async (req, res) => {
  try {
    const { ids } = req.body; // Array of notification IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Notification IDs are required' });
    }

    await Notification.updateMany(
      { _id: { $in: ids }, $or: [{ forUser: null }, { forUser: req.user._id }] },
      { $set: { read: true } }
    );

    res.json({ success: true, message: 'Notifications marked as read successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error marking notifications as read' });
  }
});

// Mark ALL notifications as read for logged-in user
router.patch('/mark-all', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { $or: [{ forUser: null }, { forUser: userId }] },
      { $set: { read: true } }
    );

    res.json({ success: true, message: 'All notifications marked as read successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error marking all notifications as read' });
  }
});

module.exports = router;
