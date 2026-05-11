import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BREW_GUIDES,
  BREW_METHODS,
  DEFAULT_ESPRESSO_DOSE_G,
  DOSE_MODES,
  ESPRESSO_SHOT_BREW_METHOD_ID,
  defaultDoseForBatchMethod,
  getBrewMethodLabel,
  getEnrichedPourRows,
  getIdealLiquorGrams,
  getScheduleEndSecondsFromRows,
  IDEAL_BATCH_RATIOS,
  IDEAL_ESPRESSO_YIELD_RATIOS,
  MODES,
  parseBrewTimeMidpointSeconds,
  PROCESSING_METHODS,
  ROAST_LEVELS,
} from './brewData.js'
import { PourGuideBars } from './PourGuideBars.jsx'
import { BrewTimerPanel } from './BrewTimerPanel.jsx'
import { CustomRecipeModal } from './CustomRecipeModal.jsx'
import { CustomRecipeDetailModal } from './CustomRecipeDetailModal.jsx'
import { MethodCardScroller } from './MethodCardScroller.jsx'
// ADDED: first-visit onboarding
import {
  hasVisitedBefore,
  markVisited,
  OnboardingTour,
} from './OnboardingTour.jsx'
// ADDED: custom recipes + journal persistence
import {
  loadCustomRecipes,
  mergeCustomRecipesDedup,
  saveCustomRecipes,
} from './customRecipesStorage.js'
import { loadBrewJournal, saveBrewJournal } from './brewJournalStorage.js'
import {
  loadGrindSessionMap,
  saveGrindSessionMap,
} from './grindSessionStorage.js'
import './App.css'

// ADDED: mood → emoji for journal + method cards
const MOOD_EMOJI = { bitter: '😖', right: '😌', sour: '😣' }

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
    return refY + (ratioNum - refR) * 0.9
  }
  const refR = 16.5
  const refY = 21
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

// ADDED: strength copy from live ratio (batch or espresso: same numeric bands on 1:X)
function ratioStrengthLabel(ratioNum) {
  if (!Number.isFinite(ratioNum) || ratioNum <= 0) return '—'
  if (ratioNum < 12) return { label: 'Strong', key: 'strong' }
  if (ratioNum < 15) return { label: 'Rich', key: 'rich' }
  if (ratioNum <= 17) return { label: 'Balanced', key: 'balanced' }
  return { label: 'Light', key: 'light' }
}

// ADDED: tab order — Pour Chart default
const CHART_TABS = [
  { id: 'guide', label: 'Brew Guide' },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'pour', label: 'Pour Chart' },
  { id: 'timer', label: 'Timer' },
]

