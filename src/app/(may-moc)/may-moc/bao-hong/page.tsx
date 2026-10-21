import { authService } from '@/modules/core/auth/auth.service'
import { issuesService } from '@/modules/core/assets/issues.service'
import { ISSUE_STATUS, type IssueStatus } from '@/lib/may-moc'
import { BaoHongScreen } from './BaoHongScreen'

export const metadata = { title: 'Báo hỏng máy' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ id, tab }, d] = await Promise.all([searchParams, issuesService.list(user)])
  return (
    <BaoHongScreen
      meta={d.meta}
      me={d.me}
      today={d.today}
      approveOver={d.approve_over}
      issues={d.issues}
      assets={d.assets}
      techs={d.techs}
      initialId={id && d.issues.some((i) => i.id === id) ? id : null}
      initialTab={tab && Object.hasOwn(ISSUE_STATUS, tab) ? (tab as IssueStatus) : 'open'}
    />
  )
}
