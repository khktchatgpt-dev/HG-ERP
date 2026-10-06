'use client'

import Link from 'next/link'
import { Fragment, useMemo, useState } from 'react'
import { BarChart3, Home } from 'lucide-react'
import {
  cong,
  dayThang,
  maTran,
  tenThang,
  thangCua,
  tinhTrang,
  SAP_XUAT_NGAY,
  type DotXuat,
  type O,
} from '@/lib/ke-hoach-xuat'
import {
  Chon,
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  Nhan,
  NUM,
  Panel,
  Seg,
  TD,
  TH,
  Tick,
  ToolBtn,
} from '../_erp/ui'

const usd = (v: number) => Math.round(v).toLocaleString('vi-VN')
const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * KẾ HOẠCH XUẤT HÀNG — tháng này và các tháng tới xuất cho khách nào, bao nhiêu,
 * đợt nào có nguy cơ trễ (06/10/2026). Đơn vị là ĐỢT = nhóm lệnh; trị giá và
 * những gì CHƯA đo được: `lib/ke-hoach-xuat.ts`.
 *
 * Kiểu ERP (chủ dự án 06/10: "làm lại theo kiểu ERP") — khối chung `../_erp/ui`:
 *   · THEO THÁNG: bảng chéo khách × tháng (ghim cột Khách + Cả kế hoạch, tiêu đề
 *     hai tầng quý → tháng) — bấm ô sang danh sách đúng khách + tháng;
 *   · DANH SÁCH ĐỢT: lưới nhóm theo tháng (dòng nhóm có tổng), như SAP VL10.
 */
