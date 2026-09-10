import logger from '@/loggers'
import { Request, Response } from 'express'
import { BadRequestError } from '../../../core/error.response'
import { OkResponse } from '../../../core/success.response'
import { UploadService } from '../../upload/services'
import { createProductSchema } from '../dto/create.dto'
import {
  updateProductSchema,
  updateSkuSchema,
  updateVariationsSchema,
} from '../dto/update.dto'
import { ProductServiceFactory } from '../service'

class ProductController {
  createProduct = async (req: Request, res: Response) => {
    // validate req.body
    const parsed = createProductSchema.safeParse(req.body)
    if (!parsed.success) {
      const error = parsed.error.issues.map((i) => i.message).join(', ')
      logger.error('Validation error:', { error: parsed.error })
      throw new BadRequestError(error)
    }
    // parsed.data, not req.body: the schema folds a legacy flat payload
    // (product_price + product_quantity) into a one-entry sku_list.
    const data = await ProductServiceFactory.createProduct({
      ...parsed.data,
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

  // Returns { spu, skus } — the variant axes plus every matrix cell with its stock.
  getDetailProduct = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.getDetailProduct({
      product_id: req.params.id as string,
    })
    return OkResponse.send(res, { data })
  }

  // One cell, for when the buyer switches variant and only price + stock change.
  getSkuDetail = async (req: Request, res: Response) => {
    const data = await ProductServiceFactory.getSkuDetail({
      product_id: req.params.id as string,
      sku_id: req.params.skuId as string,
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
      payload: parsed.data,
    })
    return OkResponse.send(res, { data })
  }

  // Renames and per-option photos. The shape of the matrix is frozen here — see
  // the service for why.
  updateVariations = async (req: Request, res: Response) => {
    const parsed = updateVariationsSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues.map((i) => i.message).join(', '),
      )
    }
    const data = await ProductServiceFactory.updateVariations({
      product_id: req.params.id as string,
      product_shop: req.user?.userId,
      variations: parsed.data.product_variations,
    })
    return OkResponse.send(res, { data })
  }

  updateSkus = async (req: Request, res: Response) => {
    const parsed = updateSkuSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues.map((i) => i.message).join(', '),
      )
    }
    const data = await ProductServiceFactory.updateSkus({
      product_id: req.params.id as string,
      product_shop: req.user?.userId,
      skus: parsed.data.skus,
    })
    return OkResponse.send(res, { data })
  }

  uploadProductImageByLink = async (req: Request, res: Response) => {
    const { url } = req.body
    const userId = req.user?.userId
    const data = await UploadService.uploadFromUrl(url, {
      folder: `products/${userId}`,
    })
    return OkResponse.send(res, { data })
  }
  prepareProductImages = async (req: Request, res: Response) => {
    const userId = req.user?.userId
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      throw new BadRequestError('No files uploaded')
    }

    const data = await ProductServiceFactory.prepareImages({
      shopId: userId,
      files,
      // multer puts non-file multipart fields on req.body
      draftId: req.body?.draftId,
    })
    return OkResponse.send(res, { data })
  }
  updateProductImages = async (req: Request, res: Response) => {
    const userId = req.user?.userId
    const files = req.files as Express.Multer.File[]
    const productId = req.params?.productId as string
    if (!files || files.length === 0) {
      throw new BadRequestError('No files uploaded')
    }

    const data = await ProductServiceFactory.attackProductImages({
      shopId: userId,
      files,
      productId,
    })
    return OkResponse.send(res, { data })
  }
}

export default new ProductController()
