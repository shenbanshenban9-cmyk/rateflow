const API_BASE = 'https://api.frankfurter.dev/v2';
const REQUEST_TIMEOUT_MS = 18_000;

export const PERIODS = {
  day: {
    key: 'day',
    label: '日',
    title: '日度',
    rangeLabel: '近 30 天',
    group: null,
    daysBack: 29,
    take: 30,
  },
  week: {
    key: 'week',
    label: '周',
    title: '周度',
    rangeLabel: '近 12 周',
    group: 'week',
    daysBack: 84,
    take: 12,
  },
  month: {
    key: 'month',
    label: '月',
    title: '月度',
    rangeLabel: '近 12 月',
    group: 'month',
    monthsBack: 12,
    take: 12,
  },
};

export const PERIOD_ORDER = ['day', 'week', 'month'];

export class RateApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'RateApiError';
    this.status = status;
  }
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function rangeFor(periodKey, today = new Date()) {
  const period = PERIODS[periodKey] ?? PERIODS.day;
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let from;

  if (period.key === 'month') {
    from = addMonths(to, -(period.monthsBack ?? 12));
    from = addDays(from, 1);
  } else {
    from = addDays(to, -(period.daysBack ?? 29));
  }

  return {
    from: toISODate(from),
    to: toISODate(to),
    group: period.group,
    period,
  };
}

function createRequestSignal(signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('请求超时，请稍后重试', 'TimeoutError'));
  }, REQUEST_TIMEOUT_MS);

  const abortFromOutside = () => {
    controller.abort(signal?.reason ?? new DOMException('请求已取消', 'AbortError'));
  };

  if (signal) {
    if (signal.aborted) abortFromOutside();
    else signal.addEventListener('abort', abortFromOutside, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abortFromOutside);
    },
  };
}

async function requestJSON(url, { signal } = {}) {
  const request = createRequestSignal(signal);
  try {
    const response = await fetch(url, {
      signal: request.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.message ? `：${body.message}` : '';
      } catch {
        // The response body was not JSON; the status is enough.
      }
      throw new RateApiError(`汇率服务返回 ${response.status}${detail}`, response.status);
    }
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
    if (error instanceof RateApiError) throw error;
    throw new RateApiError('无法连接汇率服务，请检查网络后重试');
  } finally {
    request.cleanup();
  }
}

export async function fetchLatestRate(base, quote, options = {}) {
  if (base === quote) {
    return {
      base,
      quote,
      rate: 1,
      date: toISODate(new Date()),
      fetchedAt: Date.now(),
    };
  }

  const url = `${API_BASE}/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
  const data = await requestJSON(url, options);
  const rate = Number(data?.rate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RateApiError('汇率数据格式异常');
  }
  return {
    base: data.base ?? base,
    quote: data.quote ?? quote,
    rate,
    date: data.date ?? toISODate(new Date()),
    fetchedAt: Date.now(),
  };
}

export async function fetchRateSeries(base, quote, periodKey, options = {}) {
  if (base === quote) {
    const range = rangeFor(periodKey, options.today);
    return {
      points: [{
        date: range.to,
        timestamp: new Date(`${range.to}T00:00:00`).getTime(),
        rate: 1,
      }],
      fetchedAt: Date.now(),
      range,
    };
  }

  const range = rangeFor(periodKey, options.today);
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
    base,
    quotes: quote,
  });
  if (range.group) params.set('group', range.group);

  const url = `${API_BASE}/rates?${params.toString()}`;
  const data = await requestJSON(url, options);
  if (!Array.isArray(data)) throw new RateApiError('历史汇率数据格式异常');

  let points = data
    .map((item) => ({
      date: item.date,
      timestamp: new Date(`${item.date}T00:00:00`).getTime(),
      rate: Number(item.rate),
    }))
    .filter((point) => point.date && Number.isFinite(point.rate) && point.rate > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (range.period.take && points.length > range.period.take) {
    points = points.slice(-range.period.take);
  }

  return {
    points,
    fetchedAt: Date.now(),
    range,
  };
}

export function seriesStats(points) {
  if (!points?.length) {
    return { first: 0, last: 0, high: 0, low: 0, change: 0, changePercent: 0, rising: true };
  }
  const rates = points.map((point) => point.rate);
  const first = rates[0];
  const last = rates[rates.length - 1];
  const change = last - first;
  return {
    first,
    last,
    high: Math.max(...rates),
    low: Math.min(...rates),
    change,
    changePercent: first === 0 ? 0 : (change / first) * 100,
    rising: change >= 0,
  };
}

export function cacheKey(kind, base, quote, period = '') {
  return `rateflow:v1:${kind}:${base}:${quote}${period ? `:${period}` : ''}`;
}

export function sanitizeAmountInput(raw) {
  let value = String(raw ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
  const dot = value.indexOf('.');
  if (dot !== -1) {
    value = `${value.slice(0, dot + 1)}${value.slice(dot + 1).replace(/\./g, '')}`;
  }
  if (value.startsWith('.')) value = `0${value}`;
  const [integer = '', decimals] = value.split('.');
  const intLimited = integer.replace(/^0+(?=\d)/, '').slice(0, 12);
  if (dot === -1) return intLimited;
  return `${intLimited || '0'}.${(decimals ?? '').slice(0, 4)}`;
}

export function parseAmount(raw) {
  const normalized = String(raw ?? '').replace(/,/g, '').trim();
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function ratePrecision(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) return 2;
  if (absolute >= 100) return 2;
  if (absolute >= 1) return 4;
  if (absolute >= 0.1) return 4;
  if (absolute >= 0.01) return 6;
  return 8;
}

export function formatRate(value) {
  if (!Number.isFinite(value)) return '—';
  const digits = ratePrecision(value);
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatMoney(value, code) {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${code}`;
}

export function formatAmountInput(value) {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value, withSign = true) {
  if (!Number.isFinite(value)) return '—';
  const sign = withSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSignedRate(value) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const sign = value > 0 ? '+' : '-';
  return `${sign}${formatRate(Math.abs(value))}`;
}

export function formatUpdateTime(fetchedAt) {
  if (!fetchedAt) return '等待更新';
  const time = new Date(fetchedAt);
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(time);
}

export function formatHeaderDate(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function formatDataDate(isoDate) {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatAxisDate(timestamp, periodKey) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  if (periodKey === 'month') {
    return `${date.getMonth() + 1}月`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatTooltipDate(timestamp, periodKey) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  if (periodKey === 'month') {
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return '尚未更新';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 20) return '刚刚更新';
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
