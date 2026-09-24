'use client'

import { useState } from 'react'
import {
  DeltaNum,
  DualPct,
  MatrixTable,
  NGOAI_LO_TRINH,
  type MatrixCol,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `MatrixTable` (B7, 24/09/2026).
 *
 * Ví dụ đầu là "Bảng đồng bộ" của màn Thống kê (`DongBoTab.tsx`) thu nhỏ: ba SP
 * × bốn công đoạn, có ô ngoài lộ trình, ô bấm được, và cột kết luận không bấm
 * được. Số cố định, không gọi mạng.
 */

type Sp = {
  id: string
  ma: string
  sl: number
  cd: Record<string, [number, number] | null>
}
const SP: Sp[] = [
  { id: 'a', ma: 'FDA50089N', sl: 400, cd: { phoi: [400, 1], han: [250, 0.7], son: [250, 0.625], dg: [0, 0] } }, // prettier-ignore
  { id: 'b', ma: 'FDA50090N', sl: 200, cd: { phoi: [200, 1], han: null, son: [120, 0.8], dg: [0, 0.1] } }, // prettier-ignore
  { id: 'c', ma: 'FDA50112W', sl: 150, cd: { phoi: [150, 1], han: [150, 1], son: [150, 1], dg: [150, 1] } }, // prettier-ignore
]
const CD = [
  ['phoi', 'Phôi'],
  ['han', 'Hàn'],
  ['son', 'Sơn'],
  ['dg', 'Đóng gói'],
] as const
const bo = (r: Sp) => Math.min(...Object.values(r.cd).flatMap((v) => (v ? [v[0]] : [])))

const CONG_DOAN: MatrixCol<Sp>[] = CD.map(([id, header]) => ({
  id,
  header,
  width: 120,
  title: (r: Sp) =>
    r.cd[id] ? `${header}: bấm để xem việc của công đoạn này` : undefined,
  cell: (r: Sp) => {
    const v = r.cd[id]
    if (!v) return NGOAI_LO_TRINH
    return (
      <span className="grid justify-items-end leading-tight">
        <b className="num">{v[0]}</b>
        <DualPct pieces={v[1]} sets={v[0] / r.sl} />
      </span>
    )
  },
}))

function BangDongBo() {
  const [chon, setChon] = useState<string | null>(null)
  return (
    <div className="grid gap-2">
      <MatrixTable
        label="Bảng đồng bộ mẫu: số bộ đạt từng công đoạn của từng SP"
        rows={SP}
        rowKey={(r) => r.id}
        maxHeight={260}
        pinned={[
          { id: 'ma', header: 'Mã SP', width: 112, cell: (r) => <b className="num">{r.ma}</b> },
          { id: 'sl', header: 'SL bộ', width: 64, num: true, foot: '750', cell: (r) => r.sl },
        ]} // prettier-ignore
        groups={[
          { id: 'cd', header: 'Công đoạn — theo lộ trình', cols: CONG_DOAN },
          {
            id: 'kl',
            header: 'Kết luận',
            cols: [
              { id: 'du', header: 'Bộ hoàn chỉnh', num: true, pick: false, foot: '150', cell: (r) => bo(r) }, // prettier-ignore
              { id: 'thieu', header: 'Thiếu / dư', num: true, pick: false, cell: (r) => <DeltaNum value={bo(r) - r.sl} unit="bộ" /> }, // prettier-ignore
            ],
          },
        ]}
        onCell={(r, colId) =>
          setChon(`${r.ma} · ${CD.find(([id]) => id === colId)?.[1]}`)
        }
        foot={{ label: 'Cộng 3 SP', note: 'Bộ hoàn chỉnh = công đoạn CHẬM NHẤT, không phải trung bình.' }} // prettier-ignore
      />
      <p className="text-k-sm text-[var(--ink-2)]">
        {chon ? (
          <>
            Đã bấm ô <b>{chon}</b> — màn thật lọc danh sách việc theo công đoạn đó.
          </>
        ) : (
          'Bấm một ô công đoạn để đi tới chỗ xử lý.'
        )}
      </p>
    </div>
  )
}

type To = { id: string; to: string; kh: [number, number]; th: [number, number] }
const TO: To[] = [
  { id: 't1', to: 'Tổ Phôi 1', kh: [1200, 1300], th: [1150, 640] },
  { id: 't2', to: 'Tổ Hàn 2', kh: [800, 900], th: [820, 310] },
  { id: 't3', to: 'Tổ Sơn', kh: [600, 700], th: [540, 0] },
]
function BangChiDoc() {
  return (
    <MatrixTable
      label="Kế hoạch và thực hiện theo tổ, tuần 38–39"
      rows={TO}
      rowKey={(r) => r.id}
      maxHeight={200}
      pinned={[{ id: 'to', header: 'Tổ', width: 112, cell: (r) => r.to }]}
      groups={[0, 1].map((w) => ({
        id: `w${w}`,
        header: `Tuần ${38 + w}`,
        cols: [
          { id: `kh${w}`, header: 'KH', num: true, width: 64, cell: (r: To) => r.kh[w].toLocaleString('vi-VN') }, // prettier-ignore
          { id: `th${w}`, header: 'Thực', num: true, width: 64, cell: (r: To) => r.th[w].toLocaleString('vi-VN') }, // prettier-ignore
          { id: `lech${w}`, header: 'Lệch', num: true, width: 72, cell: (r: To) => <DeltaNum value={r.th[w] - r.kh[w]} unit="cái" /> }, // prettier-ignore
        ],
      }))}
    />
  )
}

export default function DocMatrixTable() {
  return (
    <CompDoc
      family="matrix-table"
      alsoImport={['NGOAI_LO_TRINH', 'type MatrixCol']}
      summary={
        <>
          Bảng chéo: mỗi dòng một đối tượng, mỗi CỘT một mốc để so theo chiều dọc. Tiêu đề
          HAI tầng (nhóm → cột con), ghim NHIỀU cột trái, cuộn ngang qua phần còn lại,
          chân tổng dính và tự chia cột. Ba kiểu ô trống phân biệt được: <code>–</code>{' '}
          sọc = ngoài lộ trình, <code>0</code> = có trong lộ trình mà chưa làm,{' '}
          <code>(300)</code> = thiếu.
        </>
      }
      useWhen="cần so cùng một chỉ số giữa nhiều đối tượng theo cột — SP × công đoạn, tổ × tuần — như sheet BC_CONG_DOAN của file Excel xưởng."
      avoidWhen={
        <>
          danh sách một tầng tiêu đề (dùng <code>Table</code>, có sắp xếp và ảo hoá qua
          máy bảng); lưới dòng sửa được của chứng từ (dùng <code>Grid</code>); hơn vài
          chục dòng — MatrixTable vẽ HẾT dòng, không ảo hoá.
        </>
      }
      variants={[
        {
          name: 'Bảng đồng bộ — ô bấm được, ô ngoài lộ trình',
          when: 'có onCell: ô công đoạn là NÚT dẫn tới chỗ xử lý. Cột kết luận khai pick: false nên là chữ thường. FDA50090N không qua Hàn → ô sọc.',
          demo: <BangDongBo />,
        },
        {
          name: 'Chỉ đọc — nhóm theo tuần',
          when: 'không có onCell thì không ô nào là nút. Nhóm lặp cùng bộ cột con (KH · Thực · Lệch).',
          demo: <BangChiDoc />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Tầng nhóm căn giữa, vạch dưới mảnh, vạch trái ngăn nhóm; tầng cột con ngay dưới. Dòng chẵn sọc nhạt như mọi bảng kit.',
          behaves: 'Vẽ hết mọi dòng — không ảo hoá.',
        },
        {
          state: 'Cuộn ngang',
          looks:
            'Các cột ghim đứng yên, nền đặc; vạch dọc ở mép phải cột ghim cuối đánh dấu chỗ bắt đầu trôi.',
          behaves:
            'Vị trí dính của cột ghim thứ n = tổng width các cột trước — vì vậy width bắt buộc.',
        },
        {
          state: 'Cuộn dọc (quá maxHeight)',
          looks:
            'Hai tầng tiêu đề dính trên, chân dính dưới; góc trên-trái nằm trên cả hai trục.',
          behaves:
            'Đệm cuộn (T6) dùng chung với Table: Tab tới ô nào cũng không bị dải dính che.',
        },
        {
          state: 'Rê chuột dòng',
          looks: 'Cả dòng đổi nền nhạt (luật chung của bảng kit).',
          behaves: '—',
        },
        {
          state: 'Ô ngoài lộ trình',
          looks:
            'Gạch “–” căn giữa trên nền sọc 135° — giữ nguyên ở dòng chẵn và khi rê chuột.',
          behaves: 'Không bao giờ là nút, kể cả khi có onCell.',
        },
        {
          state: 'Ô bấm được — rê / focus',
          looks: 'Rê: viền trong màu hành động nhạt. Focus: vòng 2px màu hành động.',
          behaves: 'Enter/Space hoặc bấm → onCell(row, colId).',
        },
        {
          state: 'Rỗng',
          looks: 'Chỉ còn tiêu đề và chân — bảng không có trạng thái rỗng riêng.',
          behaves: 'Màn phải bày Empty thay cho bảng.',
        },
      ]}
      a11y={{
        role: 'table[aria-label] · columnheader (scope="colgroup" ở tầng nhóm, "col" ở tầng con) · rowheader (ô ghim đầu, scope="row") · button (ô có onCell)',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua TỪNG ô-nút theo dòng. Bảng 9 SP × 8 công đoạn là tới 72 điểm dừng.',
          },
          { key: 'Enter / Space', does: 'Bấm ô → onCell.' },
          { key: '← ↑ → ↓', does: 'Không dùng — không phải lưới ARIA.' },
        ],
        reader: (
          <>
            Bảng có tên (<code>label</code>). Ô đầu dòng là tiêu đề dòng, tầng nhóm là{' '}
            <code>colgroup</code>, nên một ô được đọc kèm cả SP lẫn công đoạn: “FDA50089N,
            Sơn, 250” (test canh cấu trúc: rowheader, colgroup, qua axe). Ô sọc đọc “ngoài
            lộ trình” (chữ ẩn), không đọc gạch. <b>Chỗ chưa tốt, ghi thật:</b> tên nút của
            ô chỉ là nội dung ô (con số) — không nói bấm sẽ đi đâu; gợi ý{' '}
            <code>title</code> chỉ hiện khi rê chuột. Nhiều ô bấm được là nhiều điểm dừng
            Tab, không có cách nhảy qua cả bảng.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Trả <code>NGOAI_LO_TRINH</code> từ <code>cell</code> khi SP không đi qua
              công đoạn đó.
            </>
          ),
          dont: 'Trả chuỗi rỗng hay 0 — ô trắng đọc ra “chưa ai làm” trong khi SP này không bao giờ qua công đoạn đó.',
          source:
            'chú thích NGOAI_LO_TRINH (MatrixTable.tsx), luật 1 của T2 — docs/thong-ke-thiet-ke-tu-excel.md',
        },
        {
          do: (
            <>
              <code>pick: false</code> cho cột kết luận/tổng khi bảng có{' '}
              <code>onCell</code>.
            </>
          ),
          dont: 'Để ô trông như nút mà bấm không dẫn đi đâu — nút giả.',
          source:
            'chú thích MatrixCol.pick; DongBoTab.tsx khai pick: false cho cả ba cột kết luận',
        },
        {
          do: 'Kiểm nền sọc bằng trình duyệt ở cả dòng CHẴN và khi rê chuột sau mỗi lần sửa CSS bảng.',
          dont: 'Tin test: happy-dom không dựng CSS. Luật sọc chẵn chung của bảng kit từng đè nền sọc — ô ngoài lộ trình trông y như ô trống.',
          source:
            'erp.css (khối .k-mx-off) và docs/he-thiet-ke-erp-ke-hoach.md §9.8, lỗi 2',
        },
        {
          do: 'Bày dữ liệu SP × công đoạn thành bảng chéo để so theo cột.',
          dont: 'Bày phẳng thành 14 dòng — muốn so “Sơn của SP A với Sơn của SP B” phải lướt qua 7 dòng xen giữa.',
          source: 'chú thích đầu MatrixTable.tsx — màn Thống kê cũ trước B6',
        },
      ]}
      tested={{ file: 'src/components/kit/viz.test.tsx' }}
    />
  )
}
