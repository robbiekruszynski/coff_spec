// ADDED: countdown timer, stage highlight, pulse, post-brew feedback

import { useEffect, useRef, useState } from 'react'
import { formatMmSs } from './brewData.js'

function formatCountdown(remainingSec) {
  const s = Math.max(0, Math.floor(remainingSec))
  return formatMmSs(s)
}

export function BrewTimerPanel({
  scheduleEndSeconds,
  targetSeconds,
  totalLiquorG,
  recipeValid,
  rows,
  elapsed,
  running,
  onStart,
  onPause,
  onReset,
  timerCompleted,
  onTimerComplete,
  brewJournalJustSaved,
  onSaveJournalEntry,
}) {
  const [pulse, setPulse] = useState(false)
  const [flashStageIdx, setFlashStageIdx] = useState(null)
  const prevElapsedRef = useRef(0)
  const completeFiredRef = useRef(false)
  const [feedbackMood, setFeedbackMood] = useState(null)
  const [feedbackNote, setFeedbackNote] = useState('')

  const remaining = Math.max(0, scheduleEndSeconds - elapsed)
  const doneComplete = scheduleEndSeconds > 0 && elapsed >= scheduleEndSeconds

  useEffect(() => {
    if (elapsed === 0 && !running) {
      completeFiredRef.current = false
    }
  }, [elapsed, running])

  useEffect(() => {
    if (!running || scheduleEndSeconds <= 0) return
    if (elapsed >= scheduleEndSeconds && !completeFiredRef.current) {
      completeFiredRef.current = true
      onTimerComplete?.()
    }
  }, [elapsed, running, scheduleEndSeconds, onTimerComplete])

  useEffect(() => {
    const prev = prevElapsedRef.current
    const idx = rows.findIndex(
      (r) => prev < r.time && elapsed >= r.time && elapsed > 0,
    )
    if (idx !== -1) {
      setPulse(true)
      setFlashStageIdx(idx)
      const t = window.setTimeout(() => {
        setPulse(false)
        setFlashStageIdx(null)
      }, 400)
      prevElapsedRef.current = elapsed
      return () => window.clearTimeout(t)
    }
    prevElapsedRef.current = elapsed
  }, [elapsed, rows])

  const nextStartRow = rows.find((r) => r.time > elapsed)
  const nextIn = nextStartRow ? nextStartRow.time - elapsed : 0
  const totalG = recipeValid && totalLiquorG > 0 ? totalLiquorG : 0

  const resetFeedback = () => {
    setFeedbackMood(null)
    setFeedbackNote('')
  }

  return (
    <div className="lab__timer">
      <p className="lab__timer-target">
        Target brew window: <strong>{formatMmSs(targetSeconds)}</strong>
        {targetSeconds >= 3600 ? ' (steep)' : ''}
      </p>
      <div
        className={
          'lab__timer-display lab__timer-display--countdown' +
          (pulse ? ' lab__timer-display--pulse' : '')
        }
        aria-live="polite"
      >
        {formatCountdown(remaining)}
      </div>
      <p className="lab__timer-countdown-caption">Time remaining in schedule</p>
      {/* ADDED: primary Start/Pause + outlined Reset */}
      <div className="lab__timer-controls">
        <button
          type="button"
          className="lab__timer-btn lab__timer-btn--primary lab__timer-btn--wide"
          onClick={running ? onPause : onStart}
          disabled={doneComplete}
        >
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          type="button"
          className="lab__timer-btn lab__timer-btn--outline lab__timer-btn--wide"
          onClick={() => {
            onReset()
            completeFiredRef.current = false
            resetFeedback()
          }}
        >
          Reset
        </button>
      </div>

      {running && nextStartRow && nextIn > 0 && (
        <p className="lab__timer-next lab__timer-next--prominent">
          Next pour in: <strong>{formatMmSs(nextIn)}</strong> — {nextStartRow.label}
          {totalG > 0 ? ` (${Math.round(nextStartRow.ml)}ml)` : ''}
        </p>
      )}
      {!running && elapsed === 0 && recipeValid && rows[0] && (
        <p className="lab__timer-next lab__timer-next--muted">
          Press Start—begin with {rows[0].label} ({formatMmSs(rows[0].time)}
          {totalLiquorG > 0 ? `, ${rows[0].ml} ml` : ''}).
        </p>
      )}

      <ul className="lab__timer-stages" aria-label="Pour checklist">
        {rows.map((row, i) => {
          const done = elapsed >= row.time + row.duration
          const active =
            elapsed >= row.time && elapsed < row.time + row.duration
          const upcoming = elapsed < row.time
          let mark = '\u00a0'
          if (done) mark = '✓'
          else if (active) mark = '→'
          return (
            <li
              key={`${row.label}-${i}`}
              className={
                'lab__timer-stage' +
                (done ? ' lab__timer-stage--done' : '') +
                (active ? ' lab__timer-stage--current' : '') +
                (upcoming ? ' lab__timer-stage--upcoming' : '') +
                (flashStageIdx === i ? ' lab__timer-stage--flash' : '')
              }
            >
              <span className="lab__timer-stage-mark">{mark}</span>
              <span className="lab__timer-stage-text">
                {formatMmSs(row.time)} — {row.label}{' '}
                <span className="lab__timer-stage-ml">
                  ({totalG > 0 ? `${Math.round(row.ml)}ml` : '— ml'})
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      {timerCompleted && doneComplete && (
        <div className="lab__timer-feedback">
          <h4 className="lab__timer-feedback-title">How was it?</h4>
          <div className="lab__timer-feedback-moods">
            {[
              { id: 'bitter', label: '😖 Too Bitter' },
              { id: 'right', label: '😌 Just Right' },
              { id: 'sour', label: '😣 Too Sour' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                className={
                  feedbackMood === m.id
                    ? 'lab__timer-feedback-btn lab__timer-feedback-btn--active'
                    : 'lab__timer-feedback-btn'
                }
                onClick={() => setFeedbackMood(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label className="lab__timer-feedback-note-label">
            <span>Add a note…</span>
            <textarea
              className="lab__input lab__timer-feedback-textarea"
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="Optional"
              rows={2}
            />
          </label>
          <button
            type="button"
            className="lab__timer-feedback-save"
            disabled={!feedbackMood || brewJournalJustSaved}
            onClick={() => {
              if (!feedbackMood) return
              onSaveJournalEntry?.({
                mood: feedbackMood,
                note: feedbackNote.trim(),
              })
              resetFeedback()
            }}
          >
            Save
          </button>
          {brewJournalJustSaved && (
            <p className="lab__timer-feedback-saved">Saved—nice work.</p>
          )}
        </div>
      )}
    </div>
  )
}
