const ORDER_MAX_PAGES = 10;
let ordersTruncated = false;

let orders = [];

const ORDER_PAGE_SIZE = 10;
const orderFilters = { query: '', status: '', page: 1 };

const orderListMessage = document.getElementById('orderListMessage');
const orderListWrap = document.getElementById('orderListWrap');
const orderListBody = document.getElementById('orderListBody');
const orderListNote = document.getElementById('orderListNote');
const orderToolbar = document.getElementById('orderToolbar');
const orderSearch = document.getElementById('orderSearch');
const orderStatusFilter = document.getElementById('orderStatusFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const orderListSummary = document.getElementById('orderListSummary');
const orderPrevBtn = document.getElementById('orderPrevBtn');
const orderNextBtn = document.getElementById('orderNextBtn');
const orderPageLabel = document.getElementById('orderPageLabel');
const orderDetailEditBtn = document.getElementById('orderDetailEditBtn');

let detailOrderId = null;
function showListMessage(html) {
  orderListMessage.innerHTML = html;
  orderListMessage.classList.remove('d-none');
  orderListWrap.classList.add('d-none');
}

function showListTable() {
  orderListMessage.classList.add('d-none');
  orderListWrap.classList.remove('d-none');
}

function orderRow(order) {
  const id = Number(order.id);
  return '<tr class="order-row" data-order-id="' + id + '">' +
    '<td class="fw-semibold num text-nowrap">' + orderNumber(id) + '</td>' +
    '<td><button type="button" class="btn btn-link p-0 fw-semibold text-decoration-none text-start" data-order-id="' + id + '">' +
      escapeHtml(order.customer_name) + '</button></td>' +
    '<td>' + escapeHtml(order.service_type) + '</td>' +
    '<td class="text-end num text-nowrap">' + formatPeso(order.total_amount) + '</td>' +
    '<td class="text-nowrap">' + escapeHtml(formatDate(order.created_at)) + '</td>' +
    '<td>' + statusBadge(order.status) + '</td>' +
    '</tr>';
}

function hasActiveFilters() {
  return Boolean(orderFilters.query.trim() || orderFilters.status);
}

function matchesFilters(order) {
  if (orderFilters.status && order.status !== orderFilters.status) {
    return false;
  }

  const query = orderFilters.query.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [
    orderNumber(order.id),
    order.customer_name,
    order.customer_phone,
    order.customer_email,
    order.service_type
  ].join(' ').toLowerCase().includes(query);
}

function resetFilters() {
  orderFilters.query = '';
  orderFilters.status = '';
  orderFilters.page = 1;
  orderSearch.value = '';
  orderStatusFilter.value = '';
  renderOrderList();
}

function renderOrderList() {
  orderToolbar.classList.toggle('d-none', orders.length === 0);
  clearFiltersBtn.classList.toggle('d-none', !hasActiveFilters());

  if (orders.length === 0) {
    showListMessage(
      '<div class="text-center text-muted py-5">' +
      '<p class="fw-semibold mb-1">No orders yet</p>' +
      '<p class="mb-0">Click "+ Log New Order" to add the first one.</p>' +
      '</div>'
    );
    return;
  }

  const filtered = orders.filter(matchesFilters);

  if (filtered.length === 0) {
    const limited = ordersTruncated
  ? '<p class="small">Only the most recent orders and all unfinished orders are searched.</p>'
  : '';
    showListMessage(
      '<div class="text-center text-muted py-5">' +
      '<p class="fw-semibold mb-1">No orders match your search</p>' +
      '<p class="mb-2">Try a different name, order number or status.</p>' + limited +
      '<button type="button" class="btn btn-outline-primary btn-sm" data-action="clear-filters">Clear filters</button>' +
      '</div>'
    );
    return;
  }

  const pageCount = Math.ceil(filtered.length / ORDER_PAGE_SIZE);
  orderFilters.page = Math.min(Math.max(orderFilters.page, 1), pageCount);
  const start = (orderFilters.page - 1) * ORDER_PAGE_SIZE;
  const end = Math.min(start + ORDER_PAGE_SIZE, filtered.length);

  orderListBody.innerHTML = filtered.slice(start, end).map(orderRow).join('');
  orderListSummary.textContent = 'Showing ' + (start + 1) + '–' + end + ' of ' + filtered.length +
    (hasActiveFilters() ? ' matching' : '') + ' orders';
  orderPageLabel.textContent = 'Page ' + orderFilters.page + ' of ' + pageCount;
  orderPrevBtn.disabled = orderFilters.page <= 1;
  orderNextBtn.disabled = orderFilters.page >= pageCount;
  orderListNote.classList.toggle('d-none', !ordersTruncated);
  showListTable();
}


async function fetchOrderPages(filter) {
  const rows = [];
  let offset = 0;

  for (let page = 0; page < ORDER_MAX_PAGES; page++) {
    const query = '?offset=' + offset + (filter ? '&status=' + filter : '');
    const data = await api.get('/orders/list.php' + query);
    rows.push(...data.orders);
    if (!data.has_more) {
      return { rows, complete: true };
    }
    offset = data.next_offset;
  }

  return { rows, complete: false };
}

async function fetchAllOrders() {
  const [recent, unfinished] = await Promise.all([fetchOrderPages(''), fetchOrderPages('unfinished')]);
  const byId = new Map();

  [...recent.rows, ...unfinished.rows].forEach((order) => byId.set(Number(order.id), order));

  const merged = [...byId.values()].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)) || Number(b.id) - Number(a.id)
  );

  return { orders: merged, truncated: !recent.complete };
}


