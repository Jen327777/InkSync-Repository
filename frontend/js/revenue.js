const REVENUE_DAYS = 7;
const REVENUE_MONTHS = 6;
const LEDGER_LIMIT = 10;

let revenueData = null;
let chartMode = 'daily';

const revenueMessage = document.getElementById('revenueMessage');
const revenueContent = document.getElementById('revenueContent');
const revenueKpis = document.getElementById('revenueKpis');
const revenueChart = document.getElementById('revenueChart');
const chartCaption = document.getElementById('chartCaption');
const sourceBreakdown = document.getElementById('sourceBreakdown');
const ledgerWrap = document.getElementById('ledgerWrap');
const chartButtons = document.querySelectorAll('[data-chart-mode]');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function monthKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
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

  return { now, days, months };
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

function setRevenueMessage(html) {
  revenueMessage.innerHTML = html;
  revenueMessage.classList.remove('d-none');
  revenueContent.classList.add('d-none');
}

function kpiCard(title, value, note) {
  return '<div class="col-12 col-sm-6 col-xl-3"><div class="card h-100"><div class="card-body">' +
    '<div class="small text-muted">' + title + '</div>' +
    '<div class="h3 fw-bold mb-1 num">' + value + '</div>' +
    '<div class="small text-muted">' + note + '</div>' +
    '</div></div></div>';
}

function renderKpis() {
  const { daily, monthly, volume } = revenueData;
  const today = daily[daily.length - 1];
  const yesterday = daily[daily.length - 2];
  const month = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];

  revenueKpis.innerHTML =
    kpiCard("Today's revenue", formatPeso(today.revenue), 'Yesterday: ' + formatPeso(yesterday.revenue)) +
    kpiCard('Monthly revenue', formatPeso(month.revenue), 'Last month: ' + formatPeso(lastMonth.revenue)) +
    kpiCard('Completed today', today.orders, 'This month: ' + month.orders) +
    kpiCard(
      'Orders received this month',
      volume.total_orders,
      volume.pending + ' pending · ' + volume.approved + ' approved · ' +
        volume.in_production + ' in production · ' + volume.completed + ' completed'
    );
}

function renderChart() {
  const items = revenueData[chartMode];

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

    return '<g><title>' + escapeHtml(item.label) + ': ' + formatPeso(item.revenue) + ' (' + item.orders + ' orders)</title>' +
      '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + barHeight + '" rx="4" fill="' + fill + '"/>' +
      valueLabel +
      '<text x="' + center + '" y="' + (height - 12) + '" text-anchor="middle" font-size="11" fill="#64748b">' +
      escapeHtml(item.label) + '</text></g>';
  }).join('');

  revenueChart.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" class="w-100" role="img" ' +
    'aria-label="Bar chart of revenue by ' + (chartMode === 'daily' ? 'day' : 'month') + '">' + grid + bars + '</svg>';
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
        '<span class="num">' + count + ' (' + percent + '%)</span></div>' +
        '<div class="progress" style="height: 8px" role="progressbar" aria-label="' + escapeHtml(channel) + '" ' +
        'aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100">' +
        '<div class="progress-bar" style="width: ' + percent + '%"></div></div></div>';
    }).join('');
}

function completionTime(order) {
  return String(order.completed_at || order.updated_at);
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
    ? '<div class="card-footer small text-muted bg-white">Showing ' + LEDGER_LIMIT + ' of ' + completed.length + ' completed orders.</div>'
    : '';

  ledgerWrap.innerHTML =
    '<div class="table-responsive"><table class="table table-hover align-middle mb-0">' +
    '<thead><tr><th scope="col">Order No.</th><th scope="col">Customer</th><th scope="col">Service</th>' +
    '<th scope="col">Source</th><th scope="col">Completed</th><th scope="col" class="text-end">Total</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' + note;
}

function updateChartButtons() {
  chartButtons.forEach((button) => {
    const active = button.dataset.chartMode === chartMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
}

async function loadRevenue() {
  setRevenueMessage(
    '<div class="text-center text-muted py-5">' +
    '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading reports...' +
    '</div>'
  );

  const { now, days, months } = buildPeriods();

  try {
    const [dailyReports, monthlyReports, volumeReport] = await Promise.all([
      Promise.all(days.map((day) => api.get('/dashboard/daily-revenue.php?date=' + dateKey(day)))),
      Promise.all(months.map((month) => api.get('/dashboard/monthly-revenue.php?month=' + monthKey(month)))),
      api.get('/dashboard/order-volume.php?month=' + monthKey(now))
    ]);

    revenueData = {
      daily: dailyReports.map((result, index) => ({
        label: index === days.length - 1 ? 'Today' : days[index].toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        revenue: Number(result.report.total_revenue),
        orders: result.report.completed_orders
      })),
      monthly: monthlyReports.map((result, index) => ({
        label: index === months.length - 1 ? 'This month' : months[index].toLocaleDateString('en-PH', { month: 'short' }),
        revenue: Number(result.report.total_revenue),
        orders: result.report.completed_orders
      })),
      volume: volumeReport.report
    };

    revenueMessage.classList.add('d-none');
    revenueContent.classList.remove('d-none');
    renderKpis();
    renderChart();
    renderSources();
    renderLedger();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    revenueData = null;
    setRevenueMessage(
      '<div class="alert alert-danger d-flex justify-content-between align-items-center" role="alert">' +
      '<span>' + escapeHtml(error.message) + '</span>' +
      '<button type="button" class="btn btn-sm btn-outline-danger" data-action="retry-revenue">Try again</button>' +
      '</div>'
    );
  }
}

chartButtons.forEach((button) => {
  button.addEventListener('click', () => {
    chartMode = button.dataset.chartMode;
    updateChartButtons();
    if (revenueData) {
      renderChart();
    }
  });
});

revenueMessage.addEventListener('click', (event) => {
  if (event.target.closest('[data-action="retry-revenue"]')) {
    loadRevenue();
  }
});

ledgerWrap.addEventListener('click', (event) => {
  const target = event.target.closest('[data-order-id]');
  if (target) {
    openOrderDetail(Number(target.dataset.orderId));
  }
});

document.addEventListener('orders:loaded', () => {
  if (revenueData) {
    renderSources();
    renderLedger();
  }
});

document.addEventListener('revenue:shown', loadRevenue);
document.getElementById('refreshRevenueBtn').addEventListener('click', loadRevenue);