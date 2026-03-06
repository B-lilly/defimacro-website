// asset.js — depends on data.js being loaded first

// --- Get currency from URL ---
const urlParams = new URLSearchParams(window.location.search);
const symbolParam = (urlParams.get('symbol') || 'ETH').toUpperCase();
const currency = CURRENCIES.find((c) => c.symbol === symbolParam) || CURRENCIES[0];

document.title = `${currency.symbol} ${currency.name} — defimacro`;
document.getElementById('asset-title').textContent = `${currency.symbol} — ${currency.name}`;

// --- Chart Setup ---
let currentType = 'line';
let currentTf = '1M';
let mainSeries = null;

const chartContainer = document.getElementById('chart');
const chart = LightweightCharts.createChart(chartContainer, {
  layout: {
    background: { type: 'solid', color: '#ffffff' },
    textColor: '#000000',
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 15,
  },
  grid: { vertLines: { visible: false }, horzLines: { visible: false } },
  rightPriceScale: {
    borderColor: '#000000', textColor: '#000000', fontSize: 15,
    scaleMargins: { top: 0.1, bottom: 0.1 }, borderVisible: true,
  },
  leftPriceScale: { visible: false },
  timeScale: { borderColor: '#000000', timeVisible: false, fixLeftEdge: true, fixRightEdge: true },
  crosshair: {
    vertLine: { color: '#999999', width: 1, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#333333' },
    horzLine: { color: '#999999', width: 1, style: LightweightCharts.LineStyle.Dashed, labelBackgroundColor: '#333333' },
  },
  handleScroll: true,
  handleScale: true,
});

function getDays() { return getDaysForTf(currentTf); }

let overlays = []; // { currency, metric, series, data, color, priceScaleId }

// --- Overlay Series ---
function renderOverlays() {
  overlays.forEach((o) => { if (o.series) chart.removeSeries(o.series); });
  overlays.forEach((o, idx) => {
    const days = getDays();
    const config = METRIC_CONFIG[o.metric];
    const seed = getMetricSeed(o.currency, o.metric, currentTf);
    o.data = generateMetricData(days, o.currency[config.base], config.vol, seed);
    const scaleId = 'overlay-' + idx;
    const overlay = o;
    o.series = chart.addLineSeries({
      color: o.color, lineWidth: 2,
      crosshairMarkerRadius: 4, crosshairMarkerBorderColor: o.color, crosshairMarkerBackgroundColor: '#ffffff',
      lastValueVisible: false, priceLineVisible: false, priceScaleId: scaleId,
      autoscaleInfoProvider: () => {
        if (overlay.viewMin !== undefined && overlay.viewMax !== undefined) {
          return { priceRange: { minValue: overlay.viewMin, maxValue: overlay.viewMax } };
        }
        return null;
      },
    });
    o.series.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.1 }, autoScale: true });
    o.series.setData(o.data);
  });
}

// --- Custom Left Axes ---
function valueToY(val, viewMin, viewMax, plotTop, plotHeight) {
  if (viewMax === viewMin) return plotTop + plotHeight / 2;
  return plotTop + ((viewMax - val) / (viewMax - viewMin)) * plotHeight;
}

