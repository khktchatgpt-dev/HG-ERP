'use client'

import { use } from 'react'
import { ApprovalCenterScreen } from '@/app/(workspace)/exec/approvals/ApprovalCenterScreen'
import { GiamSatMuaHangScreen } from '@/app/(workspace)/exec/purchasing/GiamSatMuaHangScreen'
import { DonScreen } from '@/app/(mua-hang)/mua-hang/don/DonScreen'
import { DEFAULT_VIEW } from '@/app/(mua-hang)/mua-hang/don/views'
import hopKy from '../_du-lieu/hop-ky.json'
import giamSat from '../_du-lieu/giam-sat.json'
import donMua from '../_du-lieu/don-mua.json'

/**
 * TRANG CHỤP MÀN — màn THẬT dựng bằng dữ liệu ĐÓNG BĂNG (28/09/2026).
 *
 * Để `npm run ui:shots` (Playwright, `e2e/ui-shots.spec.ts`) chụp ở 1280×800 và
 * so với ảnh chuẩn: màn thật cần đăng nhập + dữ liệu sống đổi hằng ngày, không
 * chụp so sánh được. Dữ liệu ở `_du-lieu/*.json` là ảnh chụp DB thật ngày
 * 28/09/2026 (script đóng băng ghi ở docs của bước 2); đồng hồ trình duyệt do
 * test cố định cùng ngày đó.
 *
 * Khung 1280×800 ghim cứng: `ScreenFrame` tự đặt cao theo cửa sổ, ở đây phải
 * bằng đúng khung chụp.
 */
const TODAY = '2026-09-28'

/* eslint-disable @typescript-eslint/no-explicit-any -- dữ liệu JSON đóng băng */
const MAN: Record<string, () => React.ReactNode> = {
  'hop-ky': () => <ApprovalCenterScreen box={hopKy as any} initialKind="all" />,
  'giam-sat': () => (
    <GiamSatMuaHangScreen
      w={giamSat.w as any}
      names={giamSat.names as any}
      oldestPendingDays={13}
      truncatedAt={null}
    />
  ),
  'don-mua': () => (
    <DonScreen
      today={TODAY}
      pos={donMua.pos as any}
      suppliers={donMua.suppliers}
      lsxs={donMua.lsxs as any}
      meId={donMua.meId}
      canEdit
      truncatedAt={null}
      initial={DEFAULT_VIEW}
      openId={null}
      defaultScope="toi"
      urlScope={null}
      people={donMua.people}
    />
  ),
}

export default function Page({ params }: { params: Promise<{ man: string }> }) {
  const { man } = use(params)
  const ve = MAN[man]
  return (
    <>
      <style>
        {'.chup-khung > div { height: 800px !important; margin: 0 !important; } .lab-bar { display: none !important; }'}
      </style>
      <div
        className="kit chup-khung"
        data-chup={man}
        style={{
          width: 1280,
          height: 800,
          display: 'grid',
          gridTemplateRows: 'minmax(0,1fr)',
          overflow: 'hidden',
        }}
      >
        {ve ? ve() : <p>Không có màn “{man}”.</p>}
      </div>
    </>
  )
}
