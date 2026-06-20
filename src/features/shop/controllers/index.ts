import { OkResponse } from '../../../core/success.response'
import ShopService from '../services'
import { Request, Response } from 'express'

class ShopController {
  getAllShops = async (req: Request, res: Response) => {
    const data = await ShopService.getShops({ query: {} })
    return OkResponse.send(res, { data })
  }

  getShopByEmail = async (req: Request, res: Response) => {
    const data = await ShopService.findByEmail({
      email: req.body.email as string,
    })
    return OkResponse.send(res, { data })
  }
}

export default new ShopController()
