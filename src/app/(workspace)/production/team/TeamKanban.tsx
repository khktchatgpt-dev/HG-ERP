'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'
import { EmptyState } from '@/components/erp/EmptyState'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { TeamCard } from '@/modules/dept/production/team.service'

type Stage = { code: string; label: string }
type Board = {
  stage: string | null
  stage_label: string | null
  team: { id: string; name: string } | null
  cards: TeamCard[]
}

/** Cut-list trong modal thẻ — subset response GET /lsx/[id]/output. */
type OutputData = {
  components: {
    id: string
    name: string
    cluster: string | null
    total_needed: number
    allowed_stages: string[] | null
    summary: { stages: { stage: string; done: number; missing: number }[] }
  }[]
}

const COLUMNS: { key: TeamCard['status']; label: string; tone: string }[] = [
  { key: 'todo', label: 'Chưa làm', tone: 'border-t-zinc-300' },
  { key: 'doing', label: 'Đang làm', tone: 'border-t-amber-400' },
  { key: 'done', label: 'Hoàn thành', tone: 'border-t-green-500' },
]

/**
 * Kanban tối giản cho tổ trưởng/thống kê không thạo phần mềm: 3 cột trạng
 * thái, thẻ = LSX × công đoạn tổ mình, nút to "Bắt đầu"/"Xong công đoạn".
 * Xong → hệ thống tự báo tổ kế tiếp + quản đốc (event bus).
 */
