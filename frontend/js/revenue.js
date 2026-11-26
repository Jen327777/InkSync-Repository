const REVENUE_DAYS = 7;
const REVENUE_MONTHS = 6;
const LEDGER_LIMIT = 10;

const reportState = { type: 'daily' };
let trendData = null;
let chartMode = 'daily';
let reportRequestId = 0;
let trendRequestId = 0;

const reportTitle = document.getElementById('reportTitle');
const reportPanel = document.getElementById('reportPanel');
const reportDateInput = document.getElementById('reportDate');
const reportMonthInput = document.getElementById('reportMonth');
const dateControl = document.getElementById('dateControl');
const monthControl = document.getElementById('monthControl');
const periodPrevBtn = document.getElementById('periodPrevBtn');
const periodNextBtn = document.getElementById('periodNextBtn');
const periodResetBtn = document.getElementById('periodResetBtn');
const periodTypeButtons = document.querySelectorAll('[data-period-type]');
const revenueChart = document.getElementById('revenueChart');
const chartCaption = document.getElementById('chartCaption');
const sourceBreakdown = document.getElementById('sourceBreakdown');
const ledgerWrap = document.getElementById('ledgerWrap');
const chartButtons = document.querySelectorAll('[data-chart-mode]');

function loadingHtml(text) {
  return '<div class="text-center text-muted py-5">' +
    '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' + text +
    '</div>';
}

function errorHtml(message, action) {
  return '<div class="alert alert-danger d-flex justify-content-between align-items-center mb-0" role="alert">' +
    '<span>' + escapeHtml(message) + '</span>' +
    '<button type="button" class="btn btn-sm btn-outline-danger" data-action="' + action + '">Try again</button>' +
    '</div>';
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function monthKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
}

function parseDateKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dateKey(date) === value ? date : null;
}

function parseMonthKey(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return monthKey(date) === value ? date : null;
}

function buildPeriods() {
  const now = new Date();
  const days = [];
  const months = [];

  for (let offset = REVENUE_DAYS - 1; offset >= 0; offset--) {
    days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset));
  }

  for (let offset = REVENUE_MONTHS - 1; offset >= 0; offset--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - offset, 1));
  }

  return { days, months };
}

function compactPeso(value) {
  if (value >= 1000000) {
    return '₱' + (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return '₱' + (value / 1000).toFixed(value >= 10000 ? 0 : 1) + 'k';
  }
  return '₱' + Math.round(value);
}

function completionTime(order) {
  return String(order.completed_at || order.updated_at);
}

function periodLabel(type, date) {
  const now = new Date();

  if (type === 'daily') {
    const text = date.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return dateKey(date) === dateKey(now) ? text + ' (today)' : text;
  }

  const text = date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long' });
  return monthKey(date) === monthKey(now) ? text + ' (this month)' : text;
}

function readSelectedPeriod() {
  const now = new Date();

  if (reportState.type === 'daily') {
    const date = parseDateKey(reportDateInput.value);
    if (!date) {
      return { error: 'Choose a valid date.' };
    }
    if (dateKey(date) > dateKey(now)) {
      return { error: 'The date cannot be in the future.' };
    }
    return { date };
  }

  const month = parseMonthKey(reportMonthInput.value);
  if (!month) {
    return { error: 'Choose a valid month (YYYY-MM).' };
  }
  if (monthKey(month) > monthKey(now)) {
    return { error: 'The month cannot be in the future.' };
  }
  return { date: month };
}

function initReportInputs() {
  const now = new Date();
  reportDateInput.max = dateKey(now);
  reportMonthInput.max = monthKey(now);
  if (!reportDateInput.value) {
    reportDateInput.value = dateKey(now);
  }
  if (!reportMonthInput.value) {
    reportMonthInput.value = monthKey(now);
  }
}

function updatePeriodControls() {
  const daily = reportState.type === 'daily';
  const selected = readSelectedPeriod();
  const now = new Date();

  periodTypeButtons.forEach((button) => {
    const active = button.dataset.periodType === reportState.type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });

  dateControl.classList.toggle('d-none', !daily);
  monthControl.classList.toggle('d-none', daily);
  periodResetBtn.textContent = daily ? 'Today' : 'This month';
  periodPrevBtn.disabled = Boolean(selected.error);

  if (selected.error) {
    periodNextBtn.disabled = true;
  } else {
    periodNextBtn.disabled = daily
      ? dateKey(selected.date) >= dateKey(now)
      : monthKey(selected.date) >= monthKey(now);
  }
}

function stepPeriod(direction) {
  const selected = readSelectedPeriod();
  if (selected.error) {
    return;
  }

  const base = selected.date;

  if (reportState.type === 'daily') {
    reportDateInput.value = dateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + direction));
  } else {
    reportMonthInput.value = monthKey(new Date(base.getFullYear(), base.getMonth() + direction, 1));
  }

  loadReport();
}

