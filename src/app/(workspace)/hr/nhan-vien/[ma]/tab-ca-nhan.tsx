'use client'

import { useState } from 'react'
import { Btn, DateInput, Pick, TextInput } from '@/components/kit'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import {
  hienSdt,
  QUAN_HE,
  TEN_GIOI_TINH,
  TRINH_DO,
  tuoi,
  type CaNhan,
  type GioiTinh,
} from '@/lib/nhan-su/ca-nhan'
import type { KhoiCaNhan } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { Dong, Khoi, LUOI } from './khoi-cong-viec'
import type { HoSoCtx } from './useHoSoNv'

const O = 'w-full border border-[var(--line)] px-1.5 py-0.5'

type Kieu = 'chu' | 'ngay' | 'gioi' | 'sdt' | 'cccd'
type O_ = {
  cot: string
  nhan: string
  kieu: Kieu
  goiY?: readonly string[]
  khoa: keyof CaNhan
}

/** Ô của từng khối — cùng tập với KHOI_CA_NHAN ở service. */
const KHOI: Record<KhoiCaNhan, { ten: string; o: O_[] }> = {
  ca_nhan: {
    ten: 'Cá nhân',
    o: [
      { cot: 'birth_date', nhan: 'Ngày sinh', kieu: 'ngay', khoa: 'ngaySinh' },
      { cot: 'gender', nhan: 'Giới tính', kieu: 'gioi', khoa: 'gioiTinh' },
      { cot: 'nationality', nhan: 'Quốc tịch', kieu: 'chu', khoa: 'quocTich' },
      { cot: 'hometown', nhan: 'Quê quán', kieu: 'chu', khoa: 'queQuan' },
      {
        cot: 'education',
        nhan: 'Trình độ',
        kieu: 'chu',
        goiY: TRINH_DO,
        khoa: 'trinhDo',
      },
    ],
  },
  dinh_danh: {
    ten: 'Định danh & địa chỉ',
    o: [
      { cot: 'national_id', nhan: 'Số CCCD', kieu: 'cccd', khoa: 'cccdChe' },
      { cot: 'id_issue_date', nhan: 'Ngày cấp', kieu: 'ngay', khoa: 'ngayCap' },
      { cot: 'id_issue_place', nhan: 'Nơi cấp', kieu: 'chu', khoa: 'noiCap' },
      { cot: 'permanent_address', nhan: 'Thường trú', kieu: 'chu', khoa: 'thuongTru' },
      { cot: 'current_address', nhan: 'Chỗ ở hiện tại', kieu: 'chu', khoa: 'choO' },
    ],
  },
  lien_he: {
    ten: 'Liên hệ',
    o: [
      { cot: 'phone', nhan: 'Điện thoại', kieu: 'sdt', khoa: 'dienThoai' },
      {
        cot: 'emergency_name',
        nhan: 'Liên hệ khẩn cấp',
        kieu: 'chu',
        khoa: 'khanCapTen',
      },
      {
        cot: 'emergency_relation',
        nhan: 'Quan hệ',
        kieu: 'chu',
        goiY: QUAN_HE,
        khoa: 'khanCapQuanHe',
      },
      { cot: 'emergency_phone', nhan: 'SĐT khẩn cấp', kieu: 'sdt', khoa: 'khanCapSdt' },
    ],
  },
}

/** Khoá xem: người không có quyền hr.employee.private (Q5 lượt 2). */
export function KhoaRieng({ viec }: { viec: string }) {
  return (
    <div className="text-k-sm flex items-start gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-5 text-[var(--ink-2)]">
      <span aria-hidden className="text-[18px]">
        🔒
      </span>
      <div>
        <b className="text-[var(--ink)]">{viec}</b>
        <br />
        Bạn vẫn xem được mã, họ tên, tổ, ca, chức danh. Cần thêm thì nhờ Phòng Nhân sự.
      </div>
    </div>
  )
}

export function TabCaNhan({ d }: { d: HoSoCtx }) {
  const c = d.h.caNhan
  if (!c)
    return (
      <KhoaRieng viec="Chỉ Phòng Nhân sự và Ban Giám đốc xem được thông tin cá nhân." />
    )
  return (
    <div className="grid min-h-0 grid-cols-2 overflow-auto max-[1100px]:grid-cols-1">
      {(Object.keys(KHOI) as KhoiCaNhan[]).map((k) =>
        d.suaCn === k ? (
          <SuaKhoi key={k} d={d} k={k} c={c} />
        ) : (
          <XemKhoi key={k} d={d} k={k} c={c} />
        ),
      )}
    </div>
  )
}

