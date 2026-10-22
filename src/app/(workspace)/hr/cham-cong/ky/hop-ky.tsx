'use client'

import { useState } from 'react'
import { Consequence, Sheet, SheetActions, TextArea, Tick } from '@/components/kit'
import type { KyCongCtx } from './useKyCong'
import { so } from './ky.shared'

const kyVn = (t: string) => `${t.slice(5)}/${t.slice(0, 4)}`
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function HopChot({ d }: { d: KyCongCtx }) {
  const { k } = d
  const ngay0 = k.to.reduce((s, t) => s + (t.xacNhan?.ngay0 ?? 0), 0)
  return (
    <Sheet
      open={d.sheet === 'chot'}
      onClose={() => d.setSheet(null)}
      title={`Chốt kỳ ${kyVn(k.thang)}?`}
      subtitle={`${dm(k.tu)} → ${dm(k.den)}/${k.den.slice(0, 4)} · ${k.nguoi.length} người · Bản cách tính ${k.ban ?? 'mặc định'}`}
      stakes="vua"
      footer={
        <SheetActions
          stakes="vua"
          onCancel={() => d.setSheet(null)}
          onConfirm={d.chot}
          confirmLabel="Chốt kỳ"
          cancelLabel="Để sau"
          busy={d.busy === 'chot'}
        />
      }
    >
      <ul className="text-k-sm m-0 list-none space-y-1 p-0">
        {k.dieuKien.map((x) => (
          <li key={x.ma} className="flex gap-2">
            <span
              className={
                x.ok ? 'font-bold text-[var(--done)]' : 'font-bold text-[var(--stop)]'
              }
            >
              {x.ok ? '✓' : '✗'}
            </span>
            {x.ten} — {x.chiTiet}
          </li>
        ))}
      </ul>
      <Consequence>
        Lưu bản chốt{' '}
        {so(Math.round(k.nguoi.reduce((s, n) => s + n.cong, 0) * 100) / 100, 2)} công
        {ngay0 ? ` (gồm ${ngay0} ngày thiếu lượt tính 0 giờ)` : ''} và{' '}
        {k.khongCham.length} người không chấm công. Từ giờ phiếu điều chỉnh và tick làm
        trưa cho ngày {dm(k.tu)} → {dm(k.den)} bị chặn; Bảng công kỳ này chỉ đọc bản chốt.
        Mở lại phải được Kế toán trưởng duyệt.
      </Consequence>
    </Sheet>
  )
}

export function HopXacNhan({ d }: { d: KyCongCtx }) {
  const { k } = d
  const ten = d.sheet && typeof d.sheet === 'object' ? d.sheet.xacNhan : null
  const t = ten ? k.to.find((x) => x.ten === ten) : null
  const [daKy, setDaKy] = useState(false)
  const [dongY0, setDongY0] = useState(false)
  const thieu = t ? k.nguoi.filter((n) => n.to === t.ten && n.thieu > 0) : []
  const chan = !daKy || (!!t?.thieu && !dongY0)
  return (
    <Sheet
      open={!!t}
      onClose={() => d.setSheet(null)}
      title={`Xác nhận ${t?.ten ?? ''} · kỳ ${kyVn(k.thang)}`}
      subtitle={
        t
          ? `${t.so} người · ${so(t.phut / 60, 2)} giờ · ${so(t.cong, 2)} công`
          : undefined
      }
      stakes="nhe"
      footer={
        <SheetActions
          stakes="nhe"
          onCancel={() => d.setSheet(null)}
          onConfirm={() => t && !chan && d.xacNhan(t.ten, dongY0)}
          confirmLabel="Xác nhận tổ"
          cancelLabel="Để sau"
          busy={d.busy === 'xn'}
        />
      }
    >
      <Tick
        label="Đã thu đủ phiếu xác nhận công có chữ ký của cả tổ"
        checked={daKy}
        onChange={setDaKy}
      />
      {t && t.thieu > 0 && (
        <>
          <Consequence>
            Còn <b>{t.thieu} ngày thiếu lượt</b>:{' '}
            {thieu
              .slice(0, 6)
              .map((n) => `${n.ma} ${n.ten} (${n.thieu})`)
              .join(', ')}
            {thieu.length > 6 ? ` và ${thieu.length - 6} người nữa` : ''}. Xác nhận nghĩa
            là những ngày này tính <b>0 giờ</b>.
          </Consequence>
          <Tick
            label={`Đồng ý tính 0 giờ cho ${t.thieu} ngày trên`}
            checked={dongY0}
            onChange={setDongY0}
          />
        </>
      )}
      {chan && (
        <p className="text-k-sm mt-2 text-[var(--ink-3)]">
          {!daKy
            ? 'Tích "đã thu đủ phiếu" để xác nhận.'
            : 'Tích "đồng ý tính 0 giờ" hoặc bổ sung giờ trước.'}
        </p>
      )}
    </Sheet>
  )
}

