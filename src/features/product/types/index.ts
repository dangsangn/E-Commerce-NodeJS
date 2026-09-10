export type ImageProps = {
  url: string
  public_id: string
}

// One axis of the variant matrix, e.g. { name: 'Color', options: ['Red', 'Blue'] }.
// `images` is indexed by option position and only meaningful on the first axis.
export type VariationProps = {
  name: string
  options: string[]
  images?: ImageProps[]
}

// A single cell of the matrix as the client sends it. `sku_tier_idx` is a
// coordinate into product_variations, NOT a label — [] means "no variant".
export type SkuInputProps = {
  sku_tier_idx: number[]
  sku_price: number
  sku_stock: number
  sku_thumb?: ImageProps | null
  sku_default?: boolean
}

export type ProductProps = {
  _id: string
  product_name: string
  product_thumb: string
  product_thumb_public_id: string
  product_description?: string
  product_type: string
  product_shop: string
  product_attributes: any
  product_images?: ImageProps[]
  product_variations: VariationProps[]
  sku_list: SkuInputProps[]
}

// Pricing/stock fields on the SPU are DERIVED from its SKUs — never client input.
// product_price / product_quantity are kept so cart and checkout, which still read
// the SPU, keep working: they mirror the default SKU price and the total stock.
export type DerivedPricing = {
  product_price: number
  product_quantity: number
  product_price_min: number
  product_price_max: number
  product_sku_count: number
}
