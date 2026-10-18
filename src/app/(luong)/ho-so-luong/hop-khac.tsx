'use client'

import { useState } from 'react'
import {
  Btn,
  Consequence,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  TextInput,
  Tick,
} from '@/components/kit'
import type { HoSoLuongCtx } from './useHoSoLuong'
import { congKy, docTien, kyVn } from './luong.shared'

/** Đặt một đơn giá cho cả tổ — mặc định chỉ người chưa có đơn giá ở kỳ đó. */
export function HopDonGiaTo({ d }: { d: HoSoLuongCtx }) {
  const kyMoi =
    d.h.kyChotCuoi && d.h.thang <= d.h.kyChotCuoi ? congKy(d.h.kyChotCuoi, 1) : d.h.thang
  const [to, setTo] = useState(d.h.to[0] ?? '')
  const [tuKy, setTuKy] = useState(kyMoi)
  const [donGia, setDonGia] = useState('')
  const [ghiDe, setGhiDe] = useState(false)
  const nguoi = d.h.dong.filter((x) => x.to === to)
  const daCo = nguoi.filter(
    (x) => x.ban?.cachTra === 'daily' && x.ban.donGia != null,
  ).length
  const theoThang = nguoi.filter((x) => x.ban?.cachTra === 'monthly').length
  const so = docTien(donGia)
  const se = nguoi.length - theoThang - (ghiDe ? 0 : daCo)

  async function dat() {
    if (!so) return
    const r = await d.goi<{ so: number }>('to', {
      viec: 'don_gia_to',
      to,
      tuKy,
      donGia: so,
      ghiDe,
    })
    if (r) {
      d.setSheet(null)
      await d.sauGhi()
    }
  }
  return (
    <Sheet
      open={d.sheet === 'to'}
      onClose={() => d.setSheet(null)}
      title="Đặt đơn giá cho cả tổ"
      subtitle={`${nguoi.length} người · áp từ kỳ ${kyVn(tuKy)}`}
      stakes="vua"
      footer={
        <SheetActions
          stakes="vua"
          onCancel={() => d.setSheet(null)}
          onConfirm={dat}
          confirmLabel={`Đặt cho ${se} người`}
          cancelLabel="Để sau"
          busy={d.busy === 'to'}
        />
      }
    >
      <div className="text-k-sm grid grid-cols-[130px_1fr] items-center gap-x-2 gap-y-2">
        <span className="text-[var(--ink-3)]">Tổ</span>
        <Pick
          label="Tổ"
          width={260}
          value={to}
          onChange={setTo}
          options={d.h.to.map((t) => ({ value: t, label: t }))}
        />
        <span className="text-[var(--ink-3)]">Áp từ kỳ</span>
        <Pick
          label="Áp từ kỳ"
          width={160}
          value={tuKy}
          onChange={setTuKy}
          options={[0, 1, 2].map((n) => {
            const k = congKy(kyMoi, n)
            return { value: k, label: `Kỳ ${kyVn(k)}` }
          })}
        />
        <span className="text-[var(--ink-3)]">Đơn giá / công</span>
        <NumInput
          aria-label="Đơn giá một công"
          value={donGia}
          onCommit={setDonGia}
          className="w-36 border border-[var(--line)] px-1.5 py-0.5"
        />
      </div>
      <div className="mt-2">
        <Tick
          label={`Ghi đè cả ${daCo} người đã có đơn giá riêng`}
          checked={ghiDe}
          onChange={setGhiDe}
        />
      </div>
      <Consequence>
        Tạo {se} bản hồ sơ “từ kỳ {kyVn(tuKy)}” (giữ lương BH, phụ cấp, người phụ thuộc
        của bản đang có).{' '}
        {theoThang ? `${theoThang} người trả theo tháng không đổi. ` : ''}Bản của kỳ trước
        giữ nguyên.
        {!so && ' — nhập đơn giá trước.'}
      </Consequence>
    </Sheet>
  )
}

/** Danh mục phụ cấp: Kế toán thêm, đổi tên, bật / tắt, đánh dấu tính BH / chịu thuế. */
export function HopPhuCap({ d }: { d: HoSoLuongCtx }) {
  const [moi, setMoi] = useState('')
  const luu = (v: {
    id?: string
    ten: string
    tinhBh: boolean
    chiuThue: boolean
    dangDung: boolean
  }) =>
    d
      .goi('pc', { viec: 'phu_cap', ...v }, 'Đã lưu danh mục phụ cấp')
      .then((r) => r && d.sauGhi())
  return (
    <Sheet
      open={d.sheet === 'phu_cap'}
      onClose={() => d.setSheet(null)}
      title="Danh mục phụ cấp"
      subtitle="Khoản cố định theo tháng; số tiền từng người nhập ở hồ sơ"
      stakes="nhe"
    >
      <ul className="text-k-sm m-0 list-none space-y-2 p-0">
        {d.h.loaiPhuCap.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--line-faint)] pb-2"
          >
            <span className="w-44">
              <TextInput
                label={`Tên ${l.ten}`}
                value={l.ten}
                onCommit={(t) => t.trim() && t !== l.ten && luu({ ...l, ten: t.trim() })}
              />
            </span>
            <Tick
              label="Tính BH"
              checked={l.tinhBh}
              onChange={(v) => luu({ ...l, tinhBh: v })}
            />
            <Tick
              label="Chịu thuế"
              checked={l.chiuThue}
              onChange={(v) => luu({ ...l, chiuThue: v })}
            />
            <Tick
              label="Đang dùng"
              checked={l.dangDung}
              onChange={(v) => luu({ ...l, dangDung: v })}
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <span className="w-44">
          <TextInput
            label="Tên phụ cấp mới"
            value={moi}
            onCommit={setMoi}
            placeholder="Phụ cấp mới"
          />
        </span>
        <Btn
          icon="them"
          busy={d.busy === 'pc'}
          onClick={async () => {
            if (!moi.trim()) return
            await luu({ ten: moi.trim(), tinhBh: false, chiuThue: true, dangDung: true })
            setMoi('')
          }}
        >
          Thêm
        </Btn>
      </div>
    </Sheet>
  )
}
