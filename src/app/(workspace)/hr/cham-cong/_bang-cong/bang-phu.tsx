'use client'

import type { ReactNode } from 'react'
import { Empty, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { ChamCongCtx } from './useChamCong'
import { THU, thuCua } from '../cham-cong.shared'

/** Bảng phụ đơn giản: đầu + chân dính, cuộn trong khung. */
function Bang({
  head,
  rows,
  foot,
}: {
  head: ReactNode[]
  rows: ReactNode[][]
  foot: ReactNode
}) {
  const c = 'border-b border-[var(--line-faint)]/40 px-[var(--gutter)] py-1 text-left'
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="text-k-body w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  c,
                  'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] font-semibold text-[var(--ink-2)]',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[var(--surface-hover)]">
              {r.map((v, j) => (
                <td key={j} className={c}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={head.length}
              className={cn(
                c,
                'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
              )}
            >
              {foot}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const ngayThang = (d: ChamCongCtx, ng: number) =>
  `${String(ng).padStart(2, '0')}/${d.b.thang.slice(5)} ${THU[thuCua(d.b, ng)]}`

function NgayLoi({ d, kieu }: { d: ChamCongCtx; kieu: 'thieu' | 'ngoai' }) {
  const ds = d.b.nguoi.flatMap((n) =>
    Object.entries(n.ngay)
      .filter(([, k]) => k.kieu === kieu)
      .map(([ng, k]) => ({ n, ng: Number(ng), k })),
  )
  ds.sort(
    (a, b) => a.ng - b.ng || a.n.code.localeCompare(b.n.code, 'vi', { numeric: true }),
  )
  if (ds.length === 0) {
    return (
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline={
            kieu === 'thieu'
              ? 'Không có ngày nào thiếu lượt'
              : 'Không có ngày nào ngoài ca'
          }
          reason={
            d.b.nguoi.length
              ? 'Mọi ngày đã lấy về đều tính được công.'
              : 'Tháng này chưa lấy dữ liệu từ máy.'
          }
          next={
            d.b.nguoi.length
              ? 'Không cần làm gì thêm.'
              : 'Chọn khoảng ngày rồi bấm “Lấy về từ máy”.'
          }
        />
      </div>
    )
  }
  const nguoi = new Set(ds.map((x) => x.n.id)).size
  return (
    <Bang
      head={[
        'Ngày',
        'Mã',
        'Tên',
        'Ca',
        'Các lượt',
        kieu === 'thieu' ? 'Đoán thiếu' : 'Vì sao lệch',
        '',
      ]}
      rows={ds.map(({ n, ng, k }) => {
        const dau = k.luot[0].gio.slice(0, 5)
        return [
          <span key="n" className="num" style={{ textAlign: 'left' }}>
            {ngayThang(d, ng)}
          </span>,
          <span key="m" className="num" style={{ textAlign: 'left' }}>
            {n.code}
          </span>,
          n.ten,
          d.b.cas.find((c) => c.code === n.ca)?.name ?? n.ca,
          <span key="l" className="num" style={{ textAlign: 'left' }}>
            {k.luot.map((l) => `${l.gio.slice(0, 5)} (${l.may})`).join(' · ')}
          </span>,
          kieu === 'thieu'
            ? dau < '12:00'
              ? 'giờ ra'
              : 'giờ vào'
            : dau < '05:00'
              ? 'Vào quá sớm — ca đêm?'
              : 'Vào quá muộn — ca chiều?',
          <button
            key="x"
            type="button"
            className="text-[var(--act-text)] underline"
            onClick={() => {
              d.setMuc('bang')
              d.setChon({ id: n.id, ngay: ng })
            }}
          >
            Xem trên bảng
          </button>,
        ]
      })}
      foot={`${ds.length} ngày · ${nguoi} người${kieu === 'thieu' ? ' · không gồm ca chỉ bắt 1 lượt (Văn phòng)' : ' — nếu là ca thật thì đổi ca cho người đó, đừng sửa từng ngày'}`}
    />
  )
}

function MaCanXem({ d }: { d: ChamCongCtx }) {
  const ds = d.b.canXem
  if (ds.length === 0) {
    return (
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Không có mã nào cần xem lại"
          reason="Mọi mã đã ghép đều trùng tên giữa hai máy, hoặc chưa lấy về lần nào."
          next="Không cần làm gì thêm."
        />
      </div>
    )
  }
  return (
    <Bang
      head={['Mã', 'Máy', 'Tên trên máy này', 'Cùng mã ở máy kia', 'Đang ghép']}
      rows={ds.map((x) => [
        <span key="m" className="num" style={{ textAlign: 'left' }}>
          {x.ma}
        </span>,
        x.may,
        x.ten,
        x.tenMayKia ?? '—',
        <Tag key="t" tone="warn">
          Hai người khác nhau
        </Tag>,
      ])}
      foot={`${ds.length} dòng · cùng số mã trên hai máy nhưng khác tên nên đã tách thành hai nhân viên (mã thứ hai có đuôi máy). Sửa ghép làm ở bước sau.`}
    />
  )
}

function CaVaLe({ d }: { d: ChamCongCtx }) {
  return (
    <Bang
      head={[
        'Ca',
        'Giờ',
        'Nghỉ',
        'Lượt bắt buộc',
        'Tăng ca từ',
        'Làm tròn TC',
        'Ân hạn trễ',
        'Số người tháng này',
      ]}
      rows={d.b.cas.map((c) => [
        c.name,
        <span key="g" className="num" style={{ textAlign: 'left' }}>
          {c.start}–{c.end}
        </span>,
        `${c.breakMin} phút`,
        c.requiredPunches === 1 ? '1 (chỉ vào)' : '2 (vào + ra)',
        c.otFrom,
        `xuống ${c.otRound} phút`,
        `${c.graceMin} phút`,
        c.soNguoi,
      ])}
      foot={
        d.b.ngayLe.length
          ? `Ngày lễ trong tháng: ${d.b.ngayLe.map((l) => `${String(l.ngay).padStart(2, '0')}/${d.b.thang.slice(5)} ${l.ten}`).join(' · ')} — ai đi làm thì giờ vào cột Lễ.`
          : 'Tháng này không có ngày lễ đã khai. Tết và Giỗ Tổ (âm lịch) Nhân sự nhập mỗi năm.'
      }
    />
  )
}

export function BangPhu({ d }: { d: ChamCongCtx }) {
  if (d.muc === 'thieu') return <NgayLoi d={d} kieu="thieu" />
  if (d.muc === 'ngoai') return <NgayLoi d={d} kieu="ngoai" />
  if (d.muc === 'ma') return <MaCanXem d={d} />
  return <CaVaLe d={d} />
}
