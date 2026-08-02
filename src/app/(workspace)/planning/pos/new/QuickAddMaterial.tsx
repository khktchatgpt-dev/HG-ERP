'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { invalidateMaterialPickCache } from '@/components/supply/MaterialPicker'
import type { PoTemplate } from '@/lib/po-template'

export type CreatedMaterial = {
  id: string
  code: string
  name: string
  unit: string
  spec: string | null
  group_name: string | null
  price_unit: string | null
  unit2_factor: number | null
  /*
   * Ba trường này ĐỌC LẠI TỪ SERVER chứ không suy ở client. Trước đây form gọi
   * xong là tự gán `po_template = mẫu đang soạn` cho dòng, trong khi service
   * nuốt mất trường đó nên DB lưu null — màn hình một đằng, danh mục một nẻo,
   * và chỉ lộ ra ở lần đặt sau. Lấy đúng số server trả về thì lệch là thấy ngay.
   */
  po_template: PoTemplate | null
  kg_per_m: number | null
  default_bar_length_m: number | null
}

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

const EMPTY = {
  code: '',
  name: '',
  unit: '',
  spec: '',
  group_name: '',
  price_unit: '',
  unit2_factor: '',
  kg_per_m: '',
  default_bar_length_m: '',
}

/**
 * Thêm nhanh VẬT TƯ MỚI ngay trong form đặt hàng — hàng phát sinh khi mua
 * (NCC chào loại mới) không phải chạy sang Kho khai trước. Chỉ trường thiết
 * yếu; tồn tối thiểu/vị trí kệ… Kho bổ sung sau ở danh mục.
 *
 * KHÔNG dùng <form> — component này nằm TRONG form tạo PO, form lồng form bị
 * HTML cấm (browser sẽ submit form ngoài → mất sạch dòng đang nhập).
 */