function resetPeriod() {
  const now = new Date();
  reportDateInput.value = dateKey(now);
  reportMonthInput.value = monthKey(now);
  loadReport();
}

function reportCard(title, value, note) {
  return '<div class="col-12 col-sm-6 col-xl-3"><div class="card h-100"><div class="card-body">' +
    '<div class="small text-muted">' + title + '</div>' +
    '<div class="h3 fw-bold mb-1 num">' + value + '</div>' +
    '<div class="small text-muted">' + note + '</div>' +
    '</div></div></div>';
}

function renderReport(revenueReport, volumeReport) {
  const revenue = Number(revenueReport.total_revenue);
  const completed = Number(revenueReport.completed_orders);
  const received = Number(volumeReport.total_orders);
  const average = completed > 0 ? formatPeso(revenue / completed) : '—';

  const breakdown = [
    formatCount(volumeReport.pending) + ' pending',
    formatCount(volumeReport.approved) + ' approved',
    formatCount(volumeReport.in_production) + ' in production',
    formatCount(volumeReport.completed) + ' completed'
  ].join(' · ');

  let notice = '';
  if (completed === 0 && received === 0) {
    notice = 'No orders were logged or completed in this period.';
  } else if (completed === 0) {
    notice = 'No orders were completed in this period. Revenue only counts completed orders.';
  }

  reportPanel.innerHTML =
    '<div class="row g-3">' +
    reportCard('Revenue total', formatPeso(revenue), 'From completed orders') +
    reportCard('Completed orders', formatCount(completed), 'Finished in this period') +
    reportCard('Orders received', formatCount(received), 'Logged in this period: ' + breakdown) +
    reportCard('Average per completed order', average, 'Revenue ÷ completed orders') +
    '</div>' +
    (notice ? '<div class="alert alert-info mt-3 mb-0" role="status">' + notice + '</div>' : '');
}

function describeReportError(error) {
  if (error.status === 403) {
    return 'Only admins can view revenue reports.';
  }
  return error.message;
}

async function loadReport() {
  updatePeriodControls();

  const selected = readSelectedPeriod();
  const daily = reportState.type === 'daily';

  if (selected.error) {
    reportTitle.textContent = '';
    reportPanel.innerHTML = '<div class="alert alert-warning mb-0" role="alert">' + selected.error + '</div>';
    return;
  }

  const requestId = ++reportRequestId;
  const key = daily ? dateKey(selected.date) : monthKey(selected.date);
  const query = daily ? '?date=' + key : '?month=' + key;

  reportTitle.textContent = (daily ? 'Daily report: ' : 'Monthly report: ') + periodLabel(reportState.type, selected.date);
  reportPanel.innerHTML = loadingHtml('Loading report...');

  try {
    const [revenue, volume] = await Promise.all([
      api.get((daily ? '/dashboard/daily-revenue.php' : '/dashboard/monthly-revenue.php') + query),
      api.get('/dashboard/order-volume.php' + query)
    ]);

    if (requestId !== reportRequestId) {
      return;
    }

    renderReport(revenue.report, volume.report);
  } catch (error) {
    if (requestId !== reportRequestId) {
      return;
    }
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    reportPanel.innerHTML = errorHtml(describeReportError(error), 'retry-report');
  }
}

