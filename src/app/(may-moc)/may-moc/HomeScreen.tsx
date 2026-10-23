'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Chip, Empty, ScreenFrame, ScreenHeader } from '@/components/kit'
import { dmy } from '@/lib/may-moc'
import { PlanDoneSheet } from './_ui/asset-dialogs'
import { ReportIssueSheet } from './_ui/issue-dialogs'
import { useIssueFlow } from './_ui/issue-flow'
import { ScanSheet } from './_ui/scan-sheet'
import { HomeToday } from './home-today'
import { HomeOverview } from './home-overview'
import type { HomeCtx, HomeData, HomeDlg, HomeView } from './home.shared'

/**
 * TRANG ĐẦU KHU MÁY MÓC (khuôn A · Vào việc) — hai bản như demo MOCA:
 *  - "Việc hôm nay" cho Tổ Cơ điện: nút nhanh, báo hỏng mới, đang sửa, bảo trì tới hạn.
 *  - "Tổng quan" cho Giám đốc: chỉ số, phiếu chờ duyệt, máy dừng, chi phí, máy hỏng nhiều.
 * Demo đổi bản theo vai; ERP mở sẵn bản đúng quyền (`page.tsx`) và để chip chuyển
 * qua lại, vì một người có thể giữ cả hai việc (quản trị, trưởng Cơ điện).
 */
export function HomeScreen({ d, initialView }: { d: HomeData; initialView: HomeView }) {
  const router = useRouter()
  const [view, setView] = useState<HomeView>(initialView)
  const [dlg, setDlg] = useState<HomeDlg>(null)
  const flow = useIssueFlow({
    techs: d.options.techs,
    approveOver: d.approve_over,
    me: d.meta.employee_id,
  })
  const pick = (v: HomeView) => {
    setView(v)
    router.replace(`/may-moc?xem=${v}`, { scroll: false })
  }
  const c: HomeCtx = {
    d,
    setDlg,
    flow,
    openIssue: (i) => router.push(`/may-moc/bao-hong?id=${i.id}`),
  }
  const title = view === 'tong-quan' ? 'Tổng quan' : 'Việc hôm nay'

  if (d.counts.machines === 0) {
    return (
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Máy móc & bảo trì"
          title={title}
          facts={[{ label: 'Hôm nay', value: dmy(d.today) }]}
        />
        <Empty
          level={2}
          headline="Chưa có máy nào trong hệ thống"
          reason="Trang này đếm trên danh sách máy: báo hỏng, lịch bảo trì, kiểm định, chi phí. Danh sách đang trống nên chưa có việc gì."
          next={
            d.meta.can_edit ? (
              <Btn primary icon="excel" href="/may-moc/may?nhap=1">
                Nhập danh sách máy
              </Btn>
            ) : (
              <Btn href="/may-moc/may">Mở danh sách máy</Btn>
            )
          }
        />
      </ScreenFrame>
    )
  }

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title={title}
        facts={[
          { label: 'Hôm nay', value: dmy(d.today) },
          { label: 'Máy', value: `${d.counts.machines}` },
        ]}
        actions={
          <>
            {/* Chip chuyển bản đứng ngoài <h1>: trong tiêu đề thì trình đọc đọc
                thành "Việc hôm nay Việc hôm nay Tổng quan". */}
            <span
              className="flex gap-1 border-r border-[var(--line)] pr-2"
              role="group"
              aria-label="Bản trang đầu"
            >
              <Chip on={view === 'hom-nay'} onClick={() => pick('hom-nay')}>
                Việc hôm nay
              </Chip>
              <Chip on={view === 'tong-quan'} onClick={() => pick('tong-quan')}>
                Tổng quan
              </Chip>
            </span>
            <Btn primary icon="canhBao" onClick={() => setDlg('report')}>
              Báo hỏng
            </Btn>
          </>
        }
      />
      {view === 'tong-quan' ? <HomeOverview c={c} /> : <HomeToday c={c} />}

      {flow.sheets}
      {dlg === 'report' && (
        <ReportIssueSheet assets={d.assets} onClose={() => setDlg(null)} />
      )}
      {dlg && typeof dlg === 'object' && 'scan' in dlg && (
        <ScanSheet
          intent={dlg.scan === 'hours' ? 'hours' : undefined}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg && typeof dlg === 'object' && 'plan' in dlg && (
        <PlanDoneSheet
          plan={dlg.plan}
          techs={d.options.techs}
          me={d.meta.employee_id}
          onClose={() => setDlg(null)}
        />
      )}
    </ScreenFrame>
  )
}
