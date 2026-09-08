'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  CoverageBar,
  Empty,
  FilterBar,
  Loading,
  GroupRow,
  InspectSection,
  NoticeBar,
  Num,
  PermHint,
  NumInput,
  Row,
  StageBar,
  TFoot,
  THead,
  Table,
  Tag,
  WhyBox,
  WorkLanes,
  coverage,
  coveragePct,
  rowAction,
  showMoney,
  showNum,
  toLanes,
} from '@/components/kit'

/**
 * KIT v4 — TRANG TRƯNG BÀY (/kit-lab/bo-kit).
 *
 * Mỗi component bày ĐỦ CÁC TRẠNG THÁI, không chỉ trạng thái đẹp: rỗng, bị
 * khoá, tràn chữ, số 0, số lẻ. Trạng thái xấu mới là chỗ kit hay vỡ, và
 * cũng là chỗ người duyệt cần nhìn trước khi đồng ý.
 *
 * Kèm luôn LÝ DO của từng quyết định — bộ kit không có lý do thì lượt sau
 * ai đó sẽ "sửa cho đẹp" và phá đúng thứ đang cố giữ.
 */

function Spec({
  n,
  name,
  why,
  children,
}: {
  n: string
  name: string
  why: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-[var(--line)]">
      <div className="flex items-baseline gap-3 px-[var(--gutter)] pt-6 pb-1">
        <span className="num text-[11px] font-bold text-[var(--act)]">{n}</span>
        <h3 className="text-[15px] font-semibold">{name}</h3>
      </div>
      <p className="max-w-[760px] px-[var(--gutter)] pb-3 text-[var(--fs-sm)] leading-relaxed text-[var(--ink-2)]">
        {why}
      </p>
      <div className="bg-[var(--surface-card)] px-[var(--gutter)] py-4">{children}</div>
    </section>
  )
}

