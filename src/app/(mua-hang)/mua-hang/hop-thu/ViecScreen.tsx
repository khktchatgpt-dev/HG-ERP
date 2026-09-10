'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Affected,
  Btn,
  Cell,
  Code,
  DateInput,
  Consequence,
  DocChain,
  Empty,
  InspectPanel,
  InspectSection,
  NextAction,
  NoticeBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  Sheet,
  SheetActions,
  StatusBar,
  THead,
  Table,
  Tag,
  TextArea,
  Tick,
  WhyBox,
  WorkLanes,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { SUPPLY_TODO, type SupplyTodoKind } from '@/lib/supply-watch'
import { KIND_ACTION, type ActionSpec } from './actions'

export type Viec = {
  id: string
  kind: SupplyTodoKind
  code: string
  status: string
  supplier: string
  lsx: string | null
  assignee: string | null
  assigned_to: string | null
  expected_at: string | null
  total: number
  currency: string
  lines_done: number
  lines_total: number
  updated_at: string
  can_act: boolean
}

const TONE: Record<string, 'stop' | 'warn' | 'done' | 'neutral'> = {
  stop: 'stop',
  warn: 'warn',
  primary: 'neutral',
  muted: 'neutral',
}

const dmy = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

/** Số ngày giữa hai mốc yyyy-mm-dd. Tính bằng UTC để không lệch múi giờ. */
function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(b) - t(a)) / 86_400_000)
}

const KIND_ORDER = (Object.keys(SUPPLY_TODO) as SupplyTodoKind[]).sort(
  (a, b) => SUPPLY_TODO[a].order - SUPPLY_TODO[b].order,
)

/**
 * LÀN MỞ ĐẦU — làn KHẨN NHẤT CÒN VIỆC, không phải luôn là "Quá hẹn giao".
 *
 * Lỗi bắt được khi chạy thật 10/09/2026: mặc định luôn mở làn "Quá hẹn giao";
 * phòng đang có 0 việc quá hẹn và 65 việc ở làn "Nháp chưa gửi duyệt", nên
 * người dùng mở hộp thư ra là thấy màn hình trống trong khi việc chất đống ở
 * tab bên cạnh. Hộp thư mà nói "hết việc" khi còn 65 việc là hỏng đúng thứ nó
 * sinh ra để làm.
 *
 * Vẫn ưu tiên làn ghi trên URL: người bấm ô việc ở trang Vào việc là đang chỉ
 * đích danh, đừng đưa họ đi chỗ khác.
 */
function firstLane(
  viec: Viec[],
  scope: 'toi' | 'phong',
  meId: string,
  asked: string | null,
): SupplyTodoKind {
  if (asked && KIND_ORDER.includes(asked as SupplyTodoKind)) return asked as SupplyTodoKind
  const seen = scope === 'toi' ? viec.filter((v) => v.assigned_to === meId) : viec
  return KIND_ORDER.find((k) => seen.some((v) => v.kind === k)) ?? KIND_ORDER[0]
}

