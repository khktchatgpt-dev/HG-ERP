'use client'

import { useState } from 'react'
import { MiniBars } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `MiniBars` (B7, 24/09/2026). Ví dụ bấm được chép cách dùng của
 * "Bảng đồng bộ" (`DongBoTab.tsx`): bấm một công đoạn → danh sách việc lọc theo
 * công đoạn đó.
 */

const CONG_DOAN = [
  { id: 'phoi', label: 'Phôi', value: 0.98 },
  { id: 'han', label: 'Hàn', value: 0.62 },
  { id: 'son', label: 'Sơn', value: 0.31 },
  { id: 'dg', label: 'Đóng gói', value: 0 },
]

function BamDuoc() {
  const [cd, setCd] = useState<string | null>(null)
  return (
    <div className="grid max-w-[480px] gap-2">
      <MiniBars
        label="Tiến độ theo mảnh ở từng công đoạn của lệnh 02/26-27 - MX"
        rows={CONG_DOAN.map((r) => ({ ...r, onClick: () => setCd(r.label) }))}
      />
      <p className="text-k-sm text-[var(--ink-2)]">
        {cd ? (
          <>
            Đã lọc danh sách việc theo <b>{cd}</b>.
          </>
        ) : (
          'Bấm một công đoạn để lọc danh sách việc.'
        )}
      </p>
    </div>
  )
}

