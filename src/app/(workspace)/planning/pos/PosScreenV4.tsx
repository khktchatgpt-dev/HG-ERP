'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  DocChain,
  Empty,
  FilterBar,
  InspectPanel,
  InspectSection,
  Menu,
  NextAction,
  Num,
  Row,
  ScreenFrame,
  SearchInput,
  Table,
  THead,
  Tag,
  Timeline,
  Tip,
  WorkLanes,
  buildPoMarks,
  daysHeld,
  isStale,
  poHolder,
  showMoney,
  toLanes,
} from '@/components/kit'
import { PO_STATUS_LABEL } from '@/lib/po-status'
import type { Po } from './po-types'

/**
 * ĐƠN ĐẶT VẬT TƯ — bản kit v4, màn xương sống của phòng Cung ứng.
 *
 * ĐÂY LÀ MÀN ĐẦU TIÊN DÙNG TẦNG LUỒNG. Hai màn trước (NCC, Vật tư) là danh
 * mục — không có vòng đời, không ai "giữ bóng". Đơn đặt hàng thì có: nó đi
 * qua tay Cung ứng -> Giám đốc -> NCC -> Kho.
 *
 * LỖI GỐC CỦA BẢN CŨ: bảng có cột "Trạng thái" nhưng KHÔNG có cột "ai đang
 * giữ". Hai thứ đó khác nhau:
 *
 *   Trạng thái  = đơn đang ở đâu          ("Chờ duyệt")
 *   Ai giữ      = đến lượt AI làm gì      ("Giám đốc, đã 6 ngày")
 *
 * Người mua nhìn 65 dòng "Nháp" không biết dòng nào là việc của mình, dòng
 * nào đang đợi người khác. Đo trong DB 09/09: 65/68 đơn nháp, 59/68 chưa có
 * hẹn giao — không phải "chờ hệ thống" mà là "chờ MỘT NGƯỜI".
 *
 * Cột "Ai đang giữ" tính bằng `poHolder()` ở kit — CÙNG hàm mà trang chi
 * tiết và màn "Chờ tôi xử lý" dùng, nên ba nơi không thể nói lệch nhau.
 */

