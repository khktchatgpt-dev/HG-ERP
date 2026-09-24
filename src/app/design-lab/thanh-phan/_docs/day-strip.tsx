'use client'

import { useState } from 'react'
import { DayStrip, type DayPoint } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA — `DayStrip` (B7, 24/09/2026). Số cố định, ngày ISO cố định: 14 ngày
 * 11/09 → 24/09/2026, hôm nay là 24/09 — cùng dữ liệu mẫu với sổ
 * (`/design-lab/thanh-phan#bay-so`) để hai nơi nhìn giống nhau.
 */

const ngay = (vals: number[]): DayPoint[] =>
  vals.map((v, i) => ({
    date: `2026-09-${String(11 + i).padStart(2, '0')}`,
    value: v,
    note: v ? `${1 + (i % 2)} phiếu` : undefined,
  }))
const CHAN = ngay([0, 80, 120, 110, 0, 0, 60, 140, 150, 90, 0, 0, 30, 45])
const TUA = ngay([0, 0, 10, 20, 0, 0, 0, 15, 30, 25, 0, 0, 0, 5])
const HOM_NAY = '2026-09-24'

function DaiBamDuoc() {
  const [mo, setMo] = useState<DayPoint | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DayStrip
        days={CHAN}
        today={HOM_NAY}
        label="Chân trước · Tổ Phôi · 14 ngày"
        width={168}
        height={28}
        onPick={setMo}
      />
      <span className="text-k-sm text-[var(--ink-2)]">
        {mo ? (
          <>
            Mở ngày <b className="num">{mo.date.split('-').reverse().join('/')}</b>:{' '}
            <b className="num">{mo.value}</b> cái{mo.note ? ` · ${mo.note}` : ''}
          </>
        ) : (
          'Bấm một cột, hoặc Tab tới dải rồi ← → và Enter.'
        )}
      </span>
    </div>
  )
}

function Dong({ nhan, days, max }: { nhan: string; days: DayPoint[]; max?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-k-sm w-[150px] text-[var(--ink-2)]">{nhan}</span>
      <DayStrip days={days} today={HOM_NAY} label={`${nhan} · 14 ngày`} max={max} />
    </div>
  )
}

