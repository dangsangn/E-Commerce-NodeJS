import { OkResponse } from '../../../core/success.response'
import { CheckoutService } from '../service'
import { Request, Response } from 'express'

class CheckoutController {
  checkoutReview = async (req: Request, res: Response) => {
    const data = await CheckoutService.checkoutReview({
      ...req.body,
      userId: req.user?.userId,
    })
    return OkResponse.send(res, { data })
  }
}

export default new CheckoutController()
