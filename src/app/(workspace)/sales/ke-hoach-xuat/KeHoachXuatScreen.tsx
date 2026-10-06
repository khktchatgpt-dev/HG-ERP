'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Home } from 'lucide-react'
import {
  cong,
  dayThang,
  tenThang,
  thangCua,
  tinhTrang,
  SAP_XUAT_NGAY,
  type DotXuat,
  type LenhXuat,
} from '@/lib/ke-hoach-xuat'
import {
  Chon,
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  Panel,
  Seg,
  Tick,
  ToolBtn,
} from '../_erp/ui'
import { TheoLenh } from './theo-lenh'
import { TheoThang } from './theo-thang'

const usd = (v: number) => Math.round(v).toLocaleString('vi-VN')
const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * KẾ HOẠCH XUẤT HÀNG (06/10/2026).
 *
 * Chủ dự án: "thực tế sale lên kế hoạch xuất hàng cho các lệnh sản xuất nên
 * thiết kế lại" — nên khung chính là THEO LỆNH (`theo-lenh.tsx`): chọn một lệnh
 * → lưới đợt (PO khách) × SP như sổ Excel của Sale. "Tổng theo tháng"
 * (`theo-thang.tsx`) giữ làm khung phụ để nhìn cả năm.
 * Kiểu ERP — khối chung `../_erp/ui`. Số liệu: `lib/ke-hoach-xuat.ts`.
 */
export function KeHoachXuatScreen({
  lenhs,
  dots,
  today,
  canEdit,
}: {
  lenhs: LenhXuat[]
  dots: DotXuat[]
  today: string
  /** Được chia đợt / sửa kế hoạch (`sales.order.manage`). */
  canEdit: boolean
}) {
  const [xem, setXem] = useState<'lenh' | 'thang'>('lenh')
  const [khach, setKhach] = useState('')
  const [anXong, setAnXong] = useState(true)
  const [chiViec, setChiViec] = useState(false)

  const thangNay = thangCua(today)
  const thangs = useMemo(() => dayThang(dots), [dots])
  const ba = thangs.filter((m) => m > thangNay).slice(0, 3)
  const conLai = dots.filter((d) => d.lsx_status !== 'completed')
  const trongThang = conLai.filter(
    (d) => d.ship_date && thangCua(d.ship_date) === thangNay,
  )
  const baThang = conLai.filter((d) => d.ship_date && ba.includes(thangCua(d.ship_date)))
  const deY = dots.filter((d) => tinhTrang(d, today).canDeY)
  const khachs = [...new Set(lenhs.map((l) => l.customer))].sort()

  /** Lệnh "cần việc": chưa chia đợt / có đợt chưa ngày / có đợt cần để ý. */
  const canViec = (l: LenhXuat) =>
    l.lsx_status !== 'completed' &&
    (l.chua_chia || l.muon > 0 || l.dots.some((d) => tinhTrang(d, today).canDeY))
  const chuaChia = lenhs.filter((l) => l.chua_chia && l.lsx_status !== 'completed')

  const lenhLoc = useMemo(
    () =>
      lenhs
        .filter(
          (l) =>
            (!khach || l.customer === khach) &&
            (!anXong || l.lsx_status !== 'completed') &&
            (!chiViec || canViec(l)),
        )
        .sort((a, b) => ((a.ship_date ?? '9') < (b.ship_date ?? '9') ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lenhs, khach, anXong, chiViec, today],
  )
  const dotLoc = dots.filter(
    (d) => (!khach || d.customer === khach) && (!anXong || d.lsx_status !== 'completed'),
  )

  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Kế hoạch xuất hàng' }]}
        title="Kế hoạch xuất hàng"
        sub={`Hôm nay ${ngay(today)} · ${lenhs.length} lệnh · ${dots.length} đợt (PO)`}
        actions={
          <>
            <ToolBtn href="/sales" icon={Home}>
              Việc hôm nay
            </ToolBtn>
            <ToolBtn href="/sales/phan-tich" icon={BarChart3}>
              Phân tích doanh số
            </ToolBtn>
          </>
        }
      />

      <CountStrip>
        <CountCell
          label={`Xuất tháng ${tenThang(thangNay)} (USD)`}
          value={usd(cong(trongThang).value)}
          sub={`${trongThang.length} đợt · ${new Set(trongThang.map((d) => d.customer)).size} khách`}
        />
        <CountCell
          label={
            ba.length
              ? `${tenThang(ba[0])} – ${tenThang(ba.at(-1)!)} (USD)`
              : '3 tháng tới'
          }
          value={usd(cong(baThang).value)}
          sub={`${baThang.length} đợt`}
        />
        <CountCell
          label="Lệnh chưa chia đợt theo PO"
          value={chuaChia.length}
          tone={chuaChia.length ? 'warn' : 'neutral'}
          sub={chuaChia.map((l) => l.lsx_code).join(', ') || 'mọi lệnh đã chia'}
          on={chiViec}
          onClick={() => {
            setChiViec(!chiViec)
            setXem('lenh')
          }}
          title="Bấm để chỉ hiện lệnh cần lên kế hoạch"
        />
        <CountCell
          label="Đợt cần để ý"
          value={deY.length}
          tone={deY.length ? 'warn' : 'neutral'}
          sub={`quá ngày / ≤${SAP_XUAT_NGAY} ngày mà vật tư chưa đủ`}
        />
        <CountCell
          label="Tiến độ sản xuất"
          value={null}
          sub="xưởng chưa ghi sổ trên hệ thống (0 phiếu)"
        />
      </CountStrip>

      <FilterRow>
        <Seg
          label="Xem"
          value={xem}
          onChange={setXem}
          options={[
            { value: 'lenh', label: 'Theo lệnh', count: lenhLoc.length },
            { value: 'thang', label: 'Tổng theo tháng' },
          ]}
        />
        <Chon
          label="Khách"
          value={khach}
          onChange={setKhach}
          options={[
            { value: '', label: 'Mọi khách' },
            ...khachs.map((k) => ({ value: k, label: k })),
          ]}
        />
        {xem === 'lenh' && (
          <Tick checked={chiViec} onChange={setChiViec}>
            Chỉ lệnh cần lên kế hoạch
          </Tick>
        )}
        <Tick checked={anXong} onChange={setAnXong}>
          Ẩn lệnh đã hoàn thành
        </Tick>
      </FilterRow>

      <div className="flex-1 px-6 py-4">
        {xem === 'lenh' ? (
          lenhLoc.length === 0 ? (
            <Panel title="Không lệnh nào khớp bộ lọc">
              <p className="text-muted-foreground px-4 py-8 text-center text-[13px]">
                Bỏ bớt lọc khách / “Chỉ lệnh cần lên kế hoạch” để xem lại các lệnh.
              </p>
            </Panel>
          ) : (
            <TheoLenh
              canEdit={canEdit}
              key={`${khach}|${anXong}|${chiViec}`}
              lenhs={lenhLoc}
              today={today}
            />
          )
        ) : (
          <TheoThang
            dots={dotLoc}
            thangs={thangs}
            thangNay={thangNay}
            onCell={(k) => {
              setKhach(k)
              setXem('lenh')
            }}
          />
        )}
      </div>

      <ErpStatusBar
        left={`Kế hoạch xuất hàng · ${khach || 'mọi khách'} · ${xem === 'lenh' ? `${lenhLoc.length} lệnh` : `${dotLoc.length} đợt`}`}
        right={`${usd(cong(dotLoc).value)} USD`}
      />
    </ErpPage>
  )
}
