import { canonicalMime, extensionIssue, fileExtension } from './file-signature'
import { formatBytes, isAllowedMime, maxBytesFor } from './file-limits'
import { MAX_TASK_FILES } from './task-flow'

/**
 * TỆP ĐÍNH KÈM TRÊN VIỆC — phần thuần của màn (B2, 03/11/2026): chọn tệp nào nhận,
 * tệp nào từ chối và vì sao. Luật dung lượng lấy từ `file-limits` (ảnh 5 MB — ảnh
 * chụp tự thu nhỏ trước khi so; tài liệu 50 MB), không đặt số riêng.
 *
 * Tệp lỗi KHÔNG chặn các tệp còn lại: mỗi tệp một kết quả, màn báo ngay trên tệp đó.
 */

const RASTER = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** Ảnh raster xem trực tiếp được (thumbnail); còn lại là tài liệu. */
export function isImageMime(mime: string): boolean {
  return RASTER.includes(mime)
}

/** Nhãn đuôi 3 chữ hoa trên ô tệp ("PDF", "XLSX" → "XLS"). */
export function extLabel(filename: string): string {
  const e = fileExtension(filename).toUpperCase()
  return e ? e.slice(0, 3) : 'TỆP'
}

export type PickResult = {
  accepted: File[]
  /** Tệp bị từ chối kèm lý do nói được cách gỡ. */
  rejected: { name: string; size: number; reason: string }[]
}

/**
 * Chọn trong `picked` những tệp nhận được, khi việc đã có `existing` tệp.
 * Ảnh quá 5 MB vẫn nhận — bước tải lên tự thu nhỏ rồi mới so; vì vậy ở đây ảnh chỉ
 * bị chặn khi vượt trần tài liệu (50 MB, không thu nhỏ nổi).
 */
export function pickTaskFiles(picked: File[], existing: number): PickResult {
  const accepted: File[] = []
  const rejected: PickResult['rejected'] = []
  let room = Math.max(0, MAX_TASK_FILES - existing)
  for (const f of picked) {
    const bad = (reason: string) => rejected.push({ name: f.name, size: f.size, reason })
    const ext = extensionIssue(f.name)
    if (ext) {
      bad(ext)
      continue
    }
    const mime = canonicalMime(f.name, f.type)
    if (!isAllowedMime(mime)) {
      bad('Loại tệp này hệ thống không nhận')
      continue
    }
    const max = maxBytesFor(isImageMime(mime) ? null : 'other')
    if (f.size > max) {
      bad(`${formatBytes(f.size)} — tối đa ${formatBytes(max)}`)
      continue
    }
    if (room <= 0) {
      bad(`Đã đủ ${MAX_TASK_FILES} tệp — xoá bớt rồi thêm`)
      continue
    }
    room--
    accepted.push(f)
  }
  return { accepted, rejected }
}
