'use client'

import { useState } from 'react'
import { fmtMoney } from '@/lib/po-line'
import { goiYMucDich } from '@/lib/po-muc-dich'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import type { ProjectOption } from '@/modules/dept/supply/projects.service'
import { HangMucSheet } from '@/app/(mua-hang)/mua-hang/hang-muc/hang-muc-sheet'
import { ChonNhom, khop, type NhomChon } from '../../_erp/chon-nhom'

const HM = 'hm:'
const MOI = '@moi'
/** Chưa gõ thì nhóm lệnh chỉ bày chừng này dòng — để nhóm hạng mục luôn lọt khung (bản vẽ). */
const LENH_HIEN = 3

/** "128,4 tr" — số gọn cho dòng gợi ý. */
const gon = (n: number, cur: string) =>
  cur !== 'VND'
    ? `${fmtMoney(n, cur)} ${cur}`
    : n >= 1e6
      ? `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`
      : fmtMoney(n, cur)
const tienHm = (h: ProjectOption) =>
  h.budget
    ? `${gon(h.ordered, h.currency)} / ${gon(h.budget, h.currency)}`
    : gon(h.ordered, h.currency)

/**
 * Ô "CHO VIỆC" — đơn mua này mua cho việc gì (B2 bản vẽ Đầu đơn, 12/10/2026).
 * Viết tay theo bản vẽ, không qua kit ("ko dùng kit hiện tại").
 *
 * MỘT ô, hai loại việc: lệnh sản xuất đang chạy HOẶC hạng mục ngoài sản xuất
 * đang mở (0230). Trong ô có thẻ LỆNH SX / HẠNG MỤC nói đang chọn loại nào. Danh
 * sách hai nhóm có tiêu đề; chưa gõ thì nhóm lệnh chỉ bày 3 dòng kèm "… N lệnh
 * nữa — gõ số lệnh hoặc tên khách", nên nhóm hạng mục luôn thấy (bản đầu bày đủ
 * 18 lệnh trước, hạng mục rơi xuống dòng 15–20 ngoài khung). Dòng cuối "+ Tạo
 * hạng mục …" mang luôn chữ đang gõ làm tên. Chọn hạng mục thì cạnh ô bày "đã
 * đặt / dự toán".
 *
 * Chỉ ĐƠN MỚI đổi được giữa lệnh và hạng mục: sửa nháp thì server giữ nguyên
 * lệnh chính (pos.service `update`); nháp ngoài lệnh vẫn đổi hạng mục được.
 */
