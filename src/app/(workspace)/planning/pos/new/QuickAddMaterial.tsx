'use client'

import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import {
  type ConversionProfile,
  CONVERSION_PROFILES,
  PROFILE_LABELS,
  hasQty2,
} from '@/lib/material-profile'

export type CreatedMaterial = {
  id: string
  code: string
  name: string
  unit: string
  spec: string | null
  conversion_profile: ConversionProfile
  price_unit: string | null
  unit2_factor: number | null
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
}

/**
 * Thêm nhanh VẬT TƯ MỚI ngay trong form đặt hàng — hàng phát sinh khi mua
 * (NCC chào loại mới) không phải chạy sang Kho khai trước. Chỉ trường thiết
 * yếu; tồn tối thiểu/vị trí kệ… Kho bổ sung sau ở danh mục.
 *
 * KHÔNG dùng <form> — component này nằm TRONG form tạo PO, form lồng form bị
 * HTML cấm (browser sẽ submit form ngoài → mất sạch dòng đang nhập).
 */
export function QuickAddMaterial({
  onCreated,
}: {
  onCreated: (m: CreatedMaterial) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(EMPTY)
  const [profile, setProfile] = useState<ConversionProfile>('A')
  const dual = hasQty2(profile)

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))

  const invalid =
    !f.code.trim() || !f.name.trim() || !f.unit.trim() || (dual && !f.price_unit.trim())

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
            conversion_profile: profile,
            group_name: f.group_name.trim() || null,
            price_unit: dual ? f.price_unit.trim() || null : null,
            unit2_factor:
              dual && f.unit2_factor.trim() ? Number(f.unit2_factor) || null : null,
            min_stock: 0,
          },
        },
      )
      toast.success(`Đã thêm ${material.code}`, 'Vật tư vào ngay dòng đặt bên dưới')
      onCreated(material)
      setF(EMPTY)
      setProfile('A')
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

            {/* Loại quy đổi lái ô đơn vị giá + hệ số/định mức */}
            <div className="flex flex-col gap-1.5 text-sm">
              Loại quy đổi <span className="text-red-500">*</span>
              <div className="grid grid-cols-3 gap-2">
                {CONVERSION_PROFILES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfile(p)}
                    className={
                      'rounded-md border px-2 py-1.5 text-xs font-medium ' +
                      (profile === p
                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300'
                        : 'border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900')
                    }
                  >
                    {PROFILE_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
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
              {dual && (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    Đơn vị tính giá <span className="text-red-500">*</span>
                    <input
                      value={f.price_unit}
                      onChange={set('price_unit')}
                      maxLength={30}
                      placeholder={profile === 'C' ? 'kg' : 'lít / m²…'}
                      className={cls}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    {profile === 'C' ? 'Định mức kg/đơn-vị' : 'Hệ số cứng'}
                    <input
                      value={f.unit2_factor}
                      onChange={set('unit2_factor')}
                      type="number"
                      min={0}
                      step="0.0001"
                      placeholder={profile === 'C' ? '10.1 (kg/cây)' : '18 (lít/thùng)'}
                      className={`${cls} tabular-nums`}
                    />
                  </label>
                </>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Chỉ trường thiết yếu để đặt mua ngay — tồn tối thiểu, vị trí kệ… Kho bổ sung
              sau ở danh mục vật tư.
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
