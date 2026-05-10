import { useId } from 'react'
import {
  buildPourFlowTimeline,
  enrichPourStages,
  formatMmSs,
  getPourStagesForBrew,
} from './brewData.js'

const CAP_COLORS = [
  '#c4873a',
  '#9e7349',
  '#b89a72',
  '#d4821a',
  '#887056',
]

const DIAG_W = 640
const M_LEFT = 8
const M_RIGHT = 8
const M_TOP = 10

const FLOW_PL = M_LEFT + 56
const FLOW_PR = M_RIGHT + 4
/** Vertical layout (from top): schedule, cumulative, flow. */
const LANE_SCHED_H = 52
const LANE_SCHED_GAP = 12
const LANE_CUM_H = 92
const LANE_CUM_GAP = 22
const LANE_FLOW_H = 92
/** Title row per lane — must clear plot + y-axis tick labels. */
const LANE_CAPTION_H = 20
/** Inner plot insets so curves and callouts do not collide with lane titles. */
const CUM_PLOT_PAD_TOP = 10
const CUM_PLOT_PAD_BOT = 6
const FLOW_PLOT_PAD_TOP = 8
const FLOW_PLOT_PAD_BOT = 6

function bandGeometry(totalSec) {
  const cw = DIAG_W - FLOW_PL - FLOW_PR
  const mx = (t) =>
    FLOW_PL +
    (totalSec > 0 ? Math.min(1, Math.max(0, t / totalSec)) * cw : 0)
  return { cw, mx, innerW: cw }
}

function flowGeometryInLane(
  totalSec,
  maxRate,
  laneTop,
  laneH,
  { padTop = 0, padBot = 0 } = {},
) {
  const { cw, mx } = bandGeometry(totalSec)
  const plotTop = laneTop + padTop
  const plotH = Math.max(6, laneH - padTop - padBot)
  const bottom = plotTop + plotH
  const my = (r) =>
    bottom -
    (maxRate > 0 ? Math.min(1, Math.max(0, r / maxRate)) * plotH : bottom)
  const myCum = (ml, totalMl) =>
    bottom -
    (totalMl > 0 ? Math.min(1, Math.max(0, ml / totalMl)) * plotH : bottom)
  return { cw, bottom, laneTop, plotTop, plotH, mx, my, myCum }
}

