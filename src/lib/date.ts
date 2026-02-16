import type { MonthRef } from '../types';

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export function getMonthWindow(twoMonths: boolean): MonthRef[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const months = [start, new Date(start.getFullYear(), start.getMonth() + 1, 1)];
  const chosen = twoMonths ? months : [months[0]];

  return chosen.map((date) => ({
    key: toMonthKey(date.getFullYear(), date.getMonth() + 1),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    label: monthFormatter.format(date),
  }));
}

export function toMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatLocalDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
