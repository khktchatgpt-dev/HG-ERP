import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KIT_FAMILIES, familyOf } from '../../_lab/kit-families'
import { DOCS } from '../_docs'

/**
 * Một trang tài liệu mỗi HỌ thành phần kit (B7). Nội dung ở `../_docs/<slug>.tsx`,
 * danh sách họ ở `_lab/kit-families.ts` — trang này chỉ tra và dựng.
 */
export function generateStaticParams() {
  return KIT_FAMILIES.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const f = familyOf((await params).slug)
  return { title: f ? `${f.title} · Thành phần · HG-ERP` : 'Thành phần · HG-ERP' }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const D = DOCS[slug]
  if (!D) notFound()
  return <D />
}
