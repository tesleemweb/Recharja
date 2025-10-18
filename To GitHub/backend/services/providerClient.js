// services/providerClient.js
const axios = require('axios');

// Dynamically determine VTpass base URL
const mode = process.env.VTPASS_MODE || 'sandbox';
const VT_API_BASE =
  mode === 'live'
    ? process.env.VTPASS_BASE_URL_LIVE
    : process.env.VTPASS_BASE_URL_SANDBOX;

const VT_API_KEY = process.env.VTPASS_API_KEY;
const VT_PUBLIC_KEY = process.env.VTPASS_PUBLIC_KEY;
const VT_SECRET_KEY = process.env.VTPASS_SECRET_KEY;

// Service ID maps
const airtimeServiceMap = {
  mtn: 'mtn',
  glo: 'glo',
  airtel: 'airtel',
  '9mobile': 'etisalat',
  etisalat: 'etisalat'
};

const dataServiceMap = {
  mtn: 'mtn-data',
  glo: 'glo-data',
  airtel: 'airtel-data',
  '9mobile': '9mobile-data',
  etisalat: '9mobile-data'
};

// Core VTpass POST helper
async function vtpassPost(endpoint, payload) {
  const url = `${VT_API_BASE}/${endpoint}`;
  const headers = {
    'api-key': VT_API_KEY,
    'public-key': VT_PUBLIC_KEY,
    'secret-key': VT_SECRET_KEY,
    'Content-Type': 'application/json'
  };
  try {
    const response = await axios.post(url, payload, { headers });
    return response.data;
  } catch (err) {
    console.error(`VTpass POST ${endpoint} error:`, err.response?.data || err.message);
    throw err;
  }
}

// Core VTpass GET helper
async function vtpassGet(endpoint) {
  const url = `${VT_API_BASE}/${endpoint}`;
  const headers = {
    'api-key': VT_API_KEY,
    'public-key': VT_PUBLIC_KEY,
    'secret-key': VT_SECRET_KEY,
    'Content-Type': 'application/json'
  };
  try {
    const response = await axios.get(url, { headers });
    return response.data;
  } catch (err) {
    console.error(`VTpass GET ${endpoint} error:`, err.response?.data || err.message);
    throw err;
  }
}

// Airtime purchase
exports.sendAirtimeToAPI = async ({ network, phone, amount }) => {
  const serviceID = airtimeServiceMap[network.toLowerCase()];
  if (!serviceID) throw new Error('Unsupported airtime network');

  const request_id = `airtime-${Date.now()}`;
  const payload = {
    request_id,
    serviceID,
    amount,
    phone,
    billersCode: phone,
    variation_code: ''
  };

  const data = await vtpassPost('pay', payload);
  console.log('Airtime response:', data);

  const code = data.code;
  const desc = (data.response_description || '').toLowerCase();

  if (code === '000') {
    return {
      success: true,
      ref: request_id,
      status: data.content.transactions.status
    };
  }

  if (desc.includes('pending')) {
    return {
      success: false,
      ref: request_id,
      status: 'pending',
      error: 'Transaction pending'
    };
  }

  return {
    success: false,
    ref: request_id,
    status: 'failed',
    error: data.response_description
  };
};

// Fetch data variation codes
exports.getDataVariations = async (network) => {
  const serviceID = dataServiceMap[network.toLowerCase()];
  if (!serviceID) throw new Error('Unsupported data network');

  const data = await vtpassGet(`service-variations?serviceID=${serviceID}`);
  return data.content?.variations || [];
};

// Helper to fetch a single variation by code
exports.getDataVariationPrice = async (network, variation_code) => {
  const variations = await exports.getDataVariations(network);
  return variations.find(v => v.variation_code === variation_code) || null;
};

// Data purchase
exports.sendDataToAPI = async ({ network, phone, variation_code, request_id }) => {
  const serviceID = dataServiceMap[network.toLowerCase()];
  if (!serviceID) throw new Error('Unsupported data network');

  const payload = {
    request_id,
    serviceID,
    billersCode: phone,
    variation_code,
    phone
  };

  const data = await vtpassPost('pay', payload);
  console.log('Data purchase response:', data);

  return {
    success: data.code === '000',
    status: data.content.transactions.status,
    ref: data.content.transactions.transactionId,
    error: data.response_description
  };
};

// Requery transaction (airtime or data)
exports.requeryVTpassTransaction = async (request_id) => {
  const payload = { request_id };
  const data = await vtpassPost('requery', payload);
  console.log('Requery response:', data);
  return data;
};
