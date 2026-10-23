'use client'

import { Btn, Ico, WorkTile, WorkTiles, type IcoName } from '@/components/kit'
import { shortMoney } from '@/lib/may-moc'
import { IssueCard } from './_ui/issue-card'
import { PlanRows, Quiet, SectionHead, type HomeCtx } from './home.shared'

/** Nút việc nhanh — ba nút đầu trang Cơ điện của demo MOCA. */
function QuickAct({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: IcoName
  title: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-center gap-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] px-3 py-2 text-left hover:border-[var(--act)] hover:bg-[var(--act-wash)]"
    >
      <span className="text-[var(--act-text)]">
        <Ico name={icon} size={24} />
      </span>
      <span className="grid min-w-0">
        <b className="text-k-body">{title}</b>
        <span className="text-k-sm truncate text-[var(--ink-3)]">{sub}</span>
      </span>
    </button>
  )
}

/**
 * VIỆC HÔM NAY (bản Tổ Cơ điện) — "Hôm nay Tổ Cơ điện phải làm gì trước?"
 * Như demo: ba nút nhanh (quét tem, báo hỏng, cập nhật giờ chạy), báo hỏng mới,
 * đang sửa, bảo trì quá hạn / tới hạn. Cộng dải ô đếm của ERP — mỗi ô đếm bằng
 * đúng hàm của màn đích, bấm là mở đúng thẻ ở đó.
 */
