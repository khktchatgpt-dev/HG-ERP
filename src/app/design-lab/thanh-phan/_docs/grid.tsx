'use client'

import { useState } from 'react'
import {
  CellHint,
  Grid,
  GridBody,
  GridBtn,
  GridCheck,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  GridToolbar,
  Td,
  Th,
  useKitTable,
  type KitCol,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `Grid` — lưới dòng NẰM TRONG khối (FastTab, hộp thoại), B7 24/09/2026.
 *
 * Hai kiểu dựng: GHÉP TAY (GridHead/GridRow/Td — khi ô có ô tick, gợi ý, tô
 * màu từng ô) và MÁY (`engine` từ `useKitTable` — khi cần sắp xếp, ẩn cột).
 * B7 ghi hai chỗ yếu ở mục 5: dòng bấm được không đi được bằng bàn phím, và
 * `GridBtn` bị khoá dùng kiểu mờ 50% mà `Action` đã bỏ. Cả hai đã sửa ở B7½
 * (24/09/2026); mục 4–5 nay tả hành vi sau khi sửa.
 */

type Dong = { ma: string; ten: string; dvt: string; sl: number; gia: number | null }
const DONG: Dong[] = [
  { ma: 'CN1527', ten: 'Vít dù 4×12, 7 màu', dvt: 'con', sl: 1400, gia: 264 },
  { ma: 'NK-0056', ten: 'Vít 4×12 đầu bằng ren gỗ', dvt: 'con', sl: 800, gia: null },
  { ma: 'ONG-2540', ten: 'Ống sắt 25×40×1,2 dài 6m', dvt: 'cây', sl: 36, gia: 185000 },
]
const vnd = (n: number) => n.toLocaleString('vi-VN')

function GhepTay() {
  const [chon, setChon] = useState<string[]>(['CN1527'])
  const [sl, setSl] = useState(1200)
  const lat = (ma: string) =>
    setChon((c) => (c.includes(ma) ? c.filter((x) => x !== ma) : [...c, ma]))
  const tong = DONG.reduce(
    (a, d) => a + (d.gia ?? 0) * (d.ma === 'CN1527' ? sl : d.sl),
    0,
  )
  return (
    <>
      <GridToolbar count={`${chon.length} / ${DONG.length} dòng đã chọn`}>
        <GridBtn>Thêm dòng</GridBtn>
        <GridBtn disabled={chon.length === 0} title="Chọn ít nhất một dòng">
          Sao chép dòng
        </GridBtn>
        <GridSep />
        <GridBtn disabled={chon.length === 0} title="Chọn ít nhất một dòng">
          Xoá dòng
        </GridBtn>
      </GridToolbar>
      <Grid minWidth={720}>
        <GridHead>
          <Th width={34}>
            <span className="sr-only">Chọn dòng</span>
          </Th>
          <Th width={40}>#</Th>
          <Th>Mã vật tư</Th>
          <Th>Tên vật tư</Th>
          <Th width={56}>ĐVT</Th>
          <Th num>SL đặt</Th>
          <Th num>Đơn giá</Th>
          <Th num>Thành tiền</Th>
        </GridHead>
        <GridBody>
          {DONG.map((d, i) => {
            const soLuong = d.ma === 'CN1527' ? sl : d.sl
            return (
              <GridRow key={d.ma} selected={chon.includes(d.ma)}>
                <GridCheck
                  checked={chon.includes(d.ma)}
                  onChange={() => lat(d.ma)}
                  label={`Chọn dòng ${d.ma}`}
                />
                <Td num>{i + 1}</Td>
                <Td>{d.ma}</Td>
                <Td>{d.ten}</Td>
                <Td>{d.dvt}</Td>
                <Td num>
                  {vnd(soLuong)}
                  {d.ma === 'CN1527' && soLuong !== 1400 && (
                    <CellHint
                      title="Định mức lệnh 06/26-27 - MX: 1.400 con"
                      onClick={() => setSl(1400)}
                    >
                      dùng 1.400 ↩
                    </CellHint>
                  )}
                  {d.ma === 'ONG-2540' && (
                    <CellHint tone="warn" title="Tồn kho còn 30 cây, lệnh cần 36">
                      vượt tồn 6 cây
                    </CellHint>
                  )}
                </Td>
                <Td num tone={d.gia == null ? 'warn' : undefined}>
                  {d.gia == null ? 'chưa có giá' : vnd(d.gia)}
                </Td>
                <Td num tone={d.gia == null ? 'warn' : undefined}>
                  {d.gia == null ? '—' : vnd(d.gia * soLuong)}
                </Td>
              </GridRow>
            )
          })}
        </GridBody>
        <GridFoot>
          <Td colSpan={7}>Cộng 3 dòng — chưa gồm dòng chưa có giá</Td>
          <Td num>{vnd(tong)}</Td>
        </GridFoot>
      </Grid>
    </>
  )
}

type Ncc = { id: string; ten: string; don: number; tre: number; chi: number }
const NCC: Ncc[] = [
  { id: 'td', ten: 'Cơ khí Thành Đạt', don: 9, tre: 1, chi: 412500000 },
  { id: 'ap', ten: 'Kim khí An Phát', don: 14, tre: 4, chi: 286300000 },
  { id: 'bm', ten: 'Sơn Bình Minh', don: 6, tre: 0, chi: 98750000 },
]
const COT: KitCol<Ncc>[] = [
  { id: 'ten', header: 'Nhà cung cấp', cell: (r) => r.ten, sort: (r) => r.ten },
  { id: 'don', header: 'Số đơn', cell: (r) => r.don, sort: (r) => r.don, num: true, width: 90, foot: 29 },
  { id: 'tre', header: 'Giao trễ', cell: (r) => r.tre, sort: (r) => r.tre, num: true, width: 90, tone: (r) => (r.tre > 2 ? 'warn' : undefined) },
  { id: 'chi', header: 'Tổng chi (₫)', cell: (r) => vnd(r.chi), sort: (r) => r.chi, num: true, foot: vnd(797550000) },
] // prettier-ignore

function KieuMay() {
  const [dang, setDang] = useState('ap')
  const t = useKitTable({
    rows: NCC,
    columns: COT,
    rowKey: (r) => r.id,
    initialSort: { id: 'chi', desc: true },
    foot: { label: 'Cộng', note: 'Chưa gồm đơn huỷ' },
  })
  return (
    <Grid
      engine={t}
      minWidth={520}
      onRowClick={(r) => setDang(r.id)}
      isSelected={(r) => r.id === dang}
    />
  )
}

export default function DocGrid() {
  return (
    <CompDoc
      family="grid"
      alsoImport={['useKitTable']}
      summary={
        <>
          Lưới dòng <b>nằm trong một khối</b> — trong <code>FastTab</code>, trong hộp
          thoại. Chỉ cuộn ngang, cao theo nội dung. Hai kiểu dựng: ghép tay từng ô, hoặc
          đưa <code>engine</code> của <code>useKitTable</code> để có sắp xếp, ẩn cột, chân
          bảng tự chia cột.
        </>
      }
      useWhen="các dòng của MỘT chứng từ (dòng đơn mua, chi tiết lệnh, đợt giao) nằm dưới đầu chứng từ, thường trong một FastTab."
      avoidWhen={
        <>
          bảng là nhân vật chính của cả màn và dài hàng trăm dòng (Khuôn C) — dùng{' '}
          <code>Table</code> trong <code>ScreenFrame</code>: nó tự cuộn dọc, ảo hoá, tiêu
          đề và chân tổng dính. Lưới nhập liệu kiểu Excel (Khuôn F) cũng không phải việc
          của <code>Grid</code>.
        </>
      }
      variants={[
        {
          name: 'Ghép tay — ô tick, gợi ý dưới ô, tô theo vòng đời',
          when: 'dòng chứng từ cần ô tick chọn, CellHint mời dùng số máy tính ra, và tô cảnh báo từng ô. Bấm “dùng 1.400 ↩” để thấy gợi ý tự biến mất.',
          demo: <GhepTay />,
        },
        {
          name: 'Kiểu máy — engine từ useKitTable',
          when: 'cần bấm tiêu đề để sắp, và chân bảng không phải tự đếm cột. Bấm một dòng để chọn nó — hoặc Tab tới dòng rồi Enter / Space.',
          demo: <KieuMay />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Tiêu đề nền xám nhạt chữ in hoa nhỏ, dính đầu khi cuộn; ô ngăn bằng vạch tóc; dòng chẵn sọc trắng-ngà.',
          behaves:
            'Rộng hơn khung thì cuộn ngang (vùng bọc overflow-x). Không cuộn dọc riêng.',
        },
        {
          state: 'Rê chuột trên dòng',
          looks: 'Dòng tô nền nhạt màu hành động — y hệt dòng đang chọn.',
          behaves:
            'Không đổi gì khác. Hai trạng thái trông giống nhau là cố ý của CSS hiện tại.',
        },
        {
          state: 'Dòng đang chọn',
          looks: 'Nền nhạt màu hành động (selected / isSelected).',
          behaves: 'Trang tự giữ dòng nào đang chọn; lưới chỉ tô.',
        },
        {
          state: 'Dòng bấm được (GridRow onClick / onRowClick)',
          looks:
            'Như dòng thường; khi tới bằng Tab thì có vòng 2px màu hành động quanh dòng (:focus-visible chung của .kit).',
          behaves:
            'tabIndex 0 — dòng nhận Tab; Enter hoặc Space gọi onClick (Space không cuộn trang). Phím gõ trong ô nhập NẰM TRONG dòng không bấm dòng. Dòng không có onClick không thành điểm dừng Tab. Sửa 24/09/2026 (B7½) — trước đó chỉ chọn được bằng chuột.',
        },
        {
          state: 'Ô cảnh báo (tone)',
          looks: 'Chữ màu vòng đời: --stop, --warn hoặc --done.',
          behaves: 'Chỉ mã hoá dữ liệu. Không bao giờ dùng để báo ô bấm được.',
        },
        {
          state: 'Cột sắp được (kiểu máy)',
          looks: 'Tiêu đề thành nút có mũi tên; mũi tên mờ khi chưa sắp.',
          behaves:
            'Bấm: tăng → giảm → bỏ. Cột không khai sort thì tiêu đề là chữ thường.',
        },
        {
          state: 'Nút thanh công cụ bị khoá',
          looks:
            'Nền xám đặc, viền nhạt, chữ --ink-3, con trỏ cấm — không làm mờ (cùng luật nút khoá của Action từ B7½, 24/09/2026).',
          behaves:
            'Vẫn là khoá CỨNG (disabled thật): không bấm được, không nhận Tab, lý do chỉ ở title khi rê chuột — KHÁC Action (khoá mềm, nói lý do tại chỗ).',
        },
        {
          state: 'Lệch cột chân bảng',
          looks: 'Không đổi gì trên màn.',
          behaves:
            'Bản dev ghi lỗi console “LỆCH CỘT CHÂN BẢNG: thead=…, tfoot=…” khi tổng cột (kể cả colSpan) của chân khác tiêu đề.',
        },
        {
          state: 'Mật độ dày (kiểu máy)',
          looks: 'Hàng 25px thay vì 30px.',
          behaves: 'Theo lựa chọn người xem (engine.density), nhớ trên máy họ.',
        },
      ]}
      a11y={{
        role: 'table (thẻ <table> thật: columnheader, row, cell)',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua nút thanh công cụ (trừ nút khoá), nút sắp cột, dòng bấm được, ô tick, nút gợi ý — theo thứ tự trong DOM.',
          },
          {
            key: 'Space',
            does: 'Tick / bỏ tick ô chọn dòng; trên dòng bấm được thì bấm dòng.',
          },
          {
            key: 'Enter',
            does: 'Bấm nút sắp cột, nút gợi ý (CellHint có onClick), dòng bấm được.',
          },
        ],
        reader: (
          <>
            Bảng thật nên trình đọc đọc được tên cột khi đi ô; cột sắp mang{' '}
            <code>aria-sort</code>; ô tick đọc theo <code>label</code> (“Chọn dòng
            CN1527”). Dòng có <code>onClick</code> / <code>onRowClick</code> nhận Tab và
            nghe Enter / Space (sửa 24/09/2026, B7½; test ở <code>erp.a11y.test.tsx</code>
            ). <b>Còn chưa tốt, ghi thật:</b> trình đọc vẫn không nghe được dòng “bấm
            được” — <code>&lt;tr&gt;</code> trong bảng thường không có vai cho điều đó,
            nên việc quan trọng nên có thêm một nút hay ô tick trong dòng;{' '}
            <code>GridBtn</code> bị khoá vẫn là <code>disabled</code> thật (nay nền xám
            đặc thay vì mờ), rơi khỏi thứ tự Tab và lý do chỉ nằm trong tooltip. Cột ô
            tick không có chữ thì phải tự đặt tên ẩn cho <code>Th</code> như ví dụ trên —
            kit không tự làm.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Dùng <code>Grid</code> cho lưới trong màn nghiệp vụ.
            </>
          ),
          dont: (
            <>
              Viết <code>&lt;table&gt;</code> trần, hoặc quay về <code>shadcn/table</code>{' '}
              cho màn kit.
            </>
          ),
          source:
            'luật lint hg/no-raw-control; chú thích mục 12 trong kit/Erp.tsx (commit 5862be6 — “mảng còn thiếu khiến màn thật không dựng lại được đúng mẫu”)',
        },
        {
          do: (
            <>
              Khai <code>minWidth</code> theo SỐ CỘT của chính lưới đó.
            </>
          ),
          dont: 'Đóng cứng một con số cho mọi lưới — lưới 14 cột luôn có cột cuối nằm ngoài tầm.',
          source: 'JSDoc của prop minWidth, kit/Erp.tsx',
        },
        {
          do: (
            <>
              Nhãn ô tick nói chọn DÒNG NÀO:{' '}
              <code>label=&quot;Chọn dòng CN1527&quot;</code>.
            </>
          ),
          dont: 'Một cột toàn ô tick không nhãn, hoặc cùng nhãn “Chọn”.',
          source: 'chú thích GridCheck, kit/Erp.tsx — label bắt buộc ở tầng kiểu',
        },
        {
          do: (
            <>
              <code>tone</code> chỉ cho dữ liệu: chưa có giá, thiếu hàng, đủ.
            </>
          ),
          dont: 'Tô --act hay --warn cho ô để báo “bấm được” hay “đang sửa”.',
          source: 'CLAUDE.md, nguyên tắc 5: một màu hành động, ba màu vòng đời',
        },
        {
          do: 'Chân bảng nói tổng KHÔNG gồm gì (“chưa gồm dòng chưa có giá”).',
          dont: 'Một con số tổng trần, người đọc không kiểm lại được.',
          source: 'CLAUDE.md, nguyên tắc 6: số nào không kiểm được thì không ai tin',
        },
      ]}
      tested={{ file: 'src/components/kit/table-engine.test.tsx' }}
    />
  )
}
