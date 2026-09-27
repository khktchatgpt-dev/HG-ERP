'use client'

import { useState } from 'react'
import { BarLabel, BarSep, Btn, Chip, FilterBar, SearchInput } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — họ `FilterBar` (B7, 24/09/2026).
 *
 * Ví dụ đầu là đúng khuôn của màn Nhà cung cấp (`NccScreen`): ô tìm + chip đếm,
 * mỗi chip đếm bằng CHÍNH hàm lọc của nó. Bản đầu của trang ghi thật rằng
 * chưa test nào dựng ba thành phần này, `Chip` thiếu `type="button"` và ô tìm
 * không có tên riêng — cả ba đã vá ở B7½ (24/09/2026), test ở table.a11y.test.tsx.
 */

type Don = { ma: string; ncc: string; cua: 'toi' | 'khac'; tre: boolean; hen: boolean }
const DON: Don[] = [
  { ma: 'PO-2609-014', ncc: 'Cơ khí Thành Đạt', cua: 'toi', tre: false, hen: true },
  { ma: 'PO-2609-017', ncc: 'Minh Đạt', cua: 'toi', tre: true, hen: true },
  { ma: 'PO-2609-019', ncc: 'Nhựa sơn Tín Phát', cua: 'khac', tre: false, hen: false },
  { ma: 'PO-2609-021', ncc: 'Bao bì Đại Thắng', cua: 'toi', tre: false, hen: false },
  { ma: 'PO-2609-022', ncc: 'Gỗ Bình Minh', cua: 'khac', tre: true, hen: true },
]
const CHIPS: { id: string; label: string; icon?: 'toi' | 'quaHen' | 'hen'; test: (d: Don) => boolean }[] = [
  { id: 'all', label: 'Tất cả', test: () => true },
  { id: 'toi', label: 'Của tôi', icon: 'toi', test: (d) => d.cua === 'toi' },
  { id: 'tre', label: 'Quá hẹn', icon: 'quaHen', test: (d) => d.tre },
  { id: 'chuaHen', label: 'Chưa hẹn giao', icon: 'hen', test: (d) => !d.hen },
] // prettier-ignore

function ThanhLoc() {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')
  const khop = (d: Don) =>
    !q.trim() || `${d.ma} ${d.ncc}`.toLowerCase().includes(q.trim().toLowerCase())
  const test = CHIPS.find((c) => c.id === chip)!.test
  const con = DON.filter((d) => test(d) && khop(d))
  return (
    <div className="grid gap-2">
      <FilterBar>
        <SearchInput
          label="Tìm đơn mua"
          value={q}
          onChange={setQ}
          placeholder="Tìm mã đơn hoặc NCC…"
          width={240}
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            icon={c.icon}
            on={chip === c.id}
            // Đếm bằng ĐÚNG hàm lọc sẽ chạy khi bấm — cộng cả từ khoá đang gõ.
            count={DON.filter((d) => c.test(d) && khop(d)).length}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </Chip>
        ))}
      </FilterBar>
      <p className="text-k-sm text-[var(--ink-2)]">
        Còn {con.length} đơn: {con.map((d) => d.ma).join(', ') || '—'}
      </p>
    </div>
  )
}

function OTim() {
  const [q, setQ] = useState('ống thép 25')
  return (
    <SearchInput
      value={q}
      onChange={setQ}
      placeholder="Tìm tên, mã, mặt hàng hoặc mã số thuế…"
      width={300}
    />
  )
}

