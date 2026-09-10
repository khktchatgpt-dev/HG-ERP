'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Grid,
  GridBody,
  GridBtn,
  GridHead,
  GridRow,
  GridSep,
  GridToolbar,
  HolderBar,
  Menu,
  Num,
  Pick,
  Row,
  SearchInput,
  SmartLinks,
  StatusBar,
  StatusTrack,
  Table,
  THead,
  Tag,
  Td,
  Th,
  WorkTile,
  WorkTiles,
} from '@/components/kit'

/**
 * MỘT MÀN ĐA NĂNG — CẢ PHÒNG CUNG ỨNG TRONG MỘT KHUNG.
 *
 * Chép **Flexible Column Layout** của SAP Fiori 3, cộng cách Odoo cho một
 * "action" đổi nhiều view, cộng khay dữ kiện đổi theo lựa chọn của Dynamics.
 *
 * ─ Vì sao khuôn này, không phải 12 trang ──────────────────────────────────
 *
 * Bản đang chạy có 12 trang. Mỗi lần người mua đi từ danh sách vào một đơn là
 * MẤT CHỖ ĐỨNG: mất bộ lọc vừa đặt, mất vị trí cuộn, quay ra phải tìm lại
 * đúng dòng vừa xem. Với việc "rà 68 đơn tìm cái cần động vào" — đúng việc
 * chiếm phần lớn một ngày — thì mất chỗ đứng đắt hơn màn chi tiết rộng.
 *
 * Fiori giải bằng CỘT co giãn: danh sách bên trái không bao giờ biến mất, chi
 * tiết mở ra bên cạnh nó, chi tiết-của-chi-tiết mở thêm cột thứ ba. Người dùng
 * không "đi" đâu cả.
 *
 * ─ Bốn trạng thái của khung ───────────────────────────────────────────────
 *
 *   chưa chọn gì   │ danh sách │ BÀN LÀM VIỆC              │        │
 *   chọn một đơn   │ danh sách │ chứng từ                  │        │
 *   chọn một dòng  │ danh sách │ chứng từ                  │ dòng   │
 *   bấm mở rộng    │           │ chứng từ toàn khung       │        │
 *
 * Bàn làm việc KHÔNG phải một trang riêng — nó là **trạng thái rỗng** của cột
 * chứng từ. Chưa chọn gì thì hỏi "hôm nay làm gì"; chọn rồi thì hỏi "tờ này
 * vướng gì". Cùng một chỗ trên màn, vì cùng một câu hỏi nối tiếp nhau.
 *
 * ─ Luật phân bổ tính năng (thứ đáng chép nhất) ────────────────────────────
 *
 * Hỏi "hành động này tác động lên CÁI GÌ", rồi đặt nó cạnh cái đó:
 *
 *   tác động lên NHIỀU bản ghi  → thanh cột 1, chỉ hiện khi có chọn nhiều
 *   tác động lên MỘT bản ghi    → thanh cột 2
 *   tác động lên MỘT DÒNG       → thanh cột 3
 *   chỉ để TRA CỨU              → cột 3, không bao giờ là một trang riêng
 *
 * Luật này thay cho câu hỏi cũ "nút này nên nằm ở trang nào" — câu hỏi cũ
 * không có đáp án đúng, nên mỗi lần lại trả lời khác.
 *
 * ─ Đổi ĐỐI TƯỢNG, không đổi màn ───────────────────────────────────────────
 *
 * Bộ chọn ở góc trái đổi danh sách sang Nhà cung cấp / Vật tư / Tồn. Khung
 * giữ nguyên, chỉ nội dung ba cột đổi. Đây là chỗ Odoo làm gọn nhất: một khung
 * cho mọi đối tượng, thay vì mỗi đối tượng một trang có bố cục riêng.
 */

/* ── Dữ liệu mẫu ──────────────────────────────────────────────────────── */

type Don = {
  id: string
  code: string
  ncc: string
  lsx: string
  trangThai: string
  buoc: number
  hen: string | null
  tien: number
  cuaToi: boolean
  treHen: boolean
}

