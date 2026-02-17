export type MetricConfig = {
  key: string;
  label: string;
  description: string;
  unitLabel: string;
  goalMin: number;
};

export const appConfig = {
  appVersion: '1.0.0',
  metrics: [
    {
      key: 'events',
      label: 'Events Hosted',
      description: 'Count of chapter programs and gatherings delivered in the month.',
      unitLabel: 'events',
      goalMin: 0,
    },
    {
      key: 'new_teens',
      label: 'New Teens Engaged',
      description: 'First-time teen participants reached this month.',
      unitLabel: 'teens',
      goalMin: 0,
    },
    {
      key: 'avg_attendance',
      label: 'Average Attendance',
      description: 'Average participants per event during the month.',
      unitLabel: 'participants',
      goalMin: 0,
    },
    {
      key: 'retention_contacts',
      label: 'Retention Contacts',
      description: 'Meaningful follow-up touchpoints with existing teens/families.',
      unitLabel: 'contacts',
      goalMin: 0,
    },
  ] satisfies MetricConfig[],
  reasonOptions: [
    'Travel / OOO',
    'Staffing change',
    'Special program',
    'Seasonality',
    'Community event',
    'Other',
  ],
} as const;

export const metricKeySet = new Set(appConfig.metrics.map((metric) => metric.key));
