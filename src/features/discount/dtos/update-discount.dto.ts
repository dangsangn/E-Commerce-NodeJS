import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'
import { CreateDiscountDTO } from './create-discount.dto'

export class UpdateDiscountDTO {
  @IsOptional()
  @IsString()
  discount_name?: string

  @IsOptional()
  @IsString()
  discount_description?: string

  @IsOptional()
  @IsIn(['fixed_amount', 'percentage'])
  discount_type?: 'fixed_amount' | 'percentage'

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_value?: number

  @IsOptional()
  @IsDateString()
  discount_start_date?: Date

  @IsOptional()
  @IsDateString()
  discount_end_date?: Date

  @IsOptional()
  @IsNumber()
  @Min(1)
  discount_max_uses?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  discount_max_uses_per_user?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_min_order_value?: number

  @IsOptional()
  @IsBoolean()
  discount_is_active?: boolean

  @IsOptional()
  @IsIn(['all', 'specific_products'])
  discount_applies_to?: 'all' | 'specific_products'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  discount_product_ids?: string[]
}
