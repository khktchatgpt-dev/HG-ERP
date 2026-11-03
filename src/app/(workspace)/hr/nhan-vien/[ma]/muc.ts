/**
 * Các mục (tab) của trang hồ sơ — file thường, KHÔNG 'use client': page.tsx (server) đọc
 * `MUC` để kiểm ?muc=; hằng xuất từ file client tới server thành tham chiếu client.
 * B4 (bản vẽ 02/11/2026): "Tổng quan" + "Cá nhân" gộp thành "Thông tin".
 */
export type Muc = 'thong-tin' | 'lich-su' | 'hop-dong' | 'giay-to' | 'luong'
export const MUC: Muc[] = ['thong-tin', 'lich-su', 'hop-dong', 'giay-to', 'luong']
