export interface BaseProductPayload {
  product_name: string
  product_thumb: string
  product_price: number
  product_quantity: number
  product_type: string
  product_shop: string
  product_attributes: any
}

export type FindAndUpdateProductPayload = Partial<BaseProductPayload>