const DON: Don[] = [
  { id: 'd1', code: 'PO-2026-0065', ncc: 'Taizhou Xu-Dan', lsx: '08/26-27 - MX', trangThai: 'Nháp', buoc: 0, hen: null, tien: 16830.9, cuaToi: true, treHen: false }, // prettier-ignore
  { id: 'd2', code: 'PO-2026-0064', ncc: 'Cơ khí Thành Đạt', lsx: '08/26-27 - MX', trangThai: 'Chờ duyệt', buoc: 1, hen: '18/09/2026', tien: 42500000, cuaToi: true, treHen: false }, // prettier-ignore
  { id: 'd3', code: 'PO-2026-0061', ncc: 'Nam Kim', lsx: '07/26-27 - MX', trangThai: 'Đã gửi', buoc: 3, hen: '05/09/2026', tien: 128400000, cuaToi: true, treHen: true }, // prettier-ignore
  { id: 'd4', code: 'PO-2026-0058', ncc: 'Bao bì Tân Á', lsx: '07/26-27 - MX', trangThai: 'Đang giao', buoc: 5, hen: '12/09/2026', tien: 18900000, cuaToi: false, treHen: false }, // prettier-ignore
  { id: 'd5', code: 'PO-2026-0055', ncc: 'Nam Kim', lsx: '06/26-27 - MX', trangThai: 'Về một phần', buoc: 5, hen: '02/09/2026', tien: 76200000, cuaToi: true, treHen: true }, // prettier-ignore
  { id: 'd6', code: 'PO-2026-0052', ncc: 'Sơn Đại Việt', lsx: 'ngoài LSX', trangThai: 'Đã duyệt', buoc: 2, hen: null, tien: 9350000, cuaToi: true, treHen: false }, // prettier-ignore
  { id: 'd7', code: 'PO-2026-0049', ncc: 'Cơ khí Thành Đạt', lsx: '06/26-27 - MX', trangThai: 'Về đủ', buoc: 5, hen: '28/08/2026', tien: 51000000, cuaToi: false, treHen: false }, // prettier-ignore
]

type DongHang = { code: string; ten: string; dvt: string; sl: number; gia: number; ve: number } // prettier-ignore

const DONG: Record<string, DongHang[]> = {
  d1: [
    { code: 'KIM0161', ten: 'Kính sơn màu 625x399x5mm — Dark grey', dvt: 'Tấm', sl: 1350, gia: 2.15, ve: 0 }, // prettier-ignore
    { code: 'KIM0162', ten: 'Kính sơn màu 625x399x5mm — Dolphin grey', dvt: 'Tấm', sl: 600, gia: 2.15, ve: 0 }, // prettier-ignore
    { code: 'KIM0163', ten: 'Kính sơn màu 748x833x5mm — Dark grey', dvt: 'Tấm', sl: 100, gia: 5.36, ve: 0 }, // prettier-ignore
  ],
  d3: [
    { code: 'NH-0029', ten: 'Nhôm hộp 15x35x1li', dvt: 'Cây', sl: 120, gia: 102000, ve: 80 }, // prettier-ignore
    { code: 'NH-0009', ten: 'Nhôm hộp 20x40x1li', dvt: 'Cây', sl: 300, gia: 108000, ve: 300 }, // prettier-ignore
  ],
  d5: [
    { code: 'NH-0078', ten: 'Nhôm hộp 15x25x1li', dvt: 'Cây', sl: 200, gia: 94000, ve: 140 }, // prettier-ignore
  ],
}

type Ncc = { id: string; ten: string; ma: string; dungHen: string; donMo: number; no: number } // prettier-ignore
const NCC: Ncc[] = [
  { id: 'n1', ten: 'Taizhou Xu-Dan Home Technology', ma: 'TXD', dungHen: 'chưa có lịch sử', donMo: 2, no: 0 }, // prettier-ignore
  { id: 'n2', ten: 'Cơ khí Thành Đạt', ma: 'CKTD', dungHen: '11/12 đơn', donMo: 3, no: 42500000 }, // prettier-ignore
  { id: 'n3', ten: 'Nam Kim', ma: 'NK', dungHen: '6/9 đơn', donMo: 5, no: 204600000 }, // prettier-ignore
  { id: 'n4', ten: 'Bao bì Tân Á', ma: 'BBTA', dungHen: '8/8 đơn', donMo: 1, no: 18900000 }, // prettier-ignore
]

