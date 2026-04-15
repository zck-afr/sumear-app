'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const jakarta = 'var(--font-plus-jakarta-sans), sans-serif'

export type Clip = {
  id: string
  product_name: string
  price: number | null
  image_url: string | null
}

export type Project = {
  id: string
  name: string
  emoji: string | null
  description: string | null
  created_at: string
  updated_at: string
  clips: Clip[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function fmtCurrency(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="rgba(42,30,24,.4)" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="2 4 14 4" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M6 7v5M10 7v5" />
      <path d="M3 4l.9 9a1 1 0 0 0 1 .9h6.2a1 1 0 0 0 1-.9L13 4" />
    </svg>
  )
}

interface Props {
  project: Project
  deleteAction: (id: string) => Promise<void>
}

export function ProjectCard({ project, deleteAction }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [hovered, setHovered] = useState(false)

  const clips = project.clips ?? []
  const spent = clips.reduce((sum, c) => sum + (c.price ?? 0), 0)
  const shown = clips.slice(0, 4)
  const extra = clips.length - shown.length

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Supprimer le projet "${project.name}" ?`)) return
    setDeleting(true)
    await deleteAction(project.id)
  }

  return (
    <div
      className="proj-card"
      onClick={() => !deleting && router.push(`/projects/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: 'var(--bg-card)',
        borderRadius: 14,
        border: '0.5px solid var(--border-md)',
        overflow: 'hidden',
        cursor: deleting ? 'wait' : 'pointer',
        transition: 'box-shadow .15s',
        opacity: deleting ? 0.5 : 1,
      }}
    >
      {/* Banner */}
      <div
        style={{
          height: 72,
          position: 'relative',
          background: 'linear-gradient(135deg, #C8A882 0%, #B8715A 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Delete button — shown on card hover */}
        <button
          onClick={handleDelete}
          title="Supprimer le projet"
          className="proj-delete-btn"
          style={{
            position: 'absolute',
            top: 8, right: 8,
            zIndex: 3,
            width: 26, height: 26,
            borderRadius: 8,
            background: hovered ? 'rgba(255,255,255,.7)' : 'transparent',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'background .15s, opacity .15s',
          }}
        >
          <TrashIcon />
        </button>

        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: "'Varela Round', sans-serif",
            fontSize: 18,
            fontWeight: 400,
            color: 'rgba(255,255,255,.88)',
            letterSpacing: '0.3px',
            textAlign: 'center',
            textTransform: 'none',
            maxWidth: '80%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {project.name}
        </span>

        {/* Thumbnail strip */}
        {shown.length > 0 && (
          <div style={{ position: 'absolute', bottom: 8, right: 10, display: 'flex', zIndex: 2 }}>
            {shown.map((clip, i) => (
              <div key={clip.id} style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--bg-card)',
                marginLeft: i > 0 ? -6 : 0,
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>
                {clip.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={clip.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : '📦'}
              </div>
            ))}
            {extra > 0 && (
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--bg-card)',
                marginLeft: -6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: 'var(--text-muted)', fontFamily: jakarta,
              }}>
                +{extra}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 20,
            background: 'var(--accent-light)', color: 'var(--tag-text)', fontFamily: jakarta,
          }}>
            {fmtDate(project.created_at)}
          </span>
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 20,
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontFamily: jakarta,
          }}>
            {clips.length} produit{clips.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>
            {spent > 0 ? `${fmtCurrency(spent)} engagés` : `${clips.length} produit${clips.length !== 1 ? 's' : ''}`}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>
            Créé {fmtDate(project.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}
