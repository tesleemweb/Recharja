const express = require('express');
const router = express.Router();
const Log = require('../../models/Log');

// GET logs
router.get('/', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(500);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE single log
router.delete('/:id', async (req, res) => {
  try {
    await Log.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Log deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE all logs
router.delete('/', async (req, res) => {
  try {
    await Log.deleteMany({});
    res.json({ success: true, message: 'All logs cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
