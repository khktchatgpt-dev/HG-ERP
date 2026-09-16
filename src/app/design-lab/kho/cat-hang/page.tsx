'use client'

import { useState } from 'react'
import {
  Btn,
  Code,
  Empty,
  Pick,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Tag,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { PUTAWAY, m, n } from '../_kho/data'

/**
 * KHO · MÀN 4 — CHỜ CẤT.
 *
 * Câu hỏi: "còn gì đang nằm ở khu tiếp nhận?".
 *
 * VÌ SAO TÁCH KHỎI PHIẾU NHẬP — và đây là quyết định thiết kế đáng cãi nhau
 * nhất của cả phân hệ: nhận hàng và cất hàng là HAI LẦN ĐI LẠI, hai thời
 * điểm, có khi hai người. Gộp vào một form là bắt thủ kho đứng ở bàn quyết
 * chỗ để cho thứ chưa nhìn thấy, rồi lúc ra bãi mới biết kệ đã đầy. Odoo gọi
 * là *receipt hai bước*, Dynamics gọi là *Put-away*.
 *
 * KHÔNG CẦN BẢNG TRẠNG THÁI "CHỜ CẤT". Việc chờ cất là một CÂU TRUY VẤN —
 * còn gì đang nằm ở kệ ảo `TIEP-NHAN` — chứ không phải một cờ phải nuôi. Cất
 * xong là một phiếu chuyển kệ `TIEP-NHAN → kệ thật`, và dòng tự rời màn này.
 * Đúng tiêu chí "trạng thái suy ra thì không bao giờ lưu".
 *
 * MÀN NÀY PHẢI DÙNG ĐƯỢC BẰNG MỘT TAY TRÊN ĐIỆN THOẠI — người làm việc này
 * đang đẩy xe hàng tới kệ, không ngồi ở bàn. Đó là lý do bố cục là THẺ XẾP
 * DỌC chứ không phải lưới: lưới 9 cột trên màn 390px là lưới cuộn ngang, và
 * cuộn ngang bằng một tay trong khi tay kia giữ xe là không dùng được.
 */

const BINS = [
  { value: '', label: '— chọn kệ —' },
  { value: 'NHOM-A1', label: 'NHOM-A1' },
  { value: 'NHOM-A2', label: 'NHOM-A2' },
  { value: 'NHOM-A3', label: 'NHOM-A3' },
  { value: 'MAY-B1', label: 'MAY-B1' },
  { value: 'MAY-B3', label: 'MAY-B3' },
  { value: 'PK-C2', label: 'PK-C2' },
]

export default function Page() {
  /** key = `${doc}:${code}` → kệ đã chọn. Gợi ý sẵn theo lần cất gần nhất. */
  const [bins, setBins] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const d of PUTAWAY) for (const r of d.rows) init[`${d.doc}:${r.code}`] = r.suggest // prettier-ignore
    return init
  })
  const [donedocs, setDone] = useState<string[]>([])

  const left = PUTAWAY.filter((d) => !donedocs.includes(d.doc))
  const rowsLeft = left.reduce((s, d) => s + d.rows.length, 0)

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Màn Chờ cất — bố cục thẻ dọc, dùng được một tay trên điện thoại.</b> Kệ được{' '}
          <b>gợi ý sẵn</b> theo lần cất gần nhất của chính mã đó, nên việc thường ngày chỉ
          còn là xác nhận. Dòng hàng <b>khoá</b> đi thẳng kệ khoá và không cho chọn — chỗ
          để của hàng chưa được dùng không phải quyết định của thủ kho.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Cất hàng"
        title="Chờ cất"
        facts={[
          { label: 'Phiếu', value: String(left.length) },
          { label: 'Dòng', value: String(rowsLeft) },
          { label: 'Sớm nhất', value: '08:05', tone: 'warn' },
        ]}
        actions={<Btn href="/design-lab/kho">Về bàn làm việc</Btn>}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface)] px-[var(--gutter)] py-[13px]">
        {left.length === 0 ? (
          <Empty
            headline="Không còn gì ở khu tiếp nhận"
            reason="Mọi dòng vừa nhận đã được cất vào kệ thật."
            next={
              <Btn onClick={() => setDone([])}>Dựng lại mẫu để xem lại hai phiếu</Btn>
            }
          />
        ) : (
          <div className="flex flex-col gap-[13px]">
            {left.map((d) => {
              const missing = d.rows.filter(
                (r) => !r.locked && !bins[`${d.doc}:${r.code}`],
              )
              return (
                <section
                  key={d.doc}
                  className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)]"
                >
                  <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--line)] px-[12px] py-[8px]">
                    <Code>{d.doc}</Code>
                    <b className="text-[var(--fs-body)]">{d.supplier}</b>
                    <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                      nhận {d.at} · {d.rows.length} dòng
                    </span>
                    <span className="ml-auto">
                      {missing.length === 0 ? (
                        <Tag tone="done">đủ kệ</Tag>
                      ) : (
                        <Tag tone="warn">còn {missing.length} dòng chưa chọn kệ</Tag>
                      )}
                    </span>
                  </header>

                  <div className="divide-y divide-[var(--line)]">
                    {d.rows.map((r) => {
                      const key = `${d.doc}:${r.code}`
                      const mat = m(r.code)
                      return (
                        <div
                          key={r.code}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[12px] py-[9px]"
                        >
                          <div className="min-w-[210px] flex-1">
                            <div className="flex items-baseline gap-2">
                              <b className="num text-[var(--fs-body)]">{r.code}</b>
                              {r.locked && <Tag tone="stop">khoá</Tag>}
                            </div>
                            <div className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                              {mat.name}
                            </div>
                          </div>

                          <div className="num min-w-[92px] text-right text-[15px] font-bold">
                            {n(r.qty)}{' '}
                            <span className="font-normal text-[var(--fs-sm)] text-[var(--ink-3)]">
                              {mat.unit}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="num text-[var(--fs-sm)] text-[var(--ink-3)]">
                              TIEP-NHAN →
                            </span>
                            {r.locked ? (
                              <span
                                className="num inline-flex h-[30px] items-center rounded-[var(--radius)] border border-[var(--stop)] bg-[color-mix(in_srgb,var(--stop)_10%,transparent)] px-2.5 font-semibold text-[var(--fs-sm)] text-[var(--stop)]"
                                title="Hàng khoá đi thẳng kệ khoá — không phải quyết định của thủ kho"
                              >
                                KHOA-01
                              </span>
                            ) : (
                              <Pick
                                label="Kệ"
                                value={bins[key] ?? ''}
                                options={BINS}
                                onChange={(v) => setBins((s) => ({ ...s, [key]: v }))}
                                width={150}
                              />
                            )}
                            {(r.locked || bins[key]) && (
                              <span
                                className="text-[15px] text-[var(--done)]"
                                aria-label="đã có kệ"
                              >
                                ✓
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/*
                    NÚT CHẶN KÈM LÝ DO, không phải nút xám câm. `blockedBy` của
                    kit in luôn câu vướng lên nút — người dùng không phải đoán.
                  */}
                  <footer className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-[12px] py-[9px]">
                    <Btn
                      primary
                      disabled={missing.length > 0}
                      title={
                        missing.length > 0
                          ? `Còn ${missing.length} dòng chưa chọn kệ: ${missing.map((x) => x.code).join(', ')}`
                          : undefined
                      }
                      onClick={() => setDone((s) => [...s, d.doc])}
                    >
                      Xác nhận đã cất
                    </Btn>
                    <Btn
                      onClick={() =>
                        setBins((s) => {
                          const next = { ...s }
                          for (const r of d.rows)
                            if (!r.locked) next[`${d.doc}:${r.code}`] = 'NHOM-A1'
                          return next
                        })
                      }
                    >
                      Cất hết vào NHOM-A1
                    </Btn>
                    <Btn>Quét mã vạch</Btn>
                    {missing.length > 0 && (
                      <span className="text-[var(--fs-sm)] text-[var(--warn)]">
                        Chưa xác nhận được: {missing.map((x) => x.code).join(', ')} chưa
                        có kệ.
                      </span>
                    )}
                  </footer>
                </section>
              )
            })}
          </div>
        )}

        <p className="mt-[13px] max-w-[70ch] leading-relaxed text-[var(--fs-sm)] text-[var(--ink-3)]">
          Thu hẹp cửa sổ trình duyệt xuống khổ điện thoại để thấy thẻ tự xếp dọc mà không
          cuộn ngang. Ô chọn kệ cao 30px và ô số cỡ 15px là mức bấm được bằng ngón cái —
          lưới chín cột ở khổ đó chỉ còn là lưới cuộn ngang, và cuộn ngang bằng một tay
          trong khi tay kia giữ xe hàng thì không ai dùng.
        </p>
      </div>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính · khu tiếp nhận',
        ]}
        right={`${left.length} phiếu · ${rowsLeft} dòng chờ cất`}
      />
    </ScreenFrame>
  )
}