export function TeamKanban({
  board,
  stages,
  canPick,
}: {
  board: Board
  stages: Stage[]
  canPick: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  // Bận theo TỪNG THẺ (lsx_id) — bấm 1 thẻ không khoá nút mọi thẻ khác.
  const [busyId, setBusyId] = useState<string | null>(null)
  const [switching, startSwitch] = useTransition()
  const [detail, setDetail] = useState<TeamCard | null>(null)

  async function mark(card: TeamCard, action: 'start' | 'done') {
    if (!board.stage) return
    if (action === 'done') {
      const ok = await confirm({
        title: `Xong công đoạn ${board.stage_label}?`,
        description: `${card.lsx_code} — ${card.customer_name}. Hệ thống sẽ báo tổ kế tiếp + quản đốc.`,
        confirmLabel: 'Xong',
      })
      if (!ok) return
    }
    setBusyId(card.lsx_id)
    try {
      await api('/api/dept/production/team/stage', {
        method: 'POST',
        body: { lsx_id: card.lsx_id, stage: board.stage, action },
      })
      toast.success(
        action === 'start'
          ? `Đã bắt đầu ${card.lsx_code}`
          : `${card.lsx_code}: xong ${board.stage_label}`,
        action === 'done' ? 'Đã báo tổ tiếp theo + quản đốc' : undefined,
      )
      router.refresh()
    } catch (e) {
      toast.error('Cập nhật thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusyId(null)
    }
  }

  const counts = {
    todo: board.cards.filter((c) => c.status === 'todo').length,
    doing: board.cards.filter((c) => c.status === 'doing').length,
    done: board.cards.filter((c) => c.status === 'done').length,
    late: board.cards.filter((c) => c.late && c.status !== 'done').length,
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busyId !== null || switching} />
      <PageHeader
        breadcrumbs={[
          { label: 'Sản xuất', href: '/production' },
          { label: 'Việc của tổ' },
        ]}
        title={
          board.team
            ? `Việc của ${board.team.name}`
            : board.stage_label
              ? `Việc công đoạn ${board.stage_label}`
              : 'Việc của tổ'
        }
        description={
          board.stage_label
            ? `Công đoạn ${board.stage_label} — bấm Bắt đầu khi vào việc, Xong khi hoàn tất; hệ thống tự báo tổ kế tiếp.`
            : 'Chọn công đoạn để xem bảng việc.'
        }
      />

      {canPick && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
          <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Công đoạn / tổ
          </label>
          <select
            value={board.stage ?? ''}
            disabled={switching}
            onChange={(e) => {
              const v = e.currentTarget.value
              startSwitch(() =>
                router.push(v ? `/production/team?stage=${v}` : '/production/team'),
              )
            }}
            className="min-w-48 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">— Chọn công đoạn —</option>
            {stages.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!board.stage ? (
        <EmptyState
          icon="▤"
          title={
            canPick ? 'Chọn công đoạn để xem bảng việc' : 'Tổ chưa được gán công đoạn'
          }
          description={
            canPick
              ? 'Mỗi công đoạn là bảng việc của tổ phụ trách công đoạn đó.'
              : 'Nhờ IT gán công đoạn cho tổ ở Quản trị → Phòng ban, hoặc đổi tên tổ theo công đoạn (VD "Tổ Hàn").'
          }
        />
      ) : (
        <>
          <StatsBar
            stats={[
              { label: 'Chưa làm', value: counts.todo, tone: 'gray' },
              { label: 'Đang làm', value: counts.doing, tone: 'amber' },
              { label: 'Hoàn thành', value: counts.done, tone: 'green' },
              { label: 'Trễ / sát hạn', value: counts.late, tone: 'red' },
            ]}
          />

          {board.cards.length === 0 ? (
            <EmptyState
              icon="▣"
              title="Không có lệnh nào qua công đoạn này"
              description="Khi có LSX được duyệt đi qua công đoạn của tổ, thẻ việc sẽ hiện ở đây."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  className={`flex flex-col gap-2 rounded-lg border border-t-4 border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/50 ${col.tone}`}
                >
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                      {col.label}
                    </h2>
                    <span className="text-xs font-medium text-zinc-400 tabular-nums">
                      {board.cards.filter((c) => c.status === col.key).length}
                    </span>
                  </div>
                  {board.cards
                    .filter((c) => c.status === col.key)
                    .map((card) => (
                      <div
                        key={card.lsx_id}
                        className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <button
                          onClick={() => setDetail(card)}
                          className="flex flex-col items-start gap-0.5 text-left"
                          title="Xem chi tiết cần làm + báo sự cố"
                        >
                          <span className="text-sm font-semibold">{card.lsx_code}</span>
                          <span className="text-xs text-zinc-500">
                            {card.customer_name} · đơn {card.order_code}
                          </span>
                          {card.ship_date && (
                            <span className="text-[10px] text-zinc-400">
                              Xuất hàng: {card.ship_date}
                            </span>
                          )}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {card.late && (
                            <Badge tone={card.late === 'overdue' ? 'red' : 'amber'}>
                              {card.late === 'overdue' ? '⚠ Trễ hạn' : '⚠ Sát hạn'}
                            </Badge>
                          )}
                          {!card.routed && (
                            <Badge tone="gray">Chưa định hình lộ trình</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {card.status === 'todo' && (
                            <button
                              disabled={busyId === card.lsx_id}
                              onClick={() => void mark(card, 'start')}
                              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                            >
                              {busyId === card.lsx_id && <Spinner size={12} />}▶ Bắt đầu
                            </button>
                          )}
                          {card.status === 'doing' && (
                            <button
                              disabled={busyId === card.lsx_id}
                              onClick={() => void mark(card, 'done')}
                              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {busyId === card.lsx_id && <Spinner size={12} />}✓ Xong công
                              đoạn
                            </button>
                          )}
                          {card.status === 'done' && (
                            <button
                              disabled={busyId === card.lsx_id}
                              onClick={() => void mark(card, 'start')}
                              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                              title="Mở lại nếu phải làm bổ sung / sửa hàng"
                            >
                              ↺ Làm lại
                            </button>
                          )}
                          <button
                            onClick={() => setDetail(card)}
                            className="ml-auto text-xs text-sky-600 hover:underline dark:text-sky-400"
                          >
                            Chi tiết →
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detail && board.stage && (
        <CardDetailModal
          card={detail}
          stage={board.stage}
          stageLabel={board.stage_label ?? board.stage}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}

/**
 * Modal thẻ: cut-list của công đoạn (KH = tổng cần, TT = đã làm, còn thiếu)
 * + ô báo sự cố gửi thẳng quản đốc. Tái dùng GET /lsx/[id]/output — không API mới.
 */
function CardDetailModal({
  card,
  stage,
  stageLabel,
  onClose,
}: {
  card: TeamCard
  stage: string
  stageLabel: string
  onClose: () => void
}) {
  const toast = useToast()
  const [data, setData] = useState<OutputData | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Nạp cut-list khi mở modal (đổi thẻ → nạp lại).
  useEffect(() => {
    let alive = true
    api<OutputData>(`/api/dept/production/lsx/${card.lsx_id}/output`)
      .then((d) => alive && setData(d))
      .catch(() => alive && setLoadFailed(true))
    return () => {
      alive = false
    }
  }, [card.lsx_id])

  async function reportIncident() {
    if (!message.trim()) return
    setSending(true)
    try {
      await api('/api/dept/production/incidents', {
        method: 'POST',
        body: { production_order_id: card.lsx_id, stage, message: message.trim() },
      })
      toast.success('Đã báo sự cố', 'Quản đốc sẽ nhận được thông báo')
      setMessage('')
      onClose()
    } catch (e) {
      toast.error('Báo sự cố thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setSending(false)
    }
  }

  // Chỉ chi tiết ĐI QUA công đoạn của tổ (chưa định hình = tất cả).
  const rows = (data?.components ?? []).filter(
    (c) => !c.allowed_stages || c.allowed_stages.includes(stage),
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={`${card.lsx_code} — ${stageLabel}`}
      maxWidth="sm:max-w-2xl"
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500">
          {card.customer_name} · đơn {card.order_code}
          {card.ship_date ? ` · xuất hàng ${card.ship_date}` : ''}
        </p>

        {!data && !loadFailed ? (
          <p className="text-xs text-zinc-400">Đang tải danh sách chi tiết…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-zinc-400">
            {loadFailed
              ? 'Không tải được danh sách chi tiết.'
              : 'Chưa có bảng chi tiết cho lệnh này (Kế hoạch nhập ở Định hình sản xuất).'}
          </p>
        ) : (
          <div className="max-h-72 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900">
                <tr className="text-left text-[10px] text-zinc-500 uppercase">
                  <th className="px-2 py-1.5">Chi tiết</th>
                  <th className="w-20 px-2 py-1.5 text-right">Định mức (KH)</th>
                  <th className="w-20 px-2 py-1.5 text-right">Thực tế (TT)</th>
                  <th className="w-20 px-2 py-1.5 text-right">Còn thiếu</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const s = c.summary.stages.find((x) => x.stage === stage)
                  const done = s?.done ?? 0
                  const missing = s ? Math.max(0, s.missing) : c.total_needed
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="px-2 py-1.5">
                        {c.cluster && (
                          <span className="text-[10px] text-zinc-400">
                            {c.cluster} ·{' '}
                          </span>
                        )}
                        {c.name}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium">
                        {c.total_needed.toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${done > 0 ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'}`}
                      >
                        {done.toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right ${missing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`}
                      >
                        {missing.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-zinc-400">
          Số lượng chi tiết nhập ở màn <b>Nhập sản lượng</b> — bảng này chỉ để tổ xem
          nhanh khối lượng còn lại.
        </p>

        {/* Báo sự cố — gửi thẳng quản đốc */}
        <div className="rounded-md border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
          <h3 className="mb-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
            ⚠ Báo sự cố (hỏng máy, thiếu vật tư, lỗi hàng loạt…)
          </h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="VD: Máy hàn số 2 hỏng, chờ sửa — ảnh hưởng tiến độ lệnh này"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-xs focus:border-red-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="mt-2 flex justify-end">
            <button
              disabled={sending || !message.trim()}
              onClick={() => void reportIncident()}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {sending && <Spinner size={12} />}Gửi báo cáo cho quản đốc
            </button>
          </div>
        </div>

        <div className="flex justify-between">
          <Link
            href={`/production/lsx/${card.lsx_id}`}
            className="text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            Xem chi tiết lệnh →
          </Link>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  )
}
