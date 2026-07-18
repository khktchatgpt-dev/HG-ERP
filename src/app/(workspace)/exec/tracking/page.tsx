import { TrackingScreen } from '../../sales/tracking/TrackingScreen'

/**
 * Theo dõi đơn trong shell Ban Giám đốc — chi tiết LSX mở bản /exec/lsx
 * (duyệt được tại chỗ, không nhảy shell Sales).
 */
export default function ExecTrackingPage() {
  return <TrackingScreen lsxBase="/exec/lsx" />
}
