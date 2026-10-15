import 'server-only'

/**
 * ĐỌC MÁY CHẤM CÔNG ZKTeco qua mạng (TCP cổng 4370) — chỉ ĐỌC: không xoá log,
 * không đổi giờ, không ghi người dùng.
 *
 * Chỉ chạy được khi server nằm CÙNG MẠNG với máy (PC ở xưởng, 192.168.1.x). Trên
 * Vercel không với tới IP nội bộ — lỗi kết nối được dịch thành câu người dùng đọc.
 *
 * Ba bẫy đo được 12/10/2026, đều IM LẶNG nếu không canh:
 *   1. Một lần đọc máy .201 trả 50.740/51.642 lượt, không báo lỗi → so số đọc được
 *      với `getInfo().logCounts`, thiếu thì đọc lại.
 *   2. `getInfo()` gọi SAU `getUsers()` ném RangeError (dữ liệu sót trong socket).
 *   3. Thư viện giải tên bằng ascii (tên máy .203 có dấu ra rác) và đổi giờ máy sang
 *      `Date` theo múi của server. Vá hai hàm giải mã: tên đọc utf8, giờ giữ nguyên
 *      giờ tường của máy ('YYYY-MM-DD HH:mm:ss', giờ Việt Nam).
 */

export type ZkUser = { code: string; name: string }
export type ZkLog = { code: string; at: string; verifyType: number; state: number }
export type ZkRead = {
  serial: string | null
  logCount: number
  logCapacity: number
  users: ZkUser[]
  logs: ZkLog[]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Giải ô giờ 4 byte của ZK thành giờ tường, không qua `Date`. */
export function zkTime(t: number): string {
  const s = t % 60
  t = (t - s) / 60
  const mi = t % 60
  t = (t - mi) / 60
  const h = t % 24
  t = (t - h) / 24
  const d = (t % 31) + 1
  t = (t - (d - 1)) / 31
  const mo = (t % 12) + 1
  const y = (t - (mo - 1)) / 12 + 2000
  return `${y}-${pad(mo)}-${pad(d)} ${pad(h)}:${pad(mi)}:${pad(s)}`
}

const cStr = (b: Buffer, enc: BufferEncoding) =>
  b.toString(enc).split('\0')[0].replace(/�/g, '').trim()

let loaded: Promise<typeof import('zkteco-js').default> | null = null

function loadZk() {
  loaded ??= (async () => {
    // Vá TRƯỚC khi nạp index: `ztcp.js` destructure các hàm này lúc nạp.
    const utils = (await import('zkteco-js/src/helper/utils.js')).default
    utils.decodeUserData72 = (b: Buffer) => ({
      uid: b.readUIntLE(0, 2),
      role: b.readUIntLE(2, 1),
      // Ô tên 24 byte; tên dài bị cắt giữa ký tự utf8 → bỏ ký tự hỏng.
      name: cStr(b.subarray(11, 35), 'utf8'),
      cardno: b.readUIntLE(35, 4),
      userId: cStr(b.subarray(48, 57), 'ascii'),
    })
    utils.decodeRecordData40 = (b: Buffer) => ({
      sn: b.readUIntLE(0, 2),
      user_id: cStr(b.subarray(2, 11), 'ascii'),
      record_time: zkTime(b.readUInt32LE(27)),
      type: b.readUIntLE(26, 1),
      state: b.readUIntLE(31, 1),
    })
    return (await import('zkteco-js')).default
  })()
  return loaded
}

const TIMEOUT_MS = 120_000
const UDP_INPORT = 4000
const MAX_TRY = 3

export type ZkInfo = {
  serial: string | null
  logCount: number
  logCapacity: number
  userCount: number
}

const cleanSerial = (s: unknown) =>
  typeof s === 'string' ? s.replace(/[^\x20-\x7e]/g, '') : null

/** Kiểm kết nối: chỉ đọc số serial + số lượt / sức chứa / số người — vài giây, không kéo log. */
export async function infoDevice(ip: string, port: number): Promise<ZkInfo> {
  const Zkteco = await loadZk()
  const dev = new Zkteco(ip, port, 15_000, UDP_INPORT)
  try {
    await dev.createSocket()
  } catch {
    throw new Error(
      `Không kết nối được máy ${ip}:${port}. Máy chấm công nằm trong mạng xưởng — chỉ server chạy trên máy tính cùng mạng (192.168.1.x) mới đọc được.`,
    )
  }
  try {
    const serial = await dev.getSerialNumber().catch(() => null)
    const info = await dev.getInfo()
    return {
      serial: cleanSerial(serial),
      logCount: info.logCounts,
      logCapacity: info.logCapacity,
      userCount: info.userCounts,
    }
  } finally {
    await dev.disconnect().catch(() => undefined)
  }
}

export async function readDevice(ip: string, port: number): Promise<ZkRead> {
  const Zkteco = await loadZk()
  const dev = new Zkteco(ip, port, TIMEOUT_MS, UDP_INPORT)
  try {
    await dev.createSocket()
  } catch {
    throw new Error(
      `Không kết nối được máy ${ip}:${port}. Máy chấm công nằm trong mạng xưởng — chỉ server chạy trên máy tính cùng mạng (192.168.1.x) mới đọc được.`,
    )
  }
  try {
    const serial = await dev.getSerialNumber().catch(() => null)
    const info = await dev.getInfo()
    const users = (await dev.getUsers()).data.map((u) => ({
      code: u.userId,
      name: u.name,
    }))
    let raw: Awaited<ReturnType<typeof dev.getAttendances>>['data'] = []
    for (let i = 0; i < MAX_TRY; i++) {
      raw = (await dev.getAttendances()).data
      if (raw.length >= info.logCounts) break
    }
    if (raw.length < info.logCounts) {
      throw new Error(
        `Máy ${ip} báo ${info.logCounts} lượt nhưng ${MAX_TRY} lần đọc chỉ được ${raw.length}. Thử kéo lại sau ít phút.`,
      )
    }
    return {
      serial: typeof serial === 'string' ? serial.replace(/[^\x20-\x7e]/g, '') : null,
      logCount: info.logCounts,
      logCapacity: info.logCapacity,
      users,
      logs: raw.map((r) => ({
        code: r.user_id,
        at: r.record_time,
        verifyType: r.type,
        state: r.state,
      })),
    }
  } finally {
    await dev.disconnect().catch(() => undefined)
  }
}
