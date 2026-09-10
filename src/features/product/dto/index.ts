export interface BaseProductPayload {
  product_name: string
  product_thumb: string
  product_type: string
  product_shop: string
  product_attributes: any
}

// Update payloads arrive flattened (`product_attributes.brand` → `'product_attributes.brand'`)
// and are also reused for the Clothes / Electronics side models, so the keys are open.
export type FindAndUpdateProductPayload = Partial<BaseProductPayload> &
  Record<string, unknown>
