import { describe, it, expect, beforeAll } from 'vitest'
import { fileImageSrc, imageSig, verifyImageSig } from './file-image'

const ID = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

beforeAll(() => {
  process.env.SESSION_SECRET = 'x'.repeat(48)
})

describe('imageSig', () => {
  /**
   * TÍNH TẤT ĐỊNH LÀ CẢ ĐIỂM CỦA TÍNH NĂNG NÀY: chữ ký đổi giữa hai lần gọi thì
   * `src` đổi theo, và Vercel lại tính tiền tối ưu lại từ đầu — đúng cái lỗi
   * đang đi sửa. Test này canh không ai lỡ nhét thời gian/ngẫu nhiên vào chữ ký.
   */
  it('cùng file luôn ra cùng chữ ký', () => {
    expect(imageSig(ID)).toBe(imageSig(ID))
    expect(fileImageSrc(ID)).toBe(fileImageSrc(ID))
  })

  it('file khác nhau thì chữ ký khác nhau', () => {
    expect(imageSig(ID)).not.toBe(imageSig(OTHER))
  })

  it('src là đường dẫn tương đối kèm chữ ký', () => {
    expect(fileImageSrc(ID)).toBe(`/api/files/${ID}/img?s=${imageSig(ID)}`)
  })
})

describe('verifyImageSig', () => {
  it('nhận chữ ký đúng', () => {
    expect(verifyImageSig(ID, imageSig(ID))).toBe(true)
  })

  it('từ chối chữ ký của file khác — không mượn link chéo được', () => {
    expect(verifyImageSig(ID, imageSig(OTHER))).toBe(false)
  })

  it('từ chối chữ ký rỗng / sai độ dài mà không ném', () => {
    expect(verifyImageSig(ID, '')).toBe(false)
    expect(verifyImageSig(ID, 'abc')).toBe(false)
    expect(verifyImageSig(ID, imageSig(ID) + 'ff')).toBe(false)
  })
})
