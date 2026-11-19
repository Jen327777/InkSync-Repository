const NEXT_STATUS = { pending: 'approved', approved: 'in_production', in_production: 'completed' };
const BOARD_STATUSES = ['pending', 'approved', 'in_production', 'completed'];
const BOARD_COMPLETED_LIMIT = 5;

const boardColumns = document.getElementById('boardColumns');
const moveModalEl = document.getElementById('moveConfirmModal');
const moveModal = bootstrap.Modal.getOrCreateInstance(moveModalEl);
const moveConfirmBtn = document.getElementById('moveConfirmBtn');
const moveConfirmText = document.getElementById('moveConfirmText');
const moveConfirmError = document.getElementById('moveConfirmError');

let boardCounts = null;
let pendingMove = null;

function boardCard(order) {
  const id = Number(order.id);
  const next = NEXT_STATUS[order.status];
  const action = next
    ? '<button type="button" class="btn btn-sm btn-outline-primary" data-move-id="' + id + '" data-move-to="' + next + '">' +
      'Move to ' + escapeHtml(STATUS_LABELS[next]) + ' &#10140;</button>'
    : '<span class="small text-muted">Locked</span>';

  return '<div class="card board-card mb-2"><div class="card-body p-3">' +
    '<div class="d-flex justify-content-between align-items-center mb-1">' +
      '<span class="small fw-semibold text-muted num">' + orderNumber(id) + '</span>' +
      '<span class="badge text-bg-light border">' + escapeHtml(order.order_channel) + '</span>' +
    '</div>' +
    '<button type="button" class="btn btn-link p-0 fw-bold text-decoration-none text-start" data-order-id="' + id + '">' +
      escapeHtml(order.customer_name) + '</button>' +
    '<div class="small text-muted">' + escapeHtml(order.quantity) + ' × ' + escapeHtml(order.service_type) + '</div>' +
    '<div class="fw-bold num mt-1">' + formatPeso(order.total_amount) + '</div>' +
    '<div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">' +
      '<span class="small text-muted">Due ' + escapeHtml(formatDate(order.due_date)) + '</span>' + action +
    '</div>' +
    '</div></div>';
}

function boardColumn(status) {
  const label = STATUS_LABELS[status];
  const all = orders.filter((order) => order.status === status);
  const shown = status === 'completed' ? all.slice(0, BOARD_COMPLETED_LIMIT) : all;
  const total = boardCounts ? boardCounts[status] : all.length;

  const body = shown.length
    ? shown.map(boardCard).join('')
    : '<p class="text-center text-muted py-4 mb-0">No ' + label.toLowerCase() + ' orders</p>';

  const note = total > shown.length
    ? '<p class="small text-muted text-center mb-0 mt-2">Showing ' + shown.length + ' of ' + total + '. See Order Logs for the rest.</p>'
    : '';

  return '<div class="col-12 col-md-6 col-xl-3">' +
    '<section class="board-col p-3 h-100" aria-label="' + label + ' orders">' +
      '<div class="d-flex justify-content-between align-items-center mb-3">' +
        '<h2 class="h6 text-uppercase mb-0">' + label + '</h2>' +
        '<span class="badge rounded-pill status-badge status-' + status + ' num">' + total + '</span>' +
      '</div>' + body + note +
    '</section></div>';
}

function renderBoard() {
  boardColumns.innerHTML = '<div class="row g-3">' + BOARD_STATUSES.map(boardColumn).join('') + '</div>';
}

async function refreshBoard() {
  try {
    const data = await api.get('/dashboard/summary.php');
    boardCounts = data.summary;
  } catch (error) {
    boardCounts = null;
  }
  renderBoard();
}

function askToMove(id, nextStatus) {
  const order = orders.find((item) => Number(item.id) === id);
  if (!order) {
    return;
  }

  pendingMove = { id, nextStatus };
  moveConfirmError.classList.add('d-none');

  const lockNote = nextStatus === 'completed'
    ? ' Completed orders are locked permanently and count toward revenue.'
    : '';

  moveConfirmText.textContent = 'Move ' + orderNumber(id) + ' (' + order.customer_name + ') from ' +
    STATUS_LABELS[order.status] + ' to ' + STATUS_LABELS[nextStatus] +
    '? Orders only move forward, so this cannot be undone.' + lockNote;

  moveModal.show();
}

boardColumns.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-board"]')) {
    loadOrders();
    return;
  }

  const move = event.target.closest('[data-move-id]');
  if (move) {
    askToMove(Number(move.dataset.moveId), move.dataset.moveTo);
    return;
  }

  const open = event.target.closest('[data-order-id]');
  if (open) {
    openOrderDetail(Number(open.dataset.orderId));
  }
});

moveConfirmBtn.addEventListener('click', async () => {
  if (!pendingMove) {
    return;
  }

  const { id, nextStatus } = pendingMove;
  setButtonLoading(moveConfirmBtn, true, 'Moving...');

  try {
    await api.post('/orders/update-status.php', { id, status: nextStatus });
    moveModal.hide();
    showToast(orderNumber(id) + ' moved to ' + STATUS_LABELS[nextStatus] + '.');
    document.dispatchEvent(new CustomEvent('orders:changed'));
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    moveConfirmError.textContent = error.message;
    moveConfirmError.classList.remove('d-none');
    if (error.status === 409 || error.status === 422) {
      document.dispatchEvent(new CustomEvent('orders:changed'));
    }
  } finally {
    setButtonLoading(moveConfirmBtn, false);
  }
});

moveModalEl.addEventListener('hidden.bs.modal', () => {
  pendingMove = null;
});

document.addEventListener('orders:loaded', refreshBoard);

document.addEventListener('orders:failed', (event) => {
  boardColumns.innerHTML =
    '<div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">' +
    '<span>' + escapeHtml(event.detail) + '</span>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" data-action="retry-board">Try again</button>' +
    '</div>';
});

document.getElementById('refreshBoardBtn').addEventListener('click', loadOrders);