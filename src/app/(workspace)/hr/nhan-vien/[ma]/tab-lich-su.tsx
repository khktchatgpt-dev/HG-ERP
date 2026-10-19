'use client'

import { Btn, Empty } from '@/components/kit'
import { cn } from '@/lib/utils'
import { ngayVn, TEN_BIEN_DONG } from '@/lib/nhan-su/bien-dong'
import { lyDo, moTaChuyen } from '../../cham-cong/bien-dong-nv'
import { TD, TH } from '../nv.shared'
import type { HoSoCtx } from './useHoSoNv'

const luc = (iso: string) => {
  const d = new Date(Date.parse(iso) + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`
}

/** Vết vào / ra / chuyển (0248). Huỷ thì gạch ngang, không xoá. */
export function TabLichSu({ d }: { d: HoSoCtx }) {
  const ds = d.h.bienDong
  if (!ds.length)
    return (
      <Empty
        level={2}
        headline="Chưa có biến động nào"
        reason={`${d.n.hoTen} có từ trước khi hệ thống ghi biến động (nạp từ máy chấm công); chưa ai ghi ngày vào, cho nghỉ hay chuyển tổ.`}
        next={
          d.h.quyen.sua ? (
            <Btn
              onClick={() => {
                d.setMuc('tong-quan')
                d.setSuaCv(true)
              }}
            >
              Ghi ngày vào làm
            </Btn>
          ) : (
            <span className="text-k-sm text-[var(--ink-3)]">
              Phòng Nhân sự ghi biến động.
            </span>
          )
        }
      />
    )
  return (
    <div className="min-h-0 overflow-auto">
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={TH}>Hiệu lực</th>
            <th className={TH}>Biến động</th>
            <th className={TH}>Chi tiết</th>
            <th className={TH}>Ghi chú</th>
            <th className={TH}>Người ghi · lúc</th>
          </tr>
        </thead>
        <tbody>
          {ds.map((b) => (
            <tr key={b.id} className={cn(b.huyLuc && 'text-[var(--ink-3)]')}>
              <td className={cn(TD, 'num', b.huyLuc && 'line-through')}>
                {ngayVn(b.ngay)}
              </td>
              <td className={cn(TD, b.huyLuc && 'line-through')}>
                {TEN_BIEN_DONG[b.loai]}
                {b.huyLuc && <span className="ml-1.5 no-underline">· đã huỷ</span>}
              </td>
              <td className={cn(TD, 'whitespace-normal')}>
                {b.loai === 'leave' && lyDo(b.lyDo)}
                {b.loai === 'transfer' && b.sau ? `→ ${moTaChuyen(b.sau)}` : ''}
                {b.loai === 'transfer' && b.truoc ? (
                  <span className="text-[var(--ink-3)]">
                    {' '}
                    (trước: {moTaChuyen(b.truoc) || '—'})
                  </span>
                ) : null}
              </td>
              <td className={cn(TD, 'whitespace-normal')}>{b.ghiChu ?? ''}</td>
              <td className={cn(TD, 'text-[var(--ink-2)]')}>
                {b.nguoi ?? 'hệ thống'} · <span className="num">{luc(b.luc)}</span>
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
                'sticky bottom-0 bg-[var(--surface-raised)] whitespace-normal text-[var(--ink-2)]',
              )}
            >
              {ds.length} biến động · {ds.filter((b) => b.huyLuc).length} đã huỷ. Sửa tại
              chỗ chỉ ghi TÊN ô đã đổi, không ghi giá trị (CCCD, địa chỉ không nằm trong
              vết).
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
