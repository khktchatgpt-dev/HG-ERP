'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Clock,
  Factory,
  FileSearch,
  FileText,
  ShoppingCart,
  Undo2,
} from 'lucide-react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
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

/**
 * TRUNG TÂM PHÊ DUYỆT (/exec/approvals) — MỌI loại phiếu chờ Giám đốc gom một
 * chỗ, KHÔNG chia theo phòng ban; chip lọc mới phân loại. Ký / trả lại ngay
 * tại dòng; "Xem kỹ" mở màn thẩm định đầy đủ của từng phiếu.
 *
 * CHUYỂN SANG KIT 17/09/2026 — và đây là màn đáng chuyển nhất của khu.
 *
 * Bản cũ bày mỗi phiếu thành một THẺ bo tròn cao ~110px, cộng một bản bảng
 * riêng chỉ hiện từ 1280px: hai bố cục cho cùng một danh sách, ~250 dòng mã để
 * giữ chúng khớp nhau. Với 15 phiếu đang chờ, Giám đốc phải cuộn qua ba màn
 * hình mới thấy hết việc của mình.
 *
 * Nay MỘT lưới 30px cho mọi bề rộng: 15 phiếu vừa một màn, cộng chân bảng cộng
 * tiền theo từng loại tệ — con số mà bản cũ chỉ có ở dải chọn nhiều.
 *
 * BA LUẬT GIỮ NGUYÊN, không đụng tới:
 *  · phiếu GIÁ TRỊ LỚN không có ô tích — phải mở ra đọc, ký riêng;
 *  · ký nhiều phiếu gọi tuần tự, phiếu lỗi nằm lại trong hộp;
 *  · màn rỗng phải nói THẬT vì sao rỗng (đã ký hết ↔ chưa ai lập phiếu).
 *
 * THÊM thanh hành động luôn hiện, cùng luật với màn Đơn mua của Cung ứng:
 * chưa chọn dòng thì nút xám kèm lý do, không biến mất.
 */

const KIND_LABEL = { lsx: 'Lệnh SX', po: 'Đơn mua', quote: 'Báo giá' } as const
const KIND_ICON = { lsx: Factory, po: ShoppingCart, quote: FileText } as const

export type ApprovalKind = 'all' | 'lsx' | 'po' | 'quote'

/** Cộng tiền theo TỪNG tiền tệ — USD và VND không bao giờ cộng chung. */
function sumByCurrency(items: SignItem[]): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value)
  return [...m.entries()]
}

