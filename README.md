# extraction-lab

**extraction-lab** is a single-page **coffee brewing calculator and companion** built with **React** and **Vite**. It helps you dial in **batch brew** or **espresso** recipes by estimating **brew ratio**, **TDS**, **predicted extraction yield**, **water temperature**, **grind coarseness band**, and **brew time**, then visualizes **multi-stage pour schedules** with cumulative volume and flow-rate diagrams. It also includes a **countdown brew timer**, **custom recipes**, **brew journaling** after timers finish, and **grind notes** scoped per method or recipe.

The brew method catalog and ratios are aligned with **[Coffee Spec](https://coffeespec.netlify.app/)**, with **Walküre** added as an extra pour-over option.

---

## What it does

### Modes

- **Batch Brew** — Filter-style methods (V60, Chemex, immersion devices, cold brew, etc.). Water dose drives liquor volume; pour schedules come from method-specific stage definitions.
- **Espresso** — Single “shot” mode using dose and **yield** (beverage mass). The pour visualization uses a simplified **preinfusion + main flow** profile rather than a filter pour schedule.

### Brew methods (batch)

Methods are grouped in the UI:

| Group | Methods |
|--------|---------|
| **Pour-over & drip** | V60, Chemex, Kalita Wave, Walküre |
| **Immersion & hybrid** | AeroPress, French Press, Eva Solo, Clever Dripper |
| **Cold extraction** | Cold Brew |

Custom recipes **do not** appear in this top picker; they live only under **My Recipes** (see below).

### Dose modes

- **Auto** — Holds an **ideal ratio** per method from built-in tables (`IDEAL_BATCH_RATIOS` / `IDEAL_ESPRESSO_YIELD_RATIOS`). Changing **coffee dose** updates ideal **water** (batch) or **yield** (espresso) automatically.
- **Custom** — You enter both **dose** and **water or yield**; all downstream metrics derive from those numbers.

### Default doses

On load and when switching batch methods, **coffee dose** is prefilled with sensible defaults (e.g. V60 `20g`, Chemex `25g`, Cold Brew `100g`, …). Espresso defaults to **`18g`** when switching into espresso mode. Together with Auto ratio, **metrics and charts populate immediately** instead of showing empty placeholders.

### Live ratio chip (dose section)

Between **Coffee Dose** and **Water / Yield**, a chip shows the live **`1:X`** ratio and a **strength label** derived from that numeric ratio:

- Strong (&lt; 1:12)  
- Rich (1:12 – below 1:15)  
- Balanced (1:15 – 1:17)  
- Light (&gt; 1:17)

*(Espresso uses the same numeric bands on its smaller ratios.)*

### Roast level & processing

These selectors adjust **temperature**, **TDS**, and **yield** offsets inside the prediction model (they do not replace sensory tasting).

### Metrics panel

Displays:

- **Brew ratio** (hero strip)
- **Estimated TDS %**
- **Predicted extraction yield %**
- **Water temperature** (°C / °F; cold brew shows steep-oriented copy)
- **Grind size** (model default, or overridden when a **custom recipe** is active)
- **Brew time** (model default string, or custom recipe value when applicable)

### Extraction yield window

A horizontal bar marks an **ideal ~18–24%** window and places a marker for the **current predicted yield**. This is a **reference visualization**, not a lab measurement.

### Tabbed workspace (right column)

Sticky tabs (default **Pour Chart**):

1. **Brew Guide** — Text guide for the selected method (steps, roast note), sourced from `BREW_GUIDES` in `brewData.js`.
2. **Diagnosis** — Short contextual copy combining roast, processing, mode, and predicted yield/TDS bands.
3. **Pour Chart** — SVG diagram: schedule lanes, **cumulative volume**, **flow rate**, stage checklist. Title pattern: **`{Method name} — pour schedule`** (custom recipes use the recipe name).
4. **Timer** — Countdown to end of schedule; stage checklist with done/current/upcoming styling; pulse when a stage boundary hits; optional **post-brew feedback** after completion.

Timer stages share the same enriched pour rows as the chart (`getEnrichedPourRows` → schedule end time).

### Custom recipes (**My Recipes**)

- Stored in **`localStorage`** under **`coffeespec-custom-recipes`** as JSON array.
- **Add / Edit** opens a modal with: recipe name, ratio **1:X**, grind dropdown, water temp °C, brew time text, **general notes**, and optional **grind details** (grinder, clicks, microns, etc.).
- Each recipe references a **`baseMethodId`** so pour profiles stay tied to a built-in method.
- **Use** loads the recipe into the calculator (ratio overrides Auto ideal water for batch).
- **Clicking the card body** opens a **detail modal**: full parameters, **recipe notes**, **grind details**, and **brew journal** entries whose `methodKey` is **`custom:{recipeId}`**.
- **Export** downloads **`coffeespec-recipes.json`**.
- **Import** merges JSON arrays and **deduplicates by lowercase recipe name** (later wins).

### Brew journal

After the timer completes, you can log **Too bitter / Just right / Too sour**, an optional note, and **Save**. Entries are stored under **`coffeespec-brew-journal`** with `methodKey`, `doseG`, `waterG`, mood emoji, `note`, and ISO timestamp.

Built-in method cards can show **Last:** dose · water · mood when a journal entry exists for that method id.

### Grind details (session)

Batch-only section: free-text **grind notes for this brew**. Persisted per context in **`coffeespec-grind-session`** (object keyed by `brewMethod` or `custom:{id}`). If no saved session exists for a custom recipe, the textarea **seeds from** that recipe’s **`grindDetails`** field. Persistence happens on **blur** of the textarea.

### Coffee grading reference

Collapsible **SCA-style cupping score bands (6–10)** plus a short **balance / extraction** cue (under vs over-extracted language). Informational only; not wired into calculations.

### First-time onboarding

If **`coffeespec-visited`** is not `true`, a short **3-step overlay** highlights methods → dose → Pour Chart tab. Dismiss or finish sets the flag so it does not repeat.

### Mobile-oriented UX

Below ~768px width: larger tap targets where relevant, dose/timer sizing tweaks, and a sticky **+ Add Recipe** affordance inside **My Recipes**.

---

## Tech stack

| Piece | Choice |
|--------|--------|
| UI | React **19** |
| Bundler | **Vite** **6** |
| Fonts | **DM Mono** (timers / monospace accents), Georgia stack for body |
| Persistence | Browser **`localStorage`** only (no backend) |

### Requirements

- **Node** `^18`, `^20`, or `>=22` (see `package.json` `engines`).

### Scripts

```bash
npm install
npm run dev      # dev server (default Vite URL)
npm run build    # production build → dist/
npm run preview  # serve dist locally
npm run lint     # ESLint
```

---

## Project layout (src)

| Path | Role |
|------|------|
| `main.jsx` | React root |
| `App.jsx` | Global state: mode, method, dose/water, tabs, timer, recipes, journal, onboarding, grind session sync |
| `brewData.js` | Methods, ratios, guides, pour stages, helpers (`getPourStagesForBrew`, `enrichPourStages`, `getEnrichedPourRows`, defaults, …) |
| `PourGuideBars.jsx` | Pour chart SVG + lane rendering |
| `BrewTimerPanel.jsx` | Timer UI, stages, completion feedback → journal callback |
| `MethodCardScroller.jsx` | Built-in method cards only (grouped grid) |
| `CustomRecipeModal.jsx` | Create/edit recipe |
| `CustomRecipeDetailModal.jsx` | View notes, grind details, journal history |
| `customRecipesStorage.js` | Load/save/merge **`coffeespec-custom-recipes`** |
| `brewJournalStorage.js` | Load/save journal; helpers for last entry / entries per method |
| `grindSessionStorage.js` | **`coffeespec-grind-session`** map |
| `OnboardingTour.jsx` | **`coffeespec-visited`** onboarding |

Legacy/unreferenced in the main flow (safe to remove in cleanup): `RecipeModal.jsx`, `recipesStorage.js` (older recipe shape).

---

## `localStorage` keys

| Key | Contents |
|-----|-----------|
| `coffeespec-custom-recipes` | JSON array of custom recipes (`id`, `name`, `baseMethodId`, `ratio`, `grind`, `tempC`, `brewTime`, `notes`, `grindDetails`, …) |
| `coffeespec-brew-journal` | JSON array of `{ methodKey, doseG, waterG, mood, note, at }` |
| `coffeespec-grind-session` | JSON object `{ [methodKey]: string }` for grind textarea |
| `coffeespec-visited` | `"true"` after onboarding dismissed/completed |

---

## Important caveats

- **All extraction/TDS/yield numbers are predictive models**, not measurements from a refractometer or lab protocols.
- **Core ratio/yield/TDS math** lives in `App.jsx` (`computeSpecs`, `extractionYieldFromRatio`) plus roast/processing tweaks—document behavior there when changing assumptions.
- **Design**: dark espresso-like theme with amber accents; layout/CSS is tuned for readability and touch targets.

---

## Deployment

Static site: run **`npm run build`** and deploy the **`dist/`** folder to any static host (e.g. Netlify), matching how **[Coffee Spec](https://coffeespec.netlify.app/)** is hosted conceptually—this repo is the **extraction-lab** variant with extended UX.

---

## License

Private package (`"private": true` in `package.json`). Add a LICENSE file if you open-source the project.
