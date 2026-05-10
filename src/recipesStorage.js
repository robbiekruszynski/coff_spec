export const RECIPES_KEY = 'extraction_lab_recipes'

export function loadRecipes() {
  try {
    const raw = localStorage.getItem(RECIPES_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function saveRecipes(recipes) {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes))
}
