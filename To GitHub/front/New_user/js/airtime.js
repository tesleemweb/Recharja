// file: airtime-app.js
// Production-ready client integration
// Configure BASE_URL to your backend root if needed (no trailing slash)
const BASE_URL = (window.__BASE_URL__ || 'http://localhost:5000').replace(/\/+$/, '');

async function apiFetch(path, opts = {}) {
  const url = (path.startsWith('http') ? path : `${BASE_URL}${path}`);
  const defaultOpts = { credentials: 'include', headers: {} };
  const merged = Object.assign({}, defaultOpts, opts);
  if (opts && opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    merged.headers['Content-Type'] = 'application/json';
    merged.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, merged);
  let payload = null;
  try { payload = await res.json(); } catch (e) { payload = null; }
  return { ok: res.ok, status: res.status, data: payload, res };
}

/* ---------------------------
   Auth check and bootstrapping
   --------------------------- */
let currentUser = null;
let wallet = { balance: 0 };

async function checkAuthAndInit() {
  try {
    const r = await apiFetch('/api/auth/me');
    if (!r.ok || r.data?.success === false) {
      window.location.href = 'login';
      return;
    }
    currentUser = r.data.user || null;
    populateHeader();
    await fetchWallet();
    await fetchFrequentNumbers();
    initNetworkButtons();
    initFormHandlers();
    initNavHandlers();
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'login';
  }
}

function populateHeader() {
  const avatar = document.getElementById('avatar');
  const subText = document.getElementById('subText');
  if (currentUser) {
    const name = currentUser.name || currentUser.email || 'User';
    const initial = (name.trim()[0] || 'U').toUpperCase();
    avatar.textContent = initial;
    subText.textContent = `Hello, ${name.split(' ')[0]}`;
    avatar.addEventListener('click', () => {
      // open profile page (file link requested)
      window.location.href = 'profile';
    });
  } else {
    avatar.textContent = 'U';
    subText.textContent = '';
  }
}

/* ----------------
   Wallet handling
   ---------------- */
async function fetchWallet() {
  const balanceEl = document.getElementById('paymentBalance');
  try {
    const r = await apiFetch('/api/wallet');
    if (r.ok && r.data) {
      // expecting { balance: 12500 } or similar
      wallet.balance = typeof r.data.balance === 'number' ? r.data.balance : (r.data?.wallet?.balance ?? 0);
      balanceEl.textContent = `Wallet Balance: ₦${formatNumber(wallet.balance)}`;
      togglePaymentBalanceVisibility();
    } else {
      balanceEl.textContent = 'Wallet Balance: ₦0';
      togglePaymentBalanceVisibility();
    }
  } catch (err) {
    console.error('Wallet fetch error:', err);
    balanceEl.textContent = 'Wallet Balance: ₦0';
    togglePaymentBalanceVisibility();
  }
}

function formatNumber(n) {
  if (typeof n !== 'number') return n;
  return n.toLocaleString('en-NG');
}

/* -----------------------
   Frequent numbers loader
   ----------------------- */
async function fetchFrequentNumbers() {
  const container = document.getElementById('frequentNumbers');
  container.innerHTML = ''; // clear
  // Try common endpoints; if not present, fall back to data from user object
  const candidates = [
    '/api/user/frequent-numbers',
    '/api/user/favorites',
    '/api/user/contacts'
  ];
  let numbers = [];

  // try user object first
  if (currentUser) {
    const fromUser = currentUser.frequentNumbers || currentUser.favorites || currentUser.contacts;
    if (Array.isArray(fromUser) && fromUser.length) {
      numbers = fromUser.map(x => typeof x === 'string' ? x : (x.phone || x.number || x.msisdn || '')).filter(Boolean);
    }
  }

  for (const ep of candidates) {
    if (numbers.length) break;
    try {
      const r = await apiFetch(ep);
      if (r.ok && Array.isArray(r.data)) {
        numbers = r.data.map(x => (typeof x === 'string' ? x : (x.phone || x.number || x.msisdn || ''))).filter(Boolean);
        break;
      }
    } catch (e) { /* ignore */ }
  }

  if (!numbers.length) {
    // fallback placeholder: show "Add numbers" button that goes to contacts page (user requested filename)
    const btn = document.createElement('div');
    btn.className = 'number-btn';
    btn.textContent = 'Add frequent numbers';
    btn.addEventListener('click', () => window.location.href = 'contacts');
    container.appendChild(btn);
    return;
  }

  numbers.slice(0, 8).forEach(num => {
    const el = document.createElement('div');
    el.className = 'number-btn';
    el.textContent = num;
    el.addEventListener('click', () => {
      const phoneInput = document.getElementById('phone');
      phoneInput.value = num;
    });
    container.appendChild(el);
  });
}

