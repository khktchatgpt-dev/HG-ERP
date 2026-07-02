import { randomUUID } from 'crypto'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { assertCan } from '@/server/permissions'
import type { User } from '@/modules/core/users/users.repo'
import { tasksRepo } from '@/modules/workflow/tasks/tasks.repo'
import { db } from '@/server/db'
import {
  filesRepo,
  type FileParentColumns,
  type FileRow,
} from './files.repo'
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
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
  // customer/invoice/product/none: any signed-in user can attach files for now.
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

export const filesService = {
  async initUpload(
    user: User,
    input: InitUploadInput,
  ): Promise<{ fileId: string; uploadUrl: string; token: string; path: string }> {
    if (input.size_bytes > MAX_UPLOAD_BYTES) {
      throw BadRequest(`Max upload size is ${MAX_UPLOAD_BYTES} bytes`)
    }
    assertBucketAllowed(input.bucket, input.mime_type)
    await assertCanWriteParent(user, input)

    const path = buildPath(input, user.id)
    const row = await filesRepo.insert({
      bucket: input.bucket,
      path,
      filename: input.filename,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes,
      owner_id: user.id,
      parent: parentColumns(input),
    })
    const { uploadUrl, token } = await storage.createSignedUploadUrl(
      input.bucket,
      path,
    )
    return { fileId: row.id, uploadUrl, token, path }
  },

  async finalize(user: User, fileId: string, checksum?: string): Promise<void> {
    const file = await filesRepo.getById(fileId)
    if (!file) throw NotFound('File not found')
    if (file.owner_id !== user.id && user.role !== 'admin')
      throw Forbidden('Not the uploader')
    await filesRepo.markFinalized(fileId, checksum ?? null)
  },

  async getDownloadUrl(user: User, fileId: string): Promise<string> {
    const file = await filesRepo.getById(fileId)
    if (!file) throw NotFound('File not found')
    await assertCanReadFile(user, file)
    return storage.createSignedDownloadUrl(file.bucket, file.path)
  },

  async delete(user: User, fileId: string): Promise<void> {
    const file = await filesRepo.getById(fileId)
    if (!file) throw NotFound('File not found')
    if (file.owner_id !== user.id && user.role !== 'admin')
      throw Forbidden('Only uploader or admin can delete')
    await storage.remove(file.bucket, [file.path])
    await filesRepo.softDelete(fileId)
  },
}
