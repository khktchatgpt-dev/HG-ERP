'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { DAU_SUA_PHIEU } from '@/lib/da-ve'
import {
  Chip,
  Code,
  Consequence,
  Sheet,
  SheetActions,
  TextArea,
  useToast,
} from '@/components/kit'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'

const so = (n: number) => n.toLocaleString('vi-VN')
/** Cùng lớp với kit `TextInput` — nhưng cập nhật theo TỪNG PHÍM: nút Lưu phải mở ngay khi gõ, không đợi rời ô. */
const O_NHAP =
  'h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] text-k-sm bg-[var(--surface-card)] px-2 placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]'
const NHAN = 'text-k-sm flex flex-col gap-1'
const NHAN_CHU = 'font-semibold text-[var(--ink-2)]'
type Kieu = 'thong-tin' | 'so-luong'

/**
 * SỬA PHIẾU NHẬP ĐÃ GHI SỔ (02/10/2026, chủ dự án duyệt A + B). Hai cách, chọn ở
 * đầu hộp — mặc định cách NHẸ (sai thông tin nhiều hơn sai số):
 *
 *  · Sửa thông tin (B) — số phiếu giao NCC, người giao, ghi chú: không đổi tồn,
 *    sửa TẠI CHỖ, vết trước → sau vào Trao đổi của đơn (`suaThongTinPhieu`).
 *    Ngày chứng từ không sửa ở đây: ngày quyết định kỳ kế toán.
 *  · Sửa số lượng / dòng (A) — ĐẢO phiếu cũ (phiếu xuất ngược, đúng
 *    `reverseDoc` Kho đang dùng) rồi LẬP LẠI phiếu mới điền sẵn số cũ
 *    (`/nhan?sua=`). Vết: PNK cũ → PXK đảo → PNK mới ("Sửa lại PNK-…"). Bỏ ngang
 *    thì phiếu cũ nằm ở Cần xử lý với nút Lập lại phiếu. Cách của SAP (Cancel &
 *    re-post), Odoo (Return rồi nhận lại).
 *
 * Server là người quyết (hàng đã dùng, hàng QC loại, phiếu đã đảo…) — câu lỗi
 * hiện ngay trong hộp.
 */
