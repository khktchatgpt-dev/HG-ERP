'use client'

import { useState } from 'react'
import {
  Btn,
  Chip,
  CommitBar,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  HeadChip,
  HeadChips,
  ScreenFrame,
  SearchInput,
  Tag,
  Td,
  Th,
  WorkLanes,
} from '@/components/kit'
import { LabNote } from '../_lab/Doc'

/**
 * KHUÔN F — BẢNG NHẬP LIỆU (worksheet / entry sheet).
 *
 * Trả lời: "làm sao khai 40 dòng nhanh như Excel mà không sai?".
 * Chép journal entry của Dynamics 365, mass entry của SAP Fiori, và list sửa
 * tại chỗ của Odoo.
 *
 * VÌ SAO KHÔNG PHẢI LÀ KHUÔN D. Cả hai đều có một lưới, nhưng vai của lưới
 * ngược nhau:
 *
 *   · Khuôn D — người dùng ĐỌC một tờ đã lập. Lưới là một khối trong tờ,
 *     đầu chứng từ được phép chiếm 15 dòng lưới nhãn–giá trị.
 *   · Khuôn F — người dùng GÕ. Mỗi hàng đầu trang là một hàng lưới bị lấy
 *     mất, nên đầu đơn co lại thành dải chip và lưới chiếm phần còn lại.
 *
 * NĂM LUẬT CỦA KHUÔN NÀY:
 *
 *  1. LƯỚI LÀ NHÂN VẬT CHÍNH. Đầu đơn thu thành chip, bấm mới mở ra sửa.
 *  2. KIỂM TỪNG DÒNG NGAY KHI GÕ, không đợi bấm Lưu. Gõ xong 40 dòng rồi mới
 *     biết thiếu nhà cung cấp là mất công vô ích.
 *  3. CÂU CHẶN LƯU PHẢI BẤM ĐƯỢC, nhảy tới đúng ô hỏng. Bảng cuộn ngang nên
 *     chỗ hỏng có khi đang nằm ngoài màn.
 *  4. NẠP HÀNG LOẠT LÀ ĐƯỜNG CHÍNH, không phải tính năng phụ: dán từ Excel,
 *     lấy theo nhu cầu của lệnh, thêm nhanh mã chưa có trong danh mục.
 *  5. GHIM HAI ĐẦU — cột định danh trái, cột thành tiền phải. Ở giữa cuộn.
 *
 * Đo trên màn thật `/planning/pos/new` ngày 10/09/2026: nó đã làm gần đủ cả
 * năm điều (chip đầu đơn, ghim hai đầu, dán Excel ba bậc tin cậy, chip nhu
 * cầu lệnh, chuỗi Enter SL → giá → về ô tìm). Khuôn này chỉ ĐẶT TÊN cho thứ
 * màn đó đã tự chế, để màn sau không phải chế lại từ đầu.
 */

type Line = {
  id: string
  code: string | null
  name: string
  spec: string
  unit: string
  qty: number | null
  price: number | null
  stock: number | null
  /** Vướng gì — tính lại mỗi lần gõ, không đợi bấm Lưu. */
  problem: string | null
  note: string
}

const LINES: Line[] = [
  { id: 'l1', code: 'CN1527', name: 'Vít dù 4×12, 7 màu', spec: '4×12', unit: 'Thùng', qty: 68, price: 369600, stock: 0, problem: null, note: '' }, // prettier-ignore
  { id: 'l2', code: 'ST-0083', name: 'Thép hộp 20×40×1,2 mạ kẽm', spec: '20×40×1,2', unit: 'Cây', qty: 420, price: 186000, stock: 12, problem: null, note: 'cắt cây 6 m' }, // prettier-ignore
  { id: 'l3', code: 'NK-0056', name: 'Vít 4×12 đầu bằng ren gỗ, 7M', spec: '4×12', unit: 'Thùng', qty: 10, price: null, stock: 0, problem: 'thiếu đơn giá', note: 'chờ báo giá' }, // prettier-ignore
  { id: 'l4', code: 'BUL0260', name: 'Tán rút 6', spec: 'M6', unit: 'Hộp', qty: null, price: 90240, stock: null, problem: 'thiếu SL đặt', note: '' }, // prettier-ignore
  { id: 'l5', code: null, name: 'Gia công cắt CNC theo bản vẽ', spec: '—', unit: 'Bộ', qty: 12, price: 1250000, stock: null, problem: null, note: 'dòng tự gõ, không trừ kho' }, // prettier-ignore
]

