'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Tone = 'info' | 'success' | 'error' | 'warning'

type Toast = {
  id: number
  tone: Tone
  title: string
  description?: string
  ttl: number
}

type Ctx = {
  show: (input: { tone?: Tone; title: string; description?: string; ttl?: number }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastCtx = createContext<Ctx | null>(null)

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show: Ctx['show'] = useCallback(({ tone = 'info', title, description, ttl = 4000 }) => {
    const id = ++counter
    setToasts((ts) => [...ts, { id, tone, title, description, ttl }])
  }, [])

  const api: Ctx = {
    show,
    success: (title, description) => show({ tone: 'success', title, description }),
    error: (title, description) => show({ tone: 'error', title, description, ttl: 6000 }),
    info: (title, description) => show({ tone: 'info', title, description }),
    warning: (title, description) => show({ tone: 'warning', title, description }),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Viewport
        toasts={toasts}
        dismiss={(id) => setToasts((ts) => ts.filter((t) => t.id !== id))}
      />
    </ToastCtx.Provider>
  )
}

function Viewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div
      role="region"
      aria-label="Thông báo"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col-reverse gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

const TONE_STYLES: Record<Tone, { bar: string; icon: string }> = {
  info:    { bar: 'bg-blue-500',   icon: 'ℹ' },
  success: { bar: 'bg-green-500',  icon: '✓' },
  warning: { bar: 'bg-amber-500',  icon: '⚠' },
  error:   { bar: 'bg-red-500',    icon: '✕' },
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, toast.ttl)
    return () => clearTimeout(id)
  }, [onClose, toast.ttl])

  const { bar, icon } = TONE_STYLES[toast.tone]

  return (
    <div
      role="alert"
      className="pointer-events-auto flex overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
    >
      <span aria-hidden className={`w-1 shrink-0 ${bar}`} />
      <div className="flex flex-1 items-start gap-2 p-3">
        <span aria-hidden className="text-base leading-none">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{toast.title}</div>
          {toast.description && (
            <div className="mt-0.5 text-xs text-zinc-500">{toast.description}</div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