/* -----------------------
   UI: networks & payment
   ----------------------- */
function initNetworkButtons() {
  const networkBtns = document.querySelectorAll('.network-btn');
  const hiddenNetwork = document.getElementById('network');
  networkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      networkBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const network = (btn.dataset.network || btn.textContent || '').toLowerCase();
      hiddenNetwork.value = network;
    });
  });
  // ensure initial value
  const selected = document.querySelector('.network-btn.selected');
  if (selected) document.getElementById('network').value = (selected.dataset.network || selected.textContent || '').toLowerCase();
}

function togglePaymentBalanceVisibility() {
  const paymentSelect = document.getElementById('payment-method');
  const paymentBalance = document.getElementById('paymentBalance');
  paymentBalance.style.display = paymentSelect.value === 'wallet' ? 'block' : 'none';
}

function initNavHandlers() {
  // Ensure bottom nav links go to respective filenames (as requested)
  document.getElementById('navHome').addEventListener('click', () => window.location.href = 'home');
  document.getElementById('navMenu').addEventListener('click', () => window.location.href = 'menu');
  document.getElementById('navProfile').addEventListener('click', () => window.location.href = 'profile');

  // Buy Data link already points to data.html via href; if clicked programmatically ensure same
  const buyDataLink = document.getElementById('buyDataLink');
  buyDataLink.addEventListener('click', (e) => {
    // allow navigation to data.html; no "Coming soon" here per user instruction
  });

  // payment method change
  const paymentSelect = document.getElementById('payment-method');
  paymentSelect.addEventListener('change', togglePaymentBalanceVisibility);
}

/* -----------------------
   Airtime form submission
   ----------------------- */
function initFormHandlers() {
  const form = document.getElementById('airtimeForm');
  const buyBtn = document.getElementById('buyBtn');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const network = (document.getElementById('network').value || '').trim();
    const phone = document.getElementById('phone').value.trim();
    const amountVal = document.getElementById('amount').value;
    const amount = parseFloat(amountVal);

    if (!network || !phone || !amount || isNaN(amount) || amount < 50) {
      return alert('Please fill all fields with valid values (minimum ₦50).');
    }

    // If payment method is wallet and balance insufficient
    const paymentMethod = document.getElementById('payment-method').value;
    if (paymentMethod === 'wallet' && wallet.balance < amount) {
      const topup = confirm('Insufficient wallet balance. Would you like to fund your wallet?');
      if (topup) {
        // go to fund wallet page
        window.location.href = 'fund';
        return;
      } else {
        return;
      }
    }

    // Disable button and show spinner
    buyBtn.disabled = true;
    const originalHTML = buyBtn.innerHTML;
    buyBtn.innerHTML = `<span class="spinner"></span> Processing...`;

    try {
      const res = await apiFetch('/api/airtime/purchase', {
        method: 'POST',
        body: { network, phone, amount }
      });

      if (res.ok && res.data?.success) {
        alert('✅ ' + (res.data.message || 'Purchase successful'));
        const txId = res.data.transaction?._id || res.data.transaction?.id;
        if (txId) {
          window.location.href = `receipt.html?id=${txId}`;
          return;
        } else {
          // go to transactions page
          window.location.href = 'transactions';
          return;
        }
      } else {
        const fallback = res.data?.message || res.data?.error || 'Airtime purchase failed';
        alert(`❌ ${fallback}`);
        const txId = res.data?.transaction?._id || res.data?.transaction?.id;
        if (txId) window.location.href = `receipt.html?id=${txId}`;
      }
    } catch (err) {
      console.error('Airtime error:', err);
      alert('❌ Network error. Please try again later.');
    } finally {
      buyBtn.disabled = false;
      buyBtn.innerHTML = originalHTML;
      // refresh wallet after attempt
      await fetchWallet();
    }
  });
}

/* -----------------------
   Additional integrations
   ----------------------- */

// Allow long-press on avatar to logout (hidden feature)
(function attachAvatarLongPress() {
  const avatar = document.getElementById('avatar');
  if (!avatar) return;
  let timer = null;
  avatar.addEventListener('mousedown', () => {
    timer = setTimeout(() => {
      if (confirm('Log out?')) logout();
    }, 800);
  });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev => {
    avatar.addEventListener(ev, () => { if (timer) clearTimeout(timer); });
  });
})();

/* -----------------------
   Init
   ----------------------- */
document.addEventListener('DOMContentLoaded', () => {
  checkAuthAndInit();
});
