import React from 'react'

interface SumearWordmarkProps {
  size?: number
  darkBg?: boolean
  style?: React.CSSProperties
}

/**
 * Branded "su·mear" wordmark.
 * "su" and "·" in terracotta accent, "mear" in primary or white (dark bg).
 */
export function SumearWordmark({ size, darkBg = false, style }: SumearWordmarkProps) {
  const mearColor = darkBg ? 'rgba(255,255,255,.9)' : 'var(--ds-text-primary, #2A1E18)'
  return (
    <span style={{
      fontFamily: "'Playfair Display', Georgia, serif",
      fontStyle: 'italic',
      fontSize: size,
      letterSpacing: '-0.01em',
      display: 'inline',
      ...style,
    }}>
      <span style={{ color: '#B8715A' }}>su</span>
      <span style={{ color: '#B8715A' }}>·</span>
      <span style={{ color: mearColor }}>mear</span>
    </span>
  )
}
