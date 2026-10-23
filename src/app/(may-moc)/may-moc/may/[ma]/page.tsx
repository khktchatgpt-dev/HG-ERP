import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { HttpError } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { HoSoMayScreen } from './HoSoMayScreen'

export async function generateMetadata({ params }: { params: Promise<{ ma: string }> }) {
  const { ma } = await params
  return { title: decodeURIComponent(ma) }
}

const MUC = ['bao-tri', 'lich-su', 'thong-tin', 'tem'] as const

/**
 * HỒ SƠ MÁY — đường QR dẫn tới: `/may-moc/may/<mã tem>`. Mở theo MÃ chứ không
 * theo id để tem in ra đọc được bằng mắt và gõ tay được khi camera hỏng.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ ma: string }>
  searchParams: Promise<{ muc?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ ma }, { muc }, h] = await Promise.all([params, searchParams, headers()])
  const code = decodeURIComponent(ma)
  let d: Awaited<ReturnType<typeof assetsService.detail>>
  try {
    d = await assetsService.detail(user, code)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  // QR mã hoá đường dẫn ĐẦY ĐỦ — camera điện thoại mở thẳng trang, không cần màn quét.
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto =
    h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const qrSvg = await QRCode.toString(
    `${proto}://${host}/may-moc/may/${encodeURIComponent(code)}`,
    { type: 'svg', margin: 0, errorCorrectionLevel: 'M' },
  )
  const initial = (MUC as readonly string[]).includes(muc ?? '')
    ? (muc as (typeof MUC)[number])
    : 'bao-tri'
  return (
    <HoSoMayScreen
      key={d.asset.id}
      meta={d.meta}
      asset={d.asset}
      plans={d.plans}
      stats={d.stats}
      group={d.group}
      issues={d.issues}
      history={d.history}
      options={d.options}
      qrSvg={qrSvg}
      approveOver={d.approve_over}
      me={user.id}
      initialMuc={initial}
    />
  )
}