function niceStep(range) {
  const rawStep = range / 5;
  if (rawStep <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  if (norm <= 1.5) return 1 * mag;
  if (norm <= 3.5) return 2 * mag;
  if (norm <= 7.5) return 5 * mag;
  return 10 * mag;
}

function getOverlayView(o) {
  const values = o.data.map((d) => d.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const padding = (dataMax - dataMin) * 0.1;
  if (o.viewMin === undefined) { o.viewMin = dataMin - padding; o.viewMax = dataMax + padding; }
  return { viewMin: o.viewMin, viewMax: o.viewMax };
}

function resetOverlayViews() {
  overlays.forEach((o) => { o.viewMin = undefined; o.viewMax = undefined; });
}

function renderCustomAxes() {
  const container = document.getElementById('custom-axes');
  container.innerHTML = '';
  if (overlays.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'flex';

  const chartHeight = chartContainer.clientHeight;
  const timeScaleHeight = 30;
  const availableHeight = chartHeight - timeScaleHeight;
  const plotTop = availableHeight * 0.1;
  const plotHeight = availableHeight * 0.8;

  overlays.forEach((o) => {
    if (!o.data) return;
    const { viewMin, viewMax } = getOverlayView(o);
    const viewRange = viewMax - viewMin;

    const axisDiv = document.createElement('div');
    axisDiv.className = 'custom-axis';
    axisDiv.style.height = chartHeight + 'px';
    axisDiv.style.cursor = 'ns-resize';

    if (viewRange > 0) {
      const step = niceStep(viewRange);
      const tickStart = Math.ceil(viewMin / step) * step;
      const tickEnd = Math.floor(viewMax / step) * step;
      const decimals = step >= 10 ? 0 : step >= 1 ? 1 : 2;
      for (let val = tickStart; val <= tickEnd + step * 0.001; val += step) {
        const y = valueToY(val, viewMin, viewMax, plotTop, plotHeight);
        if (y < 0 || y > availableHeight) continue;
        const tick = document.createElement('div');
        tick.className = 'axis-tick';
        tick.style.top = y + 'px';
        tick.textContent = val.toFixed(decimals);
        axisDiv.appendChild(tick);
      }
    }

    // Current value badge
    const lastVal = o.data[o.data.length - 1].value;
    const lastY = valueToY(lastVal, viewMin, viewMax, plotTop, plotHeight);
    const config = METRIC_CONFIG[o.metric];
    const label = document.createElement('div');
    label.className = 'axis-current-value';
    label.style.top = Math.max(0, Math.min(availableHeight - 20, lastY)) + 'px';
    const valBox = document.createElement('span');
    valBox.className = 'val-box';
    valBox.style.backgroundColor = o.color;
    valBox.textContent = lastVal.toFixed(2);
    const valLabel = document.createElement('span');
    valLabel.className = 'val-label';
    valLabel.style.backgroundColor = o.color;
    valLabel.textContent = `${o.currency.symbol} ${config.label}`;
    label.appendChild(valBox);
    label.appendChild(valLabel);
    axisDiv.appendChild(label);

    function syncChartScale() {
      if (o.series) {
        o.series.priceScale().applyOptions({ autoScale: false });
        o.series.priceScale().applyOptions({ autoScale: true });
      }
      renderCustomAxes();
    }

    axisDiv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const center = (o.viewMin + o.viewMax) / 2;
      const halfRange = ((o.viewMax - o.viewMin) / 2) * zoomFactor;
      o.viewMin = center - halfRange;
      o.viewMax = center + halfRange;
      syncChartScale();
    }, { passive: false });

    let dragStartY = null, dragStartMin = null, dragStartMax = null;
    axisDiv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragStartY = e.clientY;
      dragStartMin = o.viewMin;
      dragStartMax = o.viewMax;
      const onMove = (e2) => {
        const dy = e2.clientY - dragStartY;
        const zoomFactor = Math.pow(1.005, dy);
        const center = (dragStartMin + dragStartMax) / 2;
        const halfRange = ((dragStartMax - dragStartMin) / 2) * zoomFactor;
        o.viewMin = center - halfRange;
        o.viewMax = center + halfRange;
        syncChartScale();
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    axisDiv.addEventListener('dblclick', () => { o.viewMin = undefined; o.viewMax = undefined; syncChartScale(); });
    container.appendChild(axisDiv);
  });
}

// --- Overlay Management ---
function addOverlay(cur, metric) {
  if (overlays.length >= 2) return;
  if (overlays.find((o) => o.currency.symbol === cur.symbol && o.metric === metric)) return;
  const color = OVERLAY_COLORS[overlays.length];
  overlays.push({ currency: cur, metric, series: null, data: null, color, priceScaleId: 'overlay-' + overlays.length });
  renderChart();
}

function removeOverlay(idx) {
  if (overlays[idx] && overlays[idx].series) chart.removeSeries(overlays[idx].series);
  overlays.splice(idx, 1);
  overlays.forEach((o, i) => { o.color = OVERLAY_COLORS[i]; });
  renderChart();
}

// --- Overlay Tags ---
function updateOverlayTags() {
  const container = document.getElementById('overlay-tags');
  container.innerHTML = '';

  overlays.forEach((o, idx) => {
    const tag = document.createElement('span');
    tag.className = 'overlay-tag';
    tag.style.borderColor = o.color;
    tag.style.color = o.color;
    tag.style.background = o.color + '10';
    const label = document.createElement('span');
    label.textContent = `${o.currency.symbol} ${METRIC_CONFIG[o.metric].label}`;
    const remove = document.createElement('span');
    remove.className = 'remove-overlay';
    remove.textContent = '\u00d7';
    remove.addEventListener('click', (e) => { e.stopPropagation(); removeOverlay(idx); });
    tag.appendChild(label);
    tag.appendChild(remove);
    container.appendChild(tag);
  });

  if (overlays.length < 2) {
    const addWrapper = document.createElement('div');
    addWrapper.className = 'add-metric-wrapper';
    const addBtn = document.createElement('button');
    addBtn.className = 'add-metric-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add metric to chart';
    addBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMetricSearch(addWrapper); });
    addWrapper.appendChild(addBtn);
    container.appendChild(addWrapper);
  }
}

