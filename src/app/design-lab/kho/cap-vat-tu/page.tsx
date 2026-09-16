'use client'

import { useState } from 'react'
import {
  Btn,
  Code,
  CoverageBar,
  Empty,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Tag,
  WorkLanes,
  toLanes,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { LSXS, type Lsx, type NeedLine, covered, done, m, n } from '../_kho/data'

/**
 * KHO · MÀN 5 — CẤP VẬT TƯ CHO SẢN XUẤT (Khuôn B).
 *
 * Câu hỏi: "lệnh nào chờ cấp, thiếu gì, thiếu thì gỡ bằng cách nào?".
 *
 * LUẬT DUY NHẤT CỦA MÀN NÀY, và là luật khó nhất trong cả phân hệ:
 * **KHÔNG BAO GIỜ CHỈ NÓI "KHÔNG ĐỦ TỒN".**
 *
 * Mỗi dòng thiếu phải nói ba thứ: thiếu BAO NHIÊU · hàng ĐANG Ở ĐÂU · gỡ
 * THẾ NÀO, kèm đường bấm đi tiếp. "Không đủ tồn" đúng về mặt dữ liệu và vô
 * dụng về mặt nghiệp vụ — thủ kho vẫn phải đi hỏi ba người mới biết phải làm
 * gì, và đó chính là lúc người ta bỏ hệ thống quay về gọi điện.
 *
 * SỐ DÙNG ĐỂ TÍNH ĐỦ/THIẾU LUÔN LÀ **DÙNG ĐƯỢC**, không phải tổng tồn. Lô
 * đang chờ kiểm hay đang khoá có mặt trong sổ, đếm được, nhưng không được
 * cộng vào phần cấp đi được — cộng vào là hệ thống hứa một thứ mà nhà kho
 * không giao nổi.
 *
 * `CoverageBar` đếm theo SỐ MÃ ĐỦ, không theo phần trăm khối lượng: thiếu
 * một con ốc cũng là chưa chạy được chuyền, và 97% khối lượng nghe như sắp
 * xong trong khi thực tế là đứng.
 */

const LANES = toLanes(LSXS, [
  { id: 'late', label: 'Quá ngày vào chuyền', tone: 'stop', test: (l: Lsx) => l.inDays < 0 }, // prettier-ignore
  { id: 'soon', label: 'Sắp vào chuyền', tone: 'warn', test: (l: Lsx) => l.inDays >= 0 }, // prettier-ignore
])

/** Nhãn trạng thái của một dòng nhu cầu — bốn tình huống, không gộp. */
function lineMark(l: NeedLine) {
  if (done(l)) return { icon: '✓', tone: 'done' as const, text: 'đã cấp đủ' }
  if (l.stuck?.where === 'qc')
    return { icon: '⏸', tone: 'warn' as const, text: 'hàng có nhưng chờ kiểm' }
  if (l.stuck?.where === 'blocked')
    return { icon: '⚑', tone: 'stop' as const, text: 'một phần đang khoá' }
  return { icon: '⛔', tone: 'stop' as const, text: 'chưa có hàng' }
}

const TONE_VAR = { done: 'var(--done)', warn: 'var(--warn)', stop: 'var(--stop)' }

export default function Page() {
  const [lane, setLane] = useState('late')
  const [open, setOpen] = useState<string[]>(['l3', 'l1'])
  const rows = LANES.find((l) => l.id === lane)?.rows ?? []
  const toggle = (id: string) =>
    setOpen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn B — Cấp vật tư.</b> Luật khó nhất của phân hệ nằm ở đây:{' '}
          <b>không bao giờ chỉ nói “không đủ tồn”</b>. Mỗi dòng thiếu nói thiếu bao nhiêu,
          hàng đang mắc ở đâu, và gỡ thế nào — kèm nút đi tiếp. Số dùng để tính đủ/thiếu
          luôn là <b>DÙNG ĐƯỢC</b>, không phải tổng tồn.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Cấp vật tư cho sản xuất"
        title="Lệnh chờ cấp"
        facts={[
          { label: 'Lệnh', value: String(LSXS.length) },
          { label: 'Quá ngày vào chuyền', value: String(LANES[0].rows.length), tone: 'stop' }, // prettier-ignore
          { label: 'Mã còn thiếu', value: String(LSXS.flatMap((l) => l.lines).filter((x) => !done(x)).length), tone: 'warn' }, // prettier-ignore
        ]}
        actions={<Btn href="/design-lab/kho">Về bàn làm việc</Btn>}
      >
        <WorkLanes lanes={LANES} activeId={lane} onPick={setLane} />
      </ScreenHeader>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface)] px-[var(--gutter)] py-[13px]">
        {rows.length === 0 ? (
          <Empty
            headline="Làn này đang trống"
            reason="Không có lệnh nào rơi vào khoảng thời gian của làn đang chọn."
            next={<Btn onClick={() => setLane('late')}>Xem làn Quá ngày</Btn>}
          />
        ) : (
          <div className="flex flex-col gap-[13px]">
            {rows.map((x) => {
              const short = x.lines.filter((l) => !done(l))
              const isOpen = open.includes(x.id)
              return (
                <section
                  key={x.id}
                  className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]"
                >
                  <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[12px] py-[9px]">
                    <Code>{x.code}</Code>
                    <b className="text-[var(--fs-body)]">{x.product}</b>
                    <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                      {x.qty} · vào chuyền {x.start}
                      {x.inDays < 0 && (
                        <b className="text-[var(--stop)]"> · quá {-x.inDays} ngày</b>
                      )}
                    </span>

                    <div className="min-w-[190px] flex-1">
                      <CoverageBar
                        ratio={covered(x) / x.lines.length}
                        label={`đủ ${covered(x)}/${x.lines.length} mã`}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {/*
                        "CẤP PHẦN ĐỦ" là hành động thật, không phải cho vui:
                        chuyền chạy được một phần còn hơn đứng chờ đủ bộ. ERP
                        nào cũng có (Odoo "Check availability" + partial
                        delivery, SAP partial GI). Bỏ nó đi là ép thủ kho hoặc
                        cấp chui hoặc bắt xưởng chờ.
                      */}
                      <Btn
                        primary
                        disabled={short.length === x.lines.length}
                        title={
                          short.length === x.lines.length
                            ? 'Chưa có mã nào đủ để cấp'
                            : undefined
                        }
                      >
                        Cấp {x.lines.length - covered(x) > 0 ? 'phần đủ' : 'nốt'}
                      </Btn>
                      <Btn onClick={() => toggle(x.id)}>
                        {isOpen ? 'Thu gọn' : `Chi tiết ${x.lines.length} mã`}
                      </Btn>
                    </div>
                  </header>

                  {isOpen && (
                    <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                      {x.lines.map((l) => {
                        const mark = lineMark(l)
                        const mat = m(l.code)
                        return (
                          <div key={l.code} className="px-[12px] py-[8px]">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span
                                className="w-[14px] shrink-0 text-center text-[13px]"
                                style={{ color: TONE_VAR[mark.tone] }}
                                title={mark.text}
                                aria-label={mark.text}
                              >
                                {mark.icon}
                              </span>
                              <b className="num text-[var(--fs-body)]">{l.code}</b>
                              <span className="min-w-[160px] flex-1 truncate text-[var(--fs-sm)] text-[var(--ink-3)]">
                                {mat.name}
                              </span>
                              <span className="num text-[var(--fs-sm)]">
                                cần <b>{n(l.need)}</b> {mat.unit}
                              </span>
                              <span className="num text-[var(--fs-sm)] text-[var(--ink-3)]">
                                đã cấp {n(l.issued)}
                              </span>
                              <span
                                className="num text-[var(--fs-sm)]"
                                title="Tồn DÙNG ĐƯỢC — không gồm lô đang chờ kiểm hay đang khoá"
                              >
                                dùng được <b>{n(l.usable)}</b>
                              </span>
                              {done(l) ? (
                                <Tag tone="done">xong</Tag>
                              ) : (
                                <Tag tone={mark.tone === 'warn' ? 'warn' : 'stop'}>
                                  còn {n(l.need - l.issued)}
                                </Tag>
                              )}
                            </div>

                            {/*
                              ĐƯỜNG GỠ — bắt buộc có khi dòng không đủ. Đây là
                              chỗ phân biệt màn dùng được với màn chỉ đúng.
                            */}
                            {!done(l) && l.fix && (
                              <div className="mt-[5px] flex flex-wrap items-center gap-2 pl-[26px]">
                                <span
                                  className="leading-snug text-[var(--fs-sm)]"
                                  style={{ color: TONE_VAR[mark.tone] }}
                                >
                                  → {l.fix}
                                </span>
                                {l.stuck?.where === 'qc' && <Btn>Báo KCS kiểm lô</Btn>}
                                {l.stuck?.where === 'blocked' && (
                                  <Btn href="/design-lab/kho/ton">Xem lô khoá</Btn>
                                )}
                                {!l.stuck && <Btn>Xin mua gấp</Btn>}
                                <Btn>Cắt chỗ của lệnh khác</Btn>
                              </div>
                            )}
                            {!done(l) && l.stuck && (
                              <div className="mt-[3px] pl-[26px] text-[11.5px] text-[var(--ink-3)]">
                                Lô {n(l.stuck.qty)} {mat.unit} — {l.stuck.note}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}

        <p className="mt-[13px] max-w-[74ch] leading-relaxed text-[var(--fs-sm)] text-[var(--ink-3)]">
          Bốn nhãn dòng là <b>bốn tình huống khác nhau</b> và không được gộp: đã cấp đủ ·
          hàng có nhưng chờ kiểm · một phần đang khoá · chưa có hàng. Gộp ba cái sau thành
          “thiếu” thì thủ kho mất đúng thông tin quyết định việc phải làm tiếp — đi nhắc
          KCS, đi hỏi Cung ứng, hay đi xin mua.
        </p>
      </div>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính',
        ]}
        right={`${rows.length} lệnh trong làn · ${LSXS.flatMap((l) => l.lines).filter((l) => !done(l)).length} mã còn thiếu`}
      />
    </ScreenFrame>
  )
}
