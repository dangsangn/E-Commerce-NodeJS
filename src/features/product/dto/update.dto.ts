import z from 'zod'

// product_price / product_quantity are no longer accepted here: after the SPU/SKU
// split they are derived from the SKU rows. Price edits go through updateSkuSchema.
export const updateProductSchema = z
  .object({
    product_name: z.string().optional(),
    product_thumb: z.string().optional(),
    product_description: z.string().optional(),
    product_attributes: z.record(z.string(), z.any()).optional(),
  })
  .strict()

export const updateSkuSchema = z
  .object({
    skus: z
      .array(
        z.object({
          sku_id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid sku id'),
          sku_price: z.number().positive().optional(),
          sku_stock: z.number().int().nonnegative().optional(),
          sku_default: z.boolean().optional(),
        }),
      )
      .min(1, 'Nothing to update'),
  })
  .strict()
  .superRefine(({ skus }, ctx) => {
    if (skus.filter((s) => s.sku_default).length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['skus'],
        message: 'Only one SKU can be the default',
      })
    }
  })

export type UpdateSkuInput = z.infer<typeof updateSkuSchema>

const imageDto = z.object({
  url: z.string().min(1),
  public_id: z.string().min(1),
})

/*
  updateVariationsSchema — rename axes and options, and change their photos.

  What it deliberately cannot do is add, remove or reorder options. Every SKU
  stores COORDINATES ([0, 1]), not labels, so shifting an option renumbers the
  ones after it and silently re-points existing SKUs at the wrong variant. The
  service enforces that the shape is unchanged; renaming is safe precisely
  because coordinates do not care what an option is called.
*/
export const updateVariationsSchema = z
  .object({
    product_variations: z.array(
      z.object({
        name: z.string().trim().min(1, 'Name each variation'),
        options: z
          .array(z.string().trim().min(1, 'Variation option cannot be empty'))
          .min(1),
        images: z.array(imageDto).default([]),
      }),
    ),
  })
  .strict()

export type UpdateVariationsInput = z.infer<typeof updateVariationsSchema>
