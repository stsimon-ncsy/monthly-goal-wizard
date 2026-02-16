import { appConfig } from '../config/appConfig';
import type { GoalsByMonth, MonthRef, SubmissionPayload } from '../types';
import { formatLocalDateTime } from './date';

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40) || 'NA';
}

export function buildSubmissionPayload(input: {
  submissionId: string;
  createdAt: Date;
  region: string;
  chapter: string;
  staff: string;
  months: MonthRef[];
  goals: GoalsByMonth;
}): SubmissionPayload {
  const metricsByMonth: SubmissionPayload['metricsByMonth'] = {};

  for (const month of input.months) {
    metricsByMonth[month.key] = appConfig.metrics.map((metric) => {
      const draft = input.goals[month.key]?.[metric.key];
      return {
        key: metric.key,
        label: metric.label,
        goalValue: draft?.goalValue ?? 0,
        reasons: draft?.reasons ?? [],
        note: draft?.note ?? '',
      };
    });
  }

  return {
    submissionId: input.submissionId,
    createdAtIso: input.createdAt.toISOString(),
    region: input.region,
    chapter: input.chapter,
    staff: input.staff,
    months: input.months.map((month) => month.key),
    metricsByMonth,
    appVersion: appConfig.appVersion,
  };
}

export function buildSubmissionBlock(input: {
  payload: SubmissionPayload;
  createdAt: Date;
}): { full: string; humanOnly: string; receiptLine: string } {
  const { payload, createdAt } = input;
  const lines: string[] = [
    'NCSY Monthly Goals Submission',
    `Region: ${payload.region}`,
    `Chapter: ${payload.chapter}`,
    `Staff: ${payload.staff}`,
    `Window: ${payload.months.join(', ')}`,
    `Submitted: ${formatLocalDateTime(createdAt)}`,
    '',
  ];

  for (const month of payload.months) {
    lines.push(month);
    for (const metric of payload.metricsByMonth[month]) {
      const reasonText = metric.reasons.length > 0 ? ` (Reasons: ${metric.reasons.join(', ')})` : '';
      const noteText = metric.note ? ` (Note: ${metric.note})` : '';
      lines.push(`- ${metric.label}: ${metric.goalValue}${reasonText}${noteText}`);
    }
    lines.push('');
  }

  const humanOnly = lines.join('\n').trimEnd();

  const full = `${humanOnly}\n\n---TECH (do not edit)---\n${JSON.stringify(payload, null, 2)}`;

  const chapterForReceipt = payload.chapter || '(No chapter)';
  const receiptLine = `Goals submitted: ${payload.months.join(', ')} | ${payload.region} | ${chapterForReceipt} | ${payload.staff} | 4 metrics`;

  return { full, humanOnly, receiptLine };
}

export function buildSubmissionFilename(payload: SubmissionPayload): string {
  const window = sanitizeFilePart(payload.months.join('-'));
  const region = sanitizeFilePart(payload.region);
  const chapter = sanitizeFilePart(payload.chapter || 'NoChapter');
  const staff = sanitizeFilePart(payload.staff);
  return `MonthlyGoals_${window}_${region}_${chapter}_${staff}.txt`;
}

export function triggerTextDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
