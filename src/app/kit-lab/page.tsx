'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  CommandBar,
  CoverageBar,
  Empty,
  FilterBar,
  GroupRow,
  InspectPanel,
  InspectSection,
  NoticeBar,
  Num,
  PermHint,
  Row,
  ScreenHeader,
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
 * KIT v4 — TRANG MẪU SỐNG (/kit-lab).
 *
 * Dữ liệu lấy nguyên từ LSX 06/26-27 - MX ngày 08/09/2026, KHÔNG bịa: kit
 * phải được thử trên hình dạng dữ liệu thật (tên vật tư dài, mã chưa có giá,
 * nhiều mã chung một NCC) chứ không phải trên dữ liệu mẫu tròn trịa.
 */

type R = {
  code: string
  name: string
  spec: string | null
  unit: string
  need: number
  covered: number
  price: number | null
  supplier: string | null
  bom: boolean
}

const ROWS: R[] = [
  { code: 'NK-0136', name: 'Vít 4x15 đầu bằng ren gỗ, xi trắng', spec: '4×15', unit: 'Con', need: 440, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0133', name: 'Bulong 6x20x13, sơn đen', spec: '6×20×13', unit: 'Con', need: 160, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0020', name: 'Long đền nhôm 6x16x2, đen', spec: '6×16×2', unit: 'Con', need: 160, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0042', name: 'Long đền nhôm 6x16x5, đen', spec: '6×16×5', unit: 'Con', need: 80, covered: 5, price: 68000, supplier: 'TÂN THÀNH LONG', bom: true },
  { code: 'NK-0131', name: 'Gót chân vuông 20 dày 5ly, đen', spec: '□20 · 5ly', unit: 'Cái', need: 80, covered: 0, price: null, supplier: null, bom: true },
  { code: 'BUL0031', name: 'Bulon 6x15', spec: '6×15', unit: 'Con', need: 80, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0041', name: 'Bulon 6x25x13, 7 màu', spec: '6×25×13', unit: 'Con', need: 40, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0079', name: 'Tán rút 6 sắt', spec: null, unit: 'Con', need: 40, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0132', name: 'Pat xếp ghế 5 bậc có gác chân', spec: null, unit: 'Cái', need: 40, covered: 0, price: null, supplier: null, bom: true },
  { code: 'NK-0018', name: 'Mạc đồng dán', spec: null, unit: 'Cái', need: 20, covered: 20, price: 2100, supplier: 'TÂN THÀNH LONG', bom: true },
]

const remaining = (r: R) => Math.max(r.need - r.covered, 0)

export default function KitLab() {
  const [sel, setSel] = useState<R>(ROWS[0])
  const [lane, setLane] = useState('mua')
  const [dense, setDense] = useState(false)

  const lanes = toLanes(ROWS, [
    { id: 'mua', label: 'Cần mua', test: (r) => remaining(r) > 0 },
    { id: 'kt', label: 'Kỹ thuật đang mắc', tone: 'stop', test: (r) => r.bom && remaining(r) > 0 },
    { id: 'du', label: 'Đã đủ', test: (r) => remaining(r) === 0 },
  ])
  const rows = lanes.find((l) => l.id === lane)?.rows ?? []
  const tien = rows.reduce((s, r) => s + (r.price ? remaining(r) * r.price : 0), 0)
  const chuaGia = rows.filter((r) => remaining(r) > 0 && !r.price).length

  return (
    <div className={`kit-v4 ${dense ? 'kit-dense' : ''} flex h-screen flex-col`}>
      <CommandBar
        brand={<>HOÀNG GIA <b className="text-[var(--act)]">ERP</b></>}
        crumbs={[
          { label: 'Cung ứng', href: '#' },
          { label: 'Vật tư theo lệnh', href: '#' },
          { label: '06/26-27 - MX' },
        ]}
        user={{ initials: 'NG', name: 'Thanh Nga', role: 'Cung ứng' }}
      />

      <ScreenHeader
        eyebrow="Bảng kê vật tư"
        title={<span className="font-[family-name:var(--font-mono)]">LSX 06/26-27 - MX</span>}
        status={<Tag tone="warn">Thiếu vật tư</Tag>}
        chain={
          <>
            <Code as="a" href="#">MERXX HANDELS GMBH</Code>
            <span className="text-[var(--line-faint)]">→</span>
            <Code as="a" href="#">18023 HG-MX</Code>
            <span className="text-[var(--line-faint)]">→</span>
            <Code as="a" href="#">06/26-27 - MX</Code>
          </>
        }
        facts={[
          { label: 'Ngày xuất', value: '29/11/2026' },
          { label: 'Hạn vật tư', value: 'chưa đặt', tone: 'stop' },
          { label: 'Quy mô', value: '26 sản phẩm · 68 mã' },
        ]}
        actions={
          <>
            <Btn onClick={() => setDense(!dense)}>{dense ? 'Thưa' : 'Dày'}</Btn>
            <Btn>Xuất Excel</Btn>
            <Btn primary>Cắt đơn cho 1 NCC</Btn>
          </>
        }
      >
        <WorkLanes lanes={lanes} activeId={lane} onPick={setLane} />
      </ScreenHeader>

      <NoticeBar tag="Chặn mua" action={{ label: 'Xem 7 sản phẩm' }}>
        <b className="text-[var(--ink)]">7 sản phẩm</b> có định mức nhưng Kỹ thuật chưa xác
        nhận BOM — số vẫn tính vào cột Cần, nhưng{' '}
        <b className="text-[var(--ink)]">không được gửi đơn</b> theo bản này.
      </NoticeBar>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <FilterBar>
            <Chip on count={rows.length}>Còn phải đặt</Chip>
            <Chip count={chuaGia}>Chưa có giá</Chip>
            <Chip count={rows.filter((r) => !r.supplier).length}>Chưa biết mua ở đâu</Chip>
            <div className="flex-1" />
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
              Đang xem <b className="num text-[var(--act)]">{rows.length}</b> mã
            </span>
          </FilterBar>

          {rows.length === 0 ? (
            <Empty
              headline="Không còn mã nào phải mua"
              reason="Cả 68 mã của lệnh đã đủ tồn, đã đặt hoặc đang về. Bảng trống ở đây là tin tốt, không phải lỗi dữ liệu."
              next={<Btn onClick={() => setLane('du')}>Xem 10 mã đã đủ</Btn>}
            />
          ) : (
            <Table>
              <THead>
                <th style={{ width: 112 }}>Mã VT</th>
                <th>Tên vật tư</th>
                <th style={{ width: 110 }}>Quy cách</th>
                <th style={{ width: 52 }}>ĐVT</th>
                <th className="num" style={{ width: 88 }}>Cần mua</th>
                <th className="num" style={{ width: 118 }}>Đã phủ</th>
                <th className="num" style={{ width: 96 }}>Giá gần nhất</th>
                <th className="num" style={{ width: 108 }}>Tạm tính</th>
                <th style={{ width: 190 }}>Mua ở đâu</th>
                <th style={{ width: 160 }}>Việc phải làm</th>
              </THead>
              <tbody>
                <GroupRow step={5} name="Ngũ kim — lắp ráp" cols={10}
                  meta={`${rows.length} mã · ${showMoney(tien)} ₫`} />
                {rows.map((r) => {
                  const left = remaining(r)
                  const act = rowAction({
                    suggest: left,
                    hasPrice: !!r.price,
                    hasSupplier: !!r.supplier,
                    blockedByBom: r.bom && left > 0,
                  })
                  return (
                    <Row key={r.code} selected={sel.code === r.code} onClick={() => setSel(r)}>
                      <Cell><Code>{r.code}</Code></Cell>
                      <Cell grow>{r.name}</Cell>
                      <Cell muted>{r.spec ?? '—'}</Cell>
                      <Cell muted>{r.unit}</Cell>
                      <Cell num><Num value={showNum(left)} strong /></Cell>
                      <Cell num>
                        <CoverageBar
                          ratio={coverage({ need: r.need, covered: r.covered })}
                          label={coveragePct(coverage({ need: r.need, covered: r.covered }))}
                        />
                      </Cell>
                      <Cell num><Num value={showMoney(r.price)} /></Cell>
                      <Cell num><Num value={r.price ? showMoney(left * r.price) : ''} /></Cell>
                      <Cell>
                        {r.supplier ? (
                          <span className="text-[11.5px] text-[var(--ink-2)]">{r.supplier}</span>
                        ) : (
                          <span className="text-[11.5px] text-[var(--stop)]">Chưa mua lần nào</span>
                        )}
                      </Cell>
                      <Cell><Tag tone={act.tone}>{act.label}</Tag></Cell>
                    </Row>
                  )
                })}
              </tbody>
              <TFoot
                label={<td colSpan={4}>Cộng <span className="num">{rows.length}</span> mã</td>}
                cells={
                  <>
                    <td className="num">{showNum(rows.reduce((s, r) => s + remaining(r), 0))}</td>
                    <td />
                    <td />
                    <td className="num text-[14px] whitespace-nowrap">
                      {showMoney(tien)}
                      <span className="ml-[3px] text-[11px] font-normal text-[var(--ink-3)]">₫</span>
                    </td>
                  </>
                }
                caveat={chuaGia > 0 ? `${chuaGia}/${rows.length} mã chưa có giá — chưa nằm trong tổng này` : undefined}
              />
            </Table>
          )}
        </div>

        <InspectPanel
          code={sel.code}
          title={sel.name}
          subtitle={`${sel.spec ? sel.spec + ' · ' : ''}${sel.unit}`}
          actions={
            <>
              <Btn primary className="w-full justify-center">Tạo phiếu hỏi giá</Btn>
              <Btn className="w-full justify-center">Thêm vào đơn đang soạn</Btn>
              <Btn className="w-full justify-center" blockedBy="Kỹ thuật">Sửa định mức</Btn>
              <PermHint owner="Kỹ thuật" />
            </>
          }
        >
          <InspectSection title={`Vì sao cần ${showNum(remaining(sel))}`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[var(--ink-2)]">Còn phải đặt</span>
              <span className="num text-[15px] font-bold text-[var(--act)]">
                {showNum(remaining(sel))} {sel.unit}
              </span>
            </div>
            <WhyBox
              lines={[
                `định mức 4/SP × SL 110 SP = ${showNum(sel.need)}`,
                `− tồn khả dụng 0 · − đã đặt ${showNum(sel.covered)}`,
              ]}
              result={`còn phải đặt ${showNum(remaining(sel))} ${sel.unit}`}
            />
          </InspectSection>

          <InspectSection title="Mua ở đâu">
            {sel.supplier ? (
              <div className="flex justify-between text-[12.5px]">
                <span className="text-[var(--ink-2)]">Lần mua gần nhất</span>
                <span className="num font-semibold">{showMoney(sel.price)} ₫</span>
              </div>
            ) : (
              <p className="text-[var(--fs-micro)] leading-relaxed text-[var(--ink-3)]">
                Mã này chưa từng có đơn nào nên hệ thống không đoán nhà cung cấp — đoán sai
                thì đơn gửi nhầm chỗ. Phải đi hỏi giá trước.
              </p>
            )}
          </InspectSection>
        </InspectPanel>
      </div>
    </div>
  )
}
