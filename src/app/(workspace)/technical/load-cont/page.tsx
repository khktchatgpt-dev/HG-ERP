import { PageHeader } from '@/components/erp/PageHeader'
import { LoadContCalculator } from './LoadContCalculator'

export const metadata = { title: 'Tính load cont' }

export default function LoadContPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Kỹ thuật', href: '/technical' },
          { label: 'Tính load cont' },
        ]}
        title="Tính load cont"
        description="Nhập danh sách kiện hàng để tính số cont cần và sơ đồ xếp an toàn: nặng dưới nhẹ trên, kiện dễ vỡ / kiện hở không bị đè, không gác lệch, và vùng gần cửa cont chỉ xếp cột thấp + vững để không đổ hàng khi mở cửa."
      />
      <LoadContCalculator />
    </div>
  )
}
