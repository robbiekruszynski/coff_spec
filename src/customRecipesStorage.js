// ADDED: custom recipes persistence (coffeespec-custom-recipes)

export const CUSTOM_RECIPES_KEY = 'coffeespec-custom-recipes'

export function loadCustomRecipes() {
  try {
    const raw = localStorage.getItem(CUSTOM_RECIPES_KEY)
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveCustomRecipes(recipes) {
  localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify(recipes))
}

/** Dedupe by lowercase name; later entries win on import. */
export function mergeCustomRecipesDedup(existing, incoming) {
  const byKey = new Map()
  for (const r of existing) {
    if (r?.name) byKey.set(String(r.name).toLowerCase().trim(), r)
  }
  for (const r of incoming) {
    if (r?.name) byKey.set(String(r.name).toLowerCase().trim(), r)
  }
  return [...byKey.values()]
}
