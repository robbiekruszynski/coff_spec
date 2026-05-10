import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BREW_GUIDES,
  BREW_METHODS,
  BREW_METHOD_GROUP_META,
  DOSE_MODES,
  ESPRESSO_SHOT_BREW_METHOD_ID,
  getBrewMethodLabel,
  getIdealLiquorGrams,
  IDEAL_BATCH_RATIOS,
  IDEAL_ESPRESSO_YIELD_RATIOS,
  MODES,
  parseBrewTimeMidpointSeconds,
  PROCESSING_METHODS,
  ROAST_LEVELS,
} from './brewData.js'
import { PourGuideBars } from './PourGuideBars.jsx'
import { BrewTimerPanel } from './BrewTimerPanel.jsx'
import { RecipeModal } from './RecipeModal.jsx'
import { loadRecipes, saveRecipes } from './recipesStorage.js'
import './App.css'

const EMPTY_SPECS = {
  ratioLabel: '—',
  tds: null,
  yieldPct: null,
  tempC: null,
  grind: '—',
  brewTime: '—',
}

function formatWaterTempCAndF(tempC, coldSteep) {
  if (tempC == null) return '—'
  const f = Math.round((tempC * 9) / 5 + 32)
  const cStr =
    tempC % 1 === 0 ? `${tempC}` : `${Math.round(tempC * 10) / 10}`
  const core = `${cStr}°C / ${f}°F`
  return coldSteep ? `${core} (steep)` : core
}

/** Predicted extraction yield (%): ratio-first; same curve for all batch methods. */
function extractionYieldFromRatio(espresso, ratioNum) {
  if (espresso) {
    const refR = 2
    const refY = 20.9
    // Higher beverage:dose tends to track more water through the puck → slightly higher yield.
    return refY + (ratioNum - refR) * 0.9
  }
  const refR = 16.5
  const refY = 21
  // More brew water per g coffee → gentler/lighter extraction in the glass (% from grounds).
  return refY - (ratioNum - refR) * 0.45
}

function computeSpecs({
  mode,
  dose,
  waterOrYield,
  roast,
  processing,
  brewMethod,
}) {
  if (
    !Number.isFinite(dose) ||
    dose <= 0 ||
    !Number.isFinite(waterOrYield) ||
    waterOrYield <= 0
  ) {
    return EMPTY_SPECS
  }

  const espresso = mode === 'espresso'

  let tds = espresso ? 9.8 : 1.28
  let tempC = espresso ? 92.5 : 94
  let grind = espresso ? 'Fine' : 'Medium-fine'
  let brewTime = espresso ? '25 - 32 s' : '2:45 - 3:15'

  if (brewMethod === 'cold-brew') {
    tempC = 4
    grind = 'Coarse'
    brewTime = '14 - 18 hrs'
    tds = 2.4
  }

  const ratioNum = waterOrYield / dose
  const ratioLabel = `1:${ratioNum.toFixed(1)}`

  let yieldPct = extractionYieldFromRatio(espresso, ratioNum)

  if (roast === 'light') {
    tempC -= 1
    yieldPct += 0.35
    tds += espresso ? 0.15 : 0.03
  } else if (roast === 'dark') {
    tempC += 1
    yieldPct -= 0.55
    tds -= espresso ? 0.2 : 0.04
  }

  if (processing === 'natural') {
    yieldPct += 0.25
    tds += 0.04
  }
  if (processing === 'honey') {
    tds += 0.02
  }
  if (processing === 'anaerobic') {
    tds += 0.06
    yieldPct += 0.2
  }
  if (processing === 'wet-hulled') {
    yieldPct -= 0.15
  }

  if (!espresso) {
    if (ratioNum > 17) {
      tds -= 0.06
    } else if (ratioNum < 15) {
      tds += 0.07
    }
  }

  return {
    ratioLabel,
    tds: Math.round(tds * 100) / 100,
    yieldPct: Math.round(yieldPct * 10) / 10,
    tempC: Math.round(tempC * 10) / 10,
    grind,
    brewTime,
  }
}

const CHART_TABS = [
  { id: 'pour', label: 'Pour Chart' },
  { id: 'timer', label: 'Brew Timer' },
  { id: 'diagnosis', label: 'Diagnosis' },
]