export function SuaPhieuSheet({ row, onClose }: { row: DaVeRow; onClose: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [kieu, setKieu] = useState<Kieu>('thong-tin')
  const [soNcc, setSoNcc] = useState(row.supplier_doc_no ?? '')
  const [nguoiGiao, setNguoiGiao] = useState(row.counterparty ?? '')
  const [ghiChu, setGhiChu] = useState(row.ghi_chu ?? '')
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  const doiThongTin =
    soNcc.trim() !== (row.supplier_doc_no ?? '') ||
    nguoiGiao.trim() !== (row.counterparty ?? '') ||
    ghiChu.trim() !== (row.ghi_chu ?? '')
  const why =
    kieu === 'thong-tin' && !doiThongTin
      ? 'Chưa đổi thông tin nào'
      : lyDo.trim().length < 3
        ? 'Ghi lý do sửa (sai gì)'
        : null

  async function luu() {
    if (why) return
    setBusy(true)
    setLoi(null)
    try {
      if (kieu === 'thong-tin') {
        await api(`/api/dept/warehouse/docs/${row.doc_id}/thong-tin`, {
          method: 'PATCH',
          body: {
            supplier_doc_no: soNcc,
            counterparty: nguoiGiao,
            note: ghiChu,
            reason: lyDo.trim(),
          },
        })
        toast.success(
          `Đã sửa thông tin ${row.code}`,
          `Vết ghi vào Trao đổi của ${row.po_code}`,
        )
        onClose()
        router.refresh()
        return
      }
      const rev = await api<{ code: string }>(
        `/api/dept/warehouse/docs/${row.doc_id}/reverse`,
        { method: 'POST', body: { reason: `${DAU_SUA_PHIEU} — ${lyDo.trim()}` } },
      )
      toast.success(
        `Đã đảo ${row.code}`,
        `Phiếu đảo ${rev.code} — mở phiếu mới để lập lại`,
      )
      router.push(`/mua-hang/don/${row.po_id}/nhan?sua=${row.doc_id}`)
    } catch (e) {
      setLoi(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      stakes="vua"
      title={`Sửa phiếu nhập · ${row.code}`}
      subtitle={`${row.po_code} · ${row.supplier_name} — nhận ngày ${row.doc_date.slice(0, 10).split('-').reverse().join('/')}`}
      footer={
        <>
          {(loi || why) && (
            <div
              className={`text-k-sm mb-2 ${loi ? 'text-[var(--stop)]' : 'text-[var(--warn)]'}`}
            >
              {loi ?? why}
            </div>
          )}
          <SheetActions
            onCancel={onClose}
            onConfirm={() => void luu()}
            confirmLabel={kieu === 'thong-tin' ? 'Lưu thông tin' : 'Đảo phiếu và lập lại'}
            busy={busy}
            disabled={!!why}
          />
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Sửa gì">
        <Chip on={kieu === 'thong-tin'} onClick={() => setKieu('thong-tin')}>
          Sửa thông tin (số phiếu NCC, người giao, ghi chú)
        </Chip>
        <Chip on={kieu === 'so-luong'} onClick={() => setKieu('so-luong')}>
          Sửa số lượng / dòng
        </Chip>
      </div>

      {kieu === 'thong-tin' ? (
        <div className="flex flex-col gap-3">
          <label className={NHAN}>
            <span className={NHAN_CHU}>Số phiếu giao của NCC</span>
            <input
              className={O_NHAP}
              value={soNcc}
              onChange={(e) => setSoNcc(e.target.value)}
              maxLength={60}
            />
          </label>
          <label className={NHAN}>
            <span className={NHAN_CHU}>Người giao</span>
            <input
              className={O_NHAP}
              value={nguoiGiao}
              onChange={(e) => setNguoiGiao(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className={NHAN}>
            <span className={NHAN_CHU}>Ghi chú phiếu</span>
            <TextArea
              value={ghiChu}
              onChange={setGhiChu}
              rows={2}
              aria-label="Ghi chú phiếu"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col">
          {row.lines.map((l) => (
            <div
              key={l.movement_id}
              className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--line)] py-2"
            >
              <Code>{l.material_code}</Code>
              <span className="text-k-sm truncate" title={l.material_name}>
                {l.material_name}
              </span>
              <span className="num text-k-sm">
                {so(l.qty)} {l.unit}
                {l.stock_status === 'blocked' ? ' · sai quy cách' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <div className="text-k-label mb-1 font-bold tracking-[.09em] text-[var(--ink-label)] uppercase">
          Sai gì · bắt buộc
        </div>
        <TextArea
          value={lyDo}
          onChange={setLyDo}
          rows={2}
          placeholder={
            kieu === 'thong-tin'
              ? 'ví dụ: gõ nhầm số phiếu giao PG-12 thành PG-21'
              : 'ví dụ: gõ nhầm 1.300 thành 1.030 ở dòng ST-0070'
          }
          aria-label="Lý do sửa phiếu nhập"
        />
      </div>
      <Consequence>
        {kieu === 'thong-tin'
          ? 'Chỉ đổi thông tin trên phiếu — tồn kho, số đã nhận và công nợ giữ nguyên. Ai sửa, lúc nào, trước → sau và lý do ghi vào Trao đổi của đơn. Sai ngày chứng từ thì dùng Sửa số lượng / dòng.'
          : `Bước 1: đảo ${row.code} — ghi một phiếu xuất ngược đúng các dòng trên (tồn trừ lại, đơn quay về số đã nhận trước phiếu này). Bước 2: mở phiếu nhập mới, số đã điền sẵn theo phiếu cũ — sửa chỗ sai rồi Ghi sổ. Hàng đã lấy ra dùng thì không đảo được.`}
      </Consequence>
    </Sheet>
  )
}
