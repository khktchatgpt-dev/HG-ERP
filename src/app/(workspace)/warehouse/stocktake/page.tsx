import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { StocktakeScreen } from './StocktakeScreen'

export default async function StocktakePage() {
  const user = (await authService.currentUser())!
  const stock = await stockService.listStock(user, {})
  return <StocktakeScreen stock={stock} />
}