export function HomeToday({ c }: { c: HomeCtx }) {
  const { d, setDlg, flow, openIssue } = c
  const { counts, meta } = d
  const fresh = d.issues.filter((i) => i.status === 'moi')
  const fixing = d.issues.filter(
    (i) => i.status === 'cho_duyet' || i.status === 'dang_sua',
  )
  const od = d.plans.filter((p) => p.state === 'od')
  const soon = d.plans.filter((p) => p.state === 'soon')
  // Kiểm định còn > 7 ngày nhưng ≤ 30 ngày — hai khối trên chưa nói tới.
  const kdSoon = d.plans.filter((p) => p.state === 'ok')
  const doneFn = meta.can_work
    ? (p: (typeof d.plans)[number]) => setDlg({ plan: p })
    : undefined
  const card = (i: (typeof d.issues)[number]) => (
    <IssueCard
      key={i.id}
      i={i}
      today={d.today}
      meta={meta}
      onOpen={() => openIssue(i)}
      onAct={(k) => flow.act(i, k)}
      busy={flow.busy}
    />
  )
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="grid gap-2 border-b border-[var(--line)] px-[var(--gutter)] py-2 sm:grid-cols-3">
        <QuickAct
          icon="quetQr"
          title="Quét tem QR"
          sub="Xem máy, ghi bảo trì, báo hỏng"
          onClick={() => setDlg({ scan: 'any' })}
        />
        <QuickAct
          icon="canhBao"
          title="Báo hỏng"
          sub="Ghi nhận máy hỏng, kèm ảnh"
          onClick={() => setDlg('report')}
        />
        {meta.can_work && (
          <QuickAct
            icon="gioChay"
            title="Cập nhật giờ chạy"
            sub="Đọc đồng hồ giờ trên máy"
            onClick={() => setDlg({ scan: 'hours' })}
          />
        )}
      </div>

      <div className="border-b border-[var(--line)] px-[var(--gutter)] py-2">
        <div className="text-k-label pb-1 font-semibold tracking-wider text-[var(--ink-label)] uppercase">
          Báo hỏng
        </div>
        <WorkTiles>
          <WorkTile
            label="Mới báo, chưa nhận"
            count={counts.new_issues}
            hint="Báo hỏng › Mới báo"
            href="/may-moc/bao-hong?tab=moi"
            tone="stop"
            strong={meta.can_work}
          />
          <WorkTile
            label="Chờ GĐ duyệt"
            count={counts.waiting}
            hint={`dự toán > ${shortMoney(d.approve_over)}`}
            href="/may-moc/bao-hong?tab=cho_duyet"
            tone="warn"
            strong={meta.can_approve}
          />
          <WorkTile
            label="Đang sửa"
            count={counts.fixing}
            hint="Báo hỏng › Đang sửa"
            href="/may-moc/bao-hong?tab=dang_sua"
          />
          <WorkTile
            label="Máy đang dừng"
            count={counts.down}
            hint="Máy móc › Đang dừng"
            href="/may-moc/may?loc=down"
            tone="stop"
          />
        </WorkTiles>
        <div className="text-k-label pt-2 pb-1 font-semibold tracking-wider text-[var(--ink-label)] uppercase">
          Bảo trì
        </div>
        <WorkTiles>
          <WorkTile
            label="Quá hạn"
            count={counts.overdue}
            hint="Lịch bảo trì › Cần làm"
            href="/may-moc/bao-tri"
            tone="stop"
            strong={meta.can_work}
          />
          <WorkTile
            label="Tới hạn trong 7 ngày"
            count={counts.soon}
            hint="Lịch bảo trì › Cần làm"
            href="/may-moc/bao-tri"
            tone="warn"
          />
          <WorkTile
            label="Kiểm định ≤ 30 ngày"
            count={counts.inspections}
            hint="Lịch bảo trì › Kiểm định"
            href="/may-moc/bao-tri?tab=kd"
            tone="warn"
          />
          <WorkTile
            label="Giờ chạy chưa cập nhật > 14 ngày"
            count={counts.stale_hours}
            hint="máy có đồng hồ giờ — lịch theo giờ đang đoán"
            href="/may-moc/may?loc=stale"
            tone="warn"
          />
        </WorkTiles>
      </div>

      <div className="grid md:grid-cols-2">
        <section
          className="min-w-0 border-b border-[var(--line)] md:border-r"
          aria-label="Báo hỏng"
        >
          <SectionHead
            title="Báo hỏng mới"
            count={fresh.length}
            tone="stop"
            action={<Btn href="/may-moc/bao-hong">Mở Báo hỏng</Btn>}
          />
          {fresh.length === 0 ? (
            <Quiet>Không có báo hỏng mới.</Quiet>
          ) : (
            <div className="grid gap-2 p-2">{fresh.map(card)}</div>
          )}
          <SectionHead title="Chờ duyệt, đang sửa" count={fixing.length} />
          {fixing.length === 0 ? (
            <Quiet>Không có phiếu nào chờ duyệt hay đang sửa.</Quiet>
          ) : (
            <div className="grid gap-2 p-2">{fixing.map(card)}</div>
          )}
        </section>
        {/* Như demo: hai khối riêng "Bảo trì quá hạn" / "Đến hạn trong 7 ngày", mỗi khối
            một số đếm; cộng khối kiểm định sắp hết hạn (ô "Kiểm định ≤ 30 ngày" phía trên). */}
        <section className="min-w-0 border-b border-[var(--line)]" aria-label="Bảo trì">
          <SectionHead
            title="Bảo trì quá hạn"
            count={od.length}
            tone="stop"
            action={<Btn href="/may-moc/bao-tri">Mở Lịch bảo trì</Btn>}
          />
          {od.length === 0 ? (
            <Quiet>Không có việc quá hạn.</Quiet>
          ) : (
            <PlanRows label="Bảo trì quá hạn" rows={od} done={doneFn} />
          )}
          <SectionHead title="Đến hạn trong 7 ngày" count={soon.length} tone="warn" />
          {soon.length === 0 ? (
            <Quiet>Không có việc trong 7 ngày tới.</Quiet>
          ) : (
            <PlanRows label="Đến hạn trong 7 ngày" rows={soon} done={doneFn} />
          )}
          {kdSoon.length > 0 && (
            <>
              <SectionHead
                title="Kiểm định hết hạn trong 30 ngày"
                count={kdSoon.length}
                tone="warn"
                action={<Btn href="/may-moc/bao-tri?tab=kd">Mở Kiểm định</Btn>}
              />
              <PlanRows
                label="Kiểm định hết hạn trong 30 ngày"
                rows={kdSoon}
                done={doneFn}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
