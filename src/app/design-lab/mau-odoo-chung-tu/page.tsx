'use client'

import { useState } from 'react'
import {
  Btn,
  Checks,
  Crumb,
  DocScreen,
  Field,
  FieldGrid,
  Followers,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  GridToolbar,
  HolderBar,
  LineDetail,
  LineStatus,
  Menu,
  NoteComposer,
  NoteStream,
  SmartLinks,
  StatusBar,
  StatusTrack,
  Tag,
  Td,
  Th,
  Timeline,
  WorkLanes,
  type Check,
  type Lane,
  type Mark,
  type StreamRow,
} from '@/components/kit'

/**
 * MÀN CHỨNG TỪ — KHUÔN ODOO. Bản đối chứng của `/design-lab/mau-erp`.
 *
 * Hai màn này bày CÙNG một tờ đơn với CÙNG bộ tính năng, khác nhau ở cách
 * xếp. Dựng cả hai để so được bằng mắt thay vì cãi bằng lời.
 *
 * ┌ Khác biệt cấu trúc ───────────────────────────────────────────────────┐
 * │                    mau-erp (Dynamics)      mau-odoo (đây)             │
 * │ Hành động          5 nhóm × 3 nút, có nhãn 3 nút + "Thao tác ▾"       │
 * │                    nhóm bên dưới           menu gom phần còn lại      │
 * │ Nội dung phụ       khối gấp xếp DỌC        dải TAB ngang (notebook)   │
 * │ Dữ kiện NCC + tiền khung phải 268px        NCC inline · tiền ở chân   │
 * │                                            lưới dòng                  │
 * │ Trao đổi           khối gấp, mặc định gấp  luôn hiện ở đáy            │
 * │ Hành động nhận hàng tab riêng trên thanh   nằm TRONG tab Giao & nhận  │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * BA LÝ DO chọn khuôn Odoo cho quy mô một xưởng:
 *
 * 1. Action Pane của Dynamics sinh ra để xếp HÀNG CHỤC hành động cho nhiều
 *    vai. Phòng Cung ứng có ~19 hành động và MỘT vai. Với ngần đó, năm nhóm
 *    nút có nhãn là hai hàng khung trả giá cho một vấn đề không tồn tại.
 * 2. Khối gấp xếp dọc bắt người dùng CUỘN để biết có gì; dải tab cho thấy
 *    trọn danh sách phần phụ trong một hàng, và mỗi phần một cú bấm.
 * 3. Bỏ khung phải trả lại **268px** cho lưới dòng — đo trên chính bản đang
 *    chạy. Với mẫu kính 11 cột, đó là khác biệt giữa "phải cuộn ngang" và
 *    "thấy hết".
 *
 * GIỮ NGUYÊN mọi tính năng của bản đang chạy: 19 hành động, hai trục trạng
 * thái, nút thông minh, dải người giữ, bảng kiểm, lưới dòng + chi tiết dòng,
 * đầu đơn, điều khoản, đợt giao, ma trận nhận, chứng từ kho, trao đổi, dòng
 * thời gian, tài liệu, thanh trạng thái đáy.
 *
 * Khoảng cách trong file này CHỈ dùng thang `--sp-*` của tokens.css — màn này
 * đồng thời là phép thử của thang đó.
 */

/* ── Dữ liệu mẫu: đúng đơn PO-2026-0065 đang có thật trong sổ ──────────── */

type SampleLine = {
  code: string
  name: string
  loai: string
  quyCach: string
  dvt: string
  sl: number
  gia: number
  nhan: 'idle' | 'part' | 'done' | 'short'
  nhanLabel: string
}

