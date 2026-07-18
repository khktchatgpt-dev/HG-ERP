'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'

type LineRoute = {
  order_line_id: string
  product_id: string
  product_code: string
  product_name: string
  stages: string[] | null
  default_stages: string[]
}

type LineState = {
  selected: Set<string>
  saveAsDefault: boolean
  /** Dòng chưa chốt và đang hiện theo mặc định SP (chỉ để hiện nhãn). */
  fromDefault: boolean
}

/**
 * Lộ trình giai đoạn per dòng SP (0063) — phần "định hình quá trình sản xuất"
 * của QL Kế hoạch. Lộ trình là TẬP CON của chuỗi giai đoạn chuẩn (thứ tự theo
 * danh mục), nên UI chỉ cần bật/tắt chip — không kéo thả.
 */
export function LsxRoutePanel({
  lsxId,
  stages,
  canEdit,
  locked,
  title = 'Lộ trình giai đoạn',
}: {
  lsxId: string
  stages: { code: string; label: string }[]
  canEdit: boolean
  locked: boolean
  /** Tiêu đề khối — màn định hình đặt "Bước 1 — …". */
  title?: string
}) {
  const toast = useToast()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<LineRoute[]>([])
  const [state, setState] = useState<Map<string, LineState>>(new Map())
  const [dirty, setDirty] = useState(false)

  const editable = canEdit && !locked

  const load = useCallback(async () => {
    try {
      const data = await api<{ lines: LineRoute[] }>(
        `/api/dept/production/lsx/${lsxId}/routes`,
      )
      setLines(data.lines)
      setState(
        new Map(
          data.lines.map((l) => [
            l.order_line_id,
            {
              selected: new Set(l.stages ?? l.default_stages),
              saveAsDefault: false,
              fromDefault: l.stages === null,
            },
          ]),
        ),
      )
      setDirty(false)
    } catch (e) {
      toast.error('Không tải được lộ trình', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  useEffect(() => {
    // load() là async — setState chạy trong callback đã resolve (pattern
    // LsxComponentsPanel).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function patchLine(lineId: string, patch: Partial<LineState>) {
    setState((m) => {
      const next = new Map(m)
      const cur = next.get(lineId)
      if (cur) next.set(lineId, { ...cur, ...patch })
      return next
    })
    setDirty(true)
  }

  /** Đồ nội thất hay chung quy trình — áp lộ trình 1 SP cho cả lệnh 1 chạm. */
  function applyToAll(fromLineId: string) {
    const src = state.get(fromLineId)
    if (!src) return
    setState((m) => {
      const next = new Map(m)
      for (const [id, cur] of next) {
        next.set(id, { ...cur, selected: new Set(src.selected), fromDefault: false })
      }
      return next
    })
    setDirty(true)
  }

  function toggle(lineId: string, code: string) {
    const cur = state.get(lineId)
    if (!cur) return
    const selected = new Set(cur.selected)
    if (selected.has(code)) selected.delete(code)
    else selected.add(code)
    patchLine(lineId, { selected, fromDefault: false })
  }

  async function save() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/routes`, {
        method: 'PUT',
        body: {
          routes: lines
            .map((l) => {
              const s = state.get(l.order_line_id)
              if (!s || s.selected.size === 0) return null
              return {
                order_line_id: l.order_line_id,
                stages: [...s.selected],
                save_as_default: s.saveAsDefault || undefined,
              }
            })
            .filter(Boolean),
        },
      })
      toast.success('Đã lưu lộ trình giai đoạn')
      await load()
    } catch (e) {
      toast.error('Lưu lộ trình thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Spinner size={16} />
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-zinc-500">
            Mỗi loại SP đi qua các giai đoạn khác nhau — sổ sản lượng chỉ cho nhập giai
            đoạn thuộc lộ trình đã chốt.
          </p>
        </div>
        {editable && (
          <button
            onClick={() => void save()}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy && <Spinner size={12} />}
            Lưu lộ trình
          </button>
        )}
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {lines.map((l) => {
          const s = state.get(l.order_line_id)
          if (!s) return null
          return (
            <div key={l.order_line_id} className="px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">{l.product_code}</span>
                <span className="text-sm font-medium">{l.product_name}</span>
                {l.stages === null && s.fromDefault && s.selected.size > 0 && (
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    đang theo mặc định SP — bấm Lưu để chốt cho lệnh
                  </span>
                )}
                {l.stages === null && s.selected.size === 0 && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    chưa định hình
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {stages.map((st) => {
                  const on = s.selected.has(st.code)
                  // Số thứ tự trong lộ trình = vị trí trong tập chọn, xếp theo
                  // thứ tự danh mục (lộ trình là tập con của chuỗi chuẩn).
                  const order = on
                    ? stages
                        .filter((x) => s.selected.has(x.code))
                        .findIndex((x) => x.code === st.code) + 1
                    : 0
                  return (
                    <button
                      key={st.code}
                      type="button"
                      disabled={!editable}
                      onClick={() => toggle(l.order_line_id, st.code)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-default ${
                        on
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-zinc-300 text-zinc-500 hover:border-zinc-400 disabled:opacity-50 dark:border-zinc-700'
                      }`}
                    >
                      {on ? `${order}. ${st.label}` : st.label}
                    </button>
                  )
                })}
              </div>

              {editable && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <input
                      type="checkbox"
                      checked={s.saveAsDefault}
                      onChange={(e) =>
                        patchLine(l.order_line_id, {
                          saveAsDefault: e.currentTarget.checked,
                        })
                      }
                    />
                    Lưu làm lộ trình mặc định cho SP này (lệnh sau tự kế thừa)
                  </label>
                  {lines.length > 1 && s.selected.size > 0 && (
                    <button
                      type="button"
                      onClick={() => applyToAll(l.order_line_id)}
                      className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                      title="Chép lộ trình này sang mọi SP của lệnh (nhớ bấm Lưu)"
                    >
                      ⧉ Áp cho tất cả SP
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {lines.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-400">
            Lệnh chưa có dòng sản phẩm.
          </p>
        )}
      </div>
    </section>
  )
}
