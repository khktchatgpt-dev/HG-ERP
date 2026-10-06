'use client'

import { useMemo, useState } from 'react'
import {
  Chip,
  Code,
  Crumb,
  Empty,
  FilterBar,
  GroupRow,
  MatrixTable,
  Metric,
  MetricStrip,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  Cell,
  Btn,
  showMoney,
  showNum,
} from '@/components/kit'
import {
  cong,
  dayThang,
  maTran,
  tenThang,
  thangCua,
  tinhTrang,
  SAP_XUAT_NGAY,
  type DongMaTran,
  type O,
  type DotXuat,
} from '@/lib/ke-hoach-xuat'

const usd = (v: number) => showMoney(v, { digits: 0 })
const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * KẾ HOẠCH XUẤT HÀNG (06/10/2026, bản vẽ chủ dự án duyệt). Xem `lib/ke-hoach-xuat.ts` cho
 * đơn vị (đợt = nhóm lệnh), cách tính trị giá và những gì CHƯA đo được.
 *
 * Hai cách xem một vùng cuộn: THEO THÁNG (khách × tháng — chép bảng chéo của
 * Odoo/Dynamics, nhìn cả năm một mắt) và DANH SÁCH ĐỢT (nhóm theo tháng, mỗi đợt
 * một dòng — chép SAP VL10 "Delivery due list"). Bấm một ô của bảng tháng là
 * nhảy sang danh sách đã lọc đúng khách + tháng đó.
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
  const tongThang = (ym: string) =>
    cong(loc.filter((d) => d.ship_date && thangCua(d.ship_date) === ym))

  /* Nhóm tháng theo QUÝ cho tầng tiêu đề trên của bảng chéo. */
  const quy = useMemo(() => {
    const by = new Map<string, string[]>()
    for (const m of thangs) {
      const q = `Q${Math.ceil(Number(m.slice(5, 7)) / 3)}/${m.slice(0, 4)}`
      by.set(q, [...(by.get(q) ?? []), m])
    }
    return [...by.entries()]
  }, [thangs])

  /*
    Ô có đợt MƯỢN NGÀY của lệnh (đợt chưa ghi ngày riêng) gắn dấu * màu cảnh báo:
    IBIZA 92 cont dồn hết 1,55 triệu USD vào 17/03/2027 — không đánh dấu thì người
    đọc tưởng tháng 3 là một đỉnh thật.
  */
  const o = (v: O | undefined, dim?: boolean) =>
    v && v.n > 0 ? (
      <span className={dim ? 'opacity-55' : undefined}>
        <Num value={usd(v.value)} strong={!dim} />
        <span className="text-k-label ml-1 text-[var(--ink-3)]">· {v.n}</span>
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

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <Crumb path={[{ label: 'Bán hàng', href: '/sales' }, 'Kế hoạch xuất hàng']} />
        <ScreenHeader
          compact
          eyebrow="Bán hàng"
          title="Kế hoạch xuất hàng"
          facts={[
            { label: 'Hôm nay', value: ngay(today) },
            {
              label: 'Đợt xuất',
              value: `${dots.length} đợt · ${new Set(dots.map((d) => d.lsx_id)).size} lệnh`,
            },
            { label: 'Tới', value: thangs.length ? tenThang(thangs.at(-1)!) : '—' },
          ]}
        />

        <MetricStrip>
          <Metric
            label={`Tháng ${tenThang(thangNay)}`}
            value={`${usd(cong(trongThang).value)} USD`}
            basis={`${trongThang.length} đợt · ${new Set(trongThang.map((d) => d.customer)).size} khách, lệnh chưa xong`}
          />
          <Metric
            label={
              ba.length ? `${tenThang(ba[0])} – ${tenThang(ba.at(-1)!)}` : '3 tháng tới'
            }
            value={`${usd(cong(baThang).value)} USD`}
            basis={`${baThang.length} đợt trong 3 tháng tới`}
          />
          <Metric
            label="Cần để ý"
            value={String(deY.length)}
            basis={`quá ngày xuất, hoặc xuất trong ${SAP_XUAT_NGAY} ngày mà đơn mua vật tư chưa về đủ`}
            tone={deY.length ? 'warn' : undefined}
          />
          <Metric
            label="Tiến độ sản xuất"
            value={null}
            basis="xưởng chưa ghi sổ trên hệ thống (0 phiếu) — chưa biết đợt nào làm tới đâu"
          />
          <Metric
            label="Container"
            value={null}
            basis="chỉ 3/19 lệnh ghi số cont dạng chữ; 39/291 dòng có CBM"
          />
        </MetricStrip>

        <FilterBar dense label="Xem theo">
          <Chip icon="lich" on={xem === 'thang'} onClick={() => setXem('thang')}>
            Theo tháng
          </Chip>
          <Chip
            icon="don"
            on={xem === 'dot'}
            count={loc.length}
            onClick={() => setXem('dot')}
          >
            Danh sách đợt
          </Chip>
          <Pick
            label="Khách"
            value={khach}
            onChange={setKhach}
            width={190}
            options={[
              { value: '', label: 'Mọi khách' },
              ...khachs.map((k) => ({ value: k, label: k })),
            ]}
          />
          {thang && (
            <Chip on onClick={() => setThang('')}>
              Tháng {tenThang(thang)} ✕
            </Chip>
          )}
          <Chip
            icon="canhBao"
            on={chiDeY}
            count={deY.length}
            onClick={() => setChiDeY(!chiDeY)}
          >
            Cần để ý
          </Chip>
          <Chip on={anXong} onClick={() => setAnXong(!anXong)}>
            Ẩn lệnh đã hoàn thành
          </Chip>
        </FilterBar>

        <div className="min-h-0 flex-1 overflow-auto">
          {loc.length === 0 ? (
            <Empty
              level={2}
              headline="Không đợt nào khớp bộ lọc"
              reason="Bộ lọc đang hẹp — bỏ bớt khách / tháng / “Cần để ý” để xem lại cả kế hoạch."
              next={
                <Btn
                  icon="boLoc"
                  onClick={() => {
                    setKhach('')
                    setThang('')
                    setChiDeY(false)
                  }}
                >
                  Bỏ lọc
                </Btn>
              }
            />
          ) : xem === 'thang' ? (
            <>
              <MatrixTable<DongMaTran>
                label="Trị giá xuất theo khách và tháng (USD · số đợt)"
                rows={mt}
                rowKey={(r) => r.customer}
                maxHeight={9999}
                pinned={[
                  {
                    id: 'k',
                    header: 'Khách',
                    width: 170,
                    cell: (r) => <b>{r.customer}</b>,
                  },
                  {
                    id: 't',
                    header: 'Cả kế hoạch',
                    width: 130,
                    num: true,
                    cell: (r) => o(r.tong),
                    foot: o(cong(loc)),
                  },
                ]}
                groups={quy.map(([q, ms]) => ({
                  id: q,
                  header: q,
                  cols: ms.map((m) => ({
                    id: m,
                    header: m === thangNay ? `${tenThang(m)} · nay` : tenThang(m),
                    num: true,
                    cell: (r: DongMaTran) => o(r.theoThang[m], m < thangNay),
                    foot: o(tongThang(m), m < thangNay),
                  })),
                }))}
                onCell={(r, col) => {
                  if (col === 'k' || col === 't') return
                  setKhach(r.customer)
                  setThang(col)
                  setXem('dot')
                }}
                // Mọi cột đều có tổng riêng nên lưu ý rơi vào ô đầu và kéo cột Khách ra
                // 1.900px (đo 06/10) — giữ lưu ý NGẮN, phép tính nguyên văn để dưới bảng.
                foot={{ label: 'Cộng theo tháng', note: 'USD · số đợt' }}
              />
              <p className="text-k-sm px-[var(--gutter)] py-2 text-[var(--ink-3)]">
                Trị giá theo đơn bán, USD: 39 đợt lấy từ đơn bán gắn với đợt, 21 đợt = SL
                dòng lệnh × đơn giá cùng SP trong đơn của lệnh — cộng theo lệnh khớp tổng
                đơn bán. Tháng đã qua in nhạt. <b className="text-[var(--warn)]">*</b> =
                có đợt chưa ghi ngày xuất riêng, đang mượn ngày cuối của lệnh — chia đợt ở
                màn lệnh thì ô tự tách ra đúng tháng. Bấm một ô để xem danh sách đợt của
                khách + tháng đó.
              </p>
            </>
          ) : (
            <Table>
              <THead pinFirst>
                <th>Ngày xuất</th>
                <th>Khách</th>
                <th>Lệnh SX</th>
                <th>PO khách / đợt</th>
                <th style={{ textAlign: 'right' }}>SL</th>
                <th style={{ textAlign: 'right' }}>Trị giá USD</th>
                <th>Vật tư của lệnh</th>
                <th>Tình trạng</th>
                <th>Cont (cả lệnh)</th>
              </THead>
              {nhom.map(([ym, ds]) => (
                <tbody key={ym}>
                  <GroupRow
                    cols={9}
                    name={
                      ym === 'chua-co'
                        ? 'Chưa có ngày xuất'
                        : `Tháng ${tenThang(ym)}${ym === thangNay ? ' · tháng này' : ''}`
                    }
                    meta={`${ds.length} đợt · ${usd(cong(ds).value)} USD`}
                  />
                  {ds.map((d) => {
                    const t = tt.get(d.id)!
                    return (
                      <Row key={d.id}>
                        <Cell pin>
                          <span className="num">
                            {d.ship_date ? ngay(d.ship_date) : '—'}
                          </span>
                          {d.date_src === 'lenh' && (
                            <span
                              className="text-k-label ml-1 text-[var(--ink-3)]"
                              title="Đợt chưa ghi ngày riêng — mượn ngày xuất cuối của lệnh"
                            >
                              theo lệnh
                            </span>
                          )}
                        </Cell>
                        <Cell>{d.customer}</Cell>
                        <Cell>
                          <Code as="a" href={`/sales/lsx/${d.lsx_id}`}>
                            {d.lsx_code}
                          </Code>
                        </Cell>
                        <Cell grow>
                          <span className="block max-w-[220px] truncate" title={d.label}>
                            {d.label}
                          </span>
                        </Cell>
                        <Cell num>
                          <Num value={showNum(d.qty)} />
                        </Cell>
                        <Cell num>
                          {d.value != null ? (
                            <Num value={usd(d.value)} strong />
                          ) : (
                            <Num value="" />
                          )}
                        </Cell>
                        <Cell muted>
                          {d.vt.po_total === 0
                            ? 'chưa có đơn mua'
                            : d.vt.po_open === 0
                              ? `đủ · ${d.vt.po_total} đơn mua đã về`
                              : `${d.vt.po_open}/${d.vt.po_total} đơn mua chưa về đủ`}
                        </Cell>
                        <Cell>
                          <Tag tone={t.tone === 'neutral' ? 'neutral' : t.tone}>
                            {t.text}
                          </Tag>
                        </Cell>
                        <Cell muted>{d.cont ?? ''}</Cell>
                      </Row>
                    )
                  })}
                </tbody>
              ))}
              <TFoot
                label={
                  <td colSpan={5}>
                    Cộng {loc.length} đợt
                    <span className="text-k-sm ml-1.5 font-normal text-[var(--ink-3)]">
                      · trị giá theo đơn bán, USD; chưa trừ đợt đã xuất thật (hệ thống
                      chưa ghi lần xuất nào)
                    </span>
                  </td>
                }
                cells={
                  <>
                    <td className="num">{usd(cong(loc).value)}</td>
                    <td />
                    <td />
                    <td />
                  </>
                }
              />
            </Table>
          )}
        </div>

        <StatusBar
          left={['Kế hoạch xuất hàng', `${loc.length}/${dots.length} đợt`]}
          right={`${usd(cong(loc).value)} USD`}
        />
      </ScreenFrame>
    </div>
  )
}
