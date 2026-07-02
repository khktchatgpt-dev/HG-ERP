import { db } from '@/server/db'
import type { FileBucket } from './files.schema'

const SIGNED_GET_TTL_SECONDS = 60

export const storage = {
  async createSignedUploadUrl(
    bucket: FileBucket,
    path: string,
  ): Promise<{ uploadUrl: string; token: string }> {
    const { data, error } = await db()
      .storage.from(bucket)
      .createSignedUploadUrl(path)
    if (error || !data) throw new Error(error?.message ?? 'signed upload failed')
    return { uploadUrl: data.signedUrl, token: data.token }
  },

  async createSignedDownloadUrl(
    bucket: FileBucket,
    path: string,
    ttlSeconds = SIGNED_GET_TTL_SECONDS,
  ): Promise<string> {
    const { data, error } = await db()
      .storage.from(bucket)
      .createSignedUrl(path, ttlSeconds)
    if (error || !data) throw new Error(error?.message ?? 'signed url failed')
    return data.signedUrl
  },

  async remove(bucket: FileBucket, paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await db().storage.from(bucket).remove(paths)
    if (error) throw new Error(error.message)
  },
}
