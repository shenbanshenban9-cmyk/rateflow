import { CURRENCIES, QUICK_PAIRS, findCurrency, searchCurrencies } from './currencies.js';
import {
  PERIODS,
  PERIOD_ORDER,
  RateApiError,
  cacheKey,
  fetchLatestRate,
  fetchRateSeries,
  formatDataDate,
  formatHeaderDate,
  formatPercent,
  formatRate,
  formatSignedRate,
  formatUpdateTime,
  parseAmount,
  relativeTime,
  sanitizeAmountInput,
  seriesStats,
} from './core.js';
import { RateChart } from './chart.js';

const PREFS_KEY = 'rateflow:prefs:v1';
const LATEST_TTL = 10 * 60 * 1000;
const SERIES_TTL = 30 * 60 * 1000;
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const $ = (id) => document.getElementById(id);

const elements = {
  refreshButton: $('refreshButton'),
  liveDot: $('liveDot'),
  syncLabel: $('syncLabel'),
  headerDate: $('headerDate'),
  amountInput: $('amountInput'),
  baseSymbol: $('baseSymbol'),
  baseFlag: $('baseFlag'),
  baseCode: $('baseCode'),
  basePicker: $('basePicker'),
  quoteFlag: $('quoteFlag'),
  quoteCode: $('quoteCode'),
  quotePicker: $('quotePicker'),
  swapButton: $('swapButton'),
  resultAmount: $('resultAmount'),
  resultCaption: $('resultCaption'),
  rateDataDate: $('rateDataDate'),
  unitRate: $('unitRate'),
  inverseRate: $('inverseRate'),
  converterChange: $('converterChange'),
  quickPairs: $('quickPairs'),
  chartBase: $('chartBase'),
  chartQuote: $('chartQuote'),
  chartBaseInline: $('chartBaseInline'),
  chartRate: $('chartRate'),
  chartChange: $('chartChange'),
  rangeChange: $('rangeChange'),
  rangeHigh: $('rangeHigh'),
  rangeLow: $('rangeLow'),
  rangeLabel: $('rangeLabel'),
  chartUpdated: $('chartUpdated'),
  chartLoading: $('chartLoading'),
  chartError: $('chartError'),
  chartErrorMessage: $('chartErrorMessage'),
  chartRetry: $('chartRetry'),
  chartEmpty: $('chartEmpty'),
  chartWrap: $('chartWrap'),
  chartTooltip: $('chartTooltip'),
  rateChart: $('rateChart'),
  segments: [...document.querySelectorAll('.segment')],
  segmentThumb: document.querySelector('.segment-thumb'),
  footerStatus: $('footerStatus'),
  sourceButton: $('sourceButton'),
  sheetBackdrop: $('sheetBackdrop'),
  pickerSheet: $('pickerSheet'),
  pickerTitle: $('pickerTitle'),
  pickerClose: $('pickerClose'),
  pickerSearch: $('pickerSearch'),
  currencyList: $('currencyList'),
  toast: $('toast'),
};

const state = {
  base: 'USD',
  quote: 'CNY',
  amount: '100',
  period: 'day',
  latest: null,
  series: null,
  latestLoading: false,
  seriesLoading: false,
  refreshing: false,
  latestCacheFallback: false,
  seriesCacheFallback: false,
  latestError: null,
  seriesError: null,
  latestRequest: 0,
  seriesRequest: 0,
  latestController: null,
  seriesController: null,
  pickerTarget: null,
  lastFocus: null,
  toastTimer: null,
  prefsTimer: null,
  autoTimer: null,
  statusTimer: null,
};

let chart;

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota should not stop the converter.
  }
}

function loadPrefs() {
  const prefs = readStorage(PREFS_KEY);
  if (!prefs) return;
  if (findCurrency(prefs.base)?.code === prefs.base) state.base = prefs.base;
  if (findCurrency(prefs.quote)?.code === prefs.quote) state.quote = prefs.quote;
  if (typeof prefs.amount === 'string') state.amount = sanitizeAmountInput(prefs.amount) || '0';
  if (PERIODS[prefs.period]) state.period = prefs.period;
}