async function loadOrders() {
  showListMessage(
    '<div class="text-center text-muted py-5">' +
    '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading orders...' +
    '</div>'
  );

  try {
    const result = await fetchAllOrders();
orders = result.orders;
ordersTruncated = result.truncated;
    renderOrderList();
    document.dispatchEvent(new CustomEvent('orders:loaded'));
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    document.dispatchEvent(new CustomEvent('orders:failed', { detail: error.message }));
    showListMessage(
      '<div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">' +
      '<span>' + escapeHtml(error.message) + '</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" data-action="retry-orders">Try again</button>' +
      '</div>'
    );
  }
}

function detailRow(label, value, valueClass = '') {
  const text = value === null || value === undefined || value === '' ? '—' : value;
  return '<dt class="col-sm-4 fw-normal text-muted">' + label + '</dt>' +
    '<dd class="col-sm-8 mb-2 ' + valueClass + '">' + escapeHtml(text) + '</dd>';
}

function detailSection(title, rows) {
  return '<h3 class="h6 text-uppercase text-muted mt-3">' + title + '</h3>' +
    '<dl class="row mb-0">' + rows.join('') + '</dl>';
}

function openOrderDetail(id) {
  const order = orders.find((item) => Number(item.id) === id);
  if (!order) {
    return;
  }

  const hasDiscount = Number(order.discount_amount) > 0;
  const isDelivery = order.fulfillment_method === 'delivery';

  const fulfillmentRows = [
    detailRow('Due date', formatDate(order.due_date)),
    detailRow('Method', isDelivery ? 'Delivery' : 'Pickup')
  ];
  if (isDelivery) {
    fulfillmentRows.push(detailRow('Address', order.delivery_address, 'pre-line'));
  }

  document.getElementById('orderDetailTitle').textContent = 'Order ' + orderNumber(order.id);
  document.getElementById('orderDetailBody').innerHTML =
        '<div>' + statusBadge(order.status) +
      (order.status === 'completed' ? ' <span class="small text-muted ms-2">Locked: completed orders cannot be changed.</span>' : '') +
    '</div>' +
    detailSection('Customer', [
      detailRow('Name', order.customer_name),
      detailRow('Phone', order.customer_phone),
      detailRow('Email', order.customer_email)
    ]) +
    detailSection('Order', [
      detailRow('Source', order.order_channel),
      detailRow('Service', order.service_type),
      detailRow('Quantity', order.quantity),
      detailRow('Unit price', formatPeso(order.unit_price), 'num'),
      detailRow('Discount', hasDiscount ? formatPeso(order.discount_amount) : 'None', 'num'),
      detailRow('Total', formatPeso(order.total_amount), 'num fw-bold')
    ]) +
    detailSection('Fulfillment', fulfillmentRows) +
    detailSection('Description', [
      '<dd class="col-12 mb-2 pre-line">' + escapeHtml(order.description || '—') + '</dd>'
    ]) +
    detailSection('Record', [
      detailRow('Logged by', order.created_by_username),
      detailRow('Date logged', formatDate(order.created_at))
    ]);

    detailOrderId = Number(order.id);
orderDetailEditBtn.classList.toggle('d-none', order.status === 'completed');

  bootstrap.Modal.getOrCreateInstance(document.getElementById('orderDetailModal')).show();
}

orderListBody.addEventListener('click', (event) => {
  const target = event.target.closest('[data-order-id]');
  if (target) {
    openOrderDetail(Number(target.dataset.orderId));
  }
});

orderListMessage.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-orders"]')) {
    loadOrders();
  }
  if (event.target.closest('[data-action="clear-filters"]')) {
    resetFilters();
  }
});

document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);
document.addEventListener('orders:changed', loadOrders);

orderSearch.addEventListener('input', (event) => {
  orderFilters.query = event.target.value;
  orderFilters.page = 1;
  renderOrderList();
});

orderStatusFilter.addEventListener('change', (event) => {
  orderFilters.status = event.target.value;
  orderFilters.page = 1;
  renderOrderList();
});

clearFiltersBtn.addEventListener('click', resetFilters);

orderPrevBtn.addEventListener('click', () => {
  orderFilters.page -= 1;
  renderOrderList();
});

orderNextBtn.addEventListener('click', () => {
  orderFilters.page += 1;
  renderOrderList();
});


orderDetailEditBtn.addEventListener('click', () => {
  const id = detailOrderId;
  const modalEl = document.getElementById('orderDetailModal');

  if (id === null) {
    return;
  }

  modalEl.addEventListener('hidden.bs.modal', () => {
    openOrderEditor(id);
  }, { once: true });

  bootstrap.Modal.getOrCreateInstance(modalEl).hide();
});
