'use client'

import { useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { Btn, Code, Combobox, Pick, Sheet, TextInput, useToast } from '@/components/kit'

export type MaGan = { id: string; code: string; name: string; unit: string }

/**
 * GẮN MÃ cho dòng "chưa có mã" lúc nhập kho (0238 · DN-3): tồn kho chỉ cộng
 * được vào MỘT MÃ, nên dòng gõ tên tự do trên phiếu đề nghị phải có mã trước
 * khi ghi sổ. Hai đường: chọn mã có sẵn (đường nên đi — tránh mã trùng), hoặc
 * tạo mã mới (Kho có quyền `warehouse.material.create`; mã tự cấp theo nhóm,
 * server chặn trùng tên "chắc chắn").
 */
export function GanMaSheet({
  ten,
  dvt,
  nhomOptions,
  canCreate,
  onClose,
  onDone,
}: {
  /** Tên + ĐVT trên phiếu đề nghị — mồi ô tìm và ô tạo mới. */
  ten: string
  dvt: string
  nhomOptions: string[]
  canCreate: boolean
  onClose: () => void
  onDone: (m: MaGan) => void
}) {
  const toast = useToast()
  const [moi, setMoi] = useState({ name: ten, unit: dvt, group_name: '', spec: '' })
  const [busy, setBusy] = useState(false)

  async function tim(q: string): Promise<MaGan[]> {
    const res = await api<{ rows: MaGan[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  async function tao() {
    setBusy(true)
    try {
      const { material } = await api<{ material: MaGan }>(
        '/api/dept/warehouse/materials',
        {
          method: 'POST',
          body: {
            name: moi.name.trim(),
            unit: moi.unit.trim(),
            group_name: moi.group_name || null,
            spec: moi.spec.trim() || null,
          },
        },
      )
      toast.success(`Đã tạo mã ${material.code}`, material.name)
      onDone({
        id: material.id,
        code: material.code,
        name: material.name,
        unit: material.unit,
      })
    } catch (e) {
      toast.error('Chưa tạo được mã', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const taoDuoc = moi.name.trim().length > 0 && moi.unit.trim().length > 0 && !busy

  return (
    <Sheet
      open
      onClose={onClose}
      width={560}
      title="Gắn mã vật tư"
      subtitle={`Phiếu đề nghị ghi: “${ten}” (${dvt}). Tồn kho chỉ cộng được vào một mã — chọn mã có sẵn trước, không có mới tạo.`}
    >
      <div className="text-k-body flex flex-col gap-4">
        <section className="flex flex-col gap-1.5">
          <span className="font-semibold">Chọn mã có sẵn</span>
          <Combobox<MaGan>
            search={tim}
            onPick={onDone}
            keyOf={(m) => m.id}
            render={(m) => (
              <span className="flex items-baseline gap-2">
                <Code>{m.code}</Code>
                <span className="truncate">{m.name}</span>
                <span className="ml-auto text-[var(--ink-3)]">{m.unit}</span>
              </span>
            )}
            label="Tìm mã có sẵn"
            placeholder={`gõ mã hoặc tên, VD “${ten.split(/\s+/).slice(0, 2).join(' ')}”`}
            width={500}
          />
        </section>

        <section className="flex flex-col gap-2 border-t border-[var(--hair)] pt-3">
          <span className="font-semibold">Hoặc tạo mã mới</span>
          {canCreate ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-k-sm text-[var(--ink-3)]">Tên vật tư</span>
                <TextInput
                  value={moi.name}
                  onCommit={(v) => setMoi((m) => ({ ...m, name: v }))}
                  label="Tên vật tư mới"
                  disabled={busy}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-k-sm text-[var(--ink-3)]">ĐVT</span>
                  <TextInput
                    value={moi.unit}
                    onCommit={(v) => setMoi((m) => ({ ...m, unit: v }))}
                    label="Đơn vị tính"
                    style={{ width: 90 }}
                    disabled={busy}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-k-sm text-[var(--ink-3)]">
                    Nhóm (mã cấp theo nhóm)
                  </span>
                  <Pick
                    value={moi.group_name}
                    onChange={(v) => setMoi((m) => ({ ...m, group_name: v }))}
                    options={[
                      { value: '', label: '— chưa xếp nhóm —' },
                      ...nhomOptions.map((g) => ({ value: g, label: g })),
                    ]}
                    label="Nhóm vật tư"
                    width={220}
                    disabled={busy}
                  />
                </label>
                <label className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <span className="text-k-sm text-[var(--ink-3)]">Quy cách</span>
                  <TextInput
                    value={moi.spec}
                    onCommit={(v) => setMoi((m) => ({ ...m, spec: v }))}
                    placeholder="không bắt buộc"
                    label="Quy cách"
                    disabled={busy}
                  />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Btn primary onClick={() => void tao()} disabled={!taoDuoc}>
                  {busy ? 'Đang tạo…' : 'Tạo mã và gắn'}
                </Btn>
                <span className="text-k-sm text-[var(--ink-3)]">
                  Mã tự cấp; tên trùng hẳn với mã đã có thì hệ thống chặn — lúc đó chọn mã
                  có sẵn ở trên.
                </span>
              </div>
            </>
          ) : (
            <span className="text-k-sm text-[var(--ink-3)]">
              Tài khoản này không có quyền tạo mã vật tư — nhờ người có quyền tạo ở Danh
              mục vật tư, rồi quay lại chọn mã có sẵn.
            </span>
          )}
        </section>
      </div>
    </Sheet>
  )
}
