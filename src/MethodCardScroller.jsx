// ADDED: grouped brew method cards (built-in only — custom recipes live under My Recipes)

import {
  BREW_METHOD_GROUP_META,
  BREW_METHODS,
  IDEAL_BATCH_RATIOS,
  METHOD_BREW_CATEGORY_LABEL,
} from './brewData.js'
import { getLastBrewForMethodKey } from './brewJournalStorage.js'

export function MethodCardScroller({
  brewMethod,
  selectedCustomRecipeId,
  journal,
  onSelectBuiltIn,
}) {
  return (
    <div className="lab__method-scroller-wrap">
      {BREW_METHOD_GROUP_META.map((g) => {
        const methods = BREW_METHODS.filter((m) => m.group === g.id)
        if (methods.length === 0) return null
        return (
          <div key={g.id} className="lab__method-scroller-group">
            <p className="lab__method-scroller-group-label">{g.label}</p>
            <div className="lab__method-scroller" data-onboarding="methods">
              {methods.map((m) => {
                const cat = METHOD_BREW_CATEGORY_LABEL[m.group] ?? ''
                const ratio = IDEAL_BATCH_RATIOS[m.id] ?? 16.5
                const selected =
                  brewMethod === m.id && selectedCustomRecipeId == null
                const last = getLastBrewForMethodKey(journal, m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={
                      selected ? 'lab__mcard lab__mcard--active' : 'lab__mcard'
                    }
                    aria-pressed={selected}
                    onClick={() => onSelectBuiltIn(m.id)}
                  >
                    <span className="lab__mcard-name">{m.label}</span>
                    <span className="lab__mcard-cat">{cat}</span>
                    <span className="lab__mcard-ratio-chip">1:{ratio.toFixed(1)}</span>
                    {last && (
                      <span className="lab__mcard-last">
                        Last: {last.doseG}g · {Math.round(last.waterG)}ml ·{' '}
                        {last.mood ?? '—'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
