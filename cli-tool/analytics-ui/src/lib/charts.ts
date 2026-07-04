// ECharts tree-shaken setup — no CDN, fully offline
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CalendarComponent,
  VisualMapComponent,
  DataZoomComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart, BarChart, PieChart, HeatmapChart,
  GridComponent, TooltipComponent, LegendComponent,
  CalendarComponent, VisualMapComponent, DataZoomComponent, TitleComponent,
  CanvasRenderer,
]);

// ── Theme colors from CSS vars ────────────────────────────────────────────────

export interface ThemeColors {
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  border: string;
  bgCard: string;
  bgSecondary: string;
  accent: string;
  green: string;
  blue: string;
  red: string;
}

export function getThemeColors(): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  const get = (v: string) => css.getPropertyValue(v).trim();
  return {
    ink:         get('--ink'),
    inkMuted:    get('--ink-muted'),
    inkSubtle:   get('--ink-subtle'),
    border:      get('--border'),
    bgCard:      get('--bg-card'),
    bgSecondary: get('--bg-secondary'),
    accent:      get('--accent'),
    green:       get('--green'),
    blue:        get('--blue'),
    red:         get('--red'),
  };
}

// ── Categorical palette (consistent series colors) ────────────────────────────
const PALETTE = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#eab308', '#14b8a6', '#ef4444'];

// ── Chart factory ─────────────────────────────────────────────────────────────

export function createChart(
  el: HTMLElement,
  option: echarts.EChartsOption,
): echarts.ECharts {
  const chart = echarts.init(el);
  chart.setOption(option);

  // Resize when container size changes
  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);

  // Store cleanup on element for disposal
  (el as HTMLElement & { _echart?: echarts.ECharts; _ero?: ResizeObserver })._echart = chart;
  (el as HTMLElement & { _ero?: ResizeObserver })._ero = ro;

  return chart;
}

// ── Chart option factories ────────────────────────────────────────────────────

export function tokenTimelineOption(
  data: Array<{ date: string; input: number; output: number; cache: number }>,
  colors: ThemeColors,
): echarts.EChartsOption {
  const dates = data.map(d => d.date);
  return {
    backgroundColor: 'transparent',
    grid: { top: 16, right: 16, bottom: 60, left: 56 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.bgCard,
      borderColor: colors.border,
      textStyle: { color: colors.ink, fontSize: 12, fontFamily: 'inherit' },
    },
    legend: {
      bottom: 30,
      textStyle: { color: colors.inkMuted, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 20, bottom: 4, borderColor: colors.border, fillerColor: colors.accent + '20', handleStyle: { color: colors.accent } }],
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.inkMuted, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: colors.inkMuted, fontSize: 11, formatter: (v: number) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v) },
      splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
    },
    series: [
      {
        name: 'Input', type: 'line', stack: 'tokens',
        data: data.map(d => d.input),
        areaStyle: { opacity: 0.3 },
        lineStyle: { width: 1.5 },
        itemStyle: { color: colors.blue },
        symbol: 'none',
        smooth: true,
      },
      {
        name: 'Output', type: 'line', stack: 'tokens',
        data: data.map(d => d.output),
        areaStyle: { opacity: 0.3 },
        lineStyle: { width: 1.5 },
        itemStyle: { color: colors.accent },
        symbol: 'none',
        smooth: true,
      },
      {
        name: 'Cache', type: 'line', stack: 'tokens',
        data: data.map(d => d.cache),
        areaStyle: { opacity: 0.2 },
        lineStyle: { width: 1, type: 'dashed' },
        itemStyle: { color: colors.inkMuted },
        symbol: 'none',
        smooth: true,
      },
    ],
  };
}

export function activityHeatmapOption(
  data: Array<{ date: string; value: number }>,
  colors: ThemeColors,
  year: number,
): echarts.EChartsOption {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.bgCard,
      borderColor: colors.border,
      textStyle: { color: colors.ink, fontSize: 12 },
      formatter: (p: any) => `${p.data[0]}<br/>${p.data[1]} conversation${p.data[1] !== 1 ? 's' : ''}`,
    },
    visualMap: {
      min: 0,
      max: maxVal,
      show: false,
      inRange: { color: [colors.bgSecondary, colors.accent] },
    },
    calendar: {
      top: 16,
      left: 36,
      right: 16,
      bottom: 16,
      range: String(year),
      cellSize: ['auto', 14],
      itemStyle: { borderColor: colors.bgSecondary, borderWidth: 2, color: colors.bgSecondary },
      splitLine: { show: false },
      yearLabel: { show: false },
      monthLabel: { color: colors.inkMuted, fontSize: 10 },
      dayLabel: { color: colors.inkSubtle, fontSize: 9, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: data.map(d => [d.date, d.value]),
      itemStyle: { borderRadius: 2 },
    }],
  };
}

export function tokenDistributionOption(
  data: { input: number; output: number; cacheCreation: number; cacheRead: number },
  colors: ThemeColors,
): echarts.EChartsOption {
  const total = data.input + data.output + data.cacheCreation + data.cacheRead;
  if (total === 0) return {};
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.bgCard,
      borderColor: colors.border,
      textStyle: { color: colors.ink, fontSize: 12 },
      formatter: (p: any) => `${p.name}<br/>${p.value.toLocaleString()} (${p.percent}%)`,
    },
    legend: {
      bottom: 0,
      textStyle: { color: colors.inkMuted, fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'pie',
      radius: ['50%', '80%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: false } },
      data: [
        { name: 'Input',       value: data.input,         itemStyle: { color: colors.blue } },
        { name: 'Output',      value: data.output,        itemStyle: { color: colors.accent } },
        { name: 'Cache Write', value: data.cacheCreation, itemStyle: { color: colors.green } },
        { name: 'Cache Read',  value: data.cacheRead,     itemStyle: { color: colors.inkMuted } },
      ],
    }],
  };
}

export function sparklineOption(
  data: number[],
  colors: ThemeColors,
): echarts.EChartsOption {
  return {
    backgroundColor: 'transparent',
    grid: { top: 2, right: 2, bottom: 2, left: 2 },
    xAxis: { type: 'category', show: false },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'line',
      data,
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1.5, color: colors.accent },
      areaStyle: { color: colors.accent, opacity: 0.15 },
    }],
  };
}
