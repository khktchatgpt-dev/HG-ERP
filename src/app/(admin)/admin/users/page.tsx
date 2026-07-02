import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { UsersManager } from './UsersManager'

export default async function AdminUsersPage() {
  const user = (await authService.currentUser())!
  const [users, departments] = await Promise.all([
    usersService.list(user, { includeInactive: true, includeDeleted: true }),
    departmentsService.list(),
  ])

  return (
    <UsersManager
      users={users}
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      currentUserId={user.id}
    />
  )
}
