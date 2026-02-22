import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  Min,
  IsOptional,
} from 'class-validator'

export class ApplyDiscountDTO {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsNumber()
  @Min(0)
  orderValue!: number

  @IsArray()
  @IsString({ each: true })
  productIds!: string[]

  @IsOptional()
  @IsString()
  userId?: string
}