function flowFillPath(segments, geo, PL) {
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

function flowOutlinePath(segments, geo, PL) {
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

function cumulativePath(segments, totalLiquorG, totalSec, geo, PL) {
  const { mx, myCum, bottom } = geo
  if (totalLiquorG <= 0 || totalSec <= 0) {
    return `M ${PL} ${bottom} L ${PL + geo.cw} ${bottom}`
  }
  let cum = 0
  let d = `M ${mx(0)} ${myCum(0, totalLiquorG)}`
  let tPrev = 0
  for (const s of segments) {
    if (s.startSec > tPrev) {
      d += ` L ${mx(s.startSec)} ${myCum(cum, totalLiquorG)}`
    }
    if (s.isGap) {
      d += ` L ${mx(s.endSec)} ${myCum(cum, totalLiquorG)}`
    } else {
      const next = +(cum + s.ml).toFixed(4)
      d += ` L ${mx(s.endSec)} ${myCum(next, totalLiquorG)}`
      cum = next
    }
    tPrev = s.endSec
  }
  d += ` L ${PL + geo.cw} ${myCum(cum, totalLiquorG)}`
  return d
}

/** Midpoint ML for labeling each pour segment on cumulative curve */
function cumulativeSegmentEnds(segments) {
  let cum = 0
  const out = []
  for (const s of segments) {
    if (!s.isGap && s.ml > 0) {
      cum += s.ml
      const midT = (s.startSec + s.endSec) / 2
      out.push({ t: midT, cum, label: s.label })
    }
  }
  return out
}

export function PourGuideBars({
  espresso,
  brewMethodId,
  methodTitle,
  totalLiquorG,
  recipeValid,
  coffeeDoseG = null,
}) {
  const diagramUid = useId().replace(/:/g, '')
  const hatchId = `lab-pour-hatch-${diagramUid}`
  const flowGradientId = `lab-pour-flow-${diagramUid}`
  const clipCumId = `clip-cum-${diagramUid}`
  const clipFlowId = `clip-flow-${diagramUid}`

  const { stages } = getPourStagesForBrew(espresso, brewMethodId)
  const rows = enrichPourStages(stages, totalLiquorG, coffeeDoseG, {
    espresso,
  })

  const timeline = buildPourFlowTimeline(rows)
  const { segments, totalSec, maxMlPerSec, activePourSec, peakMlPerSec } =
    timeline
  const avgPourMlPerSec =
    activePourSec > 0
      ? Math.round((totalLiquorG / activePourSec) * 100) / 100
      : 0

  const pauseSecTotal = segments
    .filter((s) => s.isGap)
    .reduce((a, s) => a + (s.endSec - s.startSec), 0)

  const band = bandGeometry(totalSec)
  const { cw, mx: mxTime } = band

  const ySched = M_TOP + 16
  const schedBarH = LANE_SCHED_H - 8
  const yCum = ySched + LANE_SCHED_H + LANE_SCHED_GAP
  const cumLaneInnerTop = yCum + LANE_CAPTION_H
  const cumLaneInnerH = LANE_CUM_H - LANE_CAPTION_H
  const yFlow = yCum + LANE_CUM_H + LANE_CUM_GAP
  const flowLaneInnerTop = yFlow + LANE_CAPTION_H
  const flowLaneInnerH = LANE_FLOW_H - LANE_CAPTION_H

  const cumGeoForPath = flowGeometryInLane(
    totalSec,
    1,
    cumLaneInnerTop,
    cumLaneInnerH,
    { padTop: CUM_PLOT_PAD_TOP, padBot: CUM_PLOT_PAD_BOT },
  )
  const flowGeoForPath = flowGeometryInLane(
    totalSec,
    maxMlPerSec,
    flowLaneInnerTop,
    flowLaneInnerH,
    { padTop: FLOW_PLOT_PAD_TOP, padBot: FLOW_PLOT_PAD_BOT },
  )


  const fillD =
    recipeValid &&
    totalLiquorG > 0 &&
    segments.length > 0 &&
    totalSec > 0
      ? flowFillPath(segments, flowGeoForPath, FLOW_PL)
      : ''
  const outlineD =
    recipeValid && totalLiquorG > 0 && segments.length > 0 && totalSec > 0
      ? flowOutlinePath(segments, flowGeoForPath, FLOW_PL)
      : ''
  const cumD =
    recipeValid && totalLiquorG > 0 && segments.length > 0 && totalSec > 0
      ? cumulativePath(segments, totalLiquorG, totalSec, cumGeoForPath, FLOW_PL)
      : ''

  const cumMarkers = cumulativeSegmentEnds(segments)
  const ratioStr =
    coffeeDoseG != null &&
    Number.isFinite(coffeeDoseG) &&
    coffeeDoseG > 0 &&
    totalLiquorG > 0
      ? `1:${(totalLiquorG / coffeeDoseG).toFixed(1)}`
      : '—'

  const timeAxisY = flowGeoForPath.bottom + 12
  const diagH = timeAxisY + 34

  if (!recipeValid || totalLiquorG <= 0) {
    return (
      <p className="lab__chart-empty">
        Enter coffee dose and {espresso ? 'yield' : 'water'} to see the pour diagram.
      </p>
    )
  }

  return (
    <figure className="lab__pour-diagram">
      <figcaption className="lab__pour-diagram-head">
        <h3 className="lab__chart-title lab__pour-diagram-title">
          {methodTitle} — pour schedule
        </h3>
        <p className="lab__pour-diagram-summary">
          <span className="lab__pour-diagram-pill">
            {coffeeDoseG != null && coffeeDoseG > 0
              ? `${coffeeDoseG} g coffee`
              : '— g coffee'}
          </span>
          <span className="lab__pour-diagram-pill">
            → {Math.round(totalLiquorG)} ml total{' '}
            {espresso ? 'yield' : 'brew water'}
          </span>
          <span className="lab__pour-diagram-pill">Ratio {ratioStr}</span>
          <span className="lab__pour-diagram-pill">
            {rows.length} stage{rows.length === 1 ? '' : 's'}
          </span>
          <span className="lab__pour-diagram-pill">
            Timeline {formatMmSs(0)}–{formatMmSs(totalSec)}
          </span>
        </p>
      </figcaption>

      <div className="lab__pour-diagram-card">
        <svg
          className="lab__pour-diagram-svg"
          viewBox={`0 0 ${DIAG_W} ${diagH}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Pour schedule diagram for ${methodTitle}: time-based stages, cumulative volume, and flow rate`}
        >
          <defs>
            <pattern
              id={hatchId}
              patternUnits="userSpaceOnUse"
              width={6}
              height={6}
              patternTransform="rotate(45)"
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="#4a433c"
                strokeWidth={1}
              />
            </pattern>
            <linearGradient
              id={flowGradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="var(--lab-amber)" stopOpacity="0.42" />
              <stop offset="100%" stopColor="var(--lab-amber)" stopOpacity="0.06" />
            </linearGradient>
            <clipPath id={clipCumId}>
              <rect
                x={FLOW_PL}
                y={cumGeoForPath.plotTop}
                width={cumGeoForPath.cw}
                height={cumGeoForPath.plotH}
              />
            </clipPath>
            <clipPath id={clipFlowId}>
              <rect
                x={FLOW_PL}
                y={flowGeoForPath.plotTop}
                width={flowGeoForPath.cw}
                height={flowGeoForPath.plotH}
              />
            </clipPath>
          </defs>

          {/* Lane labels */}
          <text x={M_LEFT} y={ySched + schedBarH / 2 + 4} className="lab__diag-lane-label">
            Schedule
          </text>
          <text
            x={M_LEFT}
            y={yCum + LANE_CUM_H / 2}
            className="lab__diag-lane-label"
          >
            Volume
          </text>
          <text
            x={M_LEFT}
            y={yFlow + LANE_FLOW_H / 2}
            className="lab__diag-lane-label"
          >
            Flow
          </text>

          {/* Shared time axis line */}
          <line
            x1={FLOW_PL}
            x2={FLOW_PL + cw}
            y1={timeAxisY}
            y2={timeAxisY}
            className="lab__diag-axis-base"
          />

          {/* Time ticks */}
          {totalSec > 0 &&
            [0, 0.25, 0.5, 0.75, 1].map((f) => {
              const x = mxTime(f * totalSec)
              return (
                <g key={`tick-${f}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={ySched - 4}
                    y2={timeAxisY}
                    className="lab__diag-grid-v"
                  />
                  <text
                    x={x}
                    y={timeAxisY + 14}
                    textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}
                    className="lab__diag-tick"
                  >
                    {formatMmSs(f * totalSec)}
                  </text>
                </g>
              )
            })}

          {/* Schedule lane: capsules */}
          {totalSec > 0 &&
            segments.map((s, i) => {
              const pourOrdinal = segments
                .slice(0, i)
                .filter((x) => !x.isGap).length
              const x0 = mxTime(s.startSec)
              const x1 = mxTime(s.endSec)
              const w = Math.max(x1 - x0, 2)
              const color = s.isGap
                ? `url(#${hatchId})`
                : CAP_COLORS[pourOrdinal % CAP_COLORS.length]
              const stroke = s.isGap ? '#5c534a' : '#1a1613'
              return (
                <g key={`cap-${i}`}>
                  <title>
                    {s.isGap
                      ? `Pause ${formatMmSs(s.startSec)}–${formatMmSs(s.endSec)} (${(s.endSec - s.startSec).toFixed(0)}s) · no pour`
                      : `${s.label}: ${formatMmSs(s.startSec)}–${formatMmSs(s.endSec)} · ${s.ml} ml · ${s.mlPerSec} ml/s · ${(s.endSec - s.startSec).toFixed(0)}s window`}
                  </title>
                  <rect
                    x={x0}
                    y={ySched}
                    width={w}
                    height={schedBarH}
                    rx={4}
                    fill={color}
                    stroke={stroke}
                    strokeWidth={1}
                    className={
                      s.isGap
                        ? 'lab__diag-capsule lab__diag-capsule--pause'
                        : 'lab__diag-capsule'
                    }
                  />
                  {!s.isGap && w > 52 && (
                    <text
                      x={x0 + w / 2}
                      y={ySched + 20}
                      textAnchor="middle"
                      className="lab__diag-capsule-text"
                    >
                      {s.label}
                    </text>
                  )}
                  {!s.isGap && w > 40 && (
                    <text
                      x={x0 + w / 2}
                      y={ySched + 36}
                      textAnchor="middle"
                      className="lab__diag-capsule-sub"
                    >
                      {Math.round(s.ml)} ml · {s.mlPerSec} ml/s
                    </text>
                  )}
                  {s.isGap && w > 28 && (
                    <text
                      x={x0 + w / 2}
                      y={ySched + schedBarH / 2 + 4}
                      textAnchor="middle"
                      className="lab__diag-capsule-sub"
                    >
                      pause
                    </text>
                  )}
                </g>
              )
            })}

          {/* Cumulative lane */}
          {totalSec > 0 && totalLiquorG > 0 && (
            <>
              <text
                x={FLOW_PL + 2}
                y={yCum + 14}
                className="lab__diag-lane-caption"
              >
                Cumulative {espresso ? 'yield' : 'water'} (ml)
              </text>
              <line
                x1={FLOW_PL}
                x2={FLOW_PL}
                y1={cumGeoForPath.plotTop}
                y2={cumGeoForPath.bottom}
                className="lab__diag-axis-line"
              />
              <line
                x1={FLOW_PL}
                x2={FLOW_PL + cumGeoForPath.cw}
                y1={cumGeoForPath.bottom}
                y2={cumGeoForPath.bottom}
                className="lab__diag-axis-line"
              />
              {[0, 0.5, 1].map((f) => {
                const y = cumGeoForPath.bottom - f * cumGeoForPath.plotH
                const ml = f * totalLiquorG
                return (
                  <g key={`cumg-${f}`}>
                    <line
                      x1={FLOW_PL}
                      x2={FLOW_PL + cumGeoForPath.cw}
                      y1={y}
                      y2={y}
                      className="lab__diag-grid-h"
                    />
                    <text
                      x={FLOW_PL - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="lab__diag-tick-side"
                    >
                      {Math.round(ml)}
                    </text>
                  </g>
                )
              })}
              {cumD ? (
                <g clipPath={`url(#${clipCumId})`}>
                  <path
                    d={`${cumD} L ${FLOW_PL + cumGeoForPath.cw} ${cumGeoForPath.bottom} L ${FLOW_PL} ${cumGeoForPath.bottom} Z`}
                    className="lab__cum-fill"
                  />
                  <path d={cumD} fill="none" className="lab__cum-line" />
                </g>
              ) : null}
              {cumMarkers.map((m, i) => {
                const cx = cumGeoForPath.mx(m.t)
                const cy = cumGeoForPath.myCum(m.cum, totalLiquorG)
                const upperBand =
                  cy <= cumGeoForPath.plotTop + cumGeoForPath.plotH * 0.3
                const labelY = upperBand ? cy + 13 : cy - 8
                return (
                  <g key={`m-${i}`}>
                    <circle cx={cx} cy={cy} r={3.5} className="lab__diag-dot" />
                    <text
                      x={cx}
                      y={labelY}
                      textAnchor="middle"
                      className="lab__diag-marker-label"
                    >
                      {Math.round(m.cum)}
                    </text>
                  </g>
                )
              })}
            </>
          )}

          {/* Flow lane */}
          {totalSec > 0 && maxMlPerSec > 0 && (
            <>
              <text
                x={FLOW_PL + 2}
                y={yFlow + 14}
                className="lab__diag-lane-caption"
              >
                Flow rate (ml/s)
              </text>
              <text
                x={FLOW_PL + cw - 4}
                y={yFlow + 14}
                textAnchor="end"
                className="lab__diag-lane-caption lab__diag-lane-caption--muted"
              >
                peak {peakMlPerSec}
              </text>
              <line
                x1={FLOW_PL}
                x2={FLOW_PL}
                y1={flowGeoForPath.plotTop}
                y2={flowGeoForPath.bottom}
                className="lab__diag-axis-line"
              />
              <line
                x1={FLOW_PL}
                x2={FLOW_PL + flowGeoForPath.cw}
                y1={flowGeoForPath.bottom}
                y2={flowGeoForPath.bottom}
                className="lab__diag-axis-line"
              />
              {[0, 0.5, 1].map((f) => {
                const y = flowGeoForPath.bottom - f * flowGeoForPath.plotH
                return (
                  <g key={`flowg-${f}`}>
                    <line
                      x1={FLOW_PL}
                      x2={FLOW_PL + flowGeoForPath.cw}
                      y1={y}
                      y2={y}
                      className="lab__diag-grid-h"
                    />
                    <text
                      x={FLOW_PL - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="lab__diag-tick-side"
                    >
                      {f === 0 ? '0' : `${Math.round(maxMlPerSec * f * 10) / 10}`}
                    </text>
                  </g>
                )
              })}
              {fillD || outlineD ? (
                <g clipPath={`url(#${clipFlowId})`}>
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
                </g>
              ) : null}
            </>
          )}

          {/* Legend */}
          <g transform={`translate(${FLOW_PL + cw - 120}, ${M_TOP})`}>
            <rect
              x={0}
              y={0}
              width={10}
              height={10}
              fill={CAP_COLORS[0]}
              rx={2}
            />
            <text x={14} y={9} className="lab__diag-legend">
              pour
            </text>
            <rect x={52} y={0} width={10} height={10} fill={`url(#${hatchId})`} rx={2} />
            <text x={66} y={9} className="lab__diag-legend">
              pause
            </text>
          </g>
        </svg>

        <dl className="lab__pour-diagram-facts">
          <div>
            <dt>Delivered volume</dt>
            <dd>
              {rows.map((r) => Math.round(r.ml)).join(' + ')} ={' '}
              {Math.round(totalLiquorG)} ml
            </dd>
          </div>
          <div>
            <dt>Pour vs pause</dt>
            <dd>
              Pouring windows: {formatMmSs(activePourSec)} combined · Pauses:{' '}
              {pauseSecTotal > 0 ? `${pauseSecTotal}s` : 'none'} · End of schedule{' '}
              {formatMmSs(totalSec)}
            </dd>
          </div>
          <div>
            <dt>Throughput</dt>
            <dd>
              Peak {peakMlPerSec} ml/s · Avg over pour windows {avgPourMlPerSec}{' '}
              ml/s · Model assumes even pour speed within each stage
            </dd>
          </div>
          <div>
            <dt>Stage checklist</dt>
            <dd className="lab__pour-diagram-checklist">
              {rows.map((r, i) => (
                <span key={`${r.label}-${i}`} className="lab__pour-diagram-chip">
                  <strong>{r.label}</strong>{' '}
                  <span className="lab__pour-diagram-chip-meta">
                    {formatMmSs(r.time)} · {Math.round(r.ml)} ml · {r.duration}s ·{' '}
                    {((r.fractionOfBrew ?? r.percent) * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </figure>
  )
}