// --- Metric Search Dropdown ---
function buildSearchOptions() {
  const options = [];
  const metrics = ['gdp', 'moneyMultiplier', 'networkYield', 'moneyMarketYield', 'flexRating'];
  CURRENCIES.forEach((cur) => {
    metrics.forEach((metric) => {
      if (overlays.find((o) => o.currency.symbol === cur.symbol && o.metric === metric)) return;
      options.push({
        currency: cur, metric,
        label: `${cur.symbol} ${METRIC_CONFIG[metric].label}`,
        searchText: `${cur.symbol} ${cur.name} ${METRIC_CONFIG[metric].label}`.toLowerCase(),
      });
    });
  });
  return options;
}

function toggleMetricSearch(wrapper) {
  const existing = wrapper.querySelector('.metric-search-dropdown');
  if (existing) { existing.remove(); return; }

  const dropdown = document.createElement('div');
  dropdown.className = 'metric-search-dropdown';
  const input = document.createElement('input');
  input.className = 'metric-search-input';
  input.type = 'text';
  input.placeholder = 'Search currency + metric...';
  input.autocomplete = 'off';
  input.spellcheck = false;
  dropdown.appendChild(input);

  const list = document.createElement('div');
  list.className = 'metric-search-list';
  dropdown.appendChild(list);

  const allOptions = buildSearchOptions();

  function renderResults(query) {
    list.innerHTML = '';
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const filtered = words.length > 0 ? allOptions.filter((o) => words.every((w) => o.searchText.includes(w))) : allOptions;
    filtered.slice(0, 20).forEach((opt) => {
      const item = document.createElement('div');
      item.className = 'metric-search-item';
      item.textContent = opt.label;
      item.addEventListener('click', (e) => { e.stopPropagation(); addOverlay(opt.currency, opt.metric); dropdown.remove(); });
      list.appendChild(item);
    });
    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'metric-search-empty';
      empty.textContent = 'No results';
      list.appendChild(empty);
    }
  }

  input.addEventListener('input', () => { renderResults(input.value); });
  input.addEventListener('click', (e) => { e.stopPropagation(); });
  renderResults('');
  wrapper.appendChild(dropdown);
  requestAnimationFrame(() => { input.focus(); });

  function closeOnOutside(e) {
    if (!wrapper.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', closeOnOutside); }
  }
  setTimeout(() => { document.addEventListener('click', closeOnOutside); }, 0);
}

function renderMainSeries() {
  if (mainSeries) { chart.removeSeries(mainSeries); mainSeries = null; }
  const days = getDays();
  const seed = getPriceSeed(currency, currentTf);
  switch (currentType) {
    case 'line':
      mainSeries = chart.addLineSeries({
        color: '#000000', lineWidth: 3, lastValueVisible: true, priceLineVisible: false, priceScaleId: 'right',
      });
      mainSeries.setData(generateLineData(days, currency.basePrice, currency.volatility, seed));
      break;
    case 'line-area':
      mainSeries = chart.addAreaSeries({
        lineColor: '#000000', topColor: 'rgba(0,0,0,0.15)', bottomColor: 'rgba(0,0,0,0.02)', lineWidth: 3,
        lastValueVisible: true, priceLineVisible: false, priceScaleId: 'right',
      });
      mainSeries.setData(generateLineData(days, currency.basePrice, currency.volatility, seed));
      break;
    case 'bar':
      mainSeries = chart.addBarSeries({ upColor: '#68B8B8', downColor: '#E9072B', thinBars: false, priceScaleId: 'right' });
      mainSeries.setData(generateBarData(days, currency.basePrice, currency.volatility, seed));
      break;
    case 'bar-area':
      mainSeries = chart.addCandlestickSeries({
        upColor: 'rgba(153,217,217,0.25)', downColor: 'rgba(233,7,43,0.15)',
        borderUpColor: '#68B8B8', borderDownColor: '#E9072B', wickUpColor: '#68B8B8', wickDownColor: '#E9072B',
        priceScaleId: 'right',
      });
      mainSeries.setData(generateBarData(days, currency.basePrice, currency.volatility, seed));
      break;
  }
}

