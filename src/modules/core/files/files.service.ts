import { randomUUID } from 'crypto'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import {
  SIGNATURE_HEAD_BYTES,
  extensionIssue,
  signatureIssue,
} from '@/lib/file-signature'
import { assertCan } from '@/server/permissions'
import type { User } from '@/modules/core/users/users.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { isTechnicalStaff } from '@/modules/dept/technical/technical.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { MAX_SAMPLE_PHOTOS } from '@/modules/dept/technical/samples.schema'
import { tasksRepo } from '@/modules/workflow/tasks/tasks.repo'
import { db } from '@/server/db'
import {
  filesRepo,
  type FileParentColumn,
  type FileParentColumns,
  type FileRow,
} from './files.repo'
import {
  ALLOWED_MIME,
  formatBytes,
  maxBytesFor,
  type FileBucket,
  type InitUploadInput,
} from './files.schema'
import { storage } from './storage'

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100)
}

function buildPath(input: InitUploadInput, ownerId: string): string {
  const id = randomUUID()
  const safe = sanitizeFilename(input.filename)
  const prefix =
    input.parent.kind === 'none'
      ? `misc/${ownerId}`
      : `${input.parent.kind}/${input.parent.id}`
  return `${prefix}/${id}-${safe}`
}

function parentColumns(input: InitUploadInput): FileParentColumns {
  switch (input.parent.kind) {
    case 'task':
      return { task_id: input.parent.id }
    case 'comment':
      return { comment_id: input.parent.id }
    case 'customer':
      return { customer_id: input.parent.id }
    case 'invoice':
      return { invoice_id: input.parent.id }
    case 'product':
      return { product_id: input.parent.id }
    case 'quote':
      return { quote_id: input.parent.id }
    case 'sales_order':
      return { sales_order_id: input.parent.id }
    case 'production_order':
      return { production_order_id: input.parent.id }
    case 'purchase_order':
      return { purchase_order_id: input.parent.id }
    case 'sample':
      return { sample_id: input.parent.id }
    case 'none':
      return {}
  }
}

async function assertCanWriteParent(user: User, input: InitUploadInput): Promise<void> {
  if (input.parent.kind === 'task') {
    const task = await tasksRepo.findById(input.parent.id)
    if (!task) throw NotFound('Task not found')
    assertCan(user, 'task.update', { task })
    return
  }
  if (input.parent.kind === 'comment') {
    const { data } = await db()
      .from('task_comments')
      .select('task_id, user_id')
      .eq('id', input.parent.id)
      .maybeSingle()
    if (!data) throw NotFound('Comment not found')
    if (data.user_id !== user.id && user.role !== 'admin')
      throw Forbidden('Not the comment author')
    return
  }
  if (input.parent.kind === 'purchase_order') {
    // Hồ sơ mua hàng (FR-SUP-07): phòng KH-Cung ứng hoặc GĐ/Ban quản lý đính.
    const ok =
      user.role === 'admin' || user.role === 'manager' || (await isSupplyStaff(user))
    if (!ok) throw Forbidden('Chỉ Cung ứng hoặc GĐ/QL đính hồ sơ mua hàng')
    return
  }
  if (input.parent.kind === 'sample') {
    // Ảnh mẫu showroom (0061): mẫu do Kỹ thuật quản lý, nên chỉ Kỹ thuật gắn ảnh.
    // Không có nhánh này thì rơi xuống "any signed-in user" ở dưới — Sales cũng
    // sửa được ảnh mẫu, trái với quyết định chủ quản.
    if (!(await isTechnicalStaff(user))) {
      throw Forbidden('Chỉ phòng Kỹ thuật gắn ảnh mẫu showroom')
    }
    return
  }
  if (input.parent.kind === 'product') {
    // Tài liệu SP (bản vẽ / BOM / hướng dẫn lắp) là một tab của hồ sơ sản phẩm.
    // Hồ sơ nằm ở khu DÙNG CHUNG `/products` — mọi phòng XEM được, nên nhánh
    // này phải gác đúng quyền SỬA, không thì ai đăng nhập cũng đính được file
    // vào SP (UI đã ẩn nút theo `canEdit` nhưng API vẫn hở).
    await assertAction(user, 'technical.product.attach_file')
    return
  }
  // customer/invoice/none: any signed-in user can attach files for now.
  // Tighten as those modules grow real perms.
}

async function assertCanReadFile(user: User, file: FileRow): Promise<void> {
  if (user.role === 'admin') return
  if (file.owner_id === user.id) return
  if (file.task_id) {
    const task = await tasksRepo.findById(file.task_id)
    if (!task) throw NotFound('Parent task missing')
    assertCan(user, 'task.view', { task })
    return
  }
  if (file.comment_id) {
    const { data } = await db()
      .from('task_comments')
      .select('task_id')
      .eq('id', file.comment_id)
      .maybeSingle()
    if (!data) throw NotFound('Parent comment missing')
    const task = await tasksRepo.findById(data.task_id)
    if (!task) throw NotFound('Parent task missing')
    assertCan(user, 'task.view', { task })
    return
  }
  // Other parents: any signed-in user may read until per-domain perms exist.
}

