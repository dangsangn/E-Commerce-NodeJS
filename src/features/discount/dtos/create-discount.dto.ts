import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  IsArray,
} from 'class-validator'

export class CreateDiscountDTO {
  @IsString()
  @IsNotEmpty({ message: 'Discount name is required' })
  discount_name!: string

  @IsString()
  @IsNotEmpty()
  discount_description!: string

  @IsString()
  @IsNotEmpty()
  discount_code!: string

  @IsString()
  @IsIn(['fixed_amount', 'percentage'], {
    message: 'Type must be fixed_amount or percentage',
  })
  discount_type!: 'fixed_amount' | 'percentage'

  @IsNumber()
  @Min(0)
  discount_value!: number

  @IsDateString()
  discount_start_date!: Date

  @IsDateString()
  discount_end_date!: Date

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

  @IsString()
  @IsNotEmpty()
  discount_shop_id!: string

  @IsOptional()
  @IsBoolean()
  discount_is_active?: boolean

  @IsString()
  @IsIn(['all', 'specific_products'])
  discount_applies_to?: 'all' | 'specific_products'

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  discount_product_ids?: string[]
}
