'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { api, ApiError } from '@/lib/api'
import { calcComponent } from '@/lib/component-needs'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'

/**
 * Bảng chi tiết & định mức của LSX (plan-lsx-components P2) — NHẬP TAY bởi Kế
 * hoạch; nút gợi ý (BOM / lệnh trước) chỉ điền sẵn, sửa được từng dòng trước
 * khi Lưu.
 *
 * Bố cục KHỐI-PER-SP (user chốt 07/2026): lệnh nhiều mã SP nên mỗi SP một khối
 * riêng chứa bảng chi tiết của nó — nhìn là biết cụm/chi tiết thuộc SP nào,
 * thêm dòng ngay trong khối, không còn cột SP chọn từng dòng.
 */

type OrderLine = {
  id: string
  product_code: string
  product_name: string
  qty: number
}

type MaterialOption = { id: string; code: string; name: string; unit: string }

/** Dòng đang biên tập — số để '' khi trống (input controlled). */
type EditRow = {
  order_line_id: string
  cluster: string
  name: string
  material_id: string
  material_type: string
  spec_thickness_mm: number | ''
  spec_width_mm: number | ''
  spec_length_mm: number | ''
  qty_per_unit: number | ''
  dm_kg: number | ''
  pcs_per_bar: number | ''
  final_stage: string
  note: string
}

