'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/shadcn/button'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'
import { invalidateMaterialPickCache } from '@/components/supply/MaterialPicker'
import {
  MaterialCoreFields,
  coreFromMaterial,
  materialInputClass,
  useMaterialCore,
} from '@/components/warehouse/MaterialCoreFields'
import { fieldsClearedByPayload, type ClearedField } from '@/lib/material-group-fields'
import type { MaterialRefresh } from './po-line'

/** Bản vật tư route GET trả về — chỉ khai trường modal cần. */
type MaterialDetail = MaterialRefresh & {
  id: string
  code: string
  group_name: string | null
  sub_group: string | null
}

// Style CHUẨN dùng chung mọi form vật tư (0137).
const cls = materialInputClass

/**
 * SỬA VẬT TƯ NGAY TRÊN DÒNG ĐƠN — hệ thống đang giai đoạn hoàn thiện data:
 * vật tư thiếu quy cách/barem/ĐVT rất nhiều, mà người phát hiện ra thiếu chính
 * là người đang soạn đơn. Bắt họ mở màn danh mục ở tab khác là thiếu thì cứ
 * thiếu mãi; sửa tại chỗ thì mỗi lần đặt hàng là một lần làm giàu danh mục.
 *
 * Tái dùng nguyên khối `MaterialCoreFields` (nhận dạng/phân loại/barem/đóng
 * gói) — đúng bộ ô của form khai nhanh và danh mục, không chế bộ hỏi thứ ba.
 * PATCH chỉ gồm `corePayload()`: toàn trường thuộc PURCHASING_EDITABLE_FIELDS
 * nên nhân sự Cung ứng sửa được; KHÔNG đụng needs_review (cờ "chờ Kho rà"
 * giữ nguyên — sửa từ đây không thay việc Kho rà).
 */
export function EditMaterialDialog({
  materialId,
  onClose,
  onSaved,
}: {
  /** null = đóng. */
  materialId: string | null
  onClose: () => void
  /** Bản vật tư sau khi lưu — form đơn hút lại số mới vào các dòng đang mở. */
  onSaved: (materialId: string, m: MaterialRefresh) => void
}) {
  const toast = useToast()
  const open = materialId != null
  const [busy, setBusy] = useState(false)
  /*
   * Bản đã nạp GẮN VỚI ID — đổi vật tư thì bản cũ tự hết giá trị (derive, không
   * reset bằng setState trong thân effect: lint cấm vì gây cascading render).
   */
  const [fetched, setFetched] = useState<{ id: string; m: MaterialDetail } | null>(null)
  const loaded = fetched && fetched.id === materialId ? fetched.m : null
  const core = useMaterialCore({
    active: open && loaded != null,
    initial: loaded ? coreFromMaterial(loaded) : undefined,
    excludeCode: loaded?.code,
  })
  const { setF } = core
  /*
   * XÁC NHẬN 2 NHỊP khi lưu sẽ null đè thông số đang có (đợt 2 cải thiện vật
   * tư): người sửa vội giữa lúc soạn đơn là người dễ lỡ tay đổi nhóm nhất —
   * mất kg/m, cách mở thùng… trong im lặng. Nhịp 1 liệt kê, nhịp 2 mới PATCH.
   */
  const [clearWarn, setClearWarn] = useState<ClearedField[] | null>(null)

  /*
   * Nạp BẢN GỐC từ server khi mở — dòng đơn chỉ chụp một phần vật tư, đổ từ
   * dòng vào form là các trường không hiển thị bị PATCH null đè mất im lặng.
   * setState trong callback của timer (không phải thân effect) — cùng lối các
   * effect nạp taxonomy.
   */
  useEffect(() => {
    if (!materialId) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const { material } = await api<{ material: MaterialDetail }>(
          `/api/dept/warehouse/materials/${materialId}`,
        )
        if (cancelled) return
        setFetched({ id: materialId, m: material })
        setF(coreFromMaterial(material))
        setClearWarn(null) // cảnh báo của vật tư trước không dính sang vật tư sau
      } catch (e) {
        if (!cancelled) {
          toast.error(
            'Không nạp được vật tư',
            e instanceof ApiError ? e.message : 'Có lỗi',
          )
          onClose()
        }
      }
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // toast/onClose là hàm ổn định theo vòng đời modal — chỉ nạp lại theo id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId, setF])

  async function save(confirmed = false) {
    if (!materialId || core.invalid || busy) return
    const payload = core.corePayload()
    if (!confirmed && loaded) {
      const cleared = fieldsClearedByPayload(
        loaded as unknown as Record<string, unknown>,
        payload,
      )
      if (cleared.length > 0) {
        setClearWarn(cleared)
        return
      }
    }
    setClearWarn(null)
    setBusy(true)
    try {
      const { material } = await api<{ material: MaterialDetail }>(
        `/api/dept/warehouse/materials/${materialId}`,
        { method: 'PATCH', body: payload },
      )
      // Ô tìm vật tư cache theo từ khoá — không xoá thì vẫn thấy bản cũ.
      invalidateMaterialPickCache()
      toast.success('Đã cập nhật vật tư', material.name)
      onSaved(materialId, material)
      onClose()
    } catch (e) {
      toast.error('Cập nhật thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null
  return (
    <Modal
      open={open}
      title={loaded ? `Sửa vật tư — ${loaded.code}` : 'Sửa vật tư'}
      onClose={onClose}
      maxWidth="sm:max-w-2xl"
    >
      {loaded == null ? (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <Spinner size={16} /> Đang nạp vật tư…
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <MaterialCoreFields
            s={core}
            inputClass={cls}
            unitListId="em-dvt"
            subListId="em-nhom-phu"
          />
          <p className="text-muted-foreground text-xs">
            Sửa ở đây là sửa DANH MỤC dùng chung — quy cách/barem/đóng gói mới áp cho mọi
            đơn sau. Số đã gõ tay trên dòng đơn hiện tại vẫn giữ nguyên.
          </p>
          {/* Nhịp 2 xác nhận null-đè — thường do lỡ tay đổi nhóm. */}
          {clearWarn && (
            <div className="border-[color-mix(in_srgb,var(--stop)_30%,transparent)] bg-[color-mix(in_srgb,var(--stop)_8%,transparent)] rounded-md border p-3 text-sm">
              <p className="font-medium text-[var(--stop)]">
                Lưu sẽ XOÁ {clearWarn.length} thông số đang có (thường do đổi nhóm):
              </p>
              <ul className="mt-1 list-disc pl-5 text-[var(--stop)]">
                {clearWarn.map((c) => (
                  <li key={c.field}>
                    {c.label}: <b>{c.oldValue}</b> → trống
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setClearWarn(null)}>
                  Quay lại sửa
                </Button>
                {/* Hành động PHÁ HUỶ (xoá thông số đang có) — đúng chỗ dùng
                    variant destructive của kit, thay vì tự tô bg-red-600. */}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  {busy && <Spinner size={14} />}
                  Vẫn lưu — xoá {clearWarn.length} ô
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="button" disabled={busy || core.invalid} onClick={() => void save()}>
              {busy && <Spinner size={14} />}
              Lưu vào danh mục
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
