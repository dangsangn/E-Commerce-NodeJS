export type ProductProps = {
  _id: string
  product_name: string
  product_thumb: string
  product_thumb_public_id: string
  product_description?: string
  product_price: number
  product_quantity: number
  product_type: string
  product_shop: string
  product_attributes: any
  product_images?: { url: string; public_id: string }[]
}
