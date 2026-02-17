export type MetricConfig = {
  key: string;
  label: string;
  description: string;
  unitLabel: string;
  goalMin: number;
};

export const appConfig = {
  appVersion: '1.0.0',
  goalWindowStartOffsetMonths: 0,
  metrics: [
    {
      key: 'events',
      label: 'Total Events',
      description: 'How many events will you be running this month?',
      unitLabel: 'events',
      goalMin: 0,
    },
    {
      key: 'new_teens',
      label: 'New Teens this Year',
      description: 'Teens attending for the first time this year.',
      unitLabel: 'new teens',
      goalMin: 0,
    },
    {
      key: 'reach',
      label: 'Reach',
      description: 'Average participants per event during the month.',
      unitLabel: 'participants',
      goalMin: 0,
    },
    {
      key: 'engagement',
      label: 'Engagement',
      description: 'Chapter teens Engaged at chapter or Regionwide events',
      unitLabel: 'teens',
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