type ApiRow = {
  order_line_id: string
  cluster: string | null
  name: string
  material_id: string | null
  material_type: string | null
  spec_thickness_mm: number | null
  spec_width_mm: number | null
  spec_length_mm: number | null
  qty_per_unit: number
  dm_kg: number | null
  pcs_per_bar: number | null
  final_stage: string | null
  note: string | null
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

const toEdit = (r: Partial<ApiRow> & { order_line_id: string }): EditRow => ({
  order_line_id: r.order_line_id,
  cluster: r.cluster ?? '',
  name: r.name ?? '',
  material_id: r.material_id ?? '',
  material_type: r.material_type ?? '',
  spec_thickness_mm: r.spec_thickness_mm ?? '',
  spec_width_mm: r.spec_width_mm ?? '',
  spec_length_mm: r.spec_length_mm ?? '',
  qty_per_unit: r.qty_per_unit ?? '',
  dm_kg: r.dm_kg ?? '',
  pcs_per_bar: r.pcs_per_bar ?? '',
  final_stage: r.final_stage ?? '',
  note: r.note ?? '',
})

const inp =
  'w-full rounded border border-zinc-300 px-1.5 py-1 text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

export function LsxComponentsPanel({
  lsxId,
  orderLines,
  materials,
  stages,
  canEdit,
  locked,
  title = 'Bảng chi tiết & định mức',
}: {
  lsxId: string
  orderLines: OrderLine[]
  materials: MaterialOption[]
  /** Danh mục công đoạn — chọn "công đoạn cuối" per chi tiết (tuỳ SP). */
  stages: { code: string; label: string }[]
  /** Kế hoạch (KH-CƯ) + GĐ/QL — xưởng và các phòng khác chỉ xem. */
  canEdit: boolean
  /** LSX completed/cancelled — chỉ còn tra cứu. */
  locked: boolean
  /** Tiêu đề khối — màn định hình đặt "Bước 2 — …". */
  title?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<EditRow[]>([])
  const [dirty, setDirty] = useState(false)
  // Lệnh đã có sổ sản lượng → khoá bảng NGAY từ đầu (banner) thay vì để người
  // nhập sửa chán rồi bấm Lưu mới ăn 400 (server vẫn chặn làm lớp cuối).
  const [lockedByOutputs, setLockedByOutputs] = useState(false)

  const editable = canEdit && !locked && !lockedByOutputs
  const qtyByLine = useMemo(
    () => new Map(orderLines.map((l) => [l.id, l.qty])),
    [orderLines],
  )

  const load = useCallback(async () => {
    try {
      const data = await api<{ lines: ApiRow[]; locked_by_outputs?: boolean }>(
        `/api/dept/production/lsx/${lsxId}/components`,
      )
      setRows(data.lines.map(toEdit))
      setLockedByOutputs(data.locked_by_outputs ?? false)
      setDirty(false)
    } catch (e) {
      toast.error(
        'Không tải được bảng chi tiết',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    } finally {
      setLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsxId])

  useEffect(() => {
    // load() là async — setState chạy trong callback đã resolve, không đồng bộ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  function setRow(i: number, patch: Partial<EditRow>) {
    setRows((rs) => rs.map((r, x) => (x === i ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  /** Thêm dòng cho ĐÚNG SP của khối đang bấm — không còn chọn SP per dòng. */
  function addRow(lineId: string) {
    setRows((rs) => [...rs, toEdit({ order_line_id: lineId })])
    setDirty(true)
  }

  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, x) => x !== i))
    setDirty(true)
  }

  async function suggest(source: 'bom' | 'previous') {
    if (rows.length > 0) {
      const ok = await confirm({
        title: source === 'bom' ? 'Gợi ý từ BOM kỹ thuật?' : 'Chép từ lệnh trước?',
        description:
          'Bảng đang nhập sẽ bị THAY bằng dữ liệu gợi ý (chưa lưu cho tới khi bấm Lưu). BOM/lệnh cũ chỉ là tham khảo — kiểm tra lại từng dòng.',
        confirmLabel: 'Thay bảng',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const data = await api<{ lines: ApiRow[] }>(
        `/api/dept/production/lsx/${lsxId}/components/suggest?source=${source}`,
      )
      if (data.lines.length === 0) {
        toast.error(
          'Không có dữ liệu gợi ý',
          source === 'bom' ? 'SP chưa có BOM kỹ thuật' : 'Chưa có lệnh trước cùng SP',
        )
        return
      }
      setRows(data.lines.map(toEdit))
      setDirty(true)
      toast.success(`Đã điền ${data.lines.length} dòng gợi ý`, 'Kiểm tra rồi bấm Lưu')
    } catch (e) {
      toast.error('Gợi ý thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    for (const r of rows) {
      if (!r.name.trim() || r.qty_per_unit === '' || Number(r.qty_per_unit) <= 0) {
        toast.error('Dòng thiếu dữ liệu', 'Mỗi dòng cần Tên chi tiết + CT/SP > 0')
        return
      }
    }
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/components`, {
        method: 'PUT',
        body: {
          lines: rows.map((r) => ({
            order_line_id: r.order_line_id,
            cluster: r.cluster.trim() || null,
            name: r.name.trim(),
            material_id: r.material_id || null,
            material_type: r.material_type.trim() || null,
            spec_thickness_mm: r.spec_thickness_mm === '' ? null : r.spec_thickness_mm,
            spec_width_mm: r.spec_width_mm === '' ? null : r.spec_width_mm,
            spec_length_mm: r.spec_length_mm === '' ? null : r.spec_length_mm,
            qty_per_unit: Number(r.qty_per_unit),
            dm_kg: r.dm_kg === '' ? null : r.dm_kg,
            pcs_per_bar: r.pcs_per_bar === '' ? null : r.pcs_per_bar,
            final_stage: r.final_stage || null,
            note: r.note.trim() || null,
          })),
        },
      })
      toast.success('Đã lưu bảng chi tiết', `${rows.length} dòng`)
      setDirty(false)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const noMaterialCount = rows.filter((r) => !r.material_id).length
  // Dòng kèm index gốc (setRow/removeRow theo index của mảng rows).
  const indexed = rows.map((r, i) => ({ r, i }))
  // Dòng mồ côi (order_line không còn trong đơn — đơn bị sửa dòng SP): vẫn hiện
  // để không giấu dữ liệu.
  const orphans = indexed.filter((x) => !qtyByLine.has(x.r.order_line_id))

  function renderRow({ r, i }: { r: EditRow; i: number }) {
    const orderQty = qtyByLine.get(r.order_line_id) ?? 0
    const calc =
      r.qty_per_unit !== '' && Number(r.qty_per_unit) > 0
        ? calcComponent(
            {
              qty_per_unit: Number(r.qty_per_unit),
              dm_kg: r.dm_kg === '' ? null : Number(r.dm_kg),
              pcs_per_bar: r.pcs_per_bar === '' ? null : Number(r.pcs_per_bar),
            },
            orderQty,
          )
        : null
    if (!editable) {
      const mat = materials.find((m) => m.id === r.material_id)
      return (
        <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
          <td className="py-1.5 pr-1">{r.cluster || '—'}</td>
          <td className="py-1.5 pr-1 font-medium">{r.name}</td>
          <td className="py-1.5 pr-1">
            {mat ? `${mat.code} ${mat.name}` : r.material_id ? '…' : '—'}
          </td>
          <td className="py-1.5 pr-1">{r.material_type || '—'}</td>
          <td className="py-1.5 pr-1">{r.spec_thickness_mm || '—'}</td>
          <td className="py-1.5 pr-1">{r.spec_width_mm || '—'}</td>
          <td className="py-1.5 pr-1">{r.spec_length_mm || '—'}</td>
          <td className="py-1.5 pr-1">{r.qty_per_unit}</td>
          <td className="py-1.5 pr-1">{r.dm_kg || '—'}</td>
          <td className="py-1.5 pr-1">{r.pcs_per_bar || '—'}</td>
          <td className="py-1.5 pr-1">
            {r.final_stage
              ? (stages.find((s) => s.code === r.final_stage)?.label ?? r.final_stage)
              : 'Cuối DM'}
          </td>
          <td className="py-1.5 pr-1 text-right font-medium">
            {calc?.total_needed.toLocaleString('vi-VN') ?? '—'}
          </td>
          <td className="py-1.5 pr-1 text-right">
            {calc?.kg_needed?.toLocaleString('vi-VN') ?? '—'}
          </td>
          <td className="py-1.5 pr-1 text-right">
            {calc?.bars_needed?.toLocaleString('vi-VN') ?? '—'}
          </td>
          <td className="py-1.5 pr-1">{r.note || '—'}</td>
        </tr>
      )
    }
    return (
      <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
        <td className="py-1 pr-1">
          <input
            value={r.cluster}
            onChange={(e) => setRow(i, { cluster: e.target.value })}
            className={`${inp} min-w-20`}
            placeholder="CỤM TỰA"
          />
        </td>
        <td className="py-1 pr-1">
          <input
            value={r.name}
            onChange={(e) => setRow(i, { name: e.target.value })}
            className={`${inp} min-w-28`}
            placeholder="TAY+TỰA"
          />
        </td>
        <td className="py-1 pr-1">
          <select
            value={r.material_id}
            onChange={(e) => setRow(i, { material_id: e.target.value })}
            className={`${inp} min-w-32 ${!r.material_id ? 'border-amber-400' : ''}`}
          >
            <option value="">— chưa gắn —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} · {m.name}
              </option>
            ))}
          </select>
        </td>
        <td className="py-1 pr-1">
          <input
            value={r.material_type}
            onChange={(e) => setRow(i, { material_type: e.target.value })}
            className={`${inp} min-w-14`}
            placeholder="TRÒN"
          />
        </td>
        {(['spec_thickness_mm', 'spec_width_mm', 'spec_length_mm'] as const).map((k) => (
          <td key={k} className="py-1 pr-1">
            <input
              type="number"
              step="0.01"
              min="0"
              value={r[k]}
              onChange={(e) =>
                setRow(i, {
                  [k]: e.target.value === '' ? '' : Number(e.target.value),
                } as Partial<EditRow>)
              }
              className={inp}
            />
          </td>
        ))}
        {(['qty_per_unit', 'dm_kg', 'pcs_per_bar'] as const).map((k) => (
          <td key={k} className="py-1 pr-1">
            <input
              type="number"
              step="0.0001"
              min="0"
              value={r[k]}
              onChange={(e) =>
                setRow(i, {
                  [k]: e.target.value === '' ? '' : Number(e.target.value),
                } as Partial<EditRow>)
              }
              className={inp}
            />
          </td>
        ))}
        <td className="py-1 pr-1">
          <select
            value={r.final_stage}
            onChange={(e) => setRow(i, { final_stage: e.target.value })}
            className={`${inp} min-w-20`}
            title="Công đoạn cuối của chi tiết"
          >
            <option value="">Cuối DM</option>
            {stages.map((st) => (
              <option key={st.code} value={st.code}>
                {st.label}
              </option>
            ))}
          </select>
        </td>
        <td className="py-1 pr-1 text-right font-medium">
          {calc?.total_needed.toLocaleString('vi-VN') ?? '—'}
        </td>
        <td
          className="py-1 pr-1 text-right"
          title={calc?.missing.includes('DM_KG') ? 'Thiếu ĐM kg' : ''}
        >
          {calc?.kg_needed?.toLocaleString('vi-VN') ?? '—'}
        </td>
        <td
          className="py-1 pr-1 text-right"
          title={calc?.missing.includes('PCS_PER_BAR') ? 'Thiếu hệ số CT/cây' : ''}
        >
          {calc?.bars_needed?.toLocaleString('vi-VN') ?? '—'}
        </td>
        <td className="py-1 pr-1">
          <input
            value={r.note}
            onChange={(e) => setRow(i, { note: e.target.value })}
            className={`${inp} min-w-20`}
          />
        </td>
        <td className="py-1 text-right">
          <button
            onClick={() => removeRow(i)}
            className="text-red-500 hover:text-red-700"
            aria-label="Xoá dòng"
            title="Xoá dòng"
          >
            ✕
          </button>
        </td>
      </tr>
    )
  }

  /** Bảng của 1 khối SP — cột như cũ nhưng KHÔNG còn cột SP. */
  function renderTable(items: { r: EditRow; i: number }[]) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-1.5 pr-1" title="Cụm lắp ráp: CỤM TỰA, CỤM KHUNG…">
                Cụm
              </th>
              <th className="py-1.5 pr-1">
                Chi tiết <span className="text-red-500">*</span>
              </th>
              <th className="py-1.5 pr-1">Vật tư</th>
              <th className="py-1.5 pr-1">Loại</th>
              <th className="w-14 py-1.5 pr-1" title="Độ dày phôi (mm)">
                Dày
              </th>
              <th className="w-14 py-1.5 pr-1" title="Bản rộng phôi (mm)">
                Rộng
              </th>
              <th className="w-16 py-1.5 pr-1" title="Chiều dài phôi (mm)">
                Dài
              </th>
              <th className="w-16 py-1.5 pr-1" title="Số chi tiết cho 1 sản phẩm">
                CT/SP <span className="text-red-500">*</span>
              </th>
              <th className="w-16 py-1.5 pr-1" title="Định mức kg vật tư cho 1 chi tiết">
                ĐM kg
              </th>
              <th className="w-16 py-1.5 pr-1" title="Số chi tiết cắt được từ 1 cây">
                CT/cây
              </th>
              <th
                className="w-20 py-1.5 pr-1"
                title="Công đoạn cuối của chi tiết — tuỳ SP (không sơn thì cuối là nguội)"
              >
                CĐ cuối
              </th>
              <th
                className="w-16 py-1.5 pr-1 text-right"
                title="= CT/SP × SL đặt của SP — hệ thống tự tính"
              >
                Tổng cần
              </th>
              <th
                className="w-16 py-1.5 pr-1 text-right"
                title="= Tổng cần × ĐM kg — hệ thống tự tính"
              >
                Kg
              </th>
              <th
                className="w-14 py-1.5 pr-1 text-right"
                title="= Tổng cần ÷ CT/cây — hệ thống tự tính"
              >
                Cây
              </th>
              <th className="py-1.5 pr-1">Ghi chú</th>
              {editable && <th className="w-8 py-1.5" />}
            </tr>
          </thead>
          <tbody>{items.map(renderRow)}</tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          {title} ({rows.length})
        </h2>
        {editable && (
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => void suggest('previous')}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              title="Chép bảng chi tiết từ LSX gần nhất có cùng SP"
            >
              ⧉ Chép từ lệnh trước
            </button>
            <button
              disabled={busy}
              onClick={() => void suggest('bom')}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              title="Điền khung từ BOM kỹ thuật — BOM có thể chưa có hoặc sai, kiểm tra lại"
            >
              ⇣ Gợi ý từ BOM
            </button>
            <button
              disabled={busy || !dirty}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={12} />}
              Lưu bảng chi tiết
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        {canEdit && !locked && lockedByOutputs && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            🔒 Lệnh đã có sổ sản lượng — bảng chi tiết khoá để bảo vệ sổ (ghi đè sẽ xoá
            sạch sổ). Thật sự cần sửa thì xoá hết bản ghi sản lượng trước.
          </p>
        )}
        <p className="mb-3 text-xs text-zinc-500">
          {editable ? (
            <>
              Kế hoạch nhập tay theo file BOM (BOM chỉ để đối chiếu — có thể chưa có hoặc
              sai). Số liệu là bản riêng của lệnh này; sửa BOM sau không ảnh hưởng.
              {noMaterialCount > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400">
                  ⚠ {noMaterialCount} dòng chưa gắn vật tư — sẽ không vào nhu cầu mua.
                </span>
              )}
            </>
          ) : (
            'Bảng chi tiết & định mức do Kế hoạch lập cho lệnh này (chỉ xem).'
          )}
        </p>

        {!loaded ? (
          <p className="text-xs text-zinc-400">Đang tải…</p>
        ) : rows.length === 0 && !editable ? (
          <p className="text-xs text-zinc-400">Chưa nhập bảng chi tiết.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Mỗi SP một khối — chi tiết SP nào nằm trong khối SP đó. */}
            {orderLines.map((line) => {
              const items = indexed.filter((x) => x.r.order_line_id === line.id)
              if (items.length === 0 && !editable) return null
              return (
                <div
                  key={line.id}
                  className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-xs text-zinc-400">
                        {line.product_code}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {line.product_name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        · SL {line.qty.toLocaleString('vi-VN')} · {items.length} chi tiết
                      </span>
                    </div>
                    {editable && (
                      <button
                        disabled={busy}
                        onClick={() => addRow(line.id)}
                        className="rounded-md border border-dashed border-zinc-300 px-2.5 py-1 text-xs hover:bg-white disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        + Thêm chi tiết
                      </button>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-zinc-400">
                      Chưa có chi tiết cho SP này — bấm “+ Thêm chi tiết” hoặc dùng “Gợi ý
                      từ BOM”.
                    </p>
                  ) : (
                    <div className="px-3 pb-2">{renderTable(items)}</div>
                  )}
                </div>
              )
            })}

            {/* Dòng mồ côi (đơn đổi dòng SP sau khi nhập) — hiện để không mất dấu. */}
            {orphans.length > 0 && (
              <div className="overflow-hidden rounded-md border border-amber-300 dark:border-amber-800">
                <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  ⚠ {orphans.length} dòng gắn vào SP không còn trong đơn — kiểm tra lại
                </div>
                <div className="px-3 pb-2">{renderTable(orphans)}</div>
              </div>
            )}
          </div>
        )}

        {loaded && rows.length > 0 && (
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
            Chú giải: <b>CT/SP</b> số chi tiết cho 1 sản phẩm · <b>ĐM kg</b> kg vật tư cho
            1 chi tiết · <b>CT/cây</b> số chi tiết cắt từ 1 cây · <b>CĐ cuối</b> công đoạn
            cuối của chi tiết (tính %HT) · <b>Tổng cần / Kg / Cây</b> hệ thống tự tính. Di
            chuột lên tiêu đề cột để xem giải thích.
          </p>
        )}

        {editable && dirty && (
          <div className="mt-2 flex justify-end">
            <Badge tone="amber">Chưa lưu — bấm “Lưu bảng chi tiết”</Badge>
          </div>
        )}
      </div>
    </section>
  )
}
