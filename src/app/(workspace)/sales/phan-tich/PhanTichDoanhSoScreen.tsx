'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Crumb,
  Empty,
  FilterBar,
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
  Code,
  coveragePct,
  showMoney,
  showNum,
} from '@/components/kit'
import {
  dauChiem,
  phanTheo,
  tongHop,
  type ChieuPhan,
  type DongBan,
} from '@/lib/phan-tich-doanh-so'

const usd = (v: number) => showMoney(v, { digits: 0 })
const pct = (r: number | null) =>
  r == null ? '' : `${(r * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

const CHIEU: { id: ChieuPhan; label: string }[] = [
  { id: 'khach', label: 'Khách' },
  { id: 'loai', label: 'Loại hàng' },
  { id: 'khung', label: 'Khung' },
  { id: 'sp', label: 'Sản phẩm' },
  { id: 'thang', label: 'Tháng nhận đơn' },
]

/**
 * PHÂN TÍCH DOANH SỐ (06/10/2026, bản vẽ chủ dự án duyệt). Một câu hỏi: đơn đã nhận đang dồn
 * vào đâu, và lãi kế hoạch ra sao trên phần đã có giá thành. Xem
 * `lib/phan-tich-doanh-so.ts` cho nguồn số và những gì CHƯA so được.
 *
 * Một bảng, đổi CHIỀU bằng chip (chép "pivot" của Odoo Sales Analysis / SAP
 * MCTE, gọn còn một chiều mỗi lần — bảng chéo hai chiều đã có ở Kế hoạch xuất).
 * Lọc khách áp cho mọi chiều: chọn ROSCO rồi xem "Sản phẩm" là ra SP của ROSCO.
 * Cột lãi chỉ hiện với người có quyền xem giá thành.
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
  const loc = useMemo(() => (khach ? dongs.filter((d) => d.customer === khach) : dongs), [dongs, khach]) // prettier-ignore
  const t = useMemo(() => tongHop(loc), [loc])
  const theoKhach = useMemo(() => phanTheo(loc, 'khach'), [loc])
  const theoSp = useMemo(() => phanTheo(loc, 'sp'), [loc])
  const rows = useMemo(() => phanTheo(loc, chieu), [loc, chieu])
  const thangs = useMemo(() => phanTheo(loc, 'thang'), [loc])

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <Crumb path={[{ label: 'Bán hàng', href: '/sales' }, 'Phân tích doanh số']} />
        <ScreenHeader
          compact
          eyebrow="Bán hàng"
          title="Phân tích doanh số"
          facts={[
            {
              label: 'Đơn nhận',
              value: thangs.length ? `${thangs[0].label} – ${thangs.at(-1)!.label}` : '—',
            },
            { label: 'Tiền', value: 'USD' },
            {
              label: 'Tính trên',
              value: 'đơn đã nhận (chưa có xuất / hoá đơn)',
              tone: 'warn',
            },
          ]}
        />

        <MetricStrip>
          <Metric
            label="Trị giá đơn đã nhận"
            value={`${usd(t.value)} USD`}
            basis={`${t.so_don} đơn · ${t.so_khach} khách · ${t.so_sp} SP, không tính đơn huỷ`}
          />
          <Metric
            label={khach ? 'SP lớn nhất' : 'Khách lớn nhất'}
            value={
              khach
                ? theoSp[0]
                  ? `${theoSp[0].label} · ${pct(theoSp[0].share)}`
                  : null
                : theoKhach[0]
                  ? `${theoKhach[0].label} · ${pct(theoKhach[0].share)}`
                  : null
            }
            basis={
              khach
                ? `${theoSp.length} SP của ${khach}`
                : `3 khách lớn nhất = ${pct(dauChiem(theoKhach, 3))} trị giá`
            }
          />
          <Metric
            label="8 SP đầu chiếm"
            value={pct(dauChiem(theoSp, 8))}
            basis={`trên ${theoSp.length} SP — càng cao càng phụ thuộc ít mã`}
          />
          {canSeeCost && (
            <Metric
              label="Lãi kế hoạch"
              value={t.lai_pct == null ? null : `${pct(t.lai_pct)} · ${usd(t.lai)} USD`}
              basis={
                t.lai_pct == null
                  ? 'chưa SP nào có giá thành bóc tách (trực tiếp + chung + lãi)'
                  : `chỉ đo trên ${pct(t.phu)} trị giá có giá thành bóc tách (${usd(t.value_co_gt)} USD); phần còn lại chỉ có giá FOB`
              }
              tone={t.phu < 0.5 ? 'warn' : undefined}
            />
          )}
        </MetricStrip>

        <FilterBar dense label="Phân theo">
          {CHIEU.map((c) => (
            <Chip key={c.id} on={chieu === c.id} onClick={() => setChieu(c.id)}>
              {c.label}
            </Chip>
          ))}
          <Pick
            label="Khách"
            value={khach}
            onChange={setKhach}
            width={200}
            options={[{ value: '', label: 'Mọi khách' }, ...khachs.map((k) => ({ value: k, label: k }))]} // prettier-ignore
          />
        </FilterBar>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              level={2}
              headline="Chưa có dòng đơn nào"
              reason="Doanh số tính từ dòng đơn bán còn sống. Khách này chưa có đơn, hoặc mọi đơn đã huỷ."
              next={
                <Btn icon="boLoc" onClick={() => setKhach('')}>
                  Xem mọi khách
                </Btn>
              }
            />
          ) : (
            <Table>
              <THead pinFirst>
                <th>{CHIEU.find((c) => c.id === chieu)!.label}</th>
                <th style={{ textAlign: 'right' }}>Số đơn</th>
                <th style={{ textAlign: 'right' }}>SL</th>
                <th style={{ textAlign: 'right' }}>Trị giá USD</th>
                <th style={{ textAlign: 'right' }}>% tổng</th>
                {canSeeCost && <th style={{ textAlign: 'right' }}>Lãi KH USD</th>}
                {canSeeCost && <th style={{ textAlign: 'right' }}>Lãi KH %</th>}
                {canSeeCost && <th style={{ textAlign: 'right' }}>Có giá thành</th>}
                <th />
              </THead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.key}>
                    <Cell pin grow>
                      {chieu === 'sp' ? (
                        <span className="flex min-w-0 items-baseline gap-2">
                          <Code>{r.label}</Code>
                          <span className="truncate text-[var(--ink-3)]" title={r.sub}>
                            {r.sub}
                          </span>
                        </span>
                      ) : (
                        <b>{r.label}</b>
                      )}
                    </Cell>
                    <Cell num>
                      <Num value={String(r.so_don)} />
                    </Cell>
                    <Cell num>
                      <Num value={showNum(r.qty)} />
                    </Cell>
                    <Cell num>
                      <Num value={usd(r.value)} strong />
                    </Cell>
                    <Cell num>
                      <ThanhPhan ratio={r.share} label={pct(r.share)} />
                    </Cell>
                    {canSeeCost && (
                      <Cell num>
                        {r.value_co_gt > 0 ? (
                          <Num value={usd(r.lai)} />
                        ) : (
                          <Num value="" />
                        )}
                      </Cell>
                    )}
                    {canSeeCost && (
                      <Cell num>
                        {r.value_co_gt > 0 ? (
                          <Num value={pct(r.lai / r.value_co_gt)} />
                        ) : (
                          <Num value="" />
                        )}
                      </Cell>
                    )}
                    {canSeeCost && (
                      <Cell num>
                        <ThanhPhan
                          ratio={r.value ? r.value_co_gt / r.value : 0}
                          label={coveragePct(r.value ? r.value_co_gt / r.value : 0)}
                          tone="done"
                          width={72}
                        />
                      </Cell>
                    )}
                    <Cell>
                      {chieu === 'khach' && (
                        <Btn
                          icon="boLoc"
                          onClick={() => {
                            setKhach(r.label)
                            setChieu('sp')
                          }}
                        >
                          Xem SP
                        </Btn>
                      )}
                    </Cell>
                  </Row>
                ))}
              </tbody>
              <TFoot
                label={
                  <td colSpan={3}>
                    Cộng {rows.length} dòng
                    <span className="text-k-sm ml-1.5 font-normal text-[var(--ink-3)]">
                      · đơn ĐÃ NHẬN, chưa phải doanh thu đã xuất
                    </span>
                  </td>
                }
                cells={
                  <>
                    <td className="num">{usd(t.value)}</td>
                    <td className="num">100%</td>
                    {canSeeCost && <td className="num">{usd(t.lai)}</td>}
                    {canSeeCost && <td className="num">{pct(t.lai_pct)}</td>}
                    {canSeeCost && <td className="num">{coveragePct(t.phu)}</td>}
                    <td />
                  </>
                }
              />
            </Table>
          )}
          <p className="text-k-sm px-[var(--gutter)] py-2 text-[var(--ink-3)]">
            Trị giá = SL × đơn giá trên đơn bán, USD, không tính đơn huỷ. Hệ thống bắt đầu
            ghi đơn từ 08/2026 nên chưa có mùa trước để so. Lãi KH = SL × lãi/SP của giá
            thành kế hoạch, chỉ trên SP có giá thành bóc tách; % lãi chia cho trị giá của
            CHÍNH các dòng đó. Đơn giá hiện được điền từ giá FOB kế hoạch nên chưa so được
            bán trên / dưới giá.
          </p>
        </div>

        <StatusBar
          left={['Phân tích doanh số', khach || 'mọi khách']}
          right={`${usd(t.value)} USD · ${t.so_don} đơn`}
        />
      </ScreenFrame>
    </div>
  )
}

/**
 * THANH TỈ LỆ của màn phân tích — tự vẽ, không dùng `CoverageBar` của kit
 * (chủ dự án 06/10/2026: "đừng phụ thuộc quá vào bộ kit"). Thanh kit dài 52px
 * và đổi xanh ở 100% vì sinh ra cho "độ phủ việc"; ở đây thanh là thứ để MẮT SO
 * các dòng với nhau nên cần dài, và chỉ `tone="done"` (phần có giá thành) mới
 * mang màu xanh. Màu chỉ qua token.
 */
function ThanhPhan({
  ratio,
  label,
  tone,
  width = 120,
}: {
  ratio: number
  label: string
  tone?: 'done'
  width?: number
}) {
  const r = Math.max(0, Math.min(1, ratio))
  return (
    <span className="flex items-center justify-end gap-2" title={label}>
      <span
        aria-hidden
        className="h-2 shrink-0 overflow-hidden rounded-full bg-[var(--track)]"
        style={{ width }}
      >
        <span
          className={`block h-full rounded-full ${tone === 'done' ? 'bg-[var(--done)]' : 'bg-[var(--fill)]'}`}
          style={{ width: `${r * 100}%` }}
        />
      </span>
      <span className="num text-k-label min-w-[40px] text-right text-[var(--ink-2)]">
        {label}
      </span>
    </span>
  )
}
