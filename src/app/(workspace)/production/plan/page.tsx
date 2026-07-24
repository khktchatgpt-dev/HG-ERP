import { redirect } from 'next/navigation'

/** Đường cũ — Kế hoạch SX đã dời sang workspace riêng (/kehoach-sx). */
export default function OldPlanPage() {
  redirect('/kehoach-sx')
}
