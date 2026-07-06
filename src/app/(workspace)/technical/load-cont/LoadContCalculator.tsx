'use client'

/**
 * Máy tính load cont: nhập danh sách kiện → pack() chạy ngay trên trình duyệt
 * (thuật toán thuần ở src/lib/loadcont, không gọi API/DB) → xem 3D + bảng
 * thứ tự xếp. Kết quả luôn được auditPacking() kiểm lại và hiện trạng thái.
 * Form tự lưu localStorage để nhập dở không mất.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { StatsBar } from '@/components/erp/StatsBar'
import { EmptyState } from '@/components/erp/EmptyState'
import { auditPacking } from '@/lib/loadcont/audit'
import { pack } from '@/lib/loadcont/pack'
import type {
  AuditViolation,
  ContainerSpec,
  ItemTypeInput,
  PackResult,
} from '@/lib/loadcont/types'
import { CONTAINER_PRESETS } from '@/lib/loadcont/types'
import { ContainerView3D, ITEM_COLORS } from './ContainerView3D'

// Hàng nội thất: không có kiện dễ vỡ, không cần khai sức chịu nén / loại thùng.
type Row = {
  key: number
  name: string
  length: string
  width: string
  height: string
  weight: string
  qty: string
  allowRotate: boolean
  /** Cho phép xoay đa chiều (lật kiện sang mọi mặt) để lấp khe. */
  allowFlip: boolean
  /** Cho kiện khác chồng lên (bàn/tủ mỏng úp thì bỏ chọn). */
  stackable: boolean
}

type CustomCont = { length: string; width: string; height: string; payload: string }

const STORAGE_KEY = 'loadcont-form-v1'

let rowSeq = 1
const emptyRow = (): Row => ({
  key: rowSeq++,
  name: '',
  length: '',
  width: '',
  height: '',
  weight: '',
  qty: '1',
  allowRotate: true,
  allowFlip: true,
  stackable: true,
})

const SAMPLE_ROWS: Omit<Row, 'key'>[] = [
  // prettier-ignore
  { name: 'Ghế Hali', length: '58', width: '58', height: '46', weight: '15', qty: '200', allowRotate: true, allowFlip: true, stackable: true },
  // prettier-ignore
  { name: 'Mặt bàn 235', length: '81', width: '80', height: '10', weight: '20', qty: '185', allowRotate: true, allowFlip: true, stackable: true },
  // prettier-ignore
  { name: 'Chân bàn', length: '122.5', width: '95', height: '11', weight: '22', qty: '185', allowRotate: true, allowFlip: true, stackable: true },
]

