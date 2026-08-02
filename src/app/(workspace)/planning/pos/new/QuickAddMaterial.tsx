'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { invalidateMaterialPickCache } from '@/components/supply/MaterialPicker'
import type { PoTemplate } from '@/lib/po-template'
import { kgPerM, rhoFor } from '@/lib/metal-weight'

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
   * Hai mẫu tính tiền theo KHỐI LƯỢNG nên bắt buộc có barem, và `lineReady` chặn
   * gửi dòng khi thiếu:
   *   aluminium → (kg/m × dài cây × số cây) × giá/kg
   *   metal_kg  → (SL × kg/đơn-vị) × giá/kg,  kg/đơn-vị = kg/m × dài cây
   * Bị chặn mà không có số thì người soạn đơn gõ đại cho qua — nên hỏi ngay lúc
   * khai vật tư, và hỏi kèm số máy tính sẵn chứ không đưa ô trống.
   */
  const needsWeight = template === 'aluminium' || template === 'metal_kg'

  /*
   * BAREM MÁY ĐỌC ĐƯỢC TỪ TÊN — hình học trong tên × tỷ trọng xưởng.
   * Đây là chỗ thay "gõ tay không ai kiểm" bằng "máy tính, người xác nhận":
   * "Sắt vuông 30x30x0.8" ra đúng 0,7445 kg/m như barem xưởng đang cân.
   * Đọc không ra thì trả null kèm lý do, KHÔNG đoán — đoán độ dày là sai tiền.
   */
  const derived = useMemo(() => {
    if (!needsWeight || f.name.trim().length < 4) return null
    return kgPerM(f.name, rhoFor(f.name, f.group_name))
  }, [needsWeight, f.name, f.group_name])

  /** Số đang gõ lệch hẳn số máy đọc được → nhiều khả năng gõ nhầm dấu chấm. */
  const kgTyped = Number(f.kg_per_m)
  const kgOff =
    derived?.kg && Number.isFinite(kgTyped) && kgTyped > 0
      ? Math.abs(kgTyped - derived.kg) / derived.kg
      : 0
  const kgMismatch = kgOff > 0.05

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

  const invalid = !f.name.trim() || !f.unit.trim()

  /** Số kg/m sẽ ghi: ưu tiên số người gõ, bỏ trống thì lấy số máy đọc được. */
  const kgToSave = f.kg_per_m.trim() ? Number(f.kg_per_m) || null : (derived?.kg ?? null)

  async function handle() {
    if (invalid || busy) return
    setBusy(true)
    try {
      const { material } = await api<{ material: CreatedMaterial }>(
        '/api/dept/warehouse/materials',
        {
          method: 'POST',
          body: {
            name: f.name.trim(),
            unit: f.unit.trim(),
            spec: f.spec.trim() || null,
            group_name: f.group_name.trim() || null,
            price_unit: f.price_unit.trim() || null,
            unit2_factor:
              dual && f.unit2_factor.trim() ? Number(f.unit2_factor) || null : null,
            // Khai luôn mẫu đơn đang soạn — lần sau vật tư này tự về đúng mẫu.
            po_template: template,
            // Bỏ trống mà máy đọc được thì lấy số máy — không để vật tư ra đời
            // thiếu barem rồi đẩy việc gõ số sang người soạn đơn đang vội.
            kg_per_m: needsWeight ? kgToSave : null,
            default_bar_length_m:
              needsWeight && f.default_bar_length_m.trim()
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
            {/*
              KHÔNG CÓ Ô "MÃ VT" — server tự cấp `XX-0000` nối tiếp theo nhóm.
              Quy ước mã là của danh mục, không phải thứ người soạn đơn phải nhớ;
              gõ `NH999` giữa lúc vội là lệch khỏi cả nghìn mã còn lại.
            */}
            <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
              <label className="flex flex-col gap-1 text-sm">
                Tên vật tư <span className="text-red-500">*</span>
                <input
                  value={f.name}
                  onChange={set('name')}
                  maxLength={200}
                  className={cls}
                  autoFocus
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
            {needsWeight && (
              <div className="grid gap-3 rounded-md bg-sky-50 p-3 sm:grid-cols-2 dark:bg-sky-950/30">
                <label className="flex flex-col gap-1 text-sm">
                  kg/m
                  <input
                    value={f.kg_per_m}
                    onChange={set('kg_per_m')}
                    type="number"
                    min={0}
                    step="0.0001"
                    placeholder={
                      derived?.kg ? `${derived.kg} (máy đọc được)` : 'vd 0.248'
                    }
                    className={`${cls} tabular-nums ${
                      kgMismatch ? 'border-red-400 dark:border-red-600' : ''
                    }`}
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

                {/* Máy đọc được barem từ quy cách trong tên → đưa số ra, không bắt gõ. */}
                {derived?.kg != null && (
                  <p className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Máy đọc được <b className="tabular-nums">{derived.kg}</b> kg/m từ
                      quy cách trong tên.
                    </span>
                    {!f.kg_per_m.trim() ? (
                      <button
                        type="button"
                        onClick={() =>
                          setF((s) => ({ ...s, kg_per_m: String(derived.kg) }))
                        }
                        className="rounded border border-emerald-300 px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                      >
                        Dùng số này
                      </button>
                    ) : null}
                  </p>
                )}
                {derived?.kg == null && derived?.reason && (
                  <p className="text-xs text-zinc-500 sm:col-span-2">
                    Máy không tính được barem ({derived.reason}) — nhập theo phiếu cân của
                    NCC hoặc sổ tay.
                  </p>
                )}
                {kgMismatch && derived?.kg != null && (
                  <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 sm:col-span-2 dark:bg-red-950/40 dark:text-red-400">
                    ⚠ Số đang nhập lệch {Math.round(kgOff * 100)}% so với {derived.kg}{' '}
                    kg/m máy tính từ quy cách. Kiểm lại dấu chấm thập phân — sai chỗ này
                    là sai thẳng số tiền trên đơn.
                  </p>
                )}

                <p className="text-xs text-zinc-500 sm:col-span-2">
                  {template === 'aluminium'
                    ? 'Đơn nhôm tính tiền bằng (kg/m × dài cây × số cây) × giá/kg.'
                    : 'Đơn inox/sắt tính tiền bằng (SL × kg/đơn-vị) × giá/kg; kg/đơn-vị = kg/m × dài cây.'}{' '}
                  Bỏ trống mà máy đọc được thì lấy số máy. Nhôm định hình theo khuôn thì
                  tra mã khuôn trên dòng đặt — tên không suy ra được mặt cắt.
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
