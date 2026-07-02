import { z } from 'zod'

export const settingsUpdateSchema = z
  .object({
    company_name: z.string().trim().min(1).max(200),
    company_tax_code: z.string().trim().max(50).or(z.literal('')),
    company_address: z.string().trim().max(500).or(z.literal('')),
    company_phone: z.string().trim().max(30).or(z.literal('')),
  })
  .partial()