export function KeHoachXuatScreen({ dots, today }: { dots: DotXuat[]; today: string }) {
  const [xem, setXem] = useState<'thang' | 'dot'>('thang')
  const [khach, setKhach] = useState('')
  const [thang, setThang] = useState('')
  const [chiDeY, setChiDeY] = useState(false)
  const [anXong, setAnXong] = useState(true)

  const tt = useMemo(
    () => new Map(dots.map((d) => [d.id, tinhTrang(d, today)])),
    [dots, today],
  )
  const thangNay = thangCua(today)
  const thangs = useMemo(() => dayThang(dots), [dots])
  const ba = thangs.filter((m) => m > thangNay).slice(0, 3)
  const conLai = dots.filter((d) => d.lsx_status !== 'completed')
  const trongThang = conLai.filter(
    (d) => d.ship_date && thangCua(d.ship_date) === thangNay,
  )
  const baThang = conLai.filter((d) => d.ship_date && ba.includes(thangCua(d.ship_date)))
  const deY = dots.filter((d) => tt.get(d.id)!.canDeY)
  const khachs = [...new Set(dots.map((d) => d.customer))].sort()

  const loc = dots.filter(
    (d) =>
      (!khach || d.customer === khach) &&
      (!thang || (d.ship_date && thangCua(d.ship_date) === thang)) &&
      (!chiDeY || tt.get(d.id)!.canDeY) &&
      (!anXong || d.lsx_status !== 'completed'),
  )
  const mt = useMemo(() => maTran(loc), [loc])
  const tong = cong(loc)
  const theoThang = (ym: string) =>
    cong(loc.filter((d) => d.ship_date && thangCua(d.ship_date) === ym))

  /* Quý → các tháng, cho tầng tiêu đề trên của bảng chéo. */
  const quy = useMemo(() => {
    const by = new Map<string, string[]>()
    for (const m of thangs) {
      const q = `Q${Math.ceil(Number(m.slice(5, 7)) / 3)}/${m.slice(0, 4)}`
      by.set(q, [...(by.get(q) ?? []), m])
    }
    return [...by.entries()]
  }, [thangs])

  const nhom = useMemo(() => {
    const by = new Map<string, DotXuat[]>()
    for (const d of [...loc].sort((a, b) =>
      (a.ship_date ?? '9') < (b.ship_date ?? '9') ? -1 : 1,
    )) {
      const k = d.ship_date ? thangCua(d.ship_date) : 'chua-co'
      by.set(k, [...(by.get(k) ?? []), d])
    }
    return [...by.entries()]
  }, [loc])

  const moDanhSach = (k: string, m: string) => {
    setKhach(k)
    setThang(m)
    setXem('dot')
  }

  /** Ô của bảng chéo: trị giá + số đợt; * khi có đợt mượn ngày của lệnh. */
  const o = (v: O | undefined, qua: boolean) =>
    v && v.n > 0 ? (
      <span className={qua ? 'opacity-50' : undefined}>
        <span className="font-semibold">{usd(v.value)}</span>
        <span className="text-muted-foreground ml-1 text-xs">·{v.n}</span>
        {v.muon > 0 && (
          <span
            className="ml-0.5 font-bold text-[var(--warn)]"
            title={`${v.muon} đợt chưa có ngày xuất riêng — đang mượn ngày xuất cuối của lệnh`}
          >
            *
          </span>
        )}
      </span>
    ) : (
      ''
    )

  return (
    <ErpPage>
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Kế hoạch xuất hàng' }]}
        title="Kế hoạch xuất hàng"
        sub={`Hôm nay ${ngay(today)} · ${dots.length} đợt · ${new Set(dots.map((d) => d.lsx_id)).size} lệnh · tới ${thangs.length ? tenThang(thangs.at(-1)!) : '—'}`}
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
          label="Đợt cần để ý"
          value={deY.length}
          tone={deY.length ? 'warn' : 'neutral'}
          sub={`quá ngày / ≤${SAP_XUAT_NGAY} ngày mà vật tư chưa đủ`}
          on={chiDeY}
          onClick={() => {
            setChiDeY(!chiDeY)
            setXem('dot')
          }}
          title="Bấm để lọc danh sách đợt cần để ý"
        />
        <CountCell
          label="Tiến độ sản xuất"
          value={null}
          sub="xưởng chưa ghi sổ trên hệ thống (0 phiếu)"
        />
        <CountCell
          label="Container"
          value={null}
          sub="chỉ 3/19 lệnh ghi số cont; 39/291 dòng có CBM"
        />
      </CountStrip>

      <FilterRow>
        <Seg
          label="Xem"
          value={xem}
          onChange={setXem}
          options={[
            { value: 'thang', label: 'Theo tháng' },
            { value: 'dot', label: 'Danh sách đợt', count: loc.length },
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
        <Chon
          label="Tháng"
          value={thang}
          onChange={setThang}
          width={130}
          options={[
            { value: '', label: 'Mọi tháng' },
            ...thangs.map((m) => ({ value: m, label: tenThang(m) })),
          ]}
        />
        <Tick checked={chiDeY} onChange={setChiDeY}>
          Chỉ đợt cần để ý
        </Tick>
        <Tick checked={anXong} onChange={setAnXong}>
          Ẩn lệnh đã hoàn thành
        </Tick>
        {(khach || thang || chiDeY) && (
          <button
            type="button"
            onClick={() => {
              setKhach('')
              setThang('')
              setChiDeY(false)
            }}
            className="text-[13px] text-[var(--primary)] hover:underline"
          >
            Bỏ lọc
          </button>
        )}
      </FilterRow>

      <div className="flex-1 px-6 py-4">
        {loc.length === 0 ? (
          <Panel title="Không đợt nào khớp bộ lọc">
            <p className="text-muted-foreground px-4 py-8 text-center text-[13px]">
              Bộ lọc đang hẹp — bỏ bớt khách / tháng / “Chỉ đợt cần để ý” để xem lại cả kế
              hoạch.
            </p>
          </Panel>
        ) : xem === 'thang' ? (
          <Panel
            label="Trị giá xuất theo khách và tháng"
            title="Trị giá xuất theo khách × tháng"
            note="USD · ·n = số đợt · bấm ô để xem các đợt · tháng đã qua in nhạt"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className={`${TH} sticky left-0 z-20 min-w-[170px] border-r`}
                    >
                      Khách
                    </th>
                    <th
                      rowSpan={2}
                      className={`${TH} sticky left-[170px] z-20 min-w-[130px] border-r text-right`}
                    >
                      Cả kế hoạch
                    </th>
                    {quy.map(([q, ms]) => (
                      <th
                        key={q}
                        colSpan={ms.length}
                        className={`${TH} border-r text-center`}
                      >
                        {q}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {thangs.map((m) => (
                      <th
                        key={m}
                        className={`${TH} min-w-[104px] border-r text-right ${m === thangNay ? 'text-[var(--primary)]' : ''}`}
                      >
                        {tenThang(m)}
                        {m === thangNay && ' ·nay'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mt.map((r) => (
                    <tr key={r.customer} className="group">
                      <td
                        className={`${TD} bg-card group-hover:bg-muted sticky left-0 z-10 border-r font-medium whitespace-nowrap`}
                      >
                        {r.customer}
                      </td>
                      <td
                        className={`${TD} ${NUM} bg-card group-hover:bg-muted sticky left-[170px] z-10 border-r`}
                      >
                        {o(r.tong, false)}
                      </td>
                      {thangs.map((m) => {
                        const v = r.theoThang[m]
                        return (
                          <td key={m} className={`${TD} ${NUM} border-r p-0`}>
                            {v && v.n > 0 ? (
                              <button
                                type="button"
                                onClick={() => moDanhSach(r.customer, m)}
                                className="h-full w-full px-3 text-right hover:bg-[var(--accent)]"
                                title={`${r.customer} · ${tenThang(m)} — xem ${v.n} đợt`}
                              >
                                {o(v, m < thangNay)}
                              </button>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="border-border bg-muted sticky left-0 z-10 h-8 border-r px-3 text-xs">
                      Cộng theo tháng
                    </td>
                    <td
                      className={`border-border bg-muted sticky left-[170px] z-10 h-8 border-r px-3 ${NUM} text-[13px]`}
                    >
                      {o(tong, false)}
                    </td>
                    {thangs.map((m) => (
                      <td
                        key={m}
                        className={`border-border bg-muted h-8 border-r px-3 ${NUM} text-[13px]`}
                      >
                        {o(theoThang(m), m < thangNay)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="border-border text-muted-foreground border-t px-3 py-2 text-xs">
              Trị giá theo đơn bán (USD): đợt gắn đơn lấy tổng đơn; đợt không gắn đơn = SL
              dòng lệnh × đơn giá cùng SP trong đơn của lệnh — cộng theo lệnh khớp tổng
              đơn bán. <b className="text-[var(--warn)]">*</b> = có đợt chưa ghi ngày xuất
              riêng, đang mượn ngày cuối của lệnh (chia đợt ở dòng lệnh thì ô tự tách đúng
              tháng).
            </p>
          </Panel>
        ) : (
          <Panel
            label="Danh sách đợt xuất"
            title="Danh sách đợt xuất"
            count={loc.length}
            note={[
              khach || 'mọi khách',
              thang ? `tháng ${tenThang(thang)}` : 'mọi tháng',
              chiDeY && 'chỉ đợt cần để ý',
            ]
              .filter(Boolean)
              .join(' · ')}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Ngày xuất</th>
                    <th className={TH}>Khách</th>
                    <th className={TH}>Lệnh SX</th>
                    <th className={TH}>PO khách / đợt</th>
                    <th className={`${TH} text-right`}>SL</th>
                    <th className={`${TH} text-right`}>Trị giá USD</th>
                    <th className={TH}>Vật tư của lệnh</th>
                    <th className={TH}>Tình trạng</th>
                    <th className={TH}>Cont (cả lệnh)</th>
                  </tr>
                </thead>
                <tbody>
                  {nhom.map(([ym, ds]) => (
                    <Fragment key={ym}>
                      <tr>
                        <th
                          colSpan={9}
                          scope="rowgroup"
                          className="border-border bg-muted/50 text-foreground h-8 border-b px-3 text-left text-xs font-semibold"
                        >
                          {ym === 'chua-co'
                            ? 'Chưa có ngày xuất'
                            : `Tháng ${tenThang(ym)}${ym === thangNay ? ' · tháng này' : ''}`}
                          <span className="text-muted-foreground ml-2 font-normal">
                            {ds.length} đợt · {usd(cong(ds).value)} USD
                          </span>
                        </th>
                      </tr>
                      {ds.map((d) => {
                        const t = tt.get(d.id)!
                        return (
                          <tr key={d.id} className="hover:bg-[var(--accent)]">
                            <td
                              className={`${TD} font-mono whitespace-nowrap tabular-nums`}
                            >
                              {d.ship_date ? ngay(d.ship_date) : '—'}
                              {d.date_src === 'lenh' && (
                                <span
                                  className="ml-0.5 text-[var(--warn)]"
                                  title="Đợt chưa có ngày riêng — mượn ngày xuất cuối của lệnh"
                                >
                                  *
                                </span>
                              )}
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>{d.customer}</td>
                            <td className={`${TD} font-mono whitespace-nowrap`}>
                              <Link
                                href={`/sales/lsx/${d.lsx_id}`}
                                className="text-[var(--primary)] hover:underline"
                              >
                                {d.lsx_code}
                              </Link>
                            </td>
                            <td
                              className={`${TD} max-w-[220px] truncate`}
                              title={d.label}
                            >
                              {d.label}
                            </td>
                            <td className={`${TD} ${NUM}`}>
                              {d.qty.toLocaleString('vi-VN')}
                            </td>
                            <td className={`${TD} ${NUM} font-semibold`}>
                              {d.value != null ? (
                                usd(d.value)
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td
                              className={`${TD} text-muted-foreground whitespace-nowrap`}
                            >
                              {d.vt.po_total === 0
                                ? 'chưa có đơn mua'
                                : d.vt.po_open === 0
                                  ? `đủ · ${d.vt.po_total} đơn mua đã về`
                                  : `${d.vt.po_open}/${d.vt.po_total} đơn mua chưa về đủ`}
                            </td>
                            <td className={TD}>
                              <Nhan tone={t.tone}>{t.text}</Nhan>
                            </td>
                            <td
                              className={`${TD} text-muted-foreground whitespace-nowrap`}
                            >
                              {d.cont ?? ''}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/60 font-semibold">
                    <td colSpan={5} className="h-8 px-3 text-xs">
                      Cộng {loc.length} đợt
                      <span className="text-muted-foreground ml-2 font-normal">
                        chưa trừ đợt đã xuất thật (hệ thống chưa ghi lần xuất nào)
                      </span>
                    </td>
                    <td className={`h-8 px-3 ${NUM} text-[13px]`}>{usd(tong.value)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        )}
      </div>

      <ErpStatusBar
        left={`Kế hoạch xuất hàng · ${loc.length}/${dots.length} đợt · ${khach || 'mọi khách'}`}
        right={`${usd(tong.value)} USD`}
      />
    </ErpPage>
  )
}
