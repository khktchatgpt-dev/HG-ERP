import type { Metadata } from 'next'
import { DesignLab } from './DesignLab'

export const metadata: Metadata = {
  title: 'HG Design Lab — theme v3 "HG Ledger"',
  description:
    'Trang thử nghiệm bộ giao diện mới: token màu, thang chữ, component, bảng dữ liệu, mobile.',
}

export default function DesignLabPage() {
  return <DesignLab />
}
