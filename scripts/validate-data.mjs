import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const configPath = resolve(repoRoot, 'src/config/appConfig.ts');
const historyCsvPath = resolve(repoRoot, 'public/data/history.csv');
const eventsCsvPath = resolve(repoRoot, 'public/data/events.csv');

function parseMetricKeys(configSource) {
  const matches = [...configSource.matchAll(/key:\s*'([^']+)'/g)];
  return new Set(matches.map((m) => m[1]));
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  out.push(current.trim());
  return out;
}

const configSource = readFileSync(configPath, 'utf8');
const metricKeys = parseMetricKeys(configSource);

if (metricKeys.size !== 4) {
  console.error(`Expected exactly 4 metrics in appConfig.ts, found ${metricKeys.size}.`);
  process.exit(1);
}

const historyText = readFileSync(historyCsvPath, 'utf8');
const historyLines = historyText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

if (historyLines.length < 2) {
  console.error('history.csv must include a header and at least one data row.');
  process.exit(1);
}

const header = parseCsvLine(historyLines[0]);
const expectedHeader = ['region', 'chapter', 'metric_key', 'year', 'month', 'value'];
const normalizedHeader = header.map((h) => h.toLowerCase());
if (normalizedHeader.join(',') !== expectedHeader.join(',')) {
  console.error(`Header mismatch. Expected: ${expectedHeader.join(',')} | Received: ${header.join(',')}`);
  process.exit(1);
}

const errors = [];

for (let lineNo = 2; lineNo <= historyLines.length; lineNo += 1) {
  const cols = parseCsvLine(historyLines[lineNo - 1]);

  if (cols.length !== 6) {
    errors.push(`Line ${lineNo}: expected 6 columns, got ${cols.length}.`);
    continue;
  }

  const [region, _chapter, metricKey, yearRaw, monthRaw, valueRaw] = cols;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const value = Number(valueRaw);

  if (!region) errors.push(`Line ${lineNo}: region is required.`);
  if (!metricKeys.has(metricKey)) errors.push(`Line ${lineNo}: metric_key '${metricKey}' is not defined in appConfig.ts.`);
  if (!Number.isInteger(year)) errors.push(`Line ${lineNo}: year must be an integer.`);
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.push(`Line ${lineNo}: month must be an integer 1-12.`);
  if (Number.isNaN(value)) errors.push(`Line ${lineNo}: value must be numeric.`);
}

if (errors.length > 0) {
  console.error('history.csv validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`history.csv validation passed (${historyLines.length - 1} rows).`);
console.log(`Metric keys validated: ${Array.from(metricKeys).join(', ')}`);

const eventsText = readFileSync(eventsCsvPath, 'utf8');
const eventLines = eventsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const eventHeader = parseCsvLine(eventLines[0] || '');
const eventHeaderMap = new Map(eventHeader.map((column, index) => [column.trim().toLowerCase(), index]));

const regionIdx = eventHeaderMap.get('region') ?? eventHeaderMap.get('regionname');
const chapterIdx = eventHeaderMap.get('chapter') ?? eventHeaderMap.get('chaptername');
const yearIdx = eventHeaderMap.get('year');
const monthIdx = eventHeaderMap.get('month');
const eventNameIdx = eventHeaderMap.get('event_name');
const seriesOrEventIdx = eventHeaderMap.get('seriesorevent');
const eventIdIdx = eventHeaderMap.get('eventid');
const seriesIdIdx = eventHeaderMap.get('seriesid');
const eventsIdx = eventHeaderMap.get('events');
const teensTotalIdx = eventHeaderMap.get('teens_total');
const newTeensIdx = eventHeaderMap.get('new_teens');
const avgAttendanceIdx = eventHeaderMap.get('avg_attendance');

const missingEventColumns = [
  ['region or regionName', regionIdx],
  ['chapter or chapterName', chapterIdx],
  ['year', yearIdx],
  ['month', monthIdx],
  ['event_name', eventNameIdx],
  ['events', eventsIdx],
  ['teens_total', teensTotalIdx],
  ['new_teens', newTeensIdx],
  ['avg_attendance', avgAttendanceIdx],
].filter(([, index]) => index === undefined);

if (missingEventColumns.length > 0) {
  console.error(
    `events.csv header mismatch. Missing columns: ${missingEventColumns.map(([name]) => name).join(', ')} | Received: ${eventHeader.join(',')}`,
  );
  process.exit(1);
}

for (let lineNo = 2; lineNo <= eventLines.length; lineNo += 1) {
  const cols = parseCsvLine(eventLines[lineNo - 1]);
  const region = (cols[regionIdx] ?? '').trim();
  const yearRaw = (cols[yearIdx] ?? '').trim();
  const monthRaw = (cols[monthIdx] ?? '').trim();
  const eventName = (cols[eventNameIdx] ?? '').trim();
  const seriesOrEventRaw = (cols[seriesOrEventIdx ?? -1] ?? '').trim();
  const eventIDRaw = (cols[eventIdIdx ?? -1] ?? '').trim();
  const seriesIDRaw = (cols[seriesIdIdx ?? -1] ?? '').trim();
  const eventsRaw = (cols[eventsIdx] ?? '').trim();
  const teensTotalRaw = (cols[teensTotalIdx] ?? '').trim();
  const newTeensRaw = (cols[newTeensIdx] ?? '').trim();
  const avgAttendanceRaw = (cols[avgAttendanceIdx] ?? '').trim();

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const seriesOrEvent = String(seriesOrEventRaw || '').trim().toLowerCase();

  if (!region) errors.push(`events.csv line ${lineNo}: region is required.`);
  if (!eventName) errors.push(`events.csv line ${lineNo}: event_name is required.`);
  if (!Number.isInteger(year)) errors.push(`events.csv line ${lineNo}: year must be an integer.`);
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.push(`events.csv line ${lineNo}: month must be an integer 1-12.`);
  if (seriesOrEventIdx !== undefined) {
    if (!seriesOrEvent || (seriesOrEvent !== 'series' && seriesOrEvent !== 'event')) {
      errors.push(`events.csv line ${lineNo}: seriesOrEvent must be 'Series' or 'Event'.`);
    }
    if (seriesOrEvent === 'series' && !seriesIDRaw && !eventIDRaw) {
      errors.push(`events.csv line ${lineNo}: series rows require seriesID (or eventID fallback).`);
    }
    if (seriesOrEvent === 'event' && !eventIDRaw) {
      errors.push(`events.csv line ${lineNo}: eventID is required when seriesOrEvent is Event.`);
    }
  }
  if (Number.isNaN(Number(eventsRaw))) errors.push(`events.csv line ${lineNo}: events must be numeric.`);
  if (Number.isNaN(Number(teensTotalRaw))) errors.push(`events.csv line ${lineNo}: teens_total must be numeric.`);
  if (Number.isNaN(Number(newTeensRaw))) errors.push(`events.csv line ${lineNo}: new_teens must be numeric.`);
  if (Number.isNaN(Number(avgAttendanceRaw))) errors.push(`events.csv line ${lineNo}: avg_attendance must be numeric.`);
}

if (errors.length > 0) {
  console.error('data validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`events.csv validation passed (${Math.max(0, eventLines.length - 1)} rows).`);
