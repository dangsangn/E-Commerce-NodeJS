import { Request, Response } from 'express'
import { OkResponse } from '../../../core/success.response'
import { ProductServiceFactory } from '../service'

class ProductController {
  createProduct = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.createProduct({
      ...req.body,
      product_shop: req.user?.userId,
    })
    return OkResponse.send(res, { data })
  }
}

export default new ProductController()
