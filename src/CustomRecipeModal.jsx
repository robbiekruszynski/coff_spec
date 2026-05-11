// ADDED: custom recipe create/edit modal

import { useEffect, useState } from 'react'

const GRIND_OPTIONS = [
  'Extra-fine',
  'Fine',
  'Medium-fine',
  'Medium',
  'Medium-coarse',
  'Coarse',
]

export function CustomRecipeModal({
  open,
  onClose,
  onSave,
  initial,
  baseMethodId,
  baseMethodLabel,
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [ratio, setRatio] = useState(
    initial?.ratio != null ? String(initial.ratio) : '16.5',
  )
  const [grind, setGrind] = useState(initial?.grind ?? 'Medium-fine')
  const [tempC, setTempC] = useState(
    initial?.tempC != null ? String(initial.tempC) : '94',
  )
  const [brewTime, setBrewTime] = useState(initial?.brewTime ?? '2:45 - 3:15')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [grindDetails, setGrindDetails] = useState(initial?.grindDetails ?? '')

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setRatio(initial?.ratio != null ? String(initial.ratio) : '16.5')
    setGrind(initial?.grind ?? 'Medium-fine')
    setTempC(initial?.tempC != null ? String(initial.tempC) : '94')
    setBrewTime(initial?.brewTime ?? '2:45 - 3:15')
    setNotes(initial?.notes ?? '')
    setGrindDetails(initial?.grindDetails ?? '')
  }, [open, initial])

  if (!open) return null

  const handleSubmit = () => {
    const r = Number(ratio)
    const t = Number(tempC)
    onSave({
      id: initial?.id ?? `c-${Date.now()}`,
      name: name.trim(),
      baseMethodId: initial?.baseMethodId ?? baseMethodId,
      ratio: Number.isFinite(r) ? r : 16.5,
      grind,
      tempC: Number.isFinite(t) ? t : 94,
      brewTime: brewTime.trim(),
      notes: notes.trim(),
      grindDetails: grindDetails.trim(),
    })
  }

  return (
    <div
      className="lab__recipe-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="lab__recipe-modal"
        role="dialog"
        aria-labelledby="custom-recipe-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="custom-recipe-modal-title" className="lab__recipe-modal-title">
          {initial?.id ? 'Edit recipe' : 'Add custom recipe'}
        </h2>
        <p className="lab__custom-recipe-base">
          Base method: <strong>{baseMethodLabel}</strong>
        </p>
        <label className="lab__recipe-modal-field">
          <span>Recipe name</span>
          <input
            className="lab__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekend V60"
            autoFocus
          />
        </label>
        <label className="lab__recipe-modal-field">
          <span>Ratio (1:X) brew water per 1g coffee</span>
          <input
            className="lab__input"
            type="number"
            min={1}
            step={0.1}
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
          />
        </label>
        <label className="lab__recipe-modal-field">
          <span>Grind size</span>
          <select
            className="lab__input"
            value={grind}
            onChange={(e) => setGrind(e.target.value)}
          >
            {GRIND_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="lab__recipe-modal-field">
          <span>Water temp (°C)</span>
          <input
            className="lab__input"
            type="number"
            step={0.5}
            value={tempC}
            onChange={(e) => setTempC(e.target.value)}
          />
        </label>
        <label className="lab__recipe-modal-field">
          <span>Brew time</span>
          <input
            className="lab__input"
            type="text"
            value={brewTime}
            onChange={(e) => setBrewTime(e.target.value)}
            placeholder="2:45 - 3:15"
          />
        </label>
        <label className="lab__recipe-modal-field">
          <span>Grind details (optional)</span>
          <textarea
            className="lab__input lab__recipe-modal-textarea"
            value={grindDetails}
            onChange={(e) => setGrindDetails(e.target.value)}
            rows={3}
            placeholder="Grinder, setting, clicks, burr age, or particle feel…"
          />
        </label>
        <label className="lab__recipe-modal-field">
          <span>Notes</span>
          <textarea
            className="lab__input lab__recipe-modal-textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </label>
        <div className="lab__recipe-modal-actions">
          <button type="button" className="lab__recipe-modal-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="lab__recipe-modal-btn lab__recipe-modal-btn--primary"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
