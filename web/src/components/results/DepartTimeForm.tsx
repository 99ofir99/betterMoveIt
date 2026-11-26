/** Date + time form for "Set departure time" / "Set desired arrival time". */

import { useState } from 'react';
import type { DepartTimeFormProps } from './types';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaultTimeValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 15);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function DepartTimeForm({ mode, onBack, onApply }: DepartTimeFormProps) {
  const [time, setTime] = useState(defaultTimeValue);
  const [date, setDate] = useState(todayIso);

  return (
    <>
      <h2 className="depart-sheet__title">
        {mode === 'depart' ? 'Set departure time' : 'Set desired arrival time'}
      </h2>
      <div className="depart-sheet__form">
        <label className="depart-sheet__field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="depart-sheet__field">
          <span>Time</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="depart-sheet__form-actions">
        <button type="button" className="depart-sheet__secondary" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="depart-sheet__primary"
          onClick={() =>
            onApply(
              mode === 'depart' ? { type: 'departAt', time, date } : { type: 'arriveBy', time, date }
            )
          }
        >
          Apply
        </button>
      </div>
    </>
  );
}
