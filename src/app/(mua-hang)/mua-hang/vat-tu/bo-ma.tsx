'use client'

import { useEffect, useState } from 'react'
import { Btn, Field, NoticeBar, Tag, TextArea, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { usageTotal, type MaterialUsage } from '@/lib/material-usage'
import type { Material } from '@/modules/dept/warehouse/warehouse.repo'

/**
 * BỎ MỘT MÃ — NGỪNG DÙNG hay XOÁ (05/10/2026, bản vẽ Bản 11 · V2, chủ dự án
 * duyệt). Một nút ở góc trái chân panel Sửa; nhãn tự đổi theo chỗ mã đang nằm:
 *
 *   · đã dùng ở đâu đó  → "Ngừng dùng…" (bắt lý do). Xoá là mất dấu vết.
 *   · chưa dùng ở đâu   → "Xoá mã…" (xác nhận, không hoàn tác).
 *   · đang ngừng dùng   → dải báo đầu panel + "Dùng lại".
 *
 * Xác nhận mở NGAY TRONG panel, không bật hộp thoại chồng. Bốn ô đếm lấy từ
 * `GET …/usage` — đúng hàm service dùng để chặn xoá (số là lời hứa).
 */

export type BoMaCtx = {
  /** Người xem có quyền `warehouse.material.retire`. */
  canRetire: boolean
  /** Mã đã xoá — danh sách bỏ dòng, đóng panel. */
  onRemoved: (id: string) => void
  /** Mã đổi trạng thái dùng — danh sách nạp lại. */
  onActiveChanged: (m: Material) => void
}

export type LanNgung = { at: string; by: string | null; reason: string | null }

/** Nạp số chỗ dùng khi panel mở (chỉ khi có quyền — không quyền thì khỏi hỏi). */
export function useMaHienDung(id: string, enabled: boolean) {
  const [usage, setUsage] = useState<MaterialUsage | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    api<{ usage: MaterialUsage }>(`/api/dept/warehouse/materials/${id}/usage`)
      .then((r) => live && setUsage(r.usage))
      .catch(() => live && setUsage(null))
    return () => {
      live = false
    }
  }, [id, enabled])
  return usage
}

