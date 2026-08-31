import { hashPassword, verifyPassword } from '@/modules/core/auth/password'
import { passwordVersion } from '@/modules/core/auth/auth.service'
import { createSession } from '@/modules/core/auth/session'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo, userAuditRepo, type User } from '@/modules/core/users/users.repo'
import { storage } from '@/modules/core/files/storage'
import { BadRequest, Unauthorized } from '@/server/http'
import type { AccountPasswordInput, AccountProfileInput } from './account.schema'
import { AVATAR_EXT, AVATAR_MAX_BYTES, type AvatarMime } from './account.schema'

/**
 * Tài khoản của CHÍNH MÌNH.
 *
 * Tách khỏi `users.service` vì service đó `assertCan('user.manage')` ở mọi hàm —
 * nó là công cụ admin quản người khác. Ở đây không có kiểm quyền nào cả: đối
 * tượng thao tác LUÔN là `actor`, không nhận id từ ngoài vào, nên không có
 * đường để sửa nhầm hồ sơ người khác.
 */

/**
 * Ảnh đại diện nằm ở bucket `attachments` (private, đọc bằng URL ký) chứ không
 * phải `public`: bucket public cho phép ai cầm được đường dẫn cũng tải, mà
 * đường dẫn ở đây đoán được — `avatars/<user_id>.jpg`.
 *
 * `users.avatar_url` LƯU PATH chứ không lưu URL: URL ký hết hạn sau 1 giờ, cất
 * vào DB là cất một thứ chết yểu. Tên cột giữ nguyên từ 0002 cho khỏi phải
 * migrate lại chỗ chưa ai dùng.
 */
const AVATAR_BUCKET = 'attachments' as const

export type MyProfile = {
  user: User
  /** Tên phòng ban — hiển thị kèm, không sửa được ở đây. */
  department_name: string | null
  /** URL ký của ảnh đại diện, null nếu chưa đặt. */
  avatar_url: string | null
}

/**
 * URL hiển thị ảnh đại diện (đã ký, hạn 1 giờ, có cache theo path).
 *
 * Hàm rời chứ không phải method gọi `accountService.avatarUrl(...)` từ trong
 * chính object: tự tham chiếu kiểu đó chết ở server dev vì object còn đang khởi
 * tạo ("accountService is not defined").
 *
 * Nuốt lỗi trả null: hàm này được gọi ở TOPBAR nên chạy trên mọi trang — object
 * lỡ bị xoá tay trên Storage thì rơi về chữ cái đầu, không phải cả hệ thống 500.
 */
async function resolveAvatarUrl(user: Pick<User, 'avatar_url'>): Promise<string | null> {
  if (!user.avatar_url) return null
  try {
    const { url } = await storage.createSignedDownloadUrl(AVATAR_BUCKET, user.avatar_url)
    return url
  } catch {
    return null
  }
}

