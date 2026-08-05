'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import {
  Boxes,
  Layers,
  Ruler,
  Search as SearchIcon,
  Target,
  TriangleAlert,
  Weight,
} from 'lucide-react'
import { Spinner } from '@/components/erp/Spinner'
import { Modal } from '@/components/Modal'
import { poTemplateMeta, type PoTemplate } from '@/lib/po-template'

/** Khớp payload `/api/dept/supply/po-materials`. */
export type PoMaterial = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  sub_group: string | null
  spec: string | null
  po_template: PoTemplate | null
  kg_per_m: number | null
  kg_per_unit: number | null
  default_bar_length_m: number | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  on_hand: number
}

/**
 * Cache theo (mẫu đơn, từ khoá) — sống theo tab, DÙNG CHUNG mọi dòng của form.
 * Đơn 20 dòng vì thế tốn 1 request cho danh sách mặc định chứ không 20.
 */
const cache = new Map<string, PoMaterial[]>()

/** Số ký tự tối thiểu mới gọi API — xem ghi chú ở effect tìm kiếm bên dưới. */
const MIN_CHARS = 2
const CACHE_MAX = 60

export function invalidateMaterialPickCache(): void {
  cache.clear()
  groupCache = null
}

/**
 * 14 nhóm vật tư, nạp một lần cho cả tab. Dùng chung endpoint taxonomy với form
 * khai vật tư — một nguồn, không hai danh sách nhóm lệch nhau.
 */
let groupCache: string[] | null = null
async function loadGroups(): Promise<string[]> {
  if (groupCache) return groupCache
  const data = await api<{ groups: { name: string }[] }>(
    '/api/dept/warehouse/material-taxonomy',
  )
  groupCache = data.groups.map((g) => g.name)
  return groupCache
}

async function search(
  template: PoTemplate,
  q: string,
  group: string,
): Promise<PoMaterial[]> {
  const key = `${template}|${group}|${q}`
  const hit = cache.get(key)
  if (hit) return hit
  const params = new URLSearchParams({ limit: '25', template })
  if (q) params.set('q', q)
  if (group) params.set('group', group)
  const data = await api<{ materials: PoMaterial[] }>(
    `/api/dept/supply/po-materials?${params}`,
  )
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, data.materials)
  return data.materials
}

/** Nạp lại đúng các vật tư đang nằm trên dòng (mở form sửa đơn). */
export async function fetchMaterialsByIds(ids: string[]): Promise<PoMaterial[]> {
  if (ids.length === 0) return []
  const data = await api<{ materials: PoMaterial[] }>(
    `/api/dept/supply/po-materials?ids=${ids.join(',')}`,
  )
  return data.materials
}

const num = (n: number) => n.toLocaleString('vi-VN')

/**
 * MÀU THEO NHÓM VẬT TƯ — màu ở đây mang thông tin, không phải trang trí.
 *
 * Cả danh sách trước đây một màu xám nên mắt phải ĐỌC từng dòng mới biết đang
 * nhìn nhóm nào; mà kết quả tìm "hộp" thì trộn lẫn "Inox hộp 25x50", "Thép hộp
 * mạ kẽm 25x50" và "Hộp chân 3 lớp bàn 65" — ba nhóm khác hẳn, giá chênh nhiều
 * lần. Có màu thì nhận ra cụm trước khi kịp đọc chữ.
 *
 * Băm tên nhóm ra chỉ số nên MỘT NHÓM LUÔN MỘT MÀU, kể cả khi danh mục thêm
 * nhóm mới hay đổi thứ tự — không phải bảng gán tay để rồi lệch.
 *
 * Bốn màu ngữ nghĩa bị loại khỏi bảng này để không nói hai thứ cùng lúc:
 * xanh lá = còn tồn, hổ phách = thiếu khai báo, xanh trời = đang chọn / lệnh
 * cần, đỏ = lỗi.
 */
const GROUP_TONES = [
  { bar: 'bg-rose-400', chip: 'text-rose-700 dark:text-rose-300' },
  { bar: 'bg-orange-400', chip: 'text-orange-700 dark:text-orange-300' },
  { bar: 'bg-lime-500', chip: 'text-lime-700 dark:text-lime-300' },
  { bar: 'bg-teal-400', chip: 'text-teal-700 dark:text-teal-300' },
  { bar: 'bg-cyan-400', chip: 'text-cyan-700 dark:text-cyan-300' },
  { bar: 'bg-indigo-400', chip: 'text-indigo-700 dark:text-indigo-300' },
  { bar: 'bg-violet-400', chip: 'text-violet-700 dark:text-violet-300' },
  { bar: 'bg-fuchsia-400', chip: 'text-fuchsia-700 dark:text-fuchsia-300' },
]

