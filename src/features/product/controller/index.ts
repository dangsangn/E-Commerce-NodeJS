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

  searchProducts = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.searchProducts({
      query: req.params,
      page: req.query.page as unknown as number,
      limit: req.query.limit as unknown as number,
    })
    return OkResponse.send(res, { data })
  }

  getDraftProductByShop = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.getDraftProductByShop({
      query: { ...req.params, product_shop: req.user?.userId },
      page: req.query.page as unknown as number,
      limit: req.query.limit as unknown as number,
    })
    return OkResponse.send(res, { data })
  }

  getPublishedProductByShop = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.getPublishedProductByShop({
      query: { ...req.params, product_shop: req.user?.userId },
      page: req.query.page as unknown as number,
      limit: req.query.limit as unknown as number,
    })
    return OkResponse.send(res, { data })
  }

  setPublishedProductByShop = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.setPublishedProductByShop({
      product_shop: req.user?.userId,
      product_id: req.params.id as string,
    })
    return OkResponse.send(res, { data })
  }

  setDraftProductByShop = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.setDraftProductByShop({
      product_shop: req.user?.userId,
      product_id: req.params.id as string,
    })
    return OkResponse.send(res, { data })
  }

  getDetailProduct = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.getDetailProduct({
      product_id: req.params.id as string,
    })
    return OkResponse.send(res, { data })
  }
  updateProduct = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.updateProduct({
      product_id: req.params.id as string,
      payload: req.body,
    })
    return OkResponse.send(res, { data })
  }
}

export default new ProductController()
