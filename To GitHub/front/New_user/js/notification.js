const BASE_URL = 'http://localhost:5000';

// -------------------------------
// ✅ AUTHENTICATION CHECK
// -------------------------------
async function checkAuth() {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { credentials: 'include' });
    const data = await res.json();
    if (!data.success) {
      window.location.href = 'login';
      return false;
    }
    return true;
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'login';
    return false;
  }
}

const notificationMap = {
  transaction: {
    airtime: { icon: "📱", link: "/transactions/airtime" },
    data: { icon: "🌐", link: "/transactions/data" },
    fund: { icon: "💰", link: "/wallet" },
    cashback: { icon: "🎉", link: "/wallet" },
    dstv: { icon: "📺", link: "/transactions/cable" },
    electricity: { icon: "⚡", link: "/transactions/electricity" },
    betting: { icon: "🎯", link: "/transactions/betting" },
    referral: { icon: "👥", link: "/referrals" },
  },
  system: {
    upgrade: { icon: "⚙️", link: "/account" },
    security: { icon: "🔒", link: "/security" },
    welcome: { icon: "👋", link: "/menu" },
  },
  promotion: {
    offer: { icon: "🎁", link: "/offers" },
    reward: { icon: "🏆", link: "/rewards" },
    cashback: { icon: "💸", link: "/wallet" },
  },
  welcome: {
    welcome: { icon: "🌟", link: "/menu" },
  },
  security: {
    security: { icon: "🧩", link: "/security" },
  }
};

let allNotifications = [];
let currentFilter = 'all';

// ----------------------------
// Load Notifications
// ----------------------------
async function loadNotifications() {
  try {
    const res = await fetch(`${BASE_URL}/api/admin/notifications`, { credentials: 'include' });
    const data = await res.json();

    if (!data.success || !data.notifications?.length) {
      document.getElementById('emptyState').classList.add('show');
      return;
    }

    allNotifications = data.notifications.map(n => ({
      id: n._id,
      icon: notificationMap[n.category]?.[n.sub_category]?.icon || "🔔",
      title: n.title,
      message: n.message,
      time: formatTimeAgo(n.date),
      category: n.category,
      sub_category: n.sub_category,
      date: getDateGroup(n.date),
      read: n.read,
      success: n.success,
      server: n.server
    }));

    renderNotifications();
  } catch (err) {
    console.error('Error loading notifications:', err);
    document.getElementById('emptyState').classList.add('show');
  }
}

// ----------------------------
// Mark Single Notification as Read
// ----------------------------
async function markAsRead(id) {
  const notif = allNotifications.find(n => n.id === id);
  if (notif && !notif.read) {
    notif.read = true;
    renderNotifications();

    try {
      await fetch(`${BASE_URL}/api/admin/notifications/mark-read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
    }
  }
}

// ----------------------------
// Mark All as Read
// ----------------------------
async function markAllAsRead() {
  try {
    allNotifications.forEach(n => n.read = true);
    renderNotifications();

    await fetch(`${BASE_URL}/api/admin/notifications/mark-all`, {
      method: 'PATCH',
      credentials: 'include'
    });
  } catch (err) {
    console.error('Error marking all as read:', err);
  }
}

document.getElementById('markAllBtn').addEventListener('click', markAllAsRead);

// ----------------------------
// Group by Date
// ----------------------------
function getDateGroup(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  return 'older';
}

// ----------------------------
// Render Notifications
// ----------------------------
function renderNotifications() {
  const container = document.getElementById('notificationsList');
  const emptyState = document.getElementById('emptyState');

  let filtered = allNotifications;
  if (currentFilter === 'unread') {
    filtered = allNotifications.filter(n => !n.read);
  } else if (currentFilter !== 'all') {
    filtered = allNotifications.filter(n => n.category === currentFilter);
  }

  document.getElementById('countAll').textContent = allNotifications.length;
  document.getElementById('countUnread').textContent = allNotifications.filter(n => !n.read).length;

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.add('show');
    return;
  }

  emptyState.classList.remove('show');
  const groups = { today: [], yesterday: [], older: [] };
  filtered.forEach(n => groups[n.date]?.push(n));

  let html = '';
  const labels = { today: 'Today', yesterday: 'Yesterday', older: 'Older' };

  for (const [key, group] of Object.entries(groups)) {
    if (!group.length) continue;
    html += `<div class="date-group"><div class="date-header">${labels[key]}</div>`;
    group.forEach(n => {
      html += `
        <div class="notification-card ${n.read ? '' : 'unread'}" data-id="${n.id}" onclick="markAsRead('${n.id}')">
          ${n.read ? '' : '<div class="unread-indicator"></div>'}
          <div class="notification-header">
            <div class="notification-icon">${n.icon}</div>
            <div class="notification-content">
              <div class="notification-title">${n.title}</div>
              <div class="notification-message">${n.message}</div>
              <div class="notification-meta">
                <div class="notification-time">🕐 ${n.time}</div>
                <div class="notification-category ${n.category}">${n.category}</div>
              </div>
              ${getActionButton(n)}
            </div>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

// ----------------------------
// Action Buttons
// ----------------------------
function getActionButton(n) {
  if (n.category === 'welcome' || n.sub_category === 'welcome') {
    return `<button class="notification-action" onclick="navigateTo('/menu', event)">Get Started</button>`;
  }
  if (n.category === 'transaction' && n.success === false) {
    return `<button class="notification-action retry" onclick="retryTransaction('${n.server}', '${n.sub_category}', event)">Retry</button>`;
  }
  return '';
}

function navigateTo(link, event) {
  event.stopPropagation();
  window.location.href = link;
}

function retryTransaction(server, sub_category, event) {
  event.stopPropagation();
  const page = notificationMap.transaction[sub_category]?.link;
  if (page) {
    console.log(`Retrying on ${server} via ${page}`);
    window.location.href = page;
  } else {
    alert('Unknown transaction type');
  }
}

// ----------------------------
// Filter Tabs
// ----------------------------
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderNotifications();
  });
});

