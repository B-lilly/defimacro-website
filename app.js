// app.js — depends on data.js being loaded first

// --- Chart Setup ---
const chartContainer = document.getElementById('chart');

const chart = LightweightCharts.createChart(chartContainer, {
  layout: {
    background: { type: 'solid', color: '#ffffff' },
    textColor: '#000000',
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 15,
  },
  grid: {
    vertLines: { visible: false },
    horzLines: { visible: false },
  },
  rightPriceScale: {
    borderColor: '#000000',
    textColor: '#000000',
    fontSize: 15,
    scaleMargins: { top: 0.1, bottom: 0.1 },
    borderVisible: true,
  },
  leftPriceScale: {
    visible: false,
    borderColor: '#000000',
    textColor: '#000000',
    fontSize: 15,
    scaleMargins: { top: 0.1, bottom: 0.1 },
  },
  timeScale: {
    borderColor: '#000000',
    timeVisible: false,
    fixLeftEdge: true,
    fixRightEdge: true,
  },
  crosshair: {
    vertLine: {
      color: '#999999',
      width: 1,
      style: LightweightCharts.LineStyle.Dashed,
      labelBackgroundColor: '#333333',
    },
    horzLine: {
      color: '#999999',
      width: 1,
      style: LightweightCharts.LineStyle.Dashed,
      labelBackgroundColor: '#333333',
    },
  },
  handleScroll: true,
  handleScale: true,
});

// --- State ---
let currentCurrency = CURRENCIES[0];
let currentType = 'line';
let currentTf = '1M';
let mainSeries = null;
let overlays = []; // { currency, metric, series, data, color, priceScaleId }

function getDays() { return getDaysForTf(currentTf); }
function getPS(c) { return getPriceSeed(c, currentTf); }
function getMS(c, m) { return getMetricSeed(c, m, currentTf); }

// --- Main Series ---
function renderMainSeries() {
  if (mainSeries) { chart.removeSeries(mainSeries); mainSeries = null; }
  const days = getDays();
  const seed = getPS(currentCurrency);

  switch (currentType) {
    case 'line':
      mainSeries = chart.addLineSeries({
        color: '#000000', lineWidth: 3,
        crosshairMarkerRadius: 5, crosshairMarkerBorderColor: '#000000', crosshairMarkerBackgroundColor: '#ffffff',
        lastValueVisible: true, priceLineVisible: false, priceScaleId: 'right',
      });
      mainSeries.setData(generateLineData(days, currentCurrency.basePrice, currentCurrency.volatility, seed));
      break;
    case 'line-area':
      mainSeries = chart.addAreaSeries({
        lineColor: '#000000', topColor: 'rgba(0,0,0,0.15)', bottomColor: 'rgba(0,0,0,0.02)', lineWidth: 3,
        crosshairMarkerRadius: 5, crosshairMarkerBorderColor: '#000000', crosshairMarkerBackgroundColor: '#ffffff',
        lastValueVisible: true, priceLineVisible: false, priceScaleId: 'right',
      });
      mainSeries.setData(generateLineData(days, currentCurrency.basePrice, currentCurrency.volatility, seed));
      break;
    case 'bar':
      mainSeries = chart.addBarSeries({ upColor: '#68B8B8', downColor: '#E9072B', thinBars: false, priceScaleId: 'right' });
      mainSeries.setData(generateBarData(days, currentCurrency.basePrice, currentCurrency.volatility, seed));
      break;
    case 'bar-area':
      mainSeries = chart.addCandlestickSeries({
        upColor: 'rgba(153,217,217,0.25)', downColor: 'rgba(233,7,43,0.15)',
        borderUpColor: '#68B8B8', borderDownColor: '#E9072B', wickUpColor: '#68B8B8', wickDownColor: '#E9072B',
        priceScaleId: 'right',
      });
      mainSeries.setData(generateBarData(days, currentCurrency.basePrice, currentCurrency.volatility, seed));
      break;
  }
}

// --- Overlay Series ---
function renderOverlays() {
  overlays.forEach((o) => { if (o.series) chart.removeSeries(o.series); });

  overlays.forEach((o, idx) => {
    const days = getDays();
    const config = METRIC_CONFIG[o.metric];
    const seed = getMS(o.currency, o.metric);
    o.data = generateMetricData(days, o.currency[config.base], config.vol, seed);

    // Each overlay gets its own priceScaleId for independent auto-scaling
    const scaleId = 'overlay-' + idx;
    const overlay = o; // capture for closure
    o.series = chart.addLineSeries({
      color: o.color,
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: o.color,
      crosshairMarkerBackgroundColor: '#ffffff',
      lastValueVisible: false,
      priceLineVisible: false,
      priceScaleId: scaleId,
      autoscaleInfoProvider: () => {
        if (overlay.viewMin !== undefined && overlay.viewMax !== undefined) {
          return { priceRange: { minValue: overlay.viewMin, maxValue: overlay.viewMax } };
        }
        return null;
      },
    });

    o.series.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.1 },
      autoScale: true,
    });

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
  // If user hasn't zoomed, use auto range with padding
  if (o.viewMin === undefined) {
    o.viewMin = dataMin - padding;
    o.viewMax = dataMax + padding;
  }
  return { viewMin: o.viewMin, viewMax: o.viewMax };
}

