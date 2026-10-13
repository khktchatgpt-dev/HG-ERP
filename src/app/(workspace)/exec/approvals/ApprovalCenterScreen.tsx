'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarLabel,
  BarSep,
  Btn,
  Chip,
  Empty,
  FilterBar,
  GroupRow,
  Hint,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Table,
  TFoot,
  THead,
  Tick,
} from '@/components/kit'
import {
  LOAI_PHIEU,
  PHONG_NHAN,
  demTheoPhong,
  gomTheoLoai,
  kyNhanhDuoc,
  xepGap,
  type LoaiPhieu,
  type PhongTrinh,
} from '@/lib/loai-phieu-duyet'
// `money` dùng CHUNG với trang chi tiết duyệt — hai màn nói cùng một con số.
import { money } from '../approval-helpers'
import { useApprovalDecision, type DecideTarget } from '../useApprovalDecision'
import type { SignBox, SignItem } from '@/modules/core/exec/exec.service'
import { COLS, itemKey, moneyText, sumByCurrency } from './hop-ky.shared'
import { KhoiDauCot, SignRow } from './sign-row'

/**
 * TRUNG TÂM PHÊ DUYỆT (/exec/approvals) — MỌI loại phiếu chờ ký gom một chỗ.
 * Ký / trả lại ngay tại dòng; "Xem kỹ" mở màn thẩm định đầy đủ của từng phiếu.
 *
 * PHÂN LOẠI LẠI 14/10/2026 (H2, bản vẽ https://claude.ai/artifact/XDy5RfHWzAfAAoULJpobBB,
 * Q23–Q28): chủ dự án — "không phân loại ra sao sẽ dễ bị rối lắm vì sau này sẽ
 * có rất nhiều yêu cầu duyệt". Bản trước là một bảng chung gom theo NGƯỜI TRÌNH,
 * đơn mua 233 triệu nằm sát phiếu đề nghị 392 nghìn. Nay:
 *  · khối "CẦN KÝ TRƯỚC" trên cùng (mọi loại): ký bù, hẹn giao đã qua, chờ ≥ 3
 *    ngày (`lib/loai-phieu-duyet` · Q24) — giá trị lớn không tự vào;
 *  · MỖI LOẠI PHIẾU MỘT KHỐI (`<tbody>` riêng) theo thứ tự phòng, hàng tiêu đề
 *    riêng nói cột nghĩa là gì với loại đó; một vùng cuộn duy nhất;
 *  · chip lọc theo PHÒNG trình (Q28), công tắc gom theo loại / người trình (Q23);
 *  · ký nhanh chỉ trong MỘT khối (Q26) — chọn phiếu khác loại thì bỏ chọn cũ.
 * Thêm loại phiếu mới: khai ở `LOAI_PHIEU`, màn này tự có khối + chip.
 *
 * BA LUẬT GIỮ NGUYÊN:
 *  · phiếu GIÁ TRỊ LỚN / lệnh SX / chờ ký bù không có ô tích — mở ra đọc, ký riêng;
 *  · ký nhiều phiếu gọi tuần tự, phiếu lỗi nằm lại trong hộp;
 *  · màn rỗng phải nói THẬT vì sao rỗng (đã ký hết ↔ chưa ai lập phiếu).
 */

export type ApprovalKind = 'all' | LoaiPhieu