function updatePriceDisplay() {
  const days = getDays();
  const seed = getPriceSeed(currency, currentTf);
  const data = generateLineData(days, currency.basePrice, currency.volatility, seed);
  const last = data[data.length - 1];
  const first = data[0];
  document.getElementById('chart-symbol').textContent = currency.pair;
  document.getElementById('current-price').textContent = last.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const change = last.value - first.value;
  const changePct = (change / first.value) * 100;
  const sign = change >= 0 ? '+' : '';
  const changeEl = document.getElementById('price-change');
  changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
  changeEl.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
}

function renderChart() {
  resetOverlayViews();
  renderMainSeries();
  renderOverlays();
  chart.timeScale().fitContent();
  updatePriceDisplay();
  updateOverlayTags();
  requestAnimationFrame(() => { renderCustomAxes(); });
}

// --- Chart Event Listeners ---
document.querySelectorAll('.type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    renderChart();
  });
});

document.querySelectorAll('.tf-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tf-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTf = btn.dataset.tf;
    renderChart();
  });
});

const resizeObserver = new ResizeObserver(() => {
  chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
  renderCustomAxes();
});
resizeObserver.observe(chartContainer);

chart.timeScale().subscribeVisibleLogicalRangeChange(() => { renderCustomAxes(); });

