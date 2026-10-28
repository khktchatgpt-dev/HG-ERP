'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  LY_DO_CAP_NHAT,
  chenh,
  docSoThucTe,
  hoiLenh,
  kiemTruocGhi,
  taoDong,
  thanGui,
  type DauCapNhat,
  type MaLyDoCapNhat,
} from '@/lib/kho-cap-nhat-ton'
import { BU_LOI, HoiLenh } from '../cap-nhat-ton/hoi-lenh'
import type { CuaLenh } from './ton-lenh.shared'
import type { TonRow } from './TonKhoScreen'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

type KetQua =
  | { trang_thai: 'cho_duyet'; id: string; code: string }
  | {
      trang_thai: 'da_ghi'
      code: string
      doc_code: string
      xuat_bu: { code: string; lsx_code: string }[]
    }

/** Câu chặn cho MỘT mã — bỏ "dòng 1 " của lib (màn riêng có nhiều dòng). */
const cauMotMa = (m: string) => {
  const s = m.replace(/^dòng \d+ /, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * CẬP NHẬT SỐ THỰC TẾ NGAY TRONG KHUNG MÃ của Tồn kho (28/10/2026 — chủ dự án:
 * "sao không cho cập nhật trực tiếp tại màn này mà phải sang màn khác"). Một mã:
 * gõ số đếm được → thấy chênh → (giảm hàng của lệnh) chọn "tổ đã lấy → xuất bù"
 * hay "hỏng / mất" → Ghi. Cùng luật + cùng route với màn Cập nhật số thực tế
 * (`lib/kho-cap-nhat-ton`, POST `cap-nhat-ton`): trưởng kho đổi tồn ngay, người
 * khác chờ trưởng kho duyệt. Màn riêng vẫn giữ cho việc cập nhật NHIỀU mã một lượt.
 */
export function CapNhatNhanh({
  row,
  cuaLenh,
  laTruong,
  canEdit,
  onDong,
  onXong,
}: {
  row: TonRow
  cuaLenh: CuaLenh
  laTruong: boolean
  canEdit: boolean
  onDong: () => void
  /** Ghi xong — câu báo cho khung mã. */
  onXong: (cau: string) => void
}) {
  const router = useRouter()
  /* Khối mở ở dưới tồn + nút (~450px ở 1280×800): cuộn khung mã cho thấy TRỌN khối,
     kể cả nút Ghi — chỉ focus ô số thì nút Ghi nằm dưới mép (đo 28/10/2026). */
  const goc = useRef<HTMLFormElement>(null)
  useEffect(() => {
    goc.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])
  const [dong, setDong] = useState(() =>
    taoDong(
      { id: row.material_id, code: row.code, name: row.name, unit: row.unit },
      row.on_hand,
      cuaLenh.map((c) => ({ lsx_id: c.lsx_id, code: c.code, chia: c.qty })),
    ),
  )
  const [chu, setChu] = useState('')
  const [lyDo, setLyDo] = useState<MaLyDoCapNhat>('giao_kho')
  const [ghiChu, setGhiChu] = useState('')
  const [daThu, setDaThu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  const d = { ...dong, thuc_te: docSoThucTe(chu) }
  const dau: DauCapNhat = { ly_do_chung: lyDo, ghi_chu: ghiChu }
  const c = chenh(d)
  const loiKiem = kiemTruocGhi(dau, [d])
  const chan = !canEdit
    ? 'Tài khoản này không có quyền ghi kho'
    : loiKiem.length > 0
      ? cauMotMa(loiKiem[0].message)
      : c != null && Math.abs(c) < 1e-9
        ? 'Khớp với máy — không có gì để ghi'
        : null

  async function ghi() {
    setDaThu(true)
    setLoi(null)
    if (chan || busy) return
    setBusy(true)
    try {
      const r = await api<KetQua>('/api/dept/warehouse/cap-nhat-ton', {
        method: 'POST',
        body: thanGui(dau, [d]),
      })
      onXong(
        r.trang_thai === 'da_ghi'
          ? `Đã ghi ${r.doc_code}${r.xuat_bu.length > 0 ? ` và phiếu xuất bù ${r.xuat_bu.map((x) => `${x.code} cho ${x.lsx_code}`).join(', ')}` : ''} — tồn đã đổi.`
          : `Đã gửi ${r.code} — chờ trưởng kho duyệt, tồn chưa đổi.`,
      )
      router.refresh()
    } catch (e) {
      setLoi(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  const phim = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void ghi()
    } else if (e.key === 'Escape') onDong()
  }

  return (
    <form
      ref={goc}
      className="tm-cn"
      aria-label={`Cập nhật số thực tế ${row.code}`}
      onKeyDown={phim}
      onSubmit={(e) => {
        e.preventDefault()
        void ghi()
      }}
    >
      <div className="h">
        <b>Cập nhật số thực tế</b>
        <button type="button" className="kh-lnk" onClick={onDong}>
          Đóng
        </button>
      </div>
      <label className="o">
        <span>Đếm được ({row.unit})</span>
        <input
          // Mở khối là để gõ số — con trỏ vào ô ngay.
          autoFocus
          className="kh-o num"
          value={chu}
          onChange={(e) => {
            setChu(e.target.value)
            // Đổi số đếm thì máy chia lại phần xuất bù (bỏ số gõ tay cũ).
            if (dong.bu_go) setDong({ ...dong, bu_go: null })
          }}
          inputMode="decimal"
          autoComplete="off"
          placeholder="gõ số"
          aria-label={`Đếm được ${row.code}`}
        />
      </label>
      <div className="cn">
        Trên máy <b className="kh-num">{fmt(row.on_hand)}</b> · Chênh{' '}
        <b
          className={`kh-num ${c == null ? 'kh-mut' : c < 0 ? 'kh-stop' : c > 0 ? 'kh-ok' : ''}`}
        >
          {c == null ? '—' : `${c > 0 ? '+' : c < 0 ? '−' : ''}${fmt(Math.abs(c))}`}
        </b>
      </div>
      {hoiLenh(d) && (
        <HoiLenh
          r={d}
          onDoi={(p) => setDong({ ...dong, ...p })}
          ten={`cn-${row.material_id}`}
          idGoc={`cn-bu-${row.material_id}`}
          need={daThu && loiKiem.some((l) => BU_LOI.includes(l.reason))}
          busy={busy}
        />
      )}
      <label className="o">
        <span>Lý do</span>
        <select
          className="kh-o"
          value={lyDo}
          onChange={(e) => setLyDo(e.target.value as MaLyDoCapNhat)}
          aria-label={`Lý do ${row.code}`}
        >
          {LY_DO_CAP_NHAT.map((x) => (
            <option key={x.ma} value={x.ma}>
              {x.nhan}
            </option>
          ))}
        </select>
      </label>
      <label className="o">
        <span>Ghi chú</span>
        <input
          className="kh-o"
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          placeholder={lyDo === 'khac' ? 'bắt buộc khi lý do "Khác"' : 'không bắt buộc'}
          aria-label={`Ghi chú ${row.code}`}
        />
      </label>
      {(loi || chan) && (
        <p
          className={loi || daThu ? 'chan kh-stop' : 'chan kh-mut'}
          role={loi || daThu ? 'alert' : undefined}
        >
          {loi ? `Chưa ghi được: ${loi}` : chan}
        </p>
      )}
      <button
        type="submit"
        className="kh-btn p"
        aria-disabled={!!chan || busy || undefined}
      >
        {busy ? 'Đang ghi…' : laTruong ? 'Ghi — đổi tồn ngay' : 'Gửi trưởng kho duyệt'}
      </button>
      <p className="kh-mut">
        {laTruong
          ? 'Bạn là trưởng kho: ghi là đổi tồn ngay (phiếu kiểm kê, kèm phiếu xuất bù nếu có).'
          : 'Ghi xong chờ trưởng kho duyệt ở Kiểm kê — tồn chưa đổi.'}{' '}
        Enter hoặc Ctrl+Enter ghi · Esc đóng
      </p>
    </form>
  )
}
