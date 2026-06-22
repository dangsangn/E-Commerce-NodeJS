import z from 'zod'

export const updateProductSchema = z
  .object({
    product_name: z.string().optional(),
    product_thumb: z.string().optional(),
    product_description: z.string().optional(),
    product_price: z.number().positive().optional(),
    product_attributes: z.record(z.string(), z.any()).optional(),
  })
  .strict()
