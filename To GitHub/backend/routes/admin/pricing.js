// File: routes/admin/pricing.js
const express = require('express');
const router = express.Router();
const Pricing = require('../../models/Pricing');
const adminAuth = require('../../middleware/admin');
const { getDataVariations } = require('../../services/providerClient');

// Create or update a pricing entry
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      network,
      service,
      plan,
      price,
      cost,
      fixedAmount,
      minAmount,
      maxAmount,
      discountPercentage
    } = req.body;

    if (!network || !service) {
      return res.status(400).json({ msg: 'Network and service are required.' });
    }

    // ======== DATA PRICING ========
    if (service === 'data') {
      if (!plan || isNaN(price)) {
        return res.status(400).json({ msg: 'Plan and price are required for data.' });
      }

      const existing = await Pricing.findOne({ network, service, plan });
      if (existing) {
        existing.price = price;
        existing.cost = isNaN(cost) ? 0 : cost;
        await existing.save();
        return res.json({ msg: 'Data pricing updated', pricing: existing });
      }

      const newPricing = new Pricing({
        network,
        service,
        plan,
        price,
        cost: isNaN(cost) ? 0 : cost
      });

      await newPricing.save();
      return res.status(201).json({ msg: 'Data pricing created', pricing: newPricing });
    }

    // ======== AIRTIME PRICING ========
    if (service === 'airtime') {
      const criteria = { network, service };
      const entry = { network, service };

      // ----- Fixed Amount -----
      if (!isNaN(fixedAmount)) {
        if (isNaN(price)) {
          return res.status(400).json({ msg: 'Fixed price is required for fixed airtime.' });
        }
        criteria.fixedAmount = fixedAmount;
        entry.fixedAmount = fixedAmount;
        entry.plan = fixedAmount;
        entry.price = price;
        entry.cost = isNaN(cost) ? 0 : cost;
      }
      // ----- Price Range -----
      else if (!isNaN(minAmount) && !isNaN(maxAmount) && !isNaN(discountPercentage)) {
        criteria.minAmount = minAmount;
        criteria.maxAmount = maxAmount;
        entry.minAmount = minAmount;
        entry.maxAmount = maxAmount;
        entry.discountPercentage = discountPercentage;
        entry.plan = `${minAmount}-${maxAmount}`;
        entry.price = 0;
        entry.cost = 0;
      }
      else {
        return res.status(400).json({ msg: 'Incomplete airtime pricing data.' });
      }

      // Save/update
      const existing = await Pricing.findOne(criteria);
      if (existing) {
        Object.assign(existing, entry);
        await existing.save();
        return res.json({ msg: 'Airtime pricing updated', pricing: existing });
      }
      const newPricing = new Pricing(entry);
      await newPricing.save();
      return res.status(201).json({ msg: 'Airtime pricing created', pricing: newPricing });
    }

    return res.status(400).json({ msg: 'Invalid service type' });
  } catch (err) {
    console.error('Pricing save error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Proxy to VTpass for any serviceID (e.g. mtn-data, glo-data, etc.)
router.get('/vtpass/:serviceID', adminAuth, async (req, res) => {
  try {
    const { serviceID } = req.params;
    const data = await getDataVariations(serviceID.replace(/-data$/, '').toLowerCase());
    return res.json({ variations: data });
  } catch (err) {
    console.error('VTpass proxy error:', err.message);
    return res.status(500).json({ msg: 'Failed to fetch VTpass plans' });
  }
});

// Get all pricing, with optional filters
router.get('/', adminAuth, async (req, res) => {
  try {
    const { service, network, source, enabled } = req.query;
    const filter = {};

    if (service)  filter.service  = service;
    if (network)  filter.network  = network;
    if (source)   filter.source   = source;
    if (enabled !== undefined) {
      filter.enabled = enabled === 'true';
    }

    const prices = await Pricing.find(filter);
    return res.json(prices);
  } catch (err) {
    console.error('Failed to fetch pricing data', err);
    return res.status(500).json({ msg: 'Failed to fetch pricing data' });
  }
});

/**
 * @route   PUT /api/admin/pricing/:id
 * @desc    Update price, cost, enabled and isActive flags
 * @access  Admin
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const updates = {};

    if (req.body.price     !== undefined) updates.price     = req.body.price;
    if (req.body.cost      !== undefined) updates.cost      = req.body.cost;
    if (req.body.enabled   !== undefined) updates.enabled   = req.body.enabled;
    if (req.body.isActive  !== undefined) updates.isActive  = req.body.isActive; // ✅ Added support for isActive

    const updated = await Pricing.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ msg: 'Pricing entry not found' });
    }

    return res.json({ msg: 'Updated successfully', pricing: updated });
  } catch (err) {
    console.error('Update error:', err);
    return res.status(500).json({ msg: 'Failed to update pricing' });
  }
});

// Delete pricing entry
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Pricing.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Pricing entry deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to delete pricing entry' });
  }
});

module.exports = router;