function savePrefsSoon() {
  clearTimeout(state.prefsTimer);
  state.prefsTimer = setTimeout(() => {
    writeStorage(PREFS_KEY, {
      base: state.base,
      quote: state.quote,
      amount: state.amount,
      period: state.period,
    });
  }, 120);
}

function cachedLatest() {
  const entry = readStorage(cacheKey('latest', state.base, state.quote));
  if (!entry?.data || !Number.isFinite(entry.data.rate)) return null;
  return entry;
}

function cachedSeries(period = state.period) {
  const entry = readStorage(cacheKey('series', state.base, state.quote, period));
  if (!entry?.data?.points?.length) return null;
  return entry;
}

function saveLatestCache(data) {
  writeStorage(cacheKey('latest', state.base, state.quote), {
    savedAt: Date.now(),
    data,
  });
}

function saveSeriesCache(data) {
  writeStorage(cacheKey('series', state.base, state.quote, state.period), {
    savedAt: Date.now(),
    data,
  });
}

function currentPairLabel() {
  return `${state.base} / ${state.quote}`;
}

function showToast(message, duration = 2200) {
  clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  state.toastTimer = setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, duration);
}

function setStatus(kind, label) {
  elements.liveDot.classList.toggle('is-offline', kind === 'offline');
  elements.liveDot.classList.toggle('is-error', kind === 'error');
  elements.syncLabel.textContent = label;
}

function setChangePill(element, percent, { prefix = '' } = {}) {
  element.classList.remove('is-up', 'is-down', 'is-neutral');
  if (!Number.isFinite(percent) || percent === 0) {
    element.classList.add('is-neutral');
    element.textContent = Number.isFinite(percent) ? `${prefix}0.00%` : '—';
    return;
  }
  element.classList.add(percent > 0 ? 'is-up' : 'is-down');
  element.textContent = `${prefix}${formatPercent(percent)}`;
}

