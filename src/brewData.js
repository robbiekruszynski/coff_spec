/** Brew methods match https://coffeespec.netlify.app/ plus Walküre. */

export const MODES = [
  { id: 'batch', label: 'Batch Brew' },
  { id: 'espresso', label: 'Espresso' },
]

/** AUTO mode: water (g) per 1 g coffee — target ~1:ratio for batch brew. */
export const IDEAL_BATCH_RATIOS = {
  v60: 16.5,
  chemex: 16,
  aeropress: 14,
  'french-press': 16,
  'eva-solo': 16,
  'kalita-wave': 16,
  clever: 15.5,
  'cold-brew': 8,
  walkure: 16.5,
}

/** AUTO mode: beverage yield (g) per 1 g dry dose — espresso 1:r. */
export const IDEAL_ESPRESSO_YIELD_RATIOS = {
  v60: 2,
  chemex: 2,
  aeropress: 2.1,
  'french-press': 2,
  'eva-solo': 2,
  'kalita-wave': 2,
  clever: 2,
  'cold-brew': 2,
  walkure: 2,
}

export const DOSE_MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'custom', label: 'Custom' },
]

/**
 * Ideal liquor mass for the current method (batch = water, espresso = yield).
 * Returns 0 if dose is missing or not positive (caller shows empty / 0).
 */
export function getIdealLiquorGrams(espresso, brewMethod, doseG) {
  if (doseG == null || !Number.isFinite(Number(doseG)) || Number(doseG) <= 0) {
    return 0
  }
  const d = Number(doseG)
  if (espresso) {
    const r = IDEAL_ESPRESSO_YIELD_RATIOS[brewMethod] ?? 2
    return Math.round(d * r * 10) / 10
  }
  const r = IDEAL_BATCH_RATIOS[brewMethod] ?? 16.5
  return Math.round(d * r)
}

export const BREW_METHODS = [
  { id: 'v60', label: 'V60' },
  { id: 'chemex', label: 'Chemex' },
  { id: 'aeropress', label: 'AeroPress' },
  { id: 'french-press', label: 'French Press' },
  { id: 'eva-solo', label: 'Eva Solo' },
  { id: 'kalita-wave', label: 'Kalita Wave' },
  { id: 'clever', label: 'Clever Dripper' },
  { id: 'cold-brew', label: 'Cold Brew' },
  { id: 'walkure', label: 'Walküre' },
]

/**
 * Multi-stage pour profiles: time = start (s), duration (s), percent of total water.
 */
export const POUR_STAGES_FALLBACK = {
  stages: [{ label: 'Single Pour', time: 0, duration: 45, percent: 1 }],
}

export const ESPRESSO_POUR_STAGES = {
  stages: [
    { label: 'Preinfusion', time: 0, duration: 8, percent: 0.22 },
    { label: 'Main flow', time: 8, duration: 24, percent: 0.78 },
  ],
}

export const POUR_STAGES = {
  v60: {
    stages: [
      { label: 'Bloom', time: 0, duration: 45, percent: 0.17 },
      { label: '2nd Pour', time: 45, duration: 30, percent: 0.22 },
      { label: '3rd Pour', time: 90, duration: 30, percent: 0.22 },
      { label: '4th Pour', time: 135, duration: 30, percent: 0.19 },
      { label: '5th Pour', time: 180, duration: 30, percent: 0.2 },
    ],
  },
  chemex: {
    stages: [
      { label: 'Bloom', time: 0, duration: 60, percent: 0.15 },
      { label: '2nd Pour', time: 60, duration: 60, percent: 0.42 },
      { label: '3rd Pour', time: 150, duration: 60, percent: 0.43 },
    ],
  },
  aeropress: {
    stages: [
      { label: 'Initial Fill', time: 0, duration: 20, percent: 0.6 },
      { label: 'Stir + Press', time: 60, duration: 30, percent: 0.4 },
    ],
  },
  'french-press': {
    stages: [{ label: 'Full Pour', time: 0, duration: 30, percent: 1.0 }],
  },
  'kalita-wave': {
    stages: [
      { label: 'Bloom', time: 0, duration: 45, percent: 0.15 },
      { label: '2nd Pour', time: 45, duration: 40, percent: 0.4 },
      { label: '3rd Pour', time: 120, duration: 40, percent: 0.45 },
    ],
  },
  clever: {
    stages: [{ label: 'Full Pour', time: 0, duration: 30, percent: 1.0 }],
  },
  'cold-brew': {
    stages: [{ label: 'Full Pour', time: 0, duration: 60, percent: 1.0 }],
  },
  'eva-solo': {
    stages: [
      { label: 'Bloom', time: 0, duration: 40, percent: 0.18 },
      { label: '2nd Pour', time: 40, duration: 35, percent: 0.35 },
      { label: '3rd Pour', time: 100, duration: 40, percent: 0.47 },
    ],
  },
  walkure: {
    stages: [
      { label: 'Bloom', time: 0, duration: 48, percent: 0.16 },
      { label: '2nd Pour', time: 48, duration: 32, percent: 0.22 },
      { label: '3rd Pour', time: 95, duration: 32, percent: 0.21 },
      { label: '4th Pour', time: 150, duration: 32, percent: 0.21 },
      { label: '5th Pour', time: 200, duration: 30, percent: 0.2 },
    ],
  },
}

