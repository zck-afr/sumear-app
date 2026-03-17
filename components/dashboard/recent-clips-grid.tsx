'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Clip {
  id: string
  product_name: string
  brand: string | null
  price: number | null
  currency: string
  image_url: string | null
  source_domain: string
  created_at: string
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `Il y a ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  return `Il y a ${days}j`
}

export function RecentClipsGrid({ clips }: { clips: Clip[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggle(clipId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(clipId)) next.delete(clipId)
      else next.add(clipId)
      return next
    })
  }

  const clipsParam = selectedIds.size > 0 ? Array.from(selectedIds).join(',') : null

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clips.map((clip) => {
          const formattedPrice = clip.price != null
            ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: clip.currency || 'EUR' }).format(clip.price)
            : null
          const timeAgo = getTimeAgo(clip.created_at)
          const isSelected = selectedIds.has(clip.id)
          return (
            <label
              key={clip.id}
              className={`group flex flex-col rounded-xl bg-[#F5F0E8] dark:bg-[#393E46] border-2 border-gray-300 dark:border-[#393E46] shadow-sm dark:shadow-none p-3 cursor-pointer transition-colors ${
                isSelected ? 'border-violet-500 ring-2 ring-violet-500/30' : 'hover:border-gray-400 dark:hover:border-[#4a5059]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="relative mt-1.5 shrink-0 flex h-5 w-5 items-center justify-center rounded-md border border-gray-300 dark:border-[#4a5059] bg-white dark:bg-[#434850] transition-colors group-has-[:checked]:border-violet-500/60 group-has-[:checked]:bg-violet-500/20">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(clip.id)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {isSelected && (
                    <svg className="h-3 w-3 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <div className="w-12 h-12 rounded-lg bg-white dark:bg-[#434850] border border-gray-100 dark:border-transparent flex items-center justify-center overflow-hidden shrink-0">
                  {clip.image_url ? (
                    <img src={clip.image_url} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-gray-400 dark:text-[#555] text-lg">📦</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{clip.product_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {formattedPrice && <span className="text-sm font-bold text-gray-900 dark:text-white">{formattedPrice}</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-[#555] mt-0.5">{clip.source_domain} · {timeAgo}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#555] mt-2 pt-2 border-t border-gray-300 dark:border-[#393E46]">
                Discuter
              </p>
            </label>
          )
        })}
      </div>
      {selectedIds.size > 0 && (
        <div className="flex justify-center pt-2">
          <Link
            href={`/chat?clips=${clipsParam}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors"
          >
            Demander à l&apos;IA ?
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  )
}
