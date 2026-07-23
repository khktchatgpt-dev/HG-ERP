import { redirect } from 'next/navigation'

/** /admin/permissions → mặc định vào tab Nhân viên (employee-first). */
export default function AdminPermissionsIndex() {
  redirect('/admin/permissions/people')
}
