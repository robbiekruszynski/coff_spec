export function RecipeModal({
  open,
  onClose,
  onSave,
  name,
  setName,
  notes,
  setNotes,
  summary,
}) {
  if (!open) return null

  return (
    <div
      className="lab__recipe-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="lab__recipe-modal"
        role="dialog"
        aria-labelledby="recipe-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="recipe-modal-title" className="lab__recipe-modal-title">
          Save recipe
        </h2>
        <label className="lab__recipe-modal-field">
          <span>Recipe name</span>
          <input
            className="lab__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunday V60"
            autoFocus
          />
        </label>
        <label className="lab__recipe-modal-field">
          <span>Notes (optional)</span>
          <textarea
            className="lab__input lab__recipe-modal-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Grinder setting, filter type…"
          />
        </label>
        <div className="lab__recipe-modal-summary">
          <div>
            <strong>Method</strong> {summary.methodLabel}
          </div>
          <div>
            <strong>Roast</strong> {summary.roastLabel}
          </div>
          <div>
            <strong>Processing</strong> {summary.processingLabel}
          </div>
          <div>
            <strong>Dose</strong>{' '}
            {summary.dose != null ? `${summary.dose} g` : '—'}
          </div>
          <div>
            <strong>{summary.espresso ? 'Yield' : 'Water'}</strong>{' '}
            {summary.water != null ? `${summary.water} g` : '—'}
          </div>
          <div>
            <strong>Ratio</strong> {summary.ratioLabel}
          </div>
        </div>
        <div className="lab__recipe-modal-actions">
          <button type="button" className="lab__recipe-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="lab__recipe-modal-btn lab__recipe-modal-btn--primary"
            onClick={onSave}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
