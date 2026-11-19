function showToast(message, type = 'success') {
  const toastEl = document.getElementById('appToast');
  toastEl.className = 'toast align-items-center border-0 text-bg-' + type;
  document.getElementById('appToastBody').textContent = message;
  bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 }).show();
}

function formatPeso(amount) {
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  in_production: 'In Production',
  completed: 'Completed'
};

function escapeHtml(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => entities[char]);
}

function orderNumber(id) {
  return '#ORD-' + id;
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  const text = String(value);
  const date = new Date(text.length === 10 ? text + 'T00:00:00' : text.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return text;
  }
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadge(status) {
  return '<span class="badge rounded-pill status-badge status-' + escapeHtml(status) + '">' +
    escapeHtml(STATUS_LABELS[status] || status) + '</span>';
}