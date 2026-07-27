'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'
import { calcPartDerived, deviation, isCalculable } from '@/lib/bom-calc'
import type { ClusterView, PartGroupView, PartView } from './ProductProfileCards'

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

const SHAPES = [
  ['', '—'],
  ['HOP', 'Hộp'],
  ['TRON', 'Tròn'],
  ['TRONDAC', 'Tròn đặc'],
  ['VUONG', 'Vuông'],
  ['LA', 'La'],
  ['OVAN', 'Ovan'],
  ['TAM', 'Tấm'],
  ['LUOI', 'Lưới'],
  ['V', 'V'],
  ['C', 'C'],
  ['L', 'L'],
  ['PF', 'Profile (theo mã khuôn)'],
] as const

const MATERIALS = [
  ['', '—'],
  ['AL', 'Nhôm'],
  ['IR', 'Sắt'],
  ['IN', 'Inox'],
  ['WD', 'Gỗ'],
  ['RA', 'Mây / nhựa đan'],
  ['GL', 'Kính'],
] as const

const numOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
const txtOrNull = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null

function Field({
  label,
  children,
  wide,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
    </label>
  )
}

/**
 * Thêm / sửa MỘT dòng định mức. Vật tư mô tả bằng quy cách (0092) nên không có
 * ô chọn từ danh mục kho — đúng chủ trương hồ sơ sản phẩm đứng độc lập.
 */
