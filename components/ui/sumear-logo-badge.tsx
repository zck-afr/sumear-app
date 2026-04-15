'use client'

import { useEffect, useState } from 'react'

interface Props {
  size?: number
}

const LINES_LIGHT = (
  <>
    <rect x="1" y="1"    width="18" height="3"  rx="1.5" fill="white" />
    <rect x="1" y="7.5"  width="30" height="3"  rx="1.5" fill="white" opacity=".65" />
    <rect x="1" y="14"   width="23" height="3"  rx="1.5" fill="white" opacity=".65" />
    <rect x="1" y="20.5" width="13" height="3"  rx="1.5" fill="white" opacity=".35" />
  </>
)

const LINES_DARK = (
  <>
    <rect x="1" y="1"    width="18" height="3"  rx="1.5" fill="#C8A882" />
    <rect x="1" y="7.5"  width="30" height="3"  rx="1.5" fill="#C8A882" opacity=".65" />
    <rect x="1" y="14"   width="23" height="3"  rx="1.5" fill="#C8A882" opacity=".65" />
    <rect x="1" y="20.5" width="13" height="3"  rx="1.5" fill="#C8A882" opacity=".35" />
  </>
)

export function SumearLogoBadge({ size = 24 }: Props) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')

    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const radius = Math.round(size * 0.29)
  const svgSize = Math.round(size * 0.69)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: dark ? '#241A14' : '#B8715A',
        border: dark ? '0.5px solid rgba(255,200,150,.12)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={svgSize} height={Math.round(svgSize * 0.8125)} viewBox="0 0 32 26" fill="none">
        {dark ? LINES_DARK : LINES_LIGHT}
      </svg>
    </div>
  )
}
