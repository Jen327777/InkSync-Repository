let staffAccounts = [];
let pendingDeactivateId = null;

const staffListMessage = document.getElementById('staffListMessage');
const staffListWrap = document.getElementById('staffListWrap');
const staffListBody = document.getElementById('staffListBody');
const deactivateModalEl = document.getElementById('deactivateModal');
const deactivateModal = bootstrap.Modal.getOrCreateInstance(deactivateModalEl);
const deactivateConfirmBtn = document.getElementById('deactivateConfirmBtn');
const deactivateText = document.getElementById('deactivateText');
const deactivateError = document.getElementById('deactivateError');

function showStaffMessage(html) {
  staffListMessage.innerHTML = html;
  staffListMessage.classList.remove('d-none');
  staffListWrap.classList.add('d-none');
}

function showStaffTable() {
  staffListMessage.classList.add('d-none');
  staffListWrap.classList.remove('d-none');
}

function staffStatusBadge(isActive) {
  return isActive
    ? '<span class="badge rounded-pill text-bg-success">Active</span>'
    : '<span class="badge rounded-pill text-bg-secondary">Deactivated</span>';
}

function staffRow(account) {
  const id = Number(account.id);
  const name = account.full_name || account.username;
  const action = account.is_active
    ? '<button type="button" class="btn btn-sm btn-outline-danger" data-deactivate-id="' + id + '">Deactivate</button>'
    : '<span class="small text-muted">—</span>';

  return '<tr' + (account.is_active ? '' : ' class="text-muted"') + '>' +
    '<td class="fw-semibold">' + escapeHtml(name) + '</td>' +
    '<td>' + escapeHtml(account.username) + '</td>' +
    '<td>' + staffStatusBadge(account.is_active) + '</td>' +
    '<td class="text-nowrap">' + escapeHtml(formatDate(account.created_at)) + '</td>' +
    '<td class="text-end">' + action + '</td>' +
    '</tr>';
}

function renderStaffList() {
  if (staffAccounts.length === 0) {
    showStaffMessage(
      '<div class="text-center text-muted py-5">' +
      '<p class="fw-semibold mb-1">No staff accounts yet</p>' +
      '<p class="mb-0">Click "+ Create Staff Account" to add one.</p>' +
      '</div>'
    );
    return;
  }

  staffListBody.innerHTML = staffAccounts.map(staffRow).join('');
  showStaffTable();
}

async function loadStaff() {
  showStaffMessage(
    '<div class="text-center text-muted py-5">' +
    '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading staff accounts...' +
    '</div>'
  );

  try {
    const data = await api.get('/users/list-staff.php');
    staffAccounts = data.staff;
    renderStaffList();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    showStaffMessage(
      '<div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">' +
      '<span>' + escapeHtml(error.message) + '</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" data-action="retry-staff">Try again</button>' +
      '</div>'
    );
  }
}

function askToDeactivate(id) {
  const account = staffAccounts.find((item) => Number(item.id) === id);
  if (!account) {
    return;
  }

  pendingDeactivateId = id;
  deactivateError.classList.add('d-none');
  deactivateText.textContent = 'Deactivate ' + (account.full_name || account.username) + ' (' + account.username + ')? ' +
    'They will no longer be able to log in. Their records and order history are kept. ' +
    'This cannot be undone from the app.';
  deactivateModal.show();
}

staffListBody.addEventListener('click', (event) => {
  const button = event.target.closest('[data-deactivate-id]');
  if (button) {
    askToDeactivate(Number(button.dataset.deactivateId));
  }
});

staffListMessage.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-staff"]')) {
    loadStaff();
  }
});

deactivateConfirmBtn.addEventListener('click', async () => {
  if (pendingDeactivateId === null) {
    return;
  }

  setButtonLoading(deactivateConfirmBtn, true, 'Deactivating...');

  try {
    await api.post('/users/deactivate-staff.php', { id: pendingDeactivateId });
    deactivateModal.hide();
    showToast('Staff account deactivated.');
    loadStaff();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    deactivateError.textContent = error.message;
    deactivateError.classList.remove('d-none');
    if (error.status === 409 || error.status === 404) {
      loadStaff();
    }
  } finally {
    setButtonLoading(deactivateConfirmBtn, false);
  }
});

deactivateModalEl.addEventListener('hidden.bs.modal', () => {
  pendingDeactivateId = null;
});

document.addEventListener('users:shown', loadStaff);
document.getElementById('refreshStaffBtn').addEventListener('click', loadStaff);