import { clamp, escapeHTML, formatAxisDate, formatRate, formatTooltipDate } from './core.js';

const WIDTH = 360;
const HEIGHT = 224;
const MARGIN = { top: 16, right: 12, bottom: 28, left: 46 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function pathForPoints(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  const tension = 0.18;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return path;
}

function pickTickIndexes(length, count = 4) {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, index) => index);
  const indexes = new Set([0, length - 1]);
  for (let i = 1; i < count - 1; i += 1) {
    indexes.add(Math.round((i / (count - 1)) * (length - 1)));
  }
  return [...indexes].sort((a, b) => a - b);
}

export class RateChart {
  constructor({ svg, tooltip, wrapper }) {
    this.svg = svg;
    this.tooltip = tooltip;
    this.wrapper = wrapper;
    this.points = [];
    this.displayPoints = [];
    this.period = 'day';
    this.rising = true;
    this.selectedIndex = -1;
    this.isDragging = false;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);

    this.svg.addEventListener('pointermove', this.onPointerMove);
    this.svg.addEventListener('pointerdown', this.onPointerDown);
    this.svg.addEventListener('pointerup', this.onPointerUp);
    this.svg.addEventListener('pointercancel', this.onPointerUp);
    this.svg.addEventListener('pointerleave', this.onPointerLeave);
  }

  setData(points, { period, rising }) {
    this.points = Array.isArray(points) ? points : [];
    this.period = period;
    this.rising = Boolean(rising);
    this.selectedIndex = -1;
    this.tooltip.classList.remove('is-visible');
    this.draw();
  }

  draw() {
    if (!this.points.length) {
      this.svg.innerHTML = '';
      this.svg.setAttribute('aria-label', '暂无历史汇率数据');
      return;
    }

    const color = this.rising ? '#197a57' : '#d05d43';
    const dateValues = this.points.map((point) => point.timestamp);
    let minX = Math.min(...dateValues);
    let maxX = Math.max(...dateValues);
    if (minX === maxX) {
      minX -= 86_400_000;
      maxX += 86_400_000;
    }

    const rates = this.points.map((point) => point.rate);
    const rawMin = Math.min(...rates);
    const rawMax = Math.max(...rates);
    const span = rawMax - rawMin;
    const padding = span === 0 ? Math.max(rawMax * 0.002, 0.0001) : span * 0.16;
    const minY = rawMin - padding;
    const maxY = rawMax + padding;

    const xFor = (timestamp) => MARGIN.left + ((timestamp - minX) / (maxX - minX)) * PLOT_WIDTH;
    const yFor = (rate) => MARGIN.top + (1 - (rate - minY) / (maxY - minY)) * PLOT_HEIGHT;

    this.displayPoints = this.points.map((point) => ({
      ...point,
      x: xFor(point.timestamp),
      y: yFor(point.rate),
    }));

    const linePath = pathForPoints(this.displayPoints);
    const baseline = MARGIN.top + PLOT_HEIGHT;
    const areaPath = this.displayPoints.length > 1
      ? `${linePath} L ${this.displayPoints.at(-1).x.toFixed(2)} ${baseline} L ${this.displayPoints[0].x.toFixed(2)} ${baseline} Z`
      : '';

    const yTickRates = [rawMax, rawMin + span / 2, rawMin];
    const yTicks = yTickRates.map((rate) => ({
      y: yFor(rate),
      label: formatRate(rate),
    }));

    const tickIndexes = pickTickIndexes(this.displayPoints.length, 4);
    const xTicks = tickIndexes.map((index, order) => {
      const point = this.displayPoints[index];
      let anchor = 'middle';
      if (order === 0) anchor = 'start';
      if (order === tickIndexes.length - 1) anchor = 'end';
      return {
        x: point.x,
        label: formatAxisDate(point.timestamp, this.period),
        anchor,
      };
    });

    const last = this.displayPoints.at(-1);
    const uniqueId = `area-${Math.random().toString(36).slice(2, 9)}`;

    this.svg.innerHTML = `
      <defs>
        <linearGradient id="${uniqueId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.24"></stop>
          <stop offset="72%" stop-color="${color}" stop-opacity="0.06"></stop>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <g class="chart-grid">
        ${yTicks.map((tick) => `
          <line x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${tick.y.toFixed(2)}" y2="${tick.y.toFixed(2)}"></line>
          <text x="${MARGIN.left - 8}" y="${(tick.y + 3).toFixed(2)}" text-anchor="end">${escapeHTML(tick.label)}</text>
        `).join('')}
      </g>
      ${areaPath ? `<path class="chart-area" d="${areaPath}" fill="url(#${uniqueId})"></path>` : ''}
      <path class="chart-line" d="${linePath}" pathLength="1" stroke="${color}"></path>
      <g class="chart-x-axis">
        ${xTicks.map((tick) => `
          <text x="${tick.x.toFixed(2)}" y="${HEIGHT - 7}" text-anchor="${tick.anchor}">${escapeHTML(tick.label)}</text>
        `).join('')}
      </g>
      <g class="chart-last-point" style="color:${color}">
        <circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="8" class="chart-last-halo"></circle>
        <circle cx="${last.x.toFixed(2)}" cy="${last.y.toFixed(2)}" r="3.5" class="chart-last-dot"></circle>
      </g>
      <g class="chart-hover" hidden>
        <line class="chart-hover-line" y1="${MARGIN.top}" y2="${MARGIN.top + PLOT_HEIGHT}"></line>
        <circle class="chart-hover-halo" r="8" cx="0" cy="0"></circle>
        <circle class="chart-hover-dot" r="4" cx="0" cy="0"></circle>
      </g>
    `;

    this.svg.setAttribute(
      'aria-label',
      `汇率走势图，${this.period === 'month' ? '月度' : this.period === 'week' ? '周度' : '日度'}，从 ${formatRate(this.points[0].rate)} 到 ${formatRate(this.points.at(-1).rate)}`,
    );
  }

  indexFromPointer(event) {
    if (!this.displayPoints.length) return -1;
    const rect = this.svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let distance = Infinity;
    this.displayPoints.forEach((point, index) => {
      const nextDistance = Math.abs(point.x - x);
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    return nearest;
  }

  showIndex(index) {
    const point = this.displayPoints[index];
    if (!point) return;
    this.selectedIndex = index;
    const hover = this.svg.querySelector('.chart-hover');
    if (!hover) return;
    hover.removeAttribute('hidden');
    hover.querySelector('.chart-hover-line').setAttribute('x1', point.x);
    hover.querySelector('.chart-hover-line').setAttribute('x2', point.x);
    hover.querySelectorAll('circle').forEach((circle) => {
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
    });

    this.tooltip.innerHTML = `
      <span class="chart-tooltip-date">${escapeHTML(formatTooltipDate(point.timestamp, this.period))}</span>
      <strong class="chart-tooltip-value">${escapeHTML(formatRate(point.rate))}</strong>
    `;
    const leftPercent = clamp((point.x / WIDTH) * 100, 13, 87);
    this.tooltip.style.left = `${leftPercent}%`;
    this.tooltip.classList.add('is-visible');
  }

  hideTooltip() {
    this.selectedIndex = -1;
    this.tooltip.classList.remove('is-visible');
    const hover = this.svg.querySelector('.chart-hover');
    if (hover) hover.setAttribute('hidden', '');
  }

  onPointerDown(event) {
    if (!this.displayPoints.length) return;
    this.isDragging = true;
    if (this.svg.setPointerCapture) {
      try {
        this.svg.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail for synthetic events; dragging still works.
      }
    }
    this.showIndex(this.indexFromPointer(event));
  }

  onPointerMove(event) {
    if (!this.displayPoints.length) return;
    if (event.pointerType === 'mouse' || this.isDragging) {
      this.showIndex(this.indexFromPointer(event));
    }
  }

  onPointerUp() {
    this.isDragging = false;
  }

  onPointerLeave() {
    this.isDragging = false;
    if (!('ontouchstart' in window)) this.hideTooltip();
  }
}