function parseNum(s: string): number | null {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function LoadContCalculator() {
  const toast = useToast()
  const [contKey, setContKey] = useState<string>(CONTAINER_PRESETS[0].key)
  const [custom, setCustom] = useState<CustomCont>({
    length: '1200',
    width: '235',
    height: '260',
    payload: '26000',
  })
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  // Độ cao xếp tối đa (cao ÷ cạnh đáy). Cao hơn = cột xếp cao sát trần cont hơn
  // (đầy trần), đánh đổi bằng cột mảnh hơn. Vùng cửa luôn giữ chặt (≤ 2).
  const [maxAspect, setMaxAspect] = useState('4')
  // Gác tấm: cho phép tấm phẳng cứng gác ngang qua nóc nhiều cột đế cùng độ cao
  // để lấp khoảng không trên đầu cột thấp. Chỉ dùng khi audit xác nhận an toàn +
  // tiết kiệm cont; nếu không tự quay lại phương án cột.
  const [allowBridging, setAllowBridging] = useState(false)
  // CHẾ ĐỘ TEST (nhồi tối đa): bỏ MỌI ràng buộc an toàn (nặng-trên-nhẹ, sức chịu
  // nén, độ mảnh) VÀ cả an toàn vùng cửa (lấp kín tới cửa); chỉ giữ hình học +
  // tải cont. Dùng ước lượng số cont tối thiểu; KHÔNG phải phương án an toàn thật.
  const [ignoreStackSafety, setIgnoreStackSafety] = useState(false)
  const [result, setResult] = useState<PackResult | null>(null)
  const [violations, setViolations] = useState<AuditViolation[]>([])
  /** Kết quả hiện tại có được tính ở chế độ test (bỏ ràng buộc chồng) không. */
  const [resultTestMode, setResultTestMode] = useState(false)
  const [contIndex, setContIndex] = useState(0)
  const [maxOrder, setMaxOrder] = useState(Infinity)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const loaded = useRef(false)

  // ── localStorage: nạp 1 lần sau khi mount (client), lưu mỗi khi form đổi ──
  // Nạp đồng bộ ngay trong effect (không microtask/không cờ alive) để chạy đáng
  // tin cậy kể cả khi React dev mount kép; nếu không loaded.current sẽ kẹt false
  // và cả nạp lẫn lưu đều không hoạt động.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as {
          contKey: string
          custom: CustomCont
          rows: Row[]
          maxAspect?: string
          allowBridging?: boolean
          ignoreStackSafety?: boolean
        }
        if (saved.rows?.length) {
          // Nạp state đã lưu 1 lần khi mount — ngoại lệ hợp lệ của set-state-in-effect
          // (đồng bộ state React với localStorage bên ngoài, không phải cascade).
          /* eslint-disable react-hooks/set-state-in-effect */
          setContKey(saved.contKey)
          setCustom(saved.custom)
          // Dữ liệu lưu cũ có thể thiếu allowFlip → mặc định bật (lấp khe).
          setRows(
            saved.rows.map((r) => ({
              ...r,
              allowFlip: r.allowFlip ?? true,
              stackable: r.stackable ?? true,
              key: rowSeq++,
            })),
          )
          if (saved.maxAspect) setMaxAspect(saved.maxAspect)
          if (typeof saved.allowBridging === 'boolean')
            setAllowBridging(saved.allowBridging)
          if (typeof saved.ignoreStackSafety === 'boolean')
            setIgnoreStackSafety(saved.ignoreStackSafety)
          /* eslint-enable react-hooks/set-state-in-effect */
        }
      }
    } catch {
      // dữ liệu hỏng → bỏ qua, dùng form trống
    }
    loaded.current = true
  }, [])
  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          contKey,
          custom,
          rows,
          maxAspect,
          allowBridging,
          ignoreStackSafety,
        }),
      )
    } catch {
      // hết quota → bỏ qua
    }
  }, [contKey, custom, rows, maxAspect, allowBridging, ignoreStackSafety])

  const spec: ContainerSpec | null = useMemo(() => {
    if (contKey !== 'custom')
      return CONTAINER_PRESETS.find((c) => c.key === contKey) ?? null
    const l = parseNum(custom.length)
    const w = parseNum(custom.width)
    const h = parseNum(custom.height)
    const p = parseNum(custom.payload)
    if (!l || !w || !h || !p || l <= 0 || w <= 0 || h <= 0 || p <= 0) return null
    return {
      key: 'custom',
      name: 'Cont tự khai',
      length: l,
      width: w,
      height: h,
      maxPayloadKg: p,
    }
  }, [contKey, custom])

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  function compute() {
    if (!spec) {
      toast.error('Thông số cont tự khai chưa hợp lệ')
      return
    }
    const items: ItemTypeInput[] = []
    for (const r of rows) {
      const isBlank = !r.name && !r.length && !r.width && !r.height && !r.weight
      if (isBlank) continue
      const length = parseNum(r.length)
      const width = parseNum(r.width)
      const height = parseNum(r.height)
      const weight = parseNum(r.weight)
      const qty = parseNum(r.qty)
      const label = r.name || `Dòng ${rows.indexOf(r) + 1}`
      if (!length || !width || !height || length <= 0 || width <= 0 || height <= 0) {
        toast.error(`"${label}": kích thước phải là số > 0`)
        return
      }
      if (!weight || weight <= 0) {
        toast.error(`"${label}": cân nặng phải là số > 0`)
        return
      }
      if (!qty || qty < 1 || !Number.isInteger(qty)) {
        toast.error(`"${label}": số lượng phải là số nguyên ≥ 1`)
        return
      }
      // Hàng nội thất: không dễ vỡ, không giới hạn sức chịu nén.
      items.push({
        id: `row-${r.key}`,
        name: label,
        length,
        width,
        height,
        weight,
        qty,
        allowRotate: r.allowRotate,
        allowFlip: r.allowFlip,
        stackable: r.stackable,
        fragile: false,
        maxLoadKg: null,
      })
    }
    if (items.length === 0) {
      toast.error('Chưa có kiện hàng nào để tính')
      return
    }
    try {
      const aspect = parseNum(maxAspect)
      const res = pack(items, spec, {
        maxStackAspect: aspect && aspect >= 2 ? aspect : undefined,
        allowBridging,
        ignoreStackSafety,
      })
      const audit = auditPacking(res.containers, { geometryOnly: ignoreStackSafety })
      setResult(res)
      setViolations(audit)
      setResultTestMode(ignoreStackSafety)
      setContIndex(0)
      setMaxOrder(Infinity)
      setHighlightId(null)
      if (audit.length > 0) {
        toast.error('Phát hiện vi phạm an toàn — xem chi tiết bên dưới')
      } else if (res.unplaced.length > 0) {
        toast.warning('Đã tính xong, còn kiện không xếp được')
      } else {
        toast.success(`Đã xếp ${res.placedUnits} kiện vào ${res.containers.length} cont`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tính được phương án xếp')
    }
  }

  // Màu theo loại kiện (ổn định theo thứ tự dòng).
  const colors = useMemo(() => {
    const map: Record<string, string> = {}
    rows.forEach((r, i) => {
      map[`row-${r.key}`] = ITEM_COLORS[i % ITEM_COLORS.length]
    })
    return map
  }, [rows])

  const current = result?.containers[contIndex] ?? null
  const totalPlaced = result?.placedUnits ?? 0
  const sliderMax = current?.placements.length ?? 0
  const sliderValue = Math.min(maxOrder === Infinity ? sliderMax : maxOrder, sliderMax)

  // Legend đếm theo loại trong cont đang xem.
  const legend = useMemo(() => {
    if (!current) return []
    const m = new Map<string, { name: string; count: number }>()
    for (const p of current.placements) {
      const e = m.get(p.itemId)
      if (e) e.count++
      else m.set(p.itemId, { name: p.name, count: 1 })
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v }))
  }, [current])

  const inputCls =
    'h-8 w-full rounded border border-zinc-300 bg-white px-2 text-sm tabular-nums focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-4">
      {/* ── Chọn cont ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          1 · Loại container
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Loại cont
            <select
              value={contKey}
              onChange={(e) => setContKey(e.target.value)}
              className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {CONTAINER_PRESETS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
              <option value="custom">Tự khai kích thước…</option>
            </select>
          </label>
          {contKey === 'custom' ? (
            <>
              {(
                [
                  ['length', 'Dài lòng (cm)'],
                  ['width', 'Rộng lòng (cm)'],
                  ['height', 'Cao lòng (cm)'],
                  ['payload', 'Tải hàng (kg)'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex w-28 flex-col gap-1 text-xs text-zinc-500">
                  {label}
                  <input
                    value={custom[k]}
                    onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))}
                    className={inputCls}
                    inputMode="decimal"
                  />
                </label>
              ))}
            </>
          ) : (
            spec && (
              <div className="pb-1.5 text-xs text-zinc-500">
                Lòng {spec.length} × {spec.width} × {spec.height} cm · tải{' '}
                {spec.maxPayloadKg.toLocaleString('vi-VN')} kg
              </div>
            )
          )}
          <label
            className="flex w-40 flex-col gap-1 text-xs text-zinc-500"
            title="Chiều cao cột tối đa so với cạnh đáy ngắn (cao ÷ đáy). Cao hơn → xếp cột cao sát trần cont hơn (đầy trần), đổi lại cột mảnh hơn. Vùng cửa luôn giữ chặt ≤ 2. Mặc định 4; để 3 nếu muốn thận trọng."
          >
            Xếp cao tối đa (cao ÷ đáy)
            <input
              value={maxAspect}
              onChange={(e) => setMaxAspect(e.target.value)}
              className={inputCls}
              inputMode="decimal"
            />
          </label>
          <label
            className="flex items-center gap-2 pb-1.5 text-xs text-zinc-600 dark:text-zinc-300"
            title="Cho phép tấm phẳng cứng (mặt/chân bàn…) gác ngang qua nóc nhiều cột đế cùng độ cao (vd cột ghế) để lấp khoảng không phía trên. Tải tấm được phân bổ xuống các cột đế; CHỈ gác khi từng cột đế còn chịu nổi — muốn gác được hàng nặng phải khai 'Chịu nén (kg)' cho kiện làm đế (vd thùng ghế chịu 120kg). Chưa khai đủ thì tự quay lại phương án cột cho an toàn."
          >
            <input
              type="checkbox"
              checked={allowBridging}
              onChange={(e) => setAllowBridging(e.target.checked)}
            />
            Cho phép gác tấm
          </label>
          <label
            className="flex items-center gap-2 pb-1.5 text-xs text-amber-700 dark:text-amber-400"
            title="CHẾ ĐỘ TEST (nhồi tối đa) — bỏ MỌI ràng buộc an toàn: nặng-trên-nhẹ, sức chịu nén, độ mảnh, kín-thùng-mới-đè, VÀ cả an toàn vùng cửa (lấp kín tới cửa như bản xếp tay 1 cont). CHỈ giữ hình học (không lơ lửng/chèn/tràn) + tải trọng cont. Dùng để ước lượng SỐ CONT TỐI THIỂU. ĐÂY KHÔNG phải phương án xếp an toàn thật."
          >
            <input
              type="checkbox"
              checked={ignoreStackSafety}
              onChange={(e) => setIgnoreStackSafety(e.target.checked)}
            />
            Chế độ test: nhồi tối đa (bỏ hết ràng buộc an toàn)
          </label>
        </div>
      </section>

      {/* ── Danh sách kiện ── */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
            2 · Danh sách kiện hàng (cm / kg)
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              // Nạp trọn bộ scenario Hali: cont + hàng + đúng cấu hình để test 1 cont.
              setContKey('custom')
              setCustom({ length: '1190', width: '234', height: '268', payload: '30000' })
              setRows(SAMPLE_ROWS.map((r) => ({ ...r, key: rowSeq++ })))
              setMaxAspect('6')
              setAllowBridging(true)
              setIgnoreStackSafety(true)
              toast.info('Đã nạp bộ bàn ghế Hali + cont 40HC (chế độ nhồi tối đa)')
            }}
          >
            Nạp bộ mẫu Hali (test 1 cont)
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-[11px] tracking-wider text-zinc-500 uppercase">
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-1.5 pr-2">Tên kiện</th>
                <th className="w-20 py-1.5 pr-2">Dài</th>
                <th className="w-20 py-1.5 pr-2">Rộng</th>
                <th className="w-20 py-1.5 pr-2">Cao</th>
                <th className="w-24 py-1.5 pr-2">Kg/kiện</th>
                <th className="w-16 py-1.5 pr-2">SL</th>
                <th
                  className="w-16 py-1.5 pr-2 text-center"
                  title="Cho phép xoay ngang 90° khi xếp (đổi dài↔rộng)"
                >
                  Xoay
                </th>
                <th
                  className="w-16 py-1.5 pr-2 text-center"
                  title="Xoay đa chiều: cho lật kiện sang mọi mặt (dựng nghiêng) để lấp khe hẹp. Tự chọn hướng đặt được nhiều nhất."
                >
                  Lật
                </th>
                <th
                  className="w-16 py-1.5 pr-2 text-center"
                  title="Cho phép kiện khác chồng lên. Mặt bàn/tủ mỏng úp không cho đè thì bỏ chọn."
                >
                  Chồng
                </th>
                <th className="w-10 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: ITEM_COLORS[i % ITEM_COLORS.length] }}
                      />
                      <input
                        value={r.name}
                        onChange={(e) => setRow(r.key, { name: e.target.value })}
                        placeholder={`Kiện ${i + 1}`}
                        className={inputCls}
                      />
                    </div>
                  </td>
                  {(
                    [
                      ['length', 'Dài'],
                      ['width', 'Rộng'],
                      ['height', 'Cao'],
                      ['weight', 'Kg'],
                      ['qty', 'SL'],
                    ] as const
                  ).map(([k]) => (
                    <td key={k} className="py-1.5 pr-2">
                      <input
                        value={r[k]}
                        onChange={(e) => setRow(r.key, { [k]: e.target.value })}
                        className={inputCls}
                        inputMode="decimal"
                      />
                    </td>
                  ))}
                  <td className="py-1.5 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.allowRotate}
                      onChange={(e) => setRow(r.key, { allowRotate: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.allowFlip}
                      onChange={(e) => setRow(r.key, { allowFlip: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-center">
                    <input
                      type="checkbox"
                      checked={r.stackable}
                      onChange={(e) => setRow(r.key, { stackable: e.target.checked })}
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                      className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      title="Xoá dòng"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            + Thêm kiện
          </Button>
          <Button variant="primary" onClick={compute}>
            Tính phương án xếp
          </Button>
        </div>
      </section>

      {/* ── Kết quả ── */}
      {result === null ? (
        <EmptyState
          title="Chưa có phương án xếp"
          description="Nhập danh sách kiện hàng rồi bấm “Tính phương án xếp”."
        />
      ) : (
        <>
          <StatsBar
            stats={[
              { label: 'Số cont cần', value: result.containers.length, tone: 'blue' },
              {
                label: 'Kiện đã xếp',
                value: `${totalPlaced}/${result.totalUnits}`,
                tone: totalPlaced === result.totalUnits ? 'green' : 'amber',
              },
              {
                label: 'Thể tích cont này',
                value: current ? `${current.volumeUtilization.toFixed(1)}%` : '—',
                tone: 'default',
              },
              {
                label: 'Tải trọng cont này',
                value: current ? `${current.weightUtilization.toFixed(1)}%` : '—',
                tone: 'default',
              },
              {
                label: 'Khối lượng cont này',
                value: current
                  ? `${current.usedWeightKg.toLocaleString('vi-VN')} kg`
                  : '—',
                tone: 'default',
              },
              {
                label: 'Không xếp được',
                value: result.unplaced.reduce((s, u) => s + u.qty, 0),
                tone: result.unplaced.length > 0 ? 'red' : 'gray',
              },
            ]}
          />

          {/* Trạng thái kiểm tra an toàn — chạy lại độc lập sau mỗi lần tính */}
          {resultTestMode ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠ CHẾ ĐỘ TEST (nhồi tối đa) — đã BỎ mọi ràng buộc an toàn (nặng-trên-nhẹ,
              sức chịu nén, độ mảnh) VÀ cả an toàn vùng cửa (lấp kín tới cửa). Chỉ còn
              kiểm hình học + tải trọng cont
              {violations.length > 0 ? ` (còn ${violations.length} lỗi)` : ' — đạt'}. Con
              số này chỉ để ước lượng SỐ CONT TỐI THIỂU, KHÔNG phải phương án xếp an toàn
              thật.
            </div>
          ) : violations.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              ✓ Đã kiểm tra {totalPlaced} kiện: không gác lệch, không đè lên kiện không
              cho chồng, nặng dưới nhẹ trên; vùng cửa cont chỉ có cột thấp + vững.
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <div className="font-semibold">
                ⚠ Phát hiện {violations.length} vi phạm an toàn (báo lại đội phát triển):
              </div>
              <ul className="mt-1 list-inside list-disc">
                {violations.slice(0, 10).map((v, i) => (
                  <li key={i}>
                    Cont {v.containerIndex + 1}: {v.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.unplaced.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <div className="font-semibold">Kiện không xếp được:</div>
              <ul className="mt-1 list-inside list-disc">
                {result.unplaced.map((u, i) => (
                  <li key={i}>
                    {u.name} × {u.qty} — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.containers.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-5">
              {/* 3D */}
              <div className="flex flex-col gap-3 xl:col-span-3">
                <div className="flex flex-wrap items-center gap-2">
                  {result.containers.map((c) => (
                    <button
                      key={c.index}
                      onClick={() => {
                        setContIndex(c.index)
                        setMaxOrder(Infinity)
                      }}
                      className={`rounded-md border px-3 py-1.5 text-sm transition ${
                        c.index === contIndex
                          ? 'border-sky-500 bg-sky-50 font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                          : 'border-zinc-300 bg-white text-zinc-600 hover:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      Cont {c.index + 1}
                      <span className="ml-1.5 text-xs opacity-70">
                        {c.placements.length} kiện · {c.volumeUtilization.toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
                {current && (
                  <>
                    <ContainerView3D
                      container={current}
                      colors={colors}
                      maxOrder={
                        sliderValue >= sliderMax
                          ? Number.MAX_SAFE_INTEGER
                          : (current.placements[sliderValue - 1]?.order ?? 0)
                      }
                      highlightId={highlightId}
                    />
                    <label className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="shrink-0">
                        Thứ tự xếp: {sliderValue}/{sliderMax} kiện
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        value={sliderValue}
                        onChange={(e) => setMaxOrder(Number(e.target.value))}
                        className="w-full accent-sky-500"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {legend.map((l) => (
                        <button
                          key={l.id}
                          onClick={() =>
                            setHighlightId((h) => (h === l.id ? null : l.id))
                          }
                          className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition ${
                            highlightId === l.id
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                              : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900'
                          }`}
                        >
                          <span
                            className="h-3 w-3 rounded-sm"
                            style={{ background: colors[l.id] }}
                          />
                          {l.name} × {l.count}
                        </button>
                      ))}
                      <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-500">
                        <span className="h-3 w-3 rounded-sm bg-amber-500/25" /> vùng cửa
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Bảng thứ tự xếp */}
              <div className="xl:col-span-2">
                <h3 className="mb-2 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
                  Thứ tự xếp — Cont {contIndex + 1} (từ vách trong ra cửa, dưới lên trên)
                </h3>
                <div className="max-h-[540px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-zinc-50 text-[10px] tracking-wider text-zinc-500 uppercase dark:bg-zinc-900">
                      <tr>
                        <th className="px-2 py-1.5">#</th>
                        <th className="px-2 py-1.5">Kiện</th>
                        <th
                          className="px-2 py-1.5"
                          title="Khoảng cách từ vách trong (cm)"
                        >
                          Từ vách
                        </th>
                        <th className="px-2 py-1.5" title="Khoảng cách từ mép trái (cm)">
                          Từ trái
                        </th>
                        <th className="px-2 py-1.5">Tầng</th>
                        <th className="px-2 py-1.5">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-900 dark:bg-zinc-950">
                      {current?.placements.map((p) => (
                        <tr
                          key={p.order}
                          className={
                            highlightId && highlightId !== p.itemId
                              ? 'opacity-40'
                              : undefined
                          }
                        >
                          <td className="px-2 py-1 text-zinc-400 tabular-nums">
                            {p.order}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                              style={{ background: colors[p.itemId] }}
                            />
                            {p.name}
                            {p.rotated && (
                              <span className="ml-1 text-zinc-400">(xoay)</span>
                            )}
                          </td>
                          <td className="px-2 py-1 tabular-nums">{Math.round(p.x)} cm</td>
                          <td className="px-2 py-1 tabular-nums">{Math.round(p.y)} cm</td>
                          <td className="px-2 py-1 tabular-nums">{p.level + 1}</td>
                          <td className="px-2 py-1">
                            {!p.stackable && (
                              <span className="text-amber-600">không đè lên</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
