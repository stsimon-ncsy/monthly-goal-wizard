import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { appConfig } from './config/appConfig';
import { RangeBar } from './components/RangeBar';
import { loadEventHistory } from './lib/events';
import { computeMetricStats, loadHistory, roundGoal, variabilityHint } from './lib/history';
import { buildSubmissionBlock, buildSubmissionFilename, buildSubmissionPayload, triggerTextDownload } from './lib/submission';
import { buildDraftKey, clearDraft, loadDraft, loadProfile, saveDraft, saveProfile } from './lib/storage';
import { getMonthWindow } from './lib/date';
import type { GoalsByMonth, HistoryRow, LastYearEventRow, MonthRef } from './types';

const identifySchema = z.object({
  region: z.string().min(1, 'Select a region'),
  chapter: z.string().optional(),
  staffName: z.string().min(2, 'Enter your name'),
  windowMode: z.enum(['one', 'two']),
});

type IdentifyFormValues = z.infer<typeof identifySchema>;
type Screen = 'welcome' | 'identify' | 'goals' | 'review';

function defaultGoals(months: MonthRef[], region: string, chapter: string, history: HistoryRow[]): GoalsByMonth {
  const output: GoalsByMonth = {};

  for (const month of months) {
    output[month.key] = {};
    for (const metric of appConfig.metrics) {
      const stats = computeMetricStats({
        history,
        region,
        chapter,
        metricKey: metric.key,
        month: month.month,
        targetYear: month.year,
      });

      output[month.key][metric.key] = {
        goalValue: stats.hasHistory ? roundGoal(stats.avg) : metric.goalMin,
        reasons: [],
        note: '',
      };
    }
  }

  return output;
}

function defaultTouched(months: MonthRef[]): Record<string, Record<string, boolean>> {
  const output: Record<string, Record<string, boolean>> = {};

  for (const month of months) {
    output[month.key] = {};
    for (const metric of appConfig.metrics) {
      output[month.key][metric.key] = false;
    }
  }

  return output;
}

