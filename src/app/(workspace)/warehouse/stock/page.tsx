import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { StockManager } from './StockManager'

export default async function StockPage() {
  const user = (await authService.currentUser())!
  const canEdit = user.role === 'admin' || user.role === 'manager'
  const stock = await stockService.listStock(user, {})
  return <StockManager stock={stock} canEdit={canEdit} />
}
