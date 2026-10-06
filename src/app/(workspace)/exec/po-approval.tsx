'use client'

import Link from 'next/link'
import {
  Btn,
  DocChain,
  FactKv,
  Ico,
  StatusBar,
  Timeline,
  type IcoName,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import { money, moneyByCurrency, waitingDays } from './approval-helpers'
import { targetPo, type useApprovalDecision } from './useApprovalDecision'
import {
  comparePrice,
  daysUntil,
  dueBadge,
  DUE_TEXT,
  fmtD,
  fmtVnd,
} from './approval-parts'
import { PoLineGrid } from './po-approval-lines'
import { ShipmentPlan, shipmentsAfterShip } from './po-approval-giao'
import { poTemplateMeta, isPoTemplate } from '@/lib/po-template'
import type { ApprovalNav, PendingPo } from './approval-types'
import {
  QuestionThreads,
  questionAsk,
  SignatureBand,
  signModeOf,
  type SignMode,
} from './po-approval-bands'

type Dec = ReturnType<typeof useApprovalDecision>

/* ══════════════════════════════════════════════════════════════════════
   THÂN ĐƠN MUA — THIẾT KẾ LẠI 17/09/2026, BỔ SUNG 01/10/2026

   Bắt đầu từ NHIỆM VỤ, không từ khuôn. Giám đốc ngồi trước 15 phiếu, mỗi
   phiếu hỏi bốn câu theo đúng thứ tự này:

     1. bao nhiêu tiền, cho ai?       → dải quyết định, ngay trên đầu
     2. có gì bất thường không?       → dải cảnh báo, mỗi dải một việc
     3. dòng nào gây ra nó?           → lưới, cảnh báo trỏ thẳng vào dòng
     4. ký xong thì phiếu sau ở đâu?  → ‹n/N› + "Ký & sang phiếu sau"

   01/10/2026 — chủ dự án: "chưa xem được đầy đủ thông tin đơn, không biết ai
   lập đơn". Đo được ba nguyên nhân, sửa cả ba:
    · số to là tiền hàng TRƯỚC VAT (83/97 đơn có VAT 8–10%) → nay là TỔNG
      THANH TOÁN, kèm phép tính nguyên văn;
    · thông tin đơn nằm trong khay phải `hidden xl:flex` — dưới 1280px (laptop
      phóng 125%) cả khay biến mất → bỏ khay, đổi thành DẢI NĂM KHỐI tự xuống
      hàng, hiện ở mọi bề rộng;
    · "Người lập" chỉ đọc created_by (trống ở 31/97 đơn nạp từ file) → thêm
      người PHỤ TRÁCH (có ở 97/97), cùng điều khoản, lệnh, NCC, ghi chú nội bộ.

   Dải quyết định đứng yên; mọi thứ dưới nó cuộn chung một vùng — màn thấp
   (730px) mà chia ba vùng cuộn thì vùng nào cũng chỉ còn vài dòng.
   ══════════════════════════════════════════════════════════════════════ */
export function PoApprovalBody({
  p,
  nowIso,
  dec,
  nav,
}: {
  p: PendingPo
  nowIso: string
  dec: Dec
  nav?: ApprovalNav
}) {
  // `big` tính ở server theo TIỀN TỆ của đơn, trên tổng GỒM VAT (approvals/data.ts).
  const big = p.big ?? false
  const noThreshold = p.threshold == null
  const days = waitingDays(p.submitted_at ?? p.created_at, nowIso)
  const due = dueBadge(daysUntil(p.expected_at, nowIso))
  const lines = p.lines ?? []
  const missingPrice = lines.filter((ln) => ln.unit_price == null).length
  const grand = p.money?.grand ?? p.total
  const t = p.terms
  const lsx = p.lsx
  const sup = p.supplier
  const ships = p.shipments ?? []
  const lateShips = shipmentsAfterShip(p)
  // 0218 — đầu màn đổi theo đơn đang ở đâu (po-approval-bands.tsx).
  const mode = signModeOf(p)
  const deciding = mode === 'decide'
  const ask = deciding ? questionAsk(p) : null

  /*
    DÒNG TĂNG GIÁ — đếm ở đây để dải cảnh báo nói được CON SỐ và TÊN, thay vì
    một câu chung. "1 dòng: Bồn hoa lớn (1.500 → 1.680)" chỉ thẳng chỗ phải
    nhìn; "cần xem kỹ từng dòng" thì bắt người ký tự dò 3 dòng hay 40 dòng.
  */
  const tangGia = lines
    .map((ln) => ({ ln, cmp: comparePrice(ln, p.last_prices, p.currency) }))
    .filter((x) => x.cmp != null && x.cmp.pct >= 5)

  const canhBao: Canh[] = []
  if (big) {
    canhBao.push({
      tone: 'stop',
      icon: 'canhBao',
      title: noThreshold
        ? `Chưa đặt ngưỡng cho ${p.currency}`
        : `Giá trị lớn (≥ ${money(p.threshold!, p.currency)})`,
      body: noThreshold
        ? 'Mặc định coi là đơn lớn, phải đọc từng dòng trước khi duyệt chi.'
        : 'Cần xem kỹ từng dòng trước khi duyệt chi.',
      action: noThreshold
        ? { label: 'Đặt ngưỡng ở Luật ký', href: '/exec/luat-ky' }
        : undefined,
    })
  }
  // Chỉ cảnh báo, không chặn (chủ dự án chốt 01/10): 48/97 đơn chưa ghi.
  if (t && !t.payment) {
    canhBao.push({
      tone: 'warn',
      icon: 'canhBao',
      title: 'Chưa ghi điều khoản thanh toán',
      body: 'Ký là cam kết chi mà chưa rõ trả khi nào, mấy đợt. Có thể trả lại để Cung ứng bổ sung.',
    })
  }
  if (tangGia.length > 0) {
    const d = tangGia[0]
    canhBao.push({
      tone: 'warn',
      icon: 'giaTang',
      title: `Giá cao hơn lần mua trước ${tangGia.length > 1 ? 'ở ' + tangGia.length + ' dòng' : Math.round(d.cmp!.pct) + '%'}`, // prettier-ignore
      body:
        tangGia.length === 1
          ? `${d.ln.material_name} — ${fmtVnd(d.cmp!.prev)} → ${fmtVnd(d.ln.unit_price!)} ${p.currency} (đơn ${d.cmp!.poCode}).`
          : `Cao nhất: ${d.ln.material_name} +${Math.round(d.cmp!.pct)}%. Các dòng tăng giá được tô nền ở lưới dưới.`,
    })
  }
  if (missingPrice > 0) {
    canhBao.push({
      tone: 'warn',
      icon: 'canhBao',
      title: `${missingPrice} dòng chưa có đơn giá`,
      body: 'Tổng thanh toán ở trên đang tính THIẾU đúng bằng những dòng đó.',
    })
  }
  if (due.tone === 'red') {
    canhBao.push({
      tone: 'warn',
      icon: 'hen',
      title: `Hàng hẹn về ${fmtD(p.expected_at)} — ${due.text}`,
      body: lsx?.ship_date
        ? `Lệnh ${lsx.code} xuất ngày ${fmtD(lsx.ship_date)}. Hỏi Cung ứng hàng đã về chưa trước khi ký.`
        : 'Duyệt để Cung ứng kịp gửi đơn cho nhà cung cấp.',
    })
  } else if (lsx?.ship_date && p.expected_at && p.expected_at > lsx.ship_date) {
    canhBao.push({
      tone: 'warn',
      icon: 'hen',
      title: 'Hàng hẹn về SAU ngày xuất của lệnh',
      body: `Hẹn về ${fmtD(p.expected_at)}, lệnh ${lsx.code} xuất ${fmtD(lsx.ship_date)}.`,
    })
  }
  if (lateShips.length > 0 && lsx?.ship_date) {
    canhBao.push({
      tone: 'warn',
      icon: 'hen',
      title: `${lateShips.length} đợt giao hẹn SAU ngày xuất của lệnh`,
      body: `${lateShips.map((s) => `Đợt ${s.seq} hẹn ${fmtD(s.expected_date)}`).join(', ')} — lệnh ${lsx.code} xuất ${fmtD(lsx.ship_date)}. Xem bảng Kế hoạch giao bên dưới.`,
    })
  }
  if (sup && sup.others === 0) {
    canhBao.push({
      tone: 'warn',
      icon: 'canhBao',
      title: 'Nhà cung cấp mới',
      body: 'Đây là đơn đầu tiên với nhà cung cấp này, chưa có lịch sử giao hàng để đối chiếu.',
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── DẢI 1: định vị + đi tuyến tính ‹n/N› ───────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--hair)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
        <Btn href="/exec/approvals" icon="quayLai">
          Chờ tôi phê duyệt
        </Btn>
        {nav && nav.total > 1 && (
          <span className="flex items-center gap-0.5">
            <Btn
              href={nav.prevHref ?? undefined}
              disabled={!nav.prevHref}
              title={nav.prevHref ? 'Phiếu trước' : 'Đây là phiếu đầu'}
              aria-label="Phiếu trước"
            >
              <Ico name="truoc" />
            </Btn>
            <span className="num text-k-sm px-1.5 text-[var(--ink-2)]">
              {nav.index || '—'} / {nav.total}
            </span>
            <Btn
              href={nav.nextHref ?? undefined}
              disabled={!nav.nextHref}
              title={nav.nextHref ? 'Phiếu sau' : 'Đây là phiếu cuối'}
              aria-label="Phiếu sau"
            >
              <Ico name="sau" />
            </Btn>
          </span>
        )}
        <span className="h-[16px] w-px bg-[var(--hair)]" />
        <DocChain
          links={[
            ...(p.order_code ? [{ label: 'Đơn hàng', code: p.order_code }] : []),
            ...(p.lsx_code ? [{ label: 'LSX', code: p.lsx_code }] : []),
            { label: 'Đơn vật tư', code: p.code },
          ]}
        />
        <span className="ml-auto flex gap-2">
          {/* Trang đơn bên Mua hàng: trao đổi, đợt giao, tệp — thứ màn ký không bày. */}
          <Btn href={`/mua-hang/don/${p.id}`} icon="don">
            Mở đơn đầy đủ
          </Btn>
          <Btn href={`/print/supply/${p.id}`} icon="in">
            Bản in
          </Btn>
        </span>
      </div>

      {/* ── DẢI 2: QUYẾT ĐỊNH — ngang, luôn thấy ───────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-[var(--line)] bg-[var(--surface-hover)] px-[var(--gutter)] py-2">
        <div className="min-w-0">
          <div className="text-k-label font-semibold tracking-[.05em] text-[var(--ink-3)] uppercase">
            {p.money
              ? `Tổng thanh toán · ${p.money.includes_vat ? 'giá đã gồm' : 'đã gồm'} VAT ${p.money.vat_rate}%`
              : 'Đơn đặt vật tư · tổng cam kết chi'}
          </div>
          <div className="mt-px flex flex-wrap items-baseline gap-2.5">
            <span
              className={cn(
                'num text-k-doc leading-tight font-bold',
                big && 'text-[var(--stop)]',
              )}
            >
              {money(grand, p.currency)}
            </span>
            <span className="font-semibold">{p.supplier_name}</span>
          </div>
          {/* Số suy ra thì bày phép tính nguyên văn — cùng hàm với phiếu in. */}
          {p.money && (
            <div className="text-k-sm mt-0.5 text-[var(--ink-2)]">
              Tiền hàng{' '}
              <span className="num text-[var(--ink)]">{fmtVnd(p.money.subtotal)}</span>
              {p.money.discount > 0 && (
                <>
                  {' '}
                  − chiết khấu{' '}
                  <span className="num text-[var(--ink)]">
                    {fmtVnd(p.money.discount)}
                  </span>
                </>
              )}
              {p.money.includes_vat ? ' · trong đó ' : ' + '}VAT {p.money.vat_rate}%{' '}
              <span className="num text-[var(--ink)]">{fmtVnd(p.money.vat_amount)}</span>
              {p.money.discount > 0 ? '' : ' · không chiết khấu'}
            </div>
          )}
        </div>

        {deciding && canhBao.length === 0 && (
          <span className="text-k-sm inline-flex items-center gap-2 rounded-[var(--radius)] bg-[var(--done-wash)] px-2.5 py-1 font-semibold text-[var(--done)]">
            <Ico name="xong" />
            Không có gì bất thường — dưới ngưỡng, đủ giá, đủ điều khoản, đúng hẹn
          </span>
        )}

        {/* Đơn không còn chờ duyệt: nút nằm ở DẢI CHỮ KÝ ngay dưới (0218). */}
        {deciding && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {/*
            HỎI LẠI (0218) — câu hỏi gửi người phụ trách, đơn KHÔNG đổi trạng
            thái. Trước đó chỉ có Duyệt / Trả lại: 34 lần duyệt, 0 lần trả lại,
            mọi câu hỏi đi qua điện thoại và Zalo, không để lại vết.
          */}
            {ask && (
              <Btn disabled={dec.busy} icon="ghiChu" onClick={() => dec.askFollowUp(ask)}>
                Hỏi lại
              </Btn>
            )}
            <Btn
              disabled={dec.busy}
              onClick={() => dec.askReject(targetPo(p))}
              icon="traLai"
            >
              Trả lại để sửa
            </Btn>
            <Btn
              primary
              disabled={dec.busy}
              onClick={() => dec.askApprove(targetPo(p))}
              icon="duyet"
            >
              Phê duyệt
            </Btn>
            {/*
            KÝ RỒI ĐI TIẾP — nút chỉ có nghĩa khi còn phiếu sau. Hết chồng thì
            biến mất chứ không khoá: người ký vừa xong việc, bày một nút xám
            "sang phiếu sau" là nói với họ rằng còn việc, trong khi không còn.
          */}
            {nav?.nextHref && (
              <Btn
                primary
                disabled={dec.busy}
                title="Ký phiếu này rồi mở luôn phiếu kế tiếp trong hộp"
                onClick={() => dec.askApprove(targetPo(p), nav.nextHref ?? undefined)}
              >
                Ký &amp; sang phiếu sau
                <Ico name="sau" />
              </Btn>
            )}
          </span>
        )}
      </div>

      {/* ── DẢI 2b: CHỮ KÝ — đơn đã ký / đã gửi / gửi gấp chờ ký bù (0218) ─ */}
      <SignatureBand p={p} dec={dec} mode={mode} />

      <div className="min-h-0 flex-1 overflow-auto">
        {/* ── CÂU HỎI CỦA GIÁM ĐỐC — câu còn mở trước (0218) ─────────────── */}
        <QuestionThreads
          qs={p.questions ?? []}
          ownerName={p.owner_name ?? null}
          nowIso={nowIso}
        />

        {/* ── DẢI 3: VÌ SAO CẦN CHÚ Ý — chỉ khi còn phải quyết ─────────── */}
        {(deciding || mode === 'late') && canhBao.length > 0 && (
          <div className="border-b border-[var(--line)]">
            {canhBao.map((c, i) => (
              <WarnRow key={i} c={c} first={i === 0} />
            ))}
          </div>
        )}

        {/* ── DẢI 4: NĂM KHỐI THÔNG TIN ĐƠN — luôn hiện, tự xuống hàng ─── */}
        <div className="flex flex-wrap gap-px border-b border-[var(--line)] bg-[var(--hair)] [--fact-min:190px]">
          <FactBlock title="Ai lập · ai giữ">
            <FactKv
              prose
              rows={[
                ['Người lập', p.created_by_name ?? <Muted key="l">không ghi (đơn nạp từ file)</Muted>], // prettier-ignore
                ['Phụ trách', p.owner_name ?? <Muted key="o">chưa giao</Muted>],
                [
                  'Lập ngày',
                  <span key="d" className="num">
                    {fmtD(p.created_at)}
                  </span>,
                ],
                [
                  'Trình duyệt',
                  <span key="s">
                    {p.submitted_at && (
                      <span className="num">{fmtDT(p.submitted_at)} · </span>
                    )}
                    <span className={days >= 4 ? DUE_TEXT.red : undefined}>
                      {days >= 1 ? `chờ ${days} ngày` : 'mới gửi'}
                    </span>
                  </span>,
                ],
              ]}
            />
          </FactBlock>

          <FactBlock title="Trả tiền · giao hàng">
            <FactKv
              prose
              rows={[
                ['Thanh toán', t?.payment ?? <Missing key="p">chưa ghi</Missing>],
                ['Thời hạn giao', t?.lead_time ?? <Muted key="l">chưa ghi</Muted>],
                [
                  'Hẹn về',
                  p.expected_at ? (
                    <span key="h">
                      <span className="num">{fmtD(p.expected_at)}</span> ·{' '}
                      <span className={DUE_TEXT[due.tone]}>{due.text}</span>
                    </span>
                  ) : (
                    <Missing key="h">chưa hẹn</Missing>
                  ),
                ],
                ...(ships.length > 1
                  ? [['Lịch giao', <span key="g"><b>{ships.length} đợt</b> · <span className="num">{fmtD(ships[0].expected_date)} → {fmtD(ships.at(-1)!.expected_date)}</span></span>] as [string, React.ReactNode]] // prettier-ignore
                  : []),
                ['Nơi giao', t?.delivery_place ?? <Muted key="n">chưa ghi</Muted>],
                ...(p.confirmed_note
                  ? [['NCC xác nhận', p.confirmed_note] as [string, React.ReactNode]]
                  : []),
              ]}
            />
          </FactBlock>

          <FactBlock title="Căn cứ">
            <FactKv
              prose
              rows={[
                [
                  'Mẫu đơn',
                  isPoTemplate(p.template) ? poTemplateMeta(p.template).label : <Muted key="m">đơn giản</Muted>, // prettier-ignore
                ],
                ['Hợp đồng', t?.contract_no ?? <Muted key="h">chưa ghi</Muted>],
                ...(t?.doc_no && t.doc_no !== p.code
                  ? [['Số đơn giấy', <span key="g" className="num">{t.doc_no}</span>] as [string, React.ReactNode]] // prettier-ignore
                  : []),
                ['Hoá đơn', t?.invoice ?? <Muted key="i">chưa ghi</Muted>],
                ['Chất lượng', t?.quality ?? <Muted key="q">chưa ghi</Muted>],
                ...(p.files?.length
                  ? [['Tệp đính kèm', <span key="f" title={p.files.map((f) => f.filename).join(', ')}>{p.files.length} tệp · <Link className="text-[var(--act)] underline-offset-2 hover:underline" href={`/mua-hang/don/${p.id}`}>xem ở trang đơn</Link></span>] as [string, React.ReactNode]] // prettier-ignore
                  : []),
              ]}
            />
          </FactBlock>

          <FactBlock title="Lệnh sản xuất">
            {lsx ? (
              <FactKv
                prose
                rows={[
                  [
                    'Lệnh',
                    <span key="c" className="num">
                      {lsx.code}
                    </span>,
                  ],
                  [
                    'Ngày xuất',
                    lsx.ship_date ? (
                      <span key="x">
                        <span className="num">{fmtD(lsx.ship_date)}</span> ·{' '}
                        <span
                          className={
                            DUE_TEXT[dueBadge(daysUntil(lsx.ship_date, nowIso)).tone]
                          }
                        >
                          {dueBadge(daysUntil(lsx.ship_date, nowIso)).text}
                        </span>
                      </span>
                    ) : (
                      <Muted key="x">chưa đặt trên lệnh</Muted>
                    ),
                  ],
                  ...(p.extra_lsx?.length
                    ? [['Gộp lệnh', <span key="g" className="num">{p.extra_lsx.join(', ')}</span>] as [string, React.ReactNode]] // prettier-ignore
                    : []),
                  ['Đơn mua', lsxPoSummary(lsx)],
                  [
                    'Đã duyệt mua',
                    lsx.pos_approved > 0 ? (
                      <span key="v">
                        <span className="num">{moneyByCurrency(lsx.approved_value)}</span>{' '}
                        <Muted>(gồm VAT)</Muted>
                      </span>
                    ) : (
                      <Muted key="v">chưa đơn nào</Muted>
                    ),
                  ],
                ]}
              />
            ) : (
              <p className="text-k-sm text-[var(--ink-2)]">
                Đơn ngoài lệnh — mua dùng chung hoặc tiêu hao, không gắn lệnh sản xuất
                nào.
              </p>
            )}
          </FactBlock>

          <FactBlock title="Nhà cung cấp">
            {sup ? (
              <FactKv
                prose
                rows={[
                  [
                    'Đơn trước',
                    sup.others === 0 ? (
                      <Missing key="t">chưa có — NCC mới</Missing>
                    ) : (
                      <span key="t">
                        {sup.others} đơn ·{' '}
                        <span className="text-[var(--done)]">
                          {sup.received} đã nhận đủ
                        </span>
                      </span>
                    ),
                  ],
                  [
                    'Đang mở khác',
                    sup.open_others.length ? (
                      <span key="m" className="num" title={sup.open_others.join(', ')}>
                        {sup.open_others.slice(0, 3).join(', ')}
                        {sup.open_others.length > 3
                          ? ` +${sup.open_others.length - 3}`
                          : ''}
                      </span>
                    ) : (
                      <Muted key="m">không có</Muted>
                    ),
                  ],
                  [
                    'Liên hệ',
                    sup.contact ?? <Muted key="c">chưa ghi trong danh mục</Muted>,
                  ],
                ]}
              />
            ) : (
              <Muted>Không đọc được lịch sử nhà cung cấp.</Muted>
            )}
          </FactBlock>
        </div>

        {/* ── DẢI 5: LƯỚI VẬT TƯ ──────────────────────────────────────── */}
        <div className="text-k-label flex h-[26px] items-center gap-1.5 border-b border-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] font-bold tracking-[.08em] text-[var(--ink-label)] uppercase">
          <Ico name="vattu" size={14} />
          Dòng vật tư
          <span className="num ml-1 font-normal tracking-normal text-[var(--ink-3)] normal-case">
            {lines.length} dòng
            {isPoTemplate(p.template) &&
              ` · cột theo phiếu in mẫu ${poTemplateMeta(p.template).label}`}
          </span>
        </div>
        <PoLineGrid
          lines={lines}
          template={p.template}
          total={p.total}
          currency={p.currency}
          lastPrices={p.last_prices}
          money={p.money}
        />

        {/* ── DẢI 5b: KẾ HOẠCH GIAO — đợt giao lập từ lúc nháp (07/10/2026) ── */}
        <ShipmentPlan p={p} nowIso={nowIso} />

        {/* ── DẢI 6: ghi chú NCC · ghi chú nội bộ · đường đi của đơn ───── */}
        <div className="flex flex-wrap gap-px border-t border-[var(--line)] bg-[var(--hair)] [--fact-min:260px]">
          <FactBlock title="Ghi chú in lên phiếu gửi NCC">
            {p.note?.trim() ? (
              <p className="text-k-sm whitespace-pre-wrap text-[var(--ink-2)]">
                {p.note}
              </p>
            ) : (
              <Muted>Không có ghi chú.</Muted>
            )}
          </FactBlock>
          <FactBlock title="Ghi chú nội bộ của Cung ứng">
            {p.internal_notes?.length ? (
              <ul className="grid gap-2">
                {p.internal_notes.map((n, i) => (
                  <li key={i} className="text-k-sm text-[var(--ink-2)]">
                    <b className="text-[var(--ink)]">{n.author_name ?? 'Không rõ'}</b>{' '}
                    <span className="num text-[var(--ink-3)]">
                      · {fmtD(n.created_at)}
                    </span>
                    <span className="block whitespace-pre-wrap">{n.body}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Muted>Cung ứng chưa ghi chú nội bộ trên đơn này.</Muted>
            )}
          </FactBlock>
          <FactBlock title="Đường đi của đơn">
            <Timeline marks={trackMarks(p, mode)} />
            {p.lsx_code && nav && nav.sameLsxPending > 1 && (
              <p className="text-k-sm mt-1 text-[var(--ink-2)]">
                Lệnh <b className="num text-[var(--ink)]">{p.lsx_code}</b> còn{' '}
                <b className="text-[var(--ink)]">{nav.sameLsxPending} đơn</b> chờ bạn ký,
                kể cả đơn này.
              </p>
            )}
          </FactBlock>
        </div>
      </div>

      <StatusBar
        left={
          deciding || mode === 'late'
            ? [
                nav && nav.index > 0
                  ? `Phiếu ${nav.index} / ${nav.total} đang chờ`
                  : 'Phiếu chờ ký',
                canhBao.length > 0
                  ? `${canhBao.length} việc cần chú ý`
                  : 'Không có việc cần chú ý',
              ]
            : ['Đơn không còn chờ ký — xem lại, chỉ đọc']
        }
        right={
          nav?.nextHref
            ? `Còn ${nav.total - nav.index} phiếu sau phiếu này`
            : nav && nav.index > 0
              ? 'Phiếu cuối trong hộp'
              : `${nav?.total ?? 0} phiếu đang chờ trong hộp`
        }
      />
    </div>
  )
}

type Canh = {
  tone: 'stop' | 'warn'
  icon: IcoName
  title: string
  body: React.ReactNode
  action?: { label: string; href: string }
}

function WarnRow({ c, first }: { c: Canh; first: boolean }) {
  const color = c.tone === 'stop' ? 'var(--stop)' : 'var(--warn)'
  return (
    <div
      className={cn(
        'text-k-sm flex flex-wrap items-center gap-2 px-[var(--gutter)] py-1.5 text-[var(--ink-2)]',
        !first && 'border-t border-[var(--hair)]',
        c.tone === 'stop' ? 'bg-[var(--stop-wash)]' : 'bg-[var(--warn-wash)]',
      )}
    >
      <Ico name={c.icon} size={14} className="shrink-0" style={{ color }} aria-hidden />
      <b style={{ color }}>{c.title}</b>
      <span>{c.body}</span>
      {c.action && (
        <span className="ml-auto">
          <Btn href={c.action.href}>{c.action.label}</Btn>
        </span>
      )}
    </div>
  )
}

/** Một khối trong dải thông tin — phẳng, ngăn nhau bằng vạch tóc của lưới cha. */
function FactBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 flex-[1_1_var(--fact-min)] bg-[var(--surface-card)] px-3 py-2.5">
      <h3 className="text-k-label mb-1.5 font-bold tracking-[.08em] text-[var(--ink-label)] uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-[var(--ink-3)]">{children}</span>
}

/** Thiếu thứ người ký CẦN — tô hổ phách, khác "chưa ghi" thường (xám). */
function Missing({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[var(--warn)]">{children}</span>
}

function fmtDT(iso: string) {
  const d = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** "20 đơn: 18 đã duyệt, 1 nháp, 1 chờ ký" — đơn đang xem nằm trong nhóm chờ ký. */
function lsxPoSummary(l: NonNullable<PendingPo['lsx']>): string {
  const waiting = Math.max(0, l.pos_total - l.pos_approved - l.pos_draft)
  const parts = [
    l.pos_approved > 0 && `${l.pos_approved} đã duyệt`,
    l.pos_draft > 0 && `${l.pos_draft} nháp`,
    waiting > 0 && `${waiting} chờ ký`,
  ].filter(Boolean)
  return `${l.pos_total} đơn: ${parts.join(', ')}`
}

const EVENT_LABEL: Record<string, { label: string; tone?: 'done' | 'warn' | 'stop' }> = {
  submitted: { label: 'Gửi duyệt' },
  approved: { label: 'Giám đốc duyệt', tone: 'done' },
  rejected: { label: 'Trả lại để sửa', tone: 'stop' },
  withdrawn: { label: 'Rút về nháp', tone: 'warn' },
  reassigned: { label: 'Đổi người phụ trách' },
  reopened: { label: 'Mở lại đơn đã duyệt', tone: 'warn' },
  // 0218
  unapproved: { label: 'Thu hồi chữ ký', tone: 'warn' },
  urgent_sent: { label: 'Gửi NCC gấp, chưa ký', tone: 'stop' },
}

/**
 * Đường đi của đơn: lập → các mốc duyệt đã có (kể cả lần trả lại + lý do) →
 * các mốc CHƯA tới theo chỗ đơn đang đứng. Bày cả phần chưa tới thì người ký
 * thấy chữ ký của mình mở khoá bước nào.
 */
function trackMarks(p: PendingPo, mode: SignMode) {
  // Chữ ký đứng SAU mốc gửi gấp là chữ ký bù — gọi đúng tên việc đã xảy ra.
  const urgentAt = (p.events ?? []).find((e) => e.action === 'urgent_sent')?.created_at
  const future =
    mode === 'decide'
      ? [
          { key: 'sign', at: null, label: 'Giám đốc ký' },
          { key: 'send', at: null, label: 'Cung ứng gửi đơn cho NCC' },
        ]
      : mode === 'late'
        ? [{ key: 'sign', at: null, label: 'Giám đốc ký bù' }]
        : mode === 'signed'
          ? [{ key: 'send', at: null, label: 'Cung ứng gửi đơn cho NCC' }]
          : []
  return [
    {
      key: 'created',
      at: p.created_at,
      label: 'Lập đơn',
      // Không mượn tên người phụ trách: đơn nạp từ file KHÔNG có người lập thật.
      actor: p.created_by_name ?? null,
    },
    ...(p.events ?? []).map((e, i) => ({
      key: `e${i}`,
      at: e.created_at,
      label:
        e.action === 'approved' && urgentAt && e.created_at > urgentAt
          ? 'Giám đốc ký bù'
          : (EVENT_LABEL[e.action]?.label ?? e.action),
      actor: e.actor_name,
      detail: e.reason,
      tone: EVENT_LABEL[e.action]?.tone,
    })),
    ...future,
  ]
}
