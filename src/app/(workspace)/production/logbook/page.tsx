import { redirect } from 'next/navigation'

/** Đường cũ — Sổ số liệu đã dời sang workspace Thống kê xưởng (/thongke). */
export default function OldLogbookPage() {
  redirect('/thongke')
}