function giaXem(o: O_, c: CaNhan, homNay: string) {
  const v = c[o.khoa]
  if (!v) return <span className="text-[var(--warn)]">chưa có</span>
  if (o.kieu === 'ngay')
    return (
      <span className="num">
        {ngayVn(v)}
        {o.cot === 'birth_date' && (
          <span className="ml-2 text-[var(--ink-3)]">{tuoi(v, homNay)} tuổi</span>
        )}
      </span>
    )
  if (o.kieu === 'gioi') return TEN_GIOI_TINH[v as GioiTinh] ?? v
  if (o.kieu === 'sdt') return <span className="num">{hienSdt(v)}</span>
  return v
}

function XemKhoi({ d, k, c }: { d: HoSoCtx; k: KhoiCaNhan; c: CaNhan }) {
  return (
    <Khoi ten={KHOI[k].ten} sua={d.h.quyen.rieng && !d.suaCn} onSua={() => d.setSuaCn(k)}>
      <div className={LUOI}>
        {KHOI[k].o.map((o) => (
          <Dong key={o.cot} nhan={o.nhan}>
            {o.kieu === 'cccd' ? (
              c.cccdChe ? (
                <span className="num">
                  {d.cccd ?? c.cccdChe}
                  {d.cccd == null && (
                    <button
                      type="button"
                      onClick={d.hienCccd}
                      className="text-k-label ml-2 text-[var(--act-text)] underline"
                    >
                      Hiện (ghi nhật ký)
                    </button>
                  )}
                </span>
              ) : (
                <span className="text-[var(--warn)]">chưa có</span>
              )
            ) : (
              giaXem(o, c, d.homNay)
            )}
          </Dong>
        ))}
      </div>
    </Khoi>
  )
}

function SuaKhoi({ d, k, c }: { d: HoSoCtx; k: KhoiCaNhan; c: CaNhan }) {
  const [gia, setGia] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      KHOI[k].o.map((o) => [
        o.cot,
        o.kieu === 'cccd' ? '' : ((c[o.khoa] as string) ?? ''),
      ]),
    ),
  )
  const dat = (cot: string) => (v: string) => setGia((g) => ({ ...g, [cot]: v }))
  const cccdSo = (gia.national_id ?? '').replace(/\D/g, '')
  const loi =
    k === 'dinh_danh' && cccdSo && cccdSo.length !== 12 && cccdSo.length !== 9
      ? `CCCD có 12 chữ số, ô này mới có ${cccdSo.length}`
      : null
  async function luu() {
    if (loi) return
    const gui: Record<string, string | null> = {}
    for (const o of KHOI[k].o) {
      // CCCD bỏ trống = giữ số cũ, không gửi.
      if (o.kieu === 'cccd' && !gia[o.cot].trim()) continue
      gui[o.cot] = gia[o.cot].trim() || null
    }
    await d.luuCaNhan(k, gui)
  }
  return (
    <Khoi ten={KHOI[k].ten} dangSua>
      {KHOI[k].o.some((o) => o.goiY) &&
        KHOI[k].o
          .filter((o) => o.goiY)
          .map((o) => (
            <datalist key={o.cot} id={`goi-y-${o.cot}`}>
              {o.goiY!.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          ))}
      <div className={LUOI}>
        {KHOI[k].o.map((o) => (
          <Dong key={o.cot} nhan={o.nhan}>
            {o.kieu === 'ngay' ? (
              <DateInput label={o.nhan} value={gia[o.cot]} onChange={dat(o.cot)} />
            ) : o.kieu === 'gioi' ? (
              <Pick
                label={o.nhan}
                width={140}
                value={gia[o.cot]}
                onChange={dat(o.cot)}
                options={[
                  { value: '', label: '—' },
                  { value: 'male', label: 'Nam' },
                  { value: 'female', label: 'Nữ' },
                ]}
              />
            ) : (
              <TextInput
                label={o.nhan}
                value={gia[o.cot]}
                onCommit={dat(o.cot)}
                className={O}
                mono={o.kieu === 'cccd' || o.kieu === 'sdt'}
                list={o.goiY ? `goi-y-${o.cot}` : undefined}
                placeholder={
                  o.kieu === 'cccd'
                    ? c.cccdChe
                      ? `bỏ trống = giữ số cũ (${c.cccdChe})`
                      : '12 chữ số'
                    : o.kieu === 'sdt'
                      ? '09xx xxx xxx'
                      : o.cot === 'nationality'
                        ? 'Việt Nam'
                        : ''
                }
              />
            )}
          </Dong>
        ))}
      </div>
      {loi && <p className="text-k-sm mt-2 text-[var(--stop)]">{loi}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <Btn onClick={() => d.setSuaCn(null)}>Huỷ</Btn>
        <Btn primary icon="tick" busy={d.busy} aria-disabled={!!loi} onClick={luu}>
          Lưu khối {KHOI[k].ten}
        </Btn>
      </div>
      {loi && (
        <p className="text-k-label mt-1 text-right text-[var(--ink-3)]">
          Lưu bị khoá tới khi sửa ô CCCD. Các khối khác vẫn ở chế độ xem.
        </p>
      )}
    </Khoi>
  )
}
