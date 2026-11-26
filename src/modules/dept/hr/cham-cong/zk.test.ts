import { describe, expect, it } from 'vitest'
import { tachGoiDuLieu, zkTime } from './zk'

/** Gói TCP ZK: 4 byte nhận dạng + 4 byte độ dài + [lệnh 2 · checksum 2 · session 2 · reply 2] + dữ liệu. */
function goi(cmd: number, data: Buffer): Buffer {
  const body = Buffer.alloc(8 + data.length)
  body.writeUInt16LE(cmd, 0)
  data.copy(body, 8)
  const head = Buffer.from([0x50, 0x50, 0x82, 0x7d, 0, 0, 0, 0])
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

const CMD_DATA = 1501
const CMD_PREPARE_DATA = 1500
const CMD_REG_EVENT = 500

describe('tachGoiDuLieu — đọc log máy chấm công từng khối (26/11/2026)', () => {
  it('lấy dữ liệu của gói CMD_DATA, bỏ gói chuẩn bị và sự kiện quẹt thẻ', () => {
    const buf = Buffer.concat([
      goi(CMD_PREPARE_DATA, Buffer.from([0, 4, 0, 0, 0])),
      goi(CMD_DATA, Buffer.from('abc')),
      goi(CMD_REG_EVENT, Buffer.from('xx')),
      goi(CMD_DATA, Buffer.from('de')),
    ])
    const r = tachGoiDuLieu(buf)
    expect(Buffer.concat(r.data).toString()).toBe('abcde')
    expect(r.rest.length).toBe(0)
  })

  it('gói bị cắt giữa chừng thì giữ phần dư, ghép với lần nhận sau', () => {
    const full = Buffer.concat([
      goi(CMD_DATA, Buffer.from('hello')),
      goi(CMD_DATA, Buffer.from('world')),
    ])
    // Gói đầu dài 8 + 8 + 5 = 21 byte: cắt ở 25 là đủ gói đầu, gói sau dở dang.
    const cut = 25
    const a = tachGoiDuLieu(full.subarray(0, cut))
    expect(Buffer.concat(a.data).toString()).toBe('hello')
    const b = tachGoiDuLieu(Buffer.concat([a.rest, full.subarray(cut)]))
    expect(Buffer.concat(b.data).toString()).toBe('world')
    expect(b.rest.length).toBe(0)
  })

  it('chưa đủ 8 byte tiền tố thì chưa tách gì', () => {
    const r = tachGoiDuLieu(Buffer.from([0x50, 0x50, 0x82]))
    expect(r.data).toEqual([])
    expect(r.rest.length).toBe(3)
  })
})

describe('zkTime', () => {
  it('giải giờ tường không qua Date', () => {
    // 2026-11-26 09:07:05 theo công thức ZK
    const t = ((((26 * 12 + 10) * 31 + 25) * 24 + 9) * 60 + 7) * 60 + 5
    expect(zkTime(t)).toBe('2026-11-26 09:07:05')
  })
})