function groupTone(name: string | null) {
  if (!name) return { bar: 'bg-zinc-200 dark:bg-zinc-700', chip: 'text-zinc-500' }
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return GROUP_TONES[h % GROUP_TONES.length]
}

/**
 * HỘP THOẠI CHỌN VẬT TƯ — tìm ở server, lọc theo mẫu đơn đang soạn, CHỌN NHIỀU
 * MÓN MỘT LƯỢT.
 *
 * Vì sao là hộp thoại chứ không phải ô gõ thẳng trên trang: danh mục có 13.064
 * vật tư. Với chừng đó, việc chọn không phải "gõ một chữ rồi bấm" mà là một
 * phiên làm việc — thu hẹp theo nhóm, đọc quy cách, so tồn kho, đối chiếu số
 * lệnh cần. Ô gõ nhét trong trang chỉ đủ chỗ cho 5-6 dòng kết quả, mà mỗi lần
 * thêm một món lại phải mở lại từ đầu.
 *
 * Hộp thoại đổi được cả nhịp làm việc: mở MỘT LẦN, tích đủ món cần cho đơn, bấm
 * thêm một lượt. Đơn 20 dòng vì thế là một lượt mở thay vì hai mươi.
 *
 * Bàn phím vẫn đi hết được: ↑↓ chạy danh sách, Enter tích/bỏ tích món đang trỏ,
 * Ctrl+Enter thêm hết vào đơn, Esc đóng.
 */