/** Nhãn nhỏ cho từng biến thể trong ô trưng bày. */
function V({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10.5px] font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

const DEMO = [
  { code: 'NK-0136', name: 'Vít 4x15 đầu bằng ren gỗ, xi trắng — tên dài để thử tràn ô', spec: '4×15', unit: 'Con', need: 440, covered: 0, price: null as number | null, supplier: null as string | null },
  { code: 'NK-0042', name: 'Long đền nhôm 6x16x5, đen', spec: '6×16×5', unit: 'Con', need: 80, covered: 5, price: 68000, supplier: 'TÂN THÀNH LONG' },
  { code: 'NK-0018', name: 'Mạc đồng dán', spec: null, unit: 'Cái', need: 20, covered: 20, price: 2100, supplier: 'TÂN THÀNH LONG' },
]

export default function KitGallery() {
  const [lane, setLane] = useState('mua')
  const [chip, setChip] = useState(true)
  const [dense, setDense] = useState(false)

  const lanes = toLanes(DEMO, [
    { id: 'mua', label: 'Cần mua', test: (r) => r.need - r.covered > 0 },
    { id: 'kt', label: 'Kỹ thuật đang mắc', tone: 'stop', test: (r) => !r.supplier },
    { id: 'du', label: 'Đã đủ', test: (r) => r.need - r.covered === 0 },
  ])

  return (
    <div className={`kit-v4 ${dense ? 'kit-dense' : ''} min-h-screen`}>
      <header className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-6">
        <div className="text-[var(--fs-micro)] font-semibold tracking-[.09em] text-[var(--ink-3)] uppercase">
          Bộ kit giao diện
        </div>
        <h1 className="mt-1 text-[var(--fs-title)] font-semibold tracking-[-.015em]">
          HG-ERP Kit v4
        </h1>
        <p className="mt-2 max-w-[760px] text-[var(--fs-sm)] leading-relaxed text-[var(--ink-2)]">
          Mỗi component bày đủ trạng thái, kể cả trạng thái xấu — rỗng, bị khoá, tràn chữ,
          số 0. Đó mới là chỗ kit hay vỡ. Duyệt xong bộ này rồi mới áp lên màn thật.
        </p>
        <div className="mt-4 flex gap-2">
          <Btn onClick={() => setDense(!dense)}>
            Mật độ: {dense ? 'Dày (27px)' : 'Thưa (34px)'}
          </Btn>
          <Btn primary>Nút chính</Btn>
        </div>
      </header>

      {/* ── 01 MÀU ─────────────────────────────────────────────────── */}
      <Spec
        n="01"
        name="Token màu"
        why="Một màu hành động duy nhất (xanh) — chỗ nào xanh là chỗ bấm được. Ba màu vòng đời dữ liệu (dừng/chờ/xong) tuyệt đối không được mượn cho trạng thái điều khiển: mượn thì 'đang chọn' trông như 'đang lỗi'. Nền trang không phải trắng tinh vì người dùng ngồi 6-8 tiếng dưới đèn xưởng."
      >
        <div className="flex flex-wrap gap-6">
          {[
            ['--surface', 'Nền trang'],
            ['--surface-card', 'Mặt bảng'],
            ['--surface-raised', 'Tiêu đề khối'],
            ['--act', 'Hành động'],
            ['--stop', 'Dừng'],
            ['--warn', 'Chờ'],
            ['--done', 'Xong'],
            ['--ink', 'Mực'],
            ['--ink-2', 'Mực phụ'],
            ['--ink-3', 'Mực mờ'],
          ].map(([v, label]) => (
            <div key={v} className="flex flex-col gap-1.5">
              <span
                className="h-11 w-20 rounded-[var(--radius)] border border-[var(--line)]"
                style={{ background: `var(${v})` }}
              />
              <span className="text-[11px] font-semibold">{label}</span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--ink-3)]">
                {v}
              </span>
            </div>
          ))}
        </div>
      </Spec>

      {/* ── 02 SỐ ──────────────────────────────────────────────────── */}
      <Spec
        n="02"
        name="Số"
        why="Số 0 hiện thành gạch ngang nhưng giá trị vẫn là số — '0 tấm đã về' khác 'chưa ai nhập'. Mono + tabular là bắt buộc: thiếu tabular thì các chữ số rộng khác nhau và cột căn phải vẫn nhấp nhô, mắt không so được theo chiều dọc. Số 'strong' là con số người dùng mang đi làm việc; một dòng chỉ được có một."
      >
        <div className="flex flex-wrap gap-8">
          <V label="Chính (strong)">
            <Num value={showNum(440)} strong />
            <Num value={showNum(1350)} strong />
          </V>
          <V label="Phụ">
            <Num value={showNum(80)} />
            <Num value={showMoney(68000)} />
          </V>
          <V label="Chưa có số">
            <Num value={showNum(null)} />
          </V>
          <V label="0 có nghĩa">
            <Num value={showNum(0)} zero="zero" />
          </V>
          <V label="Hết việc">
            <Num value={showNum(0)} zero="done" />
          </V>
          <V label="Số lẻ thật">
            <Num value={showNum(3450.5)} />
            <Num value={showNum(297)} />
          </V>
        </div>
        <p className="mt-3 text-[var(--fs-micro)] text-[var(--ink-3)]">
          297 không ra “297,” — bẫy đã dính một lần ở file Excel.
        </p>
      </Spec>

      {/* ── 03 NHÃN ────────────────────────────────────────────────── */}
      <Spec
        n="03"
        name="Nhãn trạng thái"
        why="Không có tone 'hành động': màu bấm được không dùng cho nhãn chỉ để đọc, nếu không thì cái bấm được và cái không giống hệt nhau. Nhãn nói VIỆC PHẢI LÀM chứ không nói tình hình — 'Chưa mua lần nào' vô dụng, 'Chưa biết mua ở đâu' chỉ đúng việc."
      >
        <div className="flex flex-wrap gap-8">
          <V label="Bốn tone">
            <Tag>Trung tính</Tag>
            <Tag tone="stop">Chưa đặt</Tag>
            <Tag tone="warn">Đơn chưa duyệt</Tag>
            <Tag tone="done">Đủ</Tag>
          </V>
          <V label="Sinh từ rowAction()">
            {[
              { suggest: 100, hasPrice: false, hasSupplier: false, blockedByBom: false },
              { suggest: 100, hasPrice: false, hasSupplier: true, blockedByBom: false },
              { suggest: 100, hasPrice: true, hasSupplier: true, blockedByBom: false },
              { suggest: 0, hasPrice: true, hasSupplier: true, blockedByBom: false },
              { suggest: 40, hasPrice: true, hasSupplier: true, blockedByBom: true },
            ].map((r, i) => {
              const a = rowAction(r)
              return (
                <Tag key={i} tone={a.tone}>
                  {a.label}
                </Tag>
              )
            })}
          </V>
        </div>
      </Spec>

      {/* ── 04 ĐỘ PHỦ ──────────────────────────────────────────────── */}
      <Spec
        n="04"
        name="Thanh độ phủ"
        why="Gộp 5 cột số (đã xuất / tồn / đã đặt / nháp / đã về) thành một câu trả lời: còn xa bao nhiêu. Đo trên LSX 06/26-27 thì 4/5 cột đó rỗng ở phần lớn dòng — năm cột để trả lời một câu hỏi. Chi tiết không mất, nó nằm ở khay kiểm tra. Không cần gì thì không thiếu gì: need=0 trả về đủ, không phải 0/0."
      >
        <div className="flex flex-wrap gap-8">
          {[
            { need: 440, covered: 0, l: 'Chưa có gì' },
            { need: 80, covered: 5, l: 'Mới một phần' },
            { need: 100, covered: 62, l: 'Quá nửa' },
            { need: 20, covered: 20, l: 'Đủ (xanh lá)' },
            { need: 0, covered: 0, l: 'Không cần mua' },
          ].map((c, i) => (
            <V key={i} label={c.l}>
              <div className="w-[110px]">
                <CoverageBar
                  ratio={coverage(c)}
                  label={coveragePct(coverage(c))}
                />
              </div>
            </V>
          ))}
        </div>
      </Spec>

      {/* ── 05 NÚT ─────────────────────────────────────────────────── */}
      <Spec
        n="05"
        name="Nút & quyền hạn"
        why="Hai biến thể, không phải sáu. Điểm khác v3 rõ nhất: quyền hạn phải THẤY ĐƯỢC. Nút bấm vào mới báo 'không có quyền' là thiết kế tệ — đúng ca min_stock ngày 08/09, người dùng thấy lỗi về một ô mà hộp thoại không hề có. Có blockedBy thì nút mờ đi và nói luôn ai giữ quyền."
      >
        <div className="flex flex-wrap items-start gap-10">
          <V label="Bình thường">
            <Btn primary>Cắt đơn</Btn>
            <Btn>Xuất Excel</Btn>
          </V>
          <V label="Bị khoá vì quyền">
            <Btn blockedBy="Kỹ thuật">Sửa định mức</Btn>
          </V>
          <div className="max-w-[280px]">
            <span className="text-[10.5px] font-semibold tracking-[.06em] text-[var(--ink-3)] uppercase">
              Lời giải thích đi kèm
            </span>
            <div className="mt-2">
              <PermHint owner="Kỹ thuật" />
            </div>
          </div>
        </div>
      </Spec>

      {/* ── 06 DẢI NÓI VIỆC ────────────────────────────────────────── */}
      <Spec
        n="06"
        name="Dải nói việc"
        why="Bắt buộc có nút hành động — kiểu dữ liệu ép như vậy. Một dải cảnh báo không chỉ lối đi tiếp thì chỉ làm người đọc lo mà không giúp họ xử lý. Công thức: hiện trạng → vì sao → ai phải làm gì."
      >
        <div className="-mx-[var(--gutter)] flex flex-col">
          <NoticeBar tag="Chặn mua" action={{ label: 'Xem 7 sản phẩm' }}>
            <b className="text-[var(--ink)]">7 sản phẩm</b> có định mức nhưng Kỹ thuật chưa
            xác nhận BOM — số vẫn tính vào cột Cần, nhưng{' '}
            <b className="text-[var(--ink)]">không được gửi đơn</b> theo bản này.
          </NoticeBar>
          <NoticeBar tone="stop" tag="Quá hạn" action={{ label: 'Giục nhà cung cấp' }}>
            <b className="text-[var(--ink)]">3 đơn</b> đã quá hẹn giao mà chưa có hàng về.
          </NoticeBar>
        </div>
      </Spec>

      {/* ── 07 HÀNG ĐỢI ────────────────────────────────────────────── */}
      <Spec
        n="07"
        name="Hàng đợi việc"
        why="Tab KHÔNG phải bộ lọc dữ liệu mà là ba việc của ba người khác nhau. Số đếm là lời hứa: bấm vào thấy đúng ngần đó dòng phải làm — cùng ranh giới với các tờ trong file Excel, để giấy in và màn hình không bao giờ đếm khác nhau. Lane rỗng vẫn giữ chỗ: số 0 là thông tin, không phải lý do giấu tab."
      >
        <div className="-mx-[var(--gutter)] border-b border-[var(--line)] bg-[var(--surface-card)]">
          <WorkLanes lanes={lanes} activeId={lane} onPick={setLane} />
        </div>
      </Spec>

      {/* ── 08 BẢNG ────────────────────────────────────────────────── */}
      <Spec
        n="08"
        name="Bảng"
        why="Tiêu đề cột dính, chân bảng dính, dòng tiêu đề khối theo CÔNG ĐOẠN sản xuất (khung → gỗ → ngũ kim → sơn → bao bì) chứ không theo nhóm kho — nhóm kho là trục xếp kệ, quá thô để chia bảng kê. Chân bảng có chỗ nói tổng KHÔNG bao gồm cái gì: con số che giấu điều kiện là con số nguy hiểm."
      >
        <div className="-mx-[var(--gutter)]">
          <FilterBar>
            <Chip on={chip} count={3} onClick={() => setChip(!chip)}>
              Còn phải đặt
            </Chip>
            <Chip count={1}>Chưa có giá</Chip>
            <div className="flex-1" />
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
              Đang xem <b className="num text-[var(--act)]">3</b> mã
            </span>
          </FilterBar>
          <div className="max-h-[280px]">
            <Table>
              <THead>
                <th style={{ width: 110 }}>Mã VT</th>
                <th>Tên vật tư</th>
                <th style={{ width: 90 }}>Quy cách</th>
                <th className="num" style={{ width: 84 }}>Cần mua</th>
                <th className="num" style={{ width: 116 }}>Đã phủ</th>
                <th className="num" style={{ width: 104 }}>Tạm tính</th>
                <th style={{ width: 150 }}>Việc phải làm</th>
              </THead>
              <tbody>
                <GroupRow step={5} name="Ngũ kim — lắp ráp" cols={7} meta="3 mã · 5.482.000 ₫" />
                {DEMO.map((r, i) => {
                  const left = r.need - r.covered
                  const a = rowAction({
                    suggest: left,
                    hasPrice: !!r.price,
                    hasSupplier: !!r.supplier,
                    blockedByBom: false,
                  })
                  return (
                    <Row key={r.code} selected={i === 0}>
                      <Cell><Code>{r.code}</Code></Cell>
                      <Cell grow>{r.name}</Cell>
                      <Cell muted>{r.spec ?? '—'}</Cell>
                      <Cell num><Num value={showNum(left)} strong zero="done" /></Cell>
                      <Cell num>
                        <CoverageBar ratio={coverage(r)} label={coveragePct(coverage(r))} />
                      </Cell>
                      <Cell num>
                        <Num value={r.price ? showMoney(left * r.price) : ''} />
                      </Cell>
                      <Cell><Tag tone={a.tone}>{a.label}</Tag></Cell>
                    </Row>
                  )
                })}
              </tbody>
              <TFoot
                label={<td colSpan={3}>Cộng <span className="num">3</span> mã</td>}
                cells={
                  <>
                    <td className="num">540</td>
                    <td />
                    <td className="num text-[14px] whitespace-nowrap">
                      5.482.000
                      <span className="ml-[3px] text-[11px] font-normal text-[var(--ink-3)]">₫</span>
                    </td>
                  </>
                }
                caveat="1/3 mã chưa có giá — chưa nằm trong tổng này"
              />
            </Table>
          </div>
        </div>
      </Spec>

      {/* ── 8b VẠCH VÒNG ĐỜI ───────────────────────────────────────── */}
      <Spec
        n="8b"
        name="Vạch vòng đời"
        why="Dải liền, không phải tròn + đường nối chiếm hai hàng chiều cao cho một thông tin một dòng. Chỉ bậc HIỆN TẠI có màu hành động — v3 tô đậm cả các bậc đã qua, cả dải sáng rực và mắt không tìm ra đang ở đâu trên đơn 8 bậc."
      >
        <div className="flex flex-col gap-3">
          <StageBar
            stages={['Nháp', 'Chờ duyệt', 'GĐ duyệt', 'Gửi NCC', 'NCC xác nhận', 'Đang giao', 'Về một phần', 'Về đủ']}
            current={1}
          />
          <StageBar
            stages={['Nháp', 'Chờ duyệt', 'GĐ duyệt', 'Gửi NCC', 'NCC xác nhận', 'Đang giao', 'Về một phần', 'Về đủ']}
            current={5}
          />
        </div>
      </Spec>

      {/* ── 8c Ô NHẬP SỐ ───────────────────────────────────────────── */}
      <Spec
        n="8c"
        name="Ô nhập số"
        why="Bẫy đã dính HAI LẦN ở v3 (commit 2c7e4e8, f6545e9): type=number + onChange ép về Number thì gõ '1.' là mất dấu chấm, không nhập nổi 1.5. Ở đây giữ chuỗi trong lúc gõ, chỉ ép kiểu khi rời ô. inputMode=decimal để tablet của quản đốc bật bàn phím số."
      >
        <div className="flex flex-wrap items-end gap-6">
          <V label="Gõ thử số lẻ">
            <div className="w-[120px]">
              <NumInput value="1350" onCommit={() => {}} />
            </div>
          </V>
          <V label="Có sẵn số lẻ">
            <div className="w-[120px]">
              <NumInput value="0.2494" onCommit={() => {}} />
            </div>
          </V>
          <V label="Khoá">
            <div className="w-[120px]">
              <NumInput value="440" onCommit={() => {}} disabled />
            </div>
          </V>
        </div>
      </Spec>

      {/* ── 8d ĐANG TẢI ────────────────────────────────────────────── */}
      <Spec
        n="8d"
        name="Đang tải"
        why="Số dòng khung xương phải bằng số dòng bảng thật sẽ có. Ít hơn thì trang nhảy giật khi dữ liệu về, và người đang định bấm sẽ bấm nhầm dòng."
      >
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]">
          <Loading rows={4} />
        </div>
      </Spec>

      {/* ── 09 PHÉP TÍNH ───────────────────────────────────────────── */}
      <Spec
        n="09"
        name="Phép tính bày ra"
        why="Component quan trọng nhất của v4. Số nào người dùng không kiểm được thì họ không tin; không tin thì họ mở Excel tính tay, và lúc đó ERP tụt xuống thành nơi nhập liệu chứ không phải nơi ra quyết định. Hiển thị nguyên văn cách tính, không diễn giải lại, không làm tròn khác với số trên bảng."
      >
        <div className="max-w-[320px] rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]">
          <InspectSection title="Vì sao cần 440">
            <div className="flex items-baseline justify-between">
              <span className="text-[var(--ink-2)]">Còn phải đặt</span>
              <span className="num text-[15px] font-bold text-[var(--act)]">440 Con</span>
            </div>
            <WhyBox
              lines={['định mức 4/SP × SL 110 SP = 440', '− tồn khả dụng 0 · − đã đặt 0']}
              result="còn phải đặt 440 Con"
            />
          </InspectSection>
        </div>
      </Spec>

      {/* ── 10 TRẠNG THÁI RỖNG ─────────────────────────────────────── */}
      <Spec
        n="10"
        name="Trạng thái rỗng"
        why="reason và next là BẮT BUỘC trong kiểu dữ liệu, có chủ ý: 'Không có dữ liệu' là ngõ cụt đẩy người dùng đi hỏi vòng quanh. Kiểu bắt buộc là cách rẻ nhất để không ai viết được empty state vô nghĩa. Công thức: hiện trạng → vì sao → việc tiếp theo."
      >
        <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]">
          <Empty
            headline="Không còn mã nào phải mua"
            reason="Cả 68 mã của lệnh đã đủ tồn, đã đặt hoặc đang về. Bảng trống ở đây là tin tốt, không phải lỗi dữ liệu."
            next={
              <>
                <Btn primary>Xem 52 mã đã đủ</Btn>
                <Btn>Xuất Excel</Btn>
              </>
            }
          />
        </div>
      </Spec>

      <footer className="px-[var(--gutter)] py-8 text-[var(--fs-sm)] text-[var(--ink-3)]">
        Màn mẫu đầy đủ:{' '}
        <a href="/kit-lab" className="font-semibold text-[var(--act)] hover:underline">
          /kit-lab
        </a>
      </footer>
    </div>
  )
}