function assertBucketAllowed(bucket: FileBucket, mime: string): void {
  if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    throw BadRequest(`MIME type not allowed: ${mime}`)
  }
  if (bucket === 'public' && !mime.startsWith('image/')) {
    throw BadRequest('public bucket is for images only')
  }
}

/**
 * Mẫu showroom chỉ trưng "4 góc" (0061). Ép ở service chứ không ở DB để đổi số
 * khỏi phải migration. Đếm lúc init nên vẫn có kẽ hở race giữa 2 upload cùng
 * lúc — chấp nhận được: hậu quả là 5 ảnh, không phải mất dữ liệu.
 */
async function assertSamplePhotoQuota(input: InitUploadInput): Promise<void> {
  if (input.parent.kind !== 'sample') return
  const { count } = await db()
    .from('files')
    .select('id', { count: 'exact', head: true })
    .eq('sample_id', input.parent.id)
    .is('deleted_at', null)
  if ((count ?? 0) >= MAX_SAMPLE_PHOTOS) {
    throw BadRequest(`Mỗi mẫu chỉ giữ ${MAX_SAMPLE_PHOTOS} ảnh — xoá bớt rồi tải lại`)
  }
}

export const filesService = {
  /**
   * Lưu file do SERVER cầm sẵn byte (không qua luồng 3 bước của trình duyệt) —
   * dùng cho ảnh bóc từ file Excel báo giá và cho chính file Excel nguồn.
   *
   * Ghi Storage TRƯỚC rồi mới chốt row: nếu đẩy byte hỏng thì row bị xoá mềm,
   * không để lại bản ghi trỏ vào object không tồn tại.
   */
  async uploadFromServer(
    user: User,
    input: {
      buffer: Buffer
      filename: string
      mime_type: InitUploadInput['mime_type']
      bucket: FileBucket
      parent: InitUploadInput['parent']
      doc_type?: InitUploadInput['doc_type']
    },
  ): Promise<string> {
    const max = maxBytesFor(input.doc_type)
    if (input.buffer.byteLength > max) {
      throw BadRequest(
        `File ${formatBytes(input.buffer.byteLength)} vượt giới hạn ${formatBytes(max)}`,
      )
    }
    // Đường này KHÔNG đi qua `initUploadSchema` (server tự cầm byte) nên phải tự
    // soát đuôi — không có nhánh này thì nó thành cửa sau của mọi luật ở đó.
    const extIssue = extensionIssue(input.filename)
    if (extIssue) throw BadRequest(extIssue)
    assertBucketAllowed(input.bucket, input.mime_type)
    const base: InitUploadInput = {
      bucket: input.bucket,
      filename: input.filename,
      mime_type: input.mime_type,
      size_bytes: input.buffer.byteLength,
      parent: input.parent,
      doc_type: input.doc_type ?? null,
    }
    await assertCanWriteParent(user, base)

    const path = buildPath(base, user.id)
    const row = await filesRepo.insert({
      bucket: input.bucket,
      path,
      filename: input.filename,
      mime_type: input.mime_type,
      size_bytes: input.buffer.byteLength,
      owner_id: user.id,
      doc_type: input.doc_type ?? null,
      parent: parentColumns(base),
    })
    try {
      await storage.uploadBuffer(input.bucket, path, input.buffer, input.mime_type)
    } catch (e) {
      await filesRepo.softDelete(row.id)
      throw e
    }
    await filesRepo.markFinalized(row.id, null, input.buffer.byteLength)
    return row.id
  },

  async initUpload(
    user: User,
    input: InitUploadInput,
  ): Promise<{ fileId: string; uploadUrl: string; token: string; path: string }> {
    // Chặn sớm để user biết ngay, nhưng size_bytes là số CLIENT KHAI — không tin
    // được. Ràng buộc thật nằm ở `finalize` (đo object trên Storage).
    const declaredMax = maxBytesFor(input.doc_type)
    if (input.size_bytes > declaredMax) {
      throw BadRequest(`Vượt giới hạn ${formatBytes(declaredMax)} cho loại tài liệu này`)
    }
    assertBucketAllowed(input.bucket, input.mime_type)
    await assertCanWriteParent(user, input)
    await assertSamplePhotoQuota(input)

    const path = buildPath(input, user.id)
    const row = await filesRepo.insert({
      bucket: input.bucket,
      path,
      filename: input.filename,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes,
      owner_id: user.id,
      doc_type: input.doc_type ?? null,
      parent: parentColumns(input),
    })
    const { uploadUrl, token } = await storage.createSignedUploadUrl(input.bucket, path)
    return { fileId: row.id, uploadUrl, token, path }
  },

  /**
   * Chốt file sau khi client PUT xong. Đây là chỗ giới hạn dung lượng thực sự có
   * hiệu lực: `size_bytes` lúc initUpload do client tự khai, client hoàn toàn có
   * thể khai 1 MB rồi PUT 9 MB. `file_size_limit` của bucket cũng không cứu được
   * vì nó chỉ có MỘT giá trị cho cả bucket (= mức cao nhất trong
   * DOC_TYPE_MAX_BYTES, xem migration 0147), không tách theo doc_type. Nên phải
   * đo object thật rồi mới chốt.
   */
  async finalize(user: User, fileId: string, checksum?: string): Promise<void> {
    const file = await filesRepo.getById(fileId)
    if (!file) throw NotFound('File not found')
    if (file.owner_id !== user.id && user.role !== 'admin')
      throw Forbidden('Not the uploader')

    const actualSize = await storage.getObjectSize(file.bucket, file.path)
    if (actualSize === null) throw BadRequest('Chưa tải file lên Storage')

    /** Bỏ object + row rồi ném lỗi — dùng cho mọi lý do từ chối sau khi đã PUT. */
    const rejectUploaded = async (reason: string): Promise<never> => {
      // Object đã nằm trên Storage rồi: không xoá thì vẫn tính tiền lưu và vẫn
      // tải về được qua signed URL dù row bị bỏ.
      await storage.remove(file.bucket, [file.path])
      storage.invalidateSignedUrl(file.bucket, file.path)
      await filesRepo.softDelete(fileId)
      throw BadRequest(reason)
    }

    const max = maxBytesFor(file.doc_type)
    if (actualSize > max) {
      await rejectUploaded(
        `File thật ${formatBytes(actualSize)}, vượt giới hạn ${formatBytes(max)}`,
      )
    }

    // Soi CHỮ KÝ ĐỊNH DẠNG của object thật. Đây là lớp duy nhất bắt được trò
    // đổi đuôi: `mime_type` trong DB là thứ trình duyệt khai lúc init, còn đây
    // là byte thật đã nằm trên Storage. Đọc được mà không khớp → từ chối; đọc
    // KHÔNG được (mạng lỗi / host không trả Range) → cho qua, vì chặn dựa trên
    // một phép đo thất bại sẽ khoá oan file thật của người dùng.
    const head = await storage.readHead(file.bucket, file.path, SIGNATURE_HEAD_BYTES)
    if (head && head.byteLength >= 4) {
      const issue = signatureIssue(file.mime_type, head)
      if (issue) await rejectUploaded(issue)
    }

    // Ghi đè bằng số đo thật — số client khai không đáng tin, mà cột này được
    // dùng để thống kê dung lượng.
    await filesRepo.markFinalized(fileId, checksum ?? null, actualSize)
  },

  /**
   * File kỹ thuật của 1 SP (FR-ENG-03). Thư viện SP là tài sản chung — mọi NV
   * đã đăng nhập đọc được (xưởng tra bản vẽ, các phòng tham chiếu).
   */
  async listForProduct(_user: User, productId: string): Promise<FileRow[]> {
    return filesRepo.listByProduct(productId)
  },

  /**
   * File gốc chứng từ (báo giá / đơn hàng / LSX). Chứng từ Sales là tài sản
   * chung — mọi NV đã đăng nhập đọc được (giống thư viện SP).
   */
  async listForDocument(
    _user: User,
    column: FileParentColumn,
    id: string,
  ): Promise<FileRow[]> {
    return filesRepo.listByParent(column, id)
  },

  /**
   * Map SP → đã có bản vẽ / BOM chưa (suy từ file upload, doc_type drawing/bom).
   * Thay cho việc nhìn cột link `drawing_url`/`bom_url` cũ. Bỏ trống `productIds`
   * = toàn bộ (StatsBar trang chủ).
   */
  async productDocFlags(
    productIds?: string[],
  ): Promise<Record<string, { drawing: boolean; bom: boolean }>> {
    const rows = await filesRepo.productDocFlags(productIds)
    const map: Record<string, { drawing: boolean; bom: boolean }> = {}
    for (const r of rows) {
      const e = (map[r.product_id] ??= { drawing: false, bom: false })
      if (r.doc_type === 'drawing') e.drawing = true
      if (r.doc_type === 'bom') e.bom = true
    }
    return map
  },

  async getDownloadUrl(user: User, fileId: string): Promise<string> {
    const { url } = await filesService.getDownloadTarget(user, fileId)
    return url
  },

  /**
   * URL tải cho NHIỀU file 1 lượt (map fileId → url). Gom về 1 query files +
   * 1 lần ký/bucket, thay cho N × (getById + createSignedUrl). Dùng cho thư
   * viện SP (24 ảnh/trang → 2 round-trip thay vì ~48). File không đọc được /
   * không ký được bị bỏ khỏi map (ảnh đó không hiện, không throw cả trang).
   */
  async getDownloadUrls(user: User, fileIds: string[]): Promise<Record<string, string>> {
    const ids = [...new Set(fileIds.filter(Boolean))]
    if (ids.length === 0) return {}
    const files = await filesRepo.getByIds(ids)

    const readable: FileRow[] = []
    for (const f of files) {
      try {
        await assertCanReadFile(user, f)
        readable.push(f)
      } catch {
        /* bỏ file không có quyền đọc */
      }
    }

    const byBucket = new Map<FileBucket, FileRow[]>()
    for (const f of readable) {
      const arr = byBucket.get(f.bucket) ?? []
      arr.push(f)
      byBucket.set(f.bucket, arr)
    }

    const out: Record<string, string> = {}
    for (const [bucket, group] of byBucket) {
      const urls = await storage.createSignedDownloadUrls(
        bucket,
        group.map((f) => f.path),
      )
      for (const f of group) {
        const hit = urls.get(f.path)
        if (hit) out[f.id] = hit.url
      }
    }
    return out
  },

  /**
   * Như `getDownloadUrl` nhưng kèm số giây còn lại của URL, để route HTTP đặt
   * `Cache-Control` khớp đúng hạn token (không cache quá hạn → ảnh vỡ).
   */
  async getDownloadTarget(
    user: User,
    fileId: string,
    /**
     * `true` = ép trình duyệt TẢI VỀ với đúng tên gốc (kể cả dấu tiếng Việt).
     * Mặc định `false` để ảnh/PDF còn xem trực tiếp được — cùng endpoint này
     * phục vụ cả `<img src>` lẫn nút Tải về.
     */
    asAttachment = false,
  ): Promise<{ url: string; expiresIn: number }> {
    const file = await filesRepo.getById(fileId)
    if (!file) throw NotFound('File not found')
    await assertCanReadFile(user, file)
    const { url, expiresAt } = await storage.createSignedDownloadUrl(
      file.bucket,
      file.path,
      undefined,
      asAttachment ? file.filename : undefined,
    )
    const expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
    return { url, expiresIn }
  },

  /**
   * DỌN FILE MỒ CÔI — row đã tạo lúc `initUpload` nhưng client không bao giờ
   * gọi `finalize` (đóng tab giữa chừng, mất mạng, PUT hỏng).
   *
   * Chúng vô hình với mọi màn hình (`listByParent` đòi `finalized_at`) nhưng
   * object vẫn có thể đã nằm trên Storage và vẫn tính tiền lưu — tức là rác
   * không ai nhìn thấy để mà dọn. Bảng `files` có sẵn index
   * `files_unfinalized_idx` từ 0006 dành riêng cho việc này, và trang Sức khoẻ
   * hệ thống đã đếm & cảnh báo từ lâu; đến bản này mới có nút đi xoá.
   *
   * `olderThanHours` để không cắt ngang một lần upload đang chạy dở.
   */
  async cleanupOrphans(
    user: User,
    olderThanHours = 24,
  ): Promise<{ removed: number; freedBytes: number }> {
    if (user.role !== 'admin') throw Forbidden('Chỉ quản trị hệ thống dọn được')
    const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString()
    const { data } = await db()
      .from('files')
      .select('id, bucket, path, size_bytes')
      .is('finalized_at', null)
      .is('deleted_at', null)
      .lt('created_at', cutoff)
      .limit(500)

    const rows = (data ?? []) as Pick<FileRow, 'id' | 'bucket' | 'path' | 'size_bytes'>[]
    let freedBytes = 0
    for (const row of rows) {
      // Object có thể chưa từng tồn tại (client bỏ cuộc trước cả bước PUT) —
      // xoá lỗi cũng không được chặn việc dọn row, nếu không thì kho rác đứng im.
      try {
        await storage.remove(row.bucket, [row.path])
        storage.invalidateSignedUrl(row.bucket, row.path)
        freedBytes += row.size_bytes ?? 0
      } catch {
        /* object không có sẵn — vẫn dọn row */
      }
      await filesRepo.softDelete(row.id)
    }
    return { removed: rows.length, freedBytes }
  },

  async delete(user: User, fileId: string): Promise<void> {
    const file = await filesRepo.getById(fileId)
    if (!file) throw NotFound('File not found')
    if (file.owner_id !== user.id && user.role !== 'admin')
      throw Forbidden('Only uploader or admin can delete')
    await storage.remove(file.bucket, [file.path])
    storage.invalidateSignedUrl(file.bucket, file.path)
    await filesRepo.softDelete(fileId)
  },
}