export function HopXin({ d }: { d: KyCongCtx }) {
  const { k } = d
  const [lyDo, setLyDo] = useState('')
  return (
    <Sheet
      open={d.sheet === 'xin'}
      onClose={() => d.setSheet(null)}
      title={`Xin mở lại kỳ ${kyVn(k.thang)}?`}
      subtitle="Kế toán trưởng duyệt mới mở; trong lúc chờ kỳ vẫn khoá"
      stakes="vua"
      footer={
        <SheetActions
          stakes="vua"
          onCancel={() => d.setSheet(null)}
          onConfirm={() => lyDo.trim().length >= 5 && d.xinMo(lyDo.trim())}
          confirmLabel="Gửi yêu cầu"
          cancelLabel="Để sau"
          busy={d.busy === 'xin'}
        />
      }
    >
      <label className="text-k-sm mb-1 block font-semibold" htmlFor="ky-ly-do">
        Lý do mở lại (bắt buộc)
      </label>
      <TextArea
        id="ky-ly-do"
        aria-label="Lý do mở lại"
        value={lyDo}
        onChange={setLyDo}
        rows={3}
        placeholder="Ví dụ: Tổ Phôi nộp bù 3 phiếu bổ sung giờ ngày 24–25/10"
      />
      <Consequence>
        Mở lại thì bản chốt lần {k.ky?.lanChot} được giữ làm lịch sử; chốt lại sẽ thành
        lần {(k.ky?.lanChot ?? 0) + 1}. Nếu lương kỳ này đã trả thì đừng mở lại — ghi
        khoản chênh vào bảng lương kỳ sau.
      </Consequence>
    </Sheet>
  )
}

export function HopQuyet({ d }: { d: KyCongCtx }) {
  const { k } = d
  const [ghiChu, setGhiChu] = useState('')
  return (
    <Sheet
      open={d.sheet === 'quyet'}
      onClose={() => d.setSheet(null)}
      title={`Mở lại kỳ ${kyVn(k.thang)}?`}
      subtitle={`${k.ky?.xinBoi ?? '—'} xin: “${k.ky?.xinLyDo ?? ''}”`}
      stakes="vua"
      footer={
        <SheetActions
          stakes="vua"
          onCancel={() => d.quyetMo(false, ghiChu.trim() || undefined)}
          onConfirm={() => d.quyetMo(true, ghiChu.trim() || undefined)}
          confirmLabel="Duyệt mở lại"
          cancelLabel="Từ chối"
          busy={d.busy === 'quyet'}
        />
      }
    >
      <label className="text-k-sm mb-1 block font-semibold" htmlFor="ky-ghi-chu">
        Ghi chú (không bắt buộc)
      </label>
      <TextArea
        id="ky-ghi-chu"
        aria-label="Ghi chú"
        value={ghiChu}
        onChange={setGhiChu}
        rows={2}
      />
      <Consequence>
        Duyệt: kỳ về Đang mở, Nhân sự sửa được rồi chốt lại. Từ chối: kỳ vẫn Đã chốt, bản
        chốt lần {k.ky?.lanChot} giữ nguyên.
      </Consequence>
    </Sheet>
  )
}
