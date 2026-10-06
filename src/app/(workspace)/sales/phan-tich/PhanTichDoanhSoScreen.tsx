'use client'

import { useMemo, useState } from 'react'
import { Container, Home } from 'lucide-react'
import {
  dauChiem,
  phanTheo,
  tongHop,
  type ChieuPhan,
  type DongBan,
} from '@/lib/phan-tich-doanh-so'
import {
  Chon,
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  NUM,
  Panel,
  Seg,
  TD,
  TH,
  Thanh,
  ToolBtn,
} from '../_erp/ui'

const usd = (v: number) => Math.round(v).toLocaleString('vi-VN')
const pct = (r: number | null) =>
  r == null ? '' : `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

const CHIEU: { value: ChieuPhan; label: string }[] = [
  { value: 'khach', label: 'Khách' },
  { value: 'loai', label: 'Loại hàng' },
  { value: 'khung', label: 'Khung' },
  { value: 'sp', label: 'Sản phẩm' },
  { value: 'thang', label: 'Tháng nhận đơn' },
]

/**
 * PHÂN TÍCH DOANH SỐ — đơn đã nhận dồn vào đâu, lãi kế hoạch ra sao trên phần đã
 * có giá thành (06/10/2026). Nguồn số + những gì CHƯA so được: `lib/phan-tich-
 * doanh-so.ts`. Giá thành chỉ tới người có quyền — lọc ở service.
 *
 * Kiểu ERP (chủ dự án 06/10: "làm lại theo kiểu ERP"): khối chung `../_erp/ui`
 * — thanh công cụ góc phải, ô đếm vuông, chọn chiều bằng nút liền khối (như
 * pivot của Odoo Sales Analysis / SAP MCTE), lưới có STT + chân tổng.
 */
export function PhanTichDoanhSoScreen({
  dongs,
  canSeeCost,
}: {
  dongs: DongBan[]
  canSeeCost: boolean
}) {
  const [chieu, setChieu] = useState<ChieuPhan>('khach')
  const [khach, setKhach] = useState('')
  const khachs = useMemo(() => [...new Set(dongs.map((d) => d.customer))].sort(), [dongs])
  const loc = useMemo(
    () => (khach ? dongs.filter((d) => d.customer === khach) : dongs),
    [dongs, khach],
  )
  const t = useMemo(() => tongHop(loc), [loc])
  const theoKhach = useMemo(() => phanTheo(loc, 'khach'), [loc])
  const theoSp = useMemo(() => phanTheo(loc, 'sp'), [loc])
  const rows = useMemo(() => phanTheo(loc, chieu), [loc, chieu])
  const thangs = useMemo(() => phanTheo(dongs, 'thang'), [dongs])
  const tenChieu = CHIEU.find((c) => c.value === chieu)!.label
  const lon = khach ? theoSp[0] : theoKhach[0]

  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Phân tích doanh số' }]}
        title="Phân tích doanh số"
        sub={`Đơn đã nhận ${thangs.length ? `${thangs[0].label} – ${thangs.at(-1)!.label}` : ''} · USD · chưa có xuất / hoá đơn`}
        actions={
          <>
            <ToolBtn href="/sales" icon={Home}>
              Việc hôm nay
            </ToolBtn>
            <ToolBtn href="/sales/ke-hoach-xuat" icon={Container}>
              Kế hoạch xuất hàng
            </ToolBtn>
          </>
        }
      />

      <CountStrip>
        <CountCell
          label="Trị giá đơn đã nhận (USD)"
          value={usd(t.value)}
          sub={`${t.so_don} đơn · ${t.so_khach} khách · ${t.so_sp} SP`}
        />
        <CountCell
          label={khach ? `SP lớn nhất của ${khach}` : 'Khách lớn nhất'}
          value={lon ? pct(lon.share) : null}
          sub={
            lon
              ? `${lon.label}${khach ? '' : ` · 3 khách lớn = ${pct(dauChiem(theoKhach, 3))}`}`
              : undefined
          }
        />
        <CountCell
          label="8 SP đầu chiếm"
          value={pct(dauChiem(theoSp, 8))}
          sub={`trên ${theoSp.length} SP`}
        />
        {canSeeCost && (
          <CountCell
            label="Lãi kế hoạch"
            value={t.lai_pct == null ? null : pct(t.lai_pct)}
            tone={t.phu < 0.5 ? 'warn' : 'neutral'}
            sub={
              t.lai_pct == null
                ? 'chưa SP nào có giá thành bóc tách'
                : `${usd(t.lai)} USD · chỉ trên ${pct(t.phu)} trị giá có giá thành`
            }
            width="min-w-[220px] flex-[1.4] basis-0"
          />
        )}
      </CountStrip>

      <FilterRow>
        <Seg label="Phân theo" value={chieu} onChange={setChieu} options={CHIEU} />
        <Chon
          label="Khách"
          value={khach}
          onChange={setKhach}
          options={[
            { value: '', label: 'Mọi khách' },
            ...khachs.map((k) => ({ value: k, label: k })),
          ]}
        />
        {khach && (
          <button
            type="button"
            onClick={() => setKhach('')}
            className="text-[13px] text-[var(--primary)] hover:underline"
          >
            Bỏ lọc khách
          </button>
        )}
      </FilterRow>

      <div className="flex-1 px-6 py-4">
        <Panel
          label={`Doanh số theo ${tenChieu}`}
          title={`Theo ${tenChieu.toLowerCase()}`}
          count={rows.length}
          note={khach ? `Chỉ đơn của ${khach}` : 'Mọi khách'}
        >
          {rows.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-[13px]">
              Chưa có dòng đơn nào — khách này chưa có đơn, hoặc mọi đơn đã huỷ.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${TH} w-10 text-right`}>#</th>
                    <th className={TH}>{tenChieu}</th>
                    <th className={`${TH} text-right`}>Số đơn</th>
                    <th className={`${TH} text-right`}>SL</th>
                    <th className={`${TH} text-right`}>Trị giá USD</th>
                    <th className={`${TH} text-right`}>% tổng</th>
                    {canSeeCost && <th className={`${TH} text-right`}>Lãi KH USD</th>}
                    {canSeeCost && <th className={`${TH} text-right`}>Lãi KH %</th>}
                    {canSeeCost && <th className={`${TH} text-right`}>Có giá thành</th>}
                    {chieu === 'khach' && <th className={`${TH} w-20`} />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className="hover:bg-[var(--accent)]">
                      <td className={`${TD} ${NUM} text-muted-foreground text-xs`}>
                        {i + 1}
                      </td>
                      <td className={`${TD} max-w-[380px]`}>
                        {chieu === 'sp' ? (
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className="text-foreground font-mono text-[13px] whitespace-nowrap">
                              {r.label}
                            </span>
                            <span
                              className="text-muted-foreground truncate text-xs"
                              title={r.sub}
                            >
                              {r.sub}
                            </span>
                          </span>
                        ) : (
                          <span className="text-foreground font-medium whitespace-nowrap">
                            {r.label}
                          </span>
                        )}
                      </td>
                      <td className={`${TD} ${NUM}`}>{r.so_don}</td>
                      <td className={`${TD} ${NUM}`}>{r.qty.toLocaleString('vi-VN')}</td>
                      <td className={`${TD} ${NUM} font-semibold`}>{usd(r.value)}</td>
                      <td className={TD}>
                        <Thanh ratio={r.share} label={pct(r.share)} />
                      </td>
                      {canSeeCost && (
                        <td className={`${TD} ${NUM}`}>
                          {r.value_co_gt > 0 ? (
                            usd(r.lai)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {canSeeCost && (
                        <td className={`${TD} ${NUM}`}>
                          {r.value_co_gt > 0 ? (
                            pct(r.lai / r.value_co_gt)
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      {canSeeCost && (
                        <td className={TD}>
                          <Thanh
                            ratio={r.value ? r.value_co_gt / r.value : 0}
                            label={pct(r.value ? r.value_co_gt / r.value : 0)}
                            tone="done"
                            width={64}
                          />
                        </td>
                      )}
                      {chieu === 'khach' && (
                        <td className={TD}>
                          <button
                            type="button"
                            onClick={() => {
                              setKhach(r.label)
                              setChieu('sp')
                            }}
                            className="text-xs whitespace-nowrap text-[var(--primary)] hover:underline"
                          >
                            Xem SP →
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 font-semibold">
                    <td colSpan={2} className="text-foreground h-8 px-3 text-xs">
                      Cộng {rows.length} dòng
                    </td>
                    <td className={`h-8 px-3 ${NUM} text-[13px]`}>{t.so_don}</td>
                    <td className={`h-8 px-3 ${NUM} text-[13px]`}>
                      {t.qty.toLocaleString('vi-VN')}
                    </td>
                    <td className={`h-8 px-3 ${NUM} text-[13px]`}>{usd(t.value)}</td>
                    <td className={`h-8 px-3 ${NUM} text-xs`}>100%</td>
                    {canSeeCost && (
                      <td className={`h-8 px-3 ${NUM} text-[13px]`}>{usd(t.lai)}</td>
                    )}
                    {canSeeCost && (
                      <td className={`h-8 px-3 ${NUM} text-[13px]`}>{pct(t.lai_pct)}</td>
                    )}
                    {canSeeCost && (
                      <td className={`h-8 px-3 ${NUM} text-xs`}>{pct(t.phu)}</td>
                    )}
                    {chieu === 'khach' && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="border-border text-muted-foreground border-t px-3 py-2 text-xs">
            Trị giá = SL × đơn giá trên đơn bán (USD), không tính đơn huỷ. Đơn từ 08/2026
            — chưa có mùa trước để so. Số đơn ở chân bảng là số đơn khác nhau (một đơn có
            thể nằm ở nhiều dòng).
            {canSeeCost &&
              ' Lãi KH = SL × lãi/SP của giá thành kế hoạch, chỉ trên SP có giá thành bóc tách; % lãi chia cho trị giá của chính các dòng đó. Đơn giá đang được điền từ giá FOB kế hoạch nên chưa so được bán trên / dưới giá.'}
          </p>
        </Panel>
      </div>

      <ErpStatusBar
        left={`Phân tích doanh số · ${khach || 'mọi khách'} · theo ${tenChieu.toLowerCase()}`}
        right={`${usd(t.value)} USD · ${t.so_don} đơn`}
      />
    </ErpPage>
  )
}
