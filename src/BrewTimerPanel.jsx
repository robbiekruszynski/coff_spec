import { formatMmSs, enrichPourStages, getPourStagesForBrew } from './brewData.js'

function formatTimerDisplay(seconds) {
  const s = Math.floor(Math.max(0, seconds))
  if (s < 3600) return formatMmSs(s)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function BrewTimerPanel({
  espresso,
  brewMethodId,
  targetSeconds,
  totalLiquorG,
  recipeValid,
  coffeeDoseG = null,
  elapsed,
  running,
  onStart,
  onPause,
  onReset,
}) {
  const { stages } = getPourStagesForBrew(espresso, brewMethodId)
  const totalG = recipeValid && totalLiquorG > 0 ? totalLiquorG : 0
  const rows =
    totalG > 0
      ? enrichPourStages(stages, totalG, coffeeDoseG, { espresso })
      : stages.map((s) => ({
          ...s,
          ml: 0,
          mlPerSec: 0,
          fractionOfBrew: 0,
        }))

  const nextStartRow = rows.find((r) => r.time > elapsed)
  const nextIn = nextStartRow ? nextStartRow.time - elapsed : 0

  return (
    <div className="lab__timer">
      <p className="lab__timer-target">
        Target brew window: <strong>{formatTimerDisplay(targetSeconds)}</strong>
        {targetSeconds >= 3600 ? ' (steep)' : ''}
      </p>
      <div className="lab__timer-display" aria-live="polite">
        {formatTimerDisplay(elapsed)}
      </div>
      <div className="lab__timer-controls">
        <button
          type="button"
          className="lab__timer-btn lab__timer-btn--primary"
          onClick={onStart}
          disabled={running}
        >
          Start
        </button>
        <button type="button" className="lab__timer-btn" onClick={onPause} disabled={!running}>
          Pause
        </button>
        <button type="button" className="lab__timer-btn" onClick={onReset}>
          Reset
        </button>
      </div>
      {running && nextStartRow && nextIn > 0 && (
        <p className="lab__timer-next">
          Next pour in: <strong>{nextIn}s</strong> ({nextStartRow.label})
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
          return (
            <li
              key={`${row.label}-${i}`}
              className={
                'lab__timer-stage' +
                (done ? ' lab__timer-stage--done' : '') +
                (active ? ' lab__timer-stage--next' : '')
              }
            >
              <span className="lab__timer-stage-mark">{done ? '✓' : '○'}</span>
              <span className="lab__timer-stage-text">
                {formatMmSs(row.time)} — {row.label}{' '}
                <span className="lab__timer-stage-ml">
                  ({totalG > 0 ? `${row.ml} ml` : '— ml'})
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