export function ViecScreen({
  today,
  meId,
  viec,
  initialKind,
  initialScope,
  truncatedAt,
}: {
  today: string
  meId: string
  viec: Viec[]
  initialKind: string | null
  initialScope: 'toi' | 'phong'
  truncatedAt: number | null
}) {
  const router = useRouter()
  const toast = useToast()

  const [scope, setScope] = useState<'toi' | 'phong'>(initialScope)
  const [kind, setKind] = useState<SupplyTodoKind>(() =>
    firstLane(viec, initialScope, meId, initialKind),
  )
  const [pick, setPick] = useState<string | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
  const [sheet, setSheet] = useState<null | { spec: ActionSpec; ids: string[] }>(null)
  const [note, setNote] = useState('')
  const [newDate, setNewDate] = useState('')
  const [busy, setBusy] = useState(false)

  const inScope = useMemo(
    () => (scope === 'toi' ? viec.filter((v) => v.assigned_to === meId) : viec),
    [viec, scope, meId],
  )

  // Làn dựng từ TẬP ĐANG XEM: số trên làn phải bằng đúng số dòng mở ra thấy.
  const lanes = KIND_ORDER.map((k) => ({
    id: k,
    label: SUPPLY_TODO[k].label,
    rows: inScope.filter((v) => v.kind === k),
    tone: k === 'overdue' ? ('stop' as const) : undefined,
  }))

  const rows = lanes.find((l) => l.id === kind)?.rows ?? []
  const sel = rows.find((r) => r.id === pick) ?? null
  const spec = KIND_ACTION[kind]

  // Chỉ tích được dòng mình có quyền ghi — tránh bày nút rồi server chặn.
  const tickable = rows.filter((r) => r.can_act)
  const chosen = ticked.filter((id) => tickable.some((r) => r.id === id))

  /**
   * Làn KHÁC còn việc — để trạng thái rỗng không nói dối.
   *
   * "Không còn việc nào" trong khi tab bên cạnh có 65 việc là câu sai sự thật,
   * và người đọc tin nó rồi đóng máy đi về.
   */
  const elsewhere = KIND_ORDER.filter(
    (k) => k !== kind && inScope.some((v) => v.kind === k),
  )
  const elseCount = inScope.filter((v) => v.kind !== kind).length

  function reset() {
    setPick(null)
    setTicked([])
    setSheet(null)
    setNote('')
    setNewDate('')
  }

  function switchLane(id: string) {
    setKind(id as SupplyTodoKind)
    reset()
  }

  /**
   * Chạy một việc trên nhiều đơn.
   *
   * TUẦN TỰ, không `Promise.all`: các route này ghi vào cùng vài bảng và có
   * emit sự kiện; bắn song song 10 lượt thì lỗi nào của đơn nào rất khó lần.
   * Chạy được tới đâu báo tới đó, và luôn `router.refresh()` kể cả khi hỏng
   * giữa chừng — nếu không, màn còn hiện những đơn đã xong.
   */
  async function run(ids: string[], sp: ActionSpec) {
    setBusy(true)
    let ok = 0
    let failCode = ''
    let failMsg = ''
    try {
      for (const id of ids) {
        const v = viec.find((x) => x.id === id)
        if (!v) continue
        try {
          for (const call of sp.build({ note: note.trim(), newDate, po: v })) {
            await api(call.path, { method: call.method, body: call.body })
          }
          ok += 1
        } catch (e) {
          failCode = v.code
          failMsg = apiErrorText(e)
          break
        }
      }
    } finally {
      setBusy(false)
      reset()
      router.refresh()
    }

    if (failCode) {
      toast.error(
        ok > 0 ? `Xong ${ok} đơn rồi dừng ở ${failCode}` : `Không làm được ${failCode}`,
        failMsg,
      )
    } else {
      toast.success(
        ids.length === 1 ? `${sp.done} ${viec.find((x) => x.id === ids[0])?.code ?? ''}` : `${sp.done} ${ok} đơn`, // prettier-ignore
      )
    }
  }

  function start(ids: string[]) {
    if (ids.length === 0) return
    if (spec.kindOfUi === 'link') {
      router.push(`/mua-hang/don/${ids[0]}`)
      return
    }
    if (spec.kindOfUi === 'direct') {
      void run(ids, spec)
      return
    }
    setNote('')
    setNewDate(spec.dateDefault === 'today' ? today : '')
    setSheet({ spec, ids })
  }

  const sheetInvalid =
    sheet != null &&
    ((sheet.spec.needNote && note.trim().length === 0) ||
      (sheet.spec.needDate && newDate.length === 0))

  return (
    <ScreenFrame>
      <ScreenHeader
        eyebrow="Mua hàng · Hộp thư việc"
        title="Chờ tôi xử lý"
        facts={[
          { label: 'Việc đang xem', value: String(inScope.length) },
          { label: 'Quá hẹn', value: String(lanes[0].rows.length), tone: lanes[0].rows.length > 0 ? 'stop' : undefined }, // prettier-ignore
          { label: 'Phạm vi', value: scope === 'toi' ? 'Đơn tôi phụ trách' : 'Cả phòng' },
        ]}
        actions={
          <>
            <Btn
              onClick={() => {
                setScope(scope === 'toi' ? 'phong' : 'toi')
                reset()
              }}
            >
              {scope === 'toi' ? 'Xem cả phòng' : 'Chỉ đơn của tôi'}
            </Btn>
            <Btn primary href="/mua-hang/don/moi">
              + Soạn đơn mua
            </Btn>
          </>
        }
      >
        <WorkLanes lanes={lanes} activeId={kind} onPick={switchLane} />
      </ScreenHeader>

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi" action={{ label: 'Mở danh sách đơn' }}>
          Sổ đơn chạm trần <b>{truncatedAt} đơn</b> khi nạp, nên có thể còn việc chưa hiện
          ở đây.
        </NoticeBar>
      )}

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {rows.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline={`Không còn việc nào ở "${SUPPLY_TODO[kind].label}"`}
              reason={
                elseCount > 0
                  ? `Nhưng còn ${elseCount} việc ở làn khác — gần nhất là "${SUPPLY_TODO[elsewhere[0]].label}".`
                  : scope === 'toi'
                    ? 'Trong phạm vi đơn bạn phụ trách. Cả phòng có thể vẫn còn.'
                    : 'Cả phòng đều sạch mọi nhóm việc.'
              }
              next={
                elseCount > 0 ? (
                  <Btn primary onClick={() => switchLane(elsewhere[0])}>
                    Sang “{SUPPLY_TODO[elsewhere[0]].label}” (
                    {inScope.filter((v) => v.kind === elsewhere[0]).length})
                  </Btn>
                ) : scope === 'toi' ? (
                  <Btn
                    onClick={() => {
                      setScope('phong')
                      reset()
                    }}
                  >
                    Xem cả phòng
                  </Btn>
                ) : (
                  <Btn href="/mua-hang">Về trang vào việc</Btn>
                )
              }
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead>
                <th style={{ width: 34 }} />
                <th>Đơn</th>
                <th>Nhà cung cấp</th>
                <th>Việc phải làm</th>
                <th>Lệnh SX</th>
                <th>Phụ trách</th>
                <th>Hẹn giao</th>
                <th style={{ textAlign: 'right' }}>Giá trị</th>
              </THead>
              <tbody>
                {rows.map((v) => (
                  <Row key={v.id} selected={v.id === pick} onClick={() => setPick(v.id)}>
                    <Cell>
                      {/*
                        Ô tick chỉ hiện ở dòng ghi được. Bày ô tick trên dòng
                        không có quyền là mời người ta chọn rồi bị server chặn.
                      */}
                      {v.can_act ? (
                        <Tick
                          checked={ticked.includes(v.id)}
                          label={`Chọn đơn ${v.code} — ${v.supplier}`}
                          onChange={() =>
                            setTicked((s) =>
                              s.includes(v.id)
                                ? s.filter((x) => x !== v.id)
                                : [...s, v.id],
                            )
                          }
                        />
                      ) : null}
                    </Cell>
                    <Cell>
                      <Code>{v.code}</Code>
                    </Cell>
                    <Cell grow>{v.supplier}</Cell>
                    <Cell>
                      <Tag tone={TONE[SUPPLY_TODO[v.kind].tone]}>
                        {SUPPLY_TODO[v.kind].action}
                      </Tag>
                    </Cell>
                    <Cell muted>{v.lsx ?? 'Ngoài LSX'}</Cell>
                    <Cell muted>{v.assignee ?? 'chưa giao ai'}</Cell>
                    <Cell num>
                      <Num value={dmy(v.expected_at)} strong={v.kind === 'overdue'} />
                    </Cell>
                    <Cell num>
                      <Num value={v.total > 0 ? v.total.toLocaleString('vi-VN') : ''} />
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>

            {/*
              THANH HÀNG LOẠT — dính đáy vùng bảng, chỉ hiện khi có dòng tích.
              Mọi dòng trong một làn đều cùng một việc, nên không có chuyện
              "các đơn đang chọn không cùng một bước" như màn danh sách.
            */}
            {chosen.length > 0 && spec.kindOfUi !== 'link' && (
              <div className="flex shrink-0 items-center gap-3 border-t border-[var(--line)] bg-[var(--act-wash)] px-[var(--gutter)] py-[9px]">
                <span className="num font-semibold text-[var(--act-text)] text-[var(--fs-sm)]">
                  {chosen.length} đơn đã chọn
                </span>
                <Btn onClick={() => setTicked([])}>Bỏ chọn</Btn>
                <span className="ml-auto">
                  <Btn primary disabled={busy} onClick={() => start(chosen)}>
                    {spec.label} {chosen.length} đơn
                  </Btn>
                </span>
              </div>
            )}
          </div>
        )}

        {sel && (
          <InspectPanel
            code={sel.code}
            title={SUPPLY_TODO[sel.kind].action}
            subtitle={`${sel.supplier} · ${sel.lsx ?? 'Ngoài LSX'}`}
            actions={
              <>
                <Btn
                  primary
                  disabled={busy || (!sel.can_act && spec.kindOfUi !== 'link')}
                  title={
                    !sel.can_act && spec.kindOfUi !== 'link'
                      ? 'Đơn này do người khác phụ trách'
                      : undefined
                  }
                  onClick={() => start([sel.id])}
                >
                  {spec.label}
                </Btn>
                <Btn href={`/mua-hang/don/${sel.id}`}>Mở đơn đầy đủ</Btn>
              </>
            }
          >
            <InspectSection title="Đến lượt ai">
              <NextAction
                mine={sel.assigned_to === meId}
                holder={sel.assignee ?? 'chưa giao ai'}
                what={SUPPLY_TODO[sel.kind].action}
                days={daysBetween(sel.updated_at, today)}
                hint={SUPPLY_TODO[sel.kind].why}
              />
            </InspectSection>

            <InspectSection title="Vì sao đơn này ở đây">
              <WhyBox
                lines={
                  sel.expected_at
                    ? [
                        `hẹn giao ${dmy(sel.expected_at)}`,
                        `hôm nay ${dmy(today)}`,
                        `trạng thái ${sel.status}`,
                      ]
                    : [`chưa có hẹn giao`, `trạng thái ${sel.status}`]
                }
                result={
                  sel.expected_at
                    ? (() => {
                        const d = daysBetween(sel.expected_at, today)
                        return d > 0 ? `quá hẹn ${d} ngày` : d === 0 ? 'đến hẹn hôm nay' : `còn ${-d} ngày` // prettier-ignore
                      })()
                    : 'không có hẹn để so'
                }
              />
            </InspectSection>

            <InspectSection title="Về kho">
              <div className="text-[var(--fs-sm)] text-[var(--ink-2)]">
                {sel.lines_total > 0 ? (
                  <>
                    Đã về <b className="num">{sel.lines_done}</b> trên{' '}
                    <b className="num">{sel.lines_total}</b> dòng.
                  </>
                ) : (
                  'Đơn chưa có dòng vật tư nào.'
                )}
              </div>
            </InspectSection>

            <InspectSection title="Chuỗi chứng từ">
              <DocChain
                links={[
                  ...(sel.lsx
                    ? [{ label: 'Lệnh SX', code: sel.lsx, href: '/planning/lsx' }]
                    : []),
                  { label: 'Đơn mua', code: sel.code, href: `/mua-hang/don/${sel.id}`, muted: true }, // prettier-ignore
                ]}
              />
            </InspectSection>
          </InspectPanel>
        )}
      </div>

      <StatusBar
        left={[
          <>
            Nguồn việc: <b>đơn đặt vật tư</b>
          </>,
          'Lệnh sản xuất và phiếu kho chưa nối vào hộp thư này',
        ]}
        right={`${rows.length} việc trong làn · ${inScope.length} tổng`}
      />

      {sheet && (
        <Sheet
          open
          onClose={() => setSheet(null)}
          title={
            sheet.ids.length === 1
              ? `${sheet.spec.label} · ${viec.find((v) => v.id === sheet.ids[0])?.code ?? ''}`
              : `${sheet.spec.label} · ${sheet.ids.length} đơn`
          }
          subtitle={sheet.spec.sheetHint}
          stakes={sheet.spec.stakes}
          footer={
            <SheetActions
              stakes={sheet.spec.stakes}
              busy={busy}
              onCancel={() => setSheet(null)}
              onConfirm={() => void run(sheet.ids, sheet.spec)}
              confirmLabel={sheet.spec.label}
            />
          }
        >
          {sheet.spec.consequence && <Consequence>{sheet.spec.consequence}</Consequence>}

          {sheet.spec.needDate && (
            <label className="mb-3 block">
              <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                Ngày giao mới
              </span>
              <DateInput value={newDate} onChange={setNewDate} label="Ngày giao mới" />
            </label>
          )}

          {sheet.spec.needNote && (
            <label className="block">
              <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                {sheet.spec.noteLabel}
              </span>
              <TextArea
                value={note}
                onChange={setNote}
                rows={3}
                placeholder={sheet.spec.notePlaceholder}
              />
              <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                {sheet.spec.noteWhy}
              </span>
            </label>
          )}

          {sheet.ids.length > 1 && (
            <Affected
              items={sheet.ids.map((id) => {
                const v = viec.find((x) => x.id === id)
                return {
                  code: v?.code ?? id,
                  label: v?.supplier,
                  amount: v && v.total > 0 ? `${v.total.toLocaleString('vi-VN')} ${v.currency}` : undefined, // prettier-ignore
                }
              })}
            />
          )}

          {sheetInvalid && (
            <p className="mt-3 font-semibold text-[var(--fs-sm)] text-[var(--warn)]">
              {sheet.spec.needDate && newDate.length === 0
                ? 'Chọn ngày giao mới trước đã.'
                : 'Viết một câu nói bạn vừa làm gì — đây là thứ người sau đọc để khỏi làm lại.'}
            </p>
          )}
        </Sheet>
      )}
    </ScreenFrame>
  )
}
