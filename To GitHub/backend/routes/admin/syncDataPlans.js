// File: routes/admin/syncDataPlans.js

const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/admin');
const Pricing = require('../../models/Pricing');
const { getDataVariations } = require('../../services/providerClient');

const networks = ['mtn', 'glo', 'airtel', '9mobile'];

// Helper to extract validity in days from name
function extractValidity(name) {
  if (!name) return null;
  const regex = /(\d+)\s*(Day|Week|Month)/i;
  const match = name.match(regex);
  if (!match) return null;

  let num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('week')) num *= 7;
  if (unit.startsWith('month')) num *= 30;

  return num;
}

// Helper to clean plan name (remove price & validity info)
function cleanPlanName(name) {
  if (!name) return 'UNKNOWN';
  return name
    .replace(/-?\s*N[0-9,]+/i, '') // remove - Nxxx or Nxxx
    .replace(/\(\d+\s*(Day|Week|Month)s?\)/i, '') // remove (x Day/Week/Month)
    .trim();
}

// Helper to determine plan category
function getCategory(name, code) {
  const categories = {
    daily: ['daily'],
    '2days': ['2days'],
    '2weeks': ['2weeks'],
    monthly: ['monthly'],
    sunday: ['sunday'],
    special: ['special'],
    weekend: ['weekend'],
    mega: ['mega'],
    tv: ['tv'],
    social: ['social'],
    campus: ['campus'],
    dg: ['dg'],
    binge: ['binge'],
    mifi: ['mifi'],
    night: ['night', 'midnight', 'nite', 'Night plan', 'Night']
  };

  const text = (name + ' ' + code).toLowerCase();

  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }

  return 'direct'; // default if no match
}

router.post('/sync-data-plans', adminAuth, async (req, res) => {
  try {
    const allSynced = [];

    for (const net of networks) {
      let variations;
      try {
        variations = await getDataVariations(net);
        if (!Array.isArray(variations) || variations.length === 0) {
          console.warn(`⚠️ No valid variations for ${net}`);
          continue;
        }
      } catch (err) {
        console.error(`❌ Failed to fetch ${net}:`, err.message);
        continue;
      }

      const upperNet = net.toUpperCase();

      for (const v of variations) {
        const cost = parseFloat(v.variation_amount || v.amount || 0);
        const variationCode = v.variation_code || null;
        const provider_name = v.name || 'UNKNOWN';

        if (!variationCode || isNaN(cost)) continue;

        const plan = cleanPlanName(provider_name);
        const display_name = plan;
        const validity = extractValidity(provider_name);
        const category = getCategory(provider_name, variationCode);

        // Check if already exists
        const existing = await Pricing.findOne({
          variationCode,
          service: 'data'
        });

        if (existing) {
          existing.network = upperNet;
          existing.plan = plan;
          existing.display_name = display_name;
          existing.provider_name = provider_name;
          existing.cost = cost;
          existing.price = existing.price || cost; // keep custom price if set
          existing.validity = validity;
          existing.source = 'vtpass';
          existing.description = null;
          existing.category = category;

          await existing.save();
        } else {
          await Pricing.create({
            network: upperNet,
            service: 'data',
            variationCode,
            plan,
            display_name,
            provider_name,
            cost,
            price: cost, // default price = cost
            validity,
            source: 'vtpass',
            enabled: false,
            description: null,
            category
          });
        }

        allSynced.push(`${upperNet} - ${display_name}`);
      }
    }

    return res.json({
      msg: '✅ Data plans synced successfully',
      total: allSynced.length,
      plans: allSynced
    });
  } catch (err) {
    console.error('❌ Sync error:', err);
    return res.status(500).json({ msg: 'Failed to sync data plans' });
  }
});

// GET /api/admin/sync/last-sync
router.get('/last-sync', adminAuth, async (req, res) => {
  try {
    const latest = await Pricing.findOne({ service: 'data', source: 'vtpass' })
      .sort({ updatedAt: -1 })
      .select('updatedAt');

    if (!latest) return res.json({ lastSync: null });

    return res.json({ lastSync: latest.updatedAt });
  } catch (err) {
    console.error('❌ Failed to fetch last sync time:', err);
    return res.status(500).json({ message: 'Failed to fetch last sync time' });
  }
});

module.exports = router;
