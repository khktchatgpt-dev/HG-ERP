'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Consequence,
  DateInput,
  Pick,
  Sheet,
  SheetActions,
  TextInput,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import { maKccTiep, ngayVn } from '@/lib/nhan-su/bien-dong'
import type { DsCtx } from './useNhanVienDs'

const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'

/**
 * Tuyển vào — hộp ngắn, đủ để có mặt trong kỳ công; lưu xong mở thẳng hồ sơ mới để điền
 * tiếp (bản vẽ lượt 2, mục 7). Người không quẹt máy được tự cấp mã KCC-NNN (Q3 lượt 1).
 */
export function HopTuyen({ d }: { d: DsCtx }) {
  const router = useRouter()
  const toast = useToast()
  const nv = d.h.nv
  const [khongCham, setKhongCham] = useState(false)
  const [ma, setMa] = useState('')
  const [ten, setTen] = useState('')
  const [ngay, setNgay] = useState(d.h.homNay)
  const [to, setTo] = useState('')
  const [cd, setCd] = useState('')
  const [ca, setCa] = useState(nv.cas[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const kcc = maKccTiep(nv.ds.map((n) => n.code))
  const chucDanh = [
    ...new Set(nv.ds.map((n) => n.chucDanh).filter((t): t is string => !!t)),
  ].sort((a, b) => a.localeCompare(b, 'vi'))

  const loi =
    !khongCham && !/^\d{1,9}$/.test(ma.trim())
      ? 'Nhập mã số trên máy chấm công, hoặc chọn "Không chấm công"'
      : ten.trim().length < 2
        ? 'Nhập họ tên đầy đủ'
        : !ngay
          ? 'Chọn ngày vào làm'
          : null

  async function luu() {
    if (loi || busy) return
    setBusy(true)
    try {
      const r = await api<{ id: string; code: string }>(
        '/api/dept/hr/cham-cong/nhan-vien',
        {
          method: 'POST',
          body: {
            khong_cham: khongCham,
            ...(!khongCham && { code: ma.trim() }),
            full_name: ten.trim(),
            hire_date: ngay,
            team: to.trim(),
            shift_id: ca,
            job_title: cd.trim(),
          },
        },
      )
      toast.success(`Đã tuyển ${ten.trim()} · mã ${r.code}`)
      router.push(`/hr/nhan-vien/${encodeURIComponent(r.code)}`)
    } catch (e) {
      toast.error('Chưa tuyển được', apiErrorText(e))
      setBusy(false)
    }
  }

  const nut = (on: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'text-k-sm border px-2 py-0.5',
        on
          ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
          : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-hover)]',
      )}
    >
      {label}
    </button>
  )

  return (
    <Sheet
      open
      onClose={() => d.setMoTuyen(false)}
      title="Tuyển vào"
      subtitle="Đủ để có mặt trong kỳ công — thông tin khác điền trên hồ sơ"
      stakes="vua"
      footer={
        <SheetActions
          onCancel={() => d.setMoTuyen(false)}
          onConfirm={luu}
          cancelLabel="Để sau"
          confirmLabel="Tuyển vào và mở hồ sơ"
          disabled={!!loi}
          busy={busy}
        />
      }
    >
      <datalist id="nv-ds-to">
        {nv.boPhan.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <datalist id="nv-ds-cd">
        {chucDanh.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <div className="text-k-sm grid grid-cols-[130px_1fr] items-center gap-x-2 gap-y-2">
        <span className="text-[var(--ink-3)]">Chấm công</span>
        <span className="flex gap-1.5">
          {nut(!khongCham, 'Quẹt máy', () => setKhongCham(false))}
          {nut(khongCham, 'Không chấm công', () => setKhongCham(true))}
        </span>
        <span className="text-[var(--ink-3)]">Mã nhân viên</span>
        {khongCham ? (
          <span>
            tự cấp <b className="num">{kcc}</b>
          </span>
        ) : (
          <TextInput
            label="Mã trên máy"
            value={ma}
            onCommit={setMa}
            className={O}
            mono
            placeholder="số trên máy, vd 604"
          />
        )}
        <span className="text-[var(--ink-3)]">Họ tên</span>
        <TextInput
          label="Họ tên"
          value={ten}
          onCommit={setTen}
          className={O}
          placeholder="vd Nguyễn Văn An"
        />
        <span className="text-[var(--ink-3)]">Ngày vào làm</span>
        <DateInput label="Ngày vào làm" value={ngay} onChange={setNgay} />
        <span className="text-[var(--ink-3)]">Tổ</span>
        <TextInput
          label="Tổ"
          value={to}
          onCommit={setTo}
          className={O}
          list="nv-ds-to"
          placeholder="gõ hoặc chọn"
        />
        <span className="text-[var(--ink-3)]">Chức danh</span>
        <TextInput
          label="Chức danh"
          value={cd}
          onCommit={setCd}
          className={O}
          list="nv-ds-cd"
          placeholder="gõ hoặc chọn"
        />
        <span className="text-[var(--ink-3)]">Ca thường làm</span>
        <Pick
          label="Ca thường làm"
          width={240}
          value={ca}
          onChange={setCa}
          options={nv.cas.map((c) => ({ value: c.id, label: `${c.ten} ${c.gio}` }))}
        />
      </div>
      {loi && <p className="text-k-sm mt-2 text-[var(--ink-2)]">Còn thiếu: {loi}.</p>}
      <Consequence>
        {ten.trim() || 'Người mới'} có mặt trong kỳ công từ {ngayVn(ngay || null)}
        {khongCham ? ', không bị tính thiếu công vì không quẹt máy' : ''}. Lưu xong mở hồ
        sơ để điền tiếp; người có mã chưa ghép trên máy thì ghép ở Chấm công › Mã trên máy
        &amp; ca.
      </Consequence>
    </Sheet>
  )
}
