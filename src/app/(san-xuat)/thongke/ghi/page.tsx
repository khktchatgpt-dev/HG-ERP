import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  loadEntrySheet,
  worklistService,
} from '@/modules/dept/production/worklist.service'
import { canEditComponents, isProductionStaff } from '@/modules/dept/production/perms'
import { entriesRepo } from '@/modules/dept/production/entries.repo'
import { entryDocsRepo } from '@/modules/dept/production/entry-docs.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { maChuaGhiService } from '@/modules/dept/production/ma-chua-ghi.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { shiftIso, vnTodayIso } from '@/lib/local-date'
import { Rong, SxKhung } from '@/app/(workspace)/production/_erp/khung'
import { GhiScreen } from './GhiScreen'
import { ChuaGhiScreen } from './ChuaGhiScreen'
import { lenhOptions } from '@/lib/ma-chua-ghi'

export const dynamic = 'force-dynamic'

/**
 * GHI SẢN LƯỢNG — MỘT LỆNH MỘT LƯỢT, KHÔNG có màn chọn lệnh đứng trước.
 *
 * Lịch sử hai lần đảo, ghi lại để đừng đảo lần ba mà quên vì sao:
 *
 * - Tới 21/09/2026: có màn "Bước 1 chọn lệnh" chặn trước lưới. Chủ dự án chê
 *   "khó dùng và bất tiện" → bỏ.
 * - 21/09: đổi sang mở MỌI lệnh đang chạy, lệnh tụt xuống làm bộ lọc.
 * - 22/09: chủ dự án chê tiếp — gộp nhiều lệnh vào một lưới là rối (208 dòng
 *   của 8 lệnh ở Phôi).
 *
 * Bản này lấy phần đúng của cả hai: phạm vi là MỘT lệnh, nhưng không có màn
 * chặn — đổi lệnh bằng chip ngay đầu phiếu.
 *
 * Lệnh mặc định: lệnh dùng lần trước (cookie `sx_ghi_lsx`), không có thì lệnh
 * còn NHIỀU VIỆC NHẤT. Cookie chứ không localStorage vì server đọc được →
 * render một lần đúng lệnh, không nháy. `?lsx=` ưu tiên cao nhất (link cũ).
 *
 * 03/11/2026 (B3): dựng lại KHÔNG kit theo cấu hình công đoạn — xem
 * `GhiScreen.tsx`.
 *
 * 15/11/2026 (bản vẽ MRFoxWgh…, Q1–Q5): ô chọn lệnh có MỌI lệnh đang chạy (nhóm
 * "Chưa ghi được" cho lệnh chưa có bảng chi tiết); `?lsx=` của lệnh như vậy mở
 * màn nói lý do (`ChuaGhiScreen`); lệnh không còn chạy thì dải đỏ nói thẳng —
 * trước đó cả hai trường hợp đều LẶNG LẼ mở lệnh khác (GIGA), thống kê gõ nhầm.
 */
export const GHI_LSX_COOKIE = 'sx_ghi_lsx'