export function PosScreenV4({
  pos,
  meId,
  canApprove,
  today,
}: {
  pos: Po[]
  meId: string | null
  canApprove: boolean
  /**
   * Ngày hôm nay dạng ISO, TÍNH Ở SERVER.
   *
   * Không gọi `Date.now()` trong render: server dựng HTML lúc 23:59 còn
   * trình duyệt tô lại lúc 00:01 thì ra hai con số ngày khác nhau và React
   * báo lệch. Lint `react-hooks/purity` chặn đúng chỗ này.
   */
  today: string
}) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Po | null>(null)

  const now = useMemo(() => new Date(today), [today])

  /*
    LANE MẶC ĐỊNH CHỌN THEO DỮ LIỆU, không đóng cứng 'mine'.

    Đo thật 09/09/2026: tài khoản admin không phụ trách đơn nào (65 đơn nháp
    chia cho 4 người khác), nên mở màn ra là bảng TRỐNG dù hệ thống có 68
    đơn. Empty state có giải thích tử tế, nhưng bắt người dùng đọc một đoạn
    văn rồi tự bấm sang nhóm khác — trong khi màn hình biết thừa nhóm nào có
    việc — là đẩy việc của máy sang cho người.

    Thứ tự ưu tiên = thứ tự cấp bách: việc của tôi -> việc kẹt lâu -> tất cả.
  */
  const laneMacDinh = useMemo(() => {
    if (pos.some((p) => poHolder(p, meId).mine)) return 'mine'
    if (pos.some((p) => isStale(poHolder(p, meId).since, now))) return 'stuck'
    return 'all'
  }, [pos, meId, now])

  const [laneChon, setLaneChon] = useState<string | null>(null)
  const lane = laneChon ?? laneMacDinh
  const setLane = setLaneChon

  /*
    LANE = HÀNG ĐỢI VIỆC, không phải bộ lọc trạng thái.

    Bản cũ chia tab theo tên trạng thái (Nháp · Chờ duyệt · Đã duyệt…) —
    đúng với cấu trúc dữ liệu nhưng sai với đầu người dùng. Người mua mở màn
    này lên hỏi "hôm nay tôi phải làm gì", không hỏi "đơn nào đang ở trạng
    thái draft".

    "Đến lượt tôi" đứng đầu và là lane MẶC ĐỊNH.
  */
  const lanes = useMemo(
    () =>
      toLanes(pos, [
        {
          id: 'mine',
          label: 'Đến lượt tôi',
          tone: 'warn' as const,
          test: (p) => poHolder(p, meId).mine,
        },
        {
          id: 'stuck',
          label: 'Nằm im ≥3 ngày',
          tone: 'stop' as const,
          // Người giữ nó nhiều khả năng KHÔNG BIẾT là mình đang giữ.
          test: (p) => isStale(poHolder(p, meId).since, now),
        },
        {
          id: 'others',
          label: 'Đang ở người khác',
          test: (p) => {
            const h = poHolder(p, meId)
            return !h.mine && h.who !== '—'
          },
        },
        {
          id: 'done',
          label: 'Đã xong · đã huỷ',
          test: (p) => p.status === 'received' || p.status === 'cancelled',
        },
        { id: 'all', label: 'Tất cả', test: () => true },
      ]),
    [pos, meId, now],
  )

  const rows = useMemo(() => {
    const base = lanes.find((l) => l.id === lane)?.rows ?? []
    const kw = q.trim().toLowerCase()
    if (!kw) return base
    return base.filter(
      (p) =>
        p.code.toLowerCase().includes(kw) ||
        p.supplier_name.toLowerCase().includes(kw) ||
        p.lsx_code?.toLowerCase().includes(kw),
    )
  }, [lanes, lane, q])

  /*
    CỘNG TIỀN THEO TỪNG LOẠI, không cộng chung.

    Cộng 24 đơn USD với 44 đơn VND ra một con số vô nghĩa mà nhìn vẫn như số
    thật — đúng thứ nguy hiểm hơn cả không hiện gì.
  */
  const tongTheoTien = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of rows) {
      if (!p.total) continue
      m.set(p.currency, (m.get(p.currency) ?? 0) + p.total)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

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
                Đơn đặt vật tư
              </h1>
              <p className="mt-1 text-[var(--fs-sm)] text-[var(--ink-2)]">
                Nhóm theo <b className="text-[var(--ink)]">ai đang giữ đơn</b>, không
                theo tên trạng thái — mở màn là thấy ngay việc của mình.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Btn primary href="/planning/pos/new">
                + Soạn đơn
              </Btn>
              <Menu items={[{ label: 'Xuất CSV' }, { label: 'Xem theo lệnh sản xuất' }]} />
            </div>
          </div>
          <WorkLanes lanes={lanes} activeId={lane} onPick={setLane} />
        </div>

        <FilterBar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm mã đơn, NCC, lệnh SX…"
            width={280}
          />
          <div className="flex-1" />
          <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
            <b className="num text-[var(--act)]">{rows.length}</b> đơn
            {tongTheoTien.map(([cur, v]) => (
              <span key={cur}>
                {' · '}
                <b className="num text-[var(--ink)]">{showMoney(v)}</b>{' '}
                <span className="text-[11px]">{cur}</span>
              </span>
            ))}
          </span>
        </FilterBar>

        <div
          className="flex min-h-0 flex-1"
          style={{ ['--table-min' as string]: '760px' }}
        >
          {rows.length === 0 ? (
            <Empty
              headline={
                q
                  ? `Không đơn nào khớp “${q}”`
                  : lane === 'mine'
                    ? 'Không có đơn nào đang chờ bạn'
                    : 'Nhóm này trống'
              }
              reason={
                lane === 'mine' && !q
                  ? 'Mọi đơn của bạn đã chuyển sang bàn người khác — Giám đốc duyệt, NCC giao, hoặc Kho nhận. Xem nhóm “Đang ở người khác” để biết đơn nào kẹt lâu.'
                  : 'Thử nhóm khác hoặc bỏ từ khoá.'
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
                  <th style={{ width: 116 }}>Mã đơn</th>
                  <th>Nhà cung cấp</th>
                  <th style={{ width: 104 }}>Lệnh SX</th>
                  <th className="num" style={{ width: 116 }}>
                    Giá trị
                  </th>
                  <th style={{ width: 196 }}>Ai đang giữ</th>
                  <th style={{ width: 84 }}>Về kho</th>
                </THead>
                <tbody>
                  {rows.map((p) => {
                    const h = poHolder(p, meId)
                    const ngay = daysHeld(h.since, now)
                    const lau = isStale(h.since, now)
                    const xong = p.status === 'received' || p.status === 'cancelled'
                    return (
                      <Row
                        key={p.id}
                        selected={sel?.id === p.id}
                        onClick={() => setSel(p)}
                      >
                        <Cell pin>
                          <Code>{p.code}</Code>
                        </Cell>
                        <Cell grow>{p.supplier_name}</Cell>
                        <Cell muted>
                          {p.lsx_code ?? (
                            <Tip label="Đơn mua ngoài lệnh sản xuất — vật tư tiêu hao / dùng chung">
                              <span className="text-[var(--ink-3)]">ngoài LSX</span>
                            </Tip>
                          )}
                        </Cell>
                        {/*
                          ĐƠN VỊ TIỀN PHẢI ĐI KÈM SỐ.

                          Đo 09/09/2026: 44 đơn VND + 24 đơn USD nằm chung
                          một cột. Không ghi đơn vị thì 16.831 USD (~440
                          triệu) trông NHỎ HƠN 82.400 VND — người mua đọc
                          ngược hoàn toàn thứ tự lớn nhỏ.

                          Ký hiệu để nhạt và nhỏ: con số vẫn là nhân vật
                          chính, đơn vị chỉ cần đủ để mắt phân biệt hai hệ.
                        */}
                        <Cell num>
                          {p.total ? (
                            <span className="whitespace-nowrap">
                              <span className="num font-semibold">
                                {showMoney(p.total)}
                              </span>
                              <span className="ml-1 text-[10.5px] text-[var(--ink-3)]">
                                {p.currency}
                              </span>
                            </span>
                          ) : (
                            <Num value="" zero="zero" />
                          )}
                        </Cell>
                        {/*
                          CỘT THAY THẾ "Trạng thái".

                          "Chờ duyệt" nói đơn ở đâu; "Giám đốc · 6 ngày" nói
                          phải đi gõ cửa ai. Cột thứ hai mới dùng được.
                        */}
                        <Cell>
                          {xong ? (
                            <span className="text-[11.5px] text-[var(--ink-3)]">
                              {PO_STATUS_LABEL[p.status]}
                            </span>
                          ) : (
                            <span className="flex items-baseline gap-1.5">
                              {h.mine ? (
                                <Tag tone="warn">Lượt bạn</Tag>
                              ) : (
                                <span className="text-[12px] text-[var(--ink-2)]">
                                  {h.who}
                                </span>
                              )}
                              {ngay != null && (
                                <span
                                  className={
                                    lau
                                      ? 'num text-[11px] font-semibold text-[var(--stop)]'
                                      : 'num text-[11px] text-[var(--ink-3)]'
                                  }
                                >
                                  {ngay === 0 ? 'hôm nay' : `${ngay}n`}
                                </span>
                              )}
                            </span>
                          )}
                        </Cell>
                        <Cell num muted>
                          {p.lines_total ? (
                            <span
                              className={
                                p.lines_done === p.lines_total
                                  ? 'num text-[var(--done)]'
                                  : 'num'
                              }
                            >
                              {p.lines_done}/{p.lines_total}
                            </span>
                          ) : (
                            <span className="text-[var(--ink-empty)]">—</span>
                          )}
                        </Cell>
                      </Row>
                    )
                  })}
                </tbody>
              </Table>

              {sel && (
                <InspectPanel
                  code={sel.code}
                  title={sel.supplier_name}
                  subtitle={`${PO_STATUS_LABEL[sel.status]}${sel.lsx_code ? ` · LSX ${sel.lsx_code}` : ' · ngoài LSX'}`}
                  actions={
                    <>
                      <Btn primary href={`/planning/pos/${sel.id}`}>
                        Mở đơn
                      </Btn>
                      <Btn href={`/planning/suppliers/${sel.supplier_id}`}>
                        Hồ sơ nhà cung cấp
                      </Btn>
                      {sel.status === 'pending_approval' && !canApprove && (
                        <Btn blockedBy="Giám đốc">Duyệt đơn</Btn>
                      )}
                    </>
                  }
                >
                  {/* AI GIỮ đặt TRƯỚC mọi con số: người mở đơn hỏi "tôi có
                      phải làm gì không" trước khi hỏi "đơn này bao nhiêu". */}
                  <div className="mb-3">
                    <NextAction
                      mine={poHolder(sel, meId).mine}
                      holder={poHolder(sel, meId).who}
                      what={poHolder(sel, meId).what}
                      days={daysHeld(poHolder(sel, meId).since, now)}
                      hint={
                        isStale(poHolder(sel, meId).since, now)
                          ? 'Nằm im quá lâu — nhiều khả năng người giữ chưa biết đơn đang chờ họ.'
                          : undefined
                      }
                    />
                  </div>

                  <InspectSection title="Chuỗi chứng từ">
                    <DocChain
                      links={[
                        ...(sel.order_code
                          ? [
                              {
                                label: 'Đơn khách',
                                code: sel.order_code,
                                href: '/sales/orders',
                              },
                            ]
                          : []),
                        ...(sel.lsx_code
                          ? [
                              {
                                label: 'Lệnh SX',
                                code: sel.lsx_code,
                                href: '/planning/lsx',
                              },
                            ]
                          : []),
                        { label: 'Đơn đặt', code: sel.code, muted: true },
                      ]}
                    />
                  </InspectSection>

                  <InspectSection title="Tiền & tiến độ">
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Giá trị</span>
                      <span className="num text-[15px] font-bold">
                        {showMoney(sel.total ?? 0)} {sel.currency}
                      </span>
                    </div>
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Về kho</span>
                      <span className="num font-semibold">
                        {sel.lines_total
                          ? `${sel.lines_done}/${sel.lines_total} dòng`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Hẹn giao</span>
                      {sel.expected_at ? (
                        <span className="num">{sel.expected_at.slice(0, 10)}</span>
                      ) : (
                        // 59/68 đơn thiếu hẹn giao — đó là VIỆC, không phải ô trống.
                        <span className="text-[12px] font-semibold text-[var(--warn)]">
                          chưa hẹn ngày
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between py-[3px] text-[12.5px]">
                      <span className="text-[var(--ink-2)]">Phụ trách</span>
                      <span>{sel.assignee_name ?? '—'}</span>
                    </div>
                  </InspectSection>

                  <InspectSection title="Đã đi tới đâu">
                    <Timeline
                      marks={buildPoMarks(sel, { creatorName: sel.assignee_name })}
                    />
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
