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

/*
 * ĐỌC LOG TỪNG KHỐI (26/11/2026). `getAttendances()` của thư viện gửi CÙNG LÚC mọi
 * yêu cầu khối (máy .201: 35 khối × 64 KB), máy không xếp hàng nổi nên chỉ trả 2–5
 * khối rồi im; thư viện chờ 10 giây, nuốt lỗi "TIME OUT !! 33 PACKETS REMAIN" và trả
 * phần dở → cả hai máy dừng đúng ở 8.183 lượt, 3 lần như nhau. Đo cùng ngày: xin
 * khối sau khi nhận xong khối trước thì .201 đủ 56.883/56.883 (29 giây), .203 đủ
 * 95.588/95.588 (53 giây).
 */
const KHOI_TIMEOUT_MS = 20_000
const KHOI_THU = 3
const CMD_DATA = 1501
const CMD_DATA_WRRQ = 1503
const GET_ATTENDANCE_LOGS = Buffer.from([0x01, 0x0d, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const MAX_CHUNK = 65_472

/**
 * Tách các gói TCP của ZK (tiền tố 8 byte: 4 byte nhận dạng + 4 byte độ dài) đã
 * đủ trong `buf`. Chỉ lấy dữ liệu của gói CMD_DATA (bỏ 8 byte đầu lệnh); gói khác
 * (chuẩn bị dữ liệu, ACK, sự kiện quẹt thẻ thời gian thực) bỏ qua. Thuần — có test.
 */
export function tachGoiDuLieu(buf: Buffer): { data: Buffer[]; rest: Buffer } {
  const data: Buffer[] = []
  let b = buf
  while (b.length >= 8) {
    const len = b.readUInt32LE(4)
    if (b.length < 8 + len) break
    const pkt = b.subarray(8, 8 + len)
    b = b.subarray(8 + len)
    if (pkt.length >= 8 && pkt.readUInt16LE(0) === CMD_DATA) data.push(pkt.subarray(8))
  }
  return { data, rest: b }
}

type Kenh = NonNullable<import('zkteco-js').default['ztcp']>

function nhanKhoi(socket: import('node:net').Socket, size: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buf: Buffer = Buffer.alloc(0)
    let data: Buffer = Buffer.alloc(0)
    const xong = (err: Error | null, v?: Buffer) => {
      clearTimeout(t)
      socket.removeListener('data', on)
      if (err) reject(err)
      else resolve(v as Buffer)
    }
    const t = setTimeout(
      () =>
        xong(
          new Error(
            `hết ${KHOI_TIMEOUT_MS / 1000}s, mới nhận ${data.length}/${size} byte`,
          ),
        ),
      KHOI_TIMEOUT_MS,
    )
    const on = (chunk: Buffer) => {
      const r = tachGoiDuLieu(Buffer.concat([buf, chunk]))
      buf = r.rest
      if (r.data.length) data = Buffer.concat([data, ...r.data])
      if (data.length >= size) xong(null, data.subarray(0, size))
    }
    socket.on('data', on)
  })
}

/** Đọc toàn bộ log qua TCP, xin TỪNG khối một, mỗi khối thử lại tối đa 3 lần. */
async function docLogTungKhoi(
  z: Kenh,
  makeHeader: (cmd: number, session: number, reply: number, data: Buffer) => Buffer,
): Promise<Buffer> {
  if (!z.socket) throw new Error('Mất kết nối TCP với máy')
  await z.freeData()
  z.replyId++
  const reply = await z.requestData(
    makeHeader(CMD_DATA_WRRQ, z.sessionId, z.replyId, GET_ATTENDANCE_LOGS),
  )
  // Ít log: máy trả thẳng dữ liệu trong một gói.
  if (reply.readUInt16LE(8) === CMD_DATA) return reply.subarray(16)
  const size = reply.subarray(16).readUIntLE(1, 4)
  const parts: Buffer[] = []
  for (let start = 0; start < size; start += MAX_CHUNK) {
    const n = Math.min(MAX_CHUNK, size - start)
    let got: Buffer | null = null
    let loi: unknown = null
    for (let thu = 0; thu < KHOI_THU && !got; thu++) {
      const p = nhanKhoi(z.socket, n)
      await z.sendChunkRequest(start, n)
      got = await p.catch((e: unknown) => {
        loi = e
        return null
      })
    }
    if (!got) {
      throw new Error(
        `Đọc khối ${start / MAX_CHUNK + 1}/${Math.ceil(size / MAX_CHUNK)} hỏng sau ${KHOI_THU} lần: ${loi instanceof Error ? loi.message : String(loi)}`,
      )
    }
    parts.push(got)
  }
  await z.freeData().catch(() => undefined)
  return Buffer.concat(parts)
}

/** Giải log 40 byte/lượt (bỏ 4 byte đầu) — cùng bố cục bản vá `decodeRecordData40` ở trên. */
function giaiLog(buf: Buffer): ZkLog[] {
  const out: ZkLog[] = []
  for (let o = 4; o + 40 <= buf.length; o += 40) {
    const b = buf.subarray(o, o + 40)
    out.push({
      code: cStr(b.subarray(2, 11), 'ascii'),
      at: zkTime(b.readUInt32LE(27)),
      verifyType: b.readUIntLE(26, 1),
      state: b.readUIntLE(31, 1),
    })
  }
  return out
}

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
    let logs: ZkLog[] = []
    for (let i = 0; i < MAX_TRY; i++) {
      if (dev.connectionType === 'tcp' && dev.ztcp) {
        const utils = (await import('zkteco-js/src/helper/utils.js')).default
        logs = giaiLog(await docLogTungKhoi(dev.ztcp, utils.createTCPHeader))
      } else {
        // UDP (máy không mở TCP): đường của thư viện.
        logs = (await dev.getAttendances()).data.map((r) => ({
          code: r.user_id,
          at: r.record_time,
          verifyType: r.type,
          state: r.state,
        }))
      }
      if (logs.length >= info.logCounts) break
    }
    if (logs.length < info.logCounts) {
      throw new Error(
        `Máy ${ip} báo ${info.logCounts} lượt nhưng ${MAX_TRY} lần đọc chỉ được ${logs.length}. Thử kéo lại sau ít phút.`,
      )
    }
    return {
      serial: typeof serial === 'string' ? serial.replace(/[^\x20-\x7e]/g, '') : null,
      logCount: info.logCounts,
      logCapacity: info.logCapacity,
      users,
      logs,
    }
  } finally {
    await dev.disconnect().catch(() => undefined)
  }
}
