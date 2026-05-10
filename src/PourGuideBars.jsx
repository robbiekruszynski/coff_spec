import { enrichPourStages, formatMmSs, getPourStagesForBrew } from './brewData.js'

export function PourGuideBars({
  espresso,
  brewMethodId,
  methodTitle,
  totalLiquorG,
  recipeValid,
  coffeeDoseG = null,
}) {
  const { stages } = getPourStagesForBrew(espresso, brewMethodId)
  const rows = enrichPourStages(stages, totalLiquorG, coffeeDoseG, {
    espresso,
  })
  const maxMl = Math.max(...rows.map((r) => r.ml), 1)

  if (!recipeValid || totalLiquorG <= 0) {
    return (
      <p className="lab__chart-empty">
        Enter coffee dose and {espresso ? 'yield' : 'water'} to see the pour guide.
      </p>
    )
  }

  return (
    <div className="lab__chart">
      <h3 className="lab__chart-title">{methodTitle} — Pour Guide</h3>
      <ul className="lab__chart-stages" aria-label="Pour stages">
        {rows.map((row, i) => (
          <li key={`${row.label}-${i}`} className="lab__chart-stage">
            <div className="lab__chart-stage-head">
              <span className="lab__chart-stage-label">{row.label}</span>
              <span className="lab__chart-stage-meta">
                {formatMmSs(row.time)} · {row.ml} ml · {row.mlPerSec} ml/s
              </span>
            </div>
            <div className="lab__chart-bar-track">
              <div
                className="lab__chart-bar-fill"
                style={{ width: `${(row.ml / maxMl) * 100}%` }}
              />
            </div>
            <div className="lab__chart-bar-foot">
              <span>Pour volume (relative)</span>
              <span>
                {row.duration}s pour ·{' '}
                {((row.fractionOfBrew ?? row.percent) * 100).toFixed(1)}% of total
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