export default function App() {
  const [mode, setMode] = useState('batch')
  const [brewMethod, setBrewMethod] = useState('v60')
  const [roast, setRoast] = useState('medium')
  const [processing, setProcessing] = useState('washed')
  const [doseMode, setDoseMode] = useState('auto')
  const [dose, setDose] = useState(null)
  const [water, setWater] = useState(null)
  const [chartTab, setChartTab] = useState('pour')

  const [timerElapsed, setTimerElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)

  const [savedRecipes, setSavedRecipes] = useState(() => loadRecipes())
  const [recipesOpen, setRecipesOpen] = useState(false)
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [recipeName, setRecipeName] = useState('')
  const [recipeNotes, setRecipeNotes] = useState('')

  const lastBatchBrewMethodRef = useRef('v60')

  const espresso = mode === 'espresso'
  const auto = doseMode === 'auto'

  const idealLiquor = useMemo(
    () => getIdealLiquorGrams(espresso, brewMethod, dose),
    [espresso, brewMethod, dose],
  )

  const liquorCustom =
    water !== null && Number.isFinite(water) && water > 0 ? water : 0
  const waterForSpecs = auto ? idealLiquor : liquorCustom
  const doseForSpecs = dose !== null && dose > 0 ? dose : 0
  const waterInput = waterForSpecs
  const recipeValid = doseForSpecs > 0 && waterInput > 0

  const specs = useMemo(
    () =>
      computeSpecs({
        mode,
        dose: doseForSpecs,
        waterOrYield: waterInput,
        roast,
        processing,
        brewMethod,
      }),
    [mode, doseForSpecs, waterInput, roast, processing, brewMethod],
  )

  const guide = BREW_GUIDES[brewMethod] ?? BREW_GUIDES.v60

  const yieldPct = specs.yieldPct
  const yieldBarMin = 15
  const yieldBarMax = 27
  const yieldClamped =
    yieldPct != null
      ? Math.min(yieldBarMax, Math.max(yieldBarMin, yieldPct))
      : yieldBarMin
  const yieldMarkerPct =
    yieldPct != null
      ? ((yieldClamped - yieldBarMin) / (yieldBarMax - yieldBarMin)) * 100
      : 0
  const idealLowPct = ((18 - yieldBarMin) / (yieldBarMax - yieldBarMin)) * 100
  const idealHighPct = ((24 - yieldBarMin) / (yieldBarMax - yieldBarMin)) * 100

  const targetBrewSeconds = parseBrewTimeMidpointSeconds(specs.brewTime)

  const resetBrewTimer = () => {
    setTimerElapsed(0)
    setTimerRunning(false)
  }

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => {
      setTimerElapsed((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])

  const handleSaveRecipe = () => {
    const entry = {
      id: `${Date.now()}`,
      name: recipeName.trim(),
      notes: recipeNotes.trim(),
      mode,
      brewMethod: espresso ? ESPRESSO_SHOT_BREW_METHOD_ID : brewMethod,
      roast,
      processing,
      doseMode,
      dose: doseForSpecs,
      water: auto ? undefined : water,
      liquorTarget: waterInput,
      savedAt: new Date().toISOString(),
    }
    const next = [...savedRecipes, entry]
    setSavedRecipes(next)
    saveRecipes(next)
    setRecipeModalOpen(false)
    setRecipeName('')
    setRecipeNotes('')
  }

  const handleLoadRecipe = (r) => {
    resetBrewTimer()
    const nextMode = r.mode ?? 'batch'
    setMode(nextMode)
    if (nextMode === 'espresso') {
      setBrewMethod(ESPRESSO_SHOT_BREW_METHOD_ID)
    } else {
      const bid =
        r.brewMethod && r.brewMethod !== ESPRESSO_SHOT_BREW_METHOD_ID
          ? r.brewMethod
          : 'v60'
      setBrewMethod(bid)
      lastBatchBrewMethodRef.current = bid
    }
    setRoast(r.roast ?? 'medium')
    setProcessing(r.processing ?? 'washed')
    const dm = r.doseMode ?? 'auto'
    setDoseMode(dm)
    setDose(r.dose != null ? r.dose : null)
    if (dm === 'custom') {
      setWater(r.water != null ? r.water : null)
    } else {
      setWater(null)
    }
  }

  const handleDeleteRecipe = (id) => {
    const next = savedRecipes.filter((x) => x.id !== id)
    setSavedRecipes(next)
    saveRecipes(next)
  }

  return (
    <div className="lab">
      <header className="lab__header">
        <h1 className="lab__title">extraction-lab</h1>
      </header>

      <div className="lab__layout">
        <div className="lab__col lab__col--left">
          <section className="lab__section">
            <h2 className="lab__label">Mode</h2>
            <div className="lab__segment">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={
                    mode === m.id
                      ? 'lab__segment-btn lab__segment-btn--active'
                      : 'lab__segment-btn'
                  }
                  onClick={() => {
                    const next = m.id
                    if (next === 'espresso') {
                      if (brewMethod !== ESPRESSO_SHOT_BREW_METHOD_ID) {
                        lastBatchBrewMethodRef.current = brewMethod
                      }
                      setBrewMethod(ESPRESSO_SHOT_BREW_METHOD_ID)
                    } else {
                      setBrewMethod(lastBatchBrewMethodRef.current)
                    }
                    setMode(next)
                    setDose(null)
                    setWater(null)
                    setDoseMode('auto')
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          <section className="lab__section lab__section--method">
            <div className="lab__method-header">
              <h2 className="lab__label">
                {espresso ? 'Espresso setup' : 'Brew Method'}
              </h2>
              <p className="lab__method-active" aria-live="polite">
                <span className="lab__method-active-label">Selected</span>
                <span className="lab__method-active-name">
                  {getBrewMethodLabel(brewMethod)}
                </span>
                <span className="lab__method-active-ratio">
                  {espresso
                    ? `Auto yield 1:${(IDEAL_ESPRESSO_YIELD_RATIOS[brewMethod] ?? 2).toFixed(1)}`
                    : `Auto water 1:${(IDEAL_BATCH_RATIOS[brewMethod] ?? 16.5).toFixed(1)}`}
                </span>
              </p>
            </div>
            {espresso ? (
              <div className="lab__espresso-focus">
                <p className="lab__espresso-focus-lead">
                  You’re dialing an <strong>espresso shot</strong> (dose in the basket
                  and beverage yield in the cup). The pour chart uses a simple{' '}
                  <strong>preinfusion + main flow</strong> model—not a filter brew
                  schedule.
                </p>
                <p className="lab__espresso-focus-hint">
                  Use dose &amp; yield below; switch to <strong>Custom</strong> for your
                  machine’s recipe. Batch brew methods return when you switch back to
                  Batch Brew mode.
                </p>
              </div>
            ) : (
              <div className="lab__method-groups">
                {BREW_METHOD_GROUP_META.map((g) => {
                  const methodsInGroup = BREW_METHODS.filter((m) => m.group === g.id)
                  if (methodsInGroup.length === 0) return null
                  return (
                    <div key={g.id} className="lab__method-group">
                      <div className="lab__method-group-head">
                        <h3 className="lab__method-group-title">{g.label}</h3>
                        <p className="lab__method-group-hint">{g.hint}</p>
                      </div>
                      <div className="lab__method-grid">
                        {methodsInGroup.map((m) => {
                          const batchR = IDEAL_BATCH_RATIOS[m.id] ?? 16.5
                          const espR = IDEAL_ESPRESSO_YIELD_RATIOS[m.id] ?? 2
                          return (
                            <button
                              key={m.id}
                              type="button"
                              className={
                                brewMethod === m.id
                                  ? 'lab__method-card lab__method-card--active'
                                  : 'lab__method-card'
                              }
                              aria-pressed={brewMethod === m.id}
                              onClick={() => {
                                resetBrewTimer()
                                setBrewMethod(m.id)
                              }}
                            >
                              <span className="lab__method-card-name">{m.label}</span>
                              <span className="lab__method-card-metrics">
                                <span className="lab__method-card-metric">
                                  Brew water{' '}
                                  <strong className="lab__method-card-strong">
                                    1:{batchR.toFixed(1)}
                                  </strong>
                                </span>
                                <span className="lab__method-card-dot" aria-hidden>
                                  ·
                                </span>
                                <span className="lab__method-card-metric lab__method-card-metric--muted">
                                  Esp. yield{' '}
                                  <strong className="lab__method-card-strong">
                                    1:{espR.toFixed(1)}
                                  </strong>
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="lab__section">
            <h2 className="lab__label">Roast Level</h2>
            <div className="lab__chips">
              {ROAST_LEVELS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={
                    roast === r.id ? 'lab__chip lab__chip--active' : 'lab__chip'
                  }
                  onClick={() => setRoast(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </section>

          <section className="lab__section">
            <h2 className="lab__label">Processing Method</h2>
            <div className="lab__chips lab__chips--wrap">
              {PROCESSING_METHODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={
                    processing === p.id
                      ? 'lab__chip lab__chip--active'
                      : 'lab__chip'
                  }
                  onClick={() => setProcessing(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <div className="lab__saved-recipes">
            <button
              type="button"
              className="lab__saved-recipes-toggle"
              onClick={() => setRecipesOpen((o) => !o)}
              aria-expanded={recipesOpen}
            >
              My Recipes
              <span className="lab__saved-recipes-chev">{recipesOpen ? '▼' : '▶'}</span>
            </button>
            {recipesOpen && (
              <div className="lab__saved-recipes-panel">
                {savedRecipes.length === 0 ? (
                  <p className="lab__saved-recipes-empty">
                    No saved recipes yet. Dial in a brew and save it.
                  </p>
                ) : (
                  <ul className="lab__saved-recipes-list">
                    {savedRecipes.map((r) => (
                      <li key={r.id} className="lab__saved-recipe-card">
                        <button
                          type="button"
                          className="lab__saved-recipe-load"
                          onClick={() => handleLoadRecipe(r)}
                        >
                          <span className="lab__saved-recipe-name">{r.name}</span>
                          <span className="lab__saved-recipe-meta">
                            {(r.mode === 'espresso'
                              ? 'Espresso'
                              : getBrewMethodLabel(r.brewMethod ?? 'v60'))}{' '}
                            ·{' '}
                            {r.dose != null &&
                            (r.liquorTarget != null || r.water != null)
                              ? `1:${(
                                  (r.liquorTarget ?? r.water) / r.dose
                                ).toFixed(1)}`
                              : '—'}{' '}
                            · {r.dose != null ? `${r.dose}g` : '—'}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="lab__saved-recipe-delete"
                          aria-label={`Delete ${r.name}`}
                          onClick={() => handleDeleteRecipe(r.id)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <section className="lab__section">
            <h2 className="lab__label">Dose &amp; water</h2>
            <div className="lab__segment">
              {DOSE_MODES.map((dm) => (
                <button
                  key={dm.id}
                  type="button"
                  className={
                    doseMode === dm.id
                      ? 'lab__segment-btn lab__segment-btn--active'
                      : 'lab__segment-btn'
                  }
                  onClick={() => {
                    const next = dm.id
                    if (next === 'custom' && doseMode === 'auto') {
                      if (dose !== null && dose > 0) {
                        const ideal = getIdealLiquorGrams(
                          espresso,
                          brewMethod,
                          dose,
                        )
                        setWater(ideal > 0 ? ideal : null)
                      } else {
                        setWater(null)
                      }
                    }
                    setDoseMode(next)
                  }}
                >
                  {dm.label}
                </button>
              ))}
            </div>
            <p className="lab__dose-hint">
              {auto ? (
                <>
                  <strong>Auto</strong> keeps an ideal{' '}
                  {espresso ? (
                    <>
                      1:
                      {(IDEAL_ESPRESSO_YIELD_RATIOS[brewMethod] ?? 2).toFixed(1)}{' '}
                      yield for{' '}
                      {getBrewMethodLabel(brewMethod)}. Adjust
                      dose; yield follows.
                    </>
                  ) : (
                    <>
                      1:
                      {(IDEAL_BATCH_RATIOS[brewMethod] ?? 16.5).toFixed(1)} brew ratio
                      for{' '}
                      {getBrewMethodLabel(brewMethod)}. Adjust
                      dose; water follows.
                    </>
                  )}
                </>
              ) : (
                <>
                  <strong>Custom</strong> uses your dose and{' '}
                  {espresso ? 'yield' : 'water'}; metrics below update from those inputs.
                </>
              )}
            </p>
            <div className="lab__grid lab__grid--inputs">
              <label className="lab__input-block">
                <span className="lab__input-label">Coffee Dose (g)</span>
                <input
                  id="coffee-dose-g"
                  className="lab__input"
                  type="number"
                  min={0}
                  step={0.1}
                  value={dose === null ? '' : dose}
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '' || raw === '-') {
                      setDose(null)
                      return
                    }
                    const v = Number(raw)
                    setDose(Number.isFinite(v) ? v : null)
                  }}
                />
              </label>
              <label className="lab__input-block">
                <span className="lab__input-label">
                  {espresso ? 'Yield (g)' : 'Water (g)'}
                  {auto && (
                    <span className="lab__input-sublabel"> (ideal)</span>
                  )}
                </span>
                {auto ? (
                  <output
                    className="lab__input lab__output"
                    htmlFor="coffee-dose-g"
                  >
                    {dose !== null && dose > 0 ? waterInput : 0}
                  </output>
                ) : (
                  <input
                    className="lab__input"
                    type="number"
                    min={0}
                    step={espresso ? 0.1 : 1}
                    value={water === null ? '' : water}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '' || raw === '-') {
                        setWater(null)
                        return
                      }
                      const v = Number(raw)
                      setWater(Number.isFinite(v) ? v : null)
                    }}
                  />
                )}
              </label>
            </div>
            {dose != null && dose > 0 && (
              <button
                type="button"
                className="lab__save-recipe-trigger"
                onClick={() => {
                  setRecipeName('')
                  setRecipeNotes('')
                  setRecipeModalOpen(true)
                }}
              >
                + Save as Recipe
              </button>
            )}
          </section>
        </div>

        <div className="lab__col lab__col--right">
          <div className="lab__ratio-hero">
            <span className="lab__ratio-hero-label">Brew ratio</span>
            <span className="lab__ratio-hero-value">{specs.ratioLabel}</span>
          </div>

          <section className="lab__metrics">
            <article className="lab__metric">
              <h3 className="lab__metric-label">
                {espresso ? 'Est. TDS % (shot)' : 'Estimated TDS %'}
              </h3>
              <p className="lab__metric-value">
                {specs.tds != null ? `${specs.tds}%` : '—'}
              </p>
            </article>
            <article className="lab__metric">
              <h3 className="lab__metric-label">
                Extraction Yield %{!auto && ' (predicted)'}
              </h3>
              <p className="lab__metric-value">
                {specs.yieldPct != null ? `${specs.yieldPct}%` : '—'}
              </p>
            </article>
            <article className="lab__metric">
              <h3 className="lab__metric-label">Water Temperature</h3>
              <p className="lab__metric-value">
                {formatWaterTempCAndF(
                  specs.tempC,
                  brewMethod === 'cold-brew',
                )}
              </p>
            </article>
            <article className="lab__metric">
              <h3 className="lab__metric-label">Grind Size</h3>
              <p className="lab__metric-value">{specs.grind}</p>
            </article>
            <article className="lab__metric">
              <h3 className="lab__metric-label">Brew Time</h3>
              <p className="lab__metric-value">{specs.brewTime}</p>
            </article>
          </section>

          <section className="lab__section lab__section--yield">
            <h2 className="lab__label">
              {auto
                ? 'Extraction Yield Window (ideal 18 - 24%)'
                : 'Predicted extraction yield window (ideal 18 - 24%)'}
            </h2>
            <div className="lab__yield-track">
              <div
                className="lab__yield-ideal"
                style={{
                  left: `${idealLowPct}%`,
                  width: `${idealHighPct - idealLowPct}%`,
                }}
              />
              <div
                className={
                  recipeValid
                    ? 'lab__yield-marker'
                    : 'lab__yield-marker lab__yield-marker--hidden'
                }
                style={{ left: `${yieldMarkerPct}%` }}
                title={yieldPct != null ? `${yieldPct}%` : undefined}
              />
            </div>
            <div className="lab__yield-scale">
              <span>{yieldBarMin}%</span>
              <span>{yieldBarMax}%</span>
            </div>
          </section>

          <nav className="lab__tabs lab__chart-tabs" aria-label="Chart and timer">
            {CHART_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={
                  chartTab === t.id ? 'lab__tab lab__tab--active' : 'lab__tab'
                }
                onClick={() => setChartTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {chartTab === 'pour' && (
            <PourGuideBars
              espresso={espresso}
              brewMethodId={brewMethod}
              methodTitle={guide.title}
              totalLiquorG={waterInput}
              recipeValid={recipeValid}
              coffeeDoseG={doseForSpecs}
            />
          )}

          {chartTab === 'timer' && (
            <BrewTimerPanel
              espresso={espresso}
              brewMethodId={brewMethod}
              targetSeconds={targetBrewSeconds}
              totalLiquorG={waterInput}
              recipeValid={recipeValid}
              coffeeDoseG={doseForSpecs}
              elapsed={timerElapsed}
              running={timerRunning}
              onStart={() => setTimerRunning(true)}
              onPause={() => setTimerRunning(false)}
              onReset={() => {
                setTimerElapsed(0)
                setTimerRunning(false)
              }}
            />
          )}

          {chartTab === 'diagnosis' && (
            <article className="lab__panel">
              <h3 className="lab__panel-title">Cup diagnosis</h3>
              <p className="lab__panel-lead">
                You're brewing on <strong>{guide.title}</strong> with a{' '}
                <strong>
                  {ROAST_LEVELS.find((r) => r.id === roast)?.label}
                </strong>{' '}
                roast and{' '}
                <strong>
                  {PROCESSING_METHODS.find((p) => p.id === processing)?.label}
                </strong>{' '}
                process ({espresso ? 'espresso' : 'filter'}).
              </p>
              <p className="lab__panel-body">
                {!recipeValid ? (
                  'Enter a coffee dose and water (or yield) to see predicted extraction and tasting notes.'
                ) : (
                  <>
                    Yield at <strong>{yieldPct}%</strong>{' '}
                    {yieldPct < 18
                      ? 'leans under-extracted—try finer grind, hotter water (where appropriate), or longer contact.'
                      : yieldPct > 24
                        ? 'approaches over-extraction—open grind, shorten time, or reduce agitation.'
                        : 'sits near the typical juicy window; track TDS alongside sensory for balance.'}
                  </>
                )}
              </p>
              <p className="lab__panel-body">
                {recipeValid ? (
                  <>
                    Estimated TDS <strong>{specs.tds}%</strong> is a model hint only;
                    taste remains the reference.
                  </>
                ) : (
                  '—'
                )}
              </p>
            </article>
          )}

          <details className="lab__method-notes">
            <summary className="lab__method-notes-summary">
              ℹ Method Notes
            </summary>
            <div className="lab__method-notes-body">
              <h3 className="lab__panel-title">{guide.title}</h3>
              <p className="lab__panel-lead">{guide.lead}</p>
              <ol className="lab__steps">
                {guide.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="lab__panel-body">{guide.closing}</p>
              <p className="lab__panel-note">{guide.roastNote}</p>
            </div>
          </details>
        </div>
      </div>

      <RecipeModal
        open={recipeModalOpen}
        onClose={() => setRecipeModalOpen(false)}
        onSave={handleSaveRecipe}
        name={recipeName}
        setName={setRecipeName}
        notes={recipeNotes}
        setNotes={setRecipeNotes}
        summary={{
          methodLabel: getBrewMethodLabel(brewMethod),
          roastLabel: ROAST_LEVELS.find((r) => r.id === roast)?.label ?? '',
          processingLabel:
            PROCESSING_METHODS.find((p) => p.id === processing)?.label ?? '',
          dose: doseForSpecs || dose,
          water:
            auto && recipeValid
              ? waterInput
              : water != null
                ? water
                : null,
          ratioLabel: recipeValid ? specs.ratioLabel : '—',
          espresso,
        }}
      />
    </div>
  )
}
