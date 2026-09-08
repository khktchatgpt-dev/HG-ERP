'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Code,
  Empty,
  FilterBar,
  InspectPanel,
  InspectSection,
  Menu,
  Num,
  Row,
  SearchInput,
  Table,
  THead,
  Tag,
  Tip,
  WorkLanes,
  showMoney,
  showNum,
  toLanes,
  type Tone,
} from '@/components/kit'

/**
 * NHÀ CUNG CẤP — bản kit v4.
 *
 * ĐO ĐƯỢC TRÊN BẢN CŨ (164 NCC thật, màn 1500×1000, 08/09/2026):
 *
 *  1. DỮ LIỆU ĐÃ TÍNH MÀ KHÔNG BÀY. `page.tsx` join sẵn `po_count`,
 *     `open_po_count`, `last_po`, `last_po_at`, `total_spend` cho từng NCC —
 *     bảng KHÔNG hiện cột nào trong số đó. Câu hỏi thật của người cung ứng là
 *     "ông này làm ăn thế nào, còn đơn nào đang treo không", và màn NCC là
 *     chỗ duy nhất trả lời được; bản cũ bắt họ mở từng hồ sơ để xem.
 *
 *  2. HAI CỘT RỖNG HOÀN TOÀN. "Nhóm hàng" và "Trạng thái" là dấu "–" ở cả
 *     164 dòng (chưa ai gắn nhóm, chưa ai ngừng giao dịch NCC nào). Hai cột
 *     chiếm ~1/3 bề ngang để nói "không có gì".
 *
 *  3. KPI NÓI ĐIỀU LUÔN ĐÚNG. Thẻ "ĐANG GIAO DỊCH 164" trên tổng 164 — một
 *     khối lớn cho con số không bao giờ khác tổng. Ở v4 nó thành LANE có số
 *     đếm: cùng thông tin, không tốn khối riêng, và bấm được để lọc.
 *
 *  4. 49px MỘT DÒNG cho đúng một dòng chữ → thấy 15/164 NCC.
 *
 * BẢN NÀY: 6 cột đều CÓ SỐ, dòng 34px, khay kiểm tra bày lịch sử mua khi
 * chọn một NCC. Không thêm truy vấn nào — chỉ dùng dữ liệu `page.tsx` đã nạp.
 */

export type SupplierRow = {
  id: string
  code: string | null
  name: string
  tax_no: string | null
  type: string | null
  status: string
  region: string | null
  can_order: boolean
  is_active: boolean
  po_count: number
  open_po_count: number
  last_po: string | null
  last_po_at: string | null
  total_spend: number
  groups: string[]
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Hoạt động', tone: 'done' },
  suspended: { label: 'Tạm ngưng', tone: 'warn' },
  terminated: { label: 'Ngừng hợp tác', tone: 'stop' },
}

/** Ngày dạng dd/mm/yy — cột hẹp, và năm đầy đủ không nói thêm gì ở đây. */
const dmy = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''

/**
 * "Bao lâu chưa mua" — con số người mua thật sự cần khi rà lại danh sách NCC.
 * Ngày mua cuối là dữ kiện; số ngày im lặng mới là tín hiệu.
 */
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return d < 0 ? 0 : d
}