function renderChart() {
  if (!trendData) {
    return;
  }

  const items = trendData[chartMode];

  chartCaption.textContent = chartMode === 'daily'
    ? 'Revenue from orders completed in the last 7 days.'
    : 'Revenue from orders completed in the last 6 months.';

  if (items.every((item) => item.revenue === 0)) {
    revenueChart.innerHTML = '<div class="text-center text-muted py-5">No completed orders in this period yet.</div>';
    return;
  }

  const width = 560;
  const height = 250;
  const left = 52;
  const right = 10;
  const top = 24;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = Math.max(...items.map((item) => item.revenue));
  const step = plotWidth / items.length;
  const barWidth = Math.min(step * 0.6, 52);

  const grid = [0, 0.5, 1].map((fraction) => {
    const y = top + plotHeight - plotHeight * fraction;
    return '<line x1="' + left + '" x2="' + (width - right) + '" y1="' + y + '" y2="' + y + '" stroke="#e2e8f0"/>' +
      '<text x="' + (left - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#64748b">' +
      compactPeso(max * fraction) + '</text>';
  }).join('');

  const bars = items.map((item, index) => {
    const barHeight = item.revenue / max * plotHeight;
    const x = left + step * index + (step - barWidth) / 2;
    const y = top + plotHeight - barHeight;
    const center = x + barWidth / 2;
    const fill = index === items.length - 1 ? '#2563eb' : '#bfdbfe';
    const valueLabel = item.revenue > 0
      ? '<text x="' + center + '" y="' + (y - 6) + '" text-anchor="middle" font-size="11" fill="#334155">' +
        compactPeso(item.revenue) + '</text>'
      : '';

    return '<g><title>' + escapeHtml(item.label) + ': ' + formatPeso(item.revenue) + ' (' + formatCount(item.orders) + ' orders)</title>' +
      '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" rx="4" fill="' + fill + '"/>' +
      valueLabel +
      '<text x="' + center + '" y="' + (height - 12) + '" text-anchor="middle" font-size="11" fill="#64748b">' +
      escapeHtml(item.label) + '</text></g>';
  }).join('');

  revenueChart.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" class="w-100" role="img" ' +
    'aria-label="Bar chart of revenue by ' + (chartMode === 'daily' ? 'day' : 'month') + '">' + grid + bars + '</svg>';
}

async function loadTrends() {
  const requestId = ++trendRequestId;
  const { days, months } = buildPeriods();

  revenueChart.innerHTML = loadingHtml('Loading chart...');

  try {
    const [dailyReports, monthlyReports] = await Promise.all([
      Promise.all(days.map((day) => api.get('/dashboard/daily-revenue.php?date=' + dateKey(day)))),
      Promise.all(months.map((month) => api.get('/dashboard/monthly-revenue.php?month=' + monthKey(month))))
    ]);

    if (requestId !== trendRequestId) {
      return;
    }

    trendData = {
      daily: dailyReports.map((result, index) => ({
        label: index === days.length - 1 ? 'Today' : days[index].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        revenue: Number(result.report.total_revenue),
        orders: result.report.completed_orders
      })),
      monthly: monthlyReports.map((result, index) => ({
        label: index === months.length - 1 ? 'This month' : months[index].toLocaleDateString('en-PH', { month: 'short' }),
        revenue: Number(result.report.total_revenue),
        orders: result.report.completed_orders
      }))
    };

    renderChart();
  } catch (error) {
    if (requestId !== trendRequestId) {
      return;
    }
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    trendData = null;
    revenueChart.innerHTML = errorHtml(describeReportError(error), 'retry-trends');
  }
}

function renderSources() {
  const completed = orders.filter((order) => order.status === 'completed');

  if (completed.length === 0) {
    sourceBreakdown.innerHTML = '<p class="text-muted mb-0">No completed orders yet.</p>';
    return;
  }

  const counts = {};
  completed.forEach((order) => {
    counts[order.order_channel] = (counts[order.order_channel] || 0) + 1;
  });

  sourceBreakdown.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => {
      const percent = Math.round(count / completed.length * 100);
      return '<div class="mb-3">' +
        '<div class="d-flex justify-content-between small"><span>' + escapeHtml(channel) + '</span>' +
        '<span class="num">' + formatCount(count) + ' (' + percent + '%)</span></div>' +
        '<div class="progress" style="height: 8px" role="progressbar" aria-label="' + escapeHtml(channel) + '" ' +
        'aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100">' +
        '<div class="progress-bar" style="width: ' + percent + '%"></div></div></div>';
    }).join('');
}