const NEEDS: { code: string; name: string; qty: string }[] = [
  { code: 'NK-0088', name: 'Nút bịt cao su Ø16', qty: '13.200 Cái' },
  { code: 'SN-0021', name: 'Sơn PU trong mờ', qty: '84 Lít' },
  { code: 'BB-0140', name: 'Thùng carton 5 lớp', qty: '620 Thùng' },
]

const n = (v: number) => v.toLocaleString('vi-VN')

/**
 * Thanh tab của màn nhập liệu.
 *
 * CHỖ KIT CÒN THIẾU, lộ ra đúng ở đây — và đây là việc mà màn mẫu sinh ra để
 * làm. Kit không có thanh tab nội dung đứng riêng: `ActionPane` có tab nhưng
 * nó là thanh HÀNH ĐỘNG, còn `WorkLanes` là hàng đợi việc và LUÔN đeo một số
 * đếm. Hai tab đầu có số thật (số dòng, số đợt) nên dùng tạm được; tab "Điều
 * khoản" thì đeo số 0 vô nghĩa.
 *
 * Chưa thêm `TabStrip` vào kit vì mới có một chỗ cần. Thêm chỗ thứ hai thì
 * tách ra — một lần là trùng hợp, hai lần mới là quy luật.
 */
const TABS: { id: string; label: string; rows: unknown[]; tone?: 'stop' }[] = [
  { id: 'lines', label: 'Dòng hàng', rows: LINES },
  { id: 'ship', label: 'Chia đợt giao', rows: [1, 2] },
  { id: 'terms', label: 'Điều khoản', rows: [] },
]