export default async function GhiSanLuongPage({
  searchParams,
}: {
  searchParams: Promise<{
    lsx?: string
    stage?: string
    date?: string
    team?: string
  }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  if (!canRecord) redirect('/thongke/lenh')

  // Danh sách lệnh phải có TRƯỚC để chọn lệnh mặc định, nên hai lượt tải này
  // không song song được. Tổ + danh mục công đoạn + "đã ghi" 14 ngày đi cùng lượt.
  const today = vnTodayIso()
  const from14 = shiftIso(today, -13)
  const [data, depts, stagesCat, entries14, docs14, tinhTrang, canKhai] =
    await Promise.all([
      worklistService.list(user, {}),
      departmentsRepo.list(),
      productionRepo.listStages(),
      entriesRepo.listRange(from14, today),
      entryDocsRepo.listStatusRange(from14, today),
      maChuaGhiService.load(),
      canEditComponents(user),
    ])
  const options = lenhOptions(tinhTrang, data.lsx_cards)
  const ttById = new Map(tinhTrang.map((t) => [t.lsx_id, t]))

  // Mở ĐÚNG chỗ (bản vẽ 14/11/2026, Q5): `?team=` / `?date=` từ Sổ ngày và Sổ
  // đã ghi; không có `?stage=` thì công đoạn của tổ (tổ trên đường dẫn, không có
  // thì tổ của tài khoản) — Thống kê Tổ Hàn mở ra là tab Hàn, không phải Phôi.
  const teamParam = sp.team && depts.some((d) => d.id === sp.team) ? sp.team : null
  const teamDept = depts.find((d) => d.id === (teamParam ?? user.department_id))
  const stageOfTeam =
    teamDept && teamDept.workspace_id === 'production'
      ? resolveTeamStage(teamDept, stagesCat)
      : null
  const initialDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : null

  // "Đã ghi" theo tổ|ngày — dòng xanh trên đầu lưới (Q6).
  const daGhi: Record<string, { lines: number; docs: number; drafts: number }> = {}
  for (const e of entries14) {
    if (!e.team_department_id) continue
    const k = `${e.team_department_id}|${e.entry_date}`
    daGhi[k] = { ...(daGhi[k] ?? { lines: 0, docs: 0, drafts: 0 }) }
    daGhi[k].lines++
  }
  for (const x of docs14) {
    if (!x.team_department_id) continue
    const k = `${x.team_department_id}|${x.entry_date}`
    if (!daGhi[k]) continue
    daGhi[k].docs++
    if (x.status === 'nhap' || x.status === 'tu_choi') daGhi[k].drafts++
  }
  const remembered = (await cookies()).get(GHI_LSX_COOKIE)?.value ?? null
  const openable = data.lsx_cards

  // Q2: lệnh đang chạy nhưng chưa có dòng việc (chưa có bảng chi tiết) → màn lý do.
  if (sp.lsx && ttById.has(sp.lsx) && !openable.some((c) => c.lsx_id === sp.lsx)) {
    return (
      <ChuaGhiScreen lenh={ttById.get(sp.lsx)!} options={options} canKhai={canKhai} />
    )
  }
  // Q5: lệnh trong đường dẫn không còn chạy → nói thẳng, rồi mới mở lệnh khác.
  const lenhKhongChay =
    sp.lsx && !ttById.has(sp.lsx) ? await maChuaGhiService.lenhKhongChay(sp.lsx) : null
  const pick =
    openable.find((c) => c.lsx_id === sp.lsx)?.lsx_id ??
    openable.find((c) => c.lsx_id === remembered)?.lsx_id ??
    [...openable].sort((a, b) => b.open_count - a.open_count)[0]?.lsx_id ??
    null

  const sheet = await loadEntrySheet({
    stage: sp.stage ?? stageOfTeam ?? null,
    lsxId: pick,
  })

  if (!sheet) {
    return (
      <SxKhung bare label="Ghi sản lượng">
        <Rong
          tieuDe="Chưa có việc nào để ghi sản lượng"
          lyDo="Lệnh phải được duyệt VÀ định hình chi tiết thì mới sinh ra dòng để ghi."
          tiep={
            <Link href="/thongke/lenh" className="sx-btn p">
              Xem lệnh sản xuất
            </Link>
          }
        />
      </SxKhung>
    )
  }

  return (
    <GhiScreen
      key={`${sp.lsx ?? 'all'}|${sheet.stage}|${initialDate ?? ''}|${teamParam ?? ''}`}
      sheet={sheet}
      userTeamId={user.department_id ?? null}
      initialDate={initialDate}
      initialTeamId={teamParam}
      daGhi={daGhi}
      lsxOptions={options}
      chuaGhi={sheet.lsx ? (ttById.get(sheet.lsx.id) ?? null) : null}
      lenhKhongChay={lenhKhongChay}
      canKhai={canKhai}
    />
  )
}
