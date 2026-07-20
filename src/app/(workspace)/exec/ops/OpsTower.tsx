'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { PageHeader } from '@/components/erp/PageHeader'
import { TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import type { OpsTower as OpsTowerData } from '@/modules/dept/production/ops.service'

/**
 * Tháp điều hành COO: (1) sơ đồ xưởng màu xanh/vàng/đỏ, (2) dòng chảy WIP —
 * điểm nghẽn giữa các công đoạn, (3) chất lượng drill-down 3 tầng (KPI →
 * tổ → nguyên nhân), (4) cung ứng, (5) sự cố xử lý tại chỗ.
 */

const fmtN = (n: number) => n.toLocaleString('vi-VN')
const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtT = (iso: string) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const pct = (r: number) => `${(r * 100).toFixed(1)}%`

const TEAM_TONE: Record<'red' | 'yellow' | 'green', string> = {
  red: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
  yellow: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
  green: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20',
}
const TEAM_DOT: Record<'red' | 'yellow' | 'green', string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-500',
  green: 'bg-green-500',
}

export function OpsTower({ data }: { data: OpsTowerData }) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  // Drill-down chất lượng: tổ đang chọn (tầng 3 = nguyên nhân của tổ đó).
  const [teamPick, setTeamPick] = useState<string | null | undefined>(undefined)

  const maxWip = Math.max(...data.wip_strip.map((w) => w.wip), 0)
  const q = data.quality
  const delta = q.last7.rate - q.prev7.rate
  const maxTeamRate = Math.max(...q.by_team.map((t) => t.rate), 0.0001)
  const picked =
    teamPick === undefined
      ? null
      : (q.by_team.find((t) => t.team_id === teamPick) ?? null)

  async function resolveIncident(inc: OpsTowerData['incidents'][number]) {
    const ok = await confirm({
      title: 'Đánh dấu sự cố đã xử lý?',
      description: inc.message,
      confirmLabel: 'Đã xử lý',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/production/incidents/${inc.id}/resolve`, {
        method: 'POST',
        body: {},
      })
      toast.success('Đã đóng sự cố', 'Người báo sẽ nhận được thông báo')
      router.refresh()
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Ban Giám đốc', href: '/exec' },
          { label: 'Tháp điều hành' },
        ]}
        title="Tháp điều hành"
        description="Vận hành thời gian thực: sơ đồ xưởng, điểm nghẽn WIP, chất lượng + nguyên nhân gốc, cung ứng. Bấm vào tổ / cột phế để khoan sâu."
      />

      {/* ── 1. Sơ đồ xưởng ── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Sơ đồ xưởng — 🟢 chạy tốt · 🟡 chậm/ứ · 🔴 sự cố
        </h2>
        {data.teams.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
            Chưa tổ nào được gán công đoạn (Quản trị → Phòng ban).
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {data.teams.map((t) => (
              <Link
                key={t.department_id}
                href={`/production/team?stage=${t.stage}`}
                className={`flex flex-col gap-1 rounded-xl border-2 p-3 transition-transform hover:scale-[1.02] ${TEAM_TONE[t.color]}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${TEAM_DOT[t.color]}`} />
                  <span className="truncate text-sm font-bold">{t.department_name}</span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  Công đoạn {t.stage_label}
                </span>
                <span className="text-xs tabular-nums">
                  {t.todo} chờ ·{' '}
                  <b className={t.doing ? 'text-amber-600' : ''}>{t.doing} đang</b> ·{' '}
                  <span className={t.done ? 'text-green-600' : ''}>{t.done} xong</span>
                </span>
                <span className="text-xs">
                  Hôm nay: <b className="tabular-nums">{fmtN(t.today_qty)}</b> sp
                  {t.wip_before > 0 && (
                    <span className="ml-1.5 text-amber-600">
                      · ứ {fmtN(t.wip_before)}
                    </span>
                  )}
                </span>
                {t.open_incidents > 0 && (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    ⚠ {t.open_incidents} sự cố đang mở
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Dòng chảy WIP — điểm nghẽn ── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Dòng chảy bán thành phẩm (BTP ứ giữa các công đoạn)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex min-w-max items-center gap-1">
            {data.wip_strip.map((w, i) => {
              const hot = maxWip > 0 && w.wip === maxWip
              return (
                <div key={w.from} className="flex items-center gap-1">
                  {i === 0 && (
                    <span className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-700">
                      {w.from_label}
                    </span>
                  )}
                  <div className="flex flex-col items-center px-1">
                    <span
                      className={`text-sm font-bold tabular-nums ${hot ? 'text-red-600 dark:text-red-400' : w.wip > 0 ? 'text-amber-600' : 'text-zinc-300 dark:text-zinc-700'}`}
                    >
                      {fmtN(w.wip)}
                    </span>
                    <span
                      className={`text-lg leading-none ${hot ? 'text-red-500' : 'text-zinc-300 dark:text-zinc-700'}`}
                    >
                      →
                    </span>
                    {hot && <Badge tone="red">Nghẽn</Badge>}
                  </div>
                  <span className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-semibold dark:border-zinc-700">
                    {w.to_label}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">
            Số giữa 2 công đoạn = chi tiết đã xong công đoạn trước nhưng chưa qua công
            đoạn sau (mọi lệnh đang chạy). Nghẽn = cặp ứ nhiều nhất.
          </p>
        </div>
      </section>

      {/* ── 3. Chất lượng & nguyên nhân gốc ── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Chất lượng 7 ngày — bấm tổ để xem nguyên nhân
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums">{pct(q.last7.rate)}</span>
            <span className="text-sm text-zinc-500">
              tỷ lệ phế ({fmtN(q.last7.defect)}/{fmtN(q.last7.qty)} sp)
            </span>
            {q.prev7.qty > 0 && (
              <span
                className={`text-sm font-medium ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-600' : 'text-zinc-400'}`}
              >
                {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {pct(Math.abs(delta))} so 7 ngày
                trước
              </span>
            )}
          </div>

          {q.by_team.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-400">
              7 ngày qua chưa có sản lượng ghi sổ.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {/* Tầng 2: tỷ lệ phế theo tổ (bar ngang, click chọn) */}
              <div className="flex flex-col gap-1.5">
                {q.by_team.map((t) => (
                  <button
                    key={t.team_id ?? 'null'}
                    onClick={() =>
                      setTeamPick(teamPick === t.team_id ? undefined : t.team_id)
                    }
                    className={`rounded-md px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${teamPick === t.team_id ? 'bg-zinc-100 ring-1 ring-sky-400 dark:bg-zinc-800' : ''}`}
                  >
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{t.team_name}</span>
                      <span className="text-zinc-500 tabular-nums">
                        {pct(t.rate)} · phế {fmtN(t.defect)}/{fmtN(t.qty)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${t.rate === maxTeamRate && t.defect > 0 ? 'bg-red-500' : 'bg-sky-600'}`}
                        style={{ width: `${Math.round((t.rate / maxTeamRate) * 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>

              {/* Tầng 3: nguyên nhân của tổ đã chọn */}
              <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                {!picked ? (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    ← Bấm một tổ để xem nguyên nhân lỗi gốc rễ.
                  </p>
                ) : picked.reasons.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    {picked.team_name}: 7 ngày qua không có phế phẩm.
                  </p>
                ) : (
                  <>
                    <h3 className="mb-2 text-xs font-semibold text-zinc-500">
                      Nguyên nhân phế — {picked.team_name}
                    </h3>
                    <ul className="flex flex-col gap-1">
                      {picked.reasons.map((r) => (
                        <li
                          key={r.code ?? 'null'}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className={r.code === null ? 'text-zinc-400 italic' : ''}>
                            {r.label}
                          </span>
                          <span className="font-semibold text-red-600 tabular-nums dark:text-red-400">
                            {fmtN(r.count)} cái
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. Cung ứng ── */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              PO quá hẹn giao ({data.supply.late_pos.length})
            </h3>
            <Link
              href="/planning/pos"
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              Đơn đặt vật tư →
            </Link>
          </div>
          {data.supply.late_pos.length === 0 ? (
            <p className="px-4 py-3 text-xs text-zinc-400">Không PO nào quá hẹn.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.supply.late_pos.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="font-mono text-xs">{p.code}</span>
                  <span className="min-w-0 flex-1 truncate">{p.supplier_name}</span>
                  <span className="text-xs text-red-500">hẹn {fmtD(p.expected_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 dark:border-zinc-800">
            <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
              Vật tư dưới tồn tối thiểu ({data.supply.low_stock.length})
            </h3>
            <Link
              href="/warehouse/stock"
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              Tồn kho →
            </Link>
          </div>
          {data.supply.low_stock.length === 0 ? (
            <p className="px-4 py-3 text-xs text-zinc-400">Tồn kho an toàn.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.supply.low_stock.slice(0, 5).map((s) => (
                <li
                  key={s.material_id}
                  className="flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{s.code}</span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="text-xs text-amber-600">
                    {fmtN(s.on_hand)}/{fmtN(s.min_stock)} {s.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ── 5. Sự cố đang mở — xử lý tại chỗ ── */}
      {data.incidents.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="border-b border-red-200 px-4 py-2 dark:border-red-900/50">
            <h2 className="text-xs font-semibold tracking-wider text-red-700 uppercase dark:text-red-400">
              ⚠ Sự cố đang mở ({data.incidents.length})
            </h2>
          </div>
          <ul className="divide-y divide-red-100 dark:divide-red-950">
            {data.incidents.map((inc) => (
              <li
                key={inc.id}
                className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{inc.message}</span>
                  <div className="text-xs text-zinc-500">
                    {[inc.lsx_code, inc.department_name, inc.reported_by_name]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    · {fmtT(inc.created_at)}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => void resolveIncident(inc)}
                  className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  ✓ Đã xử lý
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
