'use client'

interface GreetingProps {
  firstName: string
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning,'
  if (h >= 12 && h < 18) return 'Good afternoon,'
  return 'Good evening,'
}

export function Greeting({ firstName }: GreetingProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-fraunces), Georgia, serif',
          fontWeight: 300,
          fontStyle: 'normal',
          fontSize: 26,
          color: 'var(--text-primary)',
          letterSpacing: '-0.2px',
          lineHeight: 1.2,
        }}
      >
        {getGreeting()}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-fraunces), Georgia, serif',
          fontWeight: 300,
          fontStyle: 'normal',
          fontSize: 46,
          color: 'var(--accent)',
          letterSpacing: '-0.5px',
          lineHeight: 1.05,
        }}
      >
        {firstName}
      </div>
    </div>
  )
}
