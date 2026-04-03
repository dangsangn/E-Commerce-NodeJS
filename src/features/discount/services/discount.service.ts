import { BadRequestError } from '../../../core/error.response'
import {
  DiscountResponseDTO,
  QueryDiscountDTO,
  UpdateDiscountDTO,
} from '../dtos'
import { CreateDiscountDTO } from '../dtos/create-discount.dto'
import DiscountRepository from '../repository/discount.repository'
/*
  - Generator Discount Code [Shop | Admin]
  - Get all discount codes [user | shop]
  - Get all products with discount [user]
  - Get discount amount [User]
  - Delete discount code [Shop | Admin]
  - Cancel discount code [User]
*/
export class DiscountService {
  createDiscount = async (
    payload: CreateDiscountDTO,
  ): Promise<DiscountResponseDTO> => {
    // 1. Check if discount code already exists
    const existingDiscount = await DiscountRepository.findByCode(
      payload.discount_code,
    )
    if (existingDiscount) {
      throw new BadRequestError('Discount code is exists.')
    }

    // 2. Validate dates
    this.validateDiscountDates(
      new Date(payload.discount_start_date),
      new Date(payload.discount_end_date),
    )

    // 3. Validate discount amount
    this.validateDiscountValue(payload.discount_value, payload.discount_type)

    // 4. Validate product ids if applies_to === 'specific'
    if (payload.discount_applies_to === 'specific_products') {
      if (
        !payload.discount_product_ids ||
        payload.discount_product_ids.length === 0
      ) {
        throw new BadRequestError('Product ids must be provided.')
      }
    }

    // 5. Create discount
    const discount = await DiscountRepository.create(payload)

    return this.transformDiscount(discount)
  }

  async getDiscountsByShop(
    shopId: string,
    isActive?: boolean,
  ): Promise<DiscountResponseDTO[]> {
    const discounts = await DiscountRepository.findByShopId(shopId, isActive)
    return discounts.map(this.transformDiscount)
  }

  async getDiscountByCode(code: string): Promise<DiscountResponseDTO> {
    const discount = await DiscountRepository.findByCode(code)
    if (!discount) {
      throw new BadRequestError('Discount not found.')
    }
    const startDate = new Date(discount.discount_start_date)
    const endDate = new Date(discount.discount_end_date)
    const now = new Date()
    if (startDate > now) {
      throw new BadRequestError('Discount has not started yet.')
    }
    if (endDate < now) {
      throw new BadRequestError('Discount has expired.')
    }
    if (!discount.discount_is_active) {
      throw new BadRequestError('Discount is not active.')
    }
    return this.transformDiscount(discount)
  }

  private validateDiscountValue(disCountValue: number, discountType: string) {
    if (discountType === 'percentage') {
      if (disCountValue < 0 || disCountValue > 100) {
        throw new BadRequestError('Discount value must be between 0 and 100.')
      }
    } else {
      if (disCountValue < 0) {
        throw new BadRequestError('Discount value must be greater than 0.')
      }
    }
  }

  private validateDiscountDates(startDate: Date, endDate: Date) {
    const now = new Date()
    if (startDate >= endDate) {
      throw new BadRequestError('Start date must be before end date.')
    }
    if (endDate <= now) {
      throw new BadRequestError('Discount has expired.')
    }
  }

  // update discount
  updateDiscount = async (
    discountId: string,
    shopId: string,
    updateDto: UpdateDiscountDTO,
  ) => {
    const existingDiscount = await DiscountRepository.findById(discountId)
    if (!existingDiscount) {
      throw new BadRequestError('Discount not found.')
    }
    if (existingDiscount.discount_shop_id?.toString() !== shopId) {
      throw new BadRequestError(
        'You are not authorized to update this discount.',
      )
    }

    if (updateDto.discount_value) {
      this.validateDiscountValue(
        updateDto.discount_value,
        existingDiscount.discount_type,
      )
    }

    if (updateDto.discount_start_date || updateDto.discount_end_date) {
      this.validateDiscountDates(
        new Date(
          updateDto.discount_start_date || existingDiscount.discount_start_date,
        ),
        new Date(
          updateDto.discount_end_date || existingDiscount.discount_end_date,
        ),
      )
    }

    const updatedDiscount = await DiscountRepository.update(
      discountId,
      updateDto,
    )
    return this.transformDiscount(updatedDiscount)
  }

