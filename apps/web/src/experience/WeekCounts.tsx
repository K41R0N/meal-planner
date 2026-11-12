import { useMemo, useState } from 'react';
import type { AppState } from '@domain/types';
import { countUsefulWeeks, weekCountsText } from '@domain/week-counts';
import { shortDate } from '../components/shared';
import { LabelledButton } from './controls';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Useful and repeat weeks from this device's own record (D016, issue #47). */
export function WeekCounts({ state }: { state: AppState }) {
  const counts = useMemo(() => countUsefulWeeks(state), [state]);
  const [status, setStatus] = useState('');
  const recent = [...counts.weeks].reverse().slice(0, 6);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(weekCountsText(counts));
      setStatus('Copied. Paste it into your weekly log.');
    } catch {
      setStatus('This browser blocked copying. The counts are shown above.');
    }
  };
  return (
    <section aria-labelledby="week-counts-heading">
      <h2 id="week-counts-heading">Your weeks</h2>
      <p>
        A useful week has a confirmed plan, at least one shopping item marked and at least one cook
        finished. Only counts and dates appear here, and nothing leaves this device.
      </p>
      <p>
        <b>{plural(counts.usefulWeeks, 'useful week')}</b>
        {counts.firstUsefulWeek && <> · first {shortDate(counts.firstUsefulWeek)}</>}
        {counts.secondUsefulWeek && <> · repeat {shortDate(counts.secondUsefulWeek)}</>}
      </p>
      {recent.length ? (
        <ul className="mb-week-counts">
          {recent.map((week, index) => (
            <li key={`${week.weekStart}-${index}`}>
              Week of {shortDate(week.weekStart)}:{' '}
              {week.planConfirmed ? 'plan confirmed' : 'plan not confirmed'} ·{' '}
              {plural(week.shoppingLines, 'shopping item')} · {plural(week.cooksFinished, 'cook')}
              {week.useful && <b> · useful</b>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-quiet">No planned weeks yet.</p>
      )}
      {counts.cooksOutsideWeeks > 0 && (
        <p className="mb-quiet">
          {plural(counts.cooksOutsideWeeks, 'cook')} outside a planned week.
        </p>
      )}
      <div>
        <LabelledButton onClick={() => void copy()}>Copy for weekly log</LabelledButton>
      </div>
      {status && (
        <p className="mb-quiet" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
