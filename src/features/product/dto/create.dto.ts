import { z } from 'zod'

export const MAX_VARIATION_AXES = 3

const imageDto = z.object({
  url: z.string(),
  public_id: z.string(),
})

const variationDto = z.object({
  name: z.string().trim().min(1, 'Variation name is required'),
  options: z
    .array(z.string().trim().min(1, 'Variation option cannot be empty'))
    .min(1, 'A variation needs at least one option'),
  images: z.array(imageDto).default([]),
})

const skuDto = z.object({
  // Coordinates into product_variations. [] = the SPU has no variants.
  sku_tier_idx: z.array(z.number().int().nonnegative()).default([]),
  sku_price: z.number().positive('SKU price must be greater than 0'),
  sku_stock: z.number().int().nonnegative('SKU stock cannot be negative'),
  sku_thumb: imageDto.nullish(),
  sku_default: z.boolean().default(false),
})

const baseProductDto = z.object({
  _id: z.string(),
  product_name: z.string(),
  product_thumb: z.string(),
  product_thumb_public_id: z.string(),
  product_images: z.array(imageDto).default([]),
  product_description: z.string().optional(),
  product_type: z.string(),
  product_attributes: z.any(),
  product_variations: z
    .array(variationDto)
    .max(MAX_VARIATION_AXES, `Max is ${MAX_VARIATION_AXES}-axis variant`)
    .default([]),
  sku_list: z
    .array(skuDto)
    .min(1, 'A product needs at least one SKU')
    .optional(),

  // Legacy flat input, kept so older clients keep working. When `sku_list` is
  // absent these fold into a single implicit SKU below; they are never written
  // to the SPU straight from the client — see DerivedPricing.
  product_price: z.number().positive().optional(),
  product_quantity: z.number().int().nonnegative().optional(),
})

export const createProductSchema = baseProductDto
  .superRefine((input, ctx) => {
    const { product_variations: variations, sku_list: skus } = input

    if (!skus?.length) {
      if (input.product_price === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['sku_list'],
          message: 'Provide sku_list, or product_price and product_quantity',
        })
      }
      if (variations.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['sku_list'],
          message: 'A product with variations must send sku_list',
        })
      }
      return
    }

    // A sku_tier_idx pointing at a cell that does not exist creates a SKU nobody
    // can ever select. Check the coordinate count and each axis bound.
    const seen = new Set<string>()
    skus.forEach((sku, i) => {
      const tier = sku.sku_tier_idx ?? []
      if (tier.length !== variations.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['sku_list', i, 'sku_tier_idx'],
          message: `sku_tier_idx must have ${variations.length} coordinate(s)`,
        })
        return
      }
      tier.forEach((idx, axis) => {
        const axisDef = variations[axis]!
        if (idx >= axisDef.options.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['sku_list', i, 'sku_tier_idx', axis],
            message: `Option ${idx} is out of range for "${axisDef.name}"`,
          })
        }
      })

      // The DB has a unique index on { sku_product_id, sku_tier_idx }; catching it
      // here gives a readable message instead of an E11000.
      const key = tier.join('-')
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sku_list', i, 'sku_tier_idx'],
          message: 'Duplicate variant combination',
        })
      }
      seen.add(key)
    })

    if (skus.filter((s) => s.sku_default).length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['sku_list'],
        message: 'Only one SKU can be the default',
      })
    }
  })
  .transform(({ product_price, product_quantity, ...input }) => ({
    ...input,
    sku_list: input.sku_list?.length
      ? input.sku_list
      : // Legacy shape → one SKU sitting outside the matrix.
        [
          {
            sku_tier_idx: [] as number[],
            sku_price: product_price ?? 0,
            sku_stock: product_quantity ?? 0,
            sku_thumb: null,
            sku_default: true,
          },
        ],
  }))

export type CreateProductInput = z.infer<typeof createProductSchema>
