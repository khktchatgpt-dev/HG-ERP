'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Code,
  DocChain,
  Empty,
  InspectPanel,
  InspectSection,
  NextAction,
  Num,
  PrimaryStep,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  WhyBox,
  WorkLanes,
  toLanes,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { LOTS, type Lot, m, n } from '../_kho/data'

/**
 * KHO · MÀN 9 — HÀNG MẮC (Khuôn C/B).
 *
 * Câu hỏi: "lô nào đang nằm chết, ai phải quyết, bao lâu rồi?".
 *
 * MÀN NÀY CHỈ TỒN TẠI ĐƯỢC KHI HÀNG KHÔNG ĐẠT VẪN VÀO SỔ. Nếu "từ chối nhận"
 * làm hàng biến mất khỏi hệ thống — cách kho tự làm hay chọn — thì 200 cây
 * nhôm sai hợp kim nằm thật ngoài sân mà không bảng nào đếm được, không ai
 * nhắc, và ba tháng sau nó vẫn ở đó.
 *
 * CỘT TUỔI LÀ LÝ DO MÀN TỒN TẠI. Hàng mắc không ai nhắc thì nằm hết tháng.
 * Quá 3 ngày nổi `--warn`, quá 7 ngày nổi `--stop`, và dòng đó đẩy lên bàn
 * làm việc của NGƯỜI PHẢI QUYẾT — thường không phải Kho.
 *
 * GỘP LUÔN ĐƯỜNG TRẢ NCC, không làm màn riêng. Trả hàng là MỘT CHUYẾN XE cho
 * MỘT NCC, nên hành động hàng loạt "gom lô cùng NCC vào một phiếu trả" phải
 * nằm ngay đây. Tách thành màn riêng thì người dùng phải nhớ hai nơi cho một
 * việc — trái đúng nguyên tắc "vai dùng nặng nhất cần ít màn nhất".
 */

const LANES = toLanes(LOTS, [
  { id: 'blocked', label: 'Khoá — chờ quyết', tone: 'stop', test: (l: Lot) => l.state === 'blocked' }, // prettier-ignore
  { id: 'qc', label: 'Chờ kiểm', tone: 'warn', test: (l: Lot) => l.state === 'qc' },
])

/** Tuổi của lô: 3 ngày là nhắc, 7 ngày là hỏng việc. */
const ageTone = (d: number) => (d >= 7 ? 'stop' : d >= 3 ? 'warn' : 'neutral')

