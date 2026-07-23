'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AssignRolesModal, type CurrentRole } from './modals'
import type { Role } from '@/modules/core/rbac/rbac.repo'

export function AssignRolesButton({
  userId,
  userLabel,
  roles,
  current,
}: {
  userId: string
  userLabel: string
  roles: Role[]
  current: CurrentRole[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md border border-sky-300 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950"
      >
        Sửa vai
      </button>
      {open && (
        <AssignRolesModal
          userId={userId}
          userLabel={userLabel}
          roles={roles}
          current={current}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
