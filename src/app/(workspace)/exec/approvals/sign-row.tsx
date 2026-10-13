'use client'

import Link from 'next/link'
import { LOAI_PHIEU, kyNhanhDuoc, vungGap } from '@/lib/loai-phieu-duyet'
import { materialSummary } from '@/lib/po-list-labels'
import type { SignItem } from '@/modules/core/exec/exec.service'
import { money } from '../approval-helpers'
import { LOP_MAU, dm } from './hop-ky.shared'

/**
 * Một phiếu trong Hộp ký — lưới 10 cột viết tay (`hop-ky.css`, không kit).
 * Cột NGHĨA THEO LOẠI: đơn mua bày NCC · mua gì · lệnh · hẹn giao; đề nghị mua
 * bày bộ phận · số dòng + lưu ý · cần trước; lệnh SX bày khách · đơn · giao.
 * Hàng tiêu đề của khối (`KhoiDauCot`) nói cột đó nghĩa là gì với loại này.
 *
 * `trongGap` = dòng ở khối "Cần ký trước": câu vì sao gấp đứng đầu cột nội
 * dung; không có ô tích — ký nhanh chỉ trong khối cùng loại (Q26).
 */
export function SignRow({
  i,
  today,
  selected,
  checked,
  onPick,
  onToggle,
  trongGap = false,
}: {
  i: SignItem
  today: string
  selected: boolean
  checked: boolean
  onPick: () => void
  onToggle: () => void
  trongGap?: boolean
}) {
  const khai = LOAI_PHIEU[i.kind]
  const gap = trongGap ? vungGap(i) : null
  const nhanh = kyNhanhDuoc(i)
  const khoaVi = i.late_sign
    ? 'Đơn gửi gấp — mở ra đọc lý do rồi ký bù'
    : i.big
      ? 'Giá trị lớn — mở ra đọc rồi ký riêng, không ký hàng loạt'
      : `${khai.ten} — mở ra đọc rồi ký riêng`
  const ngCanh =
    i.kind === 'po' ? (i.po?.lsx_code ?? i.po?.ngoai_lenh ?? 'Ngoài lệnh') : (i.boi_canh ?? '—') // prettier-ignore
  const choCls =
    i.waiting_days >= 7 || (i.po?.eta_late_days ?? 0) > 0
      ? 'r hk-late'
      : i.waiting_days >= 3
        ? 'r hk-warn'
        : 'r'
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
          <span className="hk-lock" title={khoaVi}>
            khoá
          </span>
        )}
      </td>
      <td className={LOP_MAU[i.kind]}>
        <span className="hk-loai">
          <i aria-hidden />
          {khai.nhan}
        </span>
      </td>
      <td title={i.code}>
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
      <NoiDung i={i} gapCau={gap?.cau ?? null} />
      <td className="hk-mut" title={ngCanh}>
        {ngCanh}
        {i.po?.lsx_done && (
          <span
            className="hk-tag hk-warn"
            title="Mọi lệnh của đơn đã hoàn thành — sản xuất xong, đơn chưa được cập nhật"
          >
            đã xong
          </span>
        )}
      </td>
      <td className="r hk-num">
        <Hen i={i} today={today} />
      </td>
      <td className="hk-mut" title={i.owner_name ?? undefined}>
        {i.owner_name ?? '—'}
      </td>
      <td className="r hk-num hk-b">{i.value > 0 ? money(i.value, i.currency) : '—'}</td>
      <td className={choCls}>
        {i.waiting_days <= 0 ? 'hôm nay' : `${i.waiting_days} ng`}
      </td>
    </tr>
  )
}

/** Cột "Nội dung" theo loại; dòng ở khối gấp mở đầu bằng câu vì sao gấp. */
function NoiDung({ i, gapCau }: { i: SignItem; gapCau: string | null }) {
  const why = gapCau && (
    <>
      <span className="hk-why">{gapCau}</span>
      {' · '}
    </>
  )
  if (i.po) {
    const m = materialSummary(i.po.materials)
    const full = [i.po.loai, ...i.po.materials].filter(Boolean).join(' · ')
    return (
      <td title={full}>
        {why}
        {i.po.loai && <span className="hk-b">{i.po.loai}</span>}
        {i.po.loai && m.head && ' · '}
        {m.head}
        {m.more > 0 && <span className="hk-mut"> +{m.more} mã</span>}
      </td>
    )
  }
  if (i.dnm) {
    const luuY = [
      i.dnm.chua_ma > 0 && `${i.dnm.chua_ma} chưa có mã`,
      i.dnm.thieu_gia > 0 && `${i.dnm.thieu_gia} chưa có giá`,
    ].filter(Boolean)
    return (
      <td title={luuY.join(' · ') || undefined}>
        {why}
        {i.dnm.so_dong} dòng
        {luuY.length > 0 && <span className="hk-warn"> · {luuY.join(' · ')}</span>}
      </td>
    )
  }
  return (
    <td title={i.facts.join(' · ')}>
      {why}
      <span className="hk-mut">{i.facts.join(' · ')}</span>
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

/**
 * Hàng tiêu đề RIÊNG của một khối — lưới dùng chung 10 cột, mỗi khối nói lại
 * cột đó nghĩa là gì với loại của mình.
 */
export function KhoiDauCot({ loai }: { loai: SignItem['kind'] }) {
  const c = LOAI_PHIEU[loai].cot
  const nhan = ['', '', 'Mã', c.doiTac, c.noiDung, c.boiCanh, c.hen, 'Người trình', c.giaTri, 'Chờ'] // prettier-ignore
  return (
    <tr className="sub" aria-hidden>
      {nhan.map((t, k) => (
        <td key={k} className={k === 6 || k >= 8 ? 'r' : undefined}>
          {t}
        </td>
      ))}
    </tr>
  )
}
