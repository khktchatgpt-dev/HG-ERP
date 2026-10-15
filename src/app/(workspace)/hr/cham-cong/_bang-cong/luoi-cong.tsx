'use client'

import { Empty, Btn } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { ChamCongCtx } from './useChamCong'
import {
  THU,
  gio,
  nhanO,
  so,
  thuCua,
  type KetQuaNgay,
  type NguoiCong,
} from '../cham-cong.shared'

/**
 * LƯỚI BẢNG CÔNG — người × ngày, kiểu bảng công Excel Nhân sự vẫn dùng.
 *
 * Kit không có ma trận "dòng người × 31 cột ngày + cột tổng ghim phải", nên viết
 * thẳng bảng ở đây (CLAUDE.md 06/10/2026: kit hụt thì tự viết, dùng token).
 * Ba cột trái (Mã · Tên · Ca) và năm cột tổng phải ghim; đầu và chân dính.
 * Ô trống ở ngày CHƯA LẤY VỀ tô gạch — để không đọc nhầm là vắng.
 */

const W_MA = 56
const W_TEN = 150
const W_CA = 76
const W_NGAY = 40
const W_TONG = 56
const TONG = ['Công', 'TC giờ', 'CN giờ', 'Lễ giờ', 'Thiếu'] as const

const tdBase =
  'h-[26px] border-r border-b border-[var(--line-faint)]/40 px-1 whitespace-nowrap'
const stick = 'sticky z-[1] bg-inherit'

