import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { CookingWindow } from '@domain/experience-types';
import { makeId } from '../components/shared';
import { LabelledButton } from './controls';

export function WindowEntry({ onAdd }: { onAdd: (window: CookingWindow) => void }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const availableMinutes = Number(minutes);
    if (!date || !time || !Number.isFinite(availableMinutes) || availableMinutes <= 0) {
      setError('Choose a date, a start time and a positive number of minutes.');
      return;
    }
    onAdd({ id: makeId('window'), date, startTime: time, availableMinutes });
    setDate('');
    setTime('');
    setMinutes('');
    setError('');
  };
  return (
    <div>
      <div className="mb-window-editor">
        <label className="mb-field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="mb-field">
          <span>Start time</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className="mb-field">
          <span>Minutes available</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <LabelledButton className="mb-button--quiet" onClick={add}>
          <Plus size={17} /> Add window
        </LabelledButton>
      </div>
      {error && (
        <p className="mb-form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
