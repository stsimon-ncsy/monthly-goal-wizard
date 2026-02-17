import { appConfig } from './config/appConfig';

export type MonthRef = {
  key: string;
  year: number;
  month: number;
  label: string;
};

export type HistoryRow = {
  region: string;
  chapter: string;
  metric_key: string;
  year: number;
  month: number;
  value: number;
};

export type LastYearEventRow = {
  region: string;
  chapter: string;
  year: number;
  month: number;
  event_name: string;
  events: number;
  new_teens: number;
  avg_attendance: number;
  retention_contacts: number;
  notes: string;
};

export type Variability = 'Consistent' | 'Mixed' | 'Volatile';

export type MetricStats = {
  countYears: number;
  avg: number;
  min: number;
  max: number;
  variability: Variability;
  hasHistory: boolean;
};

export type MetricDraft = {
  goalValue: number | null;
  reasons: string[];
  note: string;
};

export type GoalsByMonth = Record<string, Record<string, MetricDraft>>;

export type Profile = {
  staffName: string;
  lastRegion: string;
  lastChapter: string;
};

export type SubmissionPayloadMetric = {
  key: string;
  label: string;
  goalValue: number;
  reasons: string[];
  note: string;
};

export type SubmissionPayload = {
  submissionId: string;
  createdAtIso: string;
  region: string;
  chapter: string;
  staff: string;
  months: string[];
  metricsByMonth: Record<string, SubmissionPayloadMetric[]>;
  appVersion: string;
};

export type AppConfig = typeof appConfig;