export function ApprovalCenterScreen({
  box,
  initialKind,
  eyebrow = 'Ban Giám đốc',
  historyHref = '/exec/approvals/history',
  ruleHref = '/exec/luat-ky',
}: {
  box: SignBox
  /** `?loai=` từ thẻ ở Tổng quan — chỉ bày khối của loại đó (bỏ được). */
  initialKind: ApprovalKind
  /** Dòng nhỏ trên tiêu đề — "Mua hàng" khi mở ở khu Cung ứng. */
  eyebrow?: string
  /** Lịch sử ký — null khi người xem không vào được khu Giám đốc. */
  historyHref?: string | null
  /** Luật ký (ngưỡng giá trị lớn) — null khi người xem không chỉnh được. */
  ruleHref?: string | null
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [kind, setKind] = useState<ApprovalKind>(initialKind)
  const [phong, setPhong] = useState<'all' | PhongTrinh>('all')
  const [gom, setGom] = useState<'loai' | 'nguoi'>('loai')
  const [who, setWho] = useState<string>('all')
  const [picked, setPicked] = useState<SignItem[]>([])
  const [pick, setPick] = useState<string | null>(null)
  const { busy, askApprove, askReject, askApproveMany, dialogs } = useApprovalDecision(
    () => {
      setPicked([])
      setPick(null)
      router.refresh()
    },
  )

  const theoLoai = kind === 'all' ? box.items : box.items.filter((i) => i.kind === kind)
  const phongs = useMemo(() => demTheoPhong(theoLoai), [theoLoai])
  const base =
    phong === 'all'
      ? theoLoai
      : theoLoai.filter((i) => LOAI_PHIEU[i.kind].phong === phong)

  const ownerKey = (i: SignItem) => i.owner_id ?? '@none'
  /* Người trình trong phạm vi đang xem, đông phiếu trước — chỉ khi gom theo người. */
  const owners = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>()
    for (const i of base) {
      const k = ownerKey(i)
      const cur = m.get(k) ?? { name: i.owner_name ?? 'Chưa rõ người trình', n: 0 }
      cur.n++
      m.set(k, cur)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [base])
  const items = gom === 'nguoi' && who !== 'all' ? base.filter((i) => ownerKey(i) === who) : base // prettier-ignore

  /* Khối hiển thị: theo loại (mặc định) hoặc theo người trình. */
  const gap = gom === 'loai' ? xepGap(items) : []
  const khoi =
    gom === 'loai'
      ? gomTheoLoai(items).map((g) => ({
          key: g.loai,
          loai: g.loai as LoaiPhieu | null,
          ten: `${PHONG_NHAN[g.khai.phong]} · ${g.khai.ten}`,
          so: g.khai.so,
          rows: g.items,
        }))
      : owners
          .map(([k, o]) => ({
            key: k,
            loai: null as LoaiPhieu | null,
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
  /* Tiền tệ chưa có ngưỡng → mọi phiếu tệ đó đều "giá trị lớn". Nói ra, đừng
     để người ký tự đoán vì sao cả nhóm không có ô tích. */
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
  const chonCaKhoi = (rows: SignItem[], on: boolean) =>
    setPicked(on ? rows.filter(kyNhanhDuoc) : [])

  const nhieu = picked.length > 0
  const chuaChon = !nhieu && !sel
  const lyDo = chuaChon ? 'Chọn một phiếu trong bảng trước' : undefined
  /* Đơn chờ ký bù đã rời bàn chờ duyệt — ký bù / không đồng ý ở màn Xem kỹ. */
  const lateSel =
    !nhieu && sel?.late_sign
      ? 'Đơn đã gửi gấp — bấm "Xem kỹ" đọc lý do rồi ký bù'
      : undefined
  const gapTong = xepGap(box.items).length

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow={eyebrow}
        title="Chờ tôi phê duyệt"
        facts={[
          { label: 'Phiếu chờ', value: String(box.stats.total) },
          ...(gapTong > 0
            ? [{ label: 'Cần ký trước', value: String(gapTong), tone: 'warn' as const }]
            : []),
          ...(box.stats.total > 0
            ? [
                {
                  label: 'Lâu nhất',
                  value: `${box.stats.oldest_days} ngày`,
                  tone:
                    box.stats.oldest_days >= 7 ? ('stop' as const) : ('warn' as const),
                },
                {
                  label: 'Giá trị (đơn mua gồm VAT)',
                  value: box.stats.value
                    .map((v) => money(v.value, v.currency))
                    .join(' · '),
                },
              ]
            : []),
          ...(box.decided_today.approved + box.decided_today.rejected > 0
            ? [
                {
                  label: 'Hôm nay đã xử lý',
                  value: `${box.decided_today.approved} ký${
                    box.decided_today.rejected > 0
                      ? `, ${box.decided_today.rejected} trả lại`
                      : ''
                  }`,
                },
              ]
            : []),
        ]}
        actions={
          <>
            {historyHref && (
              <Btn icon="lichSu" href={historyHref}>
                Lịch sử ký
              </Btn>
            )}
            {ruleHref && (
              <Btn icon="thongTin" href={ruleHref}>
                Luật ký
              </Btn>
            )}
          </>
        }
      />

      {box.stats.total > 0 && (
        <FilterBar dense label="Lọc phiếu chờ ký">
          <BarLabel>Phòng</BarLabel>
          <Chip
            on={phong === 'all'}
            count={theoLoai.length}
            onClick={() => {
              setPhong('all')
              setPicked([])
            }}
          >
            Tất cả
          </Chip>
          {phongs.map((p) => (
            <Chip
              key={p.phong}
              on={phong === p.phong}
              count={p.n}
              onClick={() => {
                setPhong(phong === p.phong ? 'all' : p.phong)
                setWho('all')
                setPicked([])
              }}
            >
              {p.nhan}
            </Chip>
          ))}
          {kind !== 'all' && (
            <Chip on onClick={() => setKind('all')}>
              Chỉ {LOAI_PHIEU[kind].nhan} ✕
            </Chip>
          )}
          <BarSep />
          <BarLabel>Gom</BarLabel>
          <Chip on={gom === 'loai'} onClick={() => setGom('loai')}>
            Theo loại phiếu
          </Chip>
          <Chip
            on={gom === 'nguoi'}
            onClick={() => {
              setGom('nguoi')
              setWho('all')
            }}
          >
            Theo người trình
          </Chip>
          {gom === 'nguoi' && owners.length > 1 && (
            <>
              <BarSep />
              {owners.map(([k, o]) => (
                <Chip
                  key={k}
                  on={who === k}
                  count={o.n}
                  onClick={() => {
                    setWho(who === k ? 'all' : k)
                    setPicked([])
                  }}
                >
                  {o.name}
                </Chip>
              ))}
            </>
          )}
        </FilterBar>
      )}

      {noRule.length > 0 && (
        <NoticeBar
          tone="warn"
          tag="Luật ký"
          action={
            ruleHref
              ? { label: 'Đặt ngưỡng', onClick: () => router.push(ruleHref) }
              : undefined
          }
        >
          Chưa đặt ngưỡng cho <b>{noRule.join(', ')}</b> — mọi đơn tính bằng tiền đó bị
          coi là giá trị lớn, phải mở ra ký từng phiếu.
        </NoticeBar>
      )}

      {items.length === 0 ? (
        <EmptyCenter box={box} filtered={box.stats.total > 0} historyHref={historyHref} />
      ) : (
        <>
          <FilterBar dense tone={nhieu ? 'selected' : 'raised'} label="Ký phiếu">
            <span
              className={
                nhieu
                  ? 'num text-k-sm mr-1 shrink-0 font-semibold text-[var(--act-text)]'
                  : 'text-k-sm mr-1 shrink-0 text-[var(--ink-3)]'
              }
            >
              {nhieu
                ? `${picked.length} ${LOAI_PHIEU[picked[0].kind].nhan.toLowerCase()} đã chọn · ${moneyText(picked)}`
                : sel
                  ? `${sel.code} · ${sel.po?.supplier_short ?? sel.party} · ${money(sel.value, sel.currency)}`
                  : 'Chưa chọn phiếu nào'}
            </span>
            {nhieu && <Btn onClick={() => setPicked([])}>Bỏ chọn</Btn>}
            <Btn
              primary={!chuaChon && !lateSel}
              disabled={busy || chuaChon || !!lateSel}
              title={lyDo ?? lateSel}
              icon="duyet"
              onClick={() =>
                nhieu
                  ? askApproveMany(picked.map(target))
                  : sel && askApprove(target(sel))
              }
            >
              {nhieu ? `Ký ${picked.length} phiếu` : 'Ký duyệt'}
            </Btn>
            <Btn
              disabled={busy || !sel || !!lateSel}
              icon="traLai"
              title={
                nhieu
                  ? 'Trả lại phải ghi lý do cho từng phiếu — chọn một phiếu'
                  : (lyDo ?? lateSel)
              }
              onClick={() => sel && askReject(target(sel))}
            >
              Trả lại để sửa
            </Btn>
            <Btn disabled={!sel} icon="mo" title={lyDo} href={sel ? sel.href : undefined}>
              Xem kỹ
            </Btn>
            {bigCount > 0 && (
              <span className="ml-auto">
                <Hint>
                  <b>{bigCount} phiếu Giá trị lớn</b> phải mở ra đọc, không ký hàng loạt
                  được
                </Hint>
              </span>
            )}
          </FilterBar>

          <Table>
            <THead pinFirst>
              <th style={{ width: 30 }} />
              <th style={{ width: 190 }}>Mã phiếu</th>
              <th style={{ width: 200 }}>Đối tác / người</th>
              <th>Nội dung</th>
              <th style={{ width: 140 }}>Lệnh / ngữ cảnh</th>
              <th style={{ width: 110, textAlign: 'right' }}>Hẹn</th>
              <th style={{ width: 130, textAlign: 'right' }}>Giá trị</th>
              <th style={{ width: 92 }}>Chờ</th>
            </THead>
            {gap.length > 0 && (
              <tbody>
                <GroupRow
                  name="Cần ký trước"
                  cols={COLS}
                  meta={`${gap.length} phiếu · mọi loại · ký bù, hẹn giao đã qua, chờ từ 3 ngày`}
                />
                {gap.map((i) => (
                  <SignRow
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
                  <GroupRow
                    name={g.ten}
                    cols={COLS}
                    meta={
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          {g.rows.length} phiếu · {moneyText(g.rows)} · lâu nhất{' '}
                          {Math.max(...g.rows.map((r) => r.waiting_days))} ngày
                        </span>
                        {nhanh.length > 1 && (
                          <label className="flex cursor-pointer items-center gap-1.5 normal-case">
                            <Tick
                              checked={daChon}
                              label={`Chọn ${nhanh.length} phiếu ký nhanh trong khối ${g.ten}`}
                              onChange={(on) => chonCaKhoi(g.rows, on)}
                            />
                            Chọn {nhanh.length} phiếu ký nhanh
                          </label>
                        )}
                        {g.so && (
                          <a
                            href={g.so}
                            className="text-[var(--act-text)] normal-case hover:underline"
                          >
                            Sổ tra cứu ›
                          </a>
                        )}
                      </span>
                    }
                  />
                  {g.loai && <KhoiDauCot loai={g.loai} />}
                  {g.rows.map((i) => (
                    <SignRow
                      key={itemKey(i)}
                      i={i}
                      today={today}
                      selected={itemKey(i) === pick}
                      checked={pickedKeys.has(itemKey(i))}
                      onPick={() => setPick(itemKey(i))}
                      onToggle={() => toggle(i)}
                    />
                  ))}
                </tbody>
              )
            })}
            {/*
              CHÂN BẢNG: 6 + 2 = 8 cột, bằng THead. Tiền mỗi loại một dòng —
              "118.452 USD · 1.720.560.560 ₫" nhét một ô 130px thì vỡ dòng giữa
              chừng (soi 1:1, 27/09/2026). Phiếu trong khối "Cần ký trước" cũng
              nằm trong khối loại của nó — chỉ cộng một lần.
            */}
            <TFoot
              label={
                <td colSpan={6}>
                  Cộng {items.length} phiếu đang chờ{' '}
                  <span className="font-normal">
                    <Hint size="sm">· cộng riêng từng loại tiền, KHÔNG quy đổi</Hint>
                  </span>
                </td>
              }
              cells={
                <td className="num" colSpan={2}>
                  {sumByCurrency(items).map(([cur, v]) => (
                    <div key={cur}>{money(v, cur)}</div>
                  ))}
                </td>
              }
            />
          </Table>
        </>
      )}

      <StatusBar
        left={[
          phong === 'all' ? 'Mọi phòng' : `Phòng: ${PHONG_NHAN[phong]}`,
          gom === 'loai' ? 'Gom theo loại phiếu' : 'Gom theo người trình',
          bigCount > 0 ? `${bigCount} phiếu Giá trị lớn` : 'Không có phiếu Giá trị lớn',
        ]}
        right={`${items.length} / ${box.stats.total} phiếu`}
      />

      {dialogs}
    </ScreenFrame>
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
    <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
      <Empty
        headline={filtered ? 'Không có phiếu loại này' : 'Không có phiếu chờ duyệt'}
        reason={
          filtered
            ? `Bộ lọc đang bật không còn phiếu nào trong ${box.stats.total} phiếu của hộp.`
            : neverUsed
              ? 'Hệ thống chưa từng có phiếu nào được lập — không phải bạn đã ký hết.'
              : noPo
                ? `Mọi phiếu đã được xử lý. Riêng đơn mua thì chưa có đơn nào trên hệ thống (${box.emptiness.lsx_total} lệnh sản xuất đã có) — phòng Cung ứng còn đang làm ngoài Excel.`
                : 'Mọi phiếu đã được xử lý.'
        }
        next={
          <>
            {historyHref && (
              <Btn icon="lichSu" href={historyHref}>
                Xem lịch sử ký
              </Btn>
            )}
            {neverUsed && (
              <span className="text-k-sm self-center text-[var(--ink-3)]">
                Cần Kinh doanh phát lệnh sản xuất và Cung ứng lập đơn mua trên hệ thống
                thì phiếu mới chảy về đây.
              </span>
            )}
          </>
        }
      />
    </div>
  )
}
