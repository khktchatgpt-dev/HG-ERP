'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  InspectPanel,
  InspectSection,
  Menu,
  Num,
  Row,
  ScreenFrame,
  SearchInput,
  Table,
  THead,
  Tag,
  Tip,
  WhyBox,
  WorkLanes,
  showMoney,
  showNum,
  toLanes,
} from '@/components/kit'
import { poTemplateMeta } from '@/lib/po-template'

/**
 * VẬT TƯ & GIÁ MUA — bản kit v4.
 *
 * LỖI GỐC CỦA BẢN CŨ: màn tên là "Vật tư & GIÁ MUA", mô tả ghi rõ "Cung ứng
 * sửa trường mua hàng: NCC mặc định, VAT, loại quy đổi giá…" — nhưng BẢNG
 * KHÔNG CÓ CỘT NÀO trong số đó. Nó hiện "Tồn tối thiểu" và "Vị trí kệ": hai
 * cột của KHO, mà Cung ứng bị khoá không sửa được. Người mua mở màn của
 * chính mình ra và nhìn dữ liệu của phòng khác.
 *
 * ĐO ĐỘ PHỦ trên 13.226 mã (08/09/2026) để chọn cột — không đoán:
 *   po_template          13.037 (99%)   ← quyết định bộ cột khi soạn đơn
 *   spec                  4.423 (33%)   ← đi hỏi giá phải có
 *   last_purchase_price     955  (7%)
 *   price_unit              602
 *   default_supplier_id     166
 *   vat_rate                  0         ← ẩn, chưa ai điền
 *   pack_size                 0         ← ẩn
 *
 * Cột phủ 0% KHÔNG lên bảng; cột phủ thấp vẫn lên vì chính chỗ TRỐNG là việc
 * phải làm của người mua (thiếu giá = phải đi hỏi giá).
 *
 * KPI cũ bỏ hẳn: "KHỚP LỌC 13226 · ĐANG DÙNG 13226" là hai thẻ y hệt nhau,
 * và "CHƯA GÁN KỆ 13221" là việc của Kho, không phải của người mua.
 */

export type MaterialRow = {
  id: string
  code: string
  name: string
  unit: string
  spec: string | null
  group_name: string | null
  sub_group: string | null
  price_unit: string | null
  unit2_factor: number | null
  vat_rate: number | null
  default_supplier_id: string | null
  last_purchase_price: number | null
  po_template: string | null
  pack_size: number | null
  pack_unit: string | null
  is_active: boolean
  needs_review: boolean
}

