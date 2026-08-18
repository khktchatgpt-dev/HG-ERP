import Anthropic from '@anthropic-ai/sdk'
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
 * Bản cài đặt `BomExtractor` dùng Claude. Chỉ làm đúng việc gọi HTTP — prompt,
 * JSON Schema và kiểm đầu ra nằm ở tầng chung (`bom-ai.provider.ts`,
 * `bom-ai.schema.ts`) để hai nhà cung cấp không lệch nhau.
 *
 * SERVER-ONLY: giữ API key, không bao giờ import từ Client Component.
 */

/**
 * Rộng tay vì trên Claude Opus 5 tư duy BẬT MẶC ĐỊNH và `max_tokens` bao cả
 * phần tư duy lẫn phần trả lời — để chật là cụt giữa chừng. Một file BOM 200
 * dòng ra khoảng 25k token JSON.
 */
const MAX_TOKENS = 32_000

/**
 * Lỗi SDK → câu người dùng đọc được. Song song với `translateGeminiError`: quá
 * tải thì bảo thử lại, cấu hình sai thì bảo đi sửa — hai việc khác nhau.
 */
function translateAnthropicError(err: unknown, model: string): Error {
  if (err instanceof Anthropic.RateLimitError) {
    return TooManyRequests('Đã chạm giới hạn gọi Anthropic. Thử lại sau ít phút.')
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return BadRequest('ANTHROPIC_API_KEY không hợp lệ — kiểm lại key trong .env.local')
  }
  if (err instanceof Anthropic.NotFoundError) {
    return BadRequest(
      `Không có model "${model}" — sửa BOM_AI_MODEL trong .env.local cho đúng tên.`,
    )
  }
  // Gồm cả 529 overloaded_error — SDK TypeScript gộp mọi mã ≥500 vào lớp này.
  if (err instanceof Anthropic.InternalServerError) {
    return TooManyRequests('Anthropic đang quá tải. Thử lại sau ít phút.')
  }
  return err instanceof Error ? err : new Error(String(err))
}

export async function extractWithAnthropic(
  input: BomExtractInput,
): Promise<BomExtractOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw BadRequest('Thiếu ANTHROPIC_API_KEY trong .env.local')

  const client = new Anthropic({ apiKey })
  const model = modelFor('anthropic')

  const content: Anthropic.ContentBlockParam[] = []
  if (input.document) {
    const { mimeType, dataBase64 } = input.document
    content.push(
      mimeType === 'application/pdf'
        ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: dataBase64 },
          }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
              data: dataBase64,
            },
          },
    )
  }
  content.push({ type: 'text', text: buildUserPrompt(input) })

  // Streaming vì `max_tokens` lớn: gọi thẳng sẽ chạm timeout HTTP của SDK.
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(input.groups, input.withProduct),
        // Phần hướng dẫn + danh mục nhóm là cố định giữa các lần đọc file, chỉ
        // lưới ô đổi — đặt breakpoint ở đây để lần thứ hai trở đi đọc từ cache.
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      effort: 'high',
      format: {
        type: 'json_schema',
        schema: buildExtractJsonSchema(
          input.groups.map((g) => g.code),
          input.withProduct,
        ),
      },
    },
    messages: [{ role: 'user', content }],
  })

  let message
  try {
    message = await stream.finalMessage()
  } catch (err) {
    throw translateAnthropicError(err, model)
  }

  if (message.stop_reason === 'refusal') {
    throw BadRequest('Mô hình từ chối đọc file này')
  }
  if (message.stop_reason === 'max_tokens') {
    throw BadRequest(
      'File quá dài, đọc chưa hết đã chạm trần token — tách bớt sheet rồi thử lại',
    )
  }

  const text = message.content.find((b) => b.type === 'text')?.text
  if (!text) throw BadRequest('Mô hình không trả về nội dung')

  return { raw: JSON.parse(text), provider: 'anthropic', model }
}
