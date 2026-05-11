'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useConfirm } from '@/lib/hooks/use-confirm'

const jakarta = 'var(--font-plus-jakarta-sans), sans-serif'

/** List order (0-based), cycles past index 4 — used when `card_banner_gradient` is not set in DB */
const BANNER_GRADIENTS_BY_INDEX = [
  'linear-gradient(135deg, #C8A882, #B8715A)', // 0 terracotta
  'linear-gradient(135deg, #8AA89A, #5A8070)', // 1 sauge
  'linear-gradient(135deg, #9A8AAA, #6A5A7A)', // 2 prune
  'linear-gradient(135deg, #B8A870, #8A7840)', // 3 ocre
  'linear-gradient(135deg, #A89098, #786070)', // 4 rose gris
]

function bannerBackground(listIndex: number, stored: string | null | undefined): string {
  const t = typeof stored === 'string' ? stored.trim() : ''
  if (t) return t
  return BANNER_GRADIENTS_BY_INDEX[listIndex % BANNER_GRADIENTS_BY_INDEX.length]
}

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
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function fmtCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="2 4 14 4" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M6 7v5M10 7v5" />
      <path d="M3 4l.9 9a1 1 0 0 0 1 .9h6.2a1 1 0 0 0 1-.9L13 4" />
    </svg>
  )
}

interface Props {
  project: Project
  /** 0-based index in the projects list (order from server) */
  listIndex: number
  deleteAction: (id: string) => Promise<void>
}

export function ProjectCard({ project, listIndex, deleteAction }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { confirmModal, showConfirm } = useConfirm()

  const clips = project.clips ?? []
  const spent = clips.reduce((sum, c) => sum + (c.price ?? 0), 0)
  const shown = clips.slice(0, 4)
  const extra = clips.length - shown.length
  const bannerGradient = bannerBackground(listIndex, project.card_banner_gradient)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    showConfirm({
      title: 'Delete project',
      message: "This project and all its settings will be permanently deleted. Your saved products will not be affected.",
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        setDeleting(true)
        await deleteAction(project.id)
      },
    })
  }

  return (
    <>
    {confirmModal}
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
          minHeight: 108,
          position: 'relative',
          background: bannerGradient,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        }}
      >
        {/* Delete button — shown on card hover */}
        <button
          onClick={handleDelete}
          title="Delete project"
          className="proj-delete-btn"
          style={{
            position: 'absolute',
            top: 8, right: 8,
            zIndex: 3,
            width: 26, height: 26,
            borderRadius: 8,
            background: hovered ? 'rgba(42, 30, 24, 0.34)' : 'transparent',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'background .15s, opacity .15s',
          }}
        >
          <TrashIcon />
        </button>

        {/* Name zone — grows to fill space above thumbnails */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: shown.length > 0 ? '10px 40px 6px 14px' : '10px 40px 10px 14px',
          minHeight: shown.length > 0 ? 64 : 108,
        }}>
          <span
            style={{
              fontFamily: "'Varela Round', sans-serif",
              fontSize: 18,
              fontWeight: 400,
              color: 'rgba(255,255,255,.88)',
              letterSpacing: '0.3px',
              textAlign: 'center',
              wordBreak: 'break-word',
              maxWidth: '100%',
            }}
          >
            {project.name}
          </span>
        </div>

        {/* Thumbnail strip */}
        {shown.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: 10, paddingBottom: 8, flexShrink: 0 }}>
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
            {clips.length} product{clips.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>
            {spent > 0 ? `${fmtCurrency(spent)} total` : `${clips.length} product${clips.length !== 1 ? 's' : ''}`}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: jakarta }}>
            Created {fmtDate(project.created_at)}
          </span>
        </div>
      </div>
    </div>
    </>
  )
}