  // soft delete discount
  deleteDiscount = async (discountId: string, shopId: string) => {
    const existingDiscount = await DiscountRepository.findById(discountId)
    if (!existingDiscount) {
      throw new BadRequestError('Discount not found.')
    }
    if (existingDiscount.discount_shop_id?.toString() !== shopId) {
      throw new BadRequestError(
        'You are not authorized to delete this discount.',
      )
    }
    await DiscountRepository.softDelete(discountId)
  }

  // apply discount for order
  async applyDiscount(
    code: string,
    userId: string,
    orderValue: number,
    productId: string,
    isView?: boolean,
  ): Promise<{
    discountAmount: number
    finalAmount: number
  }> {
    // 1. get discount by code
    const discount = await this.getDiscountByCode(code)

    // 2. check user used discount larger than max uses
    const userUsage = await DiscountRepository.countUserUsage(
      discount._id.toString(),
      userId,
    )
    if (userUsage >= (discount.discount_max_uses_per_user ?? 1)) {
      throw new BadRequestError(
        'You have used this discount code too many times.',
      )
    }

    // 3. check value of order
    if (orderValue < (discount.discount_min_order_value ?? 0)) {
      throw new BadRequestError(
        `Order value must be greater than ${discount.discount_min_order_value}.`,
      )
    }

    // 4. check apply for product
    if (discount.discount_applies_to === 'specific_products') {
      const hasValidProduct = (discount.discount_product_ids ?? []).includes(
        productId,
      )
      if (!hasValidProduct) {
        throw new BadRequestError(
          'This discount is not applicable to the selected product.',
        )
      }
    }

    // 5. calculate discount amount
    const { discountAmount, finalAmount } = this.calculateDiscountAmount(
      discount.discount_type,
      discount.discount_value,
      orderValue,
    )

    // 6. update discount uses count
    if (!isView) {
      await DiscountRepository.incrementUserCount(
        discount._id.toString(),
        userId,
      )
    }

    return {
      discountAmount,
      finalAmount,
    }
  }

  private calculateDiscountAmount(
    discountType: string,
    discountValue: number,
    orderValue: number,
  ): { discountAmount: number; finalAmount: number } {
    let discountAmount = 0
    if (discountType === 'fixed_amount') {
      discountAmount = discountValue
    }
    if (discountType === 'percentage') {
      discountAmount = (orderValue * discountValue) / 100
    }

    discountAmount = Math.min(discountAmount, orderValue)
    const finalAmount = orderValue - discountAmount
    return {
      discountAmount,
      finalAmount,
    }
  }

  /*
    Query with pagination
  */
  queryDiscounts = async (query: QueryDiscountDTO) => {
    const result = await DiscountRepository.findWithPagination(query)
    return {
      ...result,
      data: result.data.map((discount) => this.transformDiscount(discount)),
    }
  }

  private transformDiscount(discount: any): DiscountResponseDTO {
    const now = new Date()
    const endDate = new Date(discount.discount_end_date)

    return {
      _id: discount._id,
      discount_code: discount.discount_code,
      discount_name: discount.discount_name,
      discount_description: discount.discount_description,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      discount_applies_to: discount.discount_applies_to,
      discount_product_ids: discount.discount_product_ids,
      discount_shop_id: discount.discount_shop_id,
      discount_min_order_value: discount.discount_min_order_value,
      discount_start_date: discount.discount_start_date,
      discount_end_date: discount.discount_end_date,
      discount_is_active: discount.discount_is_active,

      // computed fields
      is_expired: endDate < now,
      remaining_uses: discount.discount_max_uses
        ? discount.discount_max_uses - discount.discount_uses_count
        : undefined,
    }
  }
}
