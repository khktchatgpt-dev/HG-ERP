'use client'

import './hop-ky.css'
import Link from 'next/link'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, History, Info, Undo2 } from 'lucide-react'
import { useBeRong } from '@/lib/use-be-rong'
import {
  LOAI_PHIEU,
  LOAI_THEO_THU_TU,
  PHONG_NHAN,
  gomTheoLoai,
  kyNhanhDuoc,
  xepGap,
  type LoaiPhieu,
} from '@/lib/loai-phieu-duyet'
import { searchMatcher } from '@/lib/search-text'
// `money` dùng CHUNG với trang chi tiết duyệt — hai màn nói cùng một con số.
import { money } from '../approval-helpers'
import { useApprovalDecision, type DecideTarget } from '../useApprovalDecision'
import type { SignBox, SignItem } from '@/modules/core/exec/exec.service'
import { LOP_MAU, itemKey, moneyShort, moneyText, sumByCurrency } from './hop-ky.shared'
import { KhoiDauCot, SignRow, cotHopKy } from './sign-row'
import { HopKyHep } from './hop-ky-hep'

/**
 * TRUNG TÂM PHÊ DUYỆT (/exec/approvals, cũng là "Chờ tôi ký" bên Mua hàng) —
 * MỌI loại phiếu chờ ký gom một chỗ. Ký / trả lại ngay tại dòng; "Xem kỹ" mở
 * màn thẩm định đầy đủ của từng phiếu.
 *
 * VIẾT TAY, KHÔNG KIT (14/10/2026). Chủ dự án: "không có màu sắc phân biệt các
 * thành phần gây khó nhìn" · "không dùng kit nữa" (chỉ màn này) · "thiết kế
 * thiên hướng ERP không làm như web thường được". Bản vẽ v2 lối ERP
 * https://claude.ai/artifact/Ar4nCXv8ruVNkwHpc3NYJ4 (Q29–Q32):
 *  · phẳng, sát mép, MỘT lưới cuộn liền; tiêu đề cột nền sẫm dính, chân tổng dính;
 *  · thanh hành động gom nhóm ở góc trên phải (Action Pane);
 *  · dải Ô ĐẾM VUÔNG là bộ lọc: Tất cả · Cần ký trước · từng loại phiếu;
 *  · màu loại (đơn mua xanh ngọc · đề nghị tím · lệnh hồng sẫm · báo giá xám đá)
 *    chỉ ở vạch ô đếm, vạch + nền nhạt dòng nhóm, ô vuông cột "Loại".
 * Kiểu ở `hop-ky.css` — luật `.hk.hk` để thắng CSS kit ngoài @layer (layout Mua
 * hàng vẫn gắn `.kit`).
 *
 * Phân loại (H1–H3, bản vẽ https://claude.ai/artifact/XDy5RfHWzAfAAoULJpobBB):
 * khối "Cần ký trước" (ký bù · quá hẹn · chờ ≥ 3 ngày), mỗi loại một `<tbody>`
 * theo thứ tự phòng, gom theo loại / người trình, ký nhanh chỉ trong một loại.
 * Thêm loại phiếu: khai ở `LOAI_PHIEU`, màn tự có ô đếm + khối.
 *
 * BA LUẬT GIỮ NGUYÊN:
 *  · phiếu GIÁ TRỊ LỚN / lệnh SX / chờ ký bù không có ô tích — mở ra đọc, ký riêng;
 *  · ký nhiều phiếu gọi tuần tự, phiếu lỗi nằm lại trong hộp;
 *  · màn rỗng phải nói THẬT vì sao rỗng (đã ký hết ↔ chưa ai lập phiếu).
 */

export type ApprovalKind = 'all' | LoaiPhieu
type Loc = 'all' | 'gap' | LoaiPhieu

