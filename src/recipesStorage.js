/** Current key — matches cache pattern users expect. */
export const RECIPES_KEY = 'recipes'

const LEGACY_RECIPES_KEY = 'extraction_lab_recipes'

export function loadRecipes() {
  try {
    let raw = localStorage.getItem(RECIPES_KEY)
    if (raw == null && localStorage.getItem(LEGACY_RECIPES_KEY) != null) {
      raw = localStorage.getItem(LEGACY_RECIPES_KEY)
      localStorage.setItem(RECIPES_KEY, raw)
      localStorage.removeItem(LEGACY_RECIPES_KEY)
    }
    const recipes = JSON.parse(raw || '[]')
    return Array.isArray(recipes) ? recipes : []
  } catch {
    return []
  }
}

export function saveRecipes(recipes) {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes))
}