chart.subscribeCrosshairMove((param) => {
  if (!param.time || !param.seriesData || !param.seriesData.size) return;
  const sd = param.seriesData.get(mainSeries);
  if (!sd) return;
  const value = sd.value !== undefined ? sd.value : sd.close;
  if (value === undefined) return;
  document.getElementById('current-price').textContent = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

// ======================================================================
// METRICS TABLES
// ======================================================================

// --- Sample data generation for time periods ---
function genVal(base, vol, seedStr) {
  const rng = seededRandom(hashStr(seedStr));
  return base + (rng() - 0.5) * vol * 2;
}

function pctChange(current, prior) {
  if (prior === 0) return 0;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function fmtNum(v, decimals) {
  if (decimals === undefined) decimals = 2;
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(v) {
  const sign = v >= 0 ? '+' : '';
  return sign + v.toFixed(2) + '%';
}

function fmtPrice(v) {
  return '$' + fmtNum(v, 2);
}

function fmtBig(v) {
  if (Math.abs(v) >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + fmtNum(v, 2);
}

// Generate sample metric values for different time periods
function getMetricTimeSeries(base, vol, key) {
  const today = genVal(base, vol, currency.symbol + key + 'today');
  const priorMonth = genVal(base, vol * 0.8, currency.symbol + key + 'pm');
  const priorQuarter = genVal(base, vol * 1.2, currency.symbol + key + 'pq');
  const prior12 = genVal(base, vol * 1.5, currency.symbol + key + 'py');
  return {
    today,
    priorMonth,
    momPct: pctChange(today, priorMonth),
    priorQuarter,
    qoqPct: pctChange(today, priorQuarter),
    prior12,
    yoyPct: pctChange(today, prior12),
  };
}

// --- Main Metrics Table ---
const MAIN_METRICS = [
  { key: 'price', label: 'Price' },
  { key: 'gdp', label: 'GDP' },
  { key: 'moneyMultiplier', label: 'Money Multiplier' },
  { key: 'yieldIndex', label: 'Yield Index' },
  { key: 'nlSpread', label: 'Network-Lending Spread' },
  { key: 'flexScore', label: 'Flex Score' },
];

const ROW_LABELS = ['Today', 'Prior Month', 'MoM%', 'Prior Quarter', 'QoQ%', 'Prior 12 Month', 'YoY%'];

function getMainMetricData() {
  const data = {};
  // Price
  data.price = getMetricTimeSeries(currency.basePrice, currency.volatility, 'price');
  // GDP
  data.gdp = getMetricTimeSeries(currency.gdp, 2, 'gdp');
  // Money Multiplier
  data.moneyMultiplier = getMetricTimeSeries(currency.moneyMultiplier, 0.3, 'mm');
  // Yield Index (avg of network + money market)
  const yBase = (currency.networkYield + currency.moneyMarketYield) / 2;
  data.yieldIndex = getMetricTimeSeries(yBase, 0.5, 'yi');
  // Network-Lending Spread
  const nlBase = currency.networkYield - currency.moneyMarketYield;
  data.nlSpread = getMetricTimeSeries(nlBase, 0.3, 'nls');
  // Flex Score
  data.flexScore = getMetricTimeSeries(currency.flexRating, 3, 'fs');
  return data;
}

function formatMainMetricVal(key, val) {
  switch (key) {
    case 'price': return fmtPrice(val);
    case 'gdp': return '$' + val.toFixed(1) + 'B';
    case 'moneyMultiplier': return val.toFixed(2) + 'x';
    case 'yieldIndex': return val.toFixed(2) + '%';
    case 'nlSpread': return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
    case 'flexScore': return val.toFixed(0);
    default: return val.toFixed(2);
  }
}

let activeMetricCol = null;
let metricsCollapsed = false;

function renderMetricsTable() {
  const thead = document.getElementById('metrics-thead');
  const tbody = document.getElementById('metrics-tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const data = getMainMetricData();

  // Header
  const tr = document.createElement('tr');
  const thEmpty = document.createElement('th');
  thEmpty.textContent = '';
  tr.appendChild(thEmpty);

  MAIN_METRICS.forEach((m) => {
    const th = document.createElement('th');
    th.textContent = m.label;
    if (activeMetricCol === m.key) th.classList.add('active-col');
    th.addEventListener('click', () => { openDetailTable(m.key); });
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Rows
  const rowKeys = [
    { label: 'Today', valKey: 'today' },
    { label: 'Prior Month', valKey: 'priorMonth' },
    { label: 'MoM%', valKey: 'momPct', isPct: true },
    { label: 'Prior Quarter', valKey: 'priorQuarter' },
    { label: 'QoQ%', valKey: 'qoqPct', isPct: true },
    { label: 'Prior 12 Month', valKey: 'prior12' },
    { label: 'YoY%', valKey: 'yoyPct', isPct: true },
  ];

  rowKeys.forEach((row) => {
    const rtr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.textContent = row.label;
    rtr.appendChild(tdLabel);

    MAIN_METRICS.forEach((m) => {
      const td = document.createElement('td');
      const val = data[m.key][row.valKey];
      if (row.isPct) {
        td.textContent = fmtPct(val);
        td.className = val >= 0 ? 'pct-positive' : 'pct-negative';
      } else {
        td.textContent = formatMainMetricVal(m.key, val);
      }
      rtr.appendChild(td);
    });
    tbody.appendChild(rtr);
  });
}

// --- Collapse/Expand ---
document.getElementById('metrics-collapse-btn').addEventListener('click', () => {
  metricsCollapsed = !metricsCollapsed;
  const body = document.getElementById('metrics-body');
  const btn = document.getElementById('metrics-collapse-btn');
  if (metricsCollapsed) {
    body.classList.add('collapsed');
    btn.classList.add('collapsed');
  } else {
    body.classList.remove('collapsed');
    btn.classList.remove('collapsed');
  }
});

// ======================================================================
// DETAIL TABLES
// ======================================================================

const DETAIL_CONFIGS = {
  price: {
    title: 'Price',
    columns: ['Per Token', 'Marketcap', 'FDV', 'M.C. / FDV'],
    generate: () => {
      const base = currency.basePrice;
      const mcapBase = base * (1e6 + genVal(5e6, 3e6, currency.symbol + 'supply'));
      const fdvBase = mcapBase * (1 + genVal(0.3, 0.2, currency.symbol + 'fdvratio'));
      return {
        'Per Token': makeTimeSeries(base, currency.volatility, 'dt_price', fmtPrice),
        'Marketcap': makeTimeSeries(mcapBase, mcapBase * 0.08, 'dt_mcap', fmtBig),
        'FDV': makeTimeSeries(fdvBase, fdvBase * 0.08, 'dt_fdv', fmtBig),
        'M.C. / FDV': makeTimeSeries(mcapBase / fdvBase, 0.05, 'dt_mcfdv', (v) => v.toFixed(4)),
      };
    },
  },
  gdp: {
    title: 'GDP',
    columns: ['GDP', 'GDP/Active Addresses', 'Total Fees', 'Median Fee', 'Transaction Count'],
    generate: () => {
      const gdpBase = currency.gdp;
      return {
        'GDP': makeTimeSeries(gdpBase, 2, 'dt_gdp', (v) => '$' + v.toFixed(1) + 'B'),
        'GDP/Active Addresses': makeTimeSeries(gdpBase * 0.0001, 0.00003, 'dt_gdpaa', (v) => '$' + v.toFixed(4)),
        'Total Fees': makeTimeSeries(gdpBase * 0.02, 0.005, 'dt_tfees', (v) => '$' + v.toFixed(2) + 'B'),
        'Median Fee': makeTimeSeries(0.0025, 0.001, 'dt_mfee', (v) => '$' + v.toFixed(4)),
        'Transaction Count': makeTimeSeries(1200000, 200000, 'dt_txcount', (v) => (v / 1e6).toFixed(2) + 'M'),
      };
    },
  },
  moneyMultiplier: {
    title: 'Money Multiplier',
    columns: ['MM', 'M1 MM', 'M2 MM', 'M3 MM', 'M0 Supply', '+M1 Supply', '+M2 Supply', '+M3 Supply'],
    generate: () => {
      const mm = currency.moneyMultiplier;
      return {
        'MM': makeTimeSeries(mm, 0.3, 'dt_mm', (v) => v.toFixed(2) + 'x'),
        'M1 MM': makeTimeSeries(mm * 0.4, 0.12, 'dt_m1mm', (v) => v.toFixed(2) + 'x'),
        'M2 MM': makeTimeSeries(mm * 0.7, 0.2, 'dt_m2mm', (v) => v.toFixed(2) + 'x'),
        'M3 MM': makeTimeSeries(mm * 0.9, 0.25, 'dt_m3mm', (v) => v.toFixed(2) + 'x'),
        'M0 Supply': makeTimeSeries(currency.basePrice * 1e5, currency.basePrice * 1e4, 'dt_m0s', fmtBig),
        '+M1 Supply': makeTimeSeries(currency.basePrice * 2e5, currency.basePrice * 2e4, 'dt_m1s', fmtBig),
        '+M2 Supply': makeTimeSeries(currency.basePrice * 4e5, currency.basePrice * 3e4, 'dt_m2s', fmtBig),
        '+M3 Supply': makeTimeSeries(currency.basePrice * 6e5, currency.basePrice * 4e4, 'dt_m3s', fmtBig),
      };
    },
  },
  flexScore: {
    title: 'Flex Score',
    columns: ['Total', 'Demand', 'Supply', 'Yield'],
    generate: () => {
      const fs = currency.flexRating;
      return {
        'Total': makeTimeSeries(fs, 3, 'dt_fstot', (v) => v.toFixed(0)),
        'Demand': makeTimeSeries(fs * 0.3, 1, 'dt_fsdem', (v) => v.toFixed(0)),
        'Supply': makeTimeSeries(fs * 0.35, 1.2, 'dt_fssup', (v) => v.toFixed(0)),
        'Yield': makeTimeSeries(fs * 0.35, 1.1, 'dt_fsyld', (v) => v.toFixed(0)),
      };
    },
  },
};

function makeTimeSeries(base, vol, seedPrefix, formatter) {
  const today = genVal(base, vol, currency.symbol + seedPrefix + 'today');
  const pm = genVal(base, vol * 0.8, currency.symbol + seedPrefix + 'pm');
  const pq = genVal(base, vol * 1.2, currency.symbol + seedPrefix + 'pq');
  const py = genVal(base, vol * 1.5, currency.symbol + seedPrefix + 'py');
  return {
    today, priorMonth: pm, priorQuarter: pq, prior12: py,
    momPct: pctChange(today, pm),
    qoqPct: pctChange(today, pq),
    yoyPct: pctChange(today, py),
    fmt: formatter,
  };
}

// --- Yield detail has a toggle ---
let yieldMode = 'yield'; // 'yield' or 'screener'

function openDetailTable(metricKey) {
  activeMetricCol = metricKey;
  renderMetricsTable(); // re-render to highlight active column

  const section = document.getElementById('detail-section');
  section.style.display = '';

  if (metricKey === 'yieldIndex' || metricKey === 'nlSpread') {
    renderYieldDetail();
  } else {
    renderStandardDetail(metricKey);
  }
}

function renderStandardDetail(metricKey) {
  const config = DETAIL_CONFIGS[metricKey];
  if (!config) return;

  document.getElementById('detail-title').textContent = config.title;
  const body = document.getElementById('detail-body');
  body.innerHTML = '';

  const tableData = config.generate();
  const table = buildDetailTable(config.columns, tableData);
  body.appendChild(table);
}

function buildDetailTable(columns, tableData) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  const thEmpty = document.createElement('th');
  thEmpty.textContent = '';
  htr.appendChild(thEmpty);
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col;
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const rowDefs = [
    { label: 'Today', valKey: 'today' },
    { label: 'Prior Month', valKey: 'priorMonth' },
    { label: 'MoM%', valKey: 'momPct', isPct: true },
    { label: 'Prior Quarter', valKey: 'priorQuarter' },
    { label: 'QoQ%', valKey: 'qoqPct', isPct: true },
    { label: 'Prior 12 Month', valKey: 'prior12' },
    { label: 'YoY%', valKey: 'yoyPct', isPct: true },
  ];

  rowDefs.forEach((row) => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.textContent = row.label;
    tr.appendChild(tdLabel);

    columns.forEach((col) => {
      const td = document.createElement('td');
      const series = tableData[col];
      const val = series[row.valKey];
      if (row.isPct) {
        td.textContent = fmtPct(val);
        td.className = val >= 0 ? 'pct-positive' : 'pct-negative';
      } else {
        td.textContent = series.fmt(val);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

// ======================================================================
// YIELD DETAIL (with toggle)
// ======================================================================

function renderYieldDetail() {
  const titleEl = document.getElementById('detail-title');
  const body = document.getElementById('detail-body');
  body.innerHTML = '';

  // Title with toggle
  titleEl.textContent = '';
  const toggle = document.createElement('div');
  toggle.className = 'yield-toggle';

  const btnYield = document.createElement('button');
  btnYield.className = 'yield-toggle-btn' + (yieldMode === 'yield' ? ' active' : '');
  btnYield.textContent = 'Yield';
  btnYield.addEventListener('click', () => { yieldMode = 'yield'; renderYieldDetail(); });

  const btnScreener = document.createElement('button');
  btnScreener.className = 'yield-toggle-btn' + (yieldMode === 'screener' ? ' active' : '');
  btnScreener.textContent = 'Yield Screener';
  btnScreener.addEventListener('click', () => { yieldMode = 'screener'; renderYieldDetail(); });

  toggle.appendChild(btnYield);
  toggle.appendChild(btnScreener);
  titleEl.appendChild(toggle);

  if (yieldMode === 'yield') {
    renderYieldTable(body);
  } else {
    renderYieldScreener(body);
  }
}

function renderYieldTable(container) {
  const columns = ['Network', 'Lending', 'LP', 'Vault', 'Funding Rate'];
  const tableData = {
    'Network': makeTimeSeries(currency.networkYield, 0.4, 'dt_ynet', (v) => v.toFixed(2) + '%'),
    'Lending': makeTimeSeries(currency.moneyMarketYield, 0.5, 'dt_ylend', (v) => v.toFixed(2) + '%'),
    'LP': makeTimeSeries(genVal(8, 3, currency.symbol + 'lp'), 1.5, 'dt_ylp', (v) => v.toFixed(2) + '%'),
    'Vault': makeTimeSeries(genVal(5, 2, currency.symbol + 'vault'), 1, 'dt_yvault', (v) => v.toFixed(2) + '%'),
    'Funding Rate': makeTimeSeries(genVal(0.01, 0.005, currency.symbol + 'fr'), 0.003, 'dt_yfr', (v) => v.toFixed(4) + '%'),
  };
  const table = buildDetailTable(columns, tableData);
  container.appendChild(table);
}

// ======================================================================
// YIELD SCREENER
// ======================================================================

const TIER_OPTIONS = ['M0', 'M1', 'M2', 'M3'];
const SOURCE_OPTIONS = ['Network', 'Lending', 'LP', 'Vault', 'Funding Rate'];

// Sample protocols/exchanges per source
const SOURCE_PROVIDERS = {
  'Network': ['Native Staking', 'Lido', 'Rocket Pool', 'Coinbase', 'Frax'],
  'Lending': ['Aave v3', 'Morpho', 'Euler', 'Compound v3', 'Spark'],
  'LP': ['Uniswap v3', 'Curve', 'Balancer', 'Camelot', 'Aerodrome'],
  'Vault': ['Yearn', 'Beefy', 'Sommelier', 'Gearbox', 'Pendle'],
  'Funding Rate': ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit'],
};

// Sample asset rows per tier per currency
const TIER_ASSETS = {
  'ETH': {
    'M0': ['ETH'],
    'M1': ['ETH', 'wETH'],
    'M2': ['ETH', 'wETH', 'stETH', 'rETH', 'cbETH'],
    'M3': ['ETH', 'wETH', 'stETH', 'rETH', 'cbETH', 'wstETH', 'mETH'],
  },
  'BTC': {
    'M0': ['BTC'],
    'M1': ['BTC', 'wBTC'],
    'M2': ['BTC', 'wBTC', 'tBTC', 'cbBTC'],
    'M3': ['BTC', 'wBTC', 'tBTC', 'cbBTC', 'sBTC', 'LBTC'],
  },
  'SOL': {
    'M0': ['SOL'],
    'M1': ['SOL', 'mSOL'],
    'M2': ['SOL', 'mSOL', 'stSOL', 'jitoSOL'],
    'M3': ['SOL', 'mSOL', 'stSOL', 'jitoSOL', 'bSOL'],
  },
};

// Default tier assets for currencies not explicitly listed
function getTierAssets(sym, tier) {
  if (TIER_ASSETS[sym] && TIER_ASSETS[sym][tier]) return TIER_ASSETS[sym][tier];
  // Generic fallback
  const base = sym;
  const tiers = {
    'M0': [base],
    'M1': [base, 'w' + base],
    'M2': [base, 'w' + base, 'st' + base],
    'M3': [base, 'w' + base, 'st' + base, 'r' + base],
  };
  return tiers[tier] || [base];
}

let selectedTiers = ['M0'];
let selectedSource = 'Network';

function renderYieldScreener(container) {
  // Controls
  const controls = document.createElement('div');
  controls.className = 'yield-screener-controls';

  // Tier selection (1-4)
  const tierGroup = document.createElement('div');
  tierGroup.className = 'ys-group';
  const tierLabel = document.createElement('span');
  tierLabel.className = 'ys-label';
  tierLabel.textContent = 'Supply Tier:';
  tierGroup.appendChild(tierLabel);

  TIER_OPTIONS.forEach((tier) => {
    const chip = document.createElement('button');
    chip.className = 'ys-chip' + (selectedTiers.includes(tier) ? ' active' : '');
    chip.textContent = tier;
    chip.addEventListener('click', () => {
      if (selectedTiers.includes(tier)) {
        if (selectedTiers.length > 1) {
          selectedTiers = selectedTiers.filter((t) => t !== tier);
        }
      } else {
        if (selectedTiers.length < 4) {
          selectedTiers.push(tier);
          selectedTiers.sort();
        }
      }
      renderYieldDetail();
    });
    tierGroup.appendChild(chip);
  });
  controls.appendChild(tierGroup);

  // Source selection (pick 1)
  const sourceGroup = document.createElement('div');
  sourceGroup.className = 'ys-group';
  const sourceLabel = document.createElement('span');
  sourceLabel.className = 'ys-label';
  sourceLabel.textContent = 'Source:';
  sourceGroup.appendChild(sourceLabel);

  SOURCE_OPTIONS.forEach((src) => {
    const chip = document.createElement('button');
    chip.className = 'ys-chip' + (selectedSource === src ? ' active' : '');
    chip.textContent = src;
    chip.addEventListener('click', () => {
      selectedSource = src;
      renderYieldDetail();
    });
    sourceGroup.appendChild(chip);
  });
  controls.appendChild(sourceGroup);
  container.appendChild(controls);

  // Build table: rows = assets based on selected tiers, columns = providers for selected source
  const allAssets = [];
  selectedTiers.forEach((tier) => {
    const assets = getTierAssets(currency.symbol, tier);
    assets.forEach((a) => {
      if (!allAssets.includes(a)) allAssets.push(a);
    });
  });

  const providers = SOURCE_PROVIDERS[selectedSource] || [];

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  const thAsset = document.createElement('th');
  thAsset.textContent = 'Asset';
  htr.appendChild(thAsset);
  providers.forEach((p) => {
    const th = document.createElement('th');
    th.textContent = p;
    htr.appendChild(th);
  });
  thead.appendChild(htr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  allAssets.forEach((asset) => {
    const tr = document.createElement('tr');
    const tdAsset = document.createElement('td');
    tdAsset.textContent = asset;
    tr.appendChild(tdAsset);

    providers.forEach((provider) => {
      const td = document.createElement('td');
      const yieldVal = genVal(5, 3, currency.symbol + asset + provider + selectedSource);
      td.textContent = Math.max(0, yieldVal).toFixed(2) + '%';
      td.style.color = yieldVal >= 5 ? 'var(--teal-dark)' : 'var(--white)';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// --- Close detail ---
document.getElementById('detail-close-btn').addEventListener('click', () => {
  document.getElementById('detail-section').style.display = 'none';
  activeMetricCol = null;
  renderMetricsTable();
});

// ======================================================================
// INIT
// ======================================================================
renderChart();
renderMetricsTable();
