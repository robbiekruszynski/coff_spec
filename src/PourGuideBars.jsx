import { useId } from 'react'
import {
  buildPourFlowTimeline,
  enrichPourStages,
  formatMmSs,
  getPourStagesForBrew,
} from './brewData.js'

const FLOW_VB_W = 520
const FLOW_VB_H = 168
const PL = 6
const PR = 6
const PT = 10
const PB = 22

function flowChartGeometry(totalSec, maxRate) {
  const cw = FLOW_VB_W - PL - PR
  const ch = FLOW_VB_H - PT - PB
  const bottom = PT + ch
  const mx = (t) =>
    PL + (totalSec > 0 ? Math.min(1, Math.max(0, t / totalSec)) * cw : 0)
  const my = (r) =>
    bottom - (maxRate > 0 ? Math.min(1, Math.max(0, r / maxRate)) * ch : bottom)
  const myCum = (ml, totalMl) =>
    bottom -
    (totalMl > 0 ? Math.min(1, Math.max(0, ml / totalMl)) * ch : bottom)
  return { cw, ch, bottom, mx, my, myCum }
}

function flowFillPath(segments, geo) {
  const { bottom, mx, my } = geo
  let currentY = bottom
  let d = `M ${PL} ${bottom}`
  for (const s of segments) {
    const x0 = mx(s.startSec)
    const x1 = mx(s.endSec)
    const y = my(s.mlPerSec)
    d += ` L ${x0} ${currentY} L ${x0} ${y} L ${x1} ${y}`
    currentY = y
  }
  const xEnd = PL + geo.cw
  d += ` L ${xEnd} ${currentY} L ${xEnd} ${bottom} Z`
  return d
}

function flowOutlinePath(segments, geo) {
  const { bottom, mx, my } = geo
  let currentY = bottom
  let d = `M ${PL} ${bottom}`
  for (const s of segments) {
    const x0 = mx(s.startSec)
    const x1 = mx(s.endSec)
    const y = my(s.mlPerSec)
    d += ` L ${x0} ${currentY} L ${x0} ${y} L ${x1} ${y}`
    currentY = y
  }
  d += ` L ${PL + geo.cw} ${currentY}`
  return d
}

function cumulativePath(segments, totalLiquorG, totalSec, geo) {
  const { mx, myCum, bottom } = geo
  if (totalLiquorG <= 0 || totalSec <= 0) {
    return `M ${PL} ${bottom} L ${PL + geo.cw} ${bottom}`
  }
  let cum = 0
  let d = `M ${mx(0)} ${myCum(0, totalLiquorG)}`
  let tPrev = 0
  for (const s of segments) {
    const x0 = mx(s.startSec)
    const x1 = mx(s.endSec)
    if (s.startSec > tPrev) {
      d += ` L ${x0} ${myCum(cum, totalLiquorG)}`
    }
    if (s.isGap) {
      d += ` L ${x1} ${myCum(cum, totalLiquorG)}`
    } else {
      const next = +(cum + s.ml).toFixed(4)
      d += ` L ${x1} ${myCum(next, totalLiquorG)}`
      cum = next
    }
    tPrev = s.endSec
  }
  const xEnd = PL + geo.cw
  d += ` L ${xEnd} ${myCum(cum, totalLiquorG)}`
  return d
}

