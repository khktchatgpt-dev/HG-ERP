'use client'

import { Cell, Code, Hint, Ico, Row, Tag, Tick, ToneText } from '@/components/kit'
import { LOAI_PHIEU, kyNhanhDuoc, vungGap } from '@/lib/loai-phieu-duyet'
import { materialSummary } from '@/lib/po-list-labels'
import type { SignItem } from '@/modules/core/exec/exec.service'
import { money } from '../approval-helpers'
import { KIND_ICON, dm } from './hop-ky.shared'

/**
 * Một phiếu trong Hộp ký — cột NGHĨA THEO LOẠI (H2, bản vẽ HK-1): cùng một lưới
 * 8 cột, nhưng đơn mua bày NCC · mua gì · lệnh · hẹn giao; đề nghị mua bày bộ
 * phận · số dòng + lưu ý · lệnh · cần trước; lệnh SX bày khách · đơn · giao.
 * Hàng tiêu đề của khối (`KhoiDauCot`) nói cột đó nghĩa là gì với loại này.
 *
 * `trongGap` = dòng nằm trong khối "Cần ký trước" (mọi loại lẫn nhau): có thêm
 * nhãn loại trước mã + câu vì sao gấp; không có ô tích — ký nhanh chỉ trong
 * khối cùng loại (Q26).
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
  const late = i.waiting_days >= 7
  const khai = LOAI_PHIEU[i.kind]
  const gap = trongGap ? vungGap(i) : null
  // Khối gấp lẫn mọi loại: nói loại ngay trong câu vì sao gấp (không thêm nhãn
  // vào cột Mã — cột đó phình 222px, đẩy bảng tràn ngang; đo 14/10).
  const gapCau = gap ? `${khai.nhan} · ${gap.cau}` : null
  const ngCanh =
    i.kind === 'po'
      ? (i.po?.lsx_code ?? i.po?.ngoai_lenh ?? 'Ngoài lệnh')
      : (i.boi_canh ?? '—')
  const nhanh = kyNhanhDuoc(i)
  const khoaVi = i.late_sign
    ? 'Đơn gửi gấp — mở ra đọc lý do rồi ký bù'
    : i.big
      ? 'Giá trị lớn — mở ra đọc rồi ký riêng, không ký hàng loạt'
      : !khai.kyNhanh
        ? `${khai.ten} — mở ra đọc rồi ký riêng`
        : null
  return (
    <Row selected={selected} onClick={onPick}>
      <Cell>
        {trongGap ? null : nhanh ? (
          <Tick
            checked={checked}
            label={`Chọn phiếu ${i.code} để ký nhanh`}
            onChange={onToggle}
          />
        ) : (
          <span className="flex text-[var(--ink-3)]" title={khoaVi ?? undefined}>
            <Ico name="khoa" size={13} label={khoaVi ?? 'Không ký hàng loạt'} />
          </span>
        )}
      </Cell>
      <Cell>
        <span className="flex items-center gap-1.5">
          <Ico name={KIND_ICON[i.kind]} size={13} label={khai.nhan} />
          <Code
            as="a"
            href={i.href}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {i.code}
          </Code>
          {/* 0218 — hàng đã đi trước chữ ký; câu hỏi đang chờ Cung ứng trả lời. */}
          {i.late_sign && !trongGap && (
            <span
              title={
                i.late_sign.reason ? `Lý do gửi gấp: ${i.late_sign.reason}` : undefined
              }
            >
              <Tag tone="stop">chờ ký bù</Tag>
            </span>
          )}
          {i.question_since && (
            <span title="Bạn đã hỏi — đang chờ trả lời">
              <Tag tone="run">đang hỏi</Tag>
            </span>
          )}
        </span>
      </Cell>
      <Cell title={i.party}>
        <span className="font-semibold">{i.po?.supplier_short ?? i.party}</span>
        {i.kind === 'dnm' && i.owner_name && (
          <span className="text-[var(--ink-3)]"> · {i.owner_name}</span>
        )}
      </Cell>
      <NoiDung i={i} gapCau={gapCau} />
      <Cell muted title={ngCanh}>
        <span className="flex items-center gap-1.5">
          {/* Cắt chữ: "HM-2026-0008 · ARUBA 159 (AK)" từng đẩy cột lên 218px. */}
          <span className="block max-w-[150px] truncate">{ngCanh}</span>
          {i.po?.lsx_done && (
            <span title="Mọi lệnh của đơn đã hoàn thành — sản xuất xong, đơn chưa được cập nhật">
              <Tag tone="warn">đã xong</Tag>
            </span>
          )}
        </span>
      </Cell>
      <Cell num>
        <Hen i={i} today={today} />
      </Cell>
      <Cell num>
        <span className="font-semibold">
          {i.value > 0 ? money(i.value, i.currency) : '—'}
        </span>
      </Cell>
      <Cell>
        <span
          className={
            late
              ? 'text-k-sm flex items-center gap-1 font-semibold text-[var(--stop)]'
              : 'text-k-sm flex items-center gap-1 text-[var(--ink-2)]'
          }
        >
          <Ico name={late ? 'canhBao' : 'cho'} size={13} />
          {i.waiting_days <= 0 ? 'hôm nay' : `${i.waiting_days} ngày`}
        </span>
      </Cell>
    </Row>
  )
}

