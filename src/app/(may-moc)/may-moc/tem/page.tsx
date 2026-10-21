import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { inBooks } from '@/lib/may-moc'
import { TemScreen } from './TemScreen'

export const metadata = { title: 'In tem QR' }

/**
 * IN TEM QR — mỗi tem 50 × 30 mm, QR chứa đường dẫn tới hồ sơ máy. Lọc: `?ma=`
 * một máy (từ hồ sơ máy), `?to=` một tổ (từ danh sách), không có = mọi máy +
 * dụng cụ đang trên sổ. QR vẽ ở máy chủ thành SVG — in ra nét, không mờ.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ma?: string; to?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ ma, to }, h, d] = await Promise.all([
    searchParams,
    headers(),
    assetsService.list(user),
  ])
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto =
    h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const list = d.assets.filter(
    (a) => inBooks(a.status) && (ma ? a.code === ma : !to || a.department_id === to),
  )
  const labels = await Promise.all(
    list.slice(0, 300).map(async (a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      dept: a.dept_name,
      svg: await QRCode.toString(
        `${proto}://${host}/may-moc/may/${encodeURIComponent(a.code)}`,
        { type: 'svg', margin: 0, errorCorrectionLevel: 'M' },
      ),
    })),
  )
  const deptName = to ? (d.options.depts.find((x) => x.id === to)?.name ?? null) : null
  return (
    <TemScreen
      labels={labels}
      total={list.length}
      scope={ma ? `máy ${ma}` : deptName ? `tổ ${deptName}` : 'mọi máy và dụng cụ'}
      depts={d.options.depts}
      to={to ?? ''}
    />
  )
}
