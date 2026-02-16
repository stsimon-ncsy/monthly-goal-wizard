import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const configPath = resolve(repoRoot, 'src/config/appConfig.ts');
const csvPath = resolve(repoRoot, 'public/data/history.csv');

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

const text = readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

if (lines.length < 2) {
  console.error('history.csv must include a header and at least one data row.');
  process.exit(1);
}

const header = parseCsvLine(lines[0]);
const expectedHeader = ['region', 'chapter', 'metric_key', 'year', 'month', 'value'];
if (header.join(',') !== expectedHeader.join(',')) {
  console.error(`Header mismatch. Expected: ${expectedHeader.join(',')} | Received: ${header.join(',')}`);
  process.exit(1);
}

const errors = [];

for (let lineNo = 2; lineNo <= lines.length; lineNo += 1) {
  const cols = parseCsvLine(lines[lineNo - 1]);

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

console.log(`history.csv validation passed (${lines.length - 1} rows).`);
console.log(`Metric keys validated: ${Array.from(metricKeys).join(', ')}`);