export function ApprovalCenterScreen({
  box,
  initialKind,
  eyebrow = 'Ban Giám đốc',
  historyHref = '/exec/approvals/history',
  ruleHref = '/exec/luat-ky',
}: {
  box: SignBox
  /** `?loai=` từ thẻ ở Tổng quan — bật sẵn ô đếm của loại đó. */
  initialKind: ApprovalKind
  /** Mẩu đường dẫn trên tiêu đề — "Mua hàng" khi mở ở khu Cung ứng. */
  eyebrow?: string
  /** Lịch sử ký — null khi người xem không vào được khu Giám đốc. */
  historyHref?: string | null
  /** Luật ký (ngưỡng giá trị lớn) — null khi người xem không chỉnh được. */
  ruleHref?: string | null
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [loc, setLoc] = useState<Loc>(initialKind)
  const [gom, setGom] = useState<'loai' | 'nguoi'>('loai')
  const [who, setWho] = useState<string>('all')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<SignItem[]>([])
  const [pick, setPick] = useState<string | null>(null)
  // Khung < 900px (điện thoại — giám đốc mở từ thông báo): danh sách nhóm (HK-4).
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  // Dưới 840px (điện thoại, máy tính bảng dọc): danh sách nhóm — bộ cột vừa cần ~820px.
  const hep = beRong < 840
  /* Bộ cột theo bề rộng KHUNG (sign-row · cotHopKy): ≥ 1440 đủ 10 cột, vừa thì
     gộp lệnh + người trình xuống dòng hai của ô Nội dung. */
  const rong = beRong >= 1440
  const cot = cotHopKy(rong)
  /* CHỐT CHIỀU CAO = 100dvh − đỉnh của màn (cách `ScreenFrame` của kit làm) —
     để chỉ LƯỚI cuộn, tiêu đề + ô đếm + thanh trạng thái đứng yên. */
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 60px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  const { busy, askApprove, askReject, askApproveMany, dialogs } = useApprovalDecision(
    () => {
      setPicked([])
      setPick(null)
      router.refresh()
    },
  )

  const khop = searchMatcher(q)
  const base = q.trim()
    ? box.items.filter((i) => khop([i.code, i.party, i.owner_name ?? '']))
    : box.items
  const gapAll = xepGap(box.items)
  const gap = xepGap(base)
  const shown =
    loc === 'all' ? base : loc === 'gap' ? gap : base.filter((i) => i.kind === loc)

  const ownerKey = (i: SignItem) => i.owner_id ?? '@none'
  const owners = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>()
    for (const i of shown) {
      const k = ownerKey(i)
      const cur = m.get(k) ?? { name: i.owner_name ?? 'Chưa rõ người trình', n: 0 }
      cur.n++
      m.set(k, cur)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [shown])
  const items =
    gom === 'nguoi' && who !== 'all' ? shown.filter((i) => ownerKey(i) === who) : shown

  /* Khối hiển thị: khối gấp (khi xem Tất cả, gom theo loại) + mỗi loại một khối;
     hoặc mỗi người trình một khối. */
  const lane = loc === 'all' && gom === 'loai' ? gap : []
  const khoi =
    gom === 'loai'
      ? loc === 'gap'
        ? [{ key: 'gap', loai: null as LoaiPhieu | null, lop: 'lp-gap', ten: 'Cần ký trước', so: null as string | null, rows: gap }] // prettier-ignore
        : gomTheoLoai(items).map((g) => ({
            key: g.loai as string,
            loai: g.loai as LoaiPhieu | null,
            lop: LOP_MAU[g.loai],
            ten: `${PHONG_NHAN[g.khai.phong]} · ${g.khai.ten}`,
            so: g.khai.so,
            rows: g.items,
          }))
      : owners
          .map(([k, o]) => ({
            key: k,
            loai: null as LoaiPhieu | null,
            lop: 'lp-all',
            ten: o.name,
            so: null as string | null,
            rows: items.filter((i) => ownerKey(i) === k),
          }))
          .filter((g) => g.rows.length > 0)

  const target = (i: SignItem): DecideTarget => ({
    kind: i.kind,
    id: i.id,
    code: i.code,
    label: `${i.party} · ${i.facts[0] ?? ''}`,
  })
  const pickedKeys = new Set(picked.map(itemKey))
  const sel = items.find((i) => itemKey(i) === pick) ?? null
  const bigCount = items.filter((i) => i.big).length
  /* Tiền tệ chưa có ngưỡng → mọi phiếu tệ đó đều "giá trị lớn". Nói ra. */
  const noRule = [
    ...new Set(
      box.items
        .filter((i) => i.kind === 'po' && !Object.hasOwn(box.thresholds, i.currency))
        .map((i) => i.currency),
    ),
  ]

  /** Ký nhanh CHỈ trong một loại (Q26): tích phiếu khác loại thì bỏ chọn cũ. */
  function toggle(i: SignItem) {
    setPicked((s) => {
      if (s.length > 0 && s[0].kind !== i.kind) return [i]
      return pickedKeys.has(itemKey(i))
        ? s.filter((x) => itemKey(x) !== itemKey(i))
        : [...s, i]
    })
  }
  const nhieu = picked.length > 0
  const chuaChon = !nhieu && !sel
  const lyDo = chuaChon ? 'Chọn một phiếu trong bảng trước' : undefined
  const lateSel =
    !nhieu && sel?.late_sign
      ? 'Đơn đã gửi gấp — bấm "Xem kỹ" đọc lý do rồi ký bù'
      : undefined
  const chon = (l: Loc) => {
    setLoc(loc === l && l !== 'all' ? 'all' : l)
    setWho('all')
    setPicked([])
  }
  const lau = (rows: SignItem[]) =>
    rows.length ? Math.max(...rows.map((r) => r.waiting_days)) : 0

  return (
    <div className="hk" ref={goc} style={{ height: cao }}>
      {/* Tiêu đề + Action Pane góc phải */}
      <div className="hk-ph">
        <span className="hk-crumb">{eyebrow} ›</span>
        <h1>Chờ tôi phê duyệt</h1>
        {box.decided_today.approved + box.decided_today.rejected > 0 && (
          <span className="hk-crumb">
            hôm nay đã ký <b className="hk-num">{box.decided_today.approved}</b>
            {box.decided_today.rejected > 0 && (
              <>
                , trả lại <b className="hk-num">{box.decided_today.rejected}</b>
              </>
            )}
          </span>
        )}
        <div className="hk-ap" role="toolbar" aria-label="Ký phiếu">
          {!hep && (
            <div>
              <button
                type="button"
                className="hk-btn p"
                disabled={busy || chuaChon || !!lateSel}
                title={lyDo ?? lateSel}
                onClick={() =>
                  nhieu
                    ? askApproveMany(picked.map(target))
                    : sel && askApprove(target(sel))
                }
              >
                <Check size={15} aria-hidden />
                {nhieu ? `Ký ${picked.length} phiếu` : 'Ký duyệt'}
              </button>
              <button
                type="button"
                className="hk-btn"
                disabled={busy || !sel || !!lateSel}
                title={
                  nhieu
                    ? 'Trả lại phải ghi lý do cho từng phiếu — chọn một phiếu'
                    : (lyDo ?? lateSel)
                }
                onClick={() => sel && askReject(target(sel))}
              >
                <Undo2 size={15} aria-hidden />
                Trả lại để sửa
              </button>
              {sel ? (
                <Link href={sel.href} className="hk-btn">
                  <ExternalLink size={15} aria-hidden />
                  Xem kỹ
                </Link>
              ) : (
                <button type="button" className="hk-btn" disabled title={lyDo}>
                  <ExternalLink size={15} aria-hidden />
                  Xem kỹ
                </button>
              )}
            </div>
          )}
          {(historyHref || ruleHref) && (
            <div>
              {historyHref && (
                <Link href={historyHref} className="hk-btn">
                  <History size={15} aria-hidden />
                  Lịch sử ký
                </Link>
              )}
              {ruleHref && (
                <Link href={ruleHref} className="hk-btn">
                  <Info size={15} aria-hidden />
                  Luật ký
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />

      {box.stats.total > 0 && !hep && (
        <div className="hk-tiles" role="toolbar" aria-label="Lọc phiếu chờ ký">
          <button
            type="button"
            className="hk-tile lp-all"
            aria-pressed={loc === 'all'}
            onClick={() => chon('all')}
          >
            <span className="t">Tất cả</span>
            <span className="n">{base.length}</span>
            <span className="s">lâu nhất {box.stats.oldest_days} ngày</span>
          </button>
          <button
            type="button"
            className="hk-tile lp-gap"
            aria-pressed={loc === 'gap'}
            disabled={gapAll.length === 0}
            onClick={() => chon('gap')}
          >
            <span className="t">Cần ký trước</span>
            <span className="n">{gap.length}</span>
            <span className="s" title="ký bù · quá hẹn · chờ ≥ 3 ngày">
              ký bù · quá hẹn · ≥ 3 ngày
            </span>
          </button>
          {LOAI_THEO_THU_TU.map((l) => {
            const rows = base.filter((i) => i.kind === l)
            const tien = moneyShort(rows)
            return (
              <button
                key={l}
                type="button"
                className={`hk-tile ${LOP_MAU[l]}`}
                aria-pressed={loc === l}
                disabled={rows.length === 0}
                onClick={() => chon(l)}
              >
                <span className="t">{LOAI_PHIEU[l].ten}</span>
                <span className="n">{rows.length}</span>
                <span
                  className="s"
                  title={`${PHONG_NHAN[LOAI_PHIEU[l].phong]}${tien ? ` · ${tien}` : ''}`}
                >
                  {PHONG_NHAN[LOAI_PHIEU[l].phong]}
                  {tien ? ` · ${tien}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {box.stats.total > 0 && !hep && (
        <div className="hk-fb">
          <span className={nhieu || sel ? 'hk-sel' : undefined}>
            {nhieu
              ? `${picked.length} ${LOAI_PHIEU[picked[0].kind].nhan.toLowerCase()} đã chọn · ${moneyText(picked)}`
              : sel
                ? `Đã chọn: ${sel.code} · ${sel.po?.supplier_short ?? sel.party} · ${money(sel.value, sel.currency)}`
                : 'Chưa chọn phiếu nào'}
          </span>
          {nhieu && (
            <button type="button" className="hk-who" onClick={() => setPicked([])}>
              Bỏ chọn
            </button>
          )}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã phiếu, NCC, người trình…"
            aria-label="Tìm phiếu chờ ký"
          />
          {bigCount > 0 && (
            <span>{bigCount} phiếu giá trị lớn — mở ra đọc, ký riêng</span>
          )}
          <span className="hk-seg" role="group" aria-label="Cách gom">
            <button
              type="button"
              aria-pressed={gom === 'loai'}
              onClick={() => setGom('loai')}
            >
              Theo loại phiếu
            </button>
            <button
              type="button"
              aria-pressed={gom === 'nguoi'}
              onClick={() => {
                setGom('nguoi')
                setWho('all')
              }}
            >
              Theo người trình
            </button>
          </span>
          {gom === 'nguoi' && owners.length > 1 && (
            <span
              style={{ display: 'flex', gap: 6, flexBasis: '100%', flexWrap: 'wrap' }}
            >
              {owners.map(([k, o]) => (
                <button
                  key={k}
                  type="button"
                  className="hk-who"
                  aria-pressed={who === k}
                  onClick={() => {
                    setWho(who === k ? 'all' : k)
                    setPicked([])
                  }}
                >
                  {o.name} · {o.n}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      {noRule.length > 0 && (
        <div className="hk-note">
          Chưa đặt ngưỡng cho <b>{noRule.join(', ')}</b> — mọi đơn tính bằng tiền đó bị
          coi là giá trị lớn, phải mở ra ký từng phiếu.
          {ruleHref && (
            <>
              {' '}
              <Link
                href={ruleHref}
                style={{ color: 'var(--hk-act)', textDecoration: 'underline' }}
              >
                Đặt ngưỡng
              </Link>
            </>
          )}
        </div>
      )}

      {hep ? (
        box.stats.total === 0 ? (
          <EmptyCenter box={box} filtered={false} historyHref={historyHref} />
        ) : (
          <HopKyHep items={box.items} gap={gapAll} />
        )
      ) : items.length === 0 ? (
        <EmptyCenter box={box} filtered={box.stats.total > 0} historyHref={historyHref} />
      ) : (
        <div className="hk-grid">
          <table className="hk-tb" aria-label="Phiếu chờ ký">
            <colgroup>
              {cot.map((c) => (
                <col key={c.key} style={c.w ? { width: c.w } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {cot.map((c) => (
                  <th
                    key={c.key}
                    className={c.r ? 'r' : undefined}
                    aria-label={c.key === 'chon' ? 'Chọn' : undefined}
                  >
                    {c.nhan}
                  </th>
                ))}
              </tr>
            </thead>
            {lane.length > 0 && (
              <tbody>
                <tr className="grp lp-gap">
                  <th scope="rowgroup" colSpan={cot.length}>
                    <span className="ten">Cần ký trước</span> ·{' '}
                    <b className="hk-num">{lane.length}</b> phiếu · mọi loại · ký bù, hẹn
                    giao đã qua, chờ từ 3 ngày
                  </th>
                </tr>
                {lane.map((i) => (
                  <SignRow
                    rong={rong}
                    key={`gap-${itemKey(i)}`}
                    i={i}
                    today={today}
                    trongGap
                    selected={itemKey(i) === pick}
                    checked={false}
                    onPick={() => setPick(itemKey(i))}
                    onToggle={() => toggle(i)}
                  />
                ))}
              </tbody>
            )}
            {khoi.map((g) => {
              const nhanh = g.loai ? g.rows.filter(kyNhanhDuoc) : []
              const daChon =
                nhanh.length > 0 && nhanh.every((i) => pickedKeys.has(itemKey(i)))
              return (
                <tbody key={g.key}>
                  <tr className={`grp ${g.lop}`}>
                    <th scope="rowgroup" colSpan={cot.length}>
                      <span className="ten">{g.ten}</span> ·{' '}
                      <b className="hk-num">{g.rows.length}</b> phiếu ·{' '}
                      {moneyText(g.rows)} · lâu nhất {lau(g.rows)} ngày
                      <span className="rr">
                        {nhanh.length > 1 && (
                          <label>
                            <input
                              type="checkbox"
                              checked={daChon}
                              onChange={(e) => setPicked(e.target.checked ? nhanh : [])}
                              aria-label={`Chọn ${nhanh.length} phiếu ký nhanh trong khối ${g.ten}`}
                            />
                            Chọn {nhanh.length} phiếu ký nhanh
                          </label>
                        )}
                        {g.so && <Link href={g.so}>Sổ tra cứu ›</Link>}
                      </span>
                    </th>
                  </tr>
                  {g.loai && <KhoiDauCot loai={g.loai} rong={rong} />}
                  {g.rows.map((i) => (
                    <SignRow
                      rong={rong}
                      key={itemKey(i)}
                      i={i}
                      today={today}
                      trongGap={g.key === 'gap'}
                      selected={itemKey(i) === pick}
                      checked={pickedKeys.has(itemKey(i))}
                      onPick={() => setPick(itemKey(i))}
                      onToggle={() => toggle(i)}
                    />
                  ))}
                </tbody>
              )
            })}
            {/* Phiếu ở khối "Cần ký trước" cũng nằm trong khối loại của nó — chỉ cộng một lần. */}
            <tfoot>
              <tr>
                <td colSpan={cot.length - 2}>
                  Cộng {items.length} phiếu · cộng riêng từng loại tiền, không quy đổi
                </td>
                <td className="r hk-num" colSpan={2}>
                  {sumByCurrency(items).map(([cur, v]) => (
                    <div key={cur}>{money(v, cur)}</div>
                  ))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="hk-sb">
        <span>
          {loc === 'all'
            ? 'Mọi loại phiếu'
            : loc === 'gap'
              ? 'Chỉ phiếu cần ký trước'
              : `Chỉ ${LOAI_PHIEU[loc].ten.toLowerCase()}`}
          {' · '}
          {gom === 'loai' ? 'gom theo loại phiếu' : 'gom theo người trình'}
        </span>
        <span>khoá = giá trị lớn / lệnh SX / ký bù — mở ra đọc, ký riêng</span>
        <span style={{ marginLeft: 'auto' }}>
          {items.length} / {box.stats.total} phiếu
        </span>
      </div>

      {dialogs}
    </div>
  )
}

/**
 * Màn rỗng phải NÓI THẬT vì sao rỗng. "0 phiếu chờ" có hai nghĩa trái ngược:
 * đã ký hết (tốt) hoặc chưa ai từng lập phiếu trên hệ thống (dữ liệu chưa lên).
 */
function EmptyCenter({
  box,
  filtered,
  historyHref,
}: {
  box: SignBox
  filtered: boolean
  historyHref: string | null
}) {
  const neverUsed = box.emptiness.pos_total === 0 && box.emptiness.lsx_total === 0
  const noPo = box.emptiness.pos_total === 0
  return (
    <div className="hk-empty" style={{ flex: 1 }}>
      <b>{filtered ? 'Không có phiếu nào khớp' : 'Không có phiếu chờ duyệt'}</b>
      <p style={{ margin: '0 auto 12px', maxWidth: '60ch' }}>
        {filtered
          ? `Ô đếm / ô tìm đang bật không còn phiếu nào trong ${box.stats.total} phiếu của hộp.`
          : neverUsed
            ? 'Hệ thống chưa từng có phiếu nào được lập — không phải bạn đã ký hết.'
            : noPo
              ? `Mọi phiếu đã được xử lý. Riêng đơn mua thì chưa có đơn nào trên hệ thống (${box.emptiness.lsx_total} lệnh sản xuất đã có).`
              : 'Mọi phiếu đã được xử lý.'}
      </p>
      {historyHref && (
        <Link
          href={historyHref}
          className="hk-btn"
          style={{ border: '1px solid var(--hk-line)' }}
        >
          <History size={15} aria-hidden />
          Xem lịch sử ký
        </Link>
      )}
    </div>
  )
}
