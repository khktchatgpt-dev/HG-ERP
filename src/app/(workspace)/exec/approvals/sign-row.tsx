'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import {
  LOAI_PHIEU,
  kyNhanhDuoc,
  vungGap,
  type KhaiLoai,
  type LoaiPhieu,
} from '@/lib/loai-phieu-duyet'
import { materialSummary } from '@/lib/po-list-labels'
import type { SignItem } from '@/modules/core/exec/exec.service'
import { money } from '../approval-helpers'
import { LOP_MAU, dm } from './hop-ky.shared'

/**
 * BỘ CỘT CỦA HỘP KÝ theo bề rộng KHUNG LƯỚI (đo bằng `useBeRong`, không đo cửa
 * sổ — 14/10/2026). Ảnh chủ dự án ở laptop phóng 125%: khung 980px, 9 cột cố
 * định chiếm 928px → "Nội dung" còn ~50px, mọi ô bị cắt ("NỘI DUI", "k…",
 * "233.095.541 V…", "hôm n…").
 *
 *  · RỘNG (≥ 1440px — Nội dung còn ≥ 380px): đủ 10 cột.
 *  · VỪA (840–1440px): bỏ cột Loại / Lệnh / Người trình — màu loại thành ô vuông
 *    trước mã phiếu; lệnh + người trình xuống DÒNG HAI của ô Nội dung (không mất
 *    thông tin, chỉ đổi chỗ).
 *  · HẸP (< 840px): danh sách nhóm (`hop-ky-hep.tsx`), không dùng lưới.
 */
export type CotKey =
  | 'chon'
  | 'loai'
  | 'ma'
  | 'doiTac'
  | 'noiDung'
  | 'boiCanh'
  | 'hen'
  | 'nguoi'
  | 'giaTri'
  | 'cho'

export type Cot = { key: CotKey; w?: number; r?: boolean; nhan: string }

const COT_RONG: Cot[] = [
  { key: 'chon', w: 34, nhan: '' },
  { key: 'loai', w: 112, nhan: 'Loại' },
  { key: 'ma', w: 136, nhan: 'Mã phiếu' },
  { key: 'doiTac', w: 160, nhan: 'Đối tác / người' },
  { key: 'noiDung', nhan: 'Nội dung' },
  { key: 'boiCanh', w: 160, nhan: 'Lệnh / ngữ cảnh' },
  { key: 'hen', w: 92, r: true, nhan: 'Hẹn' },
  { key: 'nguoi', w: 140, nhan: 'Người trình' },
  { key: 'giaTri', w: 146, r: true, nhan: 'Giá trị' },
  { key: 'cho', w: 76, r: true, nhan: 'Chờ' },
]
const COT_VUA: Cot[] = COT_RONG.filter(
  (c) => c.key !== 'loai' && c.key !== 'boiCanh' && c.key !== 'nguoi',
).map((c) =>
  c.key === 'ma' ? { ...c, w: 144 } : c.key === 'doiTac' ? { ...c, w: 140 } : c,
)

/**
 * Bộ cột của lưới. `loai` = lưới đang bày ĐÚNG MỘT loại phiếu (tab phòng chỉ có
 * một loại) → tiêu đề cột là cột THẬT của loại đó (Nhà cung cấp, Mua gì…), bỏ cột
 * "Loại" thừa và cột ngữ cảnh khi loại không có (lệnh SX, báo giá).
 */
export function cotHopKy(rong: boolean, loai?: LoaiPhieu | null): Cot[] {
  const goc = rong ? COT_RONG : COT_VUA
  if (!loai) return goc
  const khai = LOAI_PHIEU[loai]
  return goc
    .filter((c) => c.key !== 'loai' && !(c.key === 'boiCanh' && khai.cot.boiCanh === '—'))
    .map((c) => ({ ...c, nhan: c.key === 'ma' ? 'Mã phiếu' : nhanTheoLoai(c.key, khai) }))
}

/** Nhãn cột của MỘT KHỐI — nghĩa của cột theo loại phiếu. */
function nhanTheoLoai(k: CotKey, khai: KhaiLoai): string {
  const c = khai.cot
  switch (k) {
    case 'chon':
    case 'loai':
      return ''
    case 'ma':
      return 'Mã'
    case 'doiTac':
      return c.doiTac
    case 'noiDung':
      return c.noiDung
    case 'boiCanh':
      return c.boiCanh
    case 'hen':
      return c.hen
    case 'nguoi':
      return 'Người trình'
    case 'giaTri':
      return c.giaTri
    case 'cho':
      return 'Chờ'
  }
}