export function getPourStagesForBrew(espresso, brewMethodId) {
  if (espresso) return ESPRESSO_POUR_STAGES
  const p = POUR_STAGES[brewMethodId]
  if (p?.stages?.length) return p
  return POUR_STAGES_FALLBACK
}

export function enrichPourStages(stages, totalG, doseG = null, { espresso = false } = {}) {
  const g = Number(totalG) || 0
  const dose =
    doseG != null && Number.isFinite(Number(doseG)) ? Number(doseG) : 0

  if (!stages?.length || g <= 0) {
    return (stages || []).map((s) => ({
      ...s,
      ml: 0,
      mlPerSec: 0,
      fractionOfBrew: 0,
    }))
  }

  const first = stages[0]
  const isBloomFirst =
    !espresso &&
    first &&
    /^bloom$/i.test(String(first.label).trim())

  if (isBloomFirst && dose > 0) {
    let bloomMl = Math.min(2 * dose, g)
    const rest = stages.slice(1)
    if (rest.length === 0) {
      const ml = Math.round(bloomMl * 100) / 100
      return [
        {
          ...first,
          ml,
          mlPerSec:
            first.duration > 0
              ? Math.round((ml / first.duration) * 100) / 100
              : 0,
          fractionOfBrew: ml / g,
        },
      ]
    }
    let remainder = g - bloomMl
    if (remainder < 0) {
      bloomMl = g
      remainder = 0
    }
    bloomMl = Math.round(bloomMl * 100) / 100
    remainder = Math.round((g - bloomMl) * 100) / 100

    const sumP = rest.reduce((acc, s) => acc + s.percent, 0) || 1
    const out = [
      {
        ...first,
        ml: bloomMl,
        mlPerSec:
          first.duration > 0
            ? Math.round((bloomMl / first.duration) * 100) / 100
            : 0,
        fractionOfBrew: bloomMl / g,
      },
    ]
    let allocated = bloomMl
    rest.forEach((s, i) => {
      const ml =
        i === rest.length - 1
          ? Math.round((g - allocated) * 100) / 100
          : Math.round(((s.percent / sumP) * remainder) * 100) / 100
      allocated += ml
      out.push({
        ...s,
        ml,
        mlPerSec:
          s.duration > 0 ? Math.round((ml / s.duration) * 100) / 100 : 0,
        fractionOfBrew: ml / g,
      })
    })
    return out
  }

  return stages.map((s) => {
    const ml = Math.round(s.percent * g * 100) / 100
    return {
      ...s,
      ml,
      mlPerSec:
        s.duration > 0 ? Math.round((ml / s.duration) * 100) / 100 : 0,
      fractionOfBrew: ml / g,
    }
  })
}

/**
 * Build ordered timeline for time-based pour charts. Inserts gap segments (0 ml/s)
 * when stage start times leave space (e.g. AeroPress steep before press).
 */
