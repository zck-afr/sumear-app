'use client'

const jakarta = "'Plus Jakarta Sans', -apple-system, sans-serif"

export interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(42,30,24,.35)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderRadius: 16,
          border: '0.5px solid var(--border-md)',
          boxShadow: '0 20px 60px rgba(42,30,24,.2)',
          padding: '28px 28px 24px',
          width: 380,
          maxWidth: 'calc(100vw - 48px)',
          fontFamily: jakarta,
        }}
      >
        <p style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: 20,
          fontWeight: 300,
          color: 'var(--text-primary)',
          letterSpacing: '-.2px',
          margin: '0 0 8px',
        }}>
          {title}
        </p>

        <p style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: '0 0 24px',
        }}>
          {message}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px',
              borderRadius: 20,
              background: 'var(--bg-secondary)',
              border: '0.5px solid var(--border-md)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: jakarta,
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          >
            {cancelLabel}
          </button>

          <button
            onClick={onConfirm}
            style={{
              padding: '9px 20px',
              borderRadius: 20,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: jakarta,
              transition: 'background 0.12s',
              background: variant === 'danger' ? '#C07070' : 'var(--accent)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = variant === 'danger' ? '#A05858' : 'var(--accent-dark, #9E5E47)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = variant === 'danger' ? '#C07070' : 'var(--accent)'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