export default function Page() {
  const [lane, setLane] = useState('blocked')
  const [pick, setPick] = useState<string | null>('lot2')

  const rows = LANES.find((l) => l.id === lane)?.rows ?? []
  const sel = LOTS.find((l) => l.id === pick) ?? null
  const visible = rows.some((r) => r.id === pick) ? sel : null

  /* Gom theo NCC — trả hàng là một chuyến xe cho một NCC, không phải từng lô. */
  const bySupplier = new Map<string, Lot[]>()
  for (const l of rows.filter((r) => r.state === 'blocked')) {
    bySupplier.set(l.supplier, [...(bySupplier.get(l.supplier) ?? []), l])
  }

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn C — Hàng mắc.</b> Màn này chỉ tồn tại được vì{' '}
          <b>hàng không đạt vẫn vào sổ</b>. Cột <b>Nằm bao lâu</b> là lý do nó tồn tại:
          hàng mắc không ai nhắc thì nằm hết tháng. Người phải quyết thường{' '}
          <b>không phải Kho</b> — nên dòng này đẩy lên bàn làm việc của Cung ứng, không
          của thủ kho.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Trong kho"
        title="Hàng mắc — chưa dùng được"
        facts={[
          { label: 'Lô đang mắc', value: String(LOTS.length) },
          { label: 'Khoá quá 7 ngày', value: String(LOTS.filter((l) => l.state === 'blocked' && l.days >= 7).length), tone: 'stop' }, // prettier-ignore
          { label: 'Nhà cung cấp liên quan', value: String(new Set(LOTS.map((l) => l.supplier)).size) }, // prettier-ignore
        ]}
        actions={<Btn href="/design-lab/kho">Về bàn làm việc</Btn>}
      >
        <WorkLanes lanes={LANES} activeId={lane} onPick={setLane} />
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {rows.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Làn này đang trống"
              reason="Không lô nào đang ở trạng thái của làn đang chọn — với màn này thì trống là tin tốt."
              next={<Btn onClick={() => setLane('blocked')}>Xem làn Khoá</Btn>}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead>
                <th>Mã / Tên</th>
                <th style={{ textAlign: 'right' }}>Lượng</th>
                <th>Kệ</th>
                <th>Vì sao mắc</th>
                <th>Ai phải quyết</th>
                <th style={{ textAlign: 'right' }}>Nằm bao lâu</th>
              </THead>
              <tbody>
                {rows.map((l) => (
                  <Row key={l.id} selected={l.id === pick} onClick={() => setPick(l.id)}>
                    <Cell>
                      <Code>{l.code}</Code>{' '}
                      <span className="text-[var(--ink-3)]">{m(l.code).name}</span>
                    </Cell>
                    <Cell num>
                      <Num value={`${n(l.qty)} ${m(l.code).unit}`} strong />
                    </Cell>
                    <Cell>
                      <span className="num text-[var(--ink-2)]">{l.bin}</span>
                    </Cell>
                    {/*
                      LÝ DO NGUYÊN VĂN người khoá đã ghi, không phải một mã
                      trạng thái. Cung ứng đọc đúng câu này để quyết trả NCC hay
                      nhận giá giảm — "blocked" thì không quyết được gì.
                    */}
                    <Cell grow>{l.why}</Cell>
                    <Cell muted>{l.holder}</Cell>
                    <Cell
                      num
                      className={
                        ageTone(l.days) === 'stop'
                          ? 'text-[var(--stop)]'
                          : ageTone(l.days) === 'warn'
                            ? 'text-[var(--warn)]'
                            : undefined
                      }
                    >
                      <Num value={`${l.days} ngày`} strong={l.days >= 3} />
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>

            {/*
              HÀNH ĐỘNG HÀNG LOẠT GOM THEO NCC — đứng dưới bảng, không giấu
              trong menu ⋯. Đây là việc thật của màn: gọi NCC một lần, gom mọi
              lô của họ vào một phiếu trả, một chuyến xe.
            */}
            {bySupplier.size > 0 && (
              <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[10px]">
                <div className="mb-[7px] font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                  Gom để trả nhà cung cấp
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[...bySupplier.entries()].map(([sup, lots]) => (
                    <div
                      key={sup}
                      className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] px-[10px] py-[6px]"
                    >
                      <b className="text-[var(--fs-sm)]">{sup}</b>
                      <span className="num text-[var(--fs-sm)] text-[var(--ink-3)]">
                        {lots.length} lô ·{' '}
                        {lots.map((x) => `${n(x.qty)} ${m(x.code).unit}`).join(' + ')}
                      </span>
                      <Btn>Lập phiếu trả X3</Btn>
                    </div>
                  ))}
                  <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                    Trả hàng là một chuyến xe cho một NCC — gom trước khi gọi.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {visible && (
          <InspectPanel
            code={visible.code}
            title={`${n(visible.qty)} ${m(visible.code).unit} · ${visible.state === 'blocked' ? 'đang khoá' : 'chờ kiểm'}`}
            subtitle={`${visible.bin} · từ ${visible.since} · ${visible.days} ngày`}
            actions={
              visible.state === 'blocked' ? (
                <>
                  <PrimaryStep
                    label="Trả nhà cung cấp"
                    blockedBy={
                      visible.holder.startsWith('Cung ứng') ? 'Cung ứng quyết' : undefined
                    }
                  />
                  <Btn danger>Xuất huỷ / phế (X4)</Btn>
                  <Btn>Mở khoá — nhận dùng được (C2)</Btn>
                </>
              ) : (
                <>
                  <PrimaryStep label="Mở khoá sau kiểm (C2)" />
                  <Btn danger>Kiểm không đạt — khoá (C3)</Btn>
                  <Btn>Nhắc KCS</Btn>
                </>
              )
            }
          >
            <InspectSection title="Đến lượt ai">
              <NextAction
                mine={false}
                holder={visible.holder}
                what={
                  visible.state === 'blocked'
                    ? 'Quyết trả nhà cung cấp, nhận giá giảm, hay huỷ'
                    : 'Kiểm mẫu rồi mở khoá hoặc khoá hẳn'
                }
                days={visible.days}
                hint={
                  visible.days >= 7
                    ? 'Quá 7 ngày. Lô này đang chiếm chỗ kệ, chiếm tiền đã trả, và nếu là hàng của lệnh đang chạy thì đang chặn cả chuyền.'
                    : undefined
                }
              />
              <p className="mt-[9px] text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                Người giữ bóng ở đây <b>không phải Kho</b>. Kho chỉ phát hiện và khoá; ai
                quyết trả hay nhận là việc của Cung ứng. Màn nào không nói ra điều đó thì
                lô nằm mãi vì mỗi bên tưởng bên kia đang lo.
              </p>
            </InspectSection>

            <InspectSection title="Vì sao lô này mắc">
              <div className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)] p-[10px] leading-relaxed text-[var(--fs-body)]">
                {visible.why}
              </div>
              <p className="mt-[7px] text-[11.5px] text-[var(--ink-3)]">
                Câu này do người khoá tự gõ, đi theo lô suốt đời nó, và là thứ duy nhất
                còn lại sau ba tháng.
              </p>
            </InspectSection>

            <InspectSection title="Tiền đang nằm ở đây">
              <WhyBox
                lines={[
                  `${n(visible.qty)} ${m(visible.code).unit}`,
                  `giá mua gần nhất 352.000 ₫`,
                  `mắc từ ${visible.since} · ${visible.days} ngày`,
                ]}
                result={`≈ ${n(visible.qty * 352000)} ₫ đang nằm chết`}
              />
              <p className="mt-[9px] text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                Phép tính bày nguyên văn để kiểm được. Con số này là thứ khiến một lô “chờ
                quyết” thành một việc <b>có hạn</b> thay vì một dòng trong bảng.
              </p>
            </InspectSection>

            <InspectSection title="Chuỗi chứng từ">
              <DocChain
                links={[
                  { label: 'Đơn mua', code: visible.po, href: '/design-lab/kho/hang-ve' },
                  { label: 'Phiếu nhập', code: 'PNK-2609-051', href: '/design-lab/kho/phieu-nhap' }, // prettier-ignore
                  { label: visible.state === 'blocked' ? 'Phiếu khoá C3' : 'Chờ kiểm', code: visible.state === 'blocked' ? 'PCK-2609-047' : 'chưa có phiếu', muted: visible.state !== 'blocked' }, // prettier-ignore
                ]}
              />
            </InspectSection>
          </InspectPanel>
        )}
      </div>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính',
        ]}
        right={`${rows.length} lô trong làn · ${LOTS.length} lô đang mắc`}
      />
    </ScreenFrame>
  )
}
