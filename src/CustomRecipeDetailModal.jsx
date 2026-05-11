// ADDED: view custom recipe notes, grind details, and brew journal history

import { BREW_METHODS } from './brewData.js'
import { getJournalEntriesForMethodKey } from './brewJournalStorage.js'

function formatJournalWhen(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function CustomRecipeDetailModal({
  open,
  recipe,
  journal,
  onClose,
  onUseRecipe,
  onEdit,
}) {
  if (!open || !recipe) return null

  const bm = BREW_METHODS.find((m) => m.id === recipe.baseMethodId)
  const methodKey = `custom:${recipe.id}`
  const history = getJournalEntriesForMethodKey(journal, methodKey)

  return (
    <div
      className="lab__recipe-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="lab__recipe-modal lab__recipe-detail-modal"
        role="dialog"
        aria-labelledby="recipe-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="recipe-detail-title" className="lab__recipe-modal-title">
          {recipe.name}
        </h2>
        <p className="lab__custom-recipe-base">
          Base: <strong>{bm?.label ?? recipe.baseMethodId}</strong>
          <span className="lab__recipe-detail-meta-pill">
            1:{Number(recipe.ratio).toFixed(1)}
          </span>
        </p>

        <dl className="lab__recipe-detail-dl">
          <div>
            <dt>Grind size</dt>
            <dd>{recipe.grind ?? '—'}</dd>
          </div>
          <div>
            <dt>Water temp</dt>
            <dd>
              {recipe.tempC != null ? `${recipe.tempC}°C` : '—'}
            </dd>
          </div>
          <div>
            <dt>Brew time</dt>
            <dd>{recipe.brewTime?.trim() ? recipe.brewTime : '—'}</dd>
          </div>
        </dl>

        <div className="lab__recipe-detail-block">
          <h3 className="lab__recipe-detail-h">Recipe notes</h3>
          {recipe.notes?.trim() ? (
            <p className="lab__recipe-detail-text">{recipe.notes}</p>
          ) : (
            <p className="lab__recipe-detail-empty">No notes saved for this recipe.</p>
          )}
        </div>

        <div className="lab__recipe-detail-block">
          <h3 className="lab__recipe-detail-h">Grind details</h3>
          {recipe.grindDetails?.trim() ? (
            <p className="lab__recipe-detail-text">{recipe.grindDetails}</p>
          ) : (
            <p className="lab__recipe-detail-empty">
              No grind details on file — add them when you edit the recipe.
            </p>
          )}
        </div>

        <div className="lab__recipe-detail-block">
          <h3 className="lab__recipe-detail-h">Brew journal</h3>
          {history.length === 0 ? (
            <p className="lab__recipe-detail-empty">
              No logged brews for this recipe yet. Finish a timer and save tasting
              notes to build history here.
            </p>
          ) : (
            <ul className="lab__recipe-detail-journal">
              {history.map((e, i) => (
                <li key={`${e.at}-${i}`} className="lab__recipe-detail-journal-row">
                  <span className="lab__recipe-detail-journal-when">
                    {formatJournalWhen(e.at)}
                  </span>
                  <span className="lab__recipe-detail-journal-meta">
                    {e.doseG}g · {Math.round(e.waterG)}ml
                    {e.mood ? ` · ${e.mood}` : ''}
                  </span>
                  {e.note?.trim() ? (
                    <span className="lab__recipe-detail-journal-note">{e.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lab__recipe-detail-actions">
          <button type="button" className="lab__recipe-modal-btn" onClick={onClose}>
            Close
          </button>
          <button type="button" className="lab__recipe-modal-btn" onClick={onEdit}>
            Edit
          </button>
          <button
            type="button"
            className="lab__recipe-modal-btn lab__recipe-modal-btn--primary"
            onClick={() => {
              onUseRecipe?.(recipe)
              onClose()
            }}
          >
            Use this recipe
          </button>
        </div>
      </div>
    </div>
  )
}