const LINES: SampleLine[] = [
  { code: 'KIM0161', name: 'Kính sơn màu 625x399x5mm — Dark grey', loai: 'Dark grey', quyCach: '625 × 399 × 5mm', dvt: 'Tấm', sl: 1350, gia: 2.15, nhan: 'idle', nhanLabel: 'Chưa nhận' }, // prettier-ignore
  { code: 'KIM0162', name: 'Kính sơn màu 625x399x5mm — Dolphin grey', loai: 'Dolphin grey', quyCach: '625 × 399 × 5mm', dvt: 'Tấm', sl: 600, gia: 2.15, nhan: 'idle', nhanLabel: 'Chưa nhận' }, // prettier-ignore
  { code: 'KIM0163', name: 'Kính sơn màu 748x833x5mm — Dark grey', loai: 'Dark grey', quyCach: '748 × 833 × 5mm', dvt: 'Tấm', sl: 100, gia: 5.36, nhan: 'idle', nhanLabel: 'Chưa nhận' }, // prettier-ignore
  { code: 'KIM0164', name: 'Kính sơn màu 698x833x5mm — Dark grey', loai: 'Dark grey', quyCach: '698 × 833 × 5mm', dvt: 'Tấm', sl: 50, gia: 5, nhan: 'idle', nhanLabel: 'Chưa nhận' }, // prettier-ignore
  { code: 'KIM0165', name: 'Kính sơn màu 748x833x5mm — Dolphin grey', loai: 'Dolphin grey', quyCach: '748 × 833 × 5mm', dvt: 'Tấm', sl: 200, gia: 5.36, nhan: 'idle', nhanLabel: 'Chưa nhận' }, // prettier-ignore
  { code: 'KIM0167', name: 'Kính sơn màu 1034x998x5mm — Dark grey', loai: 'Dark grey', quyCach: '1034 × 998 × 5mm', dvt: 'Tấm', sl: 510, gia: 8.88, nhan: 'idle', nhanLabel: 'Chưa nhận' }, // prettier-ignore
]
const TIEN_HANG = LINES.reduce((s, l) => s + l.sl * l.gia, 0)

const CHECKS: Check[] = [
  { level: 'warn', what: 'Chưa có hạn giao', fix: 'Điền hạn giao' },
]

const MARKS: Mark[] = [
  { key: 'tao', at: '2026-09-03T08:12:00', label: 'Tạo đơn', actor: 'Đặng Thị Thanh Nga' }, // prettier-ignore
  { key: 'duyet', at: null, label: 'Giám đốc duyệt' },
  { key: 'gui', at: null, label: 'Gửi nhà cung cấp' },
  { key: 'xn', at: null, label: 'NCC xác nhận' },
]

const STREAM: StreamRow[] = [
  { kind: 'mark', at: '2026-09-03T08:12:00', key: 'tao', label: 'Tạo đơn', actor: 'Đặng Thị Thanh Nga' }, // prettier-ignore
  {
    kind: 'note',
    at: '2026-09-04T14:30:00',
    note: {
      id: 'n1',
      body: 'Chị Nga xác nhận với Taizhou là giá 2,15 USD/tấm giữ tới cuối tháng. Cần gửi đơn trước 15/09 mới kịp.',
      audience: 'internal',
      author_name: 'Nguyễn Văn A',
      created_at: '2026-09-04T14:30:00',
    },
  },
]

const money = (n: number) =>
  n.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number) => n.toLocaleString('vi-VN')

/* ── Màn ──────────────────────────────────────────────────────────────── */

