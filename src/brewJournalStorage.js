// ADDED: post-brew journal (coffeespec-brew-journal)

export const BREW_JOURNAL_KEY = 'coffeespec-brew-journal'

export function loadBrewJournal() {
  try {
    const raw = localStorage.getItem(BREW_JOURNAL_KEY)
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveBrewJournal(entries) {
  localStorage.setItem(BREW_JOURNAL_KEY, JSON.stringify(entries))
}

/** Most recent entry for a batch method id or espresso-shot / custom id key. */
export function getLastBrewForMethodKey(journal, methodKey) {
  if (!journal?.length || !methodKey) return null
  const matches = journal.filter((e) => e.methodKey === methodKey)
  if (!matches.length) return null
  return matches.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  )[0]
}

/** All journal entries for a method key, newest first. */
export function getJournalEntriesForMethodKey(journal, methodKey) {
  if (!journal?.length || !methodKey) return []
  return journal
    .filter((e) => e.methodKey === methodKey)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
