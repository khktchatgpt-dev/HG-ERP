'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarLabel,
  BarSep,
  Btn,
  FilterBar,
  Hint,
  Ico,
  ToneText,
  type IcoName,
  Cell,
  Chip,
  Code,
  Empty,
  GroupRow,
  NoticeBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Table,
  Tag,
  TFoot,
  THead,
  Tick,
} from '@/components/kit'
// `money` dùng CHUNG với trang chi tiết duyệt — hai màn nói cùng một con số.
import { money } from '../approval-helpers'
import { useApprovalDecision, type DecideTarget } from '../useApprovalDecision'
import type { SignBox, SignItem } from '@/modules/core/exec/exec.service'
import { materialSummary } from '@/lib/po-list-labels'

/**
 * TRUNG TÂM PHÊ DUYỆT (/exec/approvals) — MỌI loại phiếu chờ ký gom một chỗ,
 * KHÔNG chia theo phòng ban; chip lọc mới phân loại. Ký / trả lại ngay tại
 * dòng; "Xem kỹ" mở màn thẩm định đầy đủ của từng phiếu.
 *
 * CHUYỂN SANG KIT 17/09/2026: bản cũ bày mỗi phiếu thành một THẺ cao ~110px
 * cộng một bản bảng riêng từ 1280px — hai bố cục cho cùng một danh sách. Nay
 * MỘT lưới 30px, 15 phiếu vừa một màn, chân bảng cộng tiền theo từng loại tệ.
 *
 * MỘT HỘP KÝ CHO CẢ BA NGƯỜI KÝ (27/09/2026, artboard 5 — chủ dự án chốt):
 * anh Điền, Alex (khu Giám đốc) và chị Thảo (khu Cung ứng, chỉ có quyền duyệt
 * đơn mua — mở màn này ở /mua-hang/cho-ky). Người ký cần biết thêm ba điều mà
 * bản trước không nói:
 *  · AI TRÌNH — gom nhóm theo người mua / người gửi, lọc được theo người;
 *  · MUA GÌ — cột "loại · vật tư" (2 tên đầu + số mã còn lại);
 *  · HẸN GIAO ĐÃ QUA CHƯA — đo 27/09: 14/16 phiếu chờ có hẹn giao đã qua,
 *    lâu nhất 85 ngày; ký mà không biết là ký một đơn đã trễ.
 * Phiếu giá trị lớn mang BIỂU TƯỢNG KHOÁ ở ô tích thay vì nhãn lặp ở mọi dòng
 * (soi 1:1: 14 nhãn "Giá trị lớn" y hệt nhau chỉ là nhiễu).
 *
 * BA LUẬT GIỮ NGUYÊN:
 *  · phiếu GIÁ TRỊ LỚN không có ô tích — phải mở ra đọc, ký riêng;
 *  · ký nhiều phiếu gọi tuần tự, phiếu lỗi nằm lại trong hộp;
 *  · màn rỗng phải nói THẬT vì sao rỗng (đã ký hết ↔ chưa ai lập phiếu).
 */

const KIND_LABEL = { lsx: 'Lệnh SX', po: 'Đơn mua', quote: 'Báo giá' } as const
const KIND_ICON: Record<'lsx' | 'po' | 'quote', IcoName> = { lsx: 'lenh', po: 'don', quote: 'baoGia' } // prettier-ignore
const COLS = 8

export type ApprovalKind = 'all' | 'lsx' | 'po' | 'quote'

/** Cộng tiền theo TỪNG tiền tệ — USD và VND không bao giờ cộng chung. */
function sumByCurrency(items: SignItem[]): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value)
  return [...m.entries()]
}
const moneyText = (items: SignItem[]) =>
  sumByCurrency(items)
    .map(([cur, v]) => money(v, cur))
    .join(' · ')

