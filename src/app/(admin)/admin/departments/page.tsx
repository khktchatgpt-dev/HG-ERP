import { authService } from '@/modules/core/auth/auth.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersService } from '@/modules/core/users/users.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { DepartmentsManager } from './DepartmentsManager'

export default async function AdminDepartmentsPage() {
  const user = (await authService.currentUser())!
  const [departments, memberCounts, users, stages] = await Promise.all([
    departmentsService.list(),
    departmentsRepo.memberCounts(),
    usersService.list(user, { includeInactive: false, includeDeleted: false }),
    productionRepo.listStages(),
  ])

  return (
    <DepartmentsManager
      stages={stages}
      departments={departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        head_user_id: d.head_user_id,
        workspace_id: d.workspace_id,
        stage_code: d.stage_code,
        member_count: memberCounts[d.id] ?? 0,
      }))}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        department_id: u.department_id,
        title: u.title,
      }))}
    />
  )
}