function renderLedger() {
  const completed = orders
    .filter((order) => order.status === 'completed')
    .sort((a, b) => completionTime(b).localeCompare(completionTime(a)));

  if (completed.length === 0) {
    ledgerWrap.innerHTML = '<p class="text-center text-muted py-4 mb-0">No completed orders yet.</p>';
    return;
  }

  const rows = completed.slice(0, LEDGER_LIMIT).map((order) => {
    const id = Number(order.id);
    return '<tr>' +
      '<td class="fw-semibold num text-nowrap">' + orderNumber(id) + '</td>' +
      '<td><button type="button" class="btn btn-link p-0 fw-semibold text-decoration-none text-start" data-order-id="' + id + '">' +
        escapeHtml(order.customer_name) + '</button></td>' +
      '<td>' + escapeHtml(order.service_type) + '</td>' +
      '<td>' + escapeHtml(order.order_channel) + '</td>' +
      '<td class="text-nowrap">' + escapeHtml(formatDate(completionTime(order))) + '</td>' +
      '<td class="text-end num text-nowrap">' + formatPeso(order.total_amount) + '</td>' +
      '</tr>';
  }).join('');

  const note = completed.length > LEDGER_LIMIT
    ? '<div class="card-footer small text-muted bg-white">Showing ' + LEDGER_LIMIT + ' of ' + formatCount(completed.length) + ' completed orders.</div>'
    : '';

  ledgerWrap.innerHTML =
    '<div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
    '<thead><tr><th scope="col">Order No.</th><th scope="col">Customer</th><th scope="col">Service</th>' +
    '<th scope="col">Source</th><th scope="col">Completed</th><th scope="col" class="text-end">Total</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' + note;
}

function refreshRevenue() {
  initReportInputs();
  loadReport();
  loadTrends();
  renderSources();
  renderLedger();
}

periodTypeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    reportState.type = button.dataset.periodType;
    loadReport();
  });
});

reportDateInput.addEventListener('change', loadReport);
reportMonthInput.addEventListener('change', loadReport);
periodPrevBtn.addEventListener('click', () => stepPeriod(-1));
periodNextBtn.addEventListener('click', () => stepPeriod(1));
periodResetBtn.addEventListener('click', resetPeriod);

chartButtons.forEach((button) => {
  button.addEventListener('click', () => {
    chartMode = button.dataset.chartMode;
    chartButtons.forEach((other) => {
      const active = other.dataset.chartMode === chartMode;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', active);
    });
    renderChart();
  });
});

reportPanel.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-report"]')) {
    loadReport();
  }
});

revenueChart.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-trends"]')) {
    loadTrends();
  }
});

ledgerWrap.addEventListener('click', (event) => {
  const target = event.target.closest('[data-order-id]');
  if (target) {
    openOrderDetail(Number(target.dataset.orderId));
  }
});

document.addEventListener('orders:loaded', () => {
  renderSources();
  renderLedger();
});

document.addEventListener('revenue:shown', refreshRevenue);
document.getElementById('refreshRevenueBtn').addEventListener('click', refreshRevenue);

initReportInputs();
updatePeriodControls();