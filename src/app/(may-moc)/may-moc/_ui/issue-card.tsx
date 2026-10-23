'use client'

import type { ReactNode } from 'react'
import { Btn, Tag } from '@/components/kit'
import { FeedbackImages } from '@/components/feedback/FeedbackImages'
import { TZ_VN, todayVn } from '@/lib/date-vn'
import { agoTxt, dmy, ISSUE_STATUS, shortMoney, vnd } from '@/lib/may-moc'
import type { AssetsMeta } from '@/modules/core/assets/assets.service'
import type { IssueView } from '@/modules/core/assets/issues.view'
import { AssetCode } from './shared'

export type IssueAct = 'accept' | 'approve' | 'reject' | 'done'

/** Giờ báo theo GIỜ VIỆT NAM — `reported_at` là ISO UTC, cắt chuỗi là lệch 7 tiếng. */
export const ago = (iso: string, today: string) => {
  const t = new Date(iso)
  const d = todayVn(t)
  const hm = t.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ_VN,
  })
  return d === today ? `${hm} hôm nay` : `${hm} ${dmy(d)}`
}

/** Nút xử lý của một phiếu theo trạng thái + quyền — cùng luật ở thẻ và khung chi tiết. */
export function issueActs(
  i: IssueView,
  meta: AssetsMeta,
  onAct: (k: IssueAct) => void,
  busy = false,
): ReactNode {
  if (i.status === 'moi' && meta.can_work)
    return (
      <Btn primary icon="nhanHang" onClick={() => onAct('accept')}>
        Nhận việc
      </Btn>
    )
  if (i.status === 'cho_duyet' && meta.can_approve)
    return (
      <>
        <Btn primary icon="duyet" busy={busy} onClick={() => onAct('approve')}>
          Duyệt {shortMoney(i.estimate ?? 0)}
        </Btn>
        <Btn onClick={() => onAct('reject')}>Không duyệt</Btn>
      </>
    )
  if (i.status === 'dang_sua' && meta.can_work)
    return (
      <Btn primary icon="xong" onClick={() => onAct('done')}>
        Sửa xong
      </Btn>
    )
  return null
}

/**
 * THẺ PHIẾU BÁO HỎNG — bản ERP của `issueCard` trong demo MOCA: trạng thái, mức,
 * lúc báo, máy, hiện tượng, ảnh, ai báo / ai sửa, dự toán hoặc chi phí thật, dòng
 * vết mới nhất, và nút xử lý ngay trên thẻ. Phẳng, viền mảnh (kit không dùng thẻ
 * nổi). Bấm số phiếu mở khung chi tiết.
 */
export function IssueCard({
  i,
  today,
  meta,
  onOpen,
  onAct,
  busy,
}: {
  i: IssueView
  today: string
  meta: AssetsMeta
  /** Mở khung chi tiết phiếu (đời phiếu đầy đủ). */
  onOpen: () => void
  onAct: (k: IssueAct) => void
  busy?: boolean
}) {
  const last = i.log.length ? i.log[i.log.length - 1] : null
  const who = i.tech_name ?? i.vendor
  const acts = issueActs(i, meta, onAct, busy)
  return (
    <article
      aria-label={`Phiếu ${i.no}`}
      className="text-k-sm grid gap-1.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-card)] p-2.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone={ISSUE_STATUS[i.status].tone}>{ISSUE_STATUS[i.status].label}</Tag>
        {i.priority === 'dung_may' ? (
          <Tag tone="stop">Dừng máy</Tag>
        ) : (
          <Tag tone="warn">Vẫn chạy được</Tag>
        )}
        {/* Như demo: kể tương đối ("25 phút trước"); giờ chính xác khi rê chuột. */}
        <span
          className="ml-auto text-[var(--ink-3)]"
          title={`Báo lúc ${ago(i.reported_at, today)}`}
          suppressHydrationWarning
        >
          {agoTxt(i.reported_at, new Date())}
        </span>
      </div>
      {/* Số phiếu + mã máy không được bẻ dòng ("BH-/0004" ở cột thẻ hẹp); tên
          máy xuống dòng riêng và cắt bằng dấu ba chấm. */}
      <div className="grid min-w-0 gap-0.5">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={onOpen}
            className="font-mono font-semibold text-[var(--act-text)] hover:underline"
          >
            {i.no}
          </button>
          {i.asset && <AssetCode code={i.asset.code} />}
        </div>
        <span className="text-k-body truncate font-semibold" title={i.asset?.name}>
          {i.asset?.name ?? '(máy đã xoá)'}
        </span>
      </div>
      <p className="text-k-body line-clamp-3">{i.description}</p>
      {i.file_ids.length > 0 && <FeedbackImages ids={i.file_ids.slice(0, 3)} />}
      <p className="text-[var(--ink-3)]">
        Báo: {i.reporter_name ?? '—'}
        {i.dept_name ? ` · ${i.dept_name}` : ''}
        {who ? ` · Sửa: ${who}` : ''}
        {i.estimate && i.status !== 'xong' ? ` · Dự toán ${shortMoney(i.estimate)}` : ''}
        {i.wo
          ? ` · Chi phí ${vnd(i.wo.cost)} đ, dừng ${i.wo.downtime_hours.toLocaleString('vi-VN')} giờ`
          : ''}
      </p>
      {last && (
        <p className="text-[var(--ink-2)]">
          ↳ {last.name}: {last.text}
        </p>
      )}
      {acts && <div className="flex flex-wrap gap-1.5 pt-0.5">{acts}</div>}
    </article>
  )
}
