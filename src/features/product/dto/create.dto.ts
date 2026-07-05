import { z } from 'zod'

export const createProductSchema = z.object({
  _id: z.string(),
  product_name: z.string(),
  product_thumb: z.string(),
  product_thumb_public_id: z.string(),
  product_images: z
    .array(
      z.object({
        url: z.string(),
        public_id: z.string(),
      }),
    )
    .default([]),
  product_price: z.number(),
  product_quantity: z.number(),
  product_type: z.string(),
  product_attributes: z.any(),
})
