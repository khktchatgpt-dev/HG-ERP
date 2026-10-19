'use client'

import { useRef, useState } from 'react'
import { Btn, Empty, Pick, Sheet, SheetActions } from '@/components/kit'
import { cn } from '@/lib/utils'
import { apiErrorText } from '@/lib/api'
import { uploadFileTracked } from '@/lib/upload'
import {
  DOC_TYPE_LABEL,
  formatBytes,
  HR_DOC_TYPES,
  type DocType,
} from '@/lib/file-limits'
import type { GiayTo } from '@/modules/dept/hr/cham-cong/hop-dong.service'
import { TD, TH } from '../nv.shared'
import { KhoaRieng } from './tab-ca-nhan'
import type { HoSoCtx } from './useHoSoNv'

type LoaiGt = (typeof HR_DOC_TYPES)[number]

const luc = (iso: string) => {
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

/**
 * Giấy tờ của một người (B3): CCCD 2 mặt, bằng cấp, sơ yếu, khám sức khoẻ, scan HĐ. Kéo thả
 * vào vùng này hoặc bấm Chọn file. Riêng tư — chỉ quyền hr.employee.private đọc / ghi.
 */
export function TabGiayTo({ d }: { d: HoSoCtx }) {
  const ds = d.h.giayTo
  const [loai, setLoai] = useState<LoaiGt>('hr_id_card')
  const [tai, setTai] = useState<string | null>(null)
  const [keo, setKeo] = useState(false)
  const [xoa, setXoa] = useState<GiayTo | null>(null)
  const chon = useRef<HTMLInputElement>(null)
  if (!ds)
    return (
      <KhoaRieng viec="Chỉ Phòng Nhân sự và Ban Giám đốc xem được giấy tờ (có CCCD)." />
    )

  async function taiLen(files: FileList | File[]) {
    for (const f of Array.from(files)) {
      setTai(`${f.name} 0%`)
      try {
        await uploadFileTracked(
          f,
          { kind: 'hr_employee', id: d.n.id },
          'private',
          loai,
          (p) => setTai(`${f.name} ${p}%`),
        )
        d.sauTai(f.name)
      } catch (e) {
        d.toast.error(`Chưa tải được ${f.name}`, apiErrorText(e))
      }
    }
    setTai(null)
  }

  const coLoai = new Set(ds.map((g) => g.loai))
  return (
    <div
      className={cn(
        'min-h-0 overflow-auto',
        keo && 'outline-2 -outline-offset-4 outline-[var(--act)] outline-dashed',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setKeo(true)
      }}
      onDragLeave={() => setKeo(false)}
      onDrop={(e) => {
        e.preventDefault()
        setKeo(false)
        if (e.dataTransfer.files.length) void taiLen(e.dataTransfer.files)
      }}
    >
      <div className="text-k-sm flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-[var(--gutter)] py-1.5">
        <span className="text-[var(--ink-3)]">Loại giấy tờ</span>
        <Pick
          label="Loại giấy tờ"
          width={220}
          value={loai}
          onChange={(v) => setLoai(v as LoaiGt)}
          options={HR_DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] }))}
        />
        <input
          ref={chon}
          type="file"
          hidden
          multiple
          accept=".pdf,image/*,.doc,.docx"
          onChange={(e) => {
            const f = e.target.files
            if (f?.length) void taiLen(f)
            e.target.value = ''
          }}
        />
        <Btn icon="them" busy={tai != null} onClick={() => chon.current?.click()}>
          {tai ? `Đang tải ${tai}` : 'Chọn file'}
        </Btn>
        <span className="text-[var(--ink-3)]">
          hoặc kéo thả file vào đây · PDF / ảnh, tối đa 10MB
        </span>
        <span className="ml-auto text-[var(--ink-2)]">
          Còn thiếu:{' '}
          {(['hr_id_card', 'hr_cv', 'hr_health'] as const)
            .filter((t) => !coLoai.has(t))
            .map((t) => DOC_TYPE_LABEL[t])
            .join(', ') || 'không'}
        </span>
      </div>
      {ds.length === 0 ? (
        <Empty
          level={2}
          headline="Chưa có giấy tờ nào"
          reason="Chưa ai tải lên CCCD, sơ yếu lý lịch hay giấy khám sức khoẻ của người này."
          next={<Btn onClick={() => chon.current?.click()}>Chọn file</Btn>}
        />
      ) : (
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Loại</th>
              <th className={TH}>Tên file</th>
              <th className={TH} style={{ textAlign: 'right' }}>
                Dung lượng
              </th>
              <th className={TH}>Tải lên</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {ds.map((g) => (
              <tr key={g.id}>
                <td className={TD}>
                  {g.loai ? (DOC_TYPE_LABEL[g.loai as DocType] ?? g.loai) : 'Khác'}
                </td>
                <td className={cn(TD, 'whitespace-normal')}>
                  <button
                    type="button"
                    className="text-left text-[var(--act-text)] underline"
                    onClick={() => d.moFile(g.id)}
                  >
                    {g.ten}
                  </button>
                </td>
                <td className={cn(TD, 'num')} style={{ textAlign: 'right' }}>
                  {formatBytes(g.dungLuong)}
                </td>
                <td className={cn(TD, 'num')}>{luc(g.luc)}</td>
                <td className={cn(TD, 'text-right')}>
                  <span className="flex justify-end gap-1">
                    <Btn onClick={() => d.moFile(g.id, true)}>Tải về</Btn>
                    <Btn onClick={() => setXoa(g)}>Gỡ</Btn>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={5}
                className={cn(
                  TD,
                  'sticky bottom-0 bg-[var(--surface-raised)] text-[var(--ink-2)]',
                )}
              >
                {ds.length} giấy tờ ·{' '}
                {formatBytes(ds.reduce((s, g) => s + g.dungLuong, 0))}. Mở file tạo đường
                dẫn ngắn hạn theo quyền người xem.
              </td>
            </tr>
          </tfoot>
        </table>
      )}
      {xoa && (
        <Sheet
          open
          onClose={() => setXoa(null)}
          title="Gỡ giấy tờ"
          subtitle={xoa.ten}
          stakes="nang"
          footer={
            <SheetActions
              stakes="nang"
              onCancel={() => setXoa(null)}
              onConfirm={async () => {
                if (await d.xoaFile(xoa.id, xoa.ten)) setXoa(null)
              }}
              cancelLabel="Để sau"
              confirmLabel="Gỡ file"
              busy={d.busy}
            />
          }
        >
          <p className="text-k-sm text-[var(--ink-2)]">
            File bị xoá khỏi kho, không lấy lại được. Tải về trước nếu cần giữ.
          </p>
        </Sheet>
      )}
    </div>
  )
}
