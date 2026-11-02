'use client'

import { Fragment } from 'react'
import { ngayGioVn } from '@/lib/date-vn'
import type { DongDinhMuc } from '@/lib/lenh-doi'
import { NHAT_KY_DINH_MUC_TU, type LoaiDongDm } from '@/lib/nhat-ky-dinh-muc'
import { ChipLoc, HangLoc, NUM, Nhan, Nut, TD, TF, TH } from '../../_erp/ui'
import { dmy, so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import { AnhHuongO, anhCua, moTaDoi, NHAN_LOAI_DM, ngayGio, tenNhom } from './soat.shared'
import { ngay } from './tab-vat-tu'
import type { SoatCtx } from './useSoatLenh'

const COLS = 7
const NGAY = 'font-mono tabular-nums whitespace-nowrap'
const LOAI: LoaiDongDm[] = ['them', 'sua', 'bo']

/**
 * TAB "ĐỊNH MỨC" (T2, bản vẽ N1 DvGDS3wg… + FgRYhTxe…) — dòng định mức nào đổi
 * từ mốc soát, cũ → mới, ảnh hưởng số mua, ai sửa lúc nào. Đọc THAY ĐỔI RÒNG
 * từ nhật ký 0284 (sửa 3 lần còn một dòng; nạp lại giống hệt không hiện).
 *
 * Phần sửa TRƯỚC ngày bật nhật ký không có số cũ: chỉ đếm theo SP (như T1).
 */
export function TabDinhMuc({ d }: { d: SoatCtx }) {
  const t = d.thayDoi
  const s = t.suaSauMoc
  if (t.dinhMuc.length === 0 && !s) return <RongDinhMuc d={d} />
  return (
    <>
      {t.dinhMuc.length > 0 && (
        <HangLoc>
          <ChipLoc
            on={d.locDm === null}
            count={t.dinhMuc.length}
            onClick={() => d.setLocDm(null)}
          >
            Tất cả
          </ChipLoc>
          {LOAI.filter((k) => d.demDm[k] > 0).map((k) => (
            <ChipLoc
              key={k}
              on={d.locDm === k}
              count={d.demDm[k]}
              onClick={() => d.setLocDm(d.locDm === k ? null : k)}
            >
              {NHAN_LOAI_DM[k]}
            </ChipLoc>
          ))}
          <input
            type="search"
            aria-label="Tìm sản phẩm, chi tiết, mã vật tư"
            placeholder="Tìm SP, chi tiết, mã…"
            value={d.qDm}
            onChange={(e) => d.setQDm(e.target.value)}
            className="ml-auto w-[220px] rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[4px] text-[12.5px] outline-none focus:border-[var(--act)]"
          />
        </HangLoc>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        {t.dinhMuc.length > 0 && <BangNhatKy d={d} />}
        {s && <TruocNhatKy d={d} />}
      </div>
    </>
  )
}

/** Bảng dòng định mức đổi, nhóm theo SP của lệnh. */
function BangNhatKy({ d }: { d: SoatCtx }) {
  const t = d.thayDoi
  if (d.hienDm.length === 0)
    return (
      <div className="grid justify-items-start gap-1.5 border-b border-[var(--line)] px-4 py-6">
        <b>Không dòng nào khớp bộ lọc</b>
        <span className="text-[var(--ink-2)]">
          Có {t.dinhMuc.length} dòng định mức đổi — bộ lọc hiện tại không để lại dòng nào.
        </span>
        <Nut onClick={() => (d.setLocDm(null), d.setQDm(''))}>Bỏ lọc</Nut>
      </div>
    )
  const theoSp: [string, DongDinhMuc[]][] = []
  for (const x of d.hienDm) {
    const g = theoSp.find(([id]) => id === x.product_id)
    if (g) g[1].push(x)
    else theoSp.push([x.product_id, [x]])
  }
  return (
    <table className="w-full min-w-[1040px] table-fixed border-collapse">
      <thead>
        <tr>
          <th className={`${TH} w-[104px]`}>Nhóm</th>
          <th className={TH}>Chi tiết</th>
          <th className={`${TH} w-[120px]`}>Mã vật tư</th>
          <th className={`${TH} w-[60px]`}>Đổi</th>
          <th className={`${TH} w-[250px]`}>Cũ → mới</th>
          <th className={`${TH} w-[200px]`}>Ảnh hưởng số mua</th>
          <th className={`${TH} w-[150px]`}>Ai · lúc</th>
        </tr>
      </thead>
      <tbody>
        {theoSp.map(([id, rows]) => (
          <Fragment key={id}>
            <tr>
              <td
                colSpan={COLS}
                className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]"
              >
                <span className="font-mono">{rows[0].sp}</span>{' '}
                <span className="font-normal">
                  · {so0(rows[0].slSp)} cái trong lệnh · {rows.length} dòng đổi
                </span>
              </td>
            </tr>
            {rows.map((x) => (
              <DongNhatKy key={x.key} x={x} />
            ))}
          </Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={COLS} className={TF}>
            {t.dinhMuc.length} dòng định mức đổi ·{' '}
            {new Set(t.dinhMuc.map((x) => x.product_id)).size} SP
            <span className="font-normal text-[var(--ink-3)]">
              {' '}
              · ảnh hưởng = chênh SL/SP × SL SP trong lệnh, theo ĐVT định mức (số đã quy
              đổi ở tab Vật tư)
              {t.napLaiGiong > 0 &&
                ` · ${t.napLaiGiong} dòng xoá rồi nạp lại giống hệt — không hiện`}
            </span>
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function DongNhatKy({ x }: { x: DongDinhMuc }) {
  const a = anhCua(x)
  const maTruoc = x.truoc?.material_code ?? null
  const maSau = x.sau?.material_code ?? null
  const doiMa = x.loai === 'sua' && x.truong.includes('material_code')
  const ma = x.loai === 'bo' ? maTruoc : maSau
  const moTa = moTaDoi(x)
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={`${TD} text-[12px] text-[var(--ink-2)]`}>{tenNhom(a.group_code)}</td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={a.part_name ?? undefined}>
          {a.part_name ?? '—'}
        </span>
        {x.napLai && (
          <span className="block text-[11.5px] text-[var(--ink-3)]">xoá rồi nạp lại</span>
        )}
      </td>
      <td className={`${TD} font-mono text-[12px]`}>
        {ma ? ma : <span className="text-[var(--ink-3)]">chưa mã</span>}
        {doiMa && (
          <span className="block text-[11.5px] text-[var(--ink-3)]">
            trước: {maTruoc ?? 'chưa mã'}
          </span>
        )}
      </td>
      <td className={TD}>
        <Nhan>{NHAN_LOAI_DM[x.loai]}</Nhan>
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={moTa.join(' · ')}>
          {moTa.join(' · ')}
        </span>
      </td>
      <td className={TD}>
        <AnhHuongO d={x} />
      </td>
      <td className={`${TD} max-w-0 text-[12px]`}>
        <span className="block truncate" title={x.boi ?? undefined}>
          {x.boi ?? <span className="text-[var(--ink-3)]">không ghi người</span>}
        </span>
        <span className={`block text-[var(--ink-3)] ${NGAY}`}>{ngayGio(x.luc)}</span>
      </td>
    </tr>
  )
}

/** Phần sửa trước ngày bật nhật ký — không có số cũ, chỉ đếm theo SP. */
function TruocNhatKy({ d }: { d: SoatCtx }) {
  const s = d.thayDoi.suaSauMoc!
  const moc = d.thayDoi.moc
  const sau = moc.k === 'duyet' && !moc.laDuyet ? 'phát lệnh' : 'duyệt'
  const ai = [...s.nguoi, ...(s.khongTen ? [`${s.khongTen} dòng không ghi người sửa`] : [])] // prettier-ignore
  return (
    <section aria-label="Định mức sửa trước khi có nhật ký">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--line)] px-4 py-2 text-[12.5px]">
        <span className="font-semibold text-[var(--warn)]">
          Sửa sau {sau} {dmy(s.tu)}, trước khi có nhật ký (
          {ngayGioVn(NHAT_KY_DINH_MUC_TU)}
          ): {so0(s.dongDinhMuc)} dòng
          {s.dongChuaMa ? ` (${so0(s.dongChuaMa)} dòng chưa gắn mã kho)` : ''}
        </span>
        <span className="text-[var(--ink-3)]">
          lần cuối {ngay(s.lanCuoi)}
          {ai.length > 0 && ` · ${ai.join(', ')}`}
        </span>
        <span className="text-[var(--ink-2)]">
          Không có số cũ để so từng dòng — đối chiếu ở Kế hoạch mua bước 1 rồi bấm Đã
          soát. Các lần sửa từ {dmy(NHAT_KY_DINH_MUC_TU)} hiện đủ cũ → mới.
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

function RongDinhMuc({ d }: { d: SoatCtx }) {
  const m = d.thayDoi.moc
  const tu = m.k === 'soat' ? 'lần soát cuối' : m.laDuyet ? 'lúc duyệt' : 'lúc phát lệnh'
  return (
    <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
      <b>Định mức không đổi từ {tu}</b>
      <span className="text-[var(--ink-2)]">
        {d.thayDoi.choSoat
          ? 'Thay đổi của lệnh này nằm ở tab bên cạnh (thông tin lệnh / số nhập tay), không ở định mức.' // prettier-ignore
          : 'Không dòng định mức nào của các sản phẩm bị thêm, sửa hay xoá sau mốc.'}{' '}
        Nhật ký định mức ghi từ {ngayGioVn(NHAT_KY_DINH_MUC_TU)}.
      </span>
      <Nut href={`/mua-hang/bang-ke/${d.lsx.id}`}>Mở kế hoạch mua</Nut>
    </div>
  )
}
