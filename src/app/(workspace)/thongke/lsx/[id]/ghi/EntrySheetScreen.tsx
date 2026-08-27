'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import type { EntrySheet } from '@/modules/dept/production/worklist.service'

/**
 * MÀN LẬP PHIẾU (Sổ Sản Lượng v2 — B1). Một phiếu = lệnh × công đoạn × tổ ×
 * ngày; thân phiếu gom theo SP, dòng nào bỏ trống thì không vào phiếu.
 * Đơn vị đếm đổi theo công đoạn: phôi gõ chi tiết, hàn+ gõ MỘT SỐ theo BỘ.
 */

type LineDraft = {
  qty: string
  defect: string
  reason: string
  kg: string
  worker: string
  note: string
  open: boolean
}

const EMPTY: LineDraft = {
  qty: '',
  defect: '',
  reason: '',
  kg: '',
  worker: '',
  note: '',
  open: false,
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const num = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function EntrySheetScreen({
  sheet,
  userTeamId,
}: {
  sheet: EntrySheet
  userTeamId: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [date, setDate] = useState(sheet.today)
  // Tổ mặc định: tổ phụ trách công đoạn đang mở → tổ của người nhập → trống.
  const [teamId, setTeamId] = useState(() => {
    const byStage = sheet.teams.find((t) => t.stage_code === sheet.stage)
    if (byStage) return byStage.id
    if (userTeamId && sheet.teams.some((t) => t.id === userTeamId)) return userTeamId
    return ''
  })
  const [docNote, setDocNote] = useState('')
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const draftOf = (id: string) => drafts[id] ?? EMPTY
  const patch = (id: string, p: Partial<LineDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY), ...p } }))

  // Chấm ● cho dòng hệ đề xuất theo TỔ đang chọn (được giao / ghi 7 ngày qua).
  const suggestedSet = useMemo(
    () =>
      new Set(
        sheet.suggested.filter((s) => s.team_id === teamId).map((s) => s.component_id),
      ),
    [sheet.suggested, teamId],
  )

  const typed = useMemo(() => {
    const out: { component_id: string; d: LineDraft }[] = []
    for (const g of sheet.groups) {
      for (const l of g.lines) {
        const d = draftOf(l.component_id)
        if (num(d.qty) > 0 || num(d.defect) > 0)
          out.push({ component_id: l.component_id, d })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, sheet.groups])

  async function save(submit: boolean) {
    if (busy) return
    if (typed.length === 0) {
      toast.warning('Chưa có dòng nào có số', 'Gõ SL đạt hoặc phế vào ít nhất một dòng')
      return
    }
    for (const t of typed) {
      if (num(t.d.defect) > 0 && !t.d.reason.trim()) {
        toast.error('Phế phải kèm lý do', 'Có dòng ghi phế nhưng chưa ghi vì sao')
        return
      }
    }
    setBusy(true)
    try {
      const res = await api<{ warnings: string[]; doc_no: string }>(
        `/api/dept/production/lsx/${sheet.lsx.id}/entries`,
        {
          method: 'POST',
          body: {
            stage: sheet.stage,
            entry_date: date,
            team_department_id: teamId || null,
            submit,
            note: docNote.trim() || null,
            entries: typed.map(({ component_id, d }) => ({
              component_id,
              qty: num(d.qty),
              kg: d.kg.trim() ? num(d.kg) : null,
              defect_qty: num(d.defect),
              defect_reason: d.reason.trim() || null,
              worker_name: d.worker.trim() || null,
              note: d.note.trim() || null,
            })),
          },
        },
      )
      setWarnings(res.warnings)
      setDrafts({})
      setDocNote('')
      toast.success(
        submit
          ? `Phiếu ${res.doc_no} đã ghi chính thức`
          : `Phiếu ${res.doc_no} đã lưu nháp`,
        res.warnings.length
          ? `${res.warnings.length} cảnh báo — xem dưới bảng`
          : undefined,
      )
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được phiếu', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void save(true)
    }
  }

  const typedQty = typed.reduce((a, t) => a + num(t.d.qty), 0)

  return (
    <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Thống kê xưởng', href: '/thongke' },
          { label: 'Tiến độ theo lệnh', href: '/thongke/lenh' },
          { label: sheet.lsx.code, href: `/thongke/lsx/${sheet.lsx.id}` },
          { label: 'Ghi sổ' },
        ]}
        title={`Ghi sổ — ${sheet.stage_label}`}
        description={`${sheet.lsx.code} · ${sheet.lsx.customer_name}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/thongke/lsx/${sheet.lsx.id}`}>
              <ArrowLeft aria-hidden />
              Tiến độ lệnh
            </Link>
          </Button>
        }
      />

      {!sheet.can_record && (
        <div className="rounded-lg border border-[var(--warn)]/40 bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-2.5 text-sm">
          Lệnh chưa được duyệt hoặc đã kết thúc — màn chỉ để xem, không ghi được.
        </div>
      )}

      {/* Đầu phiếu: công đoạn (chip) + ngày + tổ */}
      <section className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {sheet.stages.map((s) => (
            <Link
              key={s.code}
              href={`/thongke/lsx/${sheet.lsx.id}/ghi?stage=${s.code}`}
              scroll={false}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                s.code === sheet.stage
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'border-input text-foreground border hover:bg-[var(--accent)]'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
        <span className="grow" />
        <label className="flex items-center gap-1.5 text-xs font-medium">
          Ngày
          <Input
            type="date"
            value={date}
            max={sheet.today}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs font-medium">
          Tổ
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="border-input bg-card text-foreground h-8 rounded-md border px-2 text-xs"
          >
            <option value="">— chọn tổ —</option>
            {sheet.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Thân phiếu — gom theo SP */}
      <div className="flex flex-col gap-3">
        {sheet.groups.map((g) => (
          <section
            key={g.order_line_id}
            className="bg-card overflow-hidden rounded-lg border"
          >
            <div className="bg-muted/60 flex flex-wrap items-center gap-2 border-b px-4 py-2">
              <span className="t-data text-sm font-semibold">{g.product_code}</span>
              <span className="text-muted-foreground text-xs">{g.product_name}</span>
              <span className="t-data text-muted-foreground ml-auto text-xs">
                × {fmt(g.qty)} bộ
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-[10px] uppercase">
                    <th className="px-4 py-1.5">Dòng ghi</th>
                    <th className="w-24 py-1.5 pr-2 text-right">Cần</th>
                    <th className="w-24 py-1.5 pr-2 text-right">Đã đạt</th>
                    <th className="w-28 py-1.5 pr-2 text-right">SL đạt</th>
                    <th className="w-24 py-1.5 pr-2 text-right">Phế</th>
                    <th className="w-44 py-1.5 pr-2">Lý do phế</th>
                    <th className="w-28 py-1.5 pr-2 text-right">kg</th>
                    <th className="w-10 py-1.5 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((l) => {
                    const d = draftOf(l.component_id)
                    const qty = num(d.qty)
                    const kgHint =
                      l.dm_kg != null && qty > 0
                        ? String(Math.round(l.dm_kg * qty * 100) / 100)
                        : ''
                    const isSet = l.unit === 'bộ' || l.kind === 'assembly'
                    return (
                      <FragmentRow
                        key={l.component_id}
                        open={d.open}
                        main={
                          <tr className="border-b last:border-b-0">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                {suggestedSet.has(l.component_id) && (
                                  <span
                                    className="text-[var(--primary)]"
                                    title="Hệ đề xuất: tổ đang cầm hàng được giao / đã ghi gần đây"
                                  >
                                    ●
                                  </span>
                                )}
                                {l.cluster && (
                                  <span className="text-muted-foreground text-xs">
                                    {l.cluster} ·
                                  </span>
                                )}
                                <span className="font-medium">{l.name}</span>
                                {isSet && <Badge tone="blue">BỘ</Badge>}
                              </div>
                              <div className="text-muted-foreground mt-0.5 text-[11px]">
                                {l.is_virtual &&
                                  'BOM phẳng — hệ gộp chi tiết thành 1 cụm/SP · '}
                                {l.pending > 0 && `chờ duyệt +${fmt(l.pending)} · `}
                                {l.today_qty > 0 && (
                                  <span className="text-[var(--warn)]">
                                    hôm nay đã ghi {fmt(l.today_qty)} ·{' '}
                                  </span>
                                )}
                                {l.unit && !isSet && `ĐVT ${l.unit}`}
                              </div>
                            </td>
                            <td className="t-data py-2 pr-2 text-right">
                              {fmt(l.needed)}
                            </td>
                            <td className="t-data py-2 pr-2 text-right">
                              {l.remaining <= 0 ? (
                                <span className="inline-flex items-center gap-1 text-[var(--done)]">
                                  <Check size={13} strokeWidth={2.2} aria-hidden />
                                  {fmt(l.done)}
                                </span>
                              ) : (
                                fmt(l.done)
                              )}
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={d.qty}
                                disabled={!sheet.can_record}
                                onChange={(e) =>
                                  patch(l.component_id, { qty: e.target.value })
                                }
                                className="t-data h-8 text-right"
                                aria-label={`SL đạt ${l.name}`}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={d.defect}
                                disabled={!sheet.can_record}
                                onChange={(e) =>
                                  patch(l.component_id, { defect: e.target.value })
                                }
                                className="t-data h-8 text-right"
                                aria-label={`Phế ${l.name}`}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              {num(d.defect) > 0 && (
                                <>
                                  <Input
                                    list="defect-reasons"
                                    value={d.reason}
                                    disabled={!sheet.can_record}
                                    onChange={(e) =>
                                      patch(l.component_id, { reason: e.target.value })
                                    }
                                    placeholder="vì sao phế?"
                                    className="h-8 text-xs"
                                    aria-label={`Lý do phế ${l.name}`}
                                  />
                                </>
                              )}
                            </td>
                            <td className="py-2 pr-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={d.kg}
                                disabled={!sheet.can_record}
                                onChange={(e) =>
                                  patch(l.component_id, { kg: e.target.value })
                                }
                                placeholder={kgHint}
                                title={
                                  kgHint
                                    ? `Bỏ trống = tự tính ${kgHint} kg (ĐM × SL)`
                                    : undefined
                                }
                                className="t-data h-8 text-right"
                                aria-label={`kg ${l.name}`}
                              />
                            </td>
                            <td className="py-2 pr-4 text-right">
                              <button
                                onClick={() => patch(l.component_id, { open: !d.open })}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={
                                  d.open ? 'Ẩn ô phụ' : 'Thêm người làm / ghi chú'
                                }
                                title="Người làm / ghi chú"
                              >
                                {d.open ? (
                                  <ChevronUp size={16} aria-hidden />
                                ) : (
                                  <ChevronDown size={16} aria-hidden />
                                )}
                              </button>
                            </td>
                          </tr>
                        }
                        extra={
                          <tr className="bg-muted/40 border-b last:border-b-0">
                            <td colSpan={8} className="px-4 py-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs">
                                  Người làm
                                  <Input
                                    value={d.worker}
                                    disabled={!sheet.can_record}
                                    onChange={(e) =>
                                      patch(l.component_id, { worker: e.target.value })
                                    }
                                    className="h-7 w-44 text-xs"
                                  />
                                </label>
                                <label className="flex grow items-center gap-1.5 text-xs">
                                  Ghi chú dòng
                                  <Input
                                    value={d.note}
                                    disabled={!sheet.can_record}
                                    onChange={(e) =>
                                      patch(l.component_id, { note: e.target.value })
                                    }
                                    className="h-7 grow text-xs"
                                  />
                                </label>
                              </div>
                            </td>
                          </tr>
                        }
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <datalist id="defect-reasons">
        {sheet.recent_defect_reasons.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {/* Cảnh báo của lần lưu gần nhất — KHÔNG chặn (FR-PR-07), nhưng phải đọc */}
      {warnings.length > 0 && (
        <section className="rounded-lg border border-[var(--warn)]/40 bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] px-4 py-3">
          <div className="mb-1 text-xs font-semibold text-[var(--warn)]">
            Cảnh báo (phiếu vẫn được lưu)
          </div>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-xs">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Chân phiếu */}
      <section className="bg-card sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 shadow-sm">
        <label className="flex min-w-56 grow items-center gap-1.5 text-xs font-medium">
          Ghi chú phiếu
          <Input
            value={docNote}
            disabled={!sheet.can_record}
            onChange={(e) => setDocNote(e.target.value)}
            placeholder="ghi chú chung cả phiếu (không bắt buộc)"
            className="h-8 grow text-xs"
          />
        </label>
        <span className="t-data text-muted-foreground text-xs">
          {typed.length} dòng · Σ đạt {fmt(typedQty)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !sheet.can_record}
          onClick={() => save(false)}
        >
          {busy && <Spinner size={14} />}
          Lưu nháp
        </Button>
        {/* User chốt 27/08: không cần tổ trưởng xác nhận — gửi là chính thức. */}
        <Button size="sm" disabled={busy || !sheet.can_record} onClick={() => save(true)}>
          {busy ? <Spinner size={14} /> : <Send aria-hidden />}
          Ghi sổ chính thức
          <span className="text-[10px] opacity-70">Ctrl+⏎</span>
        </Button>
      </section>
    </div>
  )
}

/** Cặp dòng chính + dòng phụ (người làm/ghi chú) — tbody không nhận Fragment key lồng tuỳ tiện nên tách nhỏ. */
function FragmentRow({
  main,
  extra,
  open,
}: {
  main: React.ReactNode
  extra: React.ReactNode
  open: boolean
}) {
  return (
    <>
      {main}
      {open && extra}
    </>
  )
}