/** Chuẩn hoá tên để dò trùng gần giống: thường hoá, bỏ dấu, gọn khoảng trắng. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

export function QuickAddMaterial({
  onCreated,
  template,
}: {
  onCreated: (m: CreatedMaterial) => void
  /** Mẫu đơn đang soạn — vật tư mới khai luôn mẫu này để lần sau khỏi hỏi. */
  template: PoTemplate
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  /** Vật tư gần giống, dò Ở SERVER theo tên đang gõ (chống 1 món 2 mã). */
  const [similar, setSimilar] = useState<{ code: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(EMPTY)
  // Vật tư có "đơn vị tính giá" (kg/m²…) → dòng đặt sẽ có ô SL-tính-giá nhập tay.
  // Suy TRỰC TIẾP từ price_unit, không còn nhãn quy đổi A/B/C.
  const dual = f.price_unit.trim() !== ''
  /*
   * Mẫu nhôm tính tiền bằng (kg/m × dài cây × số cây) × giá/kg — thiếu kg/m thì
   * `deriveLine` tụt về (số cây × giá/kg), sai cỡ 6 lần. Vật tư nhôm khai ở đây
   * mà bỏ trống ô này là dòng đầu tiên dùng nó đã tính sai, nên hỏi luôn tại chỗ.
   * Vẫn cho bỏ trống: còn đường tra qua ô chọn khuôn trên dòng đặt.
   */
  const alu = template === 'aluminium'

  /*
   * Dò trùng tên ở SERVER. Bản cũ so với danh mục 1.000 vật tư nạp sẵn vào trang;
   * trang không nạp nữa (tìm ở server) nên cảnh báo phải đi hỏi API. Debounce
   * 350ms và chỉ hỏi khi tên đủ dài để không bắn request mỗi ký tự.
   *
   * Mọi setState nằm TRONG timer, không gọi thẳng trong thân effect — gọi đồng bộ
   * ở thân effect gây cascading render (react-hooks/set-state-in-effect).
   */
  const nName = normalizeName(f.name)
  useEffect(() => {
    const tooShort = !open || nName.length < 4
    const t = setTimeout(
      async () => {
        if (tooShort) return setSimilar([])
        try {
          const { materials } = await api<{
            materials: { code: string; name: string }[]
          }>(
            `/api/dept/supply/po-materials?limit=8&q=${encodeURIComponent(f.name.trim())}`,
          )
          setSimilar(
            materials
              .filter((m) => {
                const other = normalizeName(m.name)
                return other.includes(nName) || nName.includes(other)
              })
              .slice(0, 3),
          )
        } catch {
          setSimilar([]) // chỉ là cảnh báo, lỗi mạng không được chặn tạo vật tư
        }
      },
      tooShort ? 0 : 350,
    )
    return () => clearTimeout(t)
  }, [open, f.name, nName])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))

  const invalid = !f.code.trim() || !f.name.trim() || !f.unit.trim()

  async function handle() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const { material } = await api<{ material: CreatedMaterial }>(
        '/api/dept/warehouse/materials',
        {
          method: 'POST',
          body: {
            code: f.code.trim(),
            name: f.name.trim(),
            unit: f.unit.trim(),
            spec: f.spec.trim() || null,
            group_name: f.group_name.trim() || null,
            price_unit: f.price_unit.trim() || null,
            unit2_factor:
              dual && f.unit2_factor.trim() ? Number(f.unit2_factor) || null : null,
            // Khai luôn mẫu đơn đang soạn — lần sau vật tư này tự về đúng mẫu.
            po_template: template,
            kg_per_m: alu && f.kg_per_m.trim() ? Number(f.kg_per_m) || null : null,
            default_bar_length_m:
              alu && f.default_bar_length_m.trim()
                ? Number(f.default_bar_length_m) || null
                : null,
            min_stock: 0,
          },
        },
      )
      toast.success(`Đã thêm ${material.code}`, 'Vật tư vào ngay dòng đặt bên dưới')
      // Ô chọn vật tư cache kết quả tìm theo tab — không xoá thì vật tư vừa tạo
      // không hiện ra khi gõ lại đúng từ khoá cũ.
      invalidateMaterialPickCache()
      onCreated(material)
      setF(EMPTY)
      setOpen(false)
    } catch (err) {
      toast.error(
        'Thêm vật tư thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:border-sky-400 hover:text-sky-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        + Vật tư mới (chưa có trong danh mục)
      </button>
      {open && (
        <Modal
          open={open}
          title="Thêm vật tư mới"
          onClose={() => setOpen(false)}
          maxWidth="sm:max-w-2xl"
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[140px_1fr_110px]">
              <label className="flex flex-col gap-1 text-sm">
                Mã VT <span className="text-red-500">*</span>
                <input
                  value={f.code}
                  onChange={set('code')}
                  maxLength={60}
                  className={`${cls} font-mono`}
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Tên vật tư <span className="text-red-500">*</span>
                <input
                  value={f.name}
                  onChange={set('name')}
                  maxLength={200}
                  className={cls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                ĐVT <span className="text-red-500">*</span>
                <input
                  value={f.unit}
                  onChange={set('unit')}
                  maxLength={30}
                  placeholder="cây / tấm…"
                  className={cls}
                />
              </label>
            </div>
            {similar.length > 0 && (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                ⚠ Tên gần giống vật tư đã có:{' '}
                {similar.map((s) => `${s.code} — ${s.name}`).join(' · ')}. Nếu là cùng một
                món, tìm lại ở ô lọc thay vì tạo mã mới.
              </p>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Quy cách
              <input
                value={f.spec}
                onChange={set('spec')}
                maxLength={200}
                placeholder="25×25×1.2mm (cây 6m) · dày 18mm…"
                className={cls}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                Nhóm
                <input
                  value={f.group_name}
                  onChange={set('group_name')}
                  maxLength={100}
                  placeholder="Sắt thép…"
                  className={cls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Đơn vị tính giá
                <input
                  value={f.price_unit}
                  onChange={set('price_unit')}
                  maxLength={30}
                  placeholder="kg / m² / lít… (bỏ trống nếu giá theo ĐVT)"
                  className={cls}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Hệ số tham khảo
                <input
                  value={f.unit2_factor}
                  onChange={set('unit2_factor')}
                  type="number"
                  min={0}
                  step="0.0001"
                  placeholder="vd 10.1 (kg/cây)"
                  disabled={!dual}
                  className={`${cls} tabular-nums disabled:opacity-50`}
                />
              </label>
            </div>
            {alu && (
              <div className="grid gap-3 rounded-md bg-sky-50 p-3 sm:grid-cols-2 dark:bg-sky-950/30">
                <label className="flex flex-col gap-1 text-sm">
                  kg/m <span className="text-xs text-zinc-500">(mẫu nhôm)</span>
                  <input
                    value={f.kg_per_m}
                    onChange={set('kg_per_m')}
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder="vd 0.248"
                    className={`${cls} tabular-nums`}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Dài cây mặc định (m)
                  <input
                    value={f.default_bar_length_m}
                    onChange={set('default_bar_length_m')}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="vd 5.65"
                    className={`${cls} tabular-nums`}
                  />
                </label>
                <p className="text-xs text-zinc-500 sm:col-span-2">
                  Đơn nhôm tính tiền bằng (kg/m × dài cây × số cây) × giá/kg. Bỏ trống thì
                  dòng đặt tính theo số cây — sai số lớn; tra được kg/m qua ô chọn mã
                  khuôn trên dòng.
                </p>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Nhập &quot;đơn vị tính giá&quot; khi NCC báo giá theo đơn vị khác ĐVT đặt
              (vd đặt cây, giá theo kg) — dòng đặt sẽ có ô SL-tính-giá nhập tay. Hệ số chỉ
              để gợi ý, sửa được. Tồn tối thiểu, vị trí kệ… Kho bổ sung sau ở danh mục.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Huỷ
              </button>
              <button
                type="button"
                disabled={busy || invalid}
                onClick={() => void handle()}
                className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Thêm & đưa vào đơn
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
