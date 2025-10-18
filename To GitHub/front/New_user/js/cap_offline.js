/* cap_offline.js
   Minimal offline layer for Capacitor + browser.
   - call Offline.init(...) early on each page
   - exposes: window.Offline, window.fetchJSON (after init), window.showBanner, window.hideBanner
   - durable queue stored in IndexedDB (fallback to localStorage)
*/

(function () {
  const IDB_QUEUE_DB = 'recharga_offline_db_v1';
  const IDB_QUEUE_STORE = 'requests';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_QUEUE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_QUEUE_STORE)) {
          db.createObjectStore(IDB_QUEUE_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbAdd(obj) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_QUEUE_STORE, 'readwrite');
      tx.objectStore(IDB_QUEUE_STORE).put(obj);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGetAll() {
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_QUEUE_STORE, 'readonly');
      const req = tx.objectStore(IDB_QUEUE_STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  }
  async function idbDelete(id) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(IDB_QUEUE_STORE, 'readwrite');
      tx.objectStore(IDB_QUEUE_STORE).delete(id);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }

  // UI helpers exposed globally so your pages can call showBanner()
  function ensureBanner() {
    if (document.getElementById('rechargaNetworkBanner')) return;
    const b = document.createElement('div');
    b.id = 'rechargaNetworkBanner';
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;padding:10px;text-align:center;font-family:system-ui;background:#b91c1c;color:#fff;display:none;';
    document.body.appendChild(b);
  }
  function _showBanner(text, bg = '#b91c1c') {
    try {
      ensureBanner();
      const b = document.getElementById('rechargaNetworkBanner');
      b.textContent = text;
      b.style.background = bg;
      b.style.display = 'block';
    } catch (e) { console.warn('banner show failed', e); }
  }
  function _hideBanner() {
    try {
      const b = document.getElementById('rechargaNetworkBanner');
      if (b) b.style.display = 'none';
    } catch (e) {}
  }

  // Expose small helpers
  window.showBanner = _showBanner;
  window.hideBanner = _hideBanner;

  const Offline = {
    isOnline: navigator.onLine,
    initialized: false,
    config: {
      baseUrl: window.BASE_URL || '',
      apiTimeout: 10000,
      retries: 1,
      notifyOnRestore: true
    }
  };

  async function useCapacitorNetwork() {
    try {
      if (window.Capacitor && window.Capacitor.isNative) {
        const plugins = window.Capacitor.Plugins || {};
        const Network = plugins.Network || (window.CapacitorNetwork && window.CapacitorNetwork.Network);
        if (Network && typeof Network.addListener === 'function') {
          const status = await Network.getStatus();
          Offline.isOnline = !!(status && status.connected);
          Network.addListener('networkStatusChange', (s) => {
            Offline.isOnline = !!s.connected;
            if (Offline.isOnline) {
              Offline.flushQueue().then(() => {
                if (Offline.config.notifyOnRestore) _showBanner('Connection restored — data synced. Please refresh for live updates.', '#16a34a');
                setTimeout(_hideBanner, 6000);
              }).catch(() => {});
            } else {
              _showBanner('You are offline — working in offline mode.');
            }
          });
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function setupBackButton() {
    try {
      if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const App = window.Capacitor.Plugins.App;
        if (typeof App.addListener === 'function') {
          App.addListener('backButton', () => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              if (typeof App.exitApp === 'function') App.exitApp();
            }
          });
        }
      }
    } catch (e) { console.warn('backButton setup failed', e); }
  }

  async function fetchJSONWrapper(url, options = {}, opts = {}) {
    const timeout = opts.timeout || Offline.config.apiTimeout;
    const retries = typeof opts.retries === 'number' ? opts.retries : Offline.config.retries;
    const allowQueueing = opts.allowQueueing !== false;
    const method = (options.method || 'GET').toUpperCase();

    // queue writes when offline
    if (!Offline.isOnline && allowQueueing && ['POST','PUT','PATCH','DELETE'].includes(method)) {
      const payload = {
        id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2,9),
        url,
        method,
        headers: options.headers || { 'Content-Type': 'application/json' },
        body: options.body || null,
        ts: new Date().toISOString()
      };
      try {
        await idbAdd(payload);
        return { queued: true, message: 'Request queued while offline' };
      } catch (e) {
        const lsKey = 'recharga_ls_queue_v1';
        const arr = JSON.parse(localStorage.getItem(lsKey) || '[]');
        arr.push(payload);
        localStorage.setItem(lsKey, JSON.stringify(arr));
        return { queued: true, message: 'Request queued (localStorage fallback)' };
      }
    }

    let attempt = 0;
    const doFetch = async () => {
      attempt++;
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const resp = await fetch(url, { credentials: 'include', signal: controller.signal, ...options });
        clearTimeout(id);
        if (!resp.ok) {
          const text = await resp.text().catch(() => '');
          const err = new Error(text || `Request failed (${resp.status})`);
          err.status = resp.status;
          throw err;
        }
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) return resp.json();
        return resp.text();
      } catch (err) {
        clearTimeout(id);
        if (err.name === 'AbortError') err.message = `Timeout after ${timeout}ms`;
        if (attempt <= retries) {
          await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
          return doFetch();
        }
        if (!navigator.onLine) {
          Offline.isOnline = false;
          _showBanner('You are offline — working in offline mode.');
        }
        throw err;
      }
    };

    return doFetch();
  }

  Offline.flushQueue = async function () {
    try {
      const all = await idbGetAll();
      for (const item of all) {
        try {
          const resp = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body,
            credentials: 'include'
          });
          if (!resp.ok) throw new Error('Failed on server: ' + resp.status);
          await idbDelete(item.id);
        } catch (e) {
          throw e;
        }
      }
    } catch (e) {
      // localStorage fallback
      const lsKey = 'recharga_ls_queue_v1';
      const arr = JSON.parse(localStorage.getItem(lsKey) || '[]');
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        try {
          const resp = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body,
            credentials: 'include'
          });
          if (!resp.ok) throw new Error('failed localStorage flush');
        } catch (err) {
          throw err;
        }
      }
      localStorage.removeItem(lsKey);
    }
  };

  Offline.init = async function (cfg = {}) {
    if (Offline.initialized) return Offline;
    Offline.config = Object.assign(Offline.config, cfg || {});
    const capNet = await useCapacitorNetwork();
    if (!capNet) {
      Offline.isOnline = navigator.onLine;
      window.addEventListener('online', async () => {
        Offline.isOnline = true;
        try { await Offline.flushQueue(); if (Offline.config.notifyOnRestore) _showBanner('Connection restored — data synced. Please refresh for live updates.', '#16a34a'); setTimeout(_hideBanner, 6000); } catch (e) {}
      });
      window.addEventListener('offline', () => {
        Offline.isOnline = false;
        _showBanner('You are offline — working in offline mode.');
      });
    }
    setupBackButton();
    // install wrapper as global fetchJSON
    window.fetchJSON = async function (url, options = {}, opts = {}) {
      return fetchJSONWrapper(url, options, opts);
    };
    Offline.initialized = true;
    return Offline;
  };

  Offline.safeAuthCheck = async function () {
    try {
      if (!Offline.isOnline) return { offline: true };
      const res = await fetch(`${Offline.config.baseUrl || ''}/api/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) return { authError: true, status: 401 };
        const txt = await res.text().catch(() => '');
        throw new Error(txt || ('HTTP ' + res.status));
      }
      return await res.json();
    } catch (err) {
      if (!navigator.onLine) return { offline: true };
      throw err;
    }
  };

  window.Offline = Offline;
})();
