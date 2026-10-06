import { describe, expect, it } from 'vitest'
import { sapLan, type LanViec } from './viec-sale'

const L = (key: LanViec['key'], tone: LanViec['tone'], count: number): LanViec => ({
  key,
  title: key,
  short: key,
  action: '',
  why: '',
  tone,
  count,
  items: [],
})

describe('sapLan — làn trống ẩn, khẩn trước, cùng mức thì nhiều việc trước', () => {
  it('bỏ làn 0 việc; đỏ → cam → thường; trong cùng mức xếp theo số', () => {
    const r = sapLan([
      L('bao-gia', 'neutral', 6),
      L('gia-0', 'warn', 2),
      L('han-giao', 'neutral', 0),
      L('de-y', 'stop', 1),
      L('chua-ngay', 'warn', 3),
    ])
    expect(r.map((l) => l.key)).toEqual(['de-y', 'chua-ngay', 'gia-0', 'bao-gia'])
  })
})
