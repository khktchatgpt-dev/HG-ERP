import { TrackingScreen } from '../../sales/tracking/TrackingScreen'

/**
 * Theo dõi đơn trong shell Kế hoạch - Cung ứng — chi tiết LSX mở bản
 * /planning/lsx (không nhảy shell Sales; mỗi bộ phận một màn riêng).
 */
export default function PlanningTrackingPage() {
  return <TrackingScreen lsxBase="/planning/lsx" />
}