export default function App() {
  const profile = useMemo(() => loadProfile(), []);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [eventHistory, setEventHistory] = useState<LastYearEventRow[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [screen, setScreen] = useState<Screen>('welcome');
  const [goalMonthIndex, setGoalMonthIndex] = useState(0);
  const [months, setMonths] = useState<MonthRef[]>(getMonthWindow(true, appConfig.goalWindowStartOffsetMonths));
  const [identifySnapshot, setIdentifySnapshot] = useState<IdentifyFormValues | null>(null);
  const [goals, setGoals] = useState<GoalsByMonth>({});
  const [goalTouched, setGoalTouched] = useState<Record<string, Record<string, boolean>>>({});
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [expandedMetricInfo, setExpandedMetricInfo] = useState<Record<string, boolean>>({});
  const [draftKey, setDraftKey] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadHistory()
      .then((rows) => {
        setHistory(rows);
      })
      .catch((error: unknown) => {
        setHistoryError(error instanceof Error ? error.message : 'Unable to load history file.');
      });
  }, []);

  useEffect(() => {
    loadEventHistory().then((rows) => setEventHistory(rows));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const hashParams = useMemo(() => new URLSearchParams(window.location.hash.split('?')[1] ?? ''), []);
  const lockedRegion = (hashParams.get('region') ?? '').trim();
  const lockedChapter = (hashParams.get('chapter') ?? '').trim();
  const lockRegion = Boolean(lockedRegion);
  const lockChapter = Boolean(lockedChapter);

  const form = useForm<IdentifyFormValues>({
    resolver: zodResolver(identifySchema),
    mode: 'onChange',
    defaultValues: {
      region: lockedRegion || profile.lastRegion || '',
      chapter: lockedChapter || profile.lastChapter || '',
      staffName: profile.staffName || '',
      windowMode: 'two',
    },
  });

  const selectedRegion = form.watch('region');
  const selectedWindowMode = form.watch('windowMode');
  const selectedChapter = form.watch('chapter');
  const regionsFromHistory = useMemo(() => {
    const regionMap = new Map<string, Set<string>>();
    for (const row of history) {
      const region = row.region.trim();
      if (!region) continue;
      if (!regionMap.has(region)) {
        regionMap.set(region, new Set<string>());
      }
      const chapter = row.chapter.trim();
      if (chapter) {
        regionMap.get(region)?.add(chapter);
      }
    }
    return Array.from(regionMap.entries())
      .map(([name, chapters]) => ({ name, chapters: Array.from(chapters).sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [history]);

  const selectedRegionConfig = regionsFromHistory.find((region) => region.name === selectedRegion);
  const hasChapterList = (selectedRegionConfig?.chapters.length ?? 0) > 0;
  const identifyReady = form.formState.isValid && (lockChapter || !hasChapterList || Boolean(selectedChapter));

  useEffect(() => {
    if (lockRegion && form.getValues('region') !== lockedRegion) {
      form.setValue('region', lockedRegion, { shouldValidate: true });
    }
    if (lockChapter && form.getValues('chapter') !== lockedChapter) {
      form.setValue('chapter', lockedChapter, { shouldValidate: true });
    }
  }, [form, lockChapter, lockRegion, lockedChapter, lockedRegion]);

  useEffect(() => {
    if (!hasChapterList || lockChapter) return;
    const chapter = form.getValues('chapter');
    if (chapter && !selectedRegionConfig?.chapters?.includes(chapter)) {
      form.setValue('chapter', '', { shouldValidate: true });
    }
  }, [form, hasChapterList, lockChapter, selectedRegionConfig]);

  const currentMonth = months[goalMonthIndex];

  const monthReady = useMemo(() => {
    if (!currentMonth) return false;
    const monthGoals = goals[currentMonth.key];
    const monthTouched = goalTouched[currentMonth.key];
    if (!monthGoals) return false;
    if (!monthTouched) return false;
    return appConfig.metrics.every((metric) => {
      const value = monthGoals[metric.key]?.goalValue;
      return Number.isFinite(value) && (value ?? -1) >= metric.goalMin && monthTouched[metric.key] === true;
    });
  }, [currentMonth, goalTouched, goals]);

  const remainingGoalsToTouch = useMemo(() => {
    if (!currentMonth) return appConfig.metrics.length;
    const monthGoals = goals[currentMonth.key];
    const monthTouched = goalTouched[currentMonth.key];
    if (!monthGoals || !monthTouched) return appConfig.metrics.length;
    return appConfig.metrics.filter((metric) => {
      const value = monthGoals[metric.key]?.goalValue;
      return !(Number.isFinite(value) && (value ?? -1) >= metric.goalMin && monthTouched[metric.key] === true);
    }).length;
  }, [currentMonth, goalTouched, goals]);

  const lastYearEventsForMonth = useMemo(() => {
    if (!currentMonth || !identifySnapshot) return [];
    return eventHistory
      .filter((row) => row.region === identifySnapshot.region)
      .filter((row) => (identifySnapshot.chapter ? row.chapter === identifySnapshot.chapter : true))
      .filter((row) => row.year === currentMonth.year - 1 && row.month === currentMonth.month);
  }, [currentMonth, eventHistory, identifySnapshot]);

  const lastYearLabel = useMemo(() => {
    if (!currentMonth) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
      new Date(currentMonth.year - 1, currentMonth.month - 1, 1),
    );
  }, [currentMonth]);

  const reviewSubmission = useMemo(() => {
    if (!identifySnapshot) return null;
    const createdAt = new Date();
    const payload = buildSubmissionPayload({
      submissionId: uuidv4(),
      createdAt,
      region: identifySnapshot.region,
      chapter: identifySnapshot.chapter ?? '',
      staff: identifySnapshot.staffName,
      months,
      goals,
    });

    return {
      block: buildSubmissionBlock({ payload, createdAt }),
      filename: buildSubmissionFilename(payload),
    };
  }, [goals, identifySnapshot, months]);

  function applyIdentify(values: IdentifyFormValues): void {
    const region = lockRegion ? lockedRegion : values.region;
    const chapter = lockChapter ? lockedChapter : values.chapter ?? '';
    const cleaned: IdentifyFormValues = {
      region,
      chapter,
      staffName: values.staffName.trim(),
      windowMode: values.windowMode,
    };

    if (hasChapterList && !chapter) {
      form.setError('chapter', { type: 'manual', message: 'Select a chapter' });
      return;
    }

    const monthWindow = getMonthWindow(cleaned.windowMode === 'two', appConfig.goalWindowStartOffsetMonths);
    const nextDraftKey = buildDraftKey(
      cleaned.region,
      cleaned.chapter ?? '',
      cleaned.staffName,
      monthWindow.map((month) => month.key),
    );
    const loadedDraft = loadDraft(nextDraftKey);

    const initialized = loadedDraft ?? defaultGoals(monthWindow, cleaned.region, cleaned.chapter ?? '', history);

    setIdentifySnapshot(cleaned);
    setMonths(monthWindow);
    setGoals(initialized);
    setGoalTouched(defaultTouched(monthWindow));
    setGoalMonthIndex(0);
    setDraftKey(nextDraftKey);
    setScreen('goals');

    saveProfile({
      staffName: cleaned.staffName,
      lastRegion: cleaned.region,
      lastChapter: cleaned.chapter ?? '',
    });
  }

  useEffect(() => {
    if (!draftKey || !identifySnapshot) return;
    saveDraft(draftKey, goals);
  }, [draftKey, goals, identifySnapshot]);

  function updateGoal(monthKey: string, metricKey: string, value: number | null): void {
    setGoals((prev) => ({
      ...prev,
      [monthKey]: {
        ...prev[monthKey],
        [metricKey]: {
          ...prev[monthKey]?.[metricKey],
          goalValue: value,
        },
      },
    }));
    setGoalTouched((prev) => ({
      ...prev,
      [monthKey]: {
        ...(prev[monthKey] ?? {}),
        [metricKey]: true,
      },
    }));
  }

  function updateReasons(monthKey: string, metricKey: string, reason: string, checked: boolean): void {
    setGoals((prev) => {
      const prevReasons = prev[monthKey]?.[metricKey]?.reasons ?? [];
      const reasons = checked ? [...new Set([...prevReasons, reason])] : prevReasons.filter((item) => item !== reason);
      return {
        ...prev,
        [monthKey]: {
          ...prev[monthKey],
          [metricKey]: {
            ...prev[monthKey]?.[metricKey],
            reasons,
            note: reason === 'Other' && !checked ? '' : prev[monthKey]?.[metricKey]?.note ?? '',
          },
        },
      };
    });
  }

  function updateNote(monthKey: string, metricKey: string, note: string): void {
    setGoals((prev) => ({
      ...prev,
      [monthKey]: {
        ...prev[monthKey],
        [metricKey]: {
          ...prev[monthKey]?.[metricKey],
          note,
        },
      },
    }));
  }

  function onCopySubmission(): void {
    if (!reviewSubmission) return;
    navigator.clipboard.writeText(reviewSubmission.block.full).then(() => {
      setToast('Copied — now paste into your Teams message/email');
    });
  }

  function onCopyReceipt(): void {
    if (!reviewSubmission) return;
    navigator.clipboard.writeText(reviewSubmission.block.receiptLine).then(() => {
      setToast('Receipt line copied');
    });
  }

  function onDownloadSubmission(): void {
    if (!reviewSubmission) return;
    triggerTextDownload(reviewSubmission.filename, reviewSubmission.block.full);
  }

  function onEmailSubmission(): void {
    if (!reviewSubmission || !identifySnapshot) return;

    const subject = `Monthly Goals ${months.map((month) => month.key).join(', ')} – ${identifySnapshot.staffName} (${identifySnapshot.region})`;
    const body = reviewSubmission.block.full;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (isMobile) {
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;
      return;
    }

    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const popup = window.open(outlookUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = outlookUrl;
    }
  }

  function toggleReasons(monthKey: string, metricKey: string): void {
    const key = `${monthKey}:${metricKey}`;
    setExpandedReasons((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleMetricInfo(monthKey: string, metricKey: string): void {
    const key = `${monthKey}:${metricKey}`;
    setExpandedMetricInfo((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function clearCurrentDraft(): void {
    if (!identifySnapshot || !draftKey) return;
    clearDraft(draftKey);
    const refreshed = defaultGoals(months, identifySnapshot.region, identifySnapshot.chapter ?? '', history);
    setGoals(refreshed);
    setGoalTouched(defaultTouched(months));
    setToast('Draft cleared');
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-4 text-slate-900 sm:px-6 sm:py-6">
      <header className="mb-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Monthly Goal Wizard</h1>
        <p className="mt-1 text-sm text-slate-600">Set goals in about 2 minutes with chapter-specific historical context.</p>
      </header>

      {historyError && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{historyError}</p>}

      {screen === 'welcome' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Welcome</h2>
          <p className="mt-2 text-slate-700">This takes about 2 minutes. You will set goals for {appConfig.metrics.length} monthly metrics.</p>
          <button
            className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            onClick={() => setScreen('identify')}
            type="button"
          >
            Start
          </button>
        </section>
      )}

      {screen === 'identify' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Identify</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Set your scope and month window.</p>

          <form className="space-y-4" onSubmit={form.handleSubmit(applyIdentify)}>
            <div className="grid gap-4 sm:grid-cols-2">
              {!lockRegion && (
                <label className="block text-sm font-medium text-slate-700">
                  Region
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    {...form.register('region')}
                  >
                    <option value="">Select region</option>
                    {regionsFromHistory.map((region) => (
                      <option key={region.name} value={region.name}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-rose-600">{form.formState.errors.region?.message}</span>
                </label>
              )}

              {!lockChapter && hasChapterList && (
                <label className="block text-sm font-medium text-slate-700">
                  Chapter
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                    {...form.register('chapter')}
                  >
                    <option value="">Select chapter</option>
                    {selectedRegionConfig?.chapters?.map((chapter) => (
                      <option key={chapter} value={chapter}>
                        {chapter}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-rose-600">{form.formState.errors.chapter?.message}</span>
                </label>
              )}
            </div>

            {(lockRegion || lockChapter) && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Scope preselected from link: <strong>{form.getValues('region')}</strong>
                {form.getValues('chapter') ? ` / ${form.getValues('chapter')}` : ''}
              </p>
            )}

            <label className="block text-sm font-medium text-slate-700">
              Staff name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Your name"
                {...form.register('staffName')}
              />
              <span className="text-xs text-rose-600">{form.formState.errors.staffName?.message}</span>
            </label>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Month window</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className={clsx('rounded-lg border px-3 py-2', selectedWindowMode === 'one' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300')}>
                  <input className="mr-2" type="radio" value="one" {...form.register('windowMode')} />
                  Just upcoming month
                </label>
                <label className={clsx('rounded-lg border px-3 py-2', selectedWindowMode === 'two' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300')}>
                  <input className="mr-2" type="radio" value="two" {...form.register('windowMode')} />
                  Two months (default)
                </label>
              </div>
            </fieldset>

            <div className="sticky bottom-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow">
              <button className="rounded-lg px-4 py-2 text-slate-700" onClick={() => setScreen('welcome')} type="button">
                Back
              </button>
              <button
                className={clsx('rounded-lg px-4 py-2 font-semibold text-white', identifyReady ? 'bg-emerald-600' : 'bg-slate-300')}
                disabled={!identifyReady}
                type="submit"
              >
                Next
              </button>
            </div>
          </form>
        </section>
      )}

      {screen === 'goals' && currentMonth && identifySnapshot && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Goals for {currentMonth.label}</h2>
              <button className="text-sm text-slate-500 underline" onClick={clearCurrentDraft} type="button">
                Clear draft
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">Region: {identifySnapshot.region}{identifySnapshot.chapter ? ` | Chapter: ${identifySnapshot.chapter}` : ''}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {appConfig.metrics.map((metric) => {
              const draft = goals[currentMonth.key]?.[metric.key];
              const stats = computeMetricStats({
                history,
                region: identifySnapshot.region,
                chapter: identifySnapshot.chapter ?? '',
                metricKey: metric.key,
                month: currentMonth.month,
                targetYear: currentMonth.year,
              });

              const reasonsOpen = expandedReasons[`${currentMonth.key}:${metric.key}`];
              const infoOpen = expandedMetricInfo[`${currentMonth.key}:${metric.key}`];
              const goalValue = draft?.goalValue;

              return (
                <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" key={metric.key}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold leading-tight text-slate-900">
                      {metric.label}
                      <button
                        aria-label={`What is ${metric.label}?`}
                        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-600"
                        onClick={() => toggleMetricInfo(currentMonth.key, metric.key)}
                        type="button"
                      >
                        ?
                      </button>
                    </h3>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-1 text-[11px] font-semibold',
                        stats.variability === 'Consistent' && 'bg-emerald-100 text-emerald-900',
                        stats.variability === 'Mixed' && 'bg-amber-100 text-amber-900',
                        stats.variability === 'Volatile' && 'bg-rose-100 text-rose-900',
                      )}
                      title={variabilityHint(stats.variability)}
                    >
                      {stats.variability}
                    </span>
                  </div>
                  {infoOpen && <p className="mt-1 text-xs text-slate-600">{metric.description}</p>}

                  <div className="mt-2 rounded-xl bg-slate-50 p-2.5">
                    {stats.hasHistory ? (
                      <p className="text-sm text-slate-700">
                        Avg <strong>{Math.round(stats.avg)}</strong> | Range {Math.round(stats.min)}-{Math.round(stats.max)} ({stats.countYears}y)
                      </p>
                    ) : (
                      <p className="text-sm text-slate-700">No history available for this chapter.</p>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-1.5">
                    <button
                      aria-label={`Decrease ${metric.label}`}
                      className="h-9 w-9 rounded-lg border border-slate-300 text-base"
                      onClick={() => updateGoal(currentMonth.key, metric.key, Math.max(metric.goalMin, (goalValue ?? metric.goalMin) - 1))}
                      type="button"
                    >
                      -
                    </button>
                    <input
                      aria-label={`${metric.label} goal`}
                      className="h-11 w-full min-w-0 rounded-lg border border-slate-300 px-2 text-center text-xl font-semibold"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={goalValue ?? ''}
                      onChange={(event) => {
                        const value = event.currentTarget.value.trim();
                        const parsed = Number(value);
                        updateGoal(currentMonth.key, metric.key, value === '' || Number.isNaN(parsed) ? null : parsed);
                      }}
                    />
                    <button
                      aria-label={`Increase ${metric.label}`}
                      className="h-9 w-9 rounded-lg border border-slate-300 text-base"
                      onClick={() => updateGoal(currentMonth.key, metric.key, (goalValue ?? metric.goalMin) + 1)}
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  {stats.hasHistory && goalValue !== roundGoal(stats.avg) && (
                    <button
                      className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900"
                      onClick={() => updateGoal(currentMonth.key, metric.key, roundGoal(stats.avg))}
                      type="button"
                    >
                      Use avg
                    </button>
                  )}

                  <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">Drag to set goal</p>
                    <RangeBar
                      goalMin={metric.goalMin}
                      hasHistory={stats.hasHistory}
                      historyAvg={stats.avg}
                      historyMax={stats.max}
                      historyMin={stats.min}
                      onChange={(next) => updateGoal(currentMonth.key, metric.key, next)}
                      value={goalValue ?? metric.goalMin}
                    />
                  </div>

                  <div className="mt-3">
                    <button className="text-xs font-medium text-slate-700 underline" onClick={() => toggleReasons(currentMonth.key, metric.key)} type="button">
                      + Add reason
                    </button>
                    {reasonsOpen && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {appConfig.reasonOptions.map((reason) => {
                            const selected = draft?.reasons?.includes(reason) ?? false;
                            return (
                              <button
                                className={clsx(
                                  'rounded-full border px-2 py-1 text-xs',
                                  selected ? 'border-emerald-500 bg-emerald-100 text-emerald-900' : 'border-slate-300 bg-white text-slate-700',
                                )}
                                key={reason}
                                onClick={() => updateReasons(currentMonth.key, metric.key, reason, !selected)}
                                type="button"
                              >
                                {reason}
                              </button>
                            );
                          })}
                        </div>
                        {draft?.reasons?.includes('Other') && (
                          <label className="block text-xs font-medium text-slate-700">
                            Other note
                            <input
                              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                              maxLength={120}
                              value={draft.note}
                              onChange={(event) => updateNote(currentMonth.key, metric.key, event.currentTarget.value)}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Expand this to see last year's {lastYearLabel} events
            </summary>
            {lastYearEventsForMonth.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No event records found for this month last year.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {lastYearEventsForMonth.map((event, index) => (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" key={`${event.event_name}-${index}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{event.event_name}</p>
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                        {event.events > 1 ? 'Series' : 'Event'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700">
                      Events: {event.events} | # Teens: {event.teens_total} | New Teens: {event.new_teens} | Avg Attendance: {event.avg_attendance}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </details>

          <div className="sticky bottom-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow">
            <button
              className="rounded-lg px-4 py-2 text-slate-700"
              onClick={() => {
                if (goalMonthIndex === 0) {
                  setScreen('identify');
                } else {
                  setGoalMonthIndex((index) => index - 1);
                }
              }}
              type="button"
            >
              Back
            </button>
            <button
              className={clsx('rounded-lg px-4 py-2 font-semibold text-white', monthReady ? 'bg-emerald-600' : 'bg-slate-300')}
              disabled={!monthReady}
              onClick={() => {
                if (goalMonthIndex < months.length - 1) {
                  setGoalMonthIndex((index) => index + 1);
                } else {
                  setScreen('review');
                }
              }}
              type="button"
            >
              Next
            </button>
          </div>
          {!monthReady && (
            <p className="text-sm text-amber-700">
              Next is disabled: interact with all {appConfig.metrics.length} goals and set valid values. Remaining: {remainingGoalsToTouch}.
            </p>
          )}
        </section>
      )}

      {screen === 'review' && identifySnapshot && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Review</h2>
          <p className="mt-1 text-sm text-slate-600">Confirm your goals before submitting.</p>

          <div className="mt-4 space-y-4">
            {months.map((month, monthIndex) => (
              <div className="rounded-xl border border-slate-200 p-3" key={month.key}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{month.label}</h3>
                  <button
                    className="text-sm text-slate-500 underline"
                    onClick={() => {
                      setGoalMonthIndex(monthIndex);
                      setScreen('goals');
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                </div>
                <ul className="space-y-2 text-sm text-slate-700">
                  {appConfig.metrics.map((metric) => {
                    const stats = computeMetricStats({
                      history,
                      region: identifySnapshot.region,
                      chapter: identifySnapshot.chapter ?? '',
                      metricKey: metric.key,
                      month: month.month,
                      targetYear: month.year,
                    });

                    return (
                      <li className="rounded-lg bg-slate-50 px-3 py-2" key={metric.key}>
                        <strong>{metric.label}:</strong> {goals[month.key]?.[metric.key]?.goalValue ?? 0}
                        {stats.hasHistory && <span className="text-slate-500"> | avg {Math.round(stats.avg)} (range {Math.round(stats.min)}-{Math.round(stats.max)})</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button className="rounded-lg px-4 py-2 text-slate-700" onClick={() => setScreen('goals')} type="button">
              Back
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h3 className="text-base font-semibold text-slate-900">Submit your goals</h3>
            <p className="mt-1 text-sm text-slate-700">Use any option below. Email opens in a new window on desktop.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button className="rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white" onClick={onCopySubmission} type="button">
                Copy submission
              </button>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-3" onClick={onDownloadSubmission} type="button">
                Download submission
              </button>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-3" onClick={onEmailSubmission} type="button">
                Email submission
              </button>
            </div>

            <div className="mt-3">
              <button className="text-sm text-slate-700 underline" onClick={onCopyReceipt} type="button">
                Copy receipt line
              </button>
            </div>

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Submission preview
              <textarea className="mt-1 h-48 w-full rounded-lg border border-slate-300 bg-white p-3 text-xs" readOnly value={reviewSubmission?.block.full ?? ''} />
            </label>
          </div>
        </section>
      )}

      {toast && (
        <p className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </p>
      )}
    </main>
  );
}

