import { z } from 'zod'
import { productType } from '../model'

export const searchProductSchema = z
  .object({
    keySearch: z.string().trim().min(1).max(100).optional(),
    product_type: z.enum(Object.values(productType)).optional(),
    product_shop: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(), // force valid ObjectId
    price_min: z.coerce.number().nonnegative().optional(),
    price_max: z.coerce.number().nonnegative().optional(),
  })
  .strict() // ⬅ unexpected param = error, not silently ignored
