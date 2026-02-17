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
if (header.join(',') !== expectedHeader.join(',')) {
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
const expectedEventHeader = ['region', 'chapter', 'year', 'month', 'event_name', 'events', 'new_teens', 'avg_attendance', 'retention_contacts', 'notes'];

if (eventHeader.join(',') !== expectedEventHeader.join(',')) {
  console.error(`events.csv header mismatch. Expected: ${expectedEventHeader.join(',')} | Received: ${eventHeader.join(',')}`);
  process.exit(1);
}

for (let lineNo = 2; lineNo <= eventLines.length; lineNo += 1) {
  const cols = parseCsvLine(eventLines[lineNo - 1]);
  if (cols.length !== expectedEventHeader.length) {
    errors.push(`events.csv line ${lineNo}: expected ${expectedEventHeader.length} columns, got ${cols.length}.`);
    continue;
  }

  const [region, _chapter, yearRaw, monthRaw, eventName, eventsRaw, newTeensRaw, avgAttendanceRaw, retentionRaw] = cols;
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!region) errors.push(`events.csv line ${lineNo}: region is required.`);
  if (!eventName) errors.push(`events.csv line ${lineNo}: event_name is required.`);
  if (!Number.isInteger(year)) errors.push(`events.csv line ${lineNo}: year must be an integer.`);
  if (!Number.isInteger(month) || month < 1 || month > 12) errors.push(`events.csv line ${lineNo}: month must be an integer 1-12.`);
  if (Number.isNaN(Number(eventsRaw))) errors.push(`events.csv line ${lineNo}: events must be numeric.`);
  if (Number.isNaN(Number(newTeensRaw))) errors.push(`events.csv line ${lineNo}: new_teens must be numeric.`);
  if (Number.isNaN(Number(avgAttendanceRaw))) errors.push(`events.csv line ${lineNo}: avg_attendance must be numeric.`);
  if (Number.isNaN(Number(retentionRaw))) errors.push(`events.csv line ${lineNo}: retention_contacts must be numeric.`);
}

if (errors.length > 0) {
  console.error('data validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`events.csv validation passed (${Math.max(0, eventLines.length - 1)} rows).`);
