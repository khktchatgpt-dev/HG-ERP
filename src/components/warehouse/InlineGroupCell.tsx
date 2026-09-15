'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { MaterialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'

/**
 * Ô NHÓM SỬA TẠI CHỖ trên bảng danh mục (bước 3/3 phân loại vật tư, 03/09/2026).
 *
 * Sửa nhóm cho MỘT mã trước đây là ⋯ → Sửa → cuộn tới "Phân loại" → Lưu — bốn
 * nhịp cho một cái dropdown. Với hàng loạt đã có tích-chọn (bước 1); ô này lo
 * ca lẻ tẻ: đang rà danh sách, thấy một mã lạc, sửa ngay tại dòng.
 *
 * Nhóm phụ chọn trong NHÃN ĐÃ DÙNG của nhóm (taxonomy) — gõ nhãn mới thì vào
 * form đầy đủ, để ô tại chỗ không thành cửa sau đẻ thêm nhóm phụ gõ lệch.
 * Đổi nhóm chính → nhóm phụ về trống (cùng luật đổi nhóm hàng loạt).
 */
export function InlineGroupCell({
  material,
  taxonomy,
  canEdit,
}: {
  material: {
    id: string
    code: string
    group_name: string | null
    sub_group: string | null
  }
  taxonomy: MaterialTaxonomy
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [group, setGroup] = useState(material.group_name ?? '')
  const [sub, setSub] = useState(material.sub_group ?? '')

  function open() {
    setGroup(material.group_name ?? '')
    setSub(material.sub_group ?? '')
    setEditing(true)
  }

  async function save() {
    if (!group) {
      toast.error('Chưa chọn nhóm chính')
      return
    }
    if (group === (material.group_name ?? '') && sub === (material.sub_group ?? '')) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await api(`/api/dept/warehouse/materials/${material.id}`, {
        method: 'PATCH',
        body: { group_name: group, sub_group: sub || null },
      })
      toast.success(`Đã đổi nhóm ${material.code}`, sub ? `${group} · ${sub}` : group)
      setEditing(false)
      router.refresh()
    } catch (e) {
      toast.error('Đổi nhóm thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <div className="group/cell flex min-w-0 items-center gap-1">
        <div className="flex min-w-0 flex-col">
          {material.group_name ? (
            <Badge>{material.group_name}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {material.sub_group && (
            <span className="text-muted-foreground truncate text-[11px]">
              {material.sub_group}
            </span>
          )}
        </div>
        {canEdit && (
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0 opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
            onClick={open}
            aria-label={`Sửa nhóm của ${material.code}`}
            title="Sửa nhóm / nhóm phụ tại chỗ"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>
    )
  }

  const subs = taxonomy.groups.find((g) => g.name === group)?.subs ?? []
  return (
    <div
      className="flex flex-col gap-1"
      onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
    >
      <ToolbarSelect
        value={group}
        onChange={(v) => {
          setGroup(v)
          setSub('')
        }}
        aria-label={`Nhóm chính của ${material.code}`}
        options={[
          { value: '', label: '— chọn nhóm —' },
          ...taxonomy.groups.map((g) => ({ value: g.name, label: g.name })),
        ]}
      />
      <div className="flex items-center gap-1">
        <ToolbarSelect
          value={sub}
          onChange={setSub}
          aria-label={`Nhóm phụ của ${material.code}`}
          options={[
            {
              value: '',
              label: subs.length ? '— không nhóm phụ —' : '— nhóm chưa có nhóm phụ —',
            },
            ...subs.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          disabled={busy}
          onClick={() => void save()}
          aria-label="Lưu nhóm"
          title="Lưu (Enter)"
        >
          {busy ? <Spinner size={12} /> : <Check className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          disabled={busy}
          onClick={() => setEditing(false)}
          aria-label="Huỷ"
          title="Huỷ (Esc)"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
