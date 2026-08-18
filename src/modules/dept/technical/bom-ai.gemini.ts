import { GoogleGenAI, type Part } from '@google/genai'
import { buildExtractJsonSchema } from './bom-ai.schema'
import {
  buildSystemPrompt,
  buildUserPrompt,
  modelFor,
  type BomExtractInput,
  type BomExtractOutput,
} from './bom-ai.provider'
import { BadRequest, TooManyRequests } from '@/server/http'

/**
 * Bản cài đặt `BomExtractor` dùng Gemini. Song song với `bom-ai.anthropic.ts`
 * và dùng CHUNG prompt + CHUNG JSON Schema, nên chấm điểm hai bên là so đúng
 * một biến: mô hình.
 *
 * Dùng `responseJsonSchema` chứ không phải `responseSchema`: trường sau nhận
 * biến thể OpenAPI 3.0 (nullable/UPPERCASE type) nên sẽ phải dựng schema riêng
 * và hai bên bắt đầu trôi khỏi nhau. `responseJsonSchema` nhận JSON Schema
 * chuẩn — kể cả `anyOf`, `enum`, `additionalProperties` — đúng thứ tầng chung
 * đang phát ra.
 *
 * SERVER-ONLY: giữ API key, không bao giờ import từ Client Component.
 *
 * LƯU Ý DỮ LIỆU: định mức là cấu thành giá thành. Cân nhắc chạy qua Vertex AI
 * thay vì API key của AI Studio — điều khoản dùng dữ liệu của hai đường khác
 * nhau.
 */

/**
 * Lỗi của Google → câu người dùng đọc được.
 *
 * Không dịch thì mọi sự cố phía nhà cung cấp đều rơi ra "Internal server error"
 * — người dùng không biết nên thử lại (quá tải) hay đi sửa cấu hình (key sai,
 * hết hạn mức). Ba nhóm đó cần ba hành động khác nhau nên phải tách bạch.
 */
function translateGeminiError(err: unknown, model: string): Error {
  const status = (err as { status?: number })?.status
  const raw = err instanceof Error ? err.message : String(err)
  const code = /"status"\s*:\s*"([A-Z_]+)"/.exec(raw)?.[1]

  if (status === 503 || code === 'UNAVAILABLE') {
    return TooManyRequests(
      `Model "${model}" đang quá tải bên Google. Thử lại sau ít phút, hoặc đổi BOM_AI_MODEL sang model khác.`,
    )
  }
  if (status === 429 || code === 'RESOURCE_EXHAUSTED') {
    return TooManyRequests(
      'Đã hết hạn mức gọi Gemini (quota). Chờ hạn mức làm mới hoặc nâng gói.',
    )
  }
  if (status === 400 && /API[_ ]key/i.test(raw)) {
    return BadRequest('GEMINI_API_KEY không hợp lệ — kiểm lại key trong .env.local')
  }
  if (status === 403) {
    return BadRequest(`Key không có quyền dùng model "${model}"`)
  }
  if (status === 404) {
    return BadRequest(
      `Không có model "${model}" — sửa BOM_AI_MODEL trong .env.local cho đúng tên.`,
    )
  }
  return err instanceof Error ? err : new Error(raw)
}

const isOverloaded = (err: unknown): boolean => {
  const status = (err as { status?: number })?.status
  const raw = err instanceof Error ? err.message : String(err)
  return (
    status === 503 ||
    status === 429 ||
    /"status"\s*:\s*"(UNAVAILABLE|RESOURCE_EXHAUSTED)"/.test(raw)
  )
}

/**
 * Thử lại khi Google báo quá tải.
 *
 * Cần thiết vì `@google/genai` KHÔNG tự retry 5xx (khác SDK Anthropic, mặc định
 * retry 2 lần). Đo 17/08/2026: request nhỏ đi lọt trong khi request thật —
 * prompt hệ thống + lưới ô + schema đầy đủ — trả 503 ngay sau đó trên cùng một
 * model, tức là lỗi công suất theo kích thước chứ không phải model chết hẳn.
 *
 * Giãn cách 2s → 5s → 11s: người dùng đã chờ chục giây cho một lần đọc file,
 * chờ thêm chút để khỏi phải bấm lại từ đầu là đánh đổi đúng.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (!isOverloaded(err) || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i + 1000))
    }
  }
  throw last
}

export async function extractWithGemini(
  input: BomExtractInput,
): Promise<BomExtractOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw BadRequest('Thiếu GEMINI_API_KEY trong .env.local')

  const ai = new GoogleGenAI({ apiKey })
  const model = modelFor('gemini')

  const parts: Part[] = []
  if (input.document) {
    parts.push({
      inlineData: {
        mimeType: input.document.mimeType,
        data: input.document.dataBase64,
      },
    })
  }
  parts.push({ text: buildUserPrompt(input) })

  const req = {
    model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: buildSystemPrompt(input.groups, input.withProduct),
      responseMimeType: 'application/json',
      responseJsonSchema: buildExtractJsonSchema(
        input.groups.map((g) => g.code),
        input.withProduct,
      ),
    },
  }

  let res
  try {
    res = await withRetry(() => ai.models.generateContent(req))
  } catch (err) {
    throw translateGeminiError(err, model)
  }

  const text = res.text
  if (!text) {
    // Ngắt vì bộ lọc an toàn hay vì chạm trần token đều ra text rỗng — nói rõ
    // lý do nếu API có trả về, đừng để người dùng nhìn một lỗi câm.
    const reason = res.candidates?.[0]?.finishReason
    throw BadRequest(
      reason
        ? `Mô hình không trả về nội dung (${reason})`
        : 'Mô hình không trả về nội dung',
    )
  }

  return { raw: JSON.parse(text), provider: 'gemini', model }
}
