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
  /** Lộ trình đã chọn — MẢNG CÓ THỨ TỰ (mỗi loại SP một luồng riêng). */
  selected: string[]
  saveAsDefault: boolean
  /** Dòng chưa chốt và đang hiện theo mặc định SP (chỉ để hiện nhãn). */
  fromDefault: boolean
}

/**
 * Lộ trình giai đoạn per dòng SP (0063). Từ 07/2026 mỗi loại SP đi một luồng
 * RIÊNG (thứ tự khác nhau) — nên UI cho chọn + SẮP THỨ TỰ (đánh số theo thứ tự
 * chọn, nút ←/→ đổi chỗ), không còn bật/tắt theo thứ tự danh mục.
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
  title?: string
}) {
  const toast = useToast()
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<LineRoute[]>([])
  const [state, setState] = useState<Map<string, LineState>>(new Map())
  const [dirty, setDirty] = useState(false)

  const editable = canEdit && !locked
  const labelOf = (code: string) => stages.find((s) => s.code === code)?.label ?? code

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
              selected: [...(l.stages ?? l.default_stages)],
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

  /** Thêm công đoạn vào CUỐI lộ trình (giữ thứ tự chọn). */
  function addStage(lineId: string, code: string) {
    const cur = state.get(lineId)
    if (!cur || cur.selected.includes(code)) return
    patchLine(lineId, { selected: [...cur.selected, code], fromDefault: false })
  }

  function removeStage(lineId: string, code: string) {
    const cur = state.get(lineId)
    if (!cur) return
    patchLine(lineId, {
      selected: cur.selected.filter((c) => c !== code),
      fromDefault: false,
    })
  }

  /** Dời công đoạn sớm hơn (-1) hoặc muộn hơn (+1) trong luồng. */
  function moveStage(lineId: string, code: string, dir: -1 | 1) {
    const cur = state.get(lineId)
    if (!cur) return
    const i = cur.selected.indexOf(code)
    const j = i + dir
    if (i < 0 || j < 0 || j >= cur.selected.length) return
    const next = [...cur.selected]
    ;[next[i], next[j]] = [next[j], next[i]]
    patchLine(lineId, { selected: next, fromDefault: false })
  }

  /** Đồ nội thất hay chung quy trình — áp luồng 1 SP cho cả lệnh 1 chạm. */
  function applyToAll(fromLineId: string) {
    const src = state.get(fromLineId)
    if (!src) return
    setState((m) => {
      const next = new Map(m)
      for (const [id, cur] of next) {
        next.set(id, { ...cur, selected: [...src.selected], fromDefault: false })
      }
      return next
    })
    setDirty(true)
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
              if (!s || s.selected.length === 0) return null
              return {
                order_line_id: l.order_line_id,
                stages: s.selected, // GIỮ thứ tự — server không ép lại
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
            Mỗi loại SP một luồng riêng — chọn công đoạn rồi sắp thứ tự. Sổ sản lượng chỉ
            cho nhập giai đoạn thuộc lộ trình đã chốt.
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
          const available = stages.filter((st) => !s.selected.includes(st.code))
          return (
            <div key={l.order_line_id} className="px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-zinc-400">{l.product_code}</span>
                <span className="text-sm font-medium">{l.product_name}</span>
                {l.stages === null && s.fromDefault && s.selected.length > 0 && (
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                    {editable
                      ? 'đang theo mặc định SP — bấm Lưu để chốt cho lệnh'
                      : 'theo mặc định SP'}
                  </span>
                )}
                {l.stages === null && s.selected.length === 0 && editable && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    chưa định hình
                  </span>
                )}
              </div>

              {editable ? (
                <div className="flex flex-col gap-2">
                  {/* Lộ trình đã chọn — theo thứ tự, có nút dời chỗ + bỏ */}
                  {s.selected.length > 0 ? (
                    <ol className="flex flex-wrap items-center gap-1.5">
                      {s.selected.map((code, idx) => (
                        <li
                          key={code}
                          className="inline-flex items-center gap-1 rounded-full border border-sky-600 bg-sky-600 py-0.5 pr-1 pl-2 text-xs text-white"
                        >
                          <span className="font-semibold">{idx + 1}.</span>
                          <span>{labelOf(code)}</span>
                          <span className="ml-0.5 flex items-center">
                            <button
                              type="button"
                              onClick={() => moveStage(l.order_line_id, code, -1)}
                              disabled={idx === 0}
                              className="px-1 leading-none opacity-80 hover:opacity-100 disabled:opacity-30"
                              aria-label="Dời sớm hơn"
                              title="Dời sớm hơn"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              onClick={() => moveStage(l.order_line_id, code, 1)}
                              disabled={idx === s.selected.length - 1}
                              className="px-1 leading-none opacity-80 hover:opacity-100 disabled:opacity-30"
                              aria-label="Dời muộn hơn"
                              title="Dời muộn hơn"
                            >
                              ›
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStage(l.order_line_id, code)}
                              className="px-1 leading-none opacity-80 hover:opacity-100"
                              aria-label="Bỏ công đoạn"
                              title="Bỏ khỏi lộ trình"
                            >
                              ✕
                            </button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      Chưa chọn công đoạn — bấm thêm bên dưới.
                    </p>
                  )}

                  {/* Công đoạn còn lại — bấm để thêm vào cuối luồng */}
                  {available.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-zinc-400 uppercase">Thêm:</span>
                      {available.map((st) => (
                        <button
                          key={st.code}
                          type="button"
                          onClick={() => addStage(l.order_line_id, st.code)}
                          className="rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-xs text-zinc-500 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700"
                        >
                          + {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : s.selected.length > 0 ? (
                // Chỉ-đọc: stepper theo ĐÚNG thứ tự luồng đã chốt.
                <ol className="flex flex-wrap items-center gap-y-1.5">
                  {s.selected.map((code, idx) => (
                    <li key={code} className="flex items-center">
                      {idx > 0 && (
                        <span className="mx-1 text-zinc-300 dark:text-zinc-600">→</span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-1 pr-2.5 pl-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span className="flex size-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
                          {idx + 1}
                        </span>
                        {labelOf(code)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Chưa định hình lộ trình
                </span>
              )}

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
                  {lines.length > 1 && s.selected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => applyToAll(l.order_line_id)}
                      className="text-xs text-sky-600 hover:underline dark:text-sky-400"
                      title="Chép luồng này sang mọi SP của lệnh (nhớ bấm Lưu)"
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