// ----------------------------
// Utilities
// ----------------------------
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}


// ----------------------------
// ✅ Settings Modal & Toggles (LocalStorage)
// ----------------------------
const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');

// Open modal
settingsBtn.addEventListener('click', () => {
  settingsOverlay.classList.add('show');
  setTimeout(() => settingsModal.classList.add('show'), 10);
});

// Close modal
function closeSettingsModal() {
  settingsModal.classList.remove('show');
  setTimeout(() => settingsOverlay.classList.remove('show'), 300);
}
closeSettings.addEventListener('click', closeSettingsModal);
settingsOverlay.addEventListener('click', closeSettingsModal);

// Prevent modal close when clicking inside
settingsModal.addEventListener('click', e => e.stopPropagation());

// ----------------------------
// Toggle Settings
// ----------------------------
const toggleAll = document.getElementById('toggleAll');
const toggleTransaction = document.getElementById('toggleTransaction');
const togglePromotion = document.getElementById('togglePromotion');
const toggleSecurity = document.getElementById('toggleSecurity');

// Master toggle
toggleAll.addEventListener('change', e => {
  const checked = e.target.checked;
  [toggleTransaction, togglePromotion, toggleSecurity].forEach(t => t.checked = checked);
  localStorage.setItem('notif_all', checked);
  localStorage.setItem('notif_transaction', checked);
  localStorage.setItem('notif_promotion', checked);
  localStorage.setItem('notif_security', checked);
});

// Individual toggles
[toggleTransaction, togglePromotion, toggleSecurity].forEach(toggle => {
  toggle.addEventListener('change', e => {
    toggleAll.checked = toggleTransaction.checked && togglePromotion.checked && toggleSecurity.checked;
    localStorage.setItem(`notif_${toggle.id.replace('toggle','').toLowerCase()}`, e.target.checked);
  });
});

// Other preferences
document.getElementById('toggleSound').addEventListener('change', e => localStorage.setItem('notif_sound', e.target.checked));
document.getElementById('toggleVibration').addEventListener('change', e => localStorage.setItem('notif_vibration', e.target.checked));
document.getElementById('toggleEmail').addEventListener('change', e => localStorage.setItem('notif_email', e.target.checked));

// Load saved settings on page load
window.addEventListener('load', () => {
  const loadSetting = (id, defaultValue = true) => {
    const saved = localStorage.getItem(`notif_${id.replace('toggle','').toLowerCase()}`);
    document.getElementById(id).checked = saved !== null ? saved === 'true' : defaultValue;
  };
  
  ['toggleAll','toggleTransaction','togglePromotion','toggleSecurity','toggleSound','toggleVibration','toggleEmail'].forEach(id => 
    loadSetting(id, id==='toggleEmail'?false:true)
  );
});


function navigate(link) {
  window.location.href = link;
}


// ----------------------------
// Init
// ----------------------------
window.addEventListener('DOMContentLoaded', async () => {
  const authenticated = await checkAuth();
  if (authenticated) loadNotifications();
});
