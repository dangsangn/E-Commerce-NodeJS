import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator'

export class QueryDiscountDTO {
  @IsOptional()
  @IsString()
  discount_code?: string

  @IsOptional()
  @IsString()
  discount_shop_id?: string

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  discount_is_active?: boolean

  @IsOptional()
  @IsIn(['fixed_amount', 'percentage'])
  discount_type?: 'fixed_amount' | 'percentage'

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  page?: number = 1

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  limit?: number = 50

  @IsOptional()
  @IsString()
  sort?: string = '-createdAt'
}
