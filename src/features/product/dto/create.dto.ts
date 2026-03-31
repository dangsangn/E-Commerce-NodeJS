import { z } from 'zod'

export const createProductSchema = z.object({
  product_name: z.string(),
  product_thumb: z.string(),
  product_price: z.number(),
  product_quantity: z.number(),
  product_type: z.string(),
  product_shop: z.string(),
  product_attributes: z.any(),
})
