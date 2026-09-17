'use client'

import { useLocalPref } from '@/lib/use-local-pref'

/**
 * LỚP TOKEN CỦA KIT cho khu Ban Giám đốc — cùng cách khu Mua hàng làm.
 *
 * `WorkspaceShell` gắn `.theme-v3` ở gốc (sidebar, thanh trên), còn màn mới
 * đọc token của `.kit`; thiếu lớp này thì `--act`, `--line`, `--surface-card`
 * rỗng và cả khu mất màu.
 *
 * HAI LỚP TOKEN LỒNG NHAU LÀ CÓ CHỦ Ý: `.theme-v3` phủ KHUNG, `.kit` phủ NỘI
 * DUNG. Luật "một file một hệ" của CLAUDE.md nói về file màn hình — vỏ và nội
 * dung là hai file khác nhau.
 *
 * MẬT ĐỘ có THANG RIÊNG cho khu này (`hg.exec.dense`), không dùng chung với
 * Mua hàng: Giám đốc đọc để ký, người mua gõ như Excel — hai nhịp làm việc
 * khác nhau thì không có lý do gì bắt chung một mật độ.
 *
 * MƯỜI MÀN THEO DÕI CÒN LẠI (`/exec/orders`, `/exec/production`, …) vẫn dùng
 * `components/erp` + shadcn theme v3, và chúng KHÔNG hỏng vì lớp này: token
 * `.kit` chỉ thêm biến, không xoá biến của `.theme-v3`. Chúng đọc `--primary`,
 * `bg-card`… như cũ.
 */
export const EXEC_DENSE_KEY = 'hg.exec.dense'

export function ExecKitFrame({ children }: { children: React.ReactNode }) {
  const [dense] = useLocalPref(EXEC_DENSE_KEY, '0')
  return <div className={dense === '1' ? 'kit kit-dense' : 'kit'}>{children}</div>
}
