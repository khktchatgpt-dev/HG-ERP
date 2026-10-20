'use client'

import { useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { HopThoai, OChu } from '../../../_erp/o-nhap'
import { OTim } from '../../../_erp/o-tim'

export type MaGan = { id: string; code: string; name: string; unit: string }

/**
 * GẮN MÃ cho dòng "chưa có mã" lúc nhập kho (0238 · DN-3), viết lại không kit
 * (Kho lối ERP · B5): tồn kho chỉ cộng được vào MỘT MÃ, nên dòng gõ tên tự do
 * trên phiếu đề nghị phải có mã trước khi ghi sổ. Hai đường: chọn mã có sẵn
 * (đường nên đi — tránh mã trùng), hoặc tạo mã mới (quyền
 * `warehouse.material.create`; mã tự cấp theo nhóm, server chặn trùng tên).
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
  const [moi, setMoi] = useState({ name: ten, unit: dvt, group_name: '', spec: '' })
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  async function tim(q: string): Promise<MaGan[]> {
    const res = await api<{ rows: MaGan[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  async function tao() {
    setBusy(true)
    setLoi(null)
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
      onDone({
        id: material.id,
        code: material.code,
        name: material.name,
        unit: material.unit,
      })
    } catch (e) {
      setLoi(`Chưa tạo được mã: ${apiErrorText(e)}`)
      setBusy(false)
    }
  }

  const taoDuoc = moi.name.trim().length > 0 && moi.unit.trim().length > 0 && !busy
  const nhan = { fontSize: 12, color: 'var(--kh-ink3)' }

  return (
    <HopThoai
      title="Gắn mã vật tư"
      subtitle={`Phiếu đề nghị ghi: “${ten}” (${dvt}). Tồn kho chỉ cộng được vào một mã — chọn mã có sẵn trước, không có mới tạo.`}
      onClose={onClose}
      width={580}
    >
      <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b>Chọn mã có sẵn</b>
        <OTim<MaGan>
          search={tim}
          onPick={onDone}
          keyOf={(m) => m.id}
          render={(m) => (
            <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <b className="kh-ma">{m.code}</b>
              <span>{m.name}</span>
              <span className="kh-mut" style={{ marginLeft: 'auto' }}>
                {m.unit}
              </span>
            </span>
          )}
          label="Tìm mã có sẵn"
          placeholder={`gõ mã hoặc tên, VD “${ten.split(/\s+/).slice(0, 2).join(' ')}”`}
          rong="Không có mã nào khớp — tạo mã mới bên dưới"
        />
      </section>

      <section
        style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid var(--kh-hair)' }} // prettier-ignore
      >
        <b>Hoặc tạo mã mới</b>
        {canCreate ? (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={nhan}>Tên vật tư</span>
              <OChu
                value={moi.name}
                onCommit={(v) => setMoi((m) => ({ ...m, name: v }))}
                label="Tên vật tư mới"
                disabled={busy}
              />
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 90 }}
              >
                <span style={nhan}>ĐVT</span>
                <OChu
                  value={moi.unit}
                  onCommit={(v) => setMoi((m) => ({ ...m, unit: v }))}
                  label="Đơn vị tính"
                  disabled={busy}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={nhan}>Nhóm (mã cấp theo nhóm)</span>
                <select
                  className="kh-o"
                  value={moi.group_name}
                  onChange={(e) => setMoi((m) => ({ ...m, group_name: e.target.value }))}
                  aria-label="Nhóm vật tư"
                  disabled={busy}
                  style={{ width: 230 }}
                >
                  <option value="">— chưa xếp nhóm —</option>
                  {nhomOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  flex: '1 1 140px',
                }}
              >
                <span style={nhan}>Quy cách</span>
                <OChu
                  value={moi.spec}
                  onCommit={(v) => setMoi((m) => ({ ...m, spec: v }))}
                  placeholder="không bắt buộc"
                  label="Quy cách"
                  disabled={busy}
                />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="kh-btn p"
                disabled={!taoDuoc}
                onClick={() => void tao()}
              >
                {busy ? 'Đang tạo…' : 'Tạo mã và gắn'}
              </button>
              <span className="kh-mut" style={{ fontSize: 12 }}>
                Mã tự cấp; tên trùng hẳn với mã đã có thì hệ thống chặn — lúc đó chọn mã
                có sẵn ở trên.
              </span>
            </div>
            {loi && <span className="kh-stop">{loi}</span>}
          </>
        ) : (
          <span className="kh-mut" style={{ fontSize: 12 }}>
            Tài khoản này không có quyền tạo mã vật tư — nhờ người có quyền tạo ở Danh mục
            vật tư, rồi quay lại chọn mã có sẵn.
          </span>
        )}
      </section>
    </HopThoai>
  )
}