/**
 * Một phiếu trong Hộp ký — cột NGHĨA THEO LOẠI: đơn mua bày NCC · mua gì · lệnh
 * · hẹn giao; đề nghị mua bày bộ phận · số dòng + lưu ý · cần trước; lệnh SX bày
 * khách · đơn · giao. `trongGap` = dòng ở khối "Cần ký trước": câu vì sao gấp
 * đứng đầu ô nội dung, không ô tích (ký nhanh chỉ trong khối cùng loại — Q26).
 */
export function SignRow({
  i,
  today,
  cot,
  selected,
  checked,
  onPick,
  onToggle,
  trongGap = false,
}: {
  i: SignItem
  today: string
  /** Bộ cột đang bày (`cotHopKy`) — ô nào không có cột thì xuống dòng hai của Nội dung. */
  cot: Cot[]
  selected: boolean
  checked: boolean
  onPick: () => void
  onToggle: () => void
  trongGap?: boolean
}) {
  const khai = LOAI_PHIEU[i.kind]
  const co = (k: CotKey) => cot.some((c) => c.key === k)
  const coLoai = co('loai')
  const coBoiCanh = co('boiCanh')
  const coNguoi = co('nguoi')
  /* Câu vì sao gấp đứng đầu ô Nội dung — ở khối "Cần ký trước" lẫn trong tab phòng
     (phiếu gấp xếp lên đầu khối của nó). */
  const gap = vungGap(i)
  const nhanh = kyNhanhDuoc(i)
  const khoaVi = i.late_sign
    ? 'Đơn gửi gấp — mở ra đọc lý do rồi ký bù'
    : i.big
      ? 'Giá trị lớn — mở ra đọc rồi ký riêng, không ký hàng loạt'
      : `${khai.ten} — mở ra đọc rồi ký riêng`
  const ngCanh =
    i.kind === 'po' ? (i.po?.lsx_code ?? i.po?.ngoai_lenh ?? 'Ngoài lệnh') : (i.boi_canh ?? null) // prettier-ignore
  const choCls =
    i.waiting_days >= 7 || (i.po?.eta_late_days ?? 0) > 0
      ? 'r hk-late'
      : i.waiting_days >= 3
        ? 'r hk-warn'
        : 'r'
  const tien = i.value > 0 ? money(i.value, i.currency) : '—'
  /* Cột nào không có (bộ cột vừa) thì lệnh / người trình xuống dòng hai của ô Nội dung. */
  const dong2 = [!coBoiCanh && ngCanh && ngCanh !== '—' ? ngCanh : null, !coNguoi ? i.owner_name : null].filter(Boolean).join(' · ') || null // prettier-ignore
  return (
    <tr className={selected ? 'd on' : 'd'} onClick={onPick} aria-selected={selected}>
      <td onClick={(e) => e.stopPropagation()}>
        {trongGap ? null : nhanh ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Chọn phiếu ${i.code} để ký nhanh`}
          />
        ) : (
          <span className="hk-mut" title={khoaVi} style={{ display: 'inline-flex' }}>
            <Lock size={13} aria-label={khoaVi} />
          </span>
        )}
      </td>
      {coLoai && (
        <td className={LOP_MAU[i.kind]}>
          <span className="hk-loai">
            <i aria-hidden />
            {khai.nhan}
          </span>
        </td>
      )}
      <td title={`${khai.nhan} · ${i.code}`}>
        {!coLoai && (
          <span className={`hk-loai ${LOP_MAU[i.kind]}`} style={{ marginRight: 6 }}>
            <i aria-label={khai.nhan} />
          </span>
        )}
        <Link href={i.href} className="hk-ma" onClick={(e) => e.stopPropagation()}>
          {i.code}
        </Link>
        {i.late_sign && !trongGap && (
          <span
            className="hk-tag hk-late"
            title={
              i.late_sign.reason ? `Lý do gửi gấp: ${i.late_sign.reason}` : undefined
            }
          >
            ký bù
          </span>
        )}
        {i.question_since && (
          <span className="hk-tag hk-mut" title="Bạn đã hỏi — đang chờ trả lời">
            đang hỏi
          </span>
        )}
      </td>
      <td className="hk-b" title={i.party}>
        {i.po?.supplier_short ?? i.party}
      </td>
      <NoiDung i={i} gapCau={gap?.cau ?? null} dong2={dong2} />
      {coBoiCanh && (
        <td className="hk-mut hk-xuong" title={ngCanh ?? undefined}>
          {ngCanh ?? '—'}
          {i.po?.lsx_done && (
            <span
              className="hk-tag hk-warn"
              title="Mọi lệnh của đơn đã hoàn thành — sản xuất xong, đơn chưa được cập nhật"
            >
              đã xong
            </span>
          )}
        </td>
      )}
      <td className="r hk-num">
        <Hen i={i} today={today} />
      </td>
      {coNguoi && (
        <td className="hk-mut hk-xuong" title={i.owner_name ?? undefined}>
          {i.owner_name ?? '—'}
        </td>
      )}
      <td className="r hk-num hk-b" title={tien}>
        {tien}
      </td>
      <td className={choCls}>
        {i.waiting_days <= 0 ? 'hôm nay' : `${i.waiting_days} ngày`}
      </td>
    </tr>
  )
}

/**
 * Ô "Nội dung" theo loại. Dòng ở khối gấp mở đầu bằng câu vì sao gấp. Bộ cột
 * vừa có thêm dòng hai (lệnh · người trình) chữ nhỏ nhạt.
 */
function NoiDung({
  i,
  gapCau,
  dong2,
}: {
  i: SignItem
  gapCau: string | null
  dong2: string | null
}) {
  let chinh: React.ReactNode
  let title: string | undefined
  if (i.po) {
    const m = materialSummary(i.po.materials)
    title = [i.po.loai, ...i.po.materials].filter(Boolean).join(' · ')
    chinh = (
      <>
        {i.po.loai && <span className="hk-b">{i.po.loai}</span>}
        {i.po.loai && m.head && ' · '}
        {m.head}
        {m.more > 0 && <span className="hk-mut"> +{m.more} mã</span>}
      </>
    )
  } else if (i.dnm) {
    const luuY = [
      i.dnm.chua_ma > 0 && `${i.dnm.chua_ma} chưa có mã`,
      i.dnm.thieu_gia > 0 && `${i.dnm.thieu_gia} chưa có giá`,
    ].filter(Boolean)
    title = luuY.join(' · ') || undefined
    chinh = (
      <>
        {i.dnm.so_dong} dòng
        {luuY.length > 0 && <span className="hk-warn"> · {luuY.join(' · ')}</span>}
      </>
    )
  } else {
    title = i.facts.join(' · ')
    chinh = <span className="hk-mut">{i.facts.join(' · ')}</span>
  }
  return (
    <td title={[gapCau, title, dong2].filter(Boolean).join(' · ') || undefined}>
      <div className="hk-1dong">
        {gapCau && (
          <>
            <span className="hk-why">{gapCau}</span>
            {' · '}
          </>
        )}
        {chinh}
      </div>
      {dong2 && <div className="hk-1dong hk-dong2">{dong2}</div>}
    </td>
  )
}

/** Cột "Hẹn": đơn mua = hẹn giao (+ quá hẹn); loại khác = ngày theo nhãn cột của loại. */
function Hen({ i, today }: { i: SignItem; today: string }) {
  if (!i.po) return <>{i.hen ? dm(i.hen, today) : '—'}</>
  if (!i.po.expected_at) return <span className="hk-warn">chưa hẹn</span>
  if (i.po.eta_late_days > 0)
    return (
      <span
        className="hk-late"
        title={`Hẹn giao ${dm(i.po.expected_at, today)} đã qua ${i.po.eta_late_days} ngày`}
      >
        {dm(i.po.expected_at, today)}
      </span>
    )
  return <>{dm(i.po.expected_at, today)}</>
}

/** Hàng tiêu đề RIÊNG của một khối — mỗi khối nói lại cột nghĩa là gì với loại của mình. */
export function KhoiDauCot({ loai, cot }: { loai: SignItem['kind']; cot: Cot[] }) {
  const khai = LOAI_PHIEU[loai]
  return (
    <tr className="sub" aria-hidden>
      {cot.map((c) => (
        <td
          key={c.key}
          className={c.r ? 'r' : undefined}
          title={nhanTheoLoai(c.key, khai)}
        >
          {nhanTheoLoai(c.key, khai)}
        </td>
      ))}
    </tr>
  )
}