export default function Page() {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<string>('lines')
  const [ncc, setNcc] = useState<string | null>(null)

  const bad = LINES.filter((l) => l.problem)
  const priced = LINES.filter((l) => l.qty != null && l.price != null)
  const sub = priced.reduce((s, l) => s + (l.qty ?? 0) * (l.price ?? 0), 0)
  const vat = Math.round(sub * 0.08)

  const blocked = !ncc
    ? 'chưa chọn nhà cung cấp'
    : bad.length > 0
      ? `dòng ${LINES.indexOf(bad[0]) + 1} ${bad[0].problem}${bad.length > 1 ? ` (và ${bad.length - 1} dòng nữa)` : ''}`
      : undefined

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn F — Bảng nhập liệu.</b> Đầu đơn co thành <b>dải chip</b> để lưới chiếm
          gần hết màn. Chip “NCC” đang đỏ vì chưa khai, và thanh đáy nói thẳng vì sao chưa
          lưu được — <b>bấm được, nhảy tới đúng ô hỏng</b>. Bấm thử chip NCC để thấy câu
          chặn đổi sang lỗi tiếp theo.
        </div>
      </LabNote>

      <HeadChips>
        <HeadChip label="Mẫu" value="Ngũ kim theo kg" />
        <HeadChip label="LSX" value="06/26-27 · MERXX" />
        <HeadChip
          label="NCC"
          value={ncc}
          need
          onClick={() => setNcc((v) => (v ? null : 'Cơ khí Thành Đạt'))}
        />
        <HeadChip label="Hẹn giao" value="18/09/2026" />
        <HeadChip label="Tiền tệ" value="VND" muted />
        <HeadChip label="Theo HĐ số" value={null} />
        <span style={{ marginLeft: 'auto' }}>
          {blocked ? (
            <Tag tone="warn">chưa lưu được</Tag>
          ) : (
            <Tag tone="done">5 dòng đủ số</Tag>
          )}
        </span>
      </HeadChips>

      <div
        style={{
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface-card)',
        }}
      >
        <WorkLanes lanes={TABS} activeId={tab} onPick={setTab} />
      </div>

      {tab !== 'lines' ? (
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)] p-[var(--gutter)] text-[var(--ink-3)]">
          Tab “{TABS.find((t) => t.id === tab)?.label}” — cùng khuôn, khác nội dung. Thanh
          chốt ở đáy dùng chung cho mọi tab, nên tổng tiền và câu chặn lưu không bao giờ
          khuất.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface-card)]">
          <div className="min-h-0 flex-1 overflow-auto">
            <Grid minWidth={1080}>
              <GridHead>
                <Th width={40}>#</Th>
                <Th width={230}>Tên SP / vật tư</Th>
                <Th>Quy cách</Th>
                <Th>ĐVT</Th>
                <Th num>SL đặt</Th>
                <Th num>Đơn giá</Th>
                <Th num>Tồn kho</Th>
                <Th>Ghi chú</Th>
                <Th num>Thành tiền</Th>
              </GridHead>
              <GridBody>
                {LINES.map((l, i) => (
                  <GridRow key={l.id}>
                    <Td num tone={l.problem ? 'warn' : undefined}>
                      {l.problem ? '▌' : ''}
                      {i + 1}
                    </Td>
                    <Td>
                      {l.code ? (
                        <>
                          <b>{l.code}</b> · {l.name}
                        </>
                      ) : (
                        <>
                          {l.name} <Tag tone="neutral">dòng tự gõ</Tag>
                        </>
                      )}
                    </Td>
                    <Td num>{l.spec}</Td>
                    <Td>{l.unit}</Td>
                    <Td num tone={l.qty == null ? 'warn' : undefined}>
                      {l.qty == null ? 'thiếu' : n(l.qty)}
                    </Td>
                    <Td num tone={l.price == null ? 'warn' : undefined}>
                      {l.price == null ? 'thiếu' : n(l.price)}
                    </Td>
                    {/*
                      BA TRẠNG THÁI TỒN KHÁC NHAU, không được gộp:
                      số thật · "tồn 0" (đã kiểm, hết hàng) · "chưa có sổ kho"
                      (mã này chưa ai lập thẻ kho — thiếu DỮ LIỆU, không phải
                      hết hàng). Gộp hai cái sau là người mua tưởng đã kiểm rồi.
                    */}
                    <Td num tone={l.stock === null ? 'warn' : undefined}>
                      {l.stock === null ? 'chưa có sổ kho' : n(l.stock)}
                    </Td>
                    <Td>{l.note}</Td>
                    <Td num tone={l.problem ? 'warn' : undefined}>
                      {l.problem ? l.problem : n((l.qty ?? 0) * (l.price ?? 0))}
                    </Td>
                  </GridRow>
                ))}
              </GridBody>
              <GridFoot>
                <Td colSpan={4}>
                  Cộng {LINES.length} dòng · {bad.length} thiếu số
                </Td>
                <Td num>{n(LINES.reduce((s, l) => s + (l.qty ?? 0), 0))}</Td>
                <Td colSpan={3} />
                <Td num>{n(sub)}</Td>
              </GridFoot>
            </Grid>
          </div>

          {/*
            VÙNG THÊM DÒNG đứng NGOÀI khung cuộn của lưới, dính ngay trên
            thanh chốt. Để nó cuộn cùng lưới thì gõ tới dòng 40 phải cuộn
            xuống đáy mới thêm được dòng tiếp — đúng thao tác lặp nhiều nhất
            của cả màn.
          */}
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[9px]">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                value={q}
                onChange={setQ}
                placeholder="Gõ mã hoặc tên vật tư rồi Enter…"
                width={300}
              />
              <Btn>Duyệt theo nhóm</Btn>
              <Btn>Dán từ Excel</Btn>
              <Btn>+ Khai vật tư mới</Btn>
            </div>
            <div className="mt-[9px] flex flex-wrap items-center gap-2">
              <span className="font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                Lệnh còn thiếu 3 vật tư
              </span>
              {NEEDS.map((x) => (
                <Chip key={x.code}>
                  {x.code} · {x.qty}
                </Chip>
              ))}
              <Btn>Thêm cả 3</Btn>
              <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                số nháp — đối chiếu trước khi dùng
              </span>
            </div>
          </div>
        </div>
      )}

      <CommitBar
        totals={[
          { label: 'Tiền hàng', value: `${n(sub)} ₫` },
          { label: 'VAT 8%', value: `${n(vat)} ₫` },
        ]}
        grand={{ label: 'Tổng thanh toán', value: `${n(sub + vat)} ₫` }}
        blocked={blocked}
        actions={
          <>
            <Btn>Xem trước phiếu in</Btn>
            <Btn primary disabled={!!blocked} title={blocked}>
              Lưu nháp
            </Btn>
          </>
        }
      />
    </ScreenFrame>
  )
}
