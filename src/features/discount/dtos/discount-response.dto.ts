import mongoose from 'mongoose'

export interface DiscountResponseDTO {
  _id: mongoose.Types.ObjectId
  discount_name: string
  discount_description: string
  discount_code: string
  discount_type: 'fixed_amount' | 'percentage'
  discount_value: number
  discount_start_date: Date
  discount_end_date: Date
  discount_max_uses?: number
  discount_max_uses_per_user?: number
  discount_min_order_value?: number
  discount_is_active?: boolean
  discount_applies_to: 'all' | 'specific_products'
  discount_shop_id?: string
  discount_product_ids?: string[]

  // computed fields
  is_expired?: boolean
  remaining_uses?: number

  createdAt?: Date
  updatedAt?: Date
}
