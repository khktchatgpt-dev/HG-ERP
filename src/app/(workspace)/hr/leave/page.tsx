import { LeaveScreen } from './LeaveScreen'

export default async function HRLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: 'mine' | 'pending' | 'all' }>
}) {
  const sp = await searchParams
  return <LeaveScreen scope={sp.scope ?? 'pending'} />
}