export function ApprovalCenterScreen({
  box,
  initialKind,
}: {
  box: SignBox
  initialKind: ApprovalKind
}) {
  const router = useRouter()
  const [kind, setKind] = useState<ApprovalKind>(initialKind)
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
  const items = kind === 'all' ? box.items : box.items.filter((i) => i.kind === kind)

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

  function toggle(i: SignItem) {
    setPicked((s) =>
      pickedKeys.has(key(i)) ? s.filter((x) => key(x) !== key(i)) : [...s, i],
    )
  }

  /*
    THANH HÀNH ĐỘNG — nút LUÔN nhìn thấy, chỉ bật/tắt theo lựa chọn hiện tại.

    Ba trạng thái: tích NHIỀU phiếu → ký hàng loạt; chọn MỘT dòng → ký / trả
    lại / xem kỹ phiếu đó; chưa chọn gì → cả ba nút xám kèm lý do. Người dùng
    mở màn ra là biết màn này làm được gì, không phải bấm thử mới biết.
  */
  const nhieu = picked.length > 0
  const chuaChon = !nhieu && !sel
  const lyDo = chuaChon ? 'Chọn một phiếu trong bảng trước' : undefined

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Ban Giám đốc"
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
          <Btn href="/exec/approvals/history">
            <FileText className="size-4" aria-hidden />
            Lịch sử ký
          </Btn>
        }
      />

      {box.stats.total > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[5px]">
          {(['all', 'lsx', 'po', 'quote'] as const).map((k) => {
            const Icon = k === 'all' ? null : KIND_ICON[k]
            return (
              <Chip key={k} on={kind === k} count={counts[k]} onClick={() => setKind(k)}>
                {Icon && <Icon className="size-[14px]" aria-hidden />}
                {k === 'all' ? 'Tất cả' : KIND_LABEL[k]}
              </Chip>
            )
          })}
          {bulkable.length > 1 && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[var(--fs-sm)] text-[var(--ink-2)]">
              <Tick
                checked={bulkable.every((i) => pickedKeys.has(key(i)))}
                label={`Chọn ${bulkable.length} phiếu ký nhanh được`}
                onChange={(on) => setPicked(on ? bulkable : [])}
              />
              Chọn {bulkable.length} phiếu ký nhanh được
            </label>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyCenter box={box} filtered={kind !== 'all' && box.stats.total > 0} />
      ) : (
        <>
          {/* THANH HÀNH ĐỘNG — xem ghi chú ở `nhieu` / `chuaChon`. */}
          <div
            className={
              nhieu
                ? 'flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--act-wash)] px-[var(--gutter)] py-[5px]'
                : 'flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-[5px]'
            }
          >
            <span
              className={
                nhieu
                  ? 'num mr-1 shrink-0 font-semibold text-[var(--act-text)] text-[var(--fs-sm)]'
                  : 'mr-1 shrink-0 text-[var(--fs-sm)] text-[var(--ink-3)]'
              }
            >
              {nhieu
                ? `${picked.length} phiếu đã chọn · ${sumByCurrency(picked)
                    .map(([cur, v]) => money(v, cur))
                    .join(' · ')}`
                : sel
                  ? sel.code
                  : 'Chưa chọn phiếu nào'}
            </span>
            {nhieu && <Btn onClick={() => setPicked([])}>Bỏ chọn</Btn>}
            <Btn
              primary={!chuaChon}
              disabled={busy || chuaChon}
              title={lyDo}
              onClick={() =>
                nhieu
                  ? askApproveMany(picked.map(target))
                  : sel && askApprove(target(sel))
              }
            >
              <Check className="size-4" aria-hidden />
              {nhieu ? `Ký ${picked.length} phiếu` : 'Ký duyệt'}
            </Btn>
            <Btn
              disabled={busy || !sel}
              title={
                nhieu ? 'Trả lại phải ghi lý do cho từng phiếu — chọn một phiếu' : lyDo
              }
              onClick={() => sel && askReject(target(sel))}
            >
              <Undo2 className="size-4" aria-hidden />
              Trả lại để sửa
            </Btn>
            <Btn disabled={!sel} title={lyDo} href={sel ? hrefOf(sel) : undefined}>
              <FileSearch className="size-4" aria-hidden />
              Xem kỹ
            </Btn>
            {bigCount > 0 && (
              <span className="ml-auto text-[var(--fs-micro)] text-[var(--ink-3)]">
                {bigCount} phiếu <b>Giá trị lớn</b> phải mở ra đọc, không ký hàng loạt
                được
              </span>
            )}
          </div>

          <Table>
            <THead pinFirst>
              <th style={{ width: 30 }} />
              <th style={{ width: 104 }}>Loại</th>
              <th style={{ width: 150 }}>Mã phiếu</th>
              <th>Nội dung</th>
              <th style={{ width: 128, textAlign: 'right' }}>Giá trị</th>
              <th style={{ width: 104 }}>Chờ</th>
            </THead>
            <tbody>
              {items.map((i) => {
                const Icon = KIND_ICON[i.kind]
                const gap = i.waiting_days >= 7
                return (
                  <Row
                    key={key(i)}
                    selected={key(i) === pick}
                    onClick={() => setPick(key(i))}
                  >
                    <Cell>
                      {/* Giá trị lớn KHÔNG có ô tích — luật cũ, giữ nguyên. */}
                      {i.big ? null : (
                        <Tick
                          checked={pickedKeys.has(key(i))}
                          label={`Chọn phiếu ${i.code} để ký nhanh`}
                          onChange={() => toggle(i)}
                        />
                      )}
                    </Cell>
                    <Cell muted>
                      <span className="flex items-center gap-[5px] font-semibold tracking-[.04em] text-[var(--fs-micro)] uppercase">
                        <Icon className="size-[13px]" aria-hidden />
                        {KIND_LABEL[i.kind]}
                      </span>
                    </Cell>
                    <Cell>
                      <span className="flex items-center gap-[6px]">
                        <Code as="a" href={hrefOf(i)}>
                          {i.code}
                        </Code>
                        {i.big && <Tag tone="neutral">Giá trị lớn</Tag>}
                      </span>
                    </Cell>
                    <Cell>
                      {i.party}
                      {i.facts.length > 0 && (
                        <span className="ml-1 text-[var(--fs-micro)] text-[var(--ink-3)]">
                          · {i.facts.join(' · ')}
                        </span>
                      )}
                    </Cell>
                    <Cell num>{i.value > 0 ? money(i.value, i.currency) : '—'}</Cell>
                    <Cell>
                      <span
                        className={
                          gap
                            ? 'flex items-center gap-[5px] font-semibold text-[var(--fs-sm)] text-[var(--stop)]'
                            : 'flex items-center gap-[5px] text-[var(--fs-sm)] text-[var(--ink-2)]'
                        }
                      >
                        {gap ? (
                          <AlertTriangle className="size-[13px]" aria-hidden />
                        ) : (
                          <Clock className="size-[13px]" aria-hidden />
                        )}
                        {i.waiting_days <= 0 ? 'hôm nay' : `${i.waiting_days} ngày`}
                      </span>
                    </Cell>
                  </Row>
                )
              })}
            </tbody>
            {/*
              CHÂN BẢNG CỘNG TIỀN — bản cũ chỉ cộng khi đã tích chọn, nên câu
              hỏi đầu tiên của người ký ("tổng bao nhiêu tiền đang chờ tôi")
              phải tự cộng bằng mắt.
            */}
            <TFoot
              label={<td colSpan={4}>Cộng {items.length} phiếu đang chờ</td>}
              cells={
                <td className="num">
                  {sumByCurrency(items)
                    .map(([cur, v]) => money(v, cur))
                    .join(' · ') || '—'}
                </td>
              }
              caveat="Cộng riêng từng loại tiền, KHÔNG quy đổi."
            />
          </Table>
        </>
      )}

      <StatusBar
        left={[
          kind === 'all' ? 'Mọi loại phiếu' : `Lọc: ${KIND_LABEL[kind]}`,
          bigCount > 0 ? `${bigCount} phiếu Giá trị lớn` : 'Không có phiếu Giá trị lớn',
        ]}
        right={`${items.length} / ${box.stats.total} phiếu`}
      />

      {dialogs}
    </ScreenFrame>
  )
}

/** Đường tới màn thẩm định đầy đủ của từng loại phiếu. */
function hrefOf(i: SignItem): string {
  return `/exec/approvals/${i.kind}/${i.id}`
}

/**
 * Màn rỗng phải NÓI THẬT vì sao rỗng. "0 phiếu chờ" có hai nghĩa trái ngược:
 * đã ký hết (tốt) hoặc chưa ai từng lập phiếu trên hệ thống (dữ liệu chưa lên).
 */
function EmptyCenter({ box, filtered }: { box: SignBox; filtered: boolean }) {
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
            <Btn href="/exec/approvals/history">
              <FileText className="size-4" aria-hidden />
              Xem lịch sử ký
            </Btn>
            {neverUsed && (
              <span className="self-center text-[var(--fs-sm)] text-[var(--ink-3)]">
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