export function MaterialsScreenV4({
  materials,
  suppliers,
  counts,
  canEdit,
}: {
  materials: MaterialRow[]
  suppliers: { id: string; name: string }[]
  counts: { total: number; active: number; noShelf: number; needsReview: number }
  canEdit: boolean
}) {
  const [q, setQ] = useState('')
  const [lane, setLane] = useState('all')
  const [sel, setSel] = useState<MaterialRow | null>(null)

  const nccById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers],
  )

  /*
    LANE = việc của người mua, không phải trường dữ liệu.

    "Chưa có giá" đứng đầu sau "Tất cả": đó là thứ chặn người mua cắt đơn.
    "Kho cần rà" giữ lại vì Cung ứng là người phát hiện sai lúc soạn đơn,
    dù sửa là việc của Kho.
  */
  const lanes = useMemo(
    () =>
      toLanes(materials, [
        { id: 'all', label: 'Tất cả', test: () => true },
        {
          id: 'no_price',
          label: 'Chưa có giá mua',
          tone: 'warn' as const,
          test: (m) => m.last_purchase_price == null,
        },
        {
          id: 'has_price',
          label: 'Đã có giá',
          test: (m) => m.last_purchase_price != null,
        },
        {
          id: 'no_spec',
          label: 'Thiếu quy cách',
          test: (m) => !m.spec,
        },
        {
          id: 'review',
          label: 'Kho cần rà',
          tone: 'stop' as const,
          test: (m) => m.needs_review,
        },
      ]),
    [materials],
  )

  const rows = useMemo(() => {
    const base = lanes.find((l) => l.id === lane)?.rows ?? []
    const kw = q.trim().toLowerCase()
    if (!kw) return base
    return base.filter(
      (m) =>
        m.code.toLowerCase().includes(kw) ||
        m.name.toLowerCase().includes(kw) ||
        m.spec?.toLowerCase().includes(kw),
    )
  }, [lanes, lane, q])

  // Cột nào cả trang không có gì thì ẩn — cùng luật hideEmptyCols của file Excel.
  const coGia = rows.some((m) => m.last_purchase_price != null)
  const coNcc = rows.some((m) => m.default_supplier_id)
  const coDvGia = rows.some((m) => m.price_unit)
  const anCot = [!coGia && 'giá mua', !coNcc && 'NCC mặc định', !coDvGia && 'ĐV tính giá']
    .filter(Boolean)
    .join(', ')

  const chuaGia = rows.filter((m) => m.last_purchase_price == null).length

  return (
    <ScreenFrame>
      <div className="kit-v4 flex min-h-0 flex-1 flex-col">
        <div className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] pt-4">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[var(--fs-micro)] font-semibold tracking-[.09em] text-[var(--ink-3)] uppercase">
                Cung ứng
              </div>
              <h1 className="mt-[3px] text-[var(--fs-title)] font-semibold tracking-[-.015em]">
                Vật tư &amp; giá mua
              </h1>
              <p className="mt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
                <b className="num text-[var(--ink)]">{counts.total.toLocaleString('vi-VN')}</b> mã
                trong danh mục dùng chung với Kho. Cung ứng giữ giá mua, NCC mặc định và
                mẫu đơn; tồn trữ do Kho quản.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canEdit && <Btn primary>+ Thêm vật tư</Btn>}
              <Menu
                items={[
                  { label: 'Xuất CSV' },
                  { label: 'Quản lý nhóm' },
                  { label: 'Nhập giá hàng loạt', disabled: !canEdit },
                ]}
              />
            </div>
          </div>
          <WorkLanes lanes={lanes} activeId={lane} onPick={setLane} />
        </div>

        <FilterBar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm mã, tên, quy cách…"
            width={280}
          />
          {anCot && (
            <Tip
              label={`Cả trang chưa mã nào có ${anCot} — cột tự hiện lại khi có dữ liệu`}
              side="bottom"
            >
              <span className="text-[var(--fs-micro)] text-[var(--ink-3)]">
                đã ẩn cột rỗng
              </span>
            </Tip>
          )}
          <div className="flex-1" />
          <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
            <b className="num text-[var(--act)]">{rows.length}</b> mã
            {chuaGia > 0 && (
              <>
                {' · '}
                <b className="num text-[var(--warn)]">{chuaGia}</b> chưa có giá
              </>
            )}
          </span>
        </FilterBar>

        <div className="flex min-h-0 flex-1" style={{ ["--table-min" as string]: "620px" }}>
          {rows.length === 0 ? (
            <Empty
              headline={q ? `Không có mã nào khớp “${q}”` : 'Nhóm này chưa có mã nào'}
              reason={
                q
                  ? 'Tìm theo mã vật tư, tên hoặc quy cách. Trang này chỉ tìm trong 50 mã đang hiển thị — dùng ô tìm của trang để tra toàn bộ danh mục.'
                  : 'Thử nhóm khác, hoặc bỏ lọc để xem tất cả.'
              }
              next={
                <>
                  {q && <Btn onClick={() => setQ('')}>Xoá từ khoá</Btn>}
                  <Btn primary onClick={() => setLane('all')}>
                    Xem tất cả
                  </Btn>
                </>
              }
            />
          ) : (
            <>
              <Table>
                <THead pinFirst>
                  <th style={{ width: 104 }}>Mã VT</th>
                  <th>Tên vật tư</th>
                  <th style={{ width: 118 }}>Quy cách</th>
                  <th style={{ width: 52 }}>ĐVT</th>
                  {coDvGia && <th style={{ width: 92 }}>Tính giá theo</th>}
                  {coGia && (
                    <th className="num" style={{ width: 120 }}>
                      Giá mua gần nhất
                    </th>
                  )}
                  {coNcc && <th style={{ width: 176 }}>NCC mặc định</th>}
                  <th style={{ width: 112 }}>Mẫu đơn</th>
                </THead>
                <tbody>
                  {rows.map((m) => (
                    <Row key={m.id} selected={sel?.id === m.id} onClick={() => setSel(m)}>
                      <Cell pin>
                        <Code>{m.code}</Code>
                      </Cell>
                      <Cell grow>
                        {m.name}
                        {!m.is_active && (
                          <span className="ml-2">
                            <Tag tone="stop">Ngừng dùng</Tag>
                          </span>
                        )}
                        {m.needs_review && (
                          <span className="ml-2">
                            <Tag tone="warn">Kho cần rà</Tag>
                          </span>
                        )}
                      </Cell>
                      <Cell muted>
                        {m.spec ?? (
                          // Thiếu quy cách là VIỆC, không phải ô trống: đi hỏi
                          // giá mà chỉ có tên thì NCC vẫn hỏi lại kích thước.
                          <span className="text-[var(--warn)]">chưa khai</span>
                        )}
                      </Cell>
                      <Cell muted>{m.unit}</Cell>
                      {coDvGia && (
                        <Cell muted>
                          {m.price_unit ? (
                            <Tip
                              label={`Giá tính theo ${m.price_unit}, không theo ${m.unit}`}
                              side="top"
                            >
                              <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[var(--act)]">
                                {m.price_unit}
                              </span>
                            </Tip>
                          ) : (
                            <span className="text-[var(--ink-3)]">theo ĐVT</span>
                          )}
                        </Cell>
                      )}
                      {coGia && (
                        <Cell num>
                          {m.last_purchase_price != null ? (
                            <Num value={showMoney(m.last_purchase_price)} strong />
                          ) : (
                            <span className="text-[11.5px] text-[var(--warn)]">
                              chưa mua
                            </span>
                          )}
                        </Cell>
                      )}
                      {coNcc && (
                        <Cell muted>
                          {m.default_supplier_id ? (
                            (nccById.get(m.default_supplier_id) ?? '—')
                          ) : (
                            <span className="text-[var(--ink-empty)]">—</span>
                          )}
                        </Cell>
                      )}
                      <Cell muted>{poTemplateMeta(m.po_template as never).label}</Cell>
                    </Row>
                  ))}
                </tbody>
              </Table>

              {sel && (
                <InspectPanel
                  code={sel.code}
                  title={sel.name}
                  subtitle={`${sel.spec ? sel.spec + ' · ' : ''}${sel.unit}`}
                  actions={
                    <>
                      <Btn primary href={`/planning/pos/new?material=${sel.id}`}>
                        Đặt mua mã này
                      </Btn>
                      <Btn href={`/planning/materials?q=${encodeURIComponent(sel.code)}`}>
                        Lịch sử giá
                      </Btn>
                      <Btn blockedBy={canEdit ? undefined : 'Cung ứng'}>Sửa giá mua</Btn>
                      <Btn blockedBy="Kho">Sửa tồn trữ &amp; vị trí kệ</Btn>
                    </>
                  }
                >
                  <InspectSection title="Mua thế nào">
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Đơn vị đặt</span>
                      <span className="num font-semibold">{sel.unit}</span>
                    </div>
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Tính tiền theo</span>
                      <span className="num font-semibold">
                        {sel.price_unit ?? sel.unit}
                      </span>
                    </div>
                    {sel.price_unit && sel.unit2_factor != null && (
                      // Quy đổi hai đơn vị là chỗ hay tính sai nhất khi soạn
                      // đơn — bày phép tính ra để người mua kiểm được.
                      <WhyBox
                        lines={[
                          `1 ${sel.unit} = ${showNum(sel.unit2_factor)} ${sel.price_unit}`,
                          `tiền = SL(${sel.unit}) × ${showNum(sel.unit2_factor)} × đơn giá/${sel.price_unit}`,
                        ]}
                        result={`giá nhập theo ${sel.price_unit}`}
                      />
                    )}
                    <div className="mt-2 flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Giá mua gần nhất</span>
                      {sel.last_purchase_price != null ? (
                        <span className="num text-[15px] font-bold text-[var(--act)]">
                          {showMoney(sel.last_purchase_price)} ₫
                        </span>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-[var(--warn)]">
                          chưa mua lần nào
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Mẫu đơn</span>
                      <span>{poTemplateMeta(sel.po_template as never).label}</span>
                    </div>
                  </InspectSection>

                  <InspectSection title="Phân loại">
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Nhóm</span>
                      <span className="text-right">{sel.group_name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Nhóm phụ</span>
                      <span className="text-right">{sel.sub_group ?? '—'}</span>
                    </div>
                    {!sel.spec && (
                      <p className="mt-2 text-[var(--fs-micro)] leading-relaxed text-[var(--warn)]">
                        Chưa khai quy cách. Đi hỏi giá mà chỉ có tên thì nhà cung cấp vẫn
                        hỏi lại độ dày / chiều dài — khai trước khi gửi đơn.
                      </p>
                    )}
                  </InspectSection>
                </InspectPanel>
              )}
            </>
          )}
        </div>
      </div>
    </ScreenFrame>
  )
}