function resetOverlayViews() {
  overlays.forEach((o) => { o.viewMin = undefined; o.viewMax = undefined; });
}

function renderCustomAxes() {
  const container = document.getElementById('custom-axes');
  container.innerHTML = '';

  if (overlays.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const chartHeight = chartContainer.clientHeight;
  const timeScaleHeight = 30;
  const availableHeight = chartHeight - timeScaleHeight;
  const plotTop = availableHeight * 0.1;
  const plotHeight = availableHeight * 0.8;

  overlays.forEach((o, idx) => {
    if (!o.data) return;

    const { viewMin, viewMax } = getOverlayView(o);
    const viewRange = viewMax - viewMin;

    const axisDiv = document.createElement('div');
    axisDiv.className = 'custom-axis';
    axisDiv.style.height = chartHeight + 'px';
    axisDiv.style.cursor = 'ns-resize';

    // --- Tick marks ---
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

    // --- Current value badge ---
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

    // Sync chart's overlay scale with our custom view
    function syncChartScale() {
      if (o.series) {
        // Toggle autoScale to force chart to re-read autoscaleInfoProvider
        o.series.priceScale().applyOptions({ autoScale: false });
        o.series.priceScale().applyOptions({ autoScale: true });
      }
      renderCustomAxes();
    }

    // --- Mouse wheel to zoom ---
    axisDiv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const center = (o.viewMin + o.viewMax) / 2;
      const halfRange = ((o.viewMax - o.viewMin) / 2) * zoomFactor;
      o.viewMin = center - halfRange;
      o.viewMax = center + halfRange;
      syncChartScale();
    }, { passive: false });

    // --- Drag to zoom (up = zoom in, down = zoom out) ---
    let dragStartY = null;
    let dragStartMin = null;
    let dragStartMax = null;

    axisDiv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragStartY = e.clientY;
      dragStartMin = o.viewMin;
      dragStartMax = o.viewMax;

      const onMove = (e2) => {
        const dy = e2.clientY - dragStartY;
        // Drag up (negative dy) = zoom in, drag down (positive dy) = zoom out
        const zoomFactor = Math.pow(1.005, dy);
        const center = (dragStartMin + dragStartMax) / 2;
        const halfRange = ((dragStartMax - dragStartMin) / 2) * zoomFactor;
        o.viewMin = center - halfRange;
        o.viewMax = center + halfRange;
        syncChartScale();
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // --- Double-click to reset ---
    axisDiv.addEventListener('dblclick', () => {
      o.viewMin = undefined;
      o.viewMax = undefined;
      syncChartScale();
    });

    container.appendChild(axisDiv);
  });
}

// --- Render All ---
function renderChart() {
  resetOverlayViews();
  renderMainSeries();
  renderOverlays();
  chart.timeScale().fitContent();
  updatePriceDisplay();
  updateOverlayTags();
  updateAddButtons();
  requestAnimationFrame(() => { renderCustomAxes(); });
}

function updatePriceDisplay() {
  const days = getDays();
  const seed = getPS(currentCurrency);
  const data = generateLineData(days, currentCurrency.basePrice, currentCurrency.volatility, seed);
  const last = data[data.length - 1];
  const first = data[0];

  document.getElementById('chart-symbol').textContent = currentCurrency.pair;
  document.getElementById('current-price').textContent = last.value.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const change = last.value - first.value;
  const changePct = (change / first.value) * 100;
  const sign = change >= 0 ? '+' : '';
  const changeEl = document.getElementById('price-change');
  changeEl.textContent = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
  changeEl.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
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

  // Show "+" button if fewer than 2 overlays
  if (overlays.length < 2) {
    const addWrapper = document.createElement('div');
    addWrapper.className = 'add-metric-wrapper';

    const addBtn = document.createElement('button');
    addBtn.className = 'add-metric-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add metric to chart';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMetricSearch(addWrapper);
    });

    addWrapper.appendChild(addBtn);
    container.appendChild(addWrapper);
  }
}

