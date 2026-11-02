'use client'

import type { DongLenh } from '@/lib/lenh-doi'
import { NHAT_KY_LENH_TU } from '@/lib/nhat-ky-lenh'
import { ngayGioVn } from '@/lib/date-vn'
import { Nhan, Nut, TD, TF, TH } from '../../_erp/ui'
import { dmy } from '../../bang-ke/[id]/ke-hoach.shared'
import { aiLucLenh, moTaLenh, soNgay } from './soat.shared'
import type { SoatCtx } from './useSoatLenh'

const COLS = 5
const NGAY = 'font-mono tabular-nums whitespace-nowrap'

/**
 * TAB "LỆNH SX" (T3, bản vẽ FgRYhTxe… bản 2) — đầu lệnh (ngày xuất, mốc vật tư,
 * ưu tiên, huỷ) và dòng lệnh (thêm / bỏ SP, SL, quy cách) đổi từ mốc soát, cũ →
 * mới, ẢNH HƯỞNG VIỆC MUA, ai · lúc. Đọc nhật ký 0285 + phần mốc soát thấy mà
 * nhật ký không có. Đổi SL SP thì mọi vật tư của SP đó đổi theo — cột ảnh hưởng
 * nói thẳng điều này và trỏ sang tab Vật tư.
 */
