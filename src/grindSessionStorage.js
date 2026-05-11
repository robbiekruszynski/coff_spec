// ADDED: per-method / per-recipe grind notes (session scratch pad)

export const GRIND_SESSION_KEY = 'coffeespec-grind-session'

export function loadGrindSessionMap() {
  try {
    const raw = localStorage.getItem(GRIND_SESSION_KEY)
    const parsed = JSON.parse(raw || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

export function saveGrindSessionMap(map) {
  localStorage.setItem(GRIND_SESSION_KEY, JSON.stringify(map))
}
