'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Btn, DateInput, Pick, TextInput, Tick } from '@/components/kit'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import { thamNien } from '@/lib/nhan-su/ho-so'
import { dm } from '../../cham-cong/ky-cong.shared'
import type { HoSoCtx } from './useHoSoNv'

const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'

/** Khung một khối: tiêu đề + bút chì (sửa theo khối — bản vẽ lượt 2, Q2). */
export function Khoi({
  ten,
  sua,
  dangSua,
  onSua,
  children,
}: {
  ten: string
  sua?: boolean
  dangSua?: boolean
  onSua?: () => void
  children: ReactNode
}) {
  return (
    <section
      aria-label={ten}
      className={
        dangSua
          ? 'border-b border-[var(--act-line)] bg-[var(--act-wash)] px-[var(--gutter)] py-2.5'
          : 'border-b border-[var(--line)] px-[var(--gutter)] py-2.5'
      }
    >
      <div className="text-k-label mb-2 flex items-center font-semibold tracking-[.05em] text-[var(--ink-3)] uppercase">
        {ten}
        {dangSua && <span className="ml-2 tracking-normal normal-case">· đang sửa</span>}
        {sua && !dangSua && onSua && (
          <button
            type="button"
            onClick={onSua}
            className="ml-auto font-medium tracking-normal text-[var(--act-text)] normal-case hover:underline"
          >
            ✎ Sửa
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

export function Dong({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <>
      <span className="text-[var(--ink-3)]">{nhan}</span>
      <div className="min-w-0">{children}</div>
    </>
  )
}
export const LUOI =
  'text-k-sm grid grid-cols-[140px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5'
const Thieu = () => <span className="text-[var(--warn)]">chưa có</span>

/** Khối Công việc — xem, hoặc sửa tại chỗ (sửa dữ liệu; chuyển tổ thật thì qua Biến động). */
export function KhoiCongViec({ d }: { d: HoSoCtx }) {
  const { n, h } = d
  const ca = h.cas.find((c) => c.id === n.shiftId)
  if (d.suaCv) return <SuaCongViec d={d} />
  return (
    <Khoi ten="Công việc" sua={h.quyen.sua && n.active} onSua={() => d.setSuaCv(true)}>
      <div className={LUOI}>
        <Dong nhan="Mã nhân viên">
          <b className="num">{n.code}</b>
        </Dong>
        <Dong nhan="Họ tên">
          {n.hoTen}
          {n.tenTuMay && (
            <span className="text-k-label ml-2 text-[var(--warn)]">tên lấy từ máy</span>
          )}
        </Dong>
        <Dong nhan="Tổ">{n.boPhan ?? <Thieu />}</Dong>
        <Dong nhan="Chức danh">{n.chucDanh ?? <Thieu />}</Dong>
        <Dong nhan="Ngày vào làm">
          {n.ngayVao ? (
            <span className="num">
              {ngayVn(n.ngayVao)}
              <span className="ml-2 text-[var(--ink-3)]">
                {thamNien(n.ngayVao, d.homNay) ?? ''}
              </span>
            </span>
          ) : (
            <Thieu />
          )}
        </Dong>
        <Dong nhan="Ca thường làm">{ca ? `${ca.ten} ${ca.gio}` : '—'}</Dong>
      </div>
    </Khoi>
  )
}

function SuaCongViec({ d }: { d: HoSoCtx }) {
  const { n, h } = d
  const [ten, setTen] = useState(n.tenTuMay ? '' : n.hoTen)
  const [to, setTo] = useState(n.boPhan ?? '')
  const [cd, setCd] = useState(n.chucDanh ?? '')
  const [ngay, setNgay] = useState(n.ngayVao ?? '')
  const [ca, setCa] = useState(n.shiftId)
  const [khong, setKhong] = useState(n.khongChamCong)
  const loi = ten.trim().length < 2 ? 'Gõ họ tên đầy đủ' : null
  return (
    <Khoi ten="Công việc" dangSua>
      <div className={LUOI}>
        <Dong nhan="Họ tên">
          <TextInput
            label="Họ tên"
            value={ten}
            onCommit={setTen}
            className={O}
            placeholder={n.tenTuMay ? `máy ghi: ${n.hoTen}` : ''}
            autoFocus
          />
        </Dong>
        <Dong nhan="Tổ">
          <TextInput
            label="Tổ"
            value={to}
            onCommit={setTo}
            className={O}
            list="hr-bo-phan"
          />
        </Dong>
        <Dong nhan="Chức danh">
          <TextInput
            label="Chức danh"
            value={cd}
            onCommit={setCd}
            className={O}
            list="hr-chuc-danh"
          />
        </Dong>
        <Dong nhan="Ngày vào làm">
          <DateInput label="Ngày vào làm" value={ngay} onChange={setNgay} />
        </Dong>
        <Dong nhan="Ca thường làm">
          <Pick
            label="Ca thường làm"
            width={240}
            value={ca}
            onChange={setCa}
            options={h.cas.map((c) => ({ value: c.id, label: `${c.ten} ${c.gio}` }))}
          />
        </Dong>
        <Dong nhan="Chấm công">
          <span className="flex items-center gap-1.5">
            <Tick checked={khong} onChange={setKhong} label="Không chấm công" />
            Không chấm công (không quẹt máy, không bị tính thiếu công)
          </span>
        </Dong>
      </div>
      {loi && <p className="text-k-sm mt-2 text-[var(--stop)]">{loi}</p>}
      <p className="text-k-label mt-2 text-[var(--ink-3)]">
        Sửa ở đây là chữa dữ liệu (gõ sai, điền thiếu). Người thật sự chuyển tổ / đổi chức
        danh thì dùng Biến động › Chuyển tổ / chức danh để có ngày hiệu lực trong lịch sử.
      </p>
      <div className="mt-2 flex justify-end gap-2">
        <Btn onClick={() => d.setSuaCv(false)}>Huỷ</Btn>
        <Btn
          primary
          icon="tick"
          busy={d.busy}
          aria-disabled={!!loi}
          onClick={() =>
            !loi &&
            d.luuCongViec({
              full_name: ten.trim(),
              team: to.trim(),
              job_title: cd.trim(),
              shift_id: ca,
              attendance_exempt: khong,
              ngayVao: ngay,
            })
          }
        >
          Lưu khối Công việc
        </Btn>
      </div>
    </Khoi>
  )
}

/** Khối Chấm công — chỉ xem; mã máy sửa ở Chấm công › Mã trên máy & ca. */
export function KhoiChamCong({ d }: { d: HoSoCtx }) {
  const { n } = d
  return (
    <Khoi ten="Chấm công">
      <div className={LUOI}>
        <Dong nhan="Chấm công">{n.khongChamCong ? 'không chấm công' : 'quẹt máy'}</Dong>
        <Dong nhan="Mã trên máy">
          {n.ma.length ? (
            <span className="num">{n.ma.map((m) => `${m.may} ${m.ma}`).join(' · ')}</span>
          ) : n.khongChamCong ? (
            '—'
          ) : (
            <span className="text-[var(--warn)]">chưa ghép mã nào</span>
          )}
          <Link
            href="/hr/cham-cong/ma-may"
            className="text-k-label ml-2 text-[var(--act-text)] underline"
          >
            sửa ở Mã trên máy &amp; ca
          </Link>
        </Dong>
        <Dong nhan="Quẹt gần nhất">
          <span className="num">{n.lanCuoi ? dm(n.lanCuoi) : '—'}</span>
          <span className="text-k-label ml-2 text-[var(--ink-3)]">trong 45 ngày</span>
        </Dong>
      </div>
    </Khoi>
  )
}
