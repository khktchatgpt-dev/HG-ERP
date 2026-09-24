'use client'

import { Cell, DeltaNum, Row, Table, THead } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `DeltaNum` (B7, 24/09/2026).
 *
 * Bản đầu của trang ghi một lỗi đọc ra khi viết: `if (!value)` coi NaN như 0,
 * nên một phép trừ với dữ liệu thiếu hiện thành "đủ". Đã vá ở B7½ (24/09/2026):
 * `null`/NaN/±∞ nay là "?" mờ, đọc "chưa có số" — mục 4 bày trạng thái đó.
 */

const DONG = [
  { sp: 'FDA50089N', can: 400, dat: 100 },
  { sp: 'FDA50090N', can: 200, dat: 320 },
  { sp: 'FDA50112W', can: 150, dat: 150 },
]

export default function DocDeltaNum() {
  return (
    <CompDoc
      family="delta-num"
      summary={
        <>
          Số lệch theo đúng quy ước của file Excel xưởng: thiếu là <code>(300)</code>{' '}
          trong ngoặc màu dừng, dư là <code>+120</code> màu chờ — <b>dư cũng là vấn đề</b>
          , phôi thừa là tiền chết — và bằng là <code>—</code> mờ. Trình đọc màn hình nghe
          chữ (“thiếu 300 bộ”), không nghe dấu ngoặc. Không có số (<code>null</code>, NaN)
          là <code>?</code> mờ — không bao giờ trông hay đọc như “đủ”.
        </>
      }
      useWhen="cột “Thiếu / dư” của bảng đồng bộ, lệch kế hoạch – thực hiện, lệch tồn sổ – tồn đếm — mọi chỗ con số có DẤU mang nghĩa."
      avoidWhen={
        <>
          số lượng/tiền thường không có dấu (dùng <code>Num</code>); tăng/giảm so với kỳ
          trước, nơi tăng là tốt (DeltaNum luôn coi lệch là vấn đề, cả hai chiều).
        </>
      }
      variants={[
        {
          name: 'Ba nghĩa',
          when: 'âm = thiếu, dương = dư, 0 = đủ. Hình dạng (ngoặc, dấu cộng, gạch) mang nghĩa, màu chỉ đi kèm.',
          demo: (
            <div className="flex flex-wrap items-baseline gap-6">
              <DeltaNum value={-300} unit="bộ" />
              <DeltaNum value={120} unit="bộ" />
              <DeltaNum value={0} unit="bộ" />
              <DeltaNum value={-12_500} unit="con" />
            </div>
          ),
        },
        {
          name: 'Chưa có số — null / NaN',
          when: 'dữ liệu thiếu (chưa ai nhập cần hay đạt), hoặc phép trừ trên dữ liệu thiếu ra NaN. “?” mờ, khác hẳn “—” của đủ.',
          demo: (
            <div className="flex flex-wrap items-baseline gap-6">
              <DeltaNum value={null} unit="bộ" />
              <DeltaNum value={Number.NaN} unit="bộ" />
              <DeltaNum value={0} unit="bộ" />
            </div>
          ),
        },
        {
          name: 'Trong cột bảng',
          when: 'đơn vị nằm ở tiêu đề cột; ô chỉ in số — đơn vị vào câu cho trình đọc qua unit.',
          demo: (
            <Table inline label="Thiếu dư theo mã sản phẩm">
              <THead>
                <th>Mã SP</th>
                <th style={{ textAlign: 'right' }}>Cần (bộ)</th>
                <th style={{ textAlign: 'right' }}>Đạt (bộ)</th>
                <th style={{ textAlign: 'right' }}>Thiếu / dư</th>
              </THead>
              <tbody>
                {DONG.map((r) => (
                  <Row key={r.sp}>
                    <Cell rowHeader>
                      <b className="num">{r.sp}</b>
                    </Cell>
                    <Cell num>{r.can}</Cell>
                    <Cell num>{r.dat}</Cell>
                    <Cell num>
                      <DeltaNum value={r.dat - r.can} unit="bộ" />
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          ),
        },
      ]}
      states={[
        {
          state: 'Thiếu (âm)',
          looks: '(300) — chữ đậm màu --stop, chữ số đơn cách.',
          behaves: 'Trình đọc: “thiếu 300 bộ”.',
        },
        {
          state: 'Dư (dương)',
          looks: '+120 — chữ đậm màu --warn.',
          behaves: 'Trình đọc: “dư 120 bộ”.',
        },
        {
          state: 'Đủ (đúng bằng 0)',
          looks: '— mờ.',
          behaves: 'Trình đọc: “đủ”.',
        },
        {
          state: 'Chưa có số (null, NaN, ±∞)',
          looks: '? mờ — khác hình với “—” của đủ.',
          behaves:
            'Trình đọc: “chưa có số” (không kèm đơn vị), không bao giờ “đủ”. Sửa 24/09/2026 (B7½): trước đó điều kiện !value coi NaN như 0, ô thiếu dữ liệu hiện “—” và đọc là “đủ”.',
        },
      ]}
      a11y={{
        role: '(không có — đoạn chữ thường)',
        keys: [{ key: '—', does: 'Không nhận phím, không nhận focus.' }],
        reader: (
          <>
            Chữ hiện (<code>(300)</code>, <code>+120</code>, <code>—</code>) bị ẩn khỏi
            trình đọc; thay bằng chữ ẩn “thiếu 300 bộ” / “dư 120 bộ” / “đủ” — có test
            canh. Không có số thì <code>?</code> ẩn, chữ ẩn “chưa có số” — cũng có test.
            Đơn vị chỉ có trong chữ ẩn, mắt không thấy. <b>Lưu ý màu:</b> --stop và --warn
            gần như trùng nhau với người mù màu đỏ-lục (ΔE 0,9) — nghĩa được giữ bằng HÌNH
            (ngoặc vs dấu cộng), đừng bỏ hình mà chỉ giữ màu.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Truyền số có dấu vào <code>value</code>.
            </>
          ),
          dont: 'Tự in chuỗi "(300)": trình đọc nghe “300”, mất đúng cái nghĩa quan trọng nhất — thiếu.',
          source: 'chú thích DeltaNum (Viz.tsx); test “trình đọc nghe thiếu 300”',
        },
        {
          do: 'Coi dư là vấn đề, tô màu chờ như thành phần đã làm.',
          dont: 'Tô dư màu --done như thể là tin tốt — phôi thừa là tiền nằm chết.',
          source:
            'chú thích DeltaNum (Viz.tsx); quy ước file Excel xưởng ở docs/thong-ke-thiet-ke-tu-excel.md, bảng thành phần kit',
        },
        {
          do: 'Giữ hình ngoặc/dấu cộng làm tín hiệu chính.',
          dont: 'Dùng --stop và --warn làm tín hiệu DUY NHẤT.',
          source: 'bộ kiểm màu ở B6 — docs/he-thiet-ke-erp-ke-hoach.md §9.8 (ΔE 0,9)',
        },
        {
          do: (
            <>
              Dữ liệu thiếu thì truyền thẳng <code>null</code> — thành phần tự bày “?” và
              đọc “chưa có số”.
            </>
          ),
          dont: 'Thay dữ liệu thiếu bằng 0 cho “đỡ lỗi” — 0 là “đủ”, đúng lời hứa sai mà B7½ vừa gỡ ở nhánh NaN.',
          source:
            'chú thích DeltaNum (Viz.tsx), B7½ 24/09/2026; test “NaN / null: hiện ? mờ”',
        },
      ]}
      tested={{ file: 'src/components/kit/viz.test.tsx' }}
    />
  )
}