export function PourGuideBars({
  espresso,
  brewMethodId,
  methodTitle,
  totalLiquorG,
  recipeValid,
  coffeeDoseG = null,
}) {
  const flowGradientId = `lab-pour-flow-${useId().replace(/:/g, '')}`

  const { stages } = getPourStagesForBrew(espresso, brewMethodId)
  const rows = enrichPourStages(stages, totalLiquorG, coffeeDoseG, {
    espresso,
  })
  const maxMl = Math.max(...rows.map((r) => r.ml), 1)

  const timeline = buildPourFlowTimeline(rows)
  const { segments, totalSec, maxMlPerSec, activePourSec, peakMlPerSec } =
    timeline
  const avgPourMlPerSec =
    activePourSec > 0 ? Math.round((totalLiquorG / activePourSec) * 100) / 100 : 0
  const flowGeo = flowChartGeometry(totalSec, maxMlPerSec)
  const cumGeo = flowChartGeometry(totalSec, 1)
  const fillD =
    recipeValid &&
    totalLiquorG > 0 &&
    segments.length > 0 &&
    totalSec > 0
      ? flowFillPath(segments, flowGeo)
      : ''
  const outlineD =
    recipeValid && totalLiquorG > 0 && segments.length > 0 && totalSec > 0
      ? flowOutlinePath(segments, flowGeo)
      : ''
  const cumD =
    recipeValid && totalLiquorG > 0 && segments.length > 0 && totalSec > 0
      ? cumulativePath(segments, totalLiquorG, totalSec, cumGeo)
      : ''

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

      <div className="lab__chart-timecharts">
        <div className="lab__timechart">
          <h4 className="lab__chart-subtitle">Flow rate over time</h4>
          <p className="lab__flow-note">
            Constant {espresso ? 'shot' : 'pour'} speed within each stage (ml/s). Gaps
            show <strong>0 ml/s</strong> (wait or steep). Compare peak rate to your
            gooseneck pour.
          </p>
          <div className="lab__flow-svg-wrap">
            <svg
              className="lab__flow-svg"
              viewBox={`0 0 ${FLOW_VB_W} ${FLOW_VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Flow rate in milliliters per second over brew time"
            >
              <defs>
                <linearGradient
                  id={flowGradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="var(--lab-amber)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--lab-amber)" stopOpacity="0.04" />
                </linearGradient>
              </defs>
              <text
                x={PL}
                y={PT - 1}
                className="lab__flow-axis-label"
              >
                ml/s
              </text>
              <text
                x={FLOW_VB_W - PR}
                y={FLOW_VB_H - 4}
                textAnchor="end"
                className="lab__flow-axis-label"
              >
                time
              </text>
              {totalSec > 0 && maxMlPerSec > 0 && (
                <>
                  <line
                    x1={PL}
                    x2={PL + flowGeo.cw}
                    y1={flowGeo.bottom}
                    y2={flowGeo.bottom}
                    className="lab__flow-axis-line"
                  />
                  <line
                    x1={PL}
                    x2={PL}
                    y1={PT}
                    y2={flowGeo.bottom}
                    className="lab__flow-axis-line"
                  />
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <g key={f}>
                      <line
                        x1={PL + f * flowGeo.cw}
                        x2={PL + f * flowGeo.cw}
                        y1={PT}
                        y2={flowGeo.bottom}
                        className="lab__flow-grid-v"
                      />
                      <text
                        x={PL + f * flowGeo.cw}
                        y={FLOW_VB_H - 6}
                        textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
                        className="lab__flow-tick"
                      >
                        {formatMmSs(f * totalSec)}
                      </text>
                    </g>
                  ))}
                  {[0, 0.5, 1].map((f) => {
                    const y = flowGeo.bottom - f * flowGeo.ch
                    return (
                      <g key={`h-${f}`}>
                        <line
                          x1={PL}
                          x2={PL + flowGeo.cw}
                          y1={y}
                          y2={y}
                          className="lab__flow-grid-h"
                        />
                        <text
                          x={PL + 2}
                          y={y - 2}
                          className="lab__flow-tick lab__flow-tick--y"
                        >
                          {f === 0
                            ? '0'
                            : `${Math.round(maxMlPerSec * f * 10) / 10}`}
                        </text>
                      </g>
                    )
                  })}
                  {fillD ? (
                    <path
                      d={fillD}
                      fill={`url(#${flowGradientId})`}
                      stroke="none"
                    />
                  ) : null}
                  {outlineD ? (
                    <path
                      d={outlineD}
                      fill="none"
                      className="lab__flow-outline"
                      strokeWidth="1.75"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                </>
              )}
            </svg>
          </div>
          <dl className="lab__flow-stats">
            <div>
              <dt>Peak</dt>
              <dd>{peakMlPerSec} ml/s</dd>
            </div>
            <div>
              <dt>Avg (pour windows)</dt>
              <dd>{avgPourMlPerSec} ml/s</dd>
            </div>
            <div>
              <dt>Span</dt>
              <dd>
                {formatMmSs(0)} → {formatMmSs(totalSec)} (
                {segments.filter((s) => s.isGap).length > 0
                  ? 'includes pauses'
                  : 'continuous pours'}
                )
              </dd>
            </div>
          </dl>
        </div>

        <div className="lab__timechart">
          <h4 className="lab__chart-subtitle">Cumulative volume</h4>
          <p className="lab__flow-note">
            Total {espresso ? 'yield' : 'water'} added over the schedule (
            {totalLiquorG}
            ml). Slope equals instantaneous pour rate.
          </p>
          <div className="lab__flow-svg-wrap">
            <svg
              className="lab__flow-svg"
              viewBox={`0 0 ${FLOW_VB_W} ${FLOW_VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Cumulative milliliters poured over brew time"
            >
              {totalSec > 0 && totalLiquorG > 0 && (
                <>
                  <line
                    x1={PL}
                    x2={PL + cumGeo.cw}
                    y1={cumGeo.bottom}
                    y2={cumGeo.bottom}
                    className="lab__flow-axis-line"
                  />
                  <line
                    x1={PL}
                    x2={PL}
                    y1={PT}
                    y2={cumGeo.bottom}
                    className="lab__flow-axis-line"
                  />
                  {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <g key={`c-${f}`}>
                      <line
                        x1={PL + f * cumGeo.cw}
                        x2={PL + f * cumGeo.cw}
                        y1={PT}
                        y2={cumGeo.bottom}
                        className="lab__flow-grid-v"
                      />
                      <text
                        x={PL + f * cumGeo.cw}
                        y={FLOW_VB_H - 6}
                        textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
                        className="lab__flow-tick"
                      >
                        {formatMmSs(f * totalSec)}
                      </text>
                    </g>
                  ))}
                  {[0, 0.5, 1].map((f) => {
                    const ml = f * totalLiquorG
                    const y = cumGeo.bottom - f * cumGeo.ch
                    return (
                      <g key={`cc-${f}`}>
                        <line
                          x1={PL}
                          x2={PL + cumGeo.cw}
                          y1={y}
                          y2={y}
                          className="lab__flow-grid-h"
                        />
                        <text
                          x={PL + 2}
                          y={y - 2}
                          className="lab__flow-tick lab__flow-tick--y"
                        >
                          {Math.round(ml)}
                          ml
                        </text>
                      </g>
                    )
                  })}
                  {cumD ? (
                    <>
                      <path
                        d={`${cumD} L ${PL + cumGeo.cw} ${cumGeo.bottom} L ${PL} ${cumGeo.bottom} Z`}
                        className="lab__cum-fill"
                      />
                      <path d={cumD} fill="none" className="lab__cum-line" />
                    </>
                  ) : null}
                </>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