export function LuoiCong({ d }: { d: ChamCongCtx }) {
  const { b, dong } = d
  const ngays = Array.from({ length: b.soNgay }, (_, i) => i + 1)
  const le = new Map(b.ngayLe.map((x) => [x.ngay, x.ten]))
  const daLay = new Set(b.ngayCoDuLieu)

  if (b.nguoi.length === 0) {
    return (
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline={`Chưa có lượt quẹt nào của tháng ${b.thang.slice(5)}/${b.thang.slice(0, 4)}`}
          reason="Dữ liệu chỉ vào ERP khi bấm lấy về — máy chấm công không tự gửi lên."
          next="Chọn khoảng ngày ở thanh trên rồi bấm “Lấy về từ máy”."
        />
      </div>
    )
  }
  if (dong.length === 0) {
    return (
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Không có ai khớp bộ lọc"
          reason={`Tháng này có ${b.nguoi.length} người quẹt, nhưng không ai khớp ô tìm / ca / chỉ người cần xử lý.`}
          next={
            <Btn
              onClick={() => {
                d.setTim('')
                d.setCa('')
                d.setChiCanXuLy(false)
              }}
            >
              Bỏ lọc
            </Btn>
          }
        />
      </div>
    )
  }

  const right = (i: number) => (TONG.length - 1 - i) * W_TONG
  const coMat = (ng: number) =>
    dong.filter((n) => n.ngay[ng] && n.ngay[ng].kieu !== 'thieu').length
  const sum = (f: (n: NguoiCong) => number) => dong.reduce((s, n) => s + f(n), 0)

  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Bảng công"
      tabIndex={0}
    >
      <table
        className="text-k-sm border-separate border-spacing-0"
        style={{ width: 'max-content' }}
      >
        <thead>
          <tr className="bg-[var(--surface-raised)]">
            <th
              className={cn(tdBase, stick, 'top-0 z-[3] h-[34px] text-left')}
              style={{ left: 0, width: W_MA, minWidth: W_MA }}
            >
              Mã
            </th>
            <th
              className={cn(tdBase, stick, 'top-0 z-[3] text-left')}
              style={{ left: W_MA, width: W_TEN, minWidth: W_TEN }}
            >
              Tên
            </th>
            <th
              className={cn(
                tdBase,
                stick,
                'top-0 z-[3] border-r-[var(--line)] text-left',
              )}
              style={{ left: W_MA + W_TEN, width: W_CA, minWidth: W_CA }}
            >
              Ca
            </th>
            {ngays.map((ng) => {
              const t = thuCua(b, ng)
              return (
                <th
                  key={ng}
                  className={cn(
                    tdBase,
                    'sticky top-0 z-[2] text-center leading-tight font-semibold',
                    t === 0 && 'bg-[var(--chrome)]',
                    le.has(ng) && 'bg-[var(--warn-wash)]',
                  )}
                  style={{ width: W_NGAY, minWidth: W_NGAY }}
                  title={le.get(ng)}
                >
                  {ng}
                  <span className="block text-[10px] font-normal text-[var(--ink-3)]">
                    {le.has(ng) ? 'Lễ' : THU[t]}
                  </span>
                </th>
              )
            })}
            {TONG.map((h, i) => (
              <th
                key={h}
                className={cn(
                  tdBase,
                  stick,
                  'top-0 z-[3] text-right',
                  i === 0 && 'border-l border-l-[var(--line)]',
                )}
                style={{ right: right(i), width: W_TONG, minWidth: W_TONG }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dong.map((n) => (
            <Dong
              key={n.id}
              d={d}
              n={n}
              ngays={ngays}
              daLay={daLay}
              le={le}
              right={right}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-[var(--surface-raised)] font-semibold">
            <td
              className={cn(
                tdBase,
                stick,
                'bottom-0 z-[3] border-t border-t-[var(--line)]',
              )}
              style={{ left: 0 }}
            />
            <td
              className={cn(
                tdBase,
                stick,
                'bottom-0 z-[3] border-t border-t-[var(--line)]',
              )}
              style={{ left: W_MA }}
            >
              Người có công
            </td>
            <td
              className={cn(
                tdBase,
                stick,
                'bottom-0 z-[3] border-t border-t-[var(--line)] font-normal text-[var(--ink-3)]',
              )}
              style={{ left: W_MA + W_TEN }}
            >
              {dong.length} người
            </td>
            {ngays.map((ng) => (
              <td
                key={ng}
                className={cn(
                  tdBase,
                  'num sticky bottom-0 z-[2] border-t border-t-[var(--line)] bg-inherit text-center',
                )}
              >
                {daLay.has(ng) ? coMat(ng) || '' : ''}
              </td>
            ))}
            {[
              so(
                sum((n) => n.tong.cong),
                1,
              ),
              so(sum((n) => n.tong.tangCa) / 60, 1),
              so(sum((n) => n.tong.chuNhat) / 60, 1),
              so(sum((n) => n.tong.le) / 60, 1),
              so(sum((n) => n.tong.thieu)),
            ].map((v, i) => (
              <td
                key={i}
                className={cn(
                  tdBase,
                  stick,
                  'num bottom-0 z-[3] border-t border-t-[var(--line)] text-right',
                  i === 0 && 'border-l border-l-[var(--line)]',
                )}
                style={{ right: right(i) }}
              >
                {v}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function Dong({
  d,
  n,
  ngays,
  daLay,
  le,
  right,
}: {
  d: ChamCongCtx
  n: NguoiCong
  ngays: number[]
  daLay: Set<number>
  le: Map<number, string>
  right: (i: number) => number
}) {
  const chonDong = d.chon?.id === n.id
  const tong = [
    so(n.tong.cong, 2),
    n.tong.tangCa ? gio(n.tong.tangCa) : '',
    n.tong.chuNhat ? gio(n.tong.chuNhat) : '',
    n.tong.le ? gio(n.tong.le) : '',
    n.tong.thieu ? so(n.tong.thieu) : '',
  ]
  return (
    <tr
      className={cn(
        'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]',
        chonDong && 'bg-[var(--act-wash)] hover:bg-[var(--act-wash)]',
      )}
    >
      <td className={cn(tdBase, stick, 'num')} style={{ left: 0, textAlign: 'left' }}>
        {n.code}
      </td>
      <td
        className={cn(tdBase, stick, 'max-w-[150px] overflow-hidden text-ellipsis')}
        style={{ left: W_MA }}
        title={`${n.ten} · quẹt ở máy ${n.may.join(', ')}`}
      >
        {n.ten}
      </td>
      <td
        className={cn(tdBase, stick, 'border-r-[var(--line)] text-[var(--ink-2)]')}
        style={{ left: W_MA + W_TEN }}
      >
        {d.b.cas.find((c) => c.code === n.ca)?.name ?? n.ca}
      </td>
      {ngays.map((ng) => {
        const k = n.ngay[ng]
        const t = thuCua(d.b, ng)
        const nen = cn(
          t === 0 && 'bg-[var(--chrome)]/40',
          le.has(ng) && 'bg-[var(--warn-wash)]/60',
          !daLay.has(ng) &&
            'bg-[repeating-linear-gradient(135deg,var(--surface-raised)_0_4px,transparent_4px_8px)]',
        )
        if (!k) return <td key={ng} className={cn(tdBase, nen)} />
        return <O key={ng} d={d} n={n} ng={ng} k={k} nen={nen} />
      })}
      {tong.map((v, i) => (
        <td
          key={i}
          className={cn(
            tdBase,
            stick,
            'num text-right',
            i === 0 && 'border-l border-l-[var(--line)]',
            i === 4 && v && 'font-semibold text-[var(--stop)]',
          )}
          style={{ right: right(i) }}
        >
          {v}
        </td>
      ))}
    </tr>
  )
}

function O({
  d,
  n,
  ng,
  k,
  nen,
}: {
  d: ChamCongCtx
  n: NguoiCong
  ng: number
  k: KetQuaNgay
  nen: string
}) {
  const on = d.chon?.id === n.id && d.chon.ngay === ng
  const { chinh, tc } = nhanO(k)
  return (
    <td
      className={cn(
        tdBase,
        'num relative cursor-pointer text-center hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-[var(--act-line)]',
        k.kieu !== 'thieu' && k.kieu !== 'ngoai' && nen,
        k.kieu === 'thieu' && 'bg-[var(--stop-wash)] font-semibold text-[var(--stop)]',
        k.kieu === 'ngoai' && 'bg-[var(--warn-wash)] font-semibold text-[var(--warn)]',
        on && 'outline outline-2 -outline-offset-2 outline-[var(--act)]',
      )}
      style={{ textAlign: 'center' }}
      tabIndex={0}
      aria-label={`${n.ten} ngày ${ng}: ${chinh}${tc ? ' cộng ' + tc + ' giờ tăng ca' : ''}${k.tre ? `, trễ ${k.tre} phút` : ''}`}
      onClick={() => d.setChon({ id: n.id, ngay: ng })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          d.setChon({ id: n.id, ngay: ng })
        }
      }}
    >
      {chinh}
      {tc && <span className="text-[var(--act-text)]">{tc}</span>}
      {k.tre > 0 && (
        <span
          aria-hidden
          className="absolute top-0 right-0 h-0 w-0 border-t-[6px] border-l-[6px] border-t-[var(--warn)] border-l-transparent"
        />
      )}
    </td>
  )
}
