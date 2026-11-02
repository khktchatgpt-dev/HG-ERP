'use client'

import { ngayGioVn } from '@/lib/date-vn'
import { HopThoai, INPUT, NUM, Nut, O, TD, TH } from '../../_erp/ui'
import { dmy, so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import type { SoatCtx } from './useSoatLenh'

const NGAY = 'font-mono tabular-nums whitespace-nowrap'

/** TAB "LỆNH SX" (T1) — ngày xuất, mốc vật tư, SL từng SP đổi so với mốc soát. */
export function TabLenh({ d }: { d: SoatCtx }) {
  const gt = (v: string | number | null) =>
    v === null ? '—' : typeof v === 'number' ? so0(v) : dmy(v)
  const PHAN: Record<string, string> = {
    ship_date: 'Đầu lệnh',
    materials_due_at: 'Đầu lệnh',
    sp_sl: 'Dòng lệnh',
    sp_them: 'Dòng lệnh',
    sp_bo: 'Dòng lệnh',
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-[120px]`}>Phần</th>
            <th className={TH}>Thay đổi</th>
            <th className={`${TH} w-[260px]`}>Cũ → mới</th>
          </tr>
        </thead>
        <tbody>
          {d.thayDoi.thongTin.map((x) => (
            <tr key={`${x.k}|${x.nhan}`}>
              <td className={`${TD} text-[var(--ink-3)]`}>{PHAN[x.k]}</td>
              <td className={TD}>
                {x.k === 'sp_them'
                  ? `Thêm SP ${x.nhan}`
                  : x.k === 'sp_bo'
                    ? `Gỡ SP ${x.nhan}`
                    : x.k === 'sp_sl'
                      ? `${x.nhan} · SL sản phẩm`
                      : x.nhan}
              </td>
              <td className={`${TD} ${NGAY}`}>
                {x.truoc !== null && <s className="text-[var(--ink-3)]">{gt(x.truoc)}</s>}
                {x.truoc !== null && ' → '}
                <b>{gt(x.nay)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Hộp "Đã soát" — ghi mốc mới, kèm ghi chú tuỳ chọn. */
export function HopSoat({ d }: { d: SoatCtx }) {
  const dat = d.dem.dat_them
  return (
    <HopThoai
      title={`Ghi mốc soát · ${d.lsx.code}`}
      aside={d.soDoi > 0 ? `${d.soDoi} thay đổi` : undefined}
      onClose={() => d.setMoSoat(false)}
      footer={
        <>
          <Nut onClick={() => d.setMoSoat(false)}>Huỷ</Nut>
          <Nut chinh busy={d.busy} onClick={() => void d.soat()}>
            Đã soát
          </Nut>
        </>
      }
    >
      <ul className="m-0 grid gap-0.5 pl-[18px] text-[var(--ink-2)]">
        <li>Từ giờ máy so với số hôm nay; lần đổi sau chỉ hiện phần đổi mới.</li>
        {dat > 0 && (
          <li>{dat} mã phải đặt thêm vẫn nằm ở Kế hoạch mua, mục “Còn phải đặt”.</li>
        )}
      </ul>
      <O label="Ghi chú · không bắt buộc">
        <textarea
          id="soat-ghi-chu"
          rows={3}
          maxLength={500}
          value={d.ghiChu}
          onChange={(e) => d.setGhiChu(e.target.value)}
          className={INPUT}
          placeholder="Đã giao ai đặt, đã hỏi Kỹ thuật mã nào…"
        />
      </O>
    </HopThoai>
  )
}

/** ⋯ › Lịch sử soát — ai soát, lúc nào, mấy thay đổi, ghi chú. */
export function HopLichSu({ d }: { d: SoatCtx }) {
  return (
    <HopThoai
      title={`Lịch sử soát · ${d.lsx.code}`}
      onClose={() => d.setMoLichSu(false)}
      width={640}
      footer={<Nut onClick={() => d.setMoLichSu(false)}>Đóng</Nut>}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-[128px]`}>Lúc</th>
            <th className={`${TH} w-[150px]`}>Người</th>
            <th className={`${TH} w-[72px] text-right`}>Đổi</th>
            <th className={TH}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {d.lichSu.map((l) => (
            <tr key={l.id}>
              <td className={`${TD} ${NGAY}`}>{ngayGioVn(l.luc)}</td>
              <td className={TD}>{l.boi ?? '—'}</td>
              <td className={`${TD} ${NUM}`}>{so0(l.so_doi)}</td>
              <td className={`${TD} whitespace-pre-wrap`}>{l.ghi_chu ?? ''}</td>
            </tr>
          ))}
          <tr>
            <td className={`${TD} ${NGAY} text-[var(--ink-3)]`}>
              {d.duyetLuc ? ngayGioVn(d.duyetLuc) : '—'}
            </td>
            <td className={`${TD} text-[var(--ink-3)]`}>mốc đầu</td>
            <td className={`${TD} ${NUM} text-[var(--ink-3)]`}>—</td>
            <td className={`${TD} text-[var(--ink-3)]`}>
              lúc duyệt lệnh (ảnh chụp định mức)
            </td>
          </tr>
        </tbody>
      </table>
    </HopThoai>
  )
}
