'use client'

import { useState, useCallback } from 'react'
import { ConfirmModal, type ConfirmModalProps } from '@/components/ui/confirm-modal'

type ShowConfirmOptions = Omit<ConfirmModalProps, 'onCancel'>

interface UseConfirmReturn {
  confirmModal: React.ReactNode
  showConfirm: (options: ShowConfirmOptions) => void
}

export function useConfirm(): UseConfirmReturn {
  const [options, setOptions] = useState<ShowConfirmOptions | null>(null)

  const showConfirm = useCallback((opts: ShowConfirmOptions) => {
    setOptions(opts)
  }, [])

  const handleConfirm = () => {
    options?.onConfirm()
    setOptions(null)
  }

  const handleCancel = () => {
    setOptions(null)
  }

  const confirmModal = options ? (
    <ConfirmModal
      {...options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { confirmModal, showConfirm }
}
