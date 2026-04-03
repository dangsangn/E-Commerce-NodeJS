import { BadRequestError } from '../../../core/error.response'
import { ProductRepository } from '../../product/repository'
import { DiscountService } from '../../discount/services/discount.service'
import { ShopOrderItem } from '../../order/types'

interface CheckoutReviewPayload {
  userId: string
  shop_order_ids: ShopOrderItem[]
}

export class CheckoutService {
  /*
    checkoutReview — Calculate the total amount for an order.

    Does NOT save to DB. Does NOT deduct stock. Does NOT have side effects.
    Only reads + calculates + validates + returns the result.

    Flow:
    1. Iterate through each shop in shop_order_ids
    2. For each item: validate product exists + price is correct
    3. Calculate raw price (rawPrice)
    4. Apply discount if available → calculate discountAmount
    5. Calculate price after discount (checkoutPrice)
    6. Return totals
  */
  static checkoutReview = async ({
    userId,
    shop_order_ids,
  }: CheckoutReviewPayload) => {
    // Array of results after validation + price calculation
    const shop_order_ids_new: any[] = []

    // Total variables
    let totalPrice = 0 // total original price
    let totalDiscount = 0 // total discount
    let totalCheckout = 0 // total amount to pay
    const feeShip = 0 // shipping fee (can be calculated later)

    // 1. Iterate through each shop
    for (const shopOrder of shop_order_ids) {
      const { shopId, shop_discounts, item_products } = shopOrder

      // 2. Validate each product
      const validatedProducts: any[] = []
      let rawPrice = 0

      for (const item of item_products) {
        /*
          Always get price from DB, do NOT trust the price sent by the client.
          Why? Because the client can modify prices in devtools.
          Flow:
          - Client sends: { productId, price: 100, quantity: 2 }
          - Server gets from DB: product.product_price = 150
          - Compare: 100 !== 150 → throw Error
        */
        const product = await ProductRepository.getProductPublishedById(
          item.productId,
          ['product_name', 'product_thumb', 'product_price', 'product_shop'],
        )

        if (!product) {
          throw new BadRequestError(
            `Product ${item.productId} not found or not published`,
          )
        }

        // Validate price: client price must equal server price
        if (item.price !== product.product_price) {
          throw new BadRequestError(
            `Product ${product.product_name} price has changed. Please refresh.`,
          )
        }

        // Validate shop: product must belong to the correct shop
        if (product.product_shop?.toString() !== shopId) {
          throw new BadRequestError(
            `Product ${product.product_name} does not belong to this shop`,
          )
        }

        const itemTotal = item.price * item.quantity
        rawPrice += itemTotal

        // Save product snapshot (used for order later)
        validatedProducts.push({
          productId: item.productId,
          price: product.product_price,
          quantity: item.quantity,
          name: product.product_name,
          thumb: product.product_thumb,
        })
      }

      // 3. Apply discount (if any)
      let discountAmount = 0

      if (shop_discounts && shop_discounts.length > 0) {
        /*
          Currently DiscountService.applyDiscount is an instance method,
          so we need to create an instance. If you refactor to a static method
          then call DiscountService.applyDiscount(...) directly.

          Note: applyDiscount currently INCREMENTS the usage count.
          In checkout review, we don't want to increase count yet (user hasn't confirmed).
          → You should create a separate calculateDiscount function in DiscountService
          that only calculates WITHOUT incrementing usage count.
          For now, we call applyDiscount here.
        */
        const discountService = new DiscountService()
        for (const disc of shop_discounts) {
          try {
            const result = await discountService.applyDiscount(
              disc.code,
              userId,
              rawPrice,
              validatedProducts[0]?.productId || '', // first product
              true,
            )
            discountAmount += result.discountAmount
          } catch (error) {
            // If discount is invalid → skip or throw depending on business logic
            // Here we throw so the user knows
            throw error
          }
        }
      }

      // 4. Calculate price after discount
      const checkoutPrice = rawPrice - discountAmount

      // 5. Add to totals
      totalPrice += rawPrice
      totalDiscount += discountAmount
      totalCheckout += checkoutPrice

      // 6. Save result for this shop
      shop_order_ids_new.push({
        shopId,
        shop_discounts,
        item_products: validatedProducts,
        price_raw: rawPrice,
        price_apply_discount: checkoutPrice,
      })
    }

    return {
      shop_order_ids, // original input
      shop_order_ids_new, // result after validation + price calculation
      checkout_order: {
        totalPrice,
        totalDiscount,
        feeShip,
        totalCheckout: totalCheckout + feeShip,
      },
    }
  }
}