export default function DocDayStrip() {
  return (
    <CompDoc
      family="day-strip"
      alsoImport={['type DayPoint']}
      summary={
        <>
          Dải n ngày: mỗi ngày một cột cao theo số, cột hôm nay có viền. Thay cho 100 cột
          ngày của sheet <code>CD_*</code> — nhìn ngang một dòng là thấy nhịp: tổ làm liền
          4 ngày rồi nghỉ 6 ngày. <b>Chỉ đọc</b>: số ngày cũ sửa qua đường “sửa lại, có lý
          do”, không sửa trên dải.
        </>
      }
      useWhen="bày NHỊP sản lượng theo ngày của một chi tiết, một tổ, một công đoạn — trong một ô bảng hoặc cạnh tên dòng."
      avoidWhen={
        <>
          cần đọc đúng từng con số của từng ngày (dùng <code>Table</code> hoặc{' '}
          <code>MatrixTable</code> ngày × tổ); so nhiều công đoạn với nhau (dùng{' '}
          <code>MiniBars</code>); hay nhập số theo ngày (dải không sửa được).
        </>
      }
      variants={[
        {
          name: 'Bấm được — onPick',
          when: 'bấm cột (chuột) hoặc Enter trên ngày đang soi (phím) để mở ngày đó. Rê chuột ra “số · ngày · phiếu”.',
          demo: <DaiBamDuoc />,
        },
        {
          name: 'Nhiều dải — thang riêng và thang chung',
          when: 'hai dòng cùng đơn vị thì truyền max chung, nếu không dòng 30 cái trông cao bằng dòng 150 cái. Khác đơn vị (chân ×4, tựa ×1) thì để thang riêng — màn ghi sản lượng làm vậy.',
          demo: (
            <div className="grid gap-3">
              <div className="grid gap-1">
                <span className="text-k-label text-[var(--ink-label)]">Thang riêng</span>
                <Dong nhan="Chân trước" days={CHAN} />
                <Dong nhan="Tựa lưng" days={TUA} />
              </div>
              <div className="grid gap-1">
                <span className="text-k-label text-[var(--ink-label)]">
                  Thang chung (max = 150)
                </span>
                <Dong nhan="Chân trước" days={CHAN} max={150} />
                <Dong nhan="Tựa lưng" days={TUA} max={150} />
              </div>
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Cột một màu --viz-1, đầu cột bo, chân vuông trên đường gốc; ngày 0 là một vạch mốc mảnh; cột hôm nay có viền.',
          behaves: 'Một điểm dừng Tab cho cả dải.',
        },
        {
          state: 'Rê chuột / đi bằng mũi tên',
          looks:
            'Cột đang soi giữ màu, các cột khác mờ đi; ô nổi phía trên ghi “120 · 23/09 · 2 phiếu” (số trước, rồi ngày, rồi phiếu).',
          behaves: 'Rời chuột, rời focus, hoặc Esc thì ô nổi tắt.',
        },
        {
          state: 'Focus',
          looks: 'Vòng 2px màu hành động quanh cả dải.',
          behaves: 'Chưa soi ngày nào cho tới khi bấm ← hoặc →.',
        },
        {
          state: 'Có onPick',
          looks: 'Con trỏ thành bàn tay trên dải.',
          behaves:
            'Bấm cột hoặc Enter → onPick(ngày). Không có onPick thì Enter không làm gì.',
        },
        {
          state: 'Rỗng',
          looks: 'Mảng days rỗng: chỉ còn đường gốc.',
          behaves:
            'Tên đọc “tổng 0 trong 0 ngày”. Màn ghi sản lượng bày “—” kèm lý do thay cho dải rỗng.',
        },
      ]}
      a11y={{
        role: 'group (tabIndex=0, aria-label = câu tóm tắt) · tooltip (nối qua aria-describedby khi đang soi)',
        keys: [
          { key: 'Tab', does: 'Tới dải — một điểm dừng cho cả 14 ngày.' },
          {
            key: '← →',
            does: 'Đi từng ngày; lần bấm đầu bắt đầu từ ngày đầu (→) hoặc ngày cuối (←).',
          },
          { key: 'Enter', does: 'Mở ngày đang soi (chỉ khi có onPick).' },
          { key: 'Esc', does: 'Tắt ô nổi, bỏ ngày đang soi.' },
        ],
        reader: (
          <>
            Tên của dải là câu tóm tắt: “Chân trước · 14 ngày: tổng 825 trong 14 ngày, cao
            nhất 19/09 150, hôm nay 45”. Mọi số còn nằm trong một bảng ẩn (“11/09: 0;
            12/09: 80; …”) — đường đọc không cần rê chuột. Cả hai có test canh, kể cả axe.{' '}
            <b>Chỗ chưa tốt, ghi thật:</b> không có Home/End; và ô nổi được nối bằng{' '}
            <code>aria-describedby</code> trong khi tiêu điểm đứng yên trên dải — nhiều
            trình đọc không đọc lại mô tả khi nó đổi, nên đi bằng mũi tên có thể im lặng.
            Đường đọc chắc chắn là bảng ẩn.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Đưa đủ MỌI ngày trong khoảng, kể cả ngày 0.',
          dont: 'Bỏ ngày không có số khỏi mảng — dải co lại và không còn thấy “có ngày đó, không làm” khác “không có dữ liệu”.',
          source: 'chú thích DayStrip (Viz.tsx) — ngày 0 vẫn có vạch mốc',
        },
        {
          do: 'Truyền max chung khi nhiều dải CÙNG đơn vị xếp chồng trong một bảng.',
          dont: 'Để thang chung cho dải KHÁC đơn vị — so chiều cao cột giữa chân ×4 và tựa ×1 là so hai đơn vị.',
          source:
            'chú thích DayStrip.max (Viz.tsx) và chú thích “thang riêng từng dòng” ở EntrySheetForm.tsx',
        },
        {
          do: 'Giữ dải CHỈ ĐỌC; sửa số ngày cũ qua đường “sửa lại, có lý do”.',
          dont: 'Biến dải thành ma trận sửa trực tiếp — đúng thứ làm file Excel mất vết.',
          source: 'chú thích DayStrip (Viz.tsx); commit d94cf02 “sửa lại, lý do có mã”',
        },
        {
          do: 'Một chuỗi một màu --viz-1, không chú giải.',
          dont: 'Tô cột theo màu hành động hay màu vòng đời — tím từng bị loại vì cách --act chỉ ΔE 10,9, trông như bấm được.',
          source:
            'bộ kiểm màu B6 — docs/he-thiet-ke-erp-ke-hoach.md §9.8, biến --viz-1 ở tokens.css',
        },
      ]}
      tested={{ file: 'src/components/kit/viz.test.tsx' }}
    />
  )
}