// --- Metric Search Dropdown ---
function buildSearchOptions() {
  const options = [];
  const metrics = ['gdp', 'moneyMultiplier', 'networkYield', 'moneyMarketYield', 'flexRating'];
  CURRENCIES.forEach((currency) => {
    metrics.forEach((metric) => {
      // Skip already added
      if (overlays.find((o) => o.currency.symbol === currency.symbol && o.metric === metric)) return;
      options.push({
        currency,
        metric,
        label: `${currency.symbol} ${METRIC_CONFIG[metric].label}`,
        searchText: `${currency.symbol} ${currency.name} ${METRIC_CONFIG[metric].label}`.toLowerCase(),
      });
    });
  });
  return options;
}

function toggleMetricSearch(wrapper) {
  const existing = wrapper.querySelector('.metric-search-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

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
    const filtered = words.length > 0
      ? allOptions.filter((o) => words.every((w) => o.searchText.includes(w)))
      : allOptions;
    const shown = filtered.slice(0, 20);

    shown.forEach((opt) => {
      const item = document.createElement('div');
      item.className = 'metric-search-item';
      item.textContent = opt.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        addOverlay(opt.currency, opt.metric);
        renderScreener();
        dropdown.remove();
      });
      list.appendChild(item);
    });

    if (shown.length === 0) {
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

  // Focus the input
  requestAnimationFrame(() => { input.focus(); });

  // Close on outside click
  function closeOnOutside(e) {
    if (!wrapper.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeOnOutside);
    }
  }
  setTimeout(() => { document.addEventListener('click', closeOnOutside); }, 0);
}

// --- Overlay Management ---
function addOverlay(currency, metric) {
  if (overlays.length >= 2) return;
  if (overlays.find((o) => o.currency.symbol === currency.symbol && o.metric === metric)) return;

  const colorIdx = overlays.length;
  const color = OVERLAY_COLORS[colorIdx];
  overlays.push({ currency, metric, series: null, data: null, color, priceScaleId: 'overlay-' + colorIdx });
  renderChart();
}

function removeOverlay(idx) {
  if (overlays[idx] && overlays[idx].series) chart.removeSeries(overlays[idx].series);
  overlays.splice(idx, 1);
  overlays.forEach((o, i) => {
    o.color = OVERLAY_COLORS[i];
  });
  renderChart();
}

// --- Screener Sort ---
let sortColumn = null; // null, 'currency', 'price', 'change', or a metric key
let sortDir = 'desc'; // 'asc' or 'desc'

const SCREENER_COLUMNS = [
  { key: 'currency', label: 'Currency', className: 'col-name' },
  { key: 'price', label: 'Price', className: 'col-price' },
  { key: 'change', label: '24h Change', className: 'col-change' },
  { key: 'gdp', label: 'GDP', className: 'col-metric' },
  { key: 'moneyMultiplier', label: 'Money Multiplier', className: 'col-metric' },
  { key: 'networkYield', label: 'Network Yield', className: 'col-metric' },
  { key: 'moneyMarketYield', label: 'Money Market Yield', className: 'col-metric' },
  { key: 'flexRating', label: 'Flex Rating', className: 'col-metric' },
];

