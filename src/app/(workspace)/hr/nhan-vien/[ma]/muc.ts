/**
 * Các mục (tab) của trang hồ sơ — file thường, KHÔNG 'use client': page.tsx (server) đọc
 * `MUC` để kiểm ?muc=; hằng xuất từ file client tới server thành tham chiếu client.
 */
export type Muc = 'tong-quan' | 'ca-nhan' | 'hop-dong' | 'giay-to' | 'luong' | 'lich-su'
export const MUC: Muc[] = [
  'tong-quan',
  'ca-nhan',
  'hop-dong',
  'giay-to',
  'luong',
  'lich-su',
]
