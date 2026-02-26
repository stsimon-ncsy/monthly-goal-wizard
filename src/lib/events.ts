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
  const headerMap = new Map<string, number>();
  for (let i = 0; i < header.length; i += 1) {
    headerMap.set(header[i].trim().toLowerCase(), i);
  }

  const regionIdx = headerMap.get('region') ?? headerMap.get('regionname');
  const chapterIdx = headerMap.get('chapter') ?? headerMap.get('chaptername');
  const yearIdx = headerMap.get('year');
  const monthIdx = headerMap.get('month');
  const eventNameIdx = headerMap.get('event_name');
  const seriesOrEventIdx = headerMap.get('seriesorevent');
  const eventIdIdx = headerMap.get('eventid');
  const seriesIdIdx = headerMap.get('seriesid');
  const eventsIdx = headerMap.get('events');
  const teensTotalIdx = headerMap.get('teens_total');
  const newTeensIdx = headerMap.get('new_teens');
  const avgAttendanceIdx = headerMap.get('avg_attendance');

  const requiredIndexes = [regionIdx, chapterIdx, yearIdx, monthIdx, eventNameIdx, eventsIdx, teensTotalIdx, newTeensIdx, avgAttendanceIdx];
  if (requiredIndexes.some((idx) => idx === undefined)) {
    return [];
  }

  const rows: LastYearEventRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const region = cols[regionIdx ?? -1] ?? '';
    const chapter = cols[chapterIdx ?? -1] ?? '';
    const yearRaw = cols[yearIdx ?? -1] ?? '';
    const monthRaw = cols[monthIdx ?? -1] ?? '';
    const eventName = cols[eventNameIdx ?? -1] ?? '';
    const seriesOrEventRaw = cols[seriesOrEventIdx ?? -1] ?? '';
    const eventIDRaw = cols[eventIdIdx ?? -1] ?? '';
    const seriesIDRaw = cols[seriesIdIdx ?? -1] ?? '';
    const eventsRaw = cols[eventsIdx ?? -1] ?? '';
    const teensTotalRaw = cols[teensTotalIdx ?? -1] ?? '';
    const newTeensRaw = cols[newTeensIdx ?? -1] ?? '';
    const avgAttendanceRaw = cols[avgAttendanceIdx ?? -1] ?? '';
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
      seriesOrEvent: seriesOrEventRaw,
      eventID: eventIDRaw,
      seriesID: seriesIDRaw,
      events: Number(eventsRaw) || 0,
      teens_total: Number(teensTotalRaw) || 0,
      new_teens: Number(newTeensRaw) || 0,
      avg_attendance: Number(avgAttendanceRaw) || 0,
    });
  }

  return rows;
}
