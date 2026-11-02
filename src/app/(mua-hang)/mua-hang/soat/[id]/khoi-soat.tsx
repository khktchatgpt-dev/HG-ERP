'use client'

import { ngayGioVn } from '@/lib/date-vn'
import { HopThoai, INPUT, NUM, Nut, O, TD, TH } from '../../_erp/ui'
import { dmy, so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import { ngay } from './tab-vat-tu'
import type { SoatCtx } from './useSoatLenh'

const NGAY = 'font-mono tabular-nums whitespace-nowrap'

/**
 * TAB "ĐỊNH MỨC" (T1) — định mức sửa SAU mốc khi chưa có số cũ: bao nhiêu dòng,
 * SP nào, ai, lúc nào. Từng dòng cũ → mới đọc từ nhật ký 0284 ở bước T2.
 */
export function TabDinhMuc({ d }: { d: SoatCtx }) {
  const s = d.thayDoi.suaSauMoc
  if (!s) return null
  const moc = d.thayDoi.moc
  const sau = moc.k === 'duyet' && !moc.laDuyet ? 'phát lệnh' : 'duyệt'
  const ai = [
    ...s.nguoi,
    ...(s.khongTen ? [`${s.khongTen} dòng không ghi người sửa`] : []),
  ]
  return (
    <section
      aria-label="Định mức sửa sau mốc"
      className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--line)] px-4 py-2 text-[12.5px]">
        <span className="font-semibold text-[var(--warn)]">
          Sửa sau {sau} {dmy(s.tu)}: {so0(s.dongDinhMuc)} dòng định mức
          {s.dongChuaMa ? ` (${so0(s.dongChuaMa)} dòng chưa gắn mã kho)` : ''}
          {s.dongLenh ? ` · ${so0(s.dongLenh)} dòng lệnh` : ''}
        </span>
        <span className="text-[var(--ink-3)]">
          lần cuối {ngay(s.lanCuoi)}
          {ai.length > 0 && ` · ${ai.join(', ')}`}
        </span>
        <span className="text-[var(--ink-2)]">
          Chưa có số cũ để so từng dòng — đối chiếu ở Kế hoạch mua bước 1 rồi bấm Đã soát.
        </span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-[180px]`}>Sản phẩm</th>
            <th className={`${TH} w-[120px] text-right`}>Dòng sửa</th>
            <th className={`${TH} w-[150px]`}>Lần cuối</th>
            <th className={TH}>Người sửa</th>
          </tr>
        </thead>
        <tbody>
          {s.sps.map((p) => (
            <tr key={p.code}>
              <td className={`${TD} font-mono text-[12px]`}>{p.code}</td>
              <td className={`${TD} ${NUM}`}>{so0(p.dong)}</td>
              <td className={`${TD} ${NGAY}`}>{ngayGioVn(p.lanCuoi)}</td>
              <td className={`${TD} text-[var(--ink-2)]`}>
                {p.nguoi ?? 'không ghi người sửa'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

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
