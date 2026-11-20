const AUTO_REFRESH_MS = 10000;
const AUTO_REFRESH_KEY = 'inksyncAutoRefresh';

const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const lastUpdated = document.getElementById('lastUpdated');
const refreshWarning = document.getElementById('refreshWarning');

let refreshTimer = null;

function readAutoRefreshSetting() {
  try {
    return localStorage.getItem(AUTO_REFRESH_KEY) !== 'off';
  } catch (error) {
    return true;
  }
}

function saveAutoRefreshSetting(enabled) {
  try {
    localStorage.setItem(AUTO_REFRESH_KEY, enabled ? 'on' : 'off');
  } catch (error) {
    return;
  }
}

function stopAutoRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
}

function scheduleAutoRefresh() {
  stopAutoRefresh();
  if (autoRefreshToggle.checked) {
    refreshTimer = setTimeout(runAutoRefresh, AUTO_REFRESH_MS);
  }
}

async function runAutoRefresh() {
  if (!document.hidden) {
    await loadOrders({ silent: true, announce: true });
  }
  scheduleAutoRefresh();
}

function markUpdated() {
  lastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  refreshWarning.classList.add('d-none');

  if (refreshTimer === null) {
    scheduleAutoRefresh();
  }
}

autoRefreshToggle.checked = readAutoRefreshSetting();

autoRefreshToggle.addEventListener('change', () => {
  saveAutoRefreshSetting(autoRefreshToggle.checked);

  if (autoRefreshToggle.checked) {
    loadOrders({ silent: true, announce: true });
    scheduleAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && autoRefreshToggle.checked && refreshTimer !== null) {
    loadOrders({ silent: true, announce: true });
    scheduleAutoRefresh();
  }
});

document.addEventListener('orders:loaded', markUpdated);
document.addEventListener('orders:checked', markUpdated);

document.addEventListener('orders:refresh-failed', () => {
  refreshWarning.classList.remove('d-none');
});