export default function DocMiniBars() {
  return (
    <CompDoc
      family="mini-bars"
      alsoImport={['type MiniBar']}
      summary={
        <>
          Thanh ngang so sánh — % theo công đoạn, % theo sản phẩm. Một chuỗi thì một màu,
          không chú giải; hai chuỗi (nội bộ + gia công ngoài) thì chồng tiếp, khe 2px, chú
          giải luôn hiện. Số ở đầu thanh bằng mực chữ, không bao giờ mang màu của thanh.
          Vẽ bằng HTML, không thêm thư viện biểu đồ.
        </>
      }
      useWhen="so một chỉ số giữa vài đến vài chục mục cùng loại (công đoạn, SP, tổ) trong một khối, để mắt thấy ngay cái nào tụt."
      avoidWhen={
        <>
          cần số chính xác của từng mục trong nhiều cột (dùng <code>MatrixTable</code>);
          nhịp theo ngày (dùng <code>DayStrip</code>); hai mẫu số của một tiến độ (dùng{' '}
          <code>DualPct</code>); một thanh phủ đơn lẻ trong ô bảng (dùng{' '}
          <code>CoverageBar</code>).
        </>
      }
      variants={[
        {
          name: 'Một chuỗi, bấm được',
          when: 'mỗi dòng có onClick thì là NÚT dẫn tới chỗ xử lý. Giá trị 0..1, max mặc định 1.',
          demo: <BamDuoc />,
        },
        {
          name: 'Hai chuỗi — nội bộ + gia công ngoài',
          when: 'có value2 thì BẮT BUỘC series — ở tầng kiểu, quên là lỗi biên dịch. series thành chú giải và chữ ẩn từng dòng. Chữ đầu thanh là tổng hai chuỗi. Ví dụ dùng số bộ trên max 400, để chữ ẩn đọc “Nội bộ 220, GC ngoài 60”.',
          demo: (
            <div className="max-w-[480px]">
              <MiniBars
                label="Số bộ nội bộ và gia công ngoài theo công đoạn, trên 400 bộ"
                series={['Nội bộ', 'GC ngoài']}
                max={400}
                rows={[
                  { id: 'phoi', label: 'Phôi', value: 360, value2: 40 },
                  { id: 'han', label: 'Hàn', value: 220, value2: 60 },
                  { id: 'son', label: 'Sơn', value: 120 },
                  { id: 'dg', label: 'Đóng gói', value: 20 },
                ]}
              />
            </div>
          ),
        },
        {
          name: 'Số đếm với mẫu số chung',
          when: 'max là mẫu số chung (400 bộ); text thay chữ % bằng chữ tự viết.',
          demo: (
            <div className="max-w-[480px]">
              <MiniBars
                label="Số bộ đã qua từng công đoạn, trên 400 bộ đặt"
                max={400}
                rows={[
                  { id: 'phoi', label: 'Phôi', value: 400, text: '400/400' },
                  { id: 'han', label: 'Hàn', value: 250, text: '250/400' },
                  { id: 'son', label: 'Sơn', value: 250, text: '250/400' },
                  { id: 'dg', label: 'Đóng gói', value: 0, text: '0/400' },
                ]}
              />
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Nhãn trái, thanh --viz-1 cao 10px đầu bo gốc vuông trên một đường tóc, chữ số phải bằng mực chữ.',
          behaves: 'Chữ số mặc định là % tiến độ làm tròn XUỐNG (pctTienDo).',
        },
        {
          state: 'Giá trị 0',
          looks: 'Không có thanh — chỉ còn đường tóc; chữ “0%”.',
          behaves: '—',
        },
        {
          state: 'Vượt max',
          looks: 'Thanh kẹp ở 100% bề rộng.',
          behaves:
            'Chữ tự sinh cũng dừng ở “100%”; muốn thấy phần vượt thì tự viết text.',
        },
        {
          state: 'Hai chuỗi',
          looks: 'Đoạn --viz-2 chồng tiếp sau đoạn --viz-1, khe 2px; chú giải trên cùng.',
          behaves:
            'Rê chuột một dòng: chú giải trình duyệt (title) ghi số của từng chuỗi. Trình đọc nghe cùng thông tin qua chữ ẩn “Nội bộ 220, GC ngoài 60” — chuỗi phụ bằng 0 cũng được nói.',
        },
        {
          state: 'Rê chuột (dòng bấm được)',
          looks: 'Cả dòng nền nhạt, bo góc.',
          behaves: 'Bấm → onClick của dòng đó.',
        },
        {
          state: 'Focus (dòng bấm được)',
          looks: 'Vòng 2px màu hành động quanh cả dòng.',
          behaves: 'Enter/Space → onClick.',
        },
      ]}
      a11y={{
        role: 'group[aria-label] > list > listitem (> button khi dòng có onClick)',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua các dòng bấm được; dòng không có onClick không nhận focus.',
          },
          { key: 'Enter / Space', does: 'Bấm dòng.' },
        ],
        reader: (
          <>
            Khối có tên (<code>label</code>) và đọc như một danh sách n mục. Tên mỗi dòng
            là nhãn + chữ đầu thanh (“Sơn 31%”); thanh là trang trí, ẩn khỏi trình đọc. Ở
            hai chuỗi, mỗi dòng thêm chữ ẩn nêu TÊN + SỐ từng chuỗi (“Nội bộ 220, GC ngoài
            60”, chuỗi phụ bằng 0 vẫn nói “GC ngoài 0”), nên người nghe không chỉ nghe
            tổng. <code>series</code> bắt buộc ở TẦNG KIỂU khi có dòng mang{' '}
            <code>value2</code> — quên truyền là lỗi biên dịch, không còn là lời dặn. (Cả
            hai sửa 24/09/2026, B7½; test canh cả hai.) <b>Ghi thật:</b> chữ ẩn đọc{' '}
            <code>value</code> THÔ, không đổi ra phần trăm — truyền tỉ lệ 0..1 thì trình
            đọc nghe “Nội bộ 0,55”; muốn nghe số có nghĩa thì bày số đếm với{' '}
            <code>max</code> như ví dụ trên. viz.test.tsx chưa chạy axe cho MiniBars — chỉ
            có axe trên ví dụ của trang này.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Có value2 thì truyền series — kiểu đã bắt buộc; và bày số đếm với max để chữ ẩn đọc ra số có nghĩa.',
          dont: 'Lách kiểu (ép as) để bỏ series: --viz-2 chỉ qua ngưỡng mù màu khi có mã phụ (khe + chú giải + nhãn số); cặp màu tốt nhất vẫn chỉ ΔE 7,1.',
          source:
            'chú thích MiniBars (Viz.tsx), B7½ 24/09/2026; docs/he-thiet-ke-erp-ke-hoach.md §9.8',
        },
        {
          do: 'Để chữ số bằng mực chữ.',
          dont: 'Tô chữ số theo màu thanh — --viz-1 chỉ đạt 4,0:1, đủ cho thanh, không phải cho chữ nhỏ.',
          source:
            'chú thích MiniBars (Viz.tsx); tokens.css (--viz-1, 4,0:1 trên nền trắng)',
        },
        {
          do: 'Cho dòng onClick khi bấm dẫn tới chỗ xử lý — lọc danh sách việc theo công đoạn.',
          dont: 'Bày thanh chỉ để ngắm khi người xem cần đi sửa: bảng báo tin xấu mà không chỉ chỗ thì không ai sửa được gì.',
          source:
            'DongBoTab.tsx (onPickStage); luật số 3 của T2 trong chú thích MatrixTable.tsx',
        },
        {
          do: 'Vẽ bằng thành phần kit, màu qua --viz-1/--viz-2.',
          dont: 'Kéo thêm một thư viện biểu đồ — nó mang bảng màu riêng, đúng thứ kit phải giữ.',
          source: 'chú thích đầu Viz.tsx (B6)',
        },
      ]}
      tested={{ file: 'src/components/kit/viz.test.tsx' }}
    />
  )
}