export default function Page() {
  const [tab, setTab] = useState('dong-hang')
  const [pick, setPick] = useState(0)
  const cur = LINES[pick]

  const lanes: Lane<unknown>[] = [
    { id: 'dong-hang', label: 'Dòng hàng', rows: LINES },
    { id: 'giao-nhan', label: 'Giao & nhận', rows: [] },
    { id: 'dieu-khoan', label: 'Điều khoản', rows: new Array(5).fill(0) },
    { id: 'thoi-gian', label: 'Dòng thời gian', rows: MARKS.filter((m) => m.at) },
  ]

  return (
    <DocScreen dense>
      <Crumb path={['Mua hàng', 'Đơn mua', 'PO-2026-0065']} position={[4, 68]} />

      {/*
        THANH HÀNH ĐỘNG KIỂU ODOO — ba nút bày sẵn, phần còn lại vào một menu,
        trục trạng thái đẩy sang phải. Một hàng 40px, thay cho hai hàng 100px
        của Action Pane. Nút bày sẵn là nút của BƯỚC HIỆN TẠI, không phải nút
        hay dùng nhất nói chung: đơn đang nháp thì "Gửi Giám đốc duyệt" là việc
        duy nhất đáng làm.
      */}
      <div className="flex flex-wrap items-center gap-[var(--sp-2)] border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[var(--sp-3)]">
        <Btn primary>Gửi Giám đốc duyệt</Btn>
        <Btn>Sửa</Btn>
        <Btn>In phiếu</Btn>
        <Menu
          label="Thao tác ▾"
          items={[
            { label: 'Nhân bản' },
            { label: 'Xuất Excel' },
            { label: 'Đổi hẹn giao' },
            { label: 'Ghi việc đã giục' },
            { label: 'Bàn giao người phụ trách' },
            { label: 'Sửa điều khoản' },
            { label: 'Xoá nháp', danger: true },
          ]}
        />
        <span className="ml-auto">
          <StatusTrack
            label="Trạng thái đơn"
            steps={['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi', 'NCC nhận', 'Đang giao']}
            at={0}
          />
        </span>
      </div>

      <HolderBar
        mine
        who="Cung ứng — Đặng Thị Thanh Nga"
        what="Soạn xong thì gửi Giám đốc duyệt"
        age="7 ngày"
      />
      <Checks compact title="Lưu ý trước khi gửi duyệt" items={CHECKS} />

      {/*
        TỜ ĐƠN. Phẳng, không thẻ nổi — Odoo bày sheet như một thẻ trắng trên
        nền xám, nhưng chủ dự án đã chấm lối đó là "khoảng rộng xung quanh"
        (10/09/2026), nên giữ cấu trúc Odoo mà bỏ khung thẻ.
      */}
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <SmartLinks
          items={[
            { label: 'đợt giao', count: 0 },
            { label: 'phiếu kho', count: 0 },
            { label: 'lệnh SX', count: 2 },
            { label: 'trao đổi', count: 1 },
            { label: 'tài liệu', count: 0 },
          ]}
        />

        <div className="px-[var(--gutter)] pt-[var(--sp-4)] pb-[var(--sp-2)]">
          <div className="font-bold tracking-[.11em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
            Đơn đặt vật tư
          </div>
          <div className="flex flex-wrap items-baseline gap-[var(--sp-5)]">
            <h1 className="num m-0 text-[24px] leading-tight font-bold tracking-[-.02em]">
              PO-2026-0065
            </h1>
            <span className="flex items-center gap-[var(--sp-2)] text-[var(--fs-sm)] text-[var(--ink-2)]">
              Nhận hàng <Tag tone="warn">Chưa nhận</Tag>
            </span>
          </div>
        </div>

        <div className="k-cq px-[var(--gutter)] pb-[var(--sp-4)]">
          <FieldGrid
            note={
              <>
                Ô nền nhạt là <b>giá trị kế thừa từ hồ sơ nhà cung cấp</b> — sửa ở đây chỉ
                đổi cho đơn này.
              </>
            }
          >
            <Field label="Nhà cung cấp">TAIZHOU XU-DAN HOME TECHNOLOGY CO., LTD.</Field>
            <Field label="Lệnh sản xuất">
              <span className="num">08/26-27 - MX</span>
            </Field>
            <Field label="Mẫu đơn">Kính</Field>
            <Field label="Hạn giao" tone="warn">
              chưa có
            </Field>
            <Field label="Số hợp đồng">
              <span className="num">03.26HG-JACKY</span>
            </Field>
            <Field label="Người phụ trách">Đặng Thị Thanh Nga</Field>
            <Field label="Tiền tệ">
              <span className="num">USD</span>
            </Field>
            <Field label="Thuế suất" inherited>
              <span className="num">0%</span>
            </Field>
            <Field label="Điều khoản TT" inherited>
              TTR — đặt cọc 20%
            </Field>
          </FieldGrid>
        </div>

        {/*
          DỮ KIỆN NCC — thay cho khung phải 268px. Đặt ngay dưới ô "Nhà cung
          cấp" vì đây là lúc người mua cần nó: đang quyết có gửi đơn cho bên
          này không. Một hàng, không phải một cột.
        */}
        <div className="flex flex-wrap gap-x-[var(--sp-7)] gap-y-[var(--sp-1)] border-y border-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] py-[var(--sp-3)] text-[var(--fs-sm)]">
          <span className="font-bold tracking-[.09em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
            Nhà cung cấp này
          </span>
          <span>
            Giao đúng hẹn <b className="k-t-warn">chưa có lịch sử</b>
          </span>
          <span>
            Đã đặt <b className="num">2 đơn</b>
          </span>
          <span>
            Nhận đủ <b className="num">0 đơn</b>
          </span>
          <span>
            Mua gần nhất <b className="num">03/09/2026</b>
          </span>
          <span>
            Mã NCC <b className="num">TXD</b>
          </span>
        </div>

        {/*
          NOTEBOOK — dải tab ngang thay cho khối gấp xếp dọc. Thấy trọn danh
          sách phần phụ trong một hàng; mỗi phần đúng một cú bấm, không cuộn.
        */}
        <div className="border-b border-[var(--line)] bg-[var(--surface-card)]">
          <WorkLanes lanes={lanes} activeId={tab} onPick={setTab} />
        </div>

        {tab === 'dong-hang' && (
          <>
            <GridToolbar count={`${LINES.length} dòng`}>
              <GridBtn>Chỉnh sửa vật tư</GridBtn>
              <GridBtn>Dán từ Excel</GridBtn>
              <GridBtn>Khai vật tư mới</GridBtn>
              <GridSep />
              <GridBtn>Chia đợt giao</GridBtn>
            </GridToolbar>
            <Grid minWidth={900}>
              <GridHead>
                <Th width={34}>#</Th>
                <Th>Mã · tên vật tư</Th>
                <Th>Loại kính</Th>
                <Th>Quy cách</Th>
                <Th width={52}>ĐVT</Th>
                <Th num>SL đặt</Th>
                <Th num>Đơn giá</Th>
                <Th num>Thành tiền</Th>
                <Th width={104}>Trạng thái</Th>
              </GridHead>
              <GridBody>
                {LINES.map((l, i) => (
                  <GridRow key={l.code} selected={i === pick} onClick={() => setPick(i)}>
                    <Td num>{i + 1}</Td>
                    <Td>
                      <span className="num k-strong">{l.code}</span> · {l.name}
                    </Td>
                    <Td>{l.loai}</Td>
                    <Td>{l.quyCach}</Td>
                    <Td>{l.dvt}</Td>
                    <Td num>{num(l.sl)}</Td>
                    <Td num>{money(l.gia)}</Td>
                    <Td num>{money(l.sl * l.gia)}</Td>
                    <Td>
                      <LineStatus kind={l.nhan}>{l.nhanLabel}</LineStatus>
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              {/*
                TIỀN Ở CHÂN LƯỚI, không ở khung phải. Đây là chỗ Odoo đặt, và
                đặt đúng: con số tổng là KẾT QUẢ của các dòng ngay trên nó, đọc
                liền mạch từ trên xuống. Ở khung phải thì mắt phải nhảy ngang.
              */}
              <GridFoot>
                <Td colSpan={5}>Cộng {LINES.length} dòng</Td>
                <Td num>{num(LINES.reduce((s, l) => s + l.sl, 0))}</Td>
                <Td />
                <Td num>
                  <b>{money(TIEN_HANG)} USD</b>
                </Td>
                <Td />
              </GridFoot>
            </Grid>
            <div className="flex flex-wrap justify-end gap-x-[var(--sp-7)] border-b border-[var(--line)] px-[var(--gutter)] py-[var(--sp-3)] text-[var(--fs-sm)]">
              <span>
                Tiền hàng <b className="num">{money(TIEN_HANG)} USD</b>
              </span>
              <span className="text-[var(--ink-3)]">
                VAT <b className="num">0% · 0,00 USD</b>
              </span>
              <span>
                Tổng thanh toán{' '}
                <b className="num text-[var(--fs-num-lg)]">{money(TIEN_HANG)} USD</b>
              </span>
            </div>
            <LineDetail index={pick + 1} code={cur.code}>
              <div className="grid gap-x-[var(--sp-7)] gap-y-[var(--sp-1)] px-[var(--gutter)] py-[var(--sp-3)] text-[var(--fs-sm)] sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Quy cách">{cur.quyCach}</Field>
                <Field label="Loại kính">{cur.loai}</Field>
                <Field label="m² / tấm">
                  <span className="num">0,249</span>
                </Field>
                <Field label="Nhu cầu lệnh">
                  <span className="num">—</span>
                </Field>
                <Field label="Tồn kho lúc soạn">
                  <span className="num">0</span>
                </Field>
                <Field label="Thành tiền">
                  <b className="num">{money(cur.sl * cur.gia)} USD</b>
                </Field>
              </div>
            </LineDetail>
          </>
        )}

        {tab === 'giao-nhan' && (
          <>
            {/*
              HÀNH ĐỘNG NHẬN HÀNG NẰM Ở ĐÂY, không trên thanh chung. Đây là
              khác biệt lớn nhất so với bản Dynamics: hành động sống cạnh đối
              tượng nó tác động. Người mua tìm "chốt phần thiếu" ở tab nhận
              hàng, không phải ở một tab thứ hai của thanh công cụ.
            */}
            <GridToolbar count="chưa có đợt nào">
              <GridBtn>NCC xác nhận</GridBtn>
              <GridBtn>Thêm đợt giao</GridBtn>
              <GridBtn>Hàng đang trên đường</GridBtn>
              <GridSep />
              <GridBtn>Ghi nhận nhận hàng · Kho</GridBtn>
              <GridBtn>Chốt phần thiếu</GridBtn>
              <GridBtn>Nghiệm thu ngoài sổ</GridBtn>
            </GridToolbar>
            <div className="px-[var(--gutter)] py-[var(--sp-5)] text-[var(--fs-sm)] text-[var(--ink-2)]">
              <b>Chưa chia đợt</b> — hiểu là giao một lần vào hạn giao của đơn. Đơn chưa
              gửi nhà cung cấp nên chưa ghi lịch được; bấm <b>Gửi Giám đốc duyệt</b> rồi{' '}
              <b>Gửi NCC</b> trước.
            </div>
            <div className="px-[var(--gutter)] pb-[var(--sp-5)]">
              <div className="k-fgrp-h">Chứng từ kho · 0 phiếu</div>
              <p className="text-[var(--fs-sm)] text-[var(--ink-2)]">
                Chưa có phiếu nhập hay xuất trả nào ghi vào đơn này.
              </p>
            </div>
          </>
        )}

        {tab === 'dieu-khoan' && (
          <div className="k-cq px-[var(--gutter)] py-[var(--sp-4)]">
            <FieldGrid note={<>Năm điều khoản này in nguyên văn lên phiếu gửi NCC.</>}>
              <Field label="Chất lượng">As confirmed samples (theo mẫu đã duyệt)</Field>
              <Field label="Nơi giao">Cảng đi Shanghai — cảng đến Quy Nhơn</Field>
              <Field label="Thời gian giao">Ba đến bốn tuần sau khi ký hợp đồng</Field>
              <Field label="Thanh toán">TTR — đặt cọc 20%, 80% còn lại khi có B/L</Field>
              <Field label="Hoá đơn">Commercial Invoice · Packing List</Field>
              <Field label="Người ký" inherited>
                NGƯỜI LẬP
              </Field>
            </FieldGrid>
          </div>
        )}

        {tab === 'thoi-gian' && (
          <div className="k-cq px-[var(--gutter)] py-[var(--sp-4)]">
            <Timeline marks={MARKS} />
          </div>
        )}

        {/*
          TRAO ĐỔI LUÔN HIỆN Ở ĐÁY — Odoo đặt chatter ngoài notebook có chủ ý:
          nó không phải "một phần nữa của tờ đơn", nó là chỗ con người nói
          chuyện về tờ đơn. Gấp nó lại là quay về Zalo.
        */}
        <div className="border-t-2 border-[var(--line)] px-[var(--gutter)] py-[var(--sp-4)]">
          <div className="k-fgrp-h">Trao đổi</div>
          <NoteComposer
            partnerLabel="Gửi Taizhou Xu-Dan"
            onSubmit={() => {
              /* mẫu — không gửi đi đâu */
            }}
          />
          <div className="mt-[var(--sp-3)]">
            <Followers
              names={['Đặng Thị Thanh Nga', 'Nguyễn Văn A']}
              muted={false}
              onToggle={() => {
                /* mẫu */
              }}
            />
          </div>
          <NoteStream rows={STREAM} now={new Date('2026-09-11T09:00:00')} />
        </div>
      </div>

      <StatusBar
        left={[
          <>
            <b>Đặng Thị Thanh Nga</b> · Mua hàng
          </>,
          <>Nháp — chưa gửi duyệt</>,
        ]}
        right={`${LINES.length} dòng · ${money(TIEN_HANG)} USD`}
      />
    </DocScreen>
  )
}
