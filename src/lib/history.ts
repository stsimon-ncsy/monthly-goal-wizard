import { metricKeySet } from '../config/appConfig';
import type { HistoryRow, MetricStats, Variability } from '../types';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  out.push(current);
  return out.map((value) => value.trim());
}

export async function loadHistory(): Promise<HistoryRow[]> {
  const endpoints = ['/data/history.csv', `${import.meta.env.BASE_URL}data/history.csv`];

  let text = '';
  let loaded = false;
  for (const url of endpoints) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) {
        text = await response.text();
        loaded = true;
        break;
      }
    } catch {
      // Try the fallback endpoint.
    }
  }

  if (!loaded) {
    throw new Error('Could not load /public/data/history.csv');
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const expected = ['region', 'chapter', 'metric_key', 'year', 'month', 'value'];

  if (header.join(',') !== expected.join(',')) {
    throw new Error(`Unexpected history.csv header. Expected: ${expected.join(',')}`);
  }

  const rows: HistoryRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length !== expected.length) continue;

    const [region, chapter, metricKey, yearRaw, monthRaw, valueRaw] = cols;
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const value = Number(valueRaw);

    if (!Number.isInteger(year) || !Number.isInteger(month) || Number.isNaN(value)) {
      continue;
    }
    if (month < 1 || month > 12) {
      continue;
    }
    if (!metricKeySet.has(metricKey)) {
      continue;
    }

    rows.push({
      region,
      chapter,
      metric_key: metricKey,
      year,
      month,
      value,
    });
  }

  return rows;
}

function getVariability(values: number[]): Variability {
  if (values.length <= 1) return 'Mixed';

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);

  if (mean > 0) {
    const cv = stdev / mean;
    if (cv < 0.2) return 'Consistent';
    if (cv < 0.45) return 'Mixed';
    return 'Volatile';
  }

  const range = Math.max(...values) - Math.min(...values);
  if (range <= 1) return 'Consistent';
  if (range <= 3) return 'Mixed';
  return 'Volatile';
}

export function computeMetricStats(input: {
  history: HistoryRow[];
  region: string;
  chapter: string;
  metricKey: string;
  month: number;
  targetYear: number;
}): MetricStats {
  const matching = input.history
    .filter((row) => row.region === input.region)
    .filter((row) => (input.chapter ? row.chapter === input.chapter : true))
    .filter((row) => row.metric_key === input.metricKey)
    .filter((row) => row.month === input.month)
    .filter((row) => row.year < input.targetYear)
    .sort((a, b) => b.year - a.year)
    .slice(0, 4)
    .map((row) => row.value);

  if (matching.length === 0) {
    return {
      countYears: 0,
      avg: 0,
      min: 0,
      max: 0,
      variability: 'Mixed',
      hasHistory: false,
    };
  }

  const avg = matching.reduce((sum, value) => sum + value, 0) / matching.length;

  return {
    countYears: matching.length,
    avg,
    min: Math.min(...matching),
    max: Math.max(...matching),
    variability: getVariability(matching),
    hasHistory: true,
  };
}

export function roundGoal(value: number): number {
  return Math.max(0, Math.round(value));
}

export function variabilityHint(level: Variability): string {
  if (level === 'Consistent') return 'Past years are tightly clustered for this month.';
  if (level === 'Mixed') return 'Past years vary somewhat. Consider local context before finalizing.';
  return 'Past years swing widely, so estimates are less predictable for this month.';
}
