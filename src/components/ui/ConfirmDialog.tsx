'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { Modal } from '@/components/Modal'
/*
 * Nút và ô nhập lấy bản `shadcn/*` chứ không phải `ui/Button` + `ui/Input`
 * (04/09/2026). Hai tệp kia còn nguyên theme-v2: nút `bg-slate-900`, và ô nhập
 * `focus-visible:ring-amber-500` — vòng focus hổ phách, đúng màu theme-v3 dành
 * cho CẢNH BÁO. Hộp thoại xác nhận là chỗ tệ nhất để một ô nhập bình thường tự
 * nhuộm màu cảnh báo lúc người dùng vừa nhấp vào.
 */
import { Button } from '@/components/shadcn/button'
import { Textarea } from '@/components/shadcn/textarea'

type Options = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type PromptOptions = Options & {
  inputLabel?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}

type Ctx = {
  confirm: (opts: Options) => Promise<boolean>
  prompt: (opts: PromptOptions) => Promise<string | null>
}

const ConfirmCtx = createContext<Ctx | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>')
  return ctx.confirm
}

export function usePrompt() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('usePrompt must be used inside <ConfirmProvider>')
  return ctx.prompt
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // Confirm state
  const [cState, setCState] = useState<{
    open: boolean
    opts: Options
    resolve: (v: boolean) => void
  }>({ open: false, opts: { title: '' }, resolve: () => {} })

  // Prompt state
  const [pState, setPState] = useState<{
    open: boolean
    opts: PromptOptions
    value: string
    resolve: (v: string | null) => void
  }>({ open: false, opts: { title: '' }, value: '', resolve: () => {} })

  const confirm = useCallback(
    (opts: Options) =>
      new Promise<boolean>((resolve) => {
        setCState({ open: true, opts, resolve })
      }),
    [],
  )

  const promptFn = useCallback(
    (opts: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setPState({
          open: true,
          opts,
          value: opts.defaultValue ?? '',
          resolve,
        })
      }),
    [],
  )

  const closeConfirm = (result: boolean) => {
    cState.resolve(result)
    setCState((s) => ({ ...s, open: false }))
  }

  const closePrompt = (result: string | null) => {
    pState.resolve(result)
    setPState((s) => ({ ...s, open: false }))
  }

  return (
    <ConfirmCtx.Provider value={{ confirm, prompt: promptFn }}>
      {children}

      <Modal
        open={cState.open}
        onClose={() => closeConfirm(false)}
        title={cState.opts.title}
      >
        {cState.opts.description && (
          <p className="text-muted-foreground mb-4 text-sm">{cState.opts.description}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => closeConfirm(false)}>
            {cState.opts.cancelLabel ?? 'Huỷ'}
          </Button>
          <Button
            variant={cState.opts.tone === 'danger' ? 'destructive' : 'default'}
            onClick={() => closeConfirm(true)}
            autoFocus
          >
            {cState.opts.confirmLabel ?? 'Xác nhận'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={pState.open}
        onClose={() => closePrompt(null)}
        title={pState.opts.title}
      >
        {pState.opts.description && (
          <p className="text-muted-foreground mb-3 text-sm">{pState.opts.description}</p>
        )}
        {pState.opts.inputLabel && (
          <label className="mb-1 block text-sm font-medium">
            {pState.opts.inputLabel}
          </label>
        )}
        <Textarea
          rows={3}
          placeholder={pState.opts.placeholder}
          value={pState.value}
          onChange={(e) => setPState((s) => ({ ...s, value: e.target.value }))}
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => closePrompt(null)}>
            {pState.opts.cancelLabel ?? 'Huỷ'}
          </Button>
          <Button
            variant={pState.opts.tone === 'danger' ? 'destructive' : 'default'}
            disabled={pState.opts.required && !pState.value.trim()}
            onClick={() => closePrompt(pState.value.trim())}
          >
            {pState.opts.confirmLabel ?? 'OK'}
          </Button>
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  )
}