function renderScreenerHead() {
  const thead = document.getElementById('screener-head');
  thead.innerHTML = '';
  const tr = document.createElement('tr');
  SCREENER_COLUMNS.forEach((col) => {
    const th = document.createElement('th');
    th.className = col.className + ' sortable-th';
    const wrapper = document.createElement('span');
    wrapper.className = 'th-sort-wrapper';
    wrapper.textContent = col.label;
    const icon = document.createElement('span');
    icon.className = 'sort-icon';
    if (sortColumn === col.key) {
      icon.textContent = sortDir === 'desc' ? ' ▼' : ' ▲';
      icon.classList.add('sort-active');
    } else {
      icon.textContent = ' ⇅';
    }
    wrapper.appendChild(icon);
    th.appendChild(wrapper);
    th.addEventListener('click', () => {
      if (sortColumn === col.key) {
        sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      } else {
        sortColumn = col.key;
        sortDir = col.key === 'currency' ? 'asc' : 'desc';
      }
      renderScreenerHead();
      renderScreener();
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

// --- Screener ---
function renderScreener() {
  const tbody = document.getElementById('screener-body');
  tbody.innerHTML = '';

  // Precompute price/change for sorting
  const rows = CURRENCIES.map((currency) => {
    const days = getDays();
    const seed = getPS(currency);
    const priceData = generateLineData(days, currency.basePrice, currency.volatility, seed);
    const lastPrice = priceData[priceData.length - 1].value;
    const firstPrice = priceData[0].value;
    const change24h = ((lastPrice - firstPrice) / firstPrice) * 100;
    return { currency, lastPrice, change24h };
  });

  if (sortColumn) {
    rows.sort((a, b) => {
      let va, vb;
      if (sortColumn === 'currency') {
        va = a.currency.symbol;
        vb = b.currency.symbol;
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      } else if (sortColumn === 'price') {
        va = a.lastPrice; vb = b.lastPrice;
      } else if (sortColumn === 'change') {
        va = a.change24h; vb = b.change24h;
      } else {
        va = a.currency[sortColumn]; vb = b.currency[sortColumn];
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }

  rows.forEach(({ currency, lastPrice, change24h }) => {
    const tr = document.createElement('tr');
    if (currency.symbol === currentCurrency.symbol) tr.classList.add('active-row');

    tr.addEventListener('click', () => {
      currentCurrency = currency;
      renderChart();
      renderScreener();
    });

    const tdName = document.createElement('td');
    tdName.className = 'col-name';
    const nameLink = document.createElement('a');
    nameLink.className = 'currency-name';
    nameLink.href = `asset.html?symbol=${currency.symbol}`;
    nameLink.innerHTML = `<span class="currency-symbol">${currency.symbol}</span><span class="currency-full">${currency.name}</span>`;
    nameLink.addEventListener('click', (e) => { e.stopPropagation(); });
    tdName.appendChild(nameLink);
    tr.appendChild(tdName);

    const tdPrice = document.createElement('td');
    tdPrice.className = 'col-price';
    tdPrice.style.fontVariantNumeric = 'tabular-nums';
    tdPrice.style.color = '#fff';
    tdPrice.style.fontWeight = '500';
    tdPrice.textContent = '$' + lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    tr.appendChild(tdPrice);

    const tdChange = document.createElement('td');
    tdChange.className = 'col-change ' + (change24h >= 0 ? 'change-positive' : 'change-negative');
    tdChange.textContent = (change24h >= 0 ? '+' : '') + change24h.toFixed(2) + '%';
    tr.appendChild(tdChange);

    ['gdp', 'moneyMultiplier', 'networkYield', 'moneyMarketYield', 'flexRating'].forEach((metric) => {
      const td = document.createElement('td');
      td.className = 'col-metric';
      const cell = document.createElement('div');
      cell.className = 'metric-cell';

      const val = document.createElement('span');
      val.className = 'metric-value';
      if (metric === 'flexRating') val.textContent = currency[metric].toFixed(0);
      else if (metric === 'networkYield' || metric === 'moneyMarketYield') val.textContent = currency[metric].toFixed(2) + '%';
      else if (metric === 'gdp') val.textContent = '$' + currency[metric].toFixed(1) + 'B';
      else val.textContent = currency[metric].toFixed(2) + 'x';

      const addBtn = document.createElement('button');
      addBtn.className = 'add-overlay-btn';
      addBtn.dataset.symbol = currency.symbol;
      addBtn.dataset.metric = metric;
      addBtn.textContent = '+';
      addBtn.title = `Add ${currency.symbol} ${METRIC_CONFIG[metric].label} to chart`;
      if (overlays.length >= 2 || overlays.find((o) => o.currency.symbol === currency.symbol && o.metric === metric)) {
        addBtn.disabled = true;
      }
      addBtn.addEventListener('click', (e) => { e.stopPropagation(); addOverlay(currency, metric); renderScreener(); });

      cell.appendChild(val);
      cell.appendChild(addBtn);
      td.appendChild(cell);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function updateAddButtons() {
  document.querySelectorAll('.add-overlay-btn').forEach((btn) => {
    const sym = btn.dataset.symbol;
    const metric = btn.dataset.metric;
    btn.disabled = overlays.length >= 2 || !!overlays.find((o) => o.currency.symbol === sym && o.metric === metric);
  });
}

// --- Crosshair ---
chart.subscribeCrosshairMove((param) => {
  if (!param.time || !param.seriesData || !param.seriesData.size) return;
  const sd = param.seriesData.get(mainSeries);
  if (!sd) return;
  const value = sd.value !== undefined ? sd.value : sd.close;
  if (value === undefined) return;
  document.getElementById('current-price').textContent = value.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
});

// --- Event Listeners ---
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
    renderScreener();
  });
});

// --- Resize ---
const resizeObserver = new ResizeObserver(() => {
  chart.applyOptions({ width: chartContainer.clientWidth, height: chartContainer.clientHeight });
  renderCustomAxes();
});
resizeObserver.observe(chartContainer);

// --- Keep custom axes in sync with chart scroll/zoom ---
chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
  renderCustomAxes();
});

// --- Init ---
renderChart();
renderScreenerHead();
renderScreener();