export function buildPourFlowTimeline(rows) {
  if (!rows?.length) {
    return {
      segments: [],
      totalSec: 0,
      maxMlPerSec: 0,
      activePourSec: 0,
      peakMlPerSec: 0,
    }
  }
  const sorted = [...rows].sort((a, b) => a.time - b.time)
  const segments = []
  let cursor = 0
  for (let i = 0; i < sorted.length; i += 1) {
    const r = sorted[i]
    const start = Number(r.time) || 0
    const dur = Number(r.duration) || 0
    const end = start + dur
    if (start > cursor) {
      segments.push({
        startSec: cursor,
        endSec: start,
        mlPerSec: 0,
        ml: 0,
        label: 'Pause',
        isGap: true,
      })
    }
    segments.push({
      startSec: start,
      endSec: end,
      mlPerSec: Number(r.mlPerSec) || 0,
      ml: Number(r.ml) || 0,
      label: r.label,
      isGap: false,
    })
    cursor = Math.max(cursor, end)
  }
  const totalSec = cursor
  const rates = segments.map((s) => s.mlPerSec)
  const maxMlPerSec = Math.max(...rates, 1e-6)
  const peakMlPerSec = Math.max(...rates, 0)
  const activePourSec = segments
    .filter((s) => !s.isGap)
    .reduce((acc, s) => acc + (s.endSec - s.startSec), 0)
  return {
    segments,
    totalSec,
    maxMlPerSec,
    activePourSec,
    peakMlPerSec,
  }
}

/** MM:SS from seconds (floor). */
export function formatMmSs(totalSec) {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/**
 * Midpoint target in seconds for timer from brewTime string.
 */
export function parseBrewTimeMidpointSeconds(brewTimeStr) {
  if (!brewTimeStr || typeof brewTimeStr !== 'string') return 180
  const mm = brewTimeStr.match(
    /(\d+)\s*:\s*(\d+)\s*[-–]\s*(\d+)\s*:\s*(\d+)/,
  )
  if (mm) {
    const a = parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10)
    const b = parseInt(mm[3], 10) * 60 + parseInt(mm[4], 10)
    return Math.round((a + b) / 2)
  }
  const secR = brewTimeStr.match(/(\d+)\s*[-–]\s*(\d+)\s*s/i)
  if (secR) {
    return Math.round(
      (parseInt(secR[1], 10) + parseInt(secR[2], 10)) / 2,
    )
  }
  const hrs = brewTimeStr.match(/(\d+)\s*[-–]\s*(\d+)\s*h/i)
  if (hrs) {
    const midH = (parseInt(hrs[1], 10) + parseInt(hrs[2], 10)) / 2
    return Math.round(midH * 3600)
  }
  const single = brewTimeStr.match(/(\d+)\s*:\s*(\d+)/)
  if (single) {
    return parseInt(single[1], 10) * 60 + parseInt(single[2], 10)
  }
  return 180
}

export const ROAST_LEVELS = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'dark', label: 'Dark' },
]

export const PROCESSING_METHODS = [
  { id: 'washed', label: 'Washed' },
  { id: 'natural', label: 'Natural' },
  { id: 'honey', label: 'Honey' },
  { id: 'anaerobic', label: 'Anaerobic' },
  { id: 'wet-hulled', label: 'Wet Hulled' },
]