function formatBigAmount(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function setRefreshLoading() {
  elements.refreshButton.classList.toggle(
    'is-loading',
    state.latestLoading || state.seriesLoading || state.refreshing,
  );
}

function renderPair() {
  const base = findCurrency(state.base);
  const quote = findCurrency(state.quote);

  elements.baseSymbol.textContent = base.symbol;
  elements.baseFlag.textContent = base.flag;
  elements.baseCode.textContent = base.code;
  elements.basePicker.setAttribute('aria-label', `付款币种：${base.zh} ${base.code}，点按更换`);
  elements.quoteFlag.textContent = quote.flag;
  elements.quoteCode.textContent = quote.code;
  elements.quotePicker.setAttribute('aria-label', `收款币种：${quote.zh} ${quote.code}，点按更换`);
  elements.resultCaption.textContent = `${quote.zh} · ${quote.code}`;

  elements.chartBase.textContent = base.code;
  elements.chartQuote.textContent = quote.code;
  elements.chartBaseInline.textContent = base.code;

  elements.quickPairs.querySelectorAll('.quick-chip').forEach((chip) => {
    const isActive = chip.dataset.base === state.base && chip.dataset.quote === state.quote;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
}

function renderLatest() {
  const latest = state.latest;
  if (!latest || latest.base !== state.base || latest.quote !== state.quote) {
    elements.resultAmount.textContent = '—';
    elements.unitRate.textContent = '正在获取汇率…';
    elements.inverseRate.textContent = '—';
    elements.rateDataDate.textContent = '数据同步中';
    elements.chartRate.textContent = '—';
    return;
  }

  const amount = parseAmount(state.amount);
  const converted = amount * latest.rate;
  elements.resultAmount.textContent = formatBigAmount(converted);
  elements.resultAmount.title = `${formatBigAmount(converted)} ${latest.quote}`;
  elements.unitRate.textContent = `1 ${latest.base} = ${formatRate(latest.rate)} ${latest.quote}`;
  const inverse = latest.rate === 0 ? NaN : 1 / latest.rate;
  elements.inverseRate.textContent = `1 ${latest.quote} = ${formatRate(inverse)} ${latest.base}`;
  elements.rateDataDate.textContent = latest.date
    ? `数据日期 ${formatDataDate(latest.date)}`
    : '最新中间价';
  elements.chartRate.textContent = formatRate(latest.rate);
}

function renderSeriesMeta() {
  const points = state.series?.points;
  if (!points?.length) {
    elements.rangeChange.textContent = '—';
    elements.rangeChange.className = 'stat-value';
    elements.rangeHigh.textContent = '—';
    elements.rangeLow.textContent = '—';
    elements.converterChange.className = 'change-pill is-neutral';
    elements.converterChange.textContent = '—';
    elements.chartChange.className = 'change-pill is-neutral';
    elements.chartChange.textContent = '—';
    return;
  }

  const stats = seriesStats(points);
  const prefix = state.series.base === state.base ? '' : '';
  const changeText = `${formatSignedRate(stats.change)} · ${formatPercent(stats.changePercent)}`;
  elements.rangeChange.textContent = changeText;
  elements.rangeChange.className = `stat-value ${stats.rising ? 'is-up' : 'is-down'}`;
  elements.rangeHigh.textContent = formatRate(stats.high);
  elements.rangeLow.textContent = formatRate(stats.low);
  setChangePill(elements.converterChange, stats.changePercent, { prefix });
  setChangePill(elements.chartChange, stats.changePercent, { prefix });

  const period = PERIODS[state.period];
  elements.rangeLabel.textContent = `${period.rangeLabel} · ${period.title}`;
  const fetchedAt = state.series.fetchedAt;
  elements.chartUpdated.textContent = fetchedAt
    ? `更新于 ${formatUpdateTime(fetchedAt)}`
    : '等待更新';
}

function setChartState(kind) {
  elements.chartLoading.hidden = kind !== 'loading';
  elements.chartError.hidden = kind !== 'error';
  elements.chartEmpty.hidden = kind !== 'empty';
  elements.chartWrap.hidden = kind !== 'ready';
}

function renderChart({ animate = true } = {}) {
  const points = state.series?.points;
  if (!points?.length) {
    setChartState('loading');
    return;
  }

  if (state.base === state.quote) {
    setChartState('empty');
    renderSeriesMeta();
    return;
  }

  setChartState('ready');
  chart.setData(points, {
    period: state.period,
    rising: seriesStats(points).rising,
  });
  if (!animate) {
    elements.rateChart.querySelectorAll('.chart-line, .chart-area').forEach((node) => {
      node.style.animation = 'none';
    });
  }
  renderSeriesMeta();
}

function applyCachedData() {
  const latestEntry = cachedLatest();
  state.latest = latestEntry?.data ?? null;
  const seriesEntry = cachedSeries();
  state.series = seriesEntry ? { ...seriesEntry.data, base: state.base, quote: state.quote, period: state.period } : null;

  if (state.series?.points?.length) {
    renderChart({ animate: false });
  } else {
    setChartState('loading');
  }
  renderLatest();
  renderSeriesMeta();
}

function isFresh(entry, ttl) {
  return Boolean(entry?.savedAt && Date.now() - entry.savedAt < ttl);
}

function updateSyncLabel() {
  if (!navigator.onLine) {
    setStatus('offline', '离线数据');
    return;
  }
  if (state.latestError && !state.latest) {
    setStatus('error', '同步失败');
    return;
  }
  if (state.latestLoading || state.seriesLoading) {
    setStatus('normal', state.latest ? '正在刷新' : '正在同步汇率');
    return;
  }
  if (state.latestCacheFallback || state.seriesCacheFallback) {
    setStatus('offline', '缓存数据');
    return;
  }
  if (state.latestError || state.seriesError) {
    setStatus('error', '部分数据未更新');
    return;
  }
  setStatus('normal', '最新参考汇率');
}

function updateFooter() {
  const timestamp = state.latest?.fetchedAt || state.series?.fetchedAt;
  if (!timestamp) {
    elements.footerStatus.textContent = navigator.onLine ? '正在连接汇率服务' : '当前离线';
    return;
  }
  elements.footerStatus.textContent = `${relativeTime(timestamp)} · 每 5 分钟同步`;
}

function updateAges() {
  updateHeaderDate();
  updateFooter();
  if (state.series?.fetchedAt) {
    elements.chartUpdated.textContent = `更新于 ${formatUpdateTime(state.series.fetchedAt)}`;
  }
}

async function loadLatest({ force = false, quiet = false } = {}) {
  const pairBase = state.base;
  const pairQuote = state.quote;
  const request = ++state.latestRequest;
  state.latestController?.abort();
  const controller = new AbortController();
  state.latestController = controller;

  state.latestLoading = true;
  state.latestError = null;
  setRefreshLoading();
  updateSyncLabel();

  try {
    const data = await fetchLatestRate(pairBase, pairQuote, { signal: controller.signal });
    if (request !== state.latestRequest || pairBase !== state.base || pairQuote !== state.quote) {
      return false;
    }
    state.latest = data;
    state.latestCacheFallback = false;
    saveLatestCache(data);
    renderLatest();
    renderSeriesMeta();
    updateFooter();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    if (request !== state.latestRequest) return false;
    state.latestError = error instanceof RateApiError ? error.message : '汇率获取失败';
    const cached = cachedLatest();
    if (cached?.data) {
      state.latest = cached.data;
      state.latestCacheFallback = true;
      renderLatest();
      updateSyncLabel();
      if (!quiet) showToast('网络不佳，正在显示最近一次汇率');
    } else {
      state.latestCacheFallback = false;
      state.latest = null;
      renderLatest();
      setStatus('error', '同步失败');
      elements.resultAmount.textContent = '—';
      elements.unitRate.textContent = state.latestError;
      if (!quiet) showToast(state.latestError);
    }
    return false;
  } finally {
    if (request === state.latestRequest) {
      state.latestLoading = false;
      state.latestController = null;
      setRefreshLoading();
      updateSyncLabel();
      updateFooter();
    }
  }
}

async function loadSeries({ force = false, quiet = false } = {}) {
  const pairBase = state.base;
  const pairQuote = state.quote;
  const periodKey = state.period;
  const period = PERIODS[periodKey];
  const request = ++state.seriesRequest;
  state.seriesController?.abort();
  const controller = new AbortController();
  state.seriesController = controller;

  const cached = cachedSeries(periodKey);
  if (!force && cached?.data && isFresh(cached, SERIES_TTL)) {
    state.series = { ...cached.data, base: pairBase, quote: pairQuote, period: periodKey };
    state.seriesLoading = false;
    renderChart({ animate: false });
    updateSyncLabel();
    updateFooter();
    return true;
  }

  state.seriesLoading = true;
  state.seriesError = null;
  setRefreshLoading();
  updateSyncLabel();

  if (!state.series?.points?.length) setChartState('loading');

  try {
    const data = await fetchRateSeries(pairBase, pairQuote, periodKey, { signal: controller.signal });
    if (
      request !== state.seriesRequest
      || pairBase !== state.base
      || pairQuote !== state.quote
      || periodKey !== state.period
    ) {
      return false;
    }
    if (!data.points.length) throw new RateApiError('该区间没有可用的汇率数据');
    state.series = { ...data, base: pairBase, quote: pairQuote, period: periodKey };
    state.seriesCacheFallback = false;
    saveSeriesCache(data);
    renderChart();
    updateFooter();
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') return false;
    if (request !== state.seriesRequest) return false;
    state.seriesError = error instanceof RateApiError ? error.message : '走势数据获取失败';
    const fallback = cachedSeries(periodKey);
    if (fallback?.data?.points?.length) {
      state.series = { ...fallback.data, base: pairBase, quote: pairQuote, period: periodKey };
      state.seriesCacheFallback = true;
      renderChart({ animate: false });
      if (!quiet) showToast('走势使用缓存数据');
    } else {
      state.seriesCacheFallback = false;
      state.series = null;
      elements.chartErrorMessage.textContent = state.seriesError;
      setChartState('error');
      renderSeriesMeta();
      if (!quiet) showToast(state.seriesError);
    }
    return false;
  } finally {
    if (request === state.seriesRequest) {
      state.seriesLoading = false;
      state.seriesController = null;
      setRefreshLoading();
      updateSyncLabel();
      updateFooter();
    }
  }
}

async function refreshAll({ manual = true } = {}) {
  if (state.refreshing) return;
  state.refreshing = true;
  setRefreshLoading();
  const results = await Promise.allSettled([
    loadLatest({ force: true, quiet: !manual }),
    loadSeries({ force: true, quiet: !manual }),
  ]);
  state.refreshing = false;
  setRefreshLoading();
  updateSyncLabel();
  updateFooter();
  if (manual) {
    const failed = results.some((result) => result.status === 'rejected' || result.value === false);
    showToast(failed ? '部分数据未能更新，请稍后再试' : '汇率已更新');
  }
}

function setPair(base, quote) {
  if (base === state.base && quote === state.quote) return;
  state.latestController?.abort();
  state.seriesController?.abort();
  state.base = base;
  state.quote = quote;
  state.latest = null;
  state.series = null;
  state.latestError = null;
  state.seriesError = null;
  state.latestCacheFallback = false;
  state.seriesCacheFallback = false;
  savePrefsSoon();
  renderPair();
  applyCachedData();
  updateSyncLabel();
  updateFooter();
  loadLatest({ quiet: true });
  loadSeries({ quiet: true });
}

function applyPeriod(periodKey, { animate = true, fetch = true } = {}) {
  if (!PERIODS[periodKey]) return;
  state.period = periodKey;
  savePrefsSoon();

  elements.segments.forEach((segment) => {
    const active = segment.dataset.period === periodKey;
    segment.classList.toggle('is-active', active);
    segment.setAttribute('aria-selected', String(active));
    segment.tabIndex = active ? 0 : -1;
  });
  const index = PERIOD_ORDER.indexOf(periodKey);
  elements.segmentThumb.style.setProperty('--segment-index', String(index));

  const period = PERIODS[periodKey];
  elements.rangeLabel.textContent = `${period.rangeLabel} · ${period.title}`;
  elements.series = null;
  const cached = cachedSeries(periodKey);
  if (cached?.data?.points?.length) {
    state.series = {
      ...cached.data,
      base: state.base,
      quote: state.quote,
      period: periodKey,
    };
    renderChart({ animate });
  } else {
    setChartState('loading');
    renderSeriesMeta();
  }
  updateSyncLabel();
  if (fetch) loadSeries({ force: false, quiet: true });
}

function renderQuickPairs() {
  elements.quickPairs.innerHTML = QUICK_PAIRS.map(([base, quote]) => {
    const isActive = base === state.base && quote === state.quote;
    return `<button class="quick-chip${isActive ? ' is-active' : ''}" type="button" data-base="${base}" data-quote="${quote}" aria-pressed="${isActive}">${base}/${quote}</button>`;
  }).join('');
}

function openPicker(target) {
  state.pickerTarget = target;
  state.lastFocus = document.activeElement;
  elements.pickerTitle.textContent = target === 'base' ? '我有 · 选择币种' : '可兑换 · 选择币种';
  elements.pickerSearch.value = '';
  renderCurrencyList('');
  elements.sheetBackdrop.hidden = false;
  elements.pickerSheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => {
    elements.sheetBackdrop.classList.add('is-visible');
    elements.pickerSheet.classList.add('is-open');
  });
  if (window.matchMedia('(pointer: fine)').matches) {
    setTimeout(() => elements.pickerSearch.focus(), 260);
  }
}

function closePicker() {
  if (!state.pickerTarget) return;
  state.pickerTarget = null;
  elements.sheetBackdrop.classList.remove('is-visible');
  elements.pickerSheet.classList.remove('is-open');
  elements.pickerSheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('sheet-open');
  setTimeout(() => {
    elements.sheetBackdrop.hidden = true;
  }, 340);
  if (state.lastFocus instanceof HTMLElement) {
    state.lastFocus.focus({ preventScroll: true });
  }
}

function renderCurrencyList(query) {
  const targetCode = state.pickerTarget === 'base' ? state.base : state.quote;
  const results = searchCurrencies(query);
  const check = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.2 8.3 3 3.1 6.6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const optionHTML = (currency) => `
    <button class="currency-option${currency.code === targetCode ? ' is-selected' : ''}" type="button" data-code="${currency.code}" aria-label="${currency.zh}，${currency.code}${currency.code === targetCode ? '，当前已选' : ''}">
      <span class="option-flag" aria-hidden="true">${currency.flag}</span>
      <span class="option-copy">
        <span class="option-name">${currency.zh}</span>
        <span class="option-en">${currency.en}</span>
      </span>
      <span class="option-code">${currency.code}</span>
      ${currency.code === targetCode ? `<span class="option-check">${check}</span>` : ''}
    </button>
  `;

  if (!results.length) {
    elements.currencyList.innerHTML = '<p class="empty-list">没有找到匹配的币种<br>试试输入 USD、人民币或美元</p>';
    return;
  }

  if (query.trim()) {
    elements.currencyList.innerHTML = `
      <div class="list-heading"><span>搜索结果</span><span>${results.length}</span></div>
      ${results.map(optionHTML).join('')}
    `;
    return;
  }

  const popular = CURRENCIES.filter((currency) => currency.popular);
  const others = CURRENCIES.filter((currency) => !currency.popular);
  elements.currencyList.innerHTML = `
    <div class="list-heading"><span>常用币种</span><span>POPULAR</span></div>
    ${popular.map(optionHTML).join('')}
    <div class="list-heading"><span>全部币种</span><span>ALL</span></div>
    ${others.map(optionHTML).join('')}
  `;
}

function selectCurrency(code) {
  if (!state.pickerTarget) return;
  const target = state.pickerTarget;
  let nextBase = state.base;
  let nextQuote = state.quote;

  if (target === 'base') {
    if (code === state.quote && code !== state.base) nextQuote = state.base;
    nextBase = code;
  } else {
    if (code === state.base && code !== state.quote) nextBase = state.quote;
    nextQuote = code;
  }

  closePicker();
  setPair(nextBase, nextQuote);
}

function updateHeaderDate() {
  elements.headerDate.textContent = formatHeaderDate(new Date());
}

function bindEvents() {
  elements.amountInput.addEventListener('input', (event) => {
    const clean = sanitizeAmountInput(event.target.value);
    if (event.target.value !== clean) event.target.value = clean;
    state.amount = clean;
    savePrefsSoon();
    renderLatest();
  });

  elements.amountInput.addEventListener('blur', () => {
    if (!state.amount || state.amount === '.') {
      state.amount = '0';
      elements.amountInput.value = '0';
      renderLatest();
    }
  });

  elements.swapButton.addEventListener('click', () => {
    const base = state.base;
    const quote = state.quote;
    elements.swapButton.classList.remove('is-spinning');
    void elements.swapButton.offsetWidth;
    elements.swapButton.classList.add('is-spinning');
    setPair(quote, base);
    setTimeout(() => elements.swapButton.classList.remove('is-spinning'), 520);
  });

  elements.quickPairs.addEventListener('click', (event) => {
    const chip = event.target.closest('.quick-chip');
    if (!chip) return;
    setPair(chip.dataset.base, chip.dataset.quote);
  });

  elements.basePicker.addEventListener('click', () => openPicker('base'));
  elements.quotePicker.addEventListener('click', () => openPicker('quote'));
  elements.pickerClose.addEventListener('click', closePicker);
  elements.sheetBackdrop.addEventListener('click', closePicker);

  elements.pickerSearch.addEventListener('input', (event) => {
    renderCurrencyList(event.target.value);
  });

  elements.currencyList.addEventListener('click', (event) => {
    const option = event.target.closest('.currency-option');
    if (option?.dataset.code) selectCurrency(option.dataset.code);
  });

  elements.segments.forEach((segment) => {
    segment.addEventListener('click', () => applyPeriod(segment.dataset.period));
  });

  document.querySelector('.segmented').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const current = PERIOD_ORDER.indexOf(state.period);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = (current + offset + PERIOD_ORDER.length) % PERIOD_ORDER.length;
    applyPeriod(PERIOD_ORDER[next]);
    elements.segments[next].focus();
  });

  elements.refreshButton.addEventListener('click', () => refreshAll({ manual: true }));
  elements.chartRetry.addEventListener('click', () => loadSeries({ force: true, quiet: false }));

  elements.sourceButton.addEventListener('click', () => {
    window.open('https://frankfurter.dev/', '_blank', 'noopener,noreferrer');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.pickerTarget) closePicker();
  });

  window.addEventListener('online', () => {
    showToast('网络已恢复，正在同步');
    updateSyncLabel();
    loadLatest({ quiet: true });
    loadSeries({ quiet: true });
  });

  window.addEventListener('offline', () => {
    setStatus('offline', '离线数据');
    showToast('网络已断开，正在显示缓存数据');
    updateFooter();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const timestamp = state.latest?.fetchedAt;
    if (!timestamp || Date.now() - timestamp > AUTO_REFRESH_MS) {
      loadLatest({ quiet: true });
    }
    if (!state.series?.fetchedAt || Date.now() - state.series.fetchedAt > SERIES_TTL) {
      loadSeries({ quiet: true });
    }
    updateAges();
  });

  document.addEventListener('click', (event) => {
    const tooltip = elements.chartTooltip;
    if (!elements.rateChart.contains(event.target) && !tooltip.contains(event.target)) {
      tooltip.classList.remove('is-visible');
      chart?.hideTooltip();
    }
  }, { passive: true });
}

function startTimers() {
  clearInterval(state.autoTimer);
  state.autoTimer = setInterval(() => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    loadLatest({ quiet: true });
    if (Date.now() - (state.series?.fetchedAt ?? 0) > AUTO_REFRESH_MS * 2) {
      loadSeries({ quiet: true });
    }
  }, AUTO_REFRESH_MS);

  clearInterval(state.statusTimer);
  state.statusTimer = setInterval(updateAges, 30_000);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
  } catch {
    // The app still works without offline shell caching.
  }
}

async function init() {
  loadPrefs();
  updateHeaderDate();
  elements.amountInput.value = state.amount;
  renderQuickPairs();
  renderPair();
  chart = new RateChart({
    svg: elements.rateChart,
    tooltip: elements.chartTooltip,
    wrapper: elements.chartWrap,
  });
  applyPeriod(state.period, { animate: false, fetch: false });
  renderLatest();
  updateSyncLabel();
  bindEvents();
  applyCachedData();
  startTimers();
  registerServiceWorker();
  await Promise.allSettled([
    loadLatest({ quiet: true }),
    loadSeries({ force: true, quiet: true }),
  ]);
  updateSyncLabel();
  updateAges();
}

init();