export function TabLenh({ d }: { d: SoatCtx }) {
  const t = d.thayDoi
  const truocNhatKy = t.moc.luc < NHAT_KY_LENH_TU
  if (t.lenh.length === 0)
    return (
      <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
        <b>
          {truocNhatKy
            ? `Lệnh không đổi từ ${ngayGioVn(NHAT_KY_LENH_TU)} (lúc bắt đầu ghi nhật ký lệnh)`
            : `Lệnh không đổi từ ${t.moc.k === 'soat' ? 'lần soát cuối' : t.moc.laDuyet ? 'lúc duyệt' : 'lúc phát lệnh'}`}
        </b>
        <span className="text-[var(--ink-2)]">
          Ngày xuất, mốc vật tư, SP và SL từng SP, quy cách (sơn, gỗ, kính, nệm, mây) như
          cũ.
          {truocNhatKy &&
            ` Đổi giữa lúc ${t.moc.k === 'duyet' && !t.moc.laDuyet ? 'phát lệnh' : 'duyệt'} ${dmy(t.moc.luc)} và lúc đó không có vết.`}
        </span>
        <Nut href={`/mua-hang/bang-ke/${d.lsx.id}`}>Mở kế hoạch mua</Nut>
      </div>
    )
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="w-full min-w-[1000px] table-fixed border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-[96px]`}>Phần</th>
            <th className={`${TH} w-[230px]`}>Thay đổi</th>
            <th className={TH}>Cũ → mới</th>
            <th className={`${TH} w-[290px]`}>Ảnh hưởng việc mua</th>
            <th className={`${TH} w-[150px]`}>Ai · lúc</th>
          </tr>
        </thead>
        <tbody>
          {t.lenh.map((x) => (
            <DongLenhO key={x.key} x={x} d={d} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={COLS} className={TF}>
              {t.lenh.length} thay đổi của lệnh
              <span className="font-normal text-[var(--ink-3)]">
                {t.napLaiLenh > 0 &&
                  ` · ${t.napLaiLenh} dòng xoá rồi nạp lại giống hệt — không hiện`}
                {truocNhatKy &&
                  ` · nhật ký lệnh ghi từ ${ngayGioVn(NHAT_KY_LENH_TU)}, đổi trước đó không có vết`}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DongLenhO({ x, d }: { x: DongLenh; d: SoatCtx }) {
  const m = moTaLenh(x)
  const al = aiLucLenh(x)
  const ah = anhHuong(x, d)
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={`${TD} text-[12px] text-[var(--ink-3)]`}>
        {x.phan === 'dau' ? 'Đầu lệnh' : 'Dòng lệnh'}
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={m.gi}>
          {x.phan === 'dong' && x.loai !== 'sua' ? (
            <>
              {m.gi} <Nhan>{x.loai === 'them' ? 'Thêm' : 'Bỏ'}</Nhan>
            </>
          ) : (
            m.gi
          )}
        </span>
        {x.phan === 'dong' && x.napLai && (
          <span className="block text-[11.5px] text-[var(--ink-3)]">xoá rồi nạp lại</span>
        )}
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate font-mono text-[12.5px]" title={m.cuMoi}>
          {m.cuMoi}
        </span>
      </td>
      <td className={TD}>
        <span className={`block ${ah.tone ?? ''}`}>{ah.chinh}</span>
        {ah.phu && (
          <span className="block text-[11.5px] text-[var(--ink-3)]">{ah.phu}</span>
        )}
      </td>
      <td className={`${TD} max-w-0 text-[12px]`}>
        <span className="block truncate" title={al.ai}>
          {al.ai}
        </span>
        <span className={`block text-[var(--ink-3)] ${NGAY}`}>{al.luc}</span>
      </td>
    </tr>
  )
}

/** Ảnh hưởng việc mua của một thay đổi lệnh — câu chính + một dòng phụ. */
function anhHuong(
  x: DongLenh,
  d: SoatCtx,
): { chinh: string; phu?: string; tone?: string } {
  const t = d.thayDoi
  if (x.phan === 'dau') {
    if (x.truong === 'status')
      return x.sau === 'cancelled'
        ? { chinh: 'Dừng đặt thêm cho lệnh này', phu: 'soát các đơn mua đã đặt', tone: 'text-[var(--stop)]' } // prettier-ignore
        : { chinh: 'Lệnh chạy lại — xem lại số cần ở tab Vật tư' }
    if (x.truong === 'priority') return { chinh: 'Đổi thứ tự ưu tiên — không đổi số cần' }
    const n = soNgay(x.truoc, x.sau)
    const doi = n === null ? (x.sau ? 'đặt ngày' : 'bỏ ngày') : n < 0 ? `sớm ${-n} ngày` : `muộn ${n} ngày` // prettier-ignore
    if (x.truong === 'materials_due_at')
      return { chinh: `Hạn vật tư về ${doi}`, phu: 'nhắc NCC theo hạn mới' }
    // Ngày xuất dời mà mốc vật tư không dời theo → nói ra: hạn vật tư có thể đã sai.
    const mocDoi = t.lenh.some((y) => y.phan === 'dau' && y.truong === 'materials_due_at')
    return {
      chinh: `Xuất ${doi}`,
      phu: mocDoi
        ? undefined
        : `mốc vật tư chưa sửa theo (${d.lsx.materials_due_at ? `vẫn ${dmy(d.lsx.materials_due_at)}` : 'vẫn trống'})`, // prettier-ignore
      tone: n !== null && n < 0 ? 'text-[var(--warn)]' : undefined,
    }
  }
  const code = x.sau?.product_code ?? x.truoc?.product_code ?? ''
  const ma = t.dong.filter((r) => r.sps.includes(code)).length
  const xem = ma > 0 ? `${ma} mã đổi · xem tab Vật tư` : undefined
  const khongDm = d.spKhongDinhMuc.includes(code)
  if (x.loai === 'them')
    return khongDm
      ? { chinh: 'SP chưa có định mức', phu: 'chưa tính được vật tư — chờ Kỹ thuật', tone: 'text-[var(--warn)]' } // prettier-ignore
      : {
          chinh: 'Thêm vật tư của SP mới',
          // Có định mức mà không mã kho nào đổi số → vật tư của SP chưa gắn mã.
          phu:
            xem ??
            'chưa mã kho nào tính được — định mức SP chưa gắn mã, xem Kế hoạch mua',
        }
  if (x.loai === 'bo') return { chinh: 'Vật tư của SP không cần nữa', phu: xem ?? 'soát đơn đã đặt cho SP này' } // prettier-ignore
  const parts: string[] = []
  if (x.truong.includes('qty')) {
    const a = x.truoc?.qty ?? 0
    const b = x.sau?.qty ?? 0
    const pct = a > 0 ? ((b - a) / a) * 100 : null
    parts.push(
      pct === null
        ? 'đổi SL — mọi vật tư của SP đổi theo'
        : `${pct > 0 ? '+' : '−'}${Math.abs(pct).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}% mọi vật tư của SP`, // prettier-ignore
    )
  }
  if (x.truong.includes('specs')) parts.push('đổi quy cách — soát đơn sơn / vải / kính…')
  if (x.truong.includes('sp')) parts.push('đổi SP — vật tư theo định mức SP mới')
  if (x.truong.includes('ship_date')) parts.push('đổi ngày xuất của dòng')
  if (x.truong.includes('unit')) parts.push('đổi ĐVT')
  return {
    chinh: parts.join(' · ') || 'đổi dòng lệnh',
    phu: khongDm ? 'SP chưa có định mức — chưa tính được vật tư' : xem,
  }
}