const BUOC = ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi', 'NCC nhận', 'Đang giao']
const tien = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/* ── Màn ──────────────────────────────────────────────────────────────── */

export default function Page() {
  const [doiTuong, setDoiTuong] = useState<'don' | 'ncc'>('don')
  const [loc, setLoc] = useState<'tat-ca' | 'cua-toi' | 'tre-hen'>('tat-ca')
  const [sel, setSel] = useState<string | null>(null)
  const [dong, setDong] = useState<number | null>(null)
  const [rong, setRong] = useState(false)
  const [tick, setTick] = useState<string[]>([])

  const donHien = DON.filter(
    (d) => loc === 'tat-ca' || (loc === 'cua-toi' ? d.cuaToi : d.treHen),
  )
  const don = DON.find((d) => d.id === sel) ?? null
  const ncc = NCC.find((n) => n.id === sel) ?? null
  const dongCua = don ? (DONG[don.id] ?? []) : []
  const dongChon = dong != null ? (dongCua[dong] ?? null) : null

  /* Bố cục ba cột co giãn — đây là toàn bộ "phép thuật" của khuôn này. */
  const cot = rong
    ? '0px 1fr'
    : dongChon
      ? 'minmax(260px,320px) 1fr minmax(240px,300px)'
      : 'minmax(280px,360px) 1fr'

  function chonDon(id: string) {
    setSel((cu) => (cu === id ? null : id))
    setDong(null)
    setRong(false)
  }

  return (
    <div className="kit kit-dense flex h-dvh flex-col overflow-hidden">
      {/* ── THANH TRÊN: đổi đối tượng · khung nhìn · tìm ─────────────── */}
      <div className="flex flex-wrap items-center gap-[var(--sp-4)] border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[var(--sp-3)]">
        <span className="font-bold tracking-[.11em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
          Mua hàng
        </span>
        {/*
          BỘ CHỌN ĐỐI TƯỢNG — đổi cái đang xem, KHÔNG đổi màn. Chỗ này thay
          cho năm mục điều hướng bên trái của bản đang chạy.
        */}
        <Pick
          label="Đối tượng"
          width={190}
          value={doiTuong}
          onChange={(v) => {
            setDoiTuong(v as 'don' | 'ncc')
            setSel(null)
            setDong(null)
          }}
          options={[
            { value: 'don', label: 'Đơn mua' },
            { value: 'ncc', label: 'Nhà cung cấp' },
            { value: 'vt', label: 'Vật tư — chưa dựng', disabled: true },
            { value: 'ton', label: 'Tồn & cân đối — chưa dựng', disabled: true },
          ]}
        />
        <Pick
          label="Khung nhìn"
          width={210}
          value="toi"
          onChange={() => {}}
          options={[
            { value: 'toi', label: 'Đơn của tôi · quá hẹn' },
            { value: 'tuan', label: 'Hàng về tuần này' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
        <SearchInput
          value=""
          onChange={() => {}}
          placeholder="Số PO, NCC, mã vật tư…"
          width={240}
        />
        <span className="ml-auto flex items-center gap-[var(--sp-2)]">
          <Btn>Hộp thư việc · 3</Btn>
          <Btn primary>+ Soạn đơn</Btn>
        </span>
      </div>

      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: cot }}>
        {/* ── CỘT 1 · DANH SÁCH ───────────────────────────────────────── */}
        <div
          className={`flex min-w-0 flex-col border-r border-[var(--line)] ${rong ? 'hidden' : ''}`}
        >
          <FilterBar>
            <Chip
              on={loc === 'tat-ca'}
              count={DON.length}
              onClick={() => setLoc('tat-ca')}
            >
              Tất cả
            </Chip>
            <Chip
              on={loc === 'cua-toi'}
              count={DON.filter((d) => d.cuaToi).length}
              onClick={() => setLoc('cua-toi')}
            >
              Của tôi
            </Chip>
            <Chip
              on={loc === 'tre-hen'}
              count={DON.filter((d) => d.treHen).length}
              onClick={() => setLoc('tre-hen')}
            >
              NCC trễ hẹn
            </Chip>
          </FilterBar>

          {/*
            HÀNH ĐỘNG HÀNG LOẠT — chỉ hiện khi có tích chọn, và chỉ ở cột này.
            Luật: hành động tác động lên NHIỀU bản ghi thì sống cạnh danh sách.
          */}
          {tick.length > 0 && (
            <div className="flex flex-wrap items-center gap-[var(--sp-2)] border-b border-[var(--line)] bg-[var(--act-wash)] px-[var(--gutter)] py-[var(--sp-3)] text-[var(--fs-sm)]">
              <b className="num">{tick.length} đơn</b>
              <Btn primary>Gửi duyệt</Btn>
              <Btn>Xuất Excel</Btn>
              <Btn onClick={() => setTick([])}>Bỏ chọn</Btn>
            </div>
          )}

          {doiTuong === 'don' ? (
            <Table>
              <THead>
                <th style={{ width: 26 }} />
                <th>Đơn</th>
                <th>Nhà cung cấp</th>
                <th style={{ textAlign: 'right' }}>Giá trị</th>
              </THead>
              <tbody>
                {donHien.map((d) => (
                  <Row key={d.id} selected={sel === d.id} onClick={() => chonDon(d.id)}>
                    <Cell>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${d.code}`}
                        checked={tick.includes(d.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() =>
                          setTick((t) =>
                            t.includes(d.id) ? t.filter((x) => x !== d.id) : [...t, d.id],
                          )
                        }
                      />
                    </Cell>
                    <Cell>
                      <Code>{d.code}</Code>
                      <span className="mt-[var(--sp-1)] block text-[11px] text-[var(--ink-3)]">
                        {d.trangThai}
                        {d.treHen && <span className="k-t-stop"> · trễ hẹn</span>}
                      </span>
                    </Cell>
                    <Cell grow muted>
                      {d.ncc}
                    </Cell>
                    <Cell num>
                      <Num value={tien(d.tien)} />
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          ) : (
            <Table>
              <THead>
                <th>Nhà cung cấp</th>
                <th style={{ textAlign: 'right' }}>Đơn mở</th>
              </THead>
              <tbody>
                {NCC.map((n) => (
                  <Row
                    key={n.id}
                    selected={sel === n.id}
                    onClick={() => setSel(sel === n.id ? null : n.id)}
                  >
                    <Cell grow>
                      <b>{n.ten}</b>
                      <span className="mt-[var(--sp-1)] block text-[11px] text-[var(--ink-3)]">
                        Giao đúng hẹn {n.dungHen}
                      </span>
                    </Cell>
                    <Cell num>
                      <Num value={String(n.donMo)} />
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
        </div>

        {/* ── CỘT 2 · CHỨNG TỪ, hoặc BÀN LÀM VIỆC khi chưa chọn ──────── */}
        <div className="flex min-w-0 flex-col overflow-auto bg-[var(--surface-card)]">
          {doiTuong === 'ncc' && ncc ? (
            <HoSoNcc ncc={ncc} />
          ) : don ? (
            <ChungTu
              don={don}
              dongCua={dongCua}
              dong={dong}
              onDong={setDong}
              rong={rong}
              onRong={() => setRong((r) => !r)}
              onDong2={() => setSel(null)}
            />
          ) : (
            <BanLamViec onLoc={setLoc} loc={loc} />
          )}
        </div>

        {/* ── CỘT 3 · NGỮ CẢNH — chi tiết dòng đang chọn ──────────────── */}
        {dongChon && !rong && (
          <div className="flex min-w-0 flex-col overflow-auto border-l border-[var(--line)] bg-[var(--surface-raised)]">
            <div className="border-b border-[var(--line)] px-[var(--gutter)] py-[var(--sp-3)]">
              <div className="font-bold tracking-[.09em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                Dòng {(dong ?? 0) + 1}
              </div>
              <div className="num text-[13px] font-bold text-[var(--act-text)]">
                {dongChon.code}
              </div>
            </div>
            <div className="flex flex-col gap-[var(--sp-3)] px-[var(--gutter)] py-[var(--sp-4)] text-[var(--fs-sm)]">
              <Kv k="Tên vật tư" v={dongChon.ten} />
              <Kv k="SL đặt" v={`${tien(dongChon.sl)} ${dongChon.dvt}`} />
              <Kv k="Đã về" v={`${tien(dongChon.ve)} ${dongChon.dvt}`} />
              <Kv
                k="Còn thiếu"
                v={`${tien(dongChon.sl - dongChon.ve)} ${dongChon.dvt}`}
                tone={dongChon.sl - dongChon.ve > 0 ? 'stop' : undefined}
              />
              <Kv k="Đơn giá" v={tien(dongChon.gia)} />
              <Kv k="Thành tiền" v={tien(dongChon.sl * dongChon.gia)} />
            </div>
            {/*
              HÀNH ĐỘNG TRÊN MỘT DÒNG — sống ở cột 3, cạnh chính cái dòng đó.
              Bản đang chạy đặt chúng trên thanh chung, nên người dùng phải
              nhớ "chọn dòng trước rồi mới bấm nút ở trên kia".
            */}
            <div className="mt-auto flex flex-wrap gap-[var(--sp-2)] border-t border-[var(--line)] px-[var(--gutter)] py-[var(--sp-3)]">
              <Btn>Chốt phần thiếu</Btn>
              <Btn>Lịch sử giá</Btn>
              <Btn>Mở hồ sơ vật tư</Btn>
            </div>
          </div>
        )}
      </div>

      <StatusBar
        left={[
          <>
            <b>Đặng Thị Thanh Nga</b> · Mua hàng
          </>,
          <>
            {don ? `Đang xem ${don.code}` : ncc ? `Đang xem ${ncc.ten}` : 'Chưa chọn gì'}
            {dongChon ? ` · dòng ${(dong ?? 0) + 1}` : ''}
          </>,
        ]}
        right={`${donHien.length} / ${DON.length} đơn`}
      />
    </div>
  )
}

/* ── Bàn làm việc = TRẠNG THÁI RỖNG của cột chứng từ ──────────────────── */

function BanLamViec({
  loc,
  onLoc,
}: {
  loc: string
  onLoc: (v: 'tat-ca' | 'cua-toi' | 'tre-hen') => void
}) {
  return (
    <div className="px-[var(--gutter)] py-[var(--sp-6)]">
      <h2 className="text-[15px] font-semibold">Hôm nay bạn cần động vào ba việc</h2>
      <p className="mt-[var(--sp-1)] text-[var(--fs-sm)] text-[var(--ink-2)]">
        Bấm một ô để lọc danh sách bên trái. Bấm một đơn để mở tờ đơn ngay tại đây — danh
        sách không mất đi.
      </p>
      <div className="mt-[var(--sp-5)]">
        {/*
          Ô VIỆC LÀ BỘ LỌC, KHÔNG PHẢI LINK. Đây là khác biệt với bản đang
          chạy: ở đó mọi ô bắn người dùng sang trang khác, nên bàn làm việc
          là bệ phóng chứ không phải chỗ làm việc.
        */}
        <WorkTiles>
          <WorkTile
            strong
            on={loc === 'tre-hen'}
            label="NCC trễ hẹn"
            count={2}
            hint="Gọi giục · đơn tôi phụ trách"
            tone="stop"
            onClick={() => onLoc('tre-hen')}
          />
          <WorkTile
            on={loc === 'cua-toi'}
            label="Việc của tôi"
            count={5}
            hint="Đơn tôi đang phụ trách"
            tone="warn"
            onClick={() => onLoc('cua-toi')}
          />
          <WorkTile
            on={loc === 'tat-ca'}
            label="Cả sổ đơn"
            count={7}
            hint="Mọi đơn còn mở"
            onClick={() => onLoc('tat-ca')}
          />
        </WorkTiles>
      </div>
      <div className="mt-[var(--sp-6)] border-t border-[var(--hair)] pt-[var(--sp-4)]">
        <Empty
          headline="Chưa chọn đơn nào"
          reason="Cột này là chỗ tờ đơn mở ra. Chọn một đơn ở danh sách bên trái để xem và xử lý ngay tại đây."
          next={<span className="text-[var(--fs-sm)] text-[var(--ink-3)]">↖ chọn một dòng</span>} // prettier-ignore
        />
      </div>
    </div>
  )
}

/* ── Cột 2 khi đối tượng là ĐƠN MUA ──────────────────────────────────── */

function ChungTu({
  don,
  dongCua,
  dong,
  onDong,
  rong,
  onRong,
  onDong2,
}: {
  don: Don
  dongCua: DongHang[]
  dong: number | null
  onDong: (i: number | null) => void
  rong: boolean
  onRong: () => void
  onDong2: () => void
}) {
  const tongTien = dongCua.reduce((s, l) => s + l.sl * l.gia, 0)
  return (
    <>
      {/* Thanh hành động của MỘT bản ghi — luật phân bổ, cột 2 */}
      <div className="flex flex-wrap items-center gap-[var(--sp-2)] border-b border-[var(--line)] px-[var(--gutter)] py-[var(--sp-3)]">
        <Btn primary>{don.buoc === 0 ? 'Gửi Giám đốc duyệt' : 'Ghi việc đã giục'}</Btn>
        <Btn>Sửa</Btn>
        <Btn>In phiếu</Btn>
        <Menu
          label="Thao tác ▾"
          items={[
            { label: 'Nhân bản' },
            { label: 'Đổi hẹn giao' },
            { label: 'Bàn giao người phụ trách' },
            { label: 'Huỷ đơn', danger: true },
          ]}
        />
        <span className="ml-auto flex items-center gap-[var(--sp-2)]">
          <Btn onClick={onRong}>{rong ? '⤡ Thu lại' : '⤢ Mở rộng'}</Btn>
          <Btn onClick={onDong2}>✕</Btn>
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-[var(--sp-5)] px-[var(--gutter)] pt-[var(--sp-4)]">
        <h1 className="num m-0 text-[20px] leading-tight font-bold">{don.code}</h1>
        <span className="text-[var(--fs-sm)] text-[var(--ink-2)]">{don.ncc}</span>
        <span className="ml-auto">
          <StatusTrack label="Trạng thái" steps={BUOC} at={don.buoc} />
        </span>
      </div>

      <div className="mt-[var(--sp-3)]">
        <SmartLinks
          items={[
            { label: 'dòng hàng', count: dongCua.length },
            { label: 'đợt giao', count: don.buoc >= 4 ? 2 : 0 },
            { label: 'phiếu kho', count: don.buoc >= 5 ? 1 : 0 },
            { label: 'trao đổi', count: 1 },
          ]}
        />
      </div>

      {don.treHen && (
        <HolderBar
          who={don.ncc}
          what={`Hẹn giao ${don.hen} đã qua — chưa thấy hàng`}
          age="6 ngày"
        />
      )}

      <GridToolbar count={`${dongCua.length} dòng`}>
        <GridBtn>Chỉnh sửa vật tư</GridBtn>
        <GridBtn>Dán từ Excel</GridBtn>
        <GridSep />
        <GridBtn>Giao &amp; nhận hàng</GridBtn>
      </GridToolbar>

      {dongCua.length === 0 ? (
        <p className="px-[var(--gutter)] py-[var(--sp-5)] text-[var(--fs-sm)] text-[var(--ink-2)]">
          Đơn mẫu này chưa khai dòng hàng.
        </p>
      ) : (
        <Grid minWidth={520}>
          <GridHead>
            <Th width={30}>#</Th>
            <Th>Mã · tên vật tư</Th>
            <Th width={48}>ĐVT</Th>
            <Th num>SL đặt</Th>
            <Th num>Đã về</Th>
            <Th num>Thành tiền</Th>
          </GridHead>
          <GridBody>
            {dongCua.map((l, i) => (
              <GridRow
                key={l.code}
                selected={dong === i}
                onClick={() => onDong(dong === i ? null : i)}
              >
                <Td num>{i + 1}</Td>
                <Td>
                  <span className="num k-strong">{l.code}</span> · {l.ten}
                </Td>
                <Td>{l.dvt}</Td>
                <Td num>{tien(l.sl)}</Td>
                <Td num tone={l.ve < l.sl ? 'warn' : 'done'}>
                  {tien(l.ve)}
                </Td>
                <Td num>{tien(l.sl * l.gia)}</Td>
              </GridRow>
            ))}
          </GridBody>
        </Grid>
      )}

      <div className="flex justify-end gap-[var(--sp-7)] border-b border-[var(--line)] px-[var(--gutter)] py-[var(--sp-3)] text-[var(--fs-sm)]">
        <span>
          Tổng thanh toán <b className="num text-[var(--fs-num-lg)]">{tien(tongTien)}</b>
        </span>
      </div>

      <p className="px-[var(--gutter)] py-[var(--sp-4)] text-[var(--fs-sm)] text-[var(--ink-3)]">
        Bấm một dòng để mở cột thứ ba — chi tiết dòng và các hành động của riêng dòng đó.
      </p>
    </>
  )
}

/* ── Cột 2 khi đối tượng là NHÀ CUNG CẤP — cùng khung, khác nội dung ──── */

function HoSoNcc({ ncc }: { ncc: Ncc }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-[var(--sp-2)] border-b border-[var(--line)] px-[var(--gutter)] py-[var(--sp-3)]">
        <Btn primary>+ Soạn đơn cho NCC này</Btn>
        <Btn>Sửa hồ sơ</Btn>
        <Menu
          label="Thao tác ▾"
          items={[{ label: 'Bảng giá' }, { label: 'Ngưng giao dịch', danger: true }]}
        />{' '}
        {/* prettier-ignore */}
      </div>
      <div className="px-[var(--gutter)] pt-[var(--sp-4)]">
        <h1 className="m-0 text-[20px] leading-tight font-bold">{ncc.ten}</h1>
        <span className="num text-[var(--fs-sm)] text-[var(--ink-2)]">{ncc.ma}</span>
      </div>
      {/*
        HỒ SƠ DANH MỤC KHÔNG CÓ VÒNG ĐỜI DUYỆT — chỗ của trục trạng thái ở đây
        là DẢI HIỆU SUẤT, mỗi ô kèm mẫu số. Cùng một khung ba cột, nhưng cột 2
        đổi hình theo loại đối tượng.
      */}
      <div className="mt-[var(--sp-4)] flex flex-wrap gap-[var(--sp-7)] border-y border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-[var(--sp-4)] text-[var(--fs-sm)]">
        <span>
          Giao đúng hẹn <b>{ncc.dungHen}</b>
        </span>
        <span>
          Đơn còn mở <b className="num">{ncc.donMo}</b>
        </span>
        <span>
          Còn nợ <b className="num">{tien(ncc.no)}</b>
        </span>
      </div>
      <div className="px-[var(--gutter)] py-[var(--sp-4)]">
        <div className="k-fgrp-h">Đơn mua của nhà cung cấp này</div>
        <Grid minWidth={420}>
          <GridHead>
            <Th>Đơn</Th>
            <Th>Trạng thái</Th>
            <Th num>Giá trị</Th>
          </GridHead>
          <GridBody>
            {DON.filter((d) => d.ncc.startsWith(ncc.ten.split(' ')[0])).map((d) => (
              <GridRow key={d.id}>
                <Td>
                  <span className="num k-strong">{d.code}</span>
                </Td>
                <Td>
                  <Tag tone={d.treHen ? 'stop' : 'neutral'}>{d.trangThai}</Tag>
                </Td>
                <Td num>{tien(d.tien)}</Td>
              </GridRow>
            ))}
          </GridBody>
        </Grid>
      </div>
    </>
  )
}

function Kv({ k, v, tone }: { k: string; v: string; tone?: 'stop' }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[.06em] text-[var(--ink-3)] uppercase">
        {k}
      </div>
      <div
        className={`num text-[13px] ${tone === 'stop' ? 'k-t-stop font-semibold' : ''}`}
      >
        {v}
      </div>
    </div>
  )
}