const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Dải báo đầu panel của mã ĐANG ngừng dùng — kèm nút Dùng lại. */
export function DaiNgungDung({
  m,
  lan,
  ctx,
}: {
  m: Material
  lan: LanNgung | null
  ctx: BoMaCtx
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function dungLai() {
    setBusy(true)
    try {
      const r = await api<{ material: Material }>(
        `/api/dept/warehouse/materials/${m.id}/active`,
        { method: 'POST', body: { active: true } },
      )
      toast.success(
        `${m.code} dùng lại`,
        'Mã hiện lại ở ô chọn vật tư khi soạn đơn / phiếu.',
      )
      ctx.onActiveChanged(r.material)
    } catch (e) {
      toast.error('Không dùng lại được', apiErrorText(e))
      setBusy(false)
    }
  }
  return (
    <div className="mb-3">
      <NoticeBar
        tag="Ngừng dùng"
        action={ctx.canRetire && !busy ? { label: 'Dùng lại', onClick: () => void dungLai() } : undefined} // prettier-ignore
      >
        {lan ? (
          <>
            Từ <b className="num">{ngay(lan.at)}</b>
            {lan.by ? ` — ${lan.by}` : ''}
            {lan.reason ? `: “${lan.reason}”` : ''}.{' '}
          </>
        ) : null}
        Mã không hiện ở ô chọn vật tư khi soạn đơn / phiếu mới; đơn cũ vẫn giữ.
      </NoticeBar>
    </div>
  )
}

/** Nút góc trái chân panel — nhãn theo chỗ mã đang nằm. Chưa đếm xong thì chưa hiện. */
export function NutBoMa({
  m,
  usage,
  open,
  onOpen,
}: {
  m: Material
  usage: MaterialUsage | null
  open: boolean
  onOpen: () => void
}) {
  if (!m.is_active || !usage || open) return null
  return (
    <Btn danger onClick={onOpen}>
      {usageTotal(usage) > 0 ? 'Ngừng dùng…' : 'Xoá mã…'}
    </Btn>
  )
}

/** Khối xác nhận trong thân panel. */
export function KhoiBoMa({
  m,
  usage,
  ctx,
  onCancel,
}: {
  m: Material
  usage: MaterialUsage
  ctx: BoMaCtx
  onCancel: () => void
}) {
  const toast = useToast()
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const daDung = usageTotal(usage) > 0
  const thieuLyDo = lyDo.trim().length < 3

  async function ngung() {
    if (thieuLyDo) return
    setBusy(true)
    try {
      const r = await api<{ material: Material }>(
        `/api/dept/warehouse/materials/${m.id}/active`,
        { method: 'POST', body: { active: false, reason: lyDo.trim() } },
      )
      toast.success(`Đã ngừng dùng ${m.code}`, 'Đơn cũ, tồn, lịch sử giữ nguyên. Dùng lại được bất cứ lúc nào.') // prettier-ignore
      ctx.onActiveChanged(r.material)
    } catch (e) {
      toast.error('Không ngừng dùng được', apiErrorText(e))
      setBusy(false)
    }
  }
  async function xoa() {
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/materials/${m.id}`, { method: 'DELETE' })
      toast.success(`Đã xoá ${m.code}`, 'Nhật ký sửa của mã vẫn giữ.')
      ctx.onRemoved(m.id)
    } catch (e) {
      toast.error('Không xoá được', apiErrorText(e))
      setBusy(false)
    }
  }

  const o = (n: number, t: string) => (
    <div className="border-r border-[var(--line)] px-3 py-1.5 last:border-r-0">
      <div className="text-k-lg font-semibold text-[var(--ink)]"><span className="num">{n.toLocaleString('vi-VN')}</span></div>
      <div className="text-k-sm text-[var(--ink-3)]">{t}</div>
    </div>
  ) // prettier-ignore

  return (
    <section aria-label={daDung ? 'Ngừng dùng mã này' : 'Xoá mã này'}>
      <div className="k-sec">{daDung ? 'Ngừng dùng mã này' : 'Xoá mã này'}</div>
      <div className="text-k-sm mb-1 text-[var(--ink-3)]">Mã đang có mặt ở:</div>
      <div className="grid grid-cols-4 border border-[var(--line)]">
        {o(usage.po, 'dòng đơn mua')}
        {o(usage.stock, 'dòng sổ kho')}
        {o(usage.bom, 'dòng định mức')}
        {o(usage.prices + usage.other, 'giá NCC · kế hoạch')}
      </div>

      {daDung ? (
        <div className="text-k-sm mt-2 border border-l-[3px] border-[var(--warn-line)] border-l-[var(--warn)] bg-[var(--warn-wash)] px-3 py-2.5">
          <p className="text-[var(--ink-2)]">
            <b>Không xoá được</b> — xoá thì đơn mua và sổ kho mất dấu vết món hàng này.{' '}
            <b>Ngừng dùng</b> thay cho xoá: mã biến khỏi ô chọn vật tư khi soạn đơn /
            phiếu MỚI; đơn cũ, tồn kho, lịch sử giữ nguyên. Dùng lại được bất cứ lúc nào.
          </p>
          <div className="mt-2">
            <Field label="Lý do ngừng dùng *">
              <TextArea
                value={lyDo}
                onChange={setLyDo}
                rows={2}
                placeholder="vd: trùng mã khác · NCC ngừng sản xuất · đổi quy cách"
              />
            </Field>
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            {thieuLyDo && (
              <span className="text-k-sm mr-auto text-[var(--ink-3)]">
                Ghi lý do (ít nhất 3 ký tự) để ngừng dùng.
              </span>
            )}
            <Btn onClick={onCancel}>Thôi</Btn>
            <Btn
              primary
              danger
              busy={busy}
              disabled={thieuLyDo}
              onClick={() => void ngung()}
            >
              Ngừng dùng {m.code}
            </Btn>
          </div>
        </div>
      ) : (
        <div className="text-k-sm mt-2 border border-l-[3px] border-[var(--stop-line)] border-l-[var(--stop)] bg-[var(--stop-wash)] px-3 py-2.5">
          <p className="text-[var(--ink-2)]">
            Mã <span className="num">{m.code}</span> <b>chưa dùng ở đâu</b> — xoá hẳn khỏi
            danh mục. <b>Không hoàn tác.</b> Nhật ký sửa của mã (ai đổi gì, khi nào) vẫn
            giữ, kèm dòng “đã xoá bởi … lúc …”.
          </p>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Btn onClick={onCancel}>Thôi</Btn>
            <Btn primary danger busy={busy} onClick={() => void xoa()}>
              Xoá {m.code}
            </Btn>
          </div>
        </div>
      )}
    </section>
  )
}

/** Nhãn "Ngừng dùng" cho dòng danh sách. */
export function TagNgung({ lan }: { lan?: LanNgung | null }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Tag tone="warn">Ngừng dùng</Tag>
      {lan && (
        <span className="num text-k-sm text-[var(--ink-3)]">
          {ngay(lan.at).slice(0, 5)}
          {lan.by ? ` · ${lan.by.split(' ').slice(-2).join(' ')}` : ''}
        </span>
      )}
    </span>
  )
}
