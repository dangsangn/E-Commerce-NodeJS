import { Request, Response } from 'express'
import { DiscountService } from '../services/discount.service'
import { CreatedResponse, OkResponse } from '../../../core/success.response'

export class DiscountController {
  private discountService: DiscountService

  constructor() {
    this.discountService = new DiscountService()
  }

  createDiscount = async (req: Request, res: Response) => {
    const payload = req.body
    const shopId = req.user?.userId
    const data = await this.discountService.createDiscount({
      ...payload,
      discount_shop_id: shopId,
    })
    return CreatedResponse.send(res, { data })
  }

  getDiscountByCode = async (req: Request, res: Response) => {
    const { code } = req.params
    const data = await this.discountService.getDiscountByCode(code as string)
    return OkResponse.send(res, { data })
  }

  getDiscountsByShop = async (req: Request, res: Response) => {
    const { shopId } = req.params
    const data = await this.discountService.getDiscountsByShop(shopId as string)
    return OkResponse.send(res, { data })
  }
}
