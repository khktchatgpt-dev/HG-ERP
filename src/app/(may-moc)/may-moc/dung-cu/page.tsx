import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { DungCuScreen } from './DungCuScreen'

export const metadata = { title: 'Dụng cụ theo người' }

export default async function Page() {
  const user = await authService.requirePageUser()
  const d = await assetsService.tools(user)
  return (
    <DungCuScreen meta={d.meta} holders={d.holders} store={d.store} options={d.options} />
  )
}
