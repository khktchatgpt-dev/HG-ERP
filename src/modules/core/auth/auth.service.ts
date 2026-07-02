import { verifyPassword } from '@/modules/core/auth/password'
import { createSession, destroySession, getSession } from '@/modules/core/auth/session'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { Unauthorized } from '@/server/http'

// Pre-computed bcrypt hash used to keep timing roughly constant when the user
// doesn't exist — avoids an email-enumeration side channel on /login.
const DUMMY_HASH =
  '$2a$12$CwTycUXWue0Thq9StjUM0uJ8L0v.5h6h7n5xq4Hkz8t9V1iX3W3i.'

// NOTE: there is no self-registration. Accounts are provisioned by an admin via
// POST /api/users (see modules/users). The first admin is seeded out-of-band
// (scripts/create-user.ts or an UPDATE on the bootstrap row).
export const authService = {
  async login(input: { email: string; password: string }): Promise<User> {
    const row = await usersRepo.findByEmail(input.email)
    const ok = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH)
    if (!row || !ok || !row.is_active) {
      throw Unauthorized('Invalid credentials')
    }
    await createSession({ sub: row.id, email: row.email })
    void usersRepo.touchLastLogin(row.id)
    const { password_hash, ...user } = row
    return user
  },

  async logout() {
    await destroySession()
  },

  async currentUser(): Promise<User | null> {
    const session = await getSession()
    if (!session) return null
    return usersRepo.findById(session.sub)
  },

  /** Throws 401 if not signed in. Use at the top of protected routes. */
  async requireUser(): Promise<User> {
    const user = await this.currentUser()
    if (!user) throw Unauthorized()
    return user
  },
}