export function OChoViec({
  header,
  setHeader,
  lsxOptions,
  hangMuc,
  onHangMucMoi,
  doiDuoc,
  toi,
}: {
  header: Pick<PoHeader, 'poType' | 'lsxId' | 'projectId'>
  setHeader: (f: (h: PoHeader) => PoHeader) => void
  lsxOptions: { value: string; label: string; hint?: string }[]
  /** Hạng mục đang mở (+ hạng mục của chính đơn nếu đã đóng). */
  hangMuc: readonly ProjectOption[]
  /** Hạng mục vừa tạo trong hộp — thêm vào danh sách của màn. */
  onHangMucMoi: (h: ProjectOption) => void
  /** Đơn mới — đổi qua lại giữa lệnh và hạng mục được. */
  doiDuoc: boolean
  /** Tên người đang soạn — người phụ trách hạng mục tạo mới. */
  toi: string
}) {
  const [tao, setTao] = useState<string | null>(null)
  const ngoai = header.poType === 'standalone'
  const choLenh = doiDuoc || !ngoai
  const choHm = doiDuoc || ngoai
  const hm = ngoai ? hangMuc.find((h) => h.id === header.projectId) : undefined
  const lsx = !ngoai ? lsxOptions.find((o) => o.value === header.lsxId) : undefined
  const value = ngoai ? (header.projectId ? HM + header.projectId : '') : header.lsxId
  const pct =
    hm?.budget && hm.ordered > 0 ? Math.round((hm.ordered / hm.budget) * 100) : null

  const nhom = (q: string): NhomChon[] => {
    const out: NhomChon[] = []
    if (choLenh) {
      const all = lsxOptions.filter((o) => !q || khop(q, o.label, o.hint))
      const hien = q ? all : all.slice(0, LENH_HIEN)
      const con = all.length - hien.length
      out.push({
        title: 'Lệnh sản xuất đang chạy',
        rows: hien.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
        con: con > 0 ? `… ${con} lệnh nữa — gõ số lệnh hoặc tên khách` : undefined,
      })
    }
    if (choHm) {
      const ten = q.trim()
      const rows = hangMuc
        .filter((h) => !q || khop(q, h.code, h.name, h.kind))
        .map((h) => ({
          value: HM + h.id,
          label: `${h.code} · ${h.name}`,
          hint: `${h.kind}${h.status !== 'open' ? ' · đã đóng' : ''}`,
          right: `${h.n} đơn · ${tienHm(h)}`,
        }))
      rows.push({
        value: MOI,
        label: ten ? `+ Tạo hạng mục "${ten}"` : '+ Tạo hạng mục mới…',
        hint: ten
          ? 'mở hộp tạo, tên điền sẵn'
          : 'việc ngoài sản xuất chưa có trong danh sách',
        right: '',
      })
      out.push({ title: 'Hạng mục ngoài sản xuất · đang mở', rows: rows.map((r) => (r.value === MOI ? { ...r, act: true } : r)) }) // prettier-ignore
    }
    return out
  }

  const chon = (v: string, q: string) => {
    if (v === MOI) return setTao(q.trim())
    if (v.startsWith(HM))
      return setHeader((h) => ({ ...h, poType: 'standalone', projectId: v.slice(HM.length), lsxId: '', extraLsxIds: [] })) // prettier-ignore
    setHeader((h) => ({ ...h, poType: 'lsx', lsxId: v, projectId: '' }))
  }

  return (
    <>
      <span
        className={`inline-flex min-h-[34px] items-center rounded-[3px] border bg-[var(--surface-card)] pl-2 ${value ? 'border-[var(--line)]' : 'border-[var(--stop-line)]'}`}
      >
        <span className="pr-2 text-[10.5px] font-bold tracking-[.05em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Cho việc<span className="text-[var(--stop)]"> *</span>
          <span className="sr-only"> (bắt buộc)</span>
        </span>
        <span className="flex items-center border-l border-[var(--hair)] pl-1.5">
          <ChonNhom
            label="Cho việc"
            value={value}
            text={hm ? `${hm.code} · ${hm.name}` : (lsx?.label ?? '')}
            nhom={nhom}
            onPick={chon}
            placeholder={
              doiDuoc
                ? 'Gõ số lệnh, tên khách, hạng mục…'
                : ngoai
                  ? 'Gõ tên hạng mục…'
                  : 'Gõ số lệnh…'
            }
            width={ngoai ? 230 : 170}
            listWidth={560}
            prefix={
              value ? (
                <span className="rounded-[3px] bg-[#eceff3] px-1.5 py-[2px] text-[10px] font-bold whitespace-nowrap text-[var(--ink-2)]">
                  {ngoai ? 'HẠNG MỤC' : 'LỆNH SX'}
                </span>
              ) : null
            }
          />
        </span>
      </span>
      {hm && (
        <span
          className={`text-[11px] whitespace-nowrap ${pct != null && pct >= NGUONG_DU_TOAN ? 'text-[var(--warn)]' : 'text-[var(--ink-3)]'}`}
          title={`${hm.n} đơn (kể cả nháp) · đã đặt ${fmtMoney(hm.ordered, hm.currency)} ${hm.currency} (gồm VAT, trừ nháp + huỷ)${hm.budget ? ` · dự toán ${fmtMoney(hm.budget, hm.currency)}` : ''}`}
        >
          {tienHm(hm)}
          {pct != null ? ` (${pct}%)` : ''}
        </span>
      )}
      {hm && hm.status !== 'open' && (
        // Đơn nhân bản / ?hm= trỏ hạng mục ĐÃ ĐÓNG: nói ngay, đừng đợi lúc lưu mới báo.
        <span className="text-[11px] whitespace-nowrap text-[var(--warn)]">
          {hm.code} đã đóng — chọn hạng mục khác
        </span>
      )}
      {tao != null && (
        <HangMucSheet
          tenSan={tao}
          phuTrach={toi}
          goiYLoai={goiYMucDich(hangMuc.map((h) => h.kind))}
          onClose={() => setTao(null)}
          onSaved={(p) => {
            onHangMucMoi({ ...p, status: 'open', n: 0, ordered: 0 })
            setHeader((h) => ({ ...h, poType: 'standalone', projectId: p.id, lsxId: '', extraLsxIds: [] })) // prettier-ignore
          }}
        />
      )}
    </>
  )
}

/**
 * Dòng chân đơn "sau đơn này hạng mục lên X / Y (Z%)" (bản vẽ) — null khi đơn
 * không thuộc hạng mục hoặc khác tiền tệ (không cộng chéo tiền).
 */
export function hangMucSauDon(
  h: ProjectOption | undefined,
  grand: number,
  currency: string,
): string | null {
  if (!h || h.currency !== currency) return null
  const sau = h.ordered + grand
  if (!h.budget) return `${gon(sau, h.currency)} (chưa đặt dự toán)`
  return `${gon(sau, h.currency)} / ${gon(h.budget, h.currency)} (${Math.round((sau / h.budget) * 100)}%)`
}
