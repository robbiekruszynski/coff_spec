// ADDED: first-time onboarding (coffeespec-visited)

const VISITED_KEY = 'coffeespec-visited'

export function hasVisitedBefore() {
  return localStorage.getItem(VISITED_KEY) === 'true'
}

export function markVisited() {
  localStorage.setItem(VISITED_KEY, 'true')
}

export function OnboardingTour({ step, onNext, onDismiss, targets }) {
  if (step < 1 || step > 3) return null

  const messages = [
    {
      title: 'Pick your method',
      body: 'Scroll the cards and choose your brewer—each shows the ideal ratio.',
      target: targets.methods,
    },
    {
      title: 'Set your dose',
      body: 'Enter coffee in and water or yield—the ratio chip updates live.',
      target: targets.dose,
    },
    {
      title: 'Follow the pour chart',
      body: 'Open the Pour Chart tab for the full schedule, flow, and cumulative volume.',
      target: targets.chartTab,
    },
  ]

  const cur = messages[step - 1]
  if (!cur) return null

  return (
    <div className="lab__onboard-overlay" role="dialog" aria-modal="true">
      <div className="lab__onboard-card">
        <button
          type="button"
          className="lab__onboard-dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          ×
        </button>
        <p className="lab__onboard-step">
          {step} / 3
        </p>
        <h3 className="lab__onboard-title">{cur.title}</h3>
        <p className="lab__onboard-body">{cur.body}</p>
        <button
          type="button"
          className="lab__onboard-next"
          onClick={() => {
            if (step >= 3) onDismiss()
            else onNext()
          }}
        >
          {step >= 3 ? 'Done' : 'Got it →'}
        </button>
      </div>
    </div>
  )
}