export const BREW_GUIDES = {
  v60: {
    title: 'V60',
    lead: 'Fast percolation and high clarity. Use concentric pours to maintain an even slurry.',
    steps: [
      'Rinse filter thoroughly and preheat vessel.',
      'Bloom with first pulse and stir gently.',
      'Continue pulse pours every 30 seconds.',
      'Finish drawdown with bed flat and no channeling.',
    ],
    closing:
      'Clean, articulate cup profile with crisp acidity and elevated clarity in aroma separation.',
    roastNote:
      'Roast adjustment: Medium roast shifts ratio by 0, temperature by 0°C, and TDS by 0%.',
  },
  chemex: {
    title: 'Chemex',
    lead: 'Thicker filters slow flow and highlight cleanliness; keep pours smooth and centered.',
    steps: [
      'Rinse the folded filter well to remove paper taste.',
      'Bloom gently, then pour in slow spirals keeping slurry depth even.',
      'Avoid agitating the bed; let the thick filter regulate drawdown.',
    ],
    closing:
      'Expect a silky body with tea-like clarity and pronounced sweetness when grind and pour stay conservative.',
    roastNote:
      'Darker roasts may need a slightly coarser grind to avoid stall.',
  },
  aeropress: {
    title: 'AeroPress',
    lead: 'Immersion plus pressure—balance time, grind, and plunge force for the target strength.',
    steps: [
      'Add water, cap, and invert or standard per your recipe.',
      'Steep for the target window, then plunge with steady even pressure.',
      'Dilute to taste if brewing a concentrate.',
    ],
    closing:
      'Great for showcasing sweetness and body with forgiving extraction when timing is consistent.',
    roastNote:
      'Finer grind or longer steep bumps TDS; coarser speeds cleanup.',
  },
  'french-press': {
    title: 'French Press',
    lead: 'Full immersion: control mesh intrusion and steep time to limit fines in the cup.',
    steps: [
      'Preheat the glass or steel carafe.',
      'Saturate grounds fully; break crust if desired and skim surface fines.',
      'Press slowly after the full steep; decant to limit over-extraction.',
    ],
    closing:
      'Rich mouthfeel with oils present; clarity trades off for opacity and depth.',
    roastNote:
      'Coarser grind helps keep silt manageable.',
  },
  'eva-solo': {
    title: 'Eva Solo',
    lead: 'Gentle immersion with cloth or metal filter—coax even wetting without violent agitation.',
    steps: [
      'Bloom if pouring in stages, or flood gently in one pass per recipe.',
      'Let settle; cloth flow is slower early on.',
      'Serve once drawdown completes.',
    ],
    closing:
      'Balanced cups with clarity between press and pour-over when grind matches drain rate.',
    roastNote: 'Adjust grind if total time strays outside 3–5 minutes.',
  },
  'kalita-wave': {
    title: 'Kalita Wave',
    lead: 'Flat bed and shallow ridges reward even pulses and a steady pour height.',
    steps: [
      'Rinse filter and seat it flat on the wave pattern.',
      'Bloom, then pulse in controlled concentric circles.',
      'Keep final water level modest to preserve flat bed.',
    ],
    closing:
      'Forgiving sweet spot with even extraction and forgiving flow when pour discipline is kept.',
    roastNote: 'Coarser than V60 is common due to slower drain.',
  },
  clever: {
    title: 'Clever Dripper',
    lead: 'Immersion until release—grind and time set strength; release mimics a clean drip finish.',
    steps: [
      'Add grounds and water, cap or cover during steep.',
      'Break crust if needed; place on server to open valve.',
      'Allow full drawdown without lifting prematurely.',
    ],
    closing:
      'High clarity with immersion body; very consistent when time and temperature are fixed.',
    roastNote: 'Extend steep for more body; shorten for brighter cups.',
  },
  'cold-brew': {
    title: 'Cold Brew',
    lead: 'Slow extraction at low temperature—focus on grind, time, and dilution for balance.',
    steps: [
      'Combine coarse grounds and cold filtered water.',
      'Steep refrigerated 14–18 hours depending on ratio.',
      'Filter gently and dilute to taste.',
    ],
    closing:
      'Low acidity and high sweetness; ideal for concentrate service or nitro.',
    roastNote: 'Ratio shifts concentrate strength before dilution.',
  },
  walkure: {
    title: 'Walküre',
    lead: 'Porcelain Karlsbad-style drip: soft spiral pours and patient drawdown through the double bottom.',
    steps: [
      'Preheat the porcelain brewer and serving vessel.',
      'Bloom with just enough water to saturate; keep the bed level.',
      'Pour in slow overlapping spirals; avoid digging the center.',
      'Let the staged bottom regulate flow—finish when the bed is evenly drained.',
    ],
    closing:
      'Exceptionally clear cups with fine aromatics; rewards gentle technique and medium-fine grind.',
    roastNote:
      'Lighter roasts may need slightly hotter water; porcelain holds heat steadily.',
  },
}
