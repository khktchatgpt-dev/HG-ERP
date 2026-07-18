import { ShapingList } from './ShapingList'

/** Định hình SX trong shell Sản xuất — bản dùng chung ở ShapingList.tsx. */
export default function ProductionShapingPage() {
  return (
    <ShapingList
      base="/production/shaping"
      rootCrumb={{ label: 'Sản xuất', href: '/production' }}
    />
  )
}
