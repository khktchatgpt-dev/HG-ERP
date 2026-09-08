'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { Affected, Consequence, Sheet, SheetActions } from '@/components/kit'
/*
 * Nút và ô nhập lấy bản `shadcn/*` chứ không phải `ui/Button` + `ui/Input`
 * (04/09/2026). Hai tệp kia còn nguyên theme-v2: nút `bg-slate-900`, và ô nhập
 * `focus-visible:ring-amber-500` — vòng focus hổ phách, đúng màu theme-v3 dành
 * cho CẢNH BÁO. Hộp thoại xác nhận là chỗ tệ nhất để một ô nhập bình thường tự
 * nhuộm màu cảnh báo lúc người dùng vừa nhấp vào.
 */
import { Textarea } from '@/components/shadcn/textarea'

type Options = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  /**
   * BẢNG KÊ THỨ SẮP BỊ ĐỘNG VÀO (09/09/2026).
   *
   * Hộp thoại che mất chính hàng người dùng vừa đọc ở bảng, nên nó phải chép
   * lại thứ nó che. Trước đây `description` chỉ nối chuỗi mã đơn thành một
   * dòng — người duyệt không thấy NCC hay số tiền, phải bấm Huỷ để nhìn lại.
   */
  affected?: { code: string; label?: string; amount?: string; note?: string }[]
  /**
   * HẬU QUẢ — cái gì đổi sau khi bấm. Đặt SÁT nút, không lẫn vào phần mô tả:
   * mắt dừng ở đó cuối cùng trước khi tay bấm.
   */
  consequence?: string
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

      <Sheet
        open={cState.open}
        onClose={() => closeConfirm(false)}
        title={cState.opts.title}
        subtitle={cState.opts.description}
        stakes={cState.opts.tone === 'danger' ? 'nang' : 'vua'}
        footer={
          <SheetActions
            onCancel={() => closeConfirm(false)}
            onConfirm={() => closeConfirm(true)}
            confirmLabel={cState.opts.confirmLabel ?? 'Xác nhận'}
            cancelLabel={cState.opts.cancelLabel ?? 'Huỷ'}
            stakes={cState.opts.tone === 'danger' ? 'nang' : 'vua'}
          />
        }
      >
        {cState.opts.affected && cState.opts.affected.length > 0 && (
          <Affected items={cState.opts.affected} />
        )}
        {cState.opts.consequence && (
          <Consequence>{cState.opts.consequence}</Consequence>
        )}
      </Sheet>

      <Sheet
        open={pState.open}
        onClose={() => closePrompt(null)}
        title={pState.opts.title}
        subtitle={pState.opts.description}
        stakes={pState.opts.tone === 'danger' ? 'nang' : 'vua'}
        footer={
          <SheetActions
            onCancel={() => closePrompt(null)}
            onConfirm={() => closePrompt(pState.value.trim())}
            confirmLabel={pState.opts.confirmLabel ?? 'OK'}
            cancelLabel={pState.opts.cancelLabel ?? 'Huỷ'}
            stakes={pState.opts.tone === 'danger' ? 'nang' : 'vua'}
            busy={!!pState.opts.required && !pState.value.trim()}
          />
        }
      >
        {pState.opts.affected && pState.opts.affected.length > 0 && (
          <div className="mb-3">
            <Affected items={pState.opts.affected} />
          </div>
        )}
        {pState.opts.inputLabel && (
          <label className="mb-1 block text-[12.5px] font-medium">
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
        {pState.opts.consequence && <Consequence>{pState.opts.consequence}</Consequence>}
      </Sheet>

    </ConfirmCtx.Provider>
  )
}
