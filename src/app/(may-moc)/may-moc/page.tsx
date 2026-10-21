import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { HomeScreen } from './HomeScreen'

export const metadata = { title: 'Máy móc · Việc hôm nay' }

export default async function Page() {
  const user = await authService.requirePageUser()
  const d = await assetsService.home(user)
  return (
    <HomeScreen
      meta={d.meta}
      today={d.today}
      counts={d.counts}
      issues={d.issues}
      plans={d.plans}
      options={d.options}
      approveOver={d.approve_over}
      assets={d.assets}
    />
  )
}