/** "30/08" năm nay, "30/08/2025" năm khác. */
function dm(iso: string, today: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`
}

export function ApprovalCenterScreen({
  box,
  initialKind,
  eyebrow = 'Ban Giám đốc',
  historyHref = '/exec/approvals/history',
  ruleHref = '/exec/luat-ky',
}: {
  box: SignBox
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

  const counts = useMemo(
    () => ({
      all: box.items.length,
      lsx: box.items.filter((i) => i.kind === 'lsx').length,
      po: box.items.filter((i) => i.kind === 'po').length,
      quote: box.items.filter((i) => i.kind === 'quote').length,
    }),
    [box.items],
  )
  const ofKind = kind === 'all' ? box.items : box.items.filter((i) => i.kind === kind)
  const ownerKey = (i: SignItem) => i.owner_id ?? '@none'
  /* Người trình trong loại đang xem, đông phiếu trước — chip lọc + nhóm bảng. */
  const owners = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>()
    for (const i of ofKind) {
      const k = ownerKey(i)
      const cur = m.get(k) ?? { name: i.owner_name ?? 'Chưa rõ người trình', n: 0 }
      cur.n++
      m.set(k, cur)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [ofKind])
  const items = who === 'all' ? ofKind : ofKind.filter((i) => ownerKey(i) === who)
  const groups = owners
    .map(([k, o]) => ({
      key: k,
      name: o.name,
      rows: items.filter((i) => ownerKey(i) === k),
    }))
    .filter((g) => g.rows.length > 0)
  const onlyPo = ofKind.length > 0 && ofKind.every((i) => i.kind === 'po')

  const target = (i: SignItem): DecideTarget => ({
    kind: i.kind,
    id: i.id,
    code: i.code,
    label: `${i.party} · ${i.facts[0] ?? ''}`,
  })

  const key = (i: SignItem) => `${i.kind}-${i.id}`
  /** Phiếu giá trị lớn KHÔNG được ký hàng loạt — phải mở ra đọc rồi ký riêng. */
  const bulkable = items.filter((i) => !i.big)
  const pickedKeys = new Set(picked.map(key))
  const sel = items.find((i) => key(i) === pick) ?? null
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

  function toggle(i: SignItem) {
    setPicked((s) =>
      pickedKeys.has(key(i)) ? s.filter((x) => key(x) !== key(i)) : [...s, i],
    )
  }

  /*
    THANH HÀNH ĐỘNG — nút LUÔN nhìn thấy, chỉ bật/tắt theo lựa chọn hiện tại.
    Tích NHIỀU phiếu → ký hàng loạt; chọn MỘT dòng → ký / trả lại / xem kỹ;
    chưa chọn gì → cả ba nút xám kèm lý do.
  */
  const nhieu = picked.length > 0
  const chuaChon = !nhieu && !sel
  const lyDo = chuaChon ? 'Chọn một phiếu trong bảng trước' : undefined

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow={eyebrow}
        title="Chờ tôi phê duyệt"
        facts={[
          { label: 'Phiếu chờ', value: String(box.stats.total) },
          ...(box.stats.total > 0
            ? [
                {
                  label: 'Lâu nhất',
                  value: `${box.stats.oldest_days} ngày`,
                  tone:
                    box.stats.oldest_days >= 7 ? ('stop' as const) : ('warn' as const),
                },
                {
                  label: 'Giá trị',
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
          {(['all', 'lsx', 'po', 'quote'] as const).map((k) => (
            <Chip
              key={k}
              on={kind === k}
              count={counts[k]}
              icon={k === 'all' ? undefined : KIND_ICON[k]}
              onClick={() => {
                setKind(k)
                setWho('all')
                setPicked([])
              }}
            >
              {k === 'all' ? 'Tất cả' : KIND_LABEL[k]}
            </Chip>
          ))}
          {owners.length > 1 && (
            <>
              <BarSep />
              <BarLabel>{onlyPo ? 'Người mua' : 'Người trình'}</BarLabel>
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
          {bulkable.length > 1 && (
            <label className="text-k-sm ml-auto flex cursor-pointer items-center gap-2 text-[var(--ink-2)]">
              <Tick
                checked={bulkable.every((i) => pickedKeys.has(key(i)))}
                label={`Chọn ${bulkable.length} phiếu ký nhanh được`}
                onChange={(on) => setPicked(on ? bulkable : [])}
              />
              Chọn {bulkable.length} phiếu ký nhanh được
            </label>
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
        <EmptyCenter
          box={box}
          filtered={kind !== 'all' && box.stats.total > 0}
          historyHref={historyHref}
        />
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
                ? `${picked.length} phiếu đã chọn · ${moneyText(picked)}`
                : sel
                  ? `${sel.code} · ${sel.po?.supplier_short ?? sel.party} · ${money(sel.value, sel.currency)}`
                  : 'Chưa chọn phiếu nào'}
            </span>
            {nhieu && <Btn onClick={() => setPicked([])}>Bỏ chọn</Btn>}
            <Btn
              primary={!chuaChon}
              disabled={busy || chuaChon}
              title={lyDo}
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
              disabled={busy || !sel}
              icon="traLai"
              title={
                nhieu ? 'Trả lại phải ghi lý do cho từng phiếu — chọn một phiếu' : lyDo
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
              <th style={{ width: 170 }}>Mã phiếu</th>
              <th style={{ width: 170 }}>Nhà cung cấp / khách</th>
              <th>Nội dung</th>
              <th style={{ width: 150 }}>Lệnh SX</th>
              <th style={{ width: 120, textAlign: 'right' }}>Hẹn giao</th>
              <th style={{ width: 130, textAlign: 'right' }}>Giá trị</th>
              <th style={{ width: 92 }}>Chờ</th>
            </THead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  <GroupRow
                    name={g.name}
                    cols={COLS}
                    meta={`${g.rows.length} phiếu · ${moneyText(g.rows)} · lâu nhất ${Math.max(...g.rows.map((r) => r.waiting_days))} ngày`}
                  />
                  {g.rows.map((i) => (
                    <SignRow
                      key={key(i)}
                      i={i}
                      today={today}
                      selected={key(i) === pick}
                      checked={pickedKeys.has(key(i))}
                      onPick={() => setPick(key(i))}
                      onToggle={() => toggle(i)}
                    />
                  ))}
                </Fragment>
              ))}
            </tbody>
            {/*
              CHÂN BẢNG: 6 + 2 = 8 cột, bằng THead. Tiền mỗi loại một dòng —
              "118.452 USD · 1.720.560.560 ₫" nhét một ô 130px thì vỡ dòng giữa
              chừng (soi 1:1, 27/09/2026).
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
          kind === 'all' ? 'Mọi loại phiếu' : `Lọc: ${KIND_LABEL[kind]}`,
          who === 'all' ? 'Mọi người trình' : `Người trình: ${owners.find(([k]) => k === who)?.[1].name ?? ''}`, // prettier-ignore
          bigCount > 0 ? `${bigCount} phiếu Giá trị lớn` : 'Không có phiếu Giá trị lớn',
        ]}
        right={`${items.length} / ${box.stats.total} phiếu`}
      />

      {dialogs}
    </ScreenFrame>
  )
}

/** Một phiếu trong hộp ký. */
function SignRow({
  i,
  today,
  selected,
  checked,
  onPick,
  onToggle,
}: {
  i: SignItem
  today: string
  selected: boolean
  checked: boolean
  onPick: () => void
  onToggle: () => void
}) {
  const late = i.waiting_days >= 7
  const m = materialSummary(i.po?.materials ?? [])
  return (
    <Row selected={selected} onClick={onPick}>
      <Cell>
        {i.big ? (
          <span
            className="flex text-[var(--ink-3)]"
            title="Giá trị lớn — mở ra đọc rồi ký riêng, không ký hàng loạt"
          >
            <Ico name="khoa" size={13} label="Giá trị lớn — không ký hàng loạt" />
          </span>
        ) : (
          <Tick
            checked={checked}
            label={`Chọn phiếu ${i.code} để ký nhanh`}
            onChange={onToggle}
          />
        )}
      </Cell>
      <Cell>
        <span className="flex items-center gap-1.5">
          <Ico name={KIND_ICON[i.kind]} size={13} label={KIND_LABEL[i.kind]} />
          <Code
            as="a"
            href={i.href}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {i.code}
          </Code>
        </span>
      </Cell>
      <Cell title={i.party}>
        <span className="font-semibold">{i.po?.supplier_short ?? i.party}</span>
      </Cell>
      {i.po ? (
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
        </Cell>
      ) : (
        <Cell grow muted title={i.facts.join(' · ')}>
          {i.facts.join(' · ')}
        </Cell>
      )}
      <Cell muted>
        <span className="flex items-center gap-1.5">
          {i.po?.lsx_code ?? (i.kind === 'po' ? 'Ngoài lệnh' : '—')}
          {i.po?.lsx_done && (
            <span title="Mọi lệnh của đơn đã hoàn thành — sản xuất xong, đơn chưa được cập nhật">
              <Tag tone="warn">đã xong</Tag>
            </span>
          )}
        </span>
      </Cell>
      <Cell num>
        {!i.po ? (
          <span className="text-[var(--ink-empty)]">—</span>
        ) : !i.po.expected_at ? (
          <Tag tone="warn">chưa hẹn</Tag>
        ) : i.po.eta_late_days > 0 ? (
          <ToneText
            tone="stop"
            title={`Hẹn giao ${dm(i.po.expected_at, today)} đã qua ${i.po.eta_late_days} ngày`}
          >
            {dm(i.po.expected_at, today)}{' '}
            <span className="text-k-label">qua {i.po.eta_late_days} ng</span>
          </ToneText>
        ) : (
          dm(i.po.expected_at, today)
        )}
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