export const accountService = {
  async getProfile(actor: User): Promise<MyProfile> {
    const [dept, avatar_url] = await Promise.all([
      actor.department_id ? departmentsRepo.findById(actor.department_id) : null,
      resolveAvatarUrl(actor),
    ])
    return { user: actor, department_name: dept?.name ?? null, avatar_url }
  },

  /** Sửa hồ sơ của mình. Chỉ họ tên + SĐT — phần còn lại do admin quản. */
  async updateProfile(actor: User, input: AccountProfileInput): Promise<User> {
    const patch: AccountProfileInput = {}
    if (input.name !== undefined && input.name !== actor.name) patch.name = input.name
    if (input.phone !== undefined && input.phone !== actor.phone)
      patch.phone = input.phone
    if (Object.keys(patch).length === 0) return actor

    const user = await usersRepo.updateSelf(actor.id, patch)
    await userAuditRepo.insert({
      target_user_id: actor.id,
      actor_id: actor.id,
      action: 'profile_update',
      before: Object.fromEntries(
        (Object.keys(patch) as (keyof AccountProfileInput)[]).map((k) => [k, actor[k]]),
      ),
      after: patch,
    })
    return user
  },

  /**
   * Đổi mật khẩu của mình.
   *
   * Cấp lại cookie cho THIẾT BỊ ĐANG THAO TÁC ngay sau khi ghi hash mới: mọi
   * token cũ (kể cả token của chính request này) mang `pv` đời cũ nên chết ở
   * request kế — không cấp lại thì người vừa đổi mật khẩu bị đá về /login.
   */
  async changePassword(actor: User, input: AccountPasswordInput): Promise<void> {
    const hash = await usersRepo.getPasswordHash(actor.id)
    if (!hash) throw Unauthorized()
    if (!(await verifyPassword(input.current_password, hash))) {
      throw BadRequest('Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD')
    }

    const password_hash = await hashPassword(input.new_password)
    const changedAt = await usersRepo.setPasswordHash(actor.id, password_hash)

    await createSession({
      sub: actor.id,
      email: actor.email,
      pv: passwordVersion(changedAt),
      // `setPasswordHash` vừa hạ `must_change_password` — token mới phải hạ
      // theo, không thì người vừa đổi xong vẫn bị proxy giữ ở /doi-mat-khau.
      mc: false,
    })
    await userAuditRepo.insert({
      target_user_id: actor.id,
      actor_id: actor.id,
      action: 'password_change',
    })
  },

  /**
   * Đặt ảnh đại diện. Ghi đè đúng một object mỗi người (`avatars/<id>.<ext>`)
   * thay vì tích một object mỗi lần đổi — ảnh cũ không còn ai trỏ tới, giữ lại
   * chỉ tốn dung lượng. Đổi định dạng (jpg→png) thì dọn object cũ.
   *
   * KHÔNG đi qua bảng `files`: bảng đó gắn tài liệu vào một thực thể nghiệp vụ
   * (đơn, LSX, SP…) và chưa có cột nào trỏ về user. Ảnh đại diện là thuộc tính
   * của chính hàng `users`, thêm một parent kind chỉ để chứa nó là thừa.
   */
  async setAvatar(
    actor: User,
    file: { buffer: Buffer; mime: AvatarMime },
  ): Promise<User> {
    if (file.buffer.byteLength === 0) throw BadRequest('Tệp rỗng')
    if (file.buffer.byteLength > AVATAR_MAX_BYTES) {
      throw BadRequest('Ảnh tối đa 2MB')
    }

    const path = `avatars/${actor.id}.${AVATAR_EXT[file.mime]}`
    await storage.uploadBuffer(AVATAR_BUCKET, path, file.buffer, file.mime, {
      upsert: true,
    })
    // URL ký cũ trỏ đúng path này nhưng là ảnh cũ — bỏ cache, không thì người
    // vừa đổi ảnh vẫn thấy ảnh cũ tới một tiếng.
    storage.invalidateSignedUrl(AVATAR_BUCKET, path)
    if (actor.avatar_url && actor.avatar_url !== path) {
      await storage.remove(AVATAR_BUCKET, [actor.avatar_url]).catch(() => {})
      storage.invalidateSignedUrl(AVATAR_BUCKET, actor.avatar_url)
    }

    const user = await usersRepo.updateSelf(actor.id, { avatar_url: path })
    await userAuditRepo.insert({
      target_user_id: actor.id,
      actor_id: actor.id,
      action: 'profile_update',
      before: { avatar_url: actor.avatar_url },
      after: { avatar_url: path },
    })
    return user
  },

  async removeAvatar(actor: User): Promise<User> {
    if (!actor.avatar_url) return actor
    await storage.remove(AVATAR_BUCKET, [actor.avatar_url]).catch(() => {})
    storage.invalidateSignedUrl(AVATAR_BUCKET, actor.avatar_url)
    const user = await usersRepo.updateSelf(actor.id, { avatar_url: null })
    await userAuditRepo.insert({
      target_user_id: actor.id,
      actor_id: actor.id,
      action: 'profile_update',
      before: { avatar_url: actor.avatar_url },
      after: { avatar_url: null },
    })
    return user
  },

  /** Xem `resolveAvatarUrl`. */
  avatarUrl: resolveAvatarUrl,
}
