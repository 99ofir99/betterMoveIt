/** Date + time form for "Set departure time" / "Set desired arrival time". */

import { useState } from 'react';
import type { DepartTimeFormProps } from './types';
import { t } from '../../lib/i18n';
import { israelClock } from '../../lib/format';

// Feed times are Israel time, whatever zone the phone is set to.
function todayIso(): string {
  return israelClock().isoDate;
}

function defaultTimeValue(): string {
  const sec = (israelClock().seconds + 15 * 60) % 86400;
  return `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
}

export function DepartTimeForm({ mode, onBack, onApply }: DepartTimeFormProps) {
  const [time, setTime] = useState(defaultTimeValue);
  const [date, setDate] = useState(todayIso);

  return (
    <>
      <h2 className="depart-sheet__title">
        {mode === 'depart' ? t('Set departure time') : t('Set desired arrival time')}
      </h2>
      <div className="depart-sheet__form">
        <label className="depart-sheet__field">
          <span>{t("Date")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="depart-sheet__field">
          <span>{t("Time")}</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="depart-sheet__form-actions">
        <button type="button" className="depart-sheet__secondary" onClick={onBack}>
          {t("Back")}
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
          {t("Apply")}
        </button>
      </div>
    </>
  );
}