export function PartLineEdit({
  productId,
  part,
  defaultGroup,
  groups,
  clusters,
  onClose,
}: {
  productId: string
  /** null = thêm dòng mới. */
  part: PartView | null
  defaultGroup: string
  groups: PartGroupView[]
  clusters: ClusterView[]
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  // Các ô hình học điều khiển bằng state để tính lại khối lượng / diện tích sơn
  // ngay khi gõ — trong file Excel gốc đây là công thức, không phải số nhập tay.
  const [geo, setGeo] = useState({
    profile_shape: part?.profile_shape ?? '',
    material_kind: part?.material_kind ?? '',
    dim_a_mm: part?.dim_a_mm != null ? String(part.dim_a_mm) : '',
    dim_b_mm: part?.dim_b_mm != null ? String(part.dim_b_mm) : '',
    wall_thickness_mm:
      part?.wall_thickness_mm != null ? String(part.wall_thickness_mm) : '',
    cut_length_mm: part?.cut_length_mm != null ? String(part.cut_length_mm) : '',
    qty: part?.qty != null ? String(part.qty) : '',
  })
  const [weight, setWeight] = useState(
    part?.weight_kg != null ? String(part.weight_kg) : '',
  )
  const set =
    (k: keyof typeof geo) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setGeo((g) => ({ ...g, [k]: e.target.value }))

  const n = (v: string) => {
    const x = Number(String(v).trim())
    return Number.isFinite(x) && String(v).trim() !== '' ? x : null
  }
  const derived = useMemo(
    () =>
      calcPartDerived({
        profile_shape: geo.profile_shape || null,
        material_kind: geo.material_kind || null,
        dim_a_mm: n(geo.dim_a_mm),
        dim_b_mm: n(geo.dim_b_mm),
        wall_thickness_mm: n(geo.wall_thickness_mm),
        cut_length_mm: n(geo.cut_length_mm),
        qty: n(geo.qty),
      }),
    [geo],
  )
  const lech = deviation(n(weight), derived.weight_kg)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = {
      group_code: String(fd.get('group_code') ?? defaultGroup),
      part_name: String(fd.get('part_name') ?? '').trim(),
      section_title: txtOrNull(fd.get('section_title')),
      unit_basis: txtOrNull(fd.get('unit_basis')),
      material_note: txtOrNull(fd.get('material_note')),
      tenon: txtOrNull(fd.get('tenon')),
      tenon_mm: numOrNull(fd.get('tenon_mm')),
      // Gõ tên cụm → server khớp cụm có sẵn hoặc tạo mới. Bỏ trống = dòng Rời.
      cluster_name: txtOrNull(fd.get('cluster_name')),
      material_code: txtOrNull(fd.get('material_code')),
      material_kind: txtOrNull(fd.get('material_kind')),
      profile_shape: txtOrNull(fd.get('profile_shape')),
      profile_code: txtOrNull(fd.get('profile_code')),
      dim_a_mm: numOrNull(fd.get('dim_a_mm')),
      dim_b_mm: numOrNull(fd.get('dim_b_mm')),
      wall_thickness_mm: numOrNull(fd.get('wall_thickness_mm')),
      cut_length_mm: numOrNull(fd.get('cut_length_mm')),
      bend_waste_mm: numOrNull(fd.get('bend_waste_mm')),
      kg_per_m: numOrNull(fd.get('kg_per_m')),
      qty: numOrNull(fd.get('qty')) ?? 0,
      unit: txtOrNull(fd.get('unit')),
      color: txtOrNull(fd.get('color')),
      // Khối lượng: lấy số người nhập, bỏ trống thì dùng số tính từ hình học.
      weight_kg: numOrNull(fd.get('weight_kg')) ?? derived.weight_kg,
      // Tổng dài, diện tích và m³ luôn suy từ hình học — không có ô nhập riêng.
      total_length_m: derived.total_length_m,
      paint_area_m2: derived.paint_area_m2,
      volume_m3: derived.volume_m3,
      note: txtOrNull(fd.get('note')),
    }
    if (!body.part_name) return toast.error('Thiếu thông tin', 'Cần tên chi tiết')
    if (!(body.qty > 0)) return toast.error('Thiếu thông tin', 'Số lượng phải lớn hơn 0')

    setBusy(true)
    try {
      if (part) {
        await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
          method: 'PATCH',
          body,
        })
      } else {
        await api(`/api/dept/technical/products/${productId}/parts`, {
          method: 'POST',
          body,
        })
      }
      router.refresh()
      toast.success(
        part ? 'Đã lưu dòng định mức' : 'Đã thêm dòng định mức',
        body.part_name,
      )
      onClose()
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!part) return
    const ok = await confirm({
      title: 'Xoá dòng định mức?',
      description: `“${part.part_name}” sẽ bị xoá khỏi định mức sản phẩm.`,
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
        method: 'DELETE',
      })
      router.refresh()
      toast.success('Đã xoá dòng định mức', part.part_name)
      onClose()
    } catch (err) {
      toast.error('Xoá thất bại', apiErrorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={part ? `Sửa: ${part.part_name}` : 'Thêm dòng định mức'}
      maxWidth="sm:max-w-2xl"
    >
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Nhóm hạng mục">
          <select
            name="group_code"
            defaultValue={part?.group_code ?? defaultGroup}
            className={cls}
          >
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
        </Field>
        {/* CỤM — gõ tên có sẵn thì gán vào cụm đó, tên mới thì server tạo cụm.
            Bỏ trống = dòng RỜI, trực thuộc sản phẩm. */}
        <Field label="Cụm (Parts / Bộ phận)">
          <input
            name="cluster_name"
            maxLength={120}
            defaultValue={clusters.find((c) => c.id === part?.cluster_id)?.name ?? ''}
            className={cls}
            placeholder="Cụm khung / Cụm mê"
            list="cluster-names-edit"
          />
          <datalist id="cluster-names-edit">
            {clusters.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Tiêu đề khối" wide>
          <input
            name="section_title"
            maxLength={300}
            defaultValue={part?.section_title ?? ''}
            className={cls}
            placeholder="Quy cách nệm: D23 · Quy cách mặt bàn: Acacia - NON FSC"
          />
        </Field>
        <Field label="Đơn vị tính của khối">
          <input
            name="unit_basis"
            maxLength={40}
            defaultValue={part?.unit_basis ?? ''}
            className={cls}
            placeholder="để trống = tính trên 1 SP"
          />
        </Field>
        <Field label="Mộng">
          <input
            name="tenon"
            maxLength={100}
            defaultValue={part?.tenon ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Tên chi tiết *" wide>
          <input
            name="part_name"
            required
            maxLength={300}
            defaultValue={part?.part_name ?? ''}
            className={cls}
            placeholder="Chân, Tay, Nan ngồi…"
          />
        </Field>

        <fieldset className="grid gap-3 rounded-md border border-zinc-200 p-3 sm:col-span-2 sm:grid-cols-3 dark:border-zinc-800">
          <legend className="px-1 text-xs font-semibold text-zinc-500 uppercase">
            Quy cách vật tư
          </legend>
          <Field label="Vật liệu">
            <select
              name="material_kind"
              value={geo.material_kind}
              onChange={set('material_kind')}
              className={cls}
            >
              {MATERIALS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dạng">
            <select
              name="profile_shape"
              value={geo.profile_shape}
              onChange={set('profile_shape')}
              className={cls}
            >
              {SHAPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mã khuôn ép">
            <input
              name="profile_code"
              maxLength={30}
              defaultValue={part?.profile_code ?? ''}
              className={`${cls} font-mono`}
              placeholder="TDHG04"
            />
          </Field>
          <Field label="Tiết diện A (mm)">
            <input
              name="dim_a_mm"
              type="number"
              step="0.01"
              min="0"
              value={geo.dim_a_mm}
              onChange={set('dim_a_mm')}
              className={cls}
            />
          </Field>
          <Field label="Tiết diện B (mm)">
            <input
              name="dim_b_mm"
              type="number"
              step="0.01"
              min="0"
              value={geo.dim_b_mm}
              onChange={set('dim_b_mm')}
              className={cls}
            />
          </Field>
          <Field label="Độ dày thành (mm)">
            <input
              name="wall_thickness_mm"
              type="number"
              step="0.01"
              min="0"
              value={geo.wall_thickness_mm}
              onChange={set('wall_thickness_mm')}
              className={cls}
              placeholder="để trống = đặc"
            />
          </Field>
          <Field label="Vật liệu (ghi trên dòng)">
            <input
              name="material_note"
              maxLength={200}
              defaultValue={part?.material_note ?? ''}
              className={cls}
              placeholder="Nhựa / 7 màu"
            />
          </Field>
          <Field label="Mã vật tư (chuẩn hoá)" wide>
            <input
              name="material_code"
              maxLength={80}
              defaultValue={part?.material_code ?? ''}
              className={`${cls} font-mono`}
              placeholder="VT-AL-HOP-20x40x1"
            />
          </Field>
        </fieldset>

        <Field label="Chiều dài cắt (mm)">
          <input
            name="cut_length_mm"
            type="number"
            step="0.01"
            min="0"
            value={geo.cut_length_mm}
            onChange={set('cut_length_mm')}
            className={cls}
          />
        </Field>
        <Field label="Số lượng / 1 SP *">
          <input
            name="qty"
            type="number"
            step="0.0001"
            min="0"
            required
            value={geo.qty}
            onChange={set('qty')}
            className={cls}
          />
        </Field>
        <Field label="ĐVT">
          <input
            name="unit"
            maxLength={30}
            defaultValue={part?.unit ?? ''}
            className={cls}
            placeholder="cái / kg / mét"
          />
        </Field>
        {/* Biểu mẫu ghi phi hao bằng MILIMET cộng thẳng vào chiều dài cắt (chi
            tiết uốn cong tốn thêm phôi), không phải phần trăm. */}
        <Field label="Phi hao uốn (mm)">
          <input
            name="bend_waste_mm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={part?.bend_waste_mm ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Mộng (mm)">
          <input
            name="tenon_mm"
            type="number"
            step="0.1"
            min="0"
            defaultValue={part?.tenon_mm ?? ''}
            className={cls}
          />
        </Field>
        <Field label="Màu">
          <input
            name="color"
            maxLength={100}
            defaultValue={part?.color ?? ''}
            className={cls}
            placeholder="7 màu / xi trắng"
          />
        </Field>
        {/* Thanh định hình có gân — tiết diện không suy ra từ 3 kích thước bao
            được, phải tra bảng. Ví dụ ngay trong file mẫu: TD-HG04 = 0.260 kg/m. */}
        <Field label="kg / mét (profile tra bảng)">
          <input
            name="kg_per_m"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={part?.kg_per_m ?? ''}
            className={cls}
            placeholder="0.260"
          />
        </Field>
        <Field label="Khối lượng (kg)">
          <input
            name="weight_kg"
            type="number"
            step="0.000001"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={
              derived.weight_kg != null
                ? `tự tính ${derived.weight_kg}`
                : 'chưa tính được'
            }
            className={cls}
          />
        </Field>

        {/* Số suy từ hình học — trong file Excel gốc đây là công thức. */}
        <div className="rounded-md border border-sky-200 bg-sky-50/60 px-3 py-2 text-xs sm:col-span-2 dark:border-sky-900 dark:bg-sky-950/30">
          {derived.total_length_m == null && derived.weight_kg == null ? (
            <span className="text-muted-foreground">
              Điền vật liệu, dạng, tiết diện, dài cắt và số lượng để tự tính khối lượng và
              diện tích sơn.
              {geo.profile_shape && !isCalculable(geo.profile_shape) && (
                <> Dạng “{geo.profile_shape}” có tiết diện tuỳ ý nên phải nhập tay.</>
              )}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium">Theo hình học:</span>
              {derived.total_length_m != null && (
                <span>tổng dài {derived.total_length_m} m</span>
              )}
              {derived.weight_kg != null && <span>KL {derived.weight_kg} kg</span>}
              {derived.paint_area_m2 != null && (
                <span>sơn {derived.paint_area_m2} m²</span>
              )}
              {derived.weight_kg != null && (
                <button
                  type="button"
                  onClick={() => setWeight(String(derived.weight_kg))}
                  className="text-primary font-medium hover:underline"
                >
                  Dùng số này
                </button>
              )}
              {lech != null && lech > 0.05 && (
                <span className="rounded bg-amber-100 px-1.5 py-px font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  số nhập lệch {Math.round(lech * 100)}% so với hình học
                </span>
              )}
            </div>
          )}
        </div>
        <Field label="Ghi chú" wide>
          <input
            name="note"
            maxLength={500}
            defaultValue={part?.note ?? ''}
            className={cls}
          />
        </Field>

        <div className="mt-2 flex items-center justify-between gap-2 sm:col-span-2">
          {part ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
            >
              Xoá dòng
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Huỷ
            </button>
            <button
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
            >
              {busy && <Spinner size={14} />}
              {busy ? 'Đang lưu…' : part ? 'Lưu' : 'Thêm'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
