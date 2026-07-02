import { db } from '@/server/db'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatsBar } from '@/components/erp/StatsBar'

type CheckStatus = 'ok' | 'warn' | 'fail'
type Check = { name: string; status: CheckStatus; detail: string }

async function checkRls(): Promise<Check> {
  // Query pg_tables via RPC không có; dùng list_tables MCP-style qua SQL trực tiếp.
  // Ở đây kiểm nhanh bằng cách select 1 row info từ pg_class qua supabase RPC — không có.
  // Thay bằng approach đơn giản: DEFAULTS check ok nếu không có exception khi query.
  const { error } = await db().from('users').select('id', { count: 'exact', head: true })
  if (error) {
    return { name: 'Kết nối DB', status: 'fail', detail: error.message }
  }
  return { name: 'Kết nối DB', status: 'ok', detail: 'OK' }
}

async function checkTableCounts(): Promise<Check[]> {
  const tables: Array<{ table: 'users' | 'departments' | 'tasks' | 'notifications' | 'user_audit_log' | 'files'; label: string }> = [
    { table: 'users', label: 'Users' },
    { table: 'departments', label: 'Departments' },
    { table: 'tasks', label: 'Tasks' },
    { table: 'notifications', label: 'Notifications' },
    { table: 'user_audit_log', label: 'Audit log' },
    { table: 'files', label: 'Files' },
  ]
  const results = await Promise.all(
    tables.map(async (t) => {
      const { count, error } = await db()
        .from(t.table)
        .select('id', { count: 'exact', head: true })
      if (error) {
        return { name: `Bảng ${t.label}`, status: 'fail' as CheckStatus, detail: error.message }
      }
      return {
        name: `Bảng ${t.label}`,
        status: 'ok' as CheckStatus,
        detail: `${count ?? 0} row`,
      }
    }),
  )
  return results
}

async function checkStorageBuckets(): Promise<Check> {
  const { data, error } = await db().storage.listBuckets()
  if (error) {
    return { name: 'Storage buckets', status: 'fail', detail: error.message }
  }
  const expected = ['private', 'attachments', 'public']
  const found = new Set((data ?? []).map((b) => b.name))
  const missing = expected.filter((e) => !found.has(e))
  if (missing.length > 0) {
    return {
      name: 'Storage buckets',
      status: 'warn',
      detail: `Thiếu bucket: ${missing.join(', ')}`,
    }
  }
  return { name: 'Storage buckets', status: 'ok', detail: `Có đủ: ${expected.join(', ')}` }
}

async function checkOrphanedFiles(): Promise<Check> {
  const { count, error } = await db()
    .from('files')
    .select('id', { count: 'exact', head: true })
    .is('finalized_at', null)
    .is('deleted_at', null)
  if (error) {
    return { name: 'File chưa hoàn tất upload', status: 'fail', detail: error.message }
  }
  const n = count ?? 0
  if (n > 10) {
    return {
      name: 'File chưa hoàn tất upload',
      status: 'warn',
      detail: `${n} file khởi tạo upload nhưng chưa finalize`,
    }
  }
  return {
    name: 'File chưa hoàn tất upload',
    status: 'ok',
    detail: n === 0 ? 'Không có' : `${n} file (chấp nhận được)`,
  }
}

async function checkDeadSettings(): Promise<Check> {
  const { data, error } = await db()
    .from('settings')
    .select('key')
    .in('key', ['report_email', 'reminder_days_before', 'notifications_enabled'])
  if (error) {
    return { name: 'Cấu hình cũ dư thừa', status: 'fail', detail: error.message }
  }
  const dead = (data ?? []).map((r) => r.key)
  if (dead.length === 0) {
    return { name: 'Cấu hình cũ dư thừa', status: 'ok', detail: 'Sạch' }
  }
  return {
    name: 'Cấu hình cũ dư thừa',
    status: 'warn',
    detail: `${dead.length} key không dùng: ${dead.join(', ')}`,
  }
}

async function checkAdminCount(): Promise<Check> {
  const { count, error } = await db()
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true)
    .is('deleted_at', null)
  if (error) {
    return { name: 'Số admin đang hoạt động', status: 'fail', detail: error.message }
  }
  const n = count ?? 0
  if (n === 0) {
    return {
      name: 'Số admin đang hoạt động',
      status: 'fail',
      detail: 'KHÔNG có admin nào — nguy hiểm!',
    }
  }
  if (n === 1) {
    return {
      name: 'Số admin đang hoạt động',
      status: 'warn',
      detail: '1 admin — nếu tài khoản này mất truy cập sẽ không có ai reset được',
    }
  }
  return { name: 'Số admin đang hoạt động', status: 'ok', detail: `${n} admin` }
}

export default async function AdminHealthPage() {
  const [rls, counts, buckets, orphaned, dead, admins] = await Promise.all([
    checkRls(),
    checkTableCounts(),
    checkStorageBuckets(),
    checkOrphanedFiles(),
    checkDeadSettings(),
    checkAdminCount(),
  ])

  const allChecks = [rls, ...counts, buckets, orphaned, dead, admins]
  const summary = {
    ok: allChecks.filter((c) => c.status === 'ok').length,
    warn: allChecks.filter((c) => c.status === 'warn').length,
    fail: allChecks.filter((c) => c.status === 'fail').length,
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
          breadcrumbs={[
            { label: 'Quản trị', href: '/admin' },
            { label: 'Sức khoẻ hệ thống' },
          ]}
          title="Sức khoẻ hệ thống"
          description={`${allChecks.length} kiểm tra tự động. F5 để chạy lại.`}
        />

        <StatsBar
          stats={[
            { label: 'OK', value: summary.ok, tone: 'green' },
            { label: 'Cảnh báo', value: summary.warn, tone: summary.warn ? 'amber' : 'gray' },
            { label: 'Lỗi', value: summary.fail, tone: summary.fail ? 'red' : 'gray' },
          ]}
        />

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-2.5">Kiểm tra</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {allChecks.map((c) => (
                <tr key={c.name}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
    </div>
  )
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const map = {
    ok: { label: 'OK', cls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
    warn: { label: 'CẢNH BÁO', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    fail: { label: 'LỖI', cls: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  }
  const it = map[status]
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${it.cls}`}>{it.label}</span>
}
