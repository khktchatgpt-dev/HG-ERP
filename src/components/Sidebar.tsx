import Link from 'next/link'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { authService } from '@/modules/core/auth/auth.service'

type Item = {
  href: string
  label: string
  icon: string
  visible: (ctx: { role: string; isHead: boolean }) => boolean
}

const SECTIONS: { heading: string; items: Item[] }[] = [
  {
    heading: 'Của tôi',
    items: [
      { href: '/', label: 'Tổng quan', icon: '◧', visible: () => true },
      { href: '/plan', label: 'Kế hoạch', icon: '☷', visible: () => true },
      { href: '/tasks', label: 'Công việc', icon: '◐', visible: () => true },
      { href: '/dept/hr/leave', label: 'Đơn nghỉ phép', icon: '☰', visible: () => true },
      { href: '/notifications', label: 'Thông báo', icon: '◔', visible: () => true },
    ],
  },
  {
    heading: 'Quản lý',
    items: [
      {
        href: '/tasks/new',
        label: 'Giao việc',
        icon: '+',
        visible: ({ role }) => role === 'manager' || role === 'admin',
      },
      {
        href: '/team',
        label: 'Đội nhóm',
        icon: '◑',
        visible: ({ role, isHead }) => role === 'admin' || isHead,
      },
      {
        href: '/reports/weekly',
        label: 'Báo cáo tuần',
        icon: '☰',
        visible: ({ role, isHead }) => role === 'manager' || role === 'admin' || isHead,
      },
    ],
  },
  {
    heading: 'Hệ thống',
    items: [
      {
        href: '/admin',
        label: 'Quản trị',
        icon: '⚙',
        visible: ({ role }) => role === 'admin',
      },
    ],
  },
]

// Dept-specific links keyed by department `name` in DB.
const DEPT_NAV: Record<string, Item[]> = {
  'Bán Hàng': [
    { href: '/sales/customers', label: 'Khách hàng', icon: '◍', visible: () => true },
  ],
  'Hành Chính Nhân Sự': [
    {
      href: '/dept/hr/leave?scope=pending',
      label: 'Duyệt đơn',
      icon: '✓',
      visible: () => true,
    },
  ],
  'Kỹ Thuật': [
    {
      href: '/dept/technical/products',
      label: 'Thư viện SP',
      icon: '◇',
      visible: () => true,
    },
  ],
  'Tài Chính Kế Toán': [
    {
      href: '/dept/accounting/invoices',
      label: 'Hoá đơn',
      icon: '₫',
      visible: () => true,
    },
  ],
}

export async function Sidebar({ current }: { current?: string } = {}) {
  const user = await authService.currentUser()
  if (!user) return null

  const head = await departmentsRepo.findHeadedBy(user.id)
  const ctx = { role: user.role, isHead: !!head }

  // Resolve user's dept name to look up dept-specific nav.
  let deptName: string | null = null
  let deptItems: Item[] = []
  if (user.department_id) {
    const dept = await departmentsRepo.findById(user.department_id)
    if (dept) {
      deptName = dept.name
      deptItems = DEPT_NAV[dept.name] ?? []
    }
  }

  // Admin sees ALL dept sections grouped at the bottom.
  const adminDeptSections =
    user.role === 'admin'
      ? Object.entries(DEPT_NAV).map(([name, items]) => ({ name, items }))
      : []

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-900 px-3 py-5 text-slate-200 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-amber-500 font-bold text-slate-900">
          HG
        </span>
        <div className="flex flex-col">
          <span className="text-sm leading-tight font-semibold text-white">
            Hoàng Gia
          </span>
          <span className="text-[10px] tracking-wider text-slate-400 uppercase">
            Task Manager
          </span>
        </div>
      </Link>

      {SECTIONS.map((sec) => {
        const items = sec.items.filter((i) => i.visible(ctx))
        if (items.length === 0) return null
        return (
          <NavSection
            key={sec.heading}
            heading={sec.heading}
            items={items}
            current={current}
          />
        )
      })}

      {/* User's own dept */}
      {deptName && deptItems.length > 0 && user.role !== 'admin' && (
        <NavSection heading={`PB ${deptName}`} items={deptItems} current={current} />
      )}

      {/* Admin sees every dept section */}
      {adminDeptSections.map(({ name, items }) =>
        items.length > 0 ? (
          <NavSection
            key={`admin-${name}`}
            heading={`PB ${name}`}
            items={items}
            current={current}
          />
        ) : null,
      )}
    </aside>
  )
}

function NavSection({
  heading,
  items,
  current,
}: {
  heading: string
  items: Item[]
  current?: string
}) {
  return (
    <div className="mb-2">
      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
        {heading}
      </div>
      {items.map((i) => {
        const active =
          current === i.href || (i.href !== '/' && current?.startsWith(i.href))
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition ${
              active
                ? 'bg-slate-800 text-white shadow-[inset_3px_0_0] shadow-amber-500'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <span className="w-4 text-center text-slate-400">{i.icon}</span>
            {i.label}
          </Link>
        )
      })}
    </div>
  )
}