export function SuppliersScreenV4({
  suppliers,
  canEdit,
}: {
  suppliers: SupplierRow[]
  canEdit: boolean
}) {
  const [q, setQ] = useState('')
  const [lane, setLane] = useState('all')
  const [sel, setSel] = useState<SupplierRow | null>(null)

  /*
    LANE = câu hỏi người dùng đang hỏi, không phải trường dữ liệu.

    "Còn đơn treo" đứng trước "Đã từng mua" có chủ ý: NCC đang giữ đơn dở
    dang là việc còn phải theo, còn danh sách đã từng mua chỉ là tra cứu.
  */
  const lanes = useMemo(
    () =>
      toLanes(suppliers, [
        { id: 'all', label: 'Tất cả', test: () => true },
        {
          id: 'open',
          label: 'Còn đơn treo',
          tone: 'warn' as const,
          test: (s) => s.open_po_count > 0,
        },
        { id: 'used', label: 'Đã từng mua', test: (s) => s.po_count > 0 },
        {
          id: 'never',
          label: 'Chưa mua lần nào',
          test: (s) => s.po_count === 0,
        },
        {
          id: 'blocked',
          label: 'Khoá đặt hàng',
          tone: 'stop' as const,
          test: (s) => !s.can_order || !s.is_active,
        },
      ]),
    [suppliers],
  )

  const rows = useMemo(() => {
    const base = lanes.find((l) => l.id === lane)?.rows ?? []
    const kw = q.trim().toLowerCase()
    const list = kw
      ? base.filter(
          (s) =>
            s.name.toLowerCase().includes(kw) ||
            s.code?.toLowerCase().includes(kw) ||
            s.tax_no?.toLowerCase().includes(kw),
        )
      : base
    // Xếp NCC MUA NHIỀU NHẤT lên trước: danh sách 164 dòng xếp theo bảng chữ
    // cái thì "Cá nhân — Anh Cảnh" chiếm hết đầu bảng còn NCC chính nằm đâu
    // đó giữa danh sách. Trật tự CỐ ĐỊNH (không đổi theo lane) để giữ trí nhớ
    // vị trí — xem luật thứ tự khối ở kit v4.
    return [...list].sort(
      (a, b) =>
        b.open_po_count - a.open_po_count ||
        b.total_spend - a.total_spend ||
        a.name.localeCompare(b.name, 'vi'),
    )
  }, [lanes, lane, q])

  const tongChi = rows.reduce((s, r) => s + r.total_spend, 0)
  const donTreo = rows.reduce((s, r) => s + r.open_po_count, 0)

  /*
    CỘT KHÔNG CÓ GÌ THÌ ĐỪNG BÀY — cùng luật `hideEmptyCols` của file Excel.
    Đo 08/09/2026: chưa NCC nào được gắn nhóm hàng, nên cột "Nhóm hàng" là
    164 dấu gạch ngang chiếm ~9% bề ngang. Ẩn CHỨ KHÔNG XOÁ: gắn nhóm cho
    một NCC là cột tự hiện lại, không phải sửa code.
  */
  const coNhomHang = rows.some((r) => r.groups.length > 0)
  const coKhoa = rows.some((r) => !r.can_order || !r.is_active || r.status !== 'active')

  return (
    <div className="kit-v4 -m-4 flex min-h-[calc(100vh-3.5rem)] flex-col md:-m-6">
      <div className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] pt-4">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[var(--fs-micro)] font-semibold tracking-[.09em] text-[var(--ink-3)] uppercase">
              Cung ứng
            </div>
            <h1 className="mt-[3px] text-[var(--fs-title)] font-semibold tracking-[-.015em]">
              Nhà cung cấp
            </h1>
            <p className="mt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
              Mỗi đơn đặt vật tư gắn đúng một NCC. Xếp theo đơn đang treo, rồi tổng chi.
            </p>
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              <Btn primary>+ Thêm NCC</Btn>
              <Menu
                items={[
                  { label: 'Xuất Excel' },
                  { label: 'Nhập từ file' },
                  { label: 'Gộp NCC trùng', disabled: true },
                ]}
              />
            </div>
          )}
        </div>
        <WorkLanes lanes={lanes} activeId={lane} onPick={setLane} />
      </div>

      <FilterBar>
        <SearchInput value={q} onChange={setQ} placeholder="Tìm tên, mã, mã số thuế…" />
        {!coNhomHang && (
          <Tip label="Chưa NCC nào được gắn nhóm hàng — cột tự hiện lại khi có dữ liệu" side="bottom">
            <span className="text-[var(--fs-micro)] text-[var(--ink-3)]">đã ẩn 1 cột rỗng</span>
          </Tip>
        )}
        <div className="flex-1" />
        {/* Tổng của phần ĐANG XEM, không phải của cả bảng — người dùng vừa lọc
            xong thì con số phải nói về cái họ đang nhìn. */}
        <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
          <b className="num text-[var(--act)]">{rows.length}</b> NCC
          {donTreo > 0 && (
            <>
              {' · '}
              <b className="num text-[var(--warn)]">{donTreo}</b> đơn treo
            </>
          )}
          {tongChi > 0 && (
            <>
              {' · '}
              <b className="num text-[var(--ink)]">{showMoney(tongChi)}</b> ₫ đã chi
            </>
          )}
        </span>
      </FilterBar>

      <div className="flex min-h-0 flex-1">
        {rows.length === 0 ? (
          <Empty
            headline={q ? `Không có NCC nào khớp “${q}”` : 'Chưa có nhà cung cấp nào ở nhóm này'}
            reason={
              q
                ? 'Tìm theo tên, mã NCC hoặc mã số thuế. Dấu tiếng Việt không bắt buộc gõ đúng.'
                : 'Nhóm này chưa có NCC nào — thử nhóm khác hoặc thêm mới.'
            }
            next={
              <>
                {q && <Btn onClick={() => setQ('')}>Xoá từ khoá</Btn>}
                <Btn primary={!q} onClick={() => setLane('all')}>
                  Xem tất cả {suppliers.length} NCC
                </Btn>
              </>
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <th style={{ width: 92 }}>Mã</th>
                <th>Tên nhà cung cấp</th>
                {coNhomHang && <th style={{ width: 132 }}>Nhóm hàng</th>}
                <th className="num" style={{ width: 74 }}>Đơn treo</th>
                <th className="num" style={{ width: 68 }}>Đã mua</th>
                <th className="num" style={{ width: 132 }}>Tổng chi</th>
                <th style={{ width: 118 }}>Mua lần cuối</th>
                {coKhoa && <th style={{ width: 104 }}>Tình trạng</th>}
              </THead>
              <tbody>
                {rows.map((s) => {
                  const st = STATUS[s.status] ?? { label: s.status, tone: 'neutral' as Tone }
                  const im = daysSince(s.last_po_at)
                  return (
                    <Row key={s.id} selected={sel?.id === s.id} onClick={() => setSel(s)}>
                      <Cell>
                        {s.code ? <Code>{s.code}</Code> : <span className="text-[var(--ink-empty)]">—</span>}
                      </Cell>
                      <Cell grow>{s.name}</Cell>
                      {coNhomHang && (
                        <Cell muted>
                          {s.groups.length > 1 ? (
                            <Tip label={s.groups.join(' · ')} side="top">
                              <span>
                                {s.groups[0]}{' '}
                                <span className="text-[var(--ink-3)]">+{s.groups.length - 1}</span>
                              </span>
                            </Tip>
                          ) : (
                            (s.groups[0] ?? <span className="text-[var(--ink-empty)]">—</span>)
                          )}
                        </Cell>
                      )}
                      <Cell num>
                        {/* Đơn treo là VIỆC CÒN PHẢI THEO — tô cảnh báo, và 0
                            hiện ✓ thay vì gạch ngang (hết việc ≠ thiếu số). */}
                        {s.open_po_count > 0 ? (
                          <span className="num text-[var(--fs-num)] font-bold text-[var(--warn)]">
                            {s.open_po_count}
                          </span>
                        ) : (
                          <Num value="" zero="done" />
                        )}
                      </Cell>
                      <Cell num>
                        <Num value={showNum(s.po_count)} zero="zero" />
                      </Cell>
                      <Cell num>
                        <Num value={showMoney(s.total_spend)} strong zero="zero" />
                      </Cell>
                      <Cell muted>
                        {s.last_po_at ? (
                          <>
                            {dmy(s.last_po_at)}
                            {im != null && im > 90 && (
                              <span className="ml-1.5 text-[var(--warn)]" title={`${im} ngày chưa mua`}>
                                {Math.floor(im / 30)}th
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--ink-empty)]">chưa mua</span>
                        )}
                      </Cell>
                      {coKhoa && (
                        <Cell>
                          {!s.can_order || !s.is_active ? (
                            <Tag tone="stop">Khoá đặt hàng</Tag>
                          ) : s.status !== 'active' ? (
                            <Tag tone={st.tone}>{st.label}</Tag>
                          ) : (
                            <span className="text-[var(--ink-empty)]">—</span>
                          )}
                        </Cell>
                      )}
                    </Row>
                  )
                })}
              </tbody>
            </Table>

            {sel && (
              <InspectPanel
                code={sel.code ?? '—'}
                title={sel.name}
                subtitle={sel.tax_no ? `MST ${sel.tax_no}` : undefined}
                actions={
                  <>
                    <Btn primary href={`/planning/pos/new?supplier=${sel.id}`}>
                      Soạn đơn cho NCC này
                    </Btn>
                    <Btn href={`/planning/suppliers/${sel.id}`}>Mở hồ sơ đầy đủ</Btn>
                    <Btn blockedBy={canEdit ? undefined : 'Cung ứng'}>Sửa bảng giá</Btn>
                  </>
                }
              >
                <InspectSection title="Làm ăn thế nào">
                  <div className="flex justify-between py-[3px] text-[12.5px]">
                    <span className="text-[var(--ink-2)]">Đã mua</span>
                    <span className="num font-semibold">{sel.po_count} đơn</span>
                  </div>
                  <div className="flex justify-between py-[3px] text-[12.5px]">
                    <span className="text-[var(--ink-2)]">Còn treo</span>
                    <span
                      className={`num font-semibold ${sel.open_po_count > 0 ? 'text-[var(--warn)]' : 'text-[var(--done)]'}`}
                    >
                      {sel.open_po_count > 0 ? `${sel.open_po_count} đơn` : 'không'}
                    </span>
                  </div>
                  <div className="flex justify-between py-[3px] text-[12.5px]">
                    <span className="text-[var(--ink-2)]">Tổng chi</span>
                    <span className="num text-[15px] font-bold text-[var(--act)]">
                      {showMoney(sel.total_spend) || '0'} ₫
                    </span>
                  </div>
                  {sel.last_po && (
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Đơn gần nhất</span>
                      <Code>{sel.last_po}</Code>
                    </div>
                  )}
                  {sel.last_po_at && (
                    <p className="mt-2 text-[var(--fs-micro)] text-[var(--ink-3)]">
                      Mua lần cuối {dmy(sel.last_po_at)}
                      {(() => {
                        const d = daysSince(sel.last_po_at)
                        return d != null && d > 90 ? ` — đã ${Math.floor(d / 30)} tháng không đặt hàng.` : '.'
                      })()}
                    </p>
                  )}
                </InspectSection>

                <InspectSection title="Hồ sơ">
                  <div className="flex justify-between py-[3px] text-[12.5px]">
                    <span className="text-[var(--ink-2)]">Loại</span>
                    <span>{sel.type ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-[3px] text-[12.5px]">
                    <span className="text-[var(--ink-2)]">Khu vực</span>
                    <span>{sel.region ?? '—'}</span>
                  </div>
                  <div className="flex justify-between py-[3px] text-[12.5px]">
                    <span className="text-[var(--ink-2)]">Nhóm hàng</span>
                    <span className="text-right">
                      {sel.groups.length > 0 ? sel.groups.join(', ') : '—'}
                    </span>
                  </div>
                  {!sel.can_order && (
                    <p className="mt-2 text-[var(--fs-micro)] leading-relaxed text-[var(--stop)]">
                      NCC này đang bị khoá đặt hàng. Đơn mới sẽ bị chặn ở bước lưu — mở
                      khoá trong hồ sơ trước khi soạn.
                    </p>
                  )}
                </InspectSection>
              </InspectPanel>
            )}
          </>
        )}
      </div>
    </div>
  )
}
