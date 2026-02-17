import type { LastYearEventRow } from '../types';

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
      out.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  out.push(current.trim());
  return out;
}

export async function loadEventHistory(): Promise<LastYearEventRow[]> {
  const endpoints = ['/data/events.csv', `${import.meta.env.BASE_URL}data/events.csv`];

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
    return [];
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const expected = ['region', 'chapter', 'year', 'month', 'event_name', 'events', 'new_teens', 'avg_attendance', 'retention_contacts', 'notes'];

  if (header.join(',') !== expected.join(',')) {
    return [];
  }

  const rows: LastYearEventRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length !== expected.length) continue;

    const [region, chapter, yearRaw, monthRaw, eventName, eventsRaw, newTeensRaw, avgAttendanceRaw, retentionRaw, notes] = cols;
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !eventName) {
      continue;
    }

    rows.push({
      region,
      chapter,
      year,
      month,
      event_name: eventName,
      events: Number(eventsRaw) || 0,
      new_teens: Number(newTeensRaw) || 0,
      avg_attendance: Number(avgAttendanceRaw) || 0,
      retention_contacts: Number(retentionRaw) || 0,
      notes,
    });
  }

  return rows;
}