export default function App() {
  const [mode, setMode] = useState('batch')
  const [brewMethod, setBrewMethod] = useState('v60')
  const [roast, setRoast] = useState('medium')
  const [processing, setProcessing] = useState('washed')
  const [doseMode, setDoseMode] = useState('auto')
  const [dose, setDose] = useState(() => defaultDoseForBatchMethod('v60'))
  const [water, setWater] = useState(null)
  const [chartTab, setChartTab] = useState('pour')

  const [timerElapsed, setTimerElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerCompleted, setTimerCompleted] = useState(false)

  const [customRecipes, setCustomRecipes] = useState(() => loadCustomRecipes())
  const [selectedCustomRecipeId, setSelectedCustomRecipeId] = useState(null)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customModalInitial, setCustomModalInitial] = useState(null)
  const [recipeDetailId, setRecipeDetailId] = useState(null)

  const [grindSessionNotes, setGrindSessionNotes] = useState('')

  const [brewJournal, setBrewJournal] = useState(() => loadBrewJournal())
  const [brewJournalJustSaved, setBrewJournalJustSaved] = useState(false)

  const [onboardStep, setOnboardStep] = useState(() =>
    hasVisitedBefore() ? 0 : 1,
  )

  const importRef = useRef(null)
  const lastBatchBrewMethodRef = useRef('v60')

  const persistGrindNotesForKey = useCallback((key, text) => {
    const map = loadGrindSessionMap()
    map[key] = text
    saveGrindSessionMap(map)
  }, [])

  const espresso = mode === 'espresso'
  const auto = doseMode === 'auto'

  // ADDED: resolve custom recipe record
  const selectedCustomRecipe = useMemo(
    () => customRecipes.find((c) => c.id === selectedCustomRecipeId) ?? null,
    [customRecipes, selectedCustomRecipeId],
  )

  const recipeForDetail = useMemo(() => {
    if (!recipeDetailId) return null
    return customRecipes.find((c) => c.id === recipeDetailId) ?? null
  }, [customRecipes, recipeDetailId])

  // ADDED: batch ideal ratio includes custom recipe override
  const idealBatchRatio = useMemo(() => {
    if (selectedCustomRecipe && Number.isFinite(Number(selectedCustomRecipe.ratio))) {
      return Number(selectedCustomRecipe.ratio)
    }
    return IDEAL_BATCH_RATIOS[brewMethod] ?? 16.5
  }, [selectedCustomRecipe, brewMethod])

  const idealLiquor = useMemo(() => {
    if (dose == null || !Number.isFinite(Number(dose)) || Number(dose) <= 0) {
      return 0
    }
    const d = Number(dose)
    if (espresso) {
      return getIdealLiquorGrams(true, brewMethod, d)
    }
    return Math.round(d * idealBatchRatio)
  }, [espresso, brewMethod, dose, idealBatchRatio])

  const liquorCustom =
    water !== null && Number.isFinite(water) && water > 0 ? water : 0
  const waterForSpecs = auto ? idealLiquor : liquorCustom
  const doseForSpecs = dose !== null && dose > 0 ? dose : 0
  const waterInput = waterForSpecs
  const recipeValid = doseForSpecs > 0 && waterInput > 0

  // ADDED: shared pour rows for chart + timer (no calc changes inside brewData)
  const enrichedPourRows = useMemo(
    () =>
      getEnrichedPourRows(espresso, brewMethod, waterInput, doseForSpecs),
    [espresso, brewMethod, waterInput, doseForSpecs],
  )
  const scheduleEndSeconds = useMemo(
    () => getScheduleEndSecondsFromRows(enrichedPourRows),
    [enrichedPourRows],
  )

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

  // ADDED: display grind/temp/time from custom recipe when active
  const displayGrind = selectedCustomRecipe?.grind ?? specs.grind
  const displayTempC = selectedCustomRecipe?.tempC ?? specs.tempC
  const displayBrewTime = selectedCustomRecipe?.brewTime ?? specs.brewTime

  const liveRatioNum =
    recipeValid && doseForSpecs > 0 ? waterInput / doseForSpecs : 0
  const liveRatioLabel = recipeValid ? `1:${liveRatioNum.toFixed(1)}` : '—'
  const strengthMeta = ratioStrengthLabel(liveRatioNum)

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

  const targetBrewSeconds = parseBrewTimeMidpointSeconds(displayBrewTime)

  const chartMethodTitle = selectedCustomRecipe
    ? selectedCustomRecipe.name
    : getBrewMethodLabel(brewMethod)

  const journalMethodKey = selectedCustomRecipe
    ? `custom:${selectedCustomRecipe.id}`
    : brewMethod

  const resetBrewTimer = useCallback(() => {
    setTimerElapsed(0)
    setTimerRunning(false)
    setTimerCompleted(false)
  }, [])

  useEffect(() => {
    if (!timerRunning) return
    const id = window.setInterval(() => {
      setTimerElapsed((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])

  useEffect(() => {
    resetBrewTimer()
  }, [brewMethod, selectedCustomRecipeId, resetBrewTimer])

  useEffect(() => {
    if (!brewJournalJustSaved) return
    const t = window.setTimeout(() => setBrewJournalJustSaved(false), 2800)
    return () => window.clearTimeout(t)
  }, [brewJournalJustSaved])

  // ADDED: grind session textarea — load per brew context; recipe default if no session
  useEffect(() => {
    const map = loadGrindSessionMap()
    let next = ''
    if (Object.prototype.hasOwnProperty.call(map, journalMethodKey)) {
      next = map[journalMethodKey] ?? ''
    } else if (selectedCustomRecipe?.grindDetails) {
      next = selectedCustomRecipe.grindDetails
    }
    setGrindSessionNotes(typeof next === 'string' ? next : '')
  }, [
    journalMethodKey,
    selectedCustomRecipeId,
    selectedCustomRecipe?.grindDetails,
  ])

  // ADDED: default dose when switching batch ↔ espresso
  useEffect(() => {
    if (mode === 'espresso') {
      setSelectedCustomRecipeId(null)
      setDose(DEFAULT_ESPRESSO_DOSE_G)
      setDoseMode('auto')
      setWater(null)
    } else {
      setDose(defaultDoseForBatchMethod(lastBatchBrewMethodRef.current))
      setDoseMode('auto')
      setWater(null)
    }
  }, [mode])

  const persistCustom = useCallback((next) => {
    setCustomRecipes(next)
    saveCustomRecipes(next)
  }, [])

  const handleSelectBuiltInMethod = useCallback(
    (id) => {
      resetBrewTimer()
      setSelectedCustomRecipeId(null)
      setBrewMethod(id)
      lastBatchBrewMethodRef.current = id
      setDose(defaultDoseForBatchMethod(id))
      setDoseMode('auto')
      setWater(null)
    },
    [resetBrewTimer],
  )

  const applyCustomRecipe = useCallback(
    (c) => {
      resetBrewTimer()
      setSelectedCustomRecipeId(c.id)
      setBrewMethod(c.baseMethodId)
      lastBatchBrewMethodRef.current = c.baseMethodId
      setDose(defaultDoseForBatchMethod(c.baseMethodId))
      setDoseMode('auto')
      setWater(null)
    },
    [resetBrewTimer],
  )

  const handleSaveCustomModal = useCallback(
    (recipe) => {
      const exists = customRecipes.some((x) => x.id === recipe.id)
      const next = exists
        ? customRecipes.map((x) => (x.id === recipe.id ? recipe : x))
        : [...customRecipes, recipe]
      persistCustom(next)
      setCustomModalOpen(false)
      setCustomModalInitial(null)
    },
    [customRecipes, persistCustom],
  )

  const handleDeleteCustom = useCallback(
    (id) => {
      if (selectedCustomRecipeId === id) {
        setSelectedCustomRecipeId(null)
      }
      if (recipeDetailId === id) {
        setRecipeDetailId(null)
      }
      persistCustom(customRecipes.filter((c) => c.id !== id))
    },
    [customRecipes, persistCustom, recipeDetailId, selectedCustomRecipeId],
  )

  const handleExportRecipes = useCallback(() => {
    const blob = new Blob([JSON.stringify(customRecipes, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'coffeespec-recipes.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [customRecipes])

  const handleImportRecipes = useCallback(
    (file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result || '[]')
          const arr = Array.isArray(imported) ? imported : []
          const merged = mergeCustomRecipesDedup(customRecipes, arr)
          persistCustom(merged)
        } catch {
          /* ignore invalid */
        }
      }
      reader.readAsText(file)
    },
    [customRecipes, persistCustom],
  )

  const handleSaveJournalEntry = useCallback(({ mood, note }) => {
    const emoji = MOOD_EMOJI[mood] ?? '—'
    const entry = {
      methodKey: journalMethodKey,
      doseG: doseForSpecs,
      waterG: waterInput,
      mood: emoji,
      note: note || '',
      at: new Date().toISOString(),
    }
    setBrewJournal((prev) => {
      const next = [entry, ...prev]
      saveBrewJournal(next)
      return next
    })
    setBrewJournalJustSaved(true)
  }, [journalMethodKey, doseForSpecs, waterInput])

  const dismissOnboard = useCallback(() => {
    markVisited()
    setOnboardStep(0)
  }, [])

  const nextOnboard = useCallback(() => {
    setOnboardStep((s) => {
      if (s >= 3) {
        markVisited()
        return 0
      }
      return s + 1
    })
  }, [])

  return (
    <div className="lab">
      {onboardStep >= 1 && onboardStep <= 3 && (
        <OnboardingTour
          step={onboardStep}
          onNext={nextOnboard}
          onDismiss={dismissOnboard}
          targets={{}}
        />
      )}

      <header className="lab__header">
        <h1 className="lab__title">extraction-lab</h1>
        {/* ADDED: hero subtitle */}
        <p className="lab__tagline">
          Dial in your brew. Nail the ratio. Never over-extract again.
        </p>
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
                  {selectedCustomRecipe
                    ? selectedCustomRecipe.name
                    : getBrewMethodLabel(brewMethod)}
                </span>
                <span className="lab__method-active-ratio">
                  {espresso
                    ? `Auto yield 1:${(IDEAL_ESPRESSO_YIELD_RATIOS[brewMethod] ?? 2).toFixed(1)}`
                    : `Ideal water 1:${idealBatchRatio.toFixed(1)}`}
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
              <MethodCardScroller
                brewMethod={brewMethod}
                selectedCustomRecipeId={selectedCustomRecipeId}
                journal={brewJournal}
                onSelectBuiltIn={handleSelectBuiltInMethod}
              />
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

          {/* ADDED: cupping / quality scale reference (informational only) */}
          <details className="lab__grading-ref">
            <summary className="lab__grading-ref-summary">Coffee grading reference</summary>
            <div className="lab__grading-ref-body">
              <p className="lab__grading-ref-lead">
                Quick reference aligned with common <strong>SCA cupping</strong> score bands
                (6–10). Your in-cup results are what matter — this is only a shared vocabulary.
              </p>
              <ul className="lab__grading-ref-scale">
                <li>
                  <span className="lab__grading-ref-band">6.0 – 6.75</span> Below specialty — noticeable defects
                </li>
                <li>
                  <span className="lab__grading-ref-band">6.75 – 7.5</span> Commercial / acceptable
                </li>
                <li>
                  <span className="lab__grading-ref-band">7.5 – 8.0</span> Specialty — good clarity
                </li>
                <li>
                  <span className="lab__grading-ref-band">8.0 – 8.75</span> Specialty — very good, distinct character
                </li>
                <li>
                  <span className="lab__grading-ref-band">8.75 – 9.5</span> Excellent — high-end / competition-style
                </li>
                <li>
                  <span className="lab__grading-ref-band">9.5 – 10</span> Outstanding (rare in the wild)
                </li>
              </ul>
              <p className="lab__grading-ref-note">
                <strong>Balance cue:</strong> under-extracted cups often read sour, sharp, or hollow;
                balanced cups tend sweet with clear acidity; over-extracted cups lean bitter, dry, or
                astringent — use that alongside the extraction window below.
              </p>
            </div>
          </details>

          {/* ADDED: grind details for this brew (session + localStorage per method/recipe) */}
          {!espresso && (
            <section className="lab__section">
              <h2 className="lab__label">Grind details</h2>
              <p className="lab__grind-details-hint">
                Optional: grinder model, dial setting, burr notes, or how the dry bed looked — saved
                per method or custom recipe on this device.
              </p>
              <textarea
                className="lab__input lab__grind-details-textarea"
                value={grindSessionNotes}
                onChange={(e) => setGrindSessionNotes(e.target.value)}
                onBlur={() =>
                  persistGrindNotesForKey(journalMethodKey, grindSessionNotes)
                }
                rows={3}
                placeholder="e.g. Fellow Ode 2 · 3.2 · slight fines on spoon…"
              />
            </section>
          )}

          {/* ADDED: My Recipes — always visible + import/export */}
          <section className="lab__my-recipes" aria-label="My custom recipes">
            <div className="lab__my-recipes-head">
              <h2 className="lab__my-recipes-title">My Recipes</h2>
              <div className="lab__my-recipes-actions">
                <button
                  type="button"
                  className="lab__my-recipes-linkish"
                  onClick={handleExportRecipes}
                  disabled={customRecipes.length === 0}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="lab__my-recipes-linkish"
                  onClick={() => importRef.current?.click()}
                >
                  Import
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  className="lab__visually-hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleImportRecipes(f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="lab__my-recipes-add"
                  onClick={() => {
                    if (espresso) return
                    setCustomModalInitial(null)
                    setCustomModalOpen(true)
                  }}
                  disabled={espresso}
                >
                  + Add Recipe
                </button>
              </div>
            </div>
            {customRecipes.length === 0 ? (
              <div className="lab__my-recipes-empty-card">
                <p>No saved recipes yet. Add your first.</p>
                <button
                  type="button"
                  className="lab__my-recipes-empty-plus"
                  disabled={espresso}
                  onClick={() => {
                    setCustomModalInitial(null)
                    setCustomModalOpen(true)
                  }}
                  aria-label="Add first recipe"
                >
                  +
                </button>
              </div>
            ) : (
              <div className="lab__my-recipes-scroller">
                {customRecipes.map((c) => {
                  const bm = BREW_METHODS.find((m) => m.id === c.baseMethodId)
                  return (
                    <div key={c.id} className="lab__recipe-mini">
                      <button
                        type="button"
                        className="lab__recipe-mini-load"
                        onClick={() => setRecipeDetailId(c.id)}
                      >
                        <span className="lab__recipe-mini-badge">Custom</span>
                        <span className="lab__recipe-mini-name">{c.name}</span>
                        <span className="lab__recipe-mini-meta">
                          {bm?.label ?? 'Method'} · 1:{Number(c.ratio).toFixed(1)}
                        </span>
                        {c.notes?.trim() ? (
                          <span className="lab__recipe-mini-hint">View notes →</span>
                        ) : (
                          <span className="lab__recipe-mini-hint muted">
                            Recipe &amp; journal
                          </span>
                        )}
                      </button>
                      <div className="lab__recipe-mini-side">
                        <button
                          type="button"
                          className="lab__recipe-mini-use"
                          onClick={(e) => {
                            e.stopPropagation()
                            applyCustomRecipe(c)
                          }}
                        >
                          Use
                        </button>
                        <div className="lab__recipe-mini-tools">
                          <button
                            type="button"
                            className="lab__recipe-mini-icon"
                            aria-label={`Edit ${c.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomModalInitial(c)
                              setCustomModalOpen(true)
                            }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="lab__recipe-mini-icon"
                            aria-label={`Delete ${c.name}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCustom(c.id)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="lab__my-recipes-sticky-mobile">
              <button
                type="button"
                className="lab__my-recipes-add lab__my-recipes-add--block"
                disabled={espresso}
                onClick={() => {
                  setCustomModalInitial(null)
                  setCustomModalOpen(true)
                }}
              >
                + Add Recipe
              </button>
            </div>
          </section>

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
                        const ideal = espresso
                          ? getIdealLiquorGrams(true, brewMethod, dose)
                          : Math.round(dose * idealBatchRatio)
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
            {!auto && (
              <p className="lab__dose-hint lab__dose-hint--short">
                <strong>Custom</strong> — your numbers drive the metrics below.
              </p>
            )}
            <div className="lab__dose-water-row">
              <label className="lab__input-block" data-onboarding="dose">
                <span className="lab__input-label">Coffee Dose (g)</span>
                <input
                  id="coffee-dose-g"
                  className="lab__input lab__input--dose"
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

              {/* ADDED: live ratio chip */}
              <div className="lab__ratio-between" aria-live="polite">
                <span className="lab__ratio-between-arrow" aria-hidden>
                  ←
                </span>
                <div className="lab__ratio-between-core">
                  <span className="lab__ratio-chip-live">
                    {recipeValid ? liveRatioLabel : '—'}
                  </span>
                  <span
                    className={
                      'lab__ratio-strength ' +
                      (recipeValid
                        ? `lab__ratio-strength--${strengthMeta.key}`
                        : 'lab__ratio-strength--muted')
                    }
                  >
                    {recipeValid ? strengthMeta.label : '—'}
                  </span>
                </div>
                <span className="lab__ratio-between-arrow" aria-hidden>
                  →
                </span>
              </div>

              <label className="lab__input-block">
                <span className="lab__input-label">
                  {espresso ? 'Yield (g)' : 'Water (ml)'}
                  {auto && (
                    <span className="lab__input-sublabel"> (ideal)</span>
                  )}
                </span>
                {auto ? (
                  <output
                    className="lab__input lab__output lab__input--dose"
                    htmlFor="coffee-dose-g"
                  >
                    {dose !== null && dose > 0 ? waterInput : 0}
                  </output>
                ) : (
                  <input
                    className="lab__input lab__input--dose"
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
                {formatWaterTempCAndF(displayTempC, brewMethod === 'cold-brew')}
              </p>
            </article>
            <article className="lab__metric">
              <h3 className="lab__metric-label">Grind Size</h3>
              <p className="lab__metric-value">{displayGrind}</p>
            </article>
            <article className="lab__metric">
              <h3 className="lab__metric-label">Brew Time</h3>
              <p className="lab__metric-value">{displayBrewTime}</p>
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

          {/* ADDED: sticky chart tabs */}
          <nav
            className="lab__tabs lab__chart-tabs lab__chart-tabs--sticky"
            aria-label="Chart and timer"
          >
            {CHART_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                data-onboarding={t.id === 'pour' ? 'chartTab' : undefined}
                className={
                  chartTab === t.id ? 'lab__tab lab__tab--active' : 'lab__tab'
                }
                onClick={() => setChartTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="lab__chart-panel">
            {chartTab === 'guide' && (
              <article className="lab__panel lab__panel--guide">
                <h3 className="lab__panel-title">{guide.title}</h3>
                <p className="lab__panel-lead">{guide.lead}</p>
                <ol className="lab__steps">
                  {guide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <p className="lab__panel-body">{guide.closing}</p>
                <p className="lab__panel-note">{guide.roastNote}</p>
              </article>
            )}

            {chartTab === 'pour' && (
              <PourGuideBars
                espresso={espresso}
                brewMethodId={brewMethod}
                methodTitle={chartMethodTitle}
                totalLiquorG={waterInput}
                recipeValid={recipeValid}
                coffeeDoseG={doseForSpecs}
              />
            )}

            {chartTab === 'timer' && (
              <BrewTimerPanel
                scheduleEndSeconds={scheduleEndSeconds}
                targetSeconds={targetBrewSeconds}
                totalLiquorG={waterInput}
                recipeValid={recipeValid}
                rows={enrichedPourRows}
                elapsed={timerElapsed}
                running={timerRunning}
                onStart={() => setTimerRunning(true)}
                onPause={() => setTimerRunning(false)}
                onReset={() => {
                  setTimerElapsed(0)
                  setTimerRunning(false)
                  setTimerCompleted(false)
                }}
                timerCompleted={timerCompleted}
                onTimerComplete={() => setTimerCompleted(true)}
                brewJournalJustSaved={brewJournalJustSaved}
                onSaveJournalEntry={handleSaveJournalEntry}
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
          </div>
        </div>
      </div>

      <CustomRecipeModal
        open={customModalOpen}
        onClose={() => {
          setCustomModalOpen(false)
          setCustomModalInitial(null)
        }}
        onSave={handleSaveCustomModal}
        initial={customModalInitial}
        baseMethodId={brewMethod}
        baseMethodLabel={getBrewMethodLabel(brewMethod)}
      />

      <CustomRecipeDetailModal
        open={recipeDetailId != null && recipeForDetail != null}
        recipe={recipeForDetail}
        journal={brewJournal}
        onClose={() => setRecipeDetailId(null)}
        onUseRecipe={(r) => {
          applyCustomRecipe(r)
          setRecipeDetailId(null)
        }}
        onEdit={() => {
          if (!recipeForDetail) return
          setCustomModalInitial(recipeForDetail)
          setCustomModalOpen(true)
          setRecipeDetailId(null)
        }}
      />
    </div>
  )
}
