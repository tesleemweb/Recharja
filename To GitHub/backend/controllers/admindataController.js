// controllers/admindataController.js
const { getDataVariations } = require('../services/providerClient');

exports.getDataPlansByNetwork = async (req, res) => {
  const network = req.params.network?.toLowerCase(); // e.g. 'mtn', 'glo', 'airtel'

  try {
    const plans = await getDataVariations(network);

    const simplifiedPlans = plans.map(plan => ({
      code: plan.variation_code,
      name: plan.name,
      amount: plan.variation_amount,
    }));

    res.status(200).json({ success: true, plans: simplifiedPlans });
  } catch (err) {
    console.error(`Error fetching ${network} data plans:`, err.message);
    res.status(500).json({ success: false, error: `Failed to fetch ${network} data plans` });
  }
};
