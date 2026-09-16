'use client'

import {
  Action,
  ActionGroup,
  ActionPane,
  Crumb,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  MasterWarn,
  Metric,
  MetricStrip,
  StatusBar,
  Td,
  Th,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { n } from '../_kho/data'

/**
 * KHO · MÀN 7 — HỒ SƠ VẬT TƯ (Khuôn E).
 *
 * Câu hỏi: "mã này đang ở đâu, dùng vào đâu, mua của ai, sắp tới có đủ không?".
 *
 * ĐÂY LÀ DANH MỤC, KHÔNG PHẢI CHỨNG TỪ — không có vòng đời duyệt, không ai
 * "gửi duyệt" một mã vật tư. Chỗ của ba trục trạng thái ở đây là DẢI HIỆU
 * SUẤT, và mỗi ô BẮT BUỘC kèm mẫu số: "2,3 lần/tháng" mà không nói tính trên
 * mấy tháng là con số không kiểm được.
 *
 * TRÁI TIM CỦA MÀN LÀ ĐỒ THỊ TỒN DỰ KIẾN — chép Dynamics *Item Availability
 * by Event* và SAP *MD04 Stock/Requirements List*. Câu người lập kế hoạch
 * thật sự hỏi không phải "hôm nay còn bao nhiêu" mà **"đến ngày xưởng cần
 * thì còn bao nhiêu"**, và không màn tồn nào trả lời nổi câu đó vì tồn là
 * một lát cắt.
 *
 * Ba mảnh dữ liệu dựng nên đồ thị đều ĐÃ CÓ trong hệ thống: tồn dùng được ·
 * đợt giao NCC đã hẹn (`supply_po_shipments`) · nhu cầu LSX đã duyệt
 * (`reservedByCommittedLsx`). Chưa ai ghép chúng lại thành một hình — đây là
 * thứ rẻ nhất mà giá trị cao nhất của cả phân hệ.
 */

/* ── Đồ thị tồn dự kiến ───────────────────────────────────────────────────
   Vẽ bằng SVG thuần, KHÔNG kéo thư viện biểu đồ. Kit chưa có thành phần đồ
   thị, và đây mới là chỗ thứ nhất cần — một lần là trùng hợp, hai lần mới là
   quy luật. Nếu màn thứ hai cũng cần thì tách vào kit lúc đó.
   ────────────────────────────────────────────────────────────────────────── */

type Ev = {
  /** Nhãn tuần. */
  wk: string
  /** Ngày sự kiện. */
  day: string
  /** + là hàng về, − là cấp đi. */
  delta: number
  what: string
  doc: string
}

const OPENING = 380 // tồn DÙNG ĐƯỢC hôm nay
const MIN = 150

const EVENTS: Ev[] = [
  { wk: 'T38', day: '16/09', delta: -180, what: 'Cấp cho LSX 07/26-14', doc: 'LSX 07/26-14' }, // prettier-ignore
  { wk: 'T38', day: '18/09', delta: +200, what: 'Đợt 3 Vạn Vi Thành', doc: 'PO-2609-044' }, // prettier-ignore
  { wk: 'T39', day: '24/09', delta: -240, what: 'Cấp cho LSX 07/26-21', doc: 'LSX 07/26-21' }, // prettier-ignore
  { wk: 'T40', day: '01/10', delta: -120, what: 'Cấp cho LSX 08/26-03', doc: 'LSX 08/26-03' }, // prettier-ignore
  { wk: 'T41', day: '09/10', delta: -40, what: 'Cấp cho LSX 08/26-07', doc: 'LSX 08/26-07' }, // prettier-ignore
  { wk: 'T42', day: '16/10', delta: +400, what: 'Đề nghị mua — CHƯA ĐẶT', doc: 'chưa có đơn' }, // prettier-ignore
]

/** Tồn dự kiến sau từng sự kiện. */
const SERIES = EVENTS.reduce<{ ev: Ev; after: number }[]>((acc, ev) => {
  const prev = acc.length ? acc[acc.length - 1].after : OPENING
  acc.push({ ev, after: prev + ev.delta })
  return acc
}, [])

/** Mốc đầu tiên tụt xuống dưới mức tối thiểu — câu trả lời của cả đồ thị. */
const firstLow = SERIES.find((p) => p.after < MIN)

function Projection() {
  const W = 620
  const H = 150
  const PAD_L = 40
  const PAD_B = 22
  const pts = [{ after: OPENING }, ...SERIES]
  const maxY = Math.max(OPENING, ...SERIES.map((p) => p.after), MIN) * 1.15
  const x = (i: number) => PAD_L + (i * (W - PAD_L - 10)) / (pts.length - 1)
  const y = (v: number) => H - PAD_B - (Math.max(0, v) / maxY) * (H - PAD_B - 8)

  /* Đường BẬC THANG, không phải đường cong: tồn kho nhảy tại thời điểm chứng
     từ, nó không biến thiên liên tục. Vẽ cong là vẽ một sự thật không có. */
  const d = pts
    .map((p, i) => (i === 0 ? `M ${x(0)} ${y(p.after)}` : `H ${x(i)} V ${y(p.after)}`))
    .join(' ')

  return (
    <div className="overflow-x-auto">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Tồn dự kiến 8 tuần. Hôm nay ${OPENING} cây. ${firstLow ? `Xuống dưới mức tối thiểu ${MIN} vào ${firstLow.ev.day}.` : 'Không xuống dưới mức tối thiểu.'}`}
        className="min-w-[620px]"
      >
        {/* Mức tối thiểu — đường chấm, không phải vùng tô: nó là NGƯỠNG, không phải KHOẢNG */}
        <line
          x1={PAD_L}
          y1={y(MIN)}
          x2={W - 10}
          y2={y(MIN)}
          stroke="var(--warn)"
          strokeDasharray="4 3"
          strokeWidth="1"
        />
        <text x={4} y={y(MIN) + 3} className="num" fontSize="9.5" fill="var(--warn)">
          {MIN}
        </text>
        <text x={4} y={y(OPENING) + 3} className="num" fontSize="9.5" fill="var(--ink-3)">
          {OPENING}
        </text>

        <path d={d} fill="none" stroke="var(--act)" strokeWidth="1.8" />

        {pts.map((p, i) => {
          if (i === 0) return null
          const s = SERIES[i - 1]
          const low = p.after < MIN
          return (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(p.after)}
                r="3"
                fill={low ? 'var(--stop)' : 'var(--act)'}
              />
              {/* Mũi tên hướng biến động — lên là hàng về, xuống là cấp đi */}
              <text
                x={x(i)}
                y={H - 12}
                textAnchor="middle"
                fontSize="9"
                fill={s.ev.delta > 0 ? 'var(--done)' : 'var(--ink-3)'}
              >
                {s.ev.delta > 0 ? '▲' : '▼'}
              </text>
              <text
                x={x(i)}
                y={H - 2}
                textAnchor="middle"
                fontSize="8.5"
                className="num"
                fill="var(--ink-3)"
              >
                {s.ev.day}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function Page() {
  return (
    <DocScreen>
      <LabNote>
        <div>
          <b>Khuôn E — Hồ sơ vật tư.</b> Đây là <b>danh mục</b>: không có vòng đời duyệt,
          nên chỗ của ba trục trạng thái là <b>dải hiệu suất</b> — mỗi ô kèm mẫu số. Trái
          tim màn là <b>đồ thị tồn dự kiến</b>: câu người lập kế hoạch hỏi không phải “hôm
          nay còn bao nhiêu” mà “đến ngày xưởng cần thì còn bao nhiêu”.
        </div>
      </LabNote>

      <Crumb
        path={['Kho', 'Vật tư', 'NH-0480']}
        view="Nhôm định hình · đang dùng"
        position={[3, 705]}
      />

      <ActionPane
        tabs={[
          { label: 'Hồ sơ', active: true },
          { label: 'Tồn & vị trí' },
          { label: 'Mua hàng' },
          { label: 'Kỹ thuật' },
        ]}
      >
        <ActionGroup label="Duy trì">
          <Action strong>Sửa hồ sơ</Action>
          <Action>Đổi nhóm</Action>
          <Action>Ngừng dùng</Action>
        </ActionGroup>
        <ActionGroup label="Việc kho">
          <Action>Chuyển kệ</Action>
          <Action>Khoá một lô</Action>
          <Action>Đưa vào đợt kiểm kê</Action>
        </ActionGroup>
        <ActionGroup label="Mua hàng">
          <Action primary>Xin mua bù</Action>
          <Action>Xem giá các NCC</Action>
        </ActionGroup>
      </ActionPane>

      <DocHead
        kind="Vật tư"
        code="NH-0480"
        sub={
          <>
            Nhôm hộp 20 × 40 × T1.0 có 2 gân · Nhôm định hình - tấm · ĐVT{' '}
            <span className="num">Cây</span> · 5,8 m/cây
          </>
        }
      >
        {/*
          KHÔNG CÓ StatusTrack Ở ĐÂY — và đó là điểm nhận dạng của khuôn E.
          Nhét một thanh bậc vào hồ sơ danh mục là phải bịa ra một vòng đời,
          rồi người dùng đi tìm nút "gửi duyệt" trên thứ không ai duyệt bao giờ.
        */}
        <MasterWarn used="8 định mức sản phẩm · 3 lệnh SX đang mở · 12 dòng đơn mua 90 ngày" />
      </DocHead>

      <MetricStrip>
        <Metric label="Dùng được" value="380 cây" basis="ở 1 kệ · NHOM-A1" tone="done" />
        <Metric
          label="Giữ cho lệnh"
          value="180 cây"
          basis="180 / 380 cây · 2 lệnh đã duyệt"
        />{' '}
        {/* prettier-ignore */}
        {/*
          `value={null}` của kit nghĩa là "CHƯA ĐO ĐƯỢC", không phải "bằng 0" —
          hai chuyện khác hẳn nhau. Ở đây đo được và kết quả là 0, nên phải ghi 0.
        */}
        <Metric label="Chờ kiểm / khoá" value="0 cây" basis="không có lô nào đang mắc" />
        <Metric
          label="Vòng quay"
          value="2,3 lần/tháng"
          basis="tính trên 12 tháng gần nhất"
        />{' '}
        {/* prettier-ignore */}
        <Metric
          label="Đủ tới"
          value={firstLow ? firstLow.ev.day : 'quá 8 tuần'}
          basis={firstLow ? `sau mốc ${firstLow.ev.day} · ${firstLow.ev.what}` : 'không tụt dưới mức'}
          tone={firstLow ? 'warn' : 'done'}
        />
        <Metric
          label="Giá mua gần nhất"
          value="352.000 ₫"
          basis="Vạn Vi Thành · 09/09/2026"
        />{' '}
        {/* prettier-ignore */}
      </MetricStrip>

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Mua của ai">
              <FactKv
                rows={[
                  ['Vạn Vi Thành', <span key="a" className="num">352.000 ₫ · 09/09</span>], // prettier-ignore
                  ['Nhôm Ngọc Diệp', <span key="b" className="num">361.000 ₫ · 12/08</span>], // prettier-ignore
                  ['NCC mặc định', 'Vạn Vi Thành'],
                  ['Thời gian đặt → về', <span key="d" className="num">9 ngày</span>], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Ngưỡng tồn">
              <FactKv
                rows={[
                  ['Tối thiểu', <span key="a" className="num">150 cây</span>], // prettier-ignore
                  ['Điểm đặt lại', <span key="b" className="num">260 cây</span>], // prettier-ignore
                  ['Lô đặt', <span key="c" className="num">400 cây</span>], // prettier-ignore
                  ['Kệ mặc định', <span key="d" className="num">NHOM-A1</span>], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Quy cách">
              <FactKv
                rows={[
                  ['kg/m', <span key="a" className="num">0,289</span>], // prettier-ignore
                  ['Dài cây', <span key="b" className="num">5,8 m</span>], // prettier-ignore
                  ['kg/cây', <span key="c" className="num">1,676</span>], // prettier-ignore
                  ['Hợp kim', '6063 T5'],
                ]}
              />
            </FactSection>
          </FactBox>
        }
      >
        <FastTab
          title="Tồn dự kiến 8 tuần"
          defaultOpen
          summary={[
            ['Hôm nay', <span key="a" className="num">{n(OPENING)} cây</span>], // prettier-ignore
            ['Thấp nhất', <span key="b" className="num k-t-stop">{n(Math.min(...SERIES.map((p) => p.after)))} cây</span>], // prettier-ignore
            ['Xuống dưới mức', <span key="c" className="num k-t-warn">{firstLow?.ev.day ?? '—'}</span>], // prettier-ignore
          ]}
        >
          <Projection />

          {/*
            CÂU KẾT LUẬN ĐỨNG NGAY DƯỚI ĐỒ THỊ, viết bằng lời người.
            Đồ thị đẹp mà người đọc phải tự suy ra kết luận là đồ thị chưa
            xong — và ở ERP thì kết luận đó là một VIỆC PHẢI LÀM, có ngày.
          */}
          {firstLow && (
            <p className="mt-[11px] leading-relaxed text-[var(--fs-body)]">
              <b className="text-[var(--warn)]">
                Tụt xuống {n(firstLow.after)} cây ngày {firstLow.ev.day}
              </b>{' '}
              — dưới mức tối thiểu {MIN}, sau mốc “{firstLow.ev.what}” — rồi{' '}
              <b className="text-[var(--stop)]">hết sạch ngày 09/10</b>. Thời gian đặt →
              về là 9 ngày, nên đơn mua phải gửi <b className="num">trước 25/09</b>. Mốc
              16/10 trên đồ thị là <b>đề nghị mua CHƯA ĐẶT</b> — vẽ nó vào nhưng nói rõ là
              chưa có đơn, vì một đường đi lên do thứ chưa tồn tại là đường nói dối.
            </p>
          )}

          <div className="mt-[11px]">
            <Grid minWidth={720}>
              <GridHead>
                <Th width={64}>Tuần</Th>
                <Th width={72}>Ngày</Th>
                <Th>Sự kiện</Th>
                <Th width={150}>Chứng từ</Th>
                <Th num width={90}>
                  Biến động
                </Th>
                <Th num width={110}>
                  Tồn sau đó
                </Th>
              </GridHead>
              <GridBody>
                {SERIES.map((p, i) => (
                  <GridRow key={i}>
                    <Td>{p.ev.wk}</Td>
                    <Td num>{p.ev.day}</Td>
                    <Td>{p.ev.what}</Td>
                    <Td>
                      <span
                        className={
                          p.ev.doc === 'chưa có đơn'
                            ? 'num text-[var(--warn)]'
                            : 'num text-[var(--act-text)]'
                        }
                      >
                        {p.ev.doc}
                      </span>
                    </Td>
                    <Td num tone={p.ev.delta > 0 ? 'done' : undefined}>
                      {p.ev.delta > 0 ? `+${n(p.ev.delta)}` : n(p.ev.delta)}
                    </Td>
                    <Td num tone={p.after < MIN ? 'stop' : undefined}>
                      {n(p.after)}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              <GridFoot>
                <Td colSpan={4}>
                  Hôm nay {n(OPENING)} cây · {SERIES.length} mốc trong 8 tuần
                </Td>
                <Td num>{n(SERIES.reduce((s, p) => s + p.ev.delta, 0))}</Td>
                <Td num>{n(SERIES[SERIES.length - 1].after)}</Td>
              </GridFoot>
            </Grid>
          </div>
        </FastTab>

        <FastTab
          title="Tồn theo kệ"
          summary={[
            ['Kệ', <span key="a" className="num">1</span>], // prettier-ignore
            ['Dùng được', <span key="b" className="num">380</span>], // prettier-ignore
            ['Đang mắc', <span key="c" className="num">0</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={560}>
            <GridHead>
              <Th width={140}>Kệ</Th>
              <Th num width={110}>
                Dùng được
              </Th>
              <Th num width={110}>
                Chờ kiểm
              </Th>
              <Th num width={110}>
                Khoá
              </Th>
              <Th>Đếm gần nhất</Th>
            </GridHead>
            <GridBody>
              <GridRow>
                <Td>
                  <span className="num">NHOM-A1</span>
                </Td>
                <Td num>380</Td>
                <Td num />
                <Td num />
                <Td>Đợt DKK-2609-03 · 15/09/2026</Td>
              </GridRow>
            </GridBody>
          </Grid>
          <p className="px-[var(--gutter)] py-[9px] text-[var(--fs-sm)] text-[var(--ink-3)]">
            Một mã nằm ở <b>ba kệ</b> là chuyện bình thường, và bảng này là chỗ duy nhất
            nói ra điều đó. Khi vị trí là thuộc tính của <i>vật tư</i> thay vì của{' '}
            <i>lượng</i> thì bảng này không tồn tại được.
          </p>
        </FastTab>

        <FastTab
          title="Dùng ở đâu"
          summary={[
            ['Định mức SP', <span key="a" className="num">8</span>], // prettier-ignore
            ['Lệnh đang mở', <span key="b" className="num">3</span>], // prettier-ignore
            ['Giữ chỗ', <span key="c" className="num">180 cây</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={640}>
            <GridHead>
              <Th width={150}>Nơi dùng</Th>
              <Th>Tên</Th>
              <Th num width={110}>
                Cần
              </Th>
              <Th num width={110}>
                Đã cấp
              </Th>
            </GridHead>
            <GridBody>
              <GridRow>
                <Td>
                  <span className="num">LSX 07/26-14</span>
                </Td>
                <Td>Ghế MERXX-209 · 300 cái</Td>
                <Td num>900</Td>
                <Td num>900</Td>
              </GridRow>
              <GridRow>
                <Td>
                  <span className="num">LSX 07/26-09</span>
                </Td>
                <Td>Ghế MERXX-909 · 200 cái</Td>
                <Td num>600</Td>
                <Td num>600</Td>
              </GridRow>
              <GridRow>
                <Td>
                  <span className="num">LSX 07/26-21</span>
                </Td>
                <Td>Ghế MERXX-209 · 80 cái</Td>
                <Td num>240</Td>
                <Td num />
              </GridRow>
            </GridBody>
            <GridFoot>
              <Td colSpan={2}>Cộng 3 lệnh đang mở</Td>
              <Td num>1.740</Td>
              <Td num>1.500</Td>
            </GridFoot>
          </Grid>
          <p className="px-[var(--gutter)] py-[9px] text-[var(--fs-sm)] text-[var(--ink-3)]">
            Bảng này là thứ phải xem <b>trước khi ngừng dùng</b> một mã. Chứng từ không có
            câu hỏi “đang đỡ bao nhiêu thứ” — hồ sơ danh mục thì có, và đó là một trong
            bốn chỗ khuôn E khác khuôn D.
          </p>
        </FastTab>

        <FastTab
          title="Thuộc tính"
          summary={[
            ['Nhóm', 'Nhôm định hình'],
            ['Mã vạch NCC', <span key="b" className="num">có</span>], // prettier-ignore
            ['Sửa lần cuối', <span key="c" className="num">12/09</span>], // prettier-ignore
          ]}
        >
          <FieldGrid
            note={
              <>
                Sửa ở đây là <b>sửa bản ghi gốc</b> — đổi cho mọi đơn và mọi phiếu lập từ
                nay về sau, không chỉ cho một tờ.
              </>
            }
          >
            <Field label="Mã">
              <span className="num">NH-0480</span>
            </Field>
            <Field label="Tên">Nhôm hộp 20 × 40 × T1.0 có 2 gân</Field>
            <Field label="Nhóm">Nhôm định hình - tấm</Field>
            <Field label="Nhóm phụ">Nhôm hộp</Field>
            <Field label="ĐVT">Cây</Field>
            <Field label="ĐVT giá">
              <span className="num">kg</span>
            </Field>
            <Field label="Mã vạch NCC">
              <span className="num">8936012345678</span>
            </Field>
            <Field label="Kệ mặc định">
              <span className="num">NHOM-A1</span>
            </Field>
            <Field label="Cần kiểm khi nhập" tone="warn">
              Có — theo nhóm Nhôm định hình
            </Field>
            <Field label="Dung sai nhận vượt">
              <span className="num">5%</span>
            </Field>
            <Field label="Mẫu đơn mua" inherited>
              Nhôm theo kg
            </Field>
            <Field label="Thuế suất" inherited>
              <span className="num">8%</span>
            </Field>
          </FieldGrid>
        </FastTab>
      </DocBody>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Công ty Hoàng Gia · Kho vật tư chính',
        ]}
        right="NH-0480 · bản ghi 3/705 trong nhóm"
      />
    </DocScreen>
  )
}