/** Cột "Nội dung" theo loại; dòng trong khối gấp có thêm câu vì sao gấp. */
function NoiDung({ i, gapCau }: { i: SignItem; gapCau: string | null }) {
  const lyDoGap = gapCau && <span className="text-k-sm block font-semibold text-[var(--warn)]">{gapCau}</span> // prettier-ignore
  if (i.po) {
    const m = materialSummary(i.po.materials)
    return (
      <Cell grow title={[i.po.loai, ...i.po.materials].filter(Boolean).join(' · ')}>
        {i.po.loai && <span className="font-semibold">{i.po.loai}</span>}
        {i.po.loai && m.head && ' · '}
        {m.head}
        {m.more > 0 && (
          <>
            {' '}
            <Hint>+{m.more} mã</Hint>
          </>
        )}
        {lyDoGap}
      </Cell>
    )
  }
  if (i.dnm) {
    const luuY = [
      i.dnm.chua_ma > 0 && `${i.dnm.chua_ma} chưa có mã`,
      i.dnm.thieu_gia > 0 && `${i.dnm.thieu_gia} chưa có giá`,
    ].filter(Boolean)
    return (
      <Cell grow title={luuY.join(' · ') || undefined}>
        {i.dnm.so_dong} dòng
        {luuY.length > 0 && (
          <span className="text-[var(--warn)]"> · {luuY.join(' · ')}</span>
        )}
        {lyDoGap}
      </Cell>
    )
  }
  return (
    <Cell grow muted title={i.facts.join(' · ')}>
      {i.facts.join(' · ')}
      {lyDoGap}
    </Cell>
  )
}

/** Cột "Hẹn": đơn mua = hẹn giao (+ quá hẹn); loại khác = ngày theo nhãn cột của loại. */
function Hen({ i, today }: { i: SignItem; today: string }) {
  if (!i.po) return i.hen ? <>{dm(i.hen, today)}</> : <span className="text-[var(--ink-empty)]">—</span> // prettier-ignore
  if (!i.po.expected_at) return <Tag tone="warn">chưa hẹn</Tag>
  if (i.po.eta_late_days > 0)
    return (
      <ToneText
        tone="stop"
        title={`Hẹn giao ${dm(i.po.expected_at, today)} đã qua ${i.po.eta_late_days} ngày`}
      >
        {dm(i.po.expected_at, today)}{' '}
        <span className="text-k-label">qua {i.po.eta_late_days} ng</span>
      </ToneText>
    )
  return <>{dm(i.po.expected_at, today)}</>
}

/**
 * Hàng tiêu đề RIÊNG của một khối — bảng dùng một lưới cột, mỗi khối nói lại
 * cột đó nghĩa là gì với loại của mình (đơn mua: "Nhà cung cấp · Mua gì";
 * đề nghị mua: "Bộ phận · Nội dung · lưu ý"…).
 */
export function KhoiDauCot({ loai }: { loai: SignItem['kind'] }) {
  const c = LOAI_PHIEU[loai].cot
  const nhan = ['', 'Mã', c.doiTac, c.noiDung, c.boiCanh, c.hen, c.giaTri, 'Chờ']
  return (
    <tr aria-hidden>
      {nhan.map((t, k) => (
        <td
          key={k}
          className="text-k-label border-b border-[var(--hair)] bg-[var(--surface-card)] font-semibold tracking-[.04em] text-[var(--ink-3)] uppercase"
          style={k >= 5 && k <= 6 ? { textAlign: 'right' } : undefined}
        >
          {t}
        </td>
      ))}
    </tr>
  )
}
