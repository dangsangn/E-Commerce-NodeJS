import { Request, Response } from 'express'
import { OkResponse } from '../../../core/success.response'
import { ProductServiceFactory } from '../service'
import { validate } from 'class-validator'
import { createProductSchema } from '../dto/create.dto'
import { BadRequestError } from '../../../core/error.response'
import { UploadService } from '../../upload/services'
import { updateProductSchema } from '../dto/update.dto'

class ProductController {
  createProduct = async (req: Request, res: Response) => {
    // validate req.body
    const parsed = createProductSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues.map((i) => i.message).join(', '),
      )
    }
    const data = await ProductServiceFactory.createProduct({
      ...req.body,
      product_shop: req.user?.userId,
    })
    return OkResponse.send(res, { data })
  }

  searchProducts = async (req: Request, res: Response) => {
    const { page, limit, ...filters } = req.query
    const data = await ProductServiceFactory.searchProducts({
      query: filters,
      page: Number(page) || 1,
      limit: Number(limit) || undefined,
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
    const parsed = updateProductSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues.map((i) => i.message).join(', '),
      )
    }
    const data = await ProductServiceFactory.updateProduct({
      product_id: req.params.id as string,
      product_shop: req.user?.userId,
      payload: req.body,
    })
    return OkResponse.send(res, { data })
  }
  uploadProductImageByLink = async (req: Request, res: Response) => {
    const { url } = req.body
    const { shopId } = req.params
    const data = await UploadService.uploadFromUrl(url, {
      folder: `products/${shopId}`,
    })
    return OkResponse.send(res, { data })
  }
}

export default new ProductController()