export default function DocFilterBar() {
  return (
    <CompDoc
      family="filter-bar"
      summary={
        <>
          Hàng lọc đứng trên bảng, <b>ngoài</b> vùng cuộn của bảng: ô tìm, các chip
          bật/tắt có số đếm, và nút chọn cột. Mỗi chip là một câu hỏi nghiệp vụ, và số
          trên chip là lời hứa — bấm vào phải ra đúng bấy nhiêu dòng.
        </>
      }
      useWhen="trên mọi bảng danh sách có từ hai cách cắt tập dữ liệu trở lên (của tôi, quá hẹn, chưa hẹn) hoặc cần tìm theo chữ."
      avoidWhen={
        <>
          lọc nhiều trường có điều kiện (khoảng ngày, nhiều NCC) — dồn vào một nút mở{' '}
          <code>Popover</code>; chuyển giữa các khung nhìn khác hẳn nhau (dùng tab); hay
          trạng thái vòng đời của một dòng (dùng <code>Tag</code> — chip là thứ bấm được).
        </>
      }
      variants={[
        {
          name: 'Ô tìm + chip đếm',
          when: 'khuôn của màn Nhà cung cấp. Gõ “minh” để thấy số trên chip đổi theo — chip đếm bằng chính hàm lọc, cộng cả từ khoá.',
          demo: <ThanhLoc />,
        },
        {
          name: 'Chip — số đếm lớn và số 0',
          when: 'số in nhóm nghìn kiểu Việt; 0 vẫn in “0” vì “rổ này trống” cũng là câu trả lời.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <Chip count={13_229}>Cả danh mục</Chip>
              <Chip on icon="toi" count={68}>
                Của tôi
              </Chip>
              <Chip icon="quaHen" count={0}>
                Quá hẹn
              </Chip>
            </div>
          ),
        },
        {
          name: 'Nhiều hàng lọc — dense + BarLabel + BarSep',
          when: 'màn xếp hai–ba hàng lọc chồng nhau (Đơn mua: người phụ trách · loại đơn). Nhãn nhóm và vạch ngăn là thành phần, không tự gõ chuỗi lớp.',
          demo: (
            <FilterBar dense label="Lọc đơn mua">
              <BarLabel>Loại đơn</BarLabel>
              <Chip on count={13}>
                Phụ kiện
              </Chip>
              <Chip count={3}>Carton</Chip>
              <BarSep />
              <Chip icon="hen" count={4}>
                Chưa hẹn giao
              </Chip>
            </FilterBar>
          ),
        },
        {
          name: 'Thanh hành động — tone raised / selected',
          when: 'hàng nút trên bảng chọn nhiều (Hộp ký): nền nổi khi chưa chọn gì, nền nhạt màu hành động khi ĐANG chọn phiếu.',
          demo: (
            <div className="grid gap-2">
              <FilterBar dense tone="raised">
                <span className="text-k-sm text-[var(--ink-3)]">Chưa chọn phiếu nào</span>
                <Btn icon="duyet" disabled>
                  Ký duyệt
                </Btn>
              </FilterBar>
              <FilterBar dense tone="selected">
                <span className="num text-k-sm font-semibold text-[var(--act-text)]">
                  3 phiếu đã chọn
                </span>
                <Btn primary icon="duyet">
                  Ký 3 phiếu
                </Btn>
              </FilterBar>
            </div>
          ),
        },
        {
          name: 'Ô tìm có chữ — không truyền label',
          when: 'nút ✕ hiện ngay trong ô khi có từ khoá — xoá từ khoá là thao tác lặp nhiều nhất sau khi gõ. Không có label thì tên ô là chính placeholder (ví dụ trên truyền label="Tìm đơn mua").',
          demo: <OTim />,
        },
      ]}
      states={[
        {
          state: 'Chip — mặc định',
          looks: 'Viền mảnh, nền thẻ, chữ phụ; số đếm chữ đơn cách, nhạt hơn một bậc.',
          behaves: 'Không tự giữ trạng thái — màn đổi on trong onClick.',
        },
        {
          state: 'Chip — rê chuột',
          looks: 'Viền đậm lên, chữ về mực chính.',
          behaves: '—',
        },
        {
          state: 'Chip — đang bật',
          looks: 'Nền nhạt màu hành động, viền và chữ màu hành động, chữ đậm.',
          behaves:
            'aria-pressed="true". Không có chip “tắt các chip khác” — màn tự lo nếu chỉ cho bật một.',
        },
        {
          state: 'Focus',
          looks:
            'Chip: vòng 2px màu hành động. Ô tìm: viền khung đổi sang màu hành động.',
          behaves: 'Tab theo thứ tự trong DOM: ô tìm → nút ✕ (nếu có chữ) → từng chip.',
        },
        {
          state: 'Ô tìm — có chữ',
          looks: 'Hiện nút ✕ ở cuối ô.',
          behaves: 'Bấm ✕ gọi onChange(""). onChange chạy ở MỖI phím, không giãn nhịp.',
        },
        {
          state: 'Hẹp',
          looks: 'Hàng lọc xuống dòng; chip không co, không gãy chữ.',
          behaves:
            'Không cuộn ngang — chip bị đẩy ra ngoài tầm nhìn là chip không ai bấm.',
        },
      ]}
      a11y={{
        role: 'FilterBar: toolbar khi có label (không có thì div) · Chip: button + aria-pressed · SearchInput: textbox · BarSep: ẩn khỏi trình đọc',
        keys: [
          { key: 'Tab', does: 'Ô tìm → nút ✕ (khi có chữ) → từng chip, theo thứ tự.' },
          { key: 'Space / Enter', does: 'Bật/tắt chip; bấm ✕ để xoá từ khoá.' },
          {
            key: '← →',
            does: 'Không dùng — các chip không phải một nhóm đi bằng mũi tên.',
          },
        ],
        reader: (
          <>
            Chip đọc là nút bật tắt kèm số: “Của tôi 68, nút bật tắt, đã nhấn”. Ô tìm có
            tên riêng qua <code>aria-label</code>: <code>label</code> nếu truyền, không
            thì chính <code>placeholder</code>, cả hai rỗng thì “Tìm” — ô không bao giờ
            câm. Ký hiệu ⌕ đầu ô ẩn khỏi trình đọc (<code>aria-hidden</code>); nút ✕ có
            tên “Xoá ô tìm”. Chip và nút ✕ khai <code>type=&quot;button&quot;</code> — đặt
            trong <code>&lt;form&gt;</code> bấm không nộp form. (Các điểm này vá
            24/09/2026, B7½.) <b>Hai chỗ chưa tốt, ghi thật:</b> chip là nút bật/tắt ĐỘC
            LẬP theo ARIA, trong khi các màn dùng như chọn MỘT — trình đọc không biết bật
            chip này là tắt chip kia; và số dòng còn lại sau khi lọc không được thông báo
            (không có vùng live). Tên mặc định lấy từ placeholder là gợi ý chứ không phải
            tên — màn mới nên truyền <code>label</code>.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Dùng FilterBar dense / tone cho mọi hàng lọc, hàng hành động; BarLabel cho nhãn nhóm.',
          dont: 'Tự gõ chuỗi "flex shrink-0 flex-wrap … border-b … py-1" và nhãn "text-k-label tracking-[.04em] uppercase" trong màn — mỗi màn lệch một chút.',
          source: 'đo 28/09/2026: 6 hàng + 13 nhãn tự chế ở Mua hàng / Giám đốc',
        },
        {
          do: 'Đặt FilterBar NGOÀI vùng cuộn của bảng — nó không cần cuộn.',
          dont: 'Để thanh lọc và bảng chung một vùng cuộn: hai lớp sticky tính cùng một gốc, tiêu đề cột phủ mất dòng khối đầu tiên.',
          source: 'chú thích THead và FilterBar (Table.tsx) — bẫy dính 08/09/2026',
        },
        {
          do: 'Đếm số trên chip bằng ĐÚNG hàm lọc sẽ chạy khi bấm.',
          dont: 'Đếm bằng một hàm khác (một truy vấn riêng, một view khác) — chip nói 12, bấm ra 9.',
          source: 'CLAUDE.md, nguyên tắc 3 “Con số là một lời hứa”',
        },
        {
          do: 'Truyền số vào count — chip tự in nhóm nghìn.',
          dont: 'Tự nhét số vào children: rổ lớn in thành “13229”, không đọc được bằng mắt lướt.',
          source:
            'chú thích Chip — màn mẫu Tồn kho 15/09/2026, rổ “Cả danh mục” 13.229 mã',
        },
        {
          do: 'Để hàng chip xuống dòng khi hết chỗ.',
          dont: 'Bóp chip cho vừa một hàng: chữ gãy đôi, tràn khỏi viền bo.',
          source: 'chú thích Chip — pane 705px ngày 13/09/2026, cả năm chip vỡ',
        },
        {
          do: 'Dùng SearchInput cho ô tìm, truyền label nói tìm GÌ (“Tìm nhà cung cấp”).',
          dont: 'Viết <input> thô trên thanh lọc.',
          source:
            'luật hg/no-raw-control (eslint-rules/hg-ui.mjs) và chú thích SearchInput',
        },
      ]}
      tested={{ file: 'src/components/kit/table.a11y.test.tsx' }}
    />
  )
}