export function MaterialPickDialog({
  open,
  onClose,
  template,
  usedIds,
  onAdd,
  needs,
}: {
  open: boolean
  onClose: () => void
  template: PoTemplate
  /** Vật tư đã có trên dòng khác — hiện mờ, không cho tích lần nữa. */
  usedIds: Set<string>
  /** Trả về TẤT CẢ món đã tích, theo đúng thứ tự người dùng tích. */
  onAdd: (materials: PoMaterial[]) => void
  /**
   * SL đề xuất mua theo nhu cầu BOM của LSX, theo `material_id`.
   *
   * Hiện ngay trong kết quả tìm thay vì bắt người dùng nhìn sang panel nhu cầu
   * riêng: lúc tìm vật tư mới đúng là lúc cần biết "lệnh này cần bao nhiêu".
   */
  needs?: Map<string, number>
}) {
  const [q, setQ] = useState('')
  /*
   * LỌC THEO NHÓM. Gõ "hộp" ra hàng trăm dòng thuộc đủ nhóm — "Inox hộp
   * 25x50x1", "Thép hộp mạ kẽm 25x50x1.0mm" và "Hộp chân 3 lớp bàn 65" là ba
   * món khác hẳn, giá chênh nhiều lần. Chọn nhóm trước là hẹp ngay xuống vài
   * chục dòng.
   */
  const [group, setGroup] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [rows, setRows] = useState<PoMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  /** Món đã tích, giữ NGUYÊN THỨ TỰ tích — dòng vào đơn theo đúng thứ tự đó. */
  const [picked, setPicked] = useState<PoMaterial[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  /** Mở lại là một phiên mới — không giữ từ khoá và giỏ chọn của lần trước. */
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setQ('')
      setPicked([])
      setRows([])
      setActive(0)
    }, 0)
    return () => clearTimeout(t)
  }, [open])

  /*
   * Danh sách nhóm nạp MỘT LẦN cho cả trang (cache mức module), không phải mỗi
   * lần mở hộp thoại.
   */
  useEffect(() => {
    if (!open || groups.length > 0) return
    const t = setTimeout(async () => {
      try {
        setGroups(await loadGroups())
      } catch {
        // Bộ lọc chỉ để thu hẹp — hỏng thì vẫn tìm theo tên như cũ.
      }
    }, 0)
    return () => clearTimeout(t)
  }, [open, groups.length])

  const run = useCallback(
    async (term: string) => {
      const cached = cache.get(`${template}|${group}|${term}`)
      if (cached) {
        setRows(cached)
        setActive(0)
        return
      }
      setLoading(true)
      setError(null)
      try {
        setRows(await search(template, term, group))
        setActive(0)
      } catch {
        setRows([])
        setError('Không tải được danh sách vật tư')
      } finally {
        setLoading(false)
      }
    },
    [template, group],
  )

  /*
   * CHỈ GỌI API KHI ĐÃ GÕ ĐỦ `MIN_CHARS` KÝ TỰ — trừ khi đã chọn nhóm, lúc đó
   * danh sách mặc định của nhóm là thứ đáng xem (vài chục dòng, không phải 13k).
   * 1 ký tự thì không tìm: "v" khớp gần hết danh mục, vừa tốn vừa vô dụng.
   */
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < MIN_CHARS && !group) {
      const t = setTimeout(() => setRows([]), 0)
      return () => clearTimeout(t)
    }
    const instant = cache.has(`${template}|${group}|${term}`)
    const t = setTimeout(() => void run(term), instant ? 0 : 250)
    return () => clearTimeout(t)
  }, [open, q, template, group, run])

  const pickedIds = useMemo(() => new Set(picked.map((m) => m.id)), [picked])

  function toggle(m: PoMaterial) {
    if (usedIds.has(m.id)) return
    setPicked((ls) =>
      ls.some((x) => x.id === m.id) ? ls.filter((x) => x.id !== m.id) : [...ls, m],
    )
  }

  function confirm() {
    if (picked.length === 0) return
    onAdd(picked)
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) =>
        Math.max(0, Math.min(rows.length - 1, e.key === 'ArrowDown' ? i + 1 : i - 1)),
      )
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Ctrl/Cmd+Enter = chốt cả giỏ; Enter trơn = tích món đang trỏ rồi tìm tiếp.
      if (e.ctrlKey || e.metaKey) return confirm()
      const m = rows[active]
      if (m) toggle(m)
    }
  }

  const meta = poTemplateMeta(template)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Chọn vật tư — mẫu ${meta.label.toLowerCase()}`}
      maxWidth="sm:max-w-3xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="relative min-w-[220px] flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              placeholder="Gõ mã hoặc tên vật tư…"
              className="h-9 w-full rounded-lg border border-zinc-300 bg-white pr-3 pl-8 text-sm shadow-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            />
          </span>
          {groups.length > 0 && (
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Lọc theo nhóm vật tư"
              className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm shadow-xs focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">— tất cả {groups.length} nhóm —</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Danh sách cao cố định: kết quả nhiều thì cuộn TRONG khung này, để ô
            tìm và thanh nút luôn đứng yên hai đầu. */}
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="h-[46vh] min-h-[240px] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-zinc-500">
              <Spinner size={14} /> Đang tìm…
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">
              {q.trim().length < MIN_CHARS && !group
                ? `Gõ ít nhất ${MIN_CHARS} ký tự, hoặc chọn nhóm để xem danh sách.`
                : `Không có vật tư nào khớp “${q.trim()}” — mẫu ${meta.label.toLowerCase()}${
                    group ? `, nhóm ${group}` : ''
                  }.`}
            </div>
          )}
          {!loading &&
            rows.map((m, i) => {
              const used = usedIds.has(m.id)
              const on = pickedIds.has(m.id)
              const tone = groupTone(m.group_name)
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={used}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => toggle(m)}
                  /*
                   * BA TRẠNG THÁI, BA TÍN HIỆU KHÁC NHAU — không dùng chung một
                   * màu nền, vì "con trỏ đang ở đây" và "đã tích" là hai việc:
                   *   · đã tích       → nền xanh trời
                   *   · con trỏ bàn phím → viền trong xanh trời
                   *   · đã có trên đơn   → mờ đi, không bấm được
                   */
                  className={`flex w-full items-stretch gap-2.5 border-b border-zinc-100 py-2 pr-3 text-left last:border-b-0 disabled:opacity-45 dark:border-zinc-800/70 ${
                    on ? 'bg-sky-50/70 dark:bg-sky-950/30' : ''
                  } ${
                    i === active && !used
                      ? 'ring-1 ring-sky-400 ring-inset'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  {/* Vạch màu theo nhóm — cụm cùng nhóm dính thành một dải, nhận
                      ra trước khi kịp đọc chữ. */}
                  <span aria-hidden className={`w-1 shrink-0 rounded-r ${tone.bar}`} />
                  <span
                    aria-hidden
                    className={`mt-0.5 ml-1.5 grid size-4 shrink-0 place-items-center self-start rounded border text-[10px] font-bold ${
                      on
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-zinc-300 dark:border-zinc-600'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* DÒNG 1 — TÊN là thứ đọc trước, cho đậm và đủ tương phản. */}
                    <span className="flex w-full items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
                        {m.name}
                      </span>
                      {/* MÃ VẬT TƯ đậm ngang tên, không phải chữ phụ mờ.
                          Tên hàng trong danh mục trùng nhau nhiều (5 dòng "Pát
                          hộp…"), nên mã mới là thứ chốt đúng món — và là thứ
                          người mua đọc cho NCC qua điện thoại. */}
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                        {m.code}
                      </span>
                      {used && (
                        <span className="shrink-0 rounded bg-zinc-200 px-1.5 py-px text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          đã có trên đơn
                        </span>
                      )}
                    </span>

                    {/*
                      DÒNG 2 — QUY CÁCH đứng riêng, có viền.

                      Cùng một tên hàng nhưng khác quy cách là hai món khác giá:
                      "Inox hộp 25x50" dày 1.0li và 0.8li nằm cạnh nhau trong kết
                      quả tìm. Trước đây quy cách bị nhét lẫn vào hàng chữ xám
                      cuối cùng cùng với tồn kho và kg/m — đúng chỗ mắt bỏ qua.
                      Kéo lên riêng một dòng, đóng khung, để phân biệt được ngay.
                    */}
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      {m.spec ? (
                        /* Quy cách CỐ Ý để trung tính đậm, không bắt màu: màu
                           trong danh sách này đã dành hết cho NHÓM. Nó nổi lên
                           bằng tương phản và khung viền, không tranh hue. */
                        <span className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-1.5 py-px font-mono text-[11px] font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
                          <Ruler className="size-3 shrink-0 text-zinc-500" aria-hidden />
                          {m.spec}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 italic">
                          chưa khai quy cách
                        </span>
                      )}
                      {m.kg_per_m != null && (
                        <span className="inline-flex items-center gap-1 rounded border border-zinc-200 px-1.5 py-px text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                          <Weight className="size-3 shrink-0 text-zinc-500" aria-hidden />
                          {m.kg_per_m} kg/m
                        </span>
                      )}
                      {m.kg_per_unit != null && (
                        <span className="inline-flex items-center gap-1 rounded border border-zinc-200 px-1.5 py-px text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                          <Weight className="size-3 shrink-0 text-zinc-500" aria-hidden />
                          {m.kg_per_unit} kg/{m.unit}
                        </span>
                      )}
                      {m.po_template == null && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          <TriangleAlert className="size-3 shrink-0" aria-hidden />
                          chưa khai mẫu
                        </span>
                      )}
                    </span>

                    {/* DÒNG 3 — nhóm và tồn kho, cỡ nhỏ nhưng KHÔNG mờ tới mức
                        phải nheo mắt (zinc-500, không phải zinc-400). */}
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {m.group_name && (
                        <span
                          className={`inline-flex min-w-0 items-center gap-1 font-medium ${tone.chip}`}
                        >
                          <Layers className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {m.group_name}
                            {m.sub_group && (
                              <span className="font-normal opacity-75">
                                {' › '}
                                {m.sub_group}
                              </span>
                            )}
                          </span>
                        </span>
                      )}
                      {/*
                        TỒN KHO luôn đọc được, kể cả khi bằng 0.

                        Trước để tồn 0 màu zinc-400 cho "chìm" — sai: người mua
                        đang quyết định có đặt hay không, "tồn 0" chính là lý do
                        đặt. Nó không phải chữ phụ. Còn hàng thì xanh lá (tin
                        vui, cân nhắc mua ít lại), hết hàng thì đen bình thường.
                      */}
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          m.on_hand > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        <Boxes className="size-3 shrink-0" aria-hidden />
                        tồn {num(m.on_hand)} {m.unit}
                      </span>
                      {needs?.get(m.id) ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-sky-700 dark:text-sky-300">
                          <Target className="size-3 shrink-0" aria-hidden />
                          lệnh cần {num(needs.get(m.id)!)} {m.unit}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              )
            })}
        </div>

        {/* Giỏ đã chọn: bỏ tích được ngay tại đây, khỏi tìm ngược lại trong danh
            sách để bỏ một món lỡ tay. */}
        {picked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {picked.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m)}
                title={`Bỏ ${m.name}`}
                className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 py-0.5 pr-1.5 pl-2.5 text-[11px] text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
              >
                <span className="truncate">{m.name}</span>
                <span aria-hidden className="text-sky-500">
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-zinc-400">
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              ↑↓
            </kbd>
            chạy danh sách
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              Enter
            </kbd>
            tích/bỏ
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              Ctrl+Enter
            </kbd>
            thêm hết
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={confirm}
              className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {picked.length === 0
                ? 'Chưa chọn vật tư nào'
                : `Thêm ${picked.length} vật tư vào đơn`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
