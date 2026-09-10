import mongoose from 'mongoose'
import { createPaginationResponse, parsePagination } from '../../../utils'
import { FindAndUpdateProductPayload } from '../dto'
import { ProductModel } from '../model'
import { DerivedPricing } from '../types'

export class ProductRepository {
  static searchProducts = async ({
    filters,
    page = 1,
    limit = 50,
  }: {
    filters: any
    page: number
    limit: number
  }) => {
    const {
      skip,
      limit: limitNum,
      page: pageNum,
    } = parsePagination({ page, limit })
    const { keySearch, price_min, price_max, ...userFilters } = filters

    /*
      Price filter after the SPU/SKU split: a product matches when its SKU price
      range OVERLAPS the requested window, not when a single price falls inside
      it. A jacket sold at 199k–459k must show up in a "200k–300k" search.
      product_price_min/max are written in the same transaction as the SKUs, and
      backfilled for legacy rows by migration 004.
    */
    const priceFilter =
      price_min != null || price_max != null
        ? {
            ...(price_max != null && { product_price_min: { $lte: price_max } }),
            ...(price_min != null && { product_price_max: { $gte: price_min } }),
          }
        : {}

    const queryBuilt = {
      ...userFilters,
      ...(keySearch && { $text: { $search: keySearch } }),
      ...priceFilter,
      isPublished: true,
      isDeleted: false,
    } satisfies any

    const [result, total] = await Promise.all([
      ProductModel.find(
        queryBuilt,
        keySearch ? { score: { $meta: 'textScore' } } : {},
      )
        .sort(keySearch ? { score: { $meta: 'textScore' } } : { updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      ProductModel.countDocuments(queryBuilt),
    ])
    return createPaginationResponse(result, total, pageNum, limitNum)
  }

  static getDraftProductByShop = async ({
    query,
    limit = 50,
    page = 1,
  }: {
    query: any
    limit?: number
    page?: number
  }) => {
    const {
      skip,
      limit: limitNum,
      page: pageNum,
    } = parsePagination({ page, limit })
    const [result, total] = await Promise.all([
      ProductModel.find({ ...query, isDraft: true, isDeleted: false })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      ProductModel.countDocuments({
        ...query,
        isDraft: true,
        isDeleted: false,
      }),
    ])
    return createPaginationResponse(result, total, pageNum, limitNum)
  }

  static getPublishedProductByShop = async ({
    query,
    limit = 50,
    page = 1,
  }: {
    query: any
    limit?: number
    page?: number
  }) => {
    const {
      skip,
      limit: limitNum,
      page: pageNum,
    } = parsePagination({ page, limit })
    const [result, total] = await Promise.all([
      ProductModel.find({ ...query, isPublished: true, isDeleted: false })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      ProductModel.countDocuments({
        ...query,
        isPublished: true,
        isDeleted: false,
      }),
    ])
    return createPaginationResponse(result, total, pageNum, limitNum)
  }

  static setPublishedProductByShop = async ({
    product_shop,
    product_id,
    session,
  }: {
    product_shop: string
    product_id: string
    session?: mongoose.ClientSession
  }) => {
    return ProductModel.updateOne(
      { product_shop, _id: product_id },
      { isPublished: true, isDraft: false },
      session ? { session } : {},
    )
  }

  static setDraftProductByShop = async ({
    product_shop,
    product_id,
    session,
  }: {
    product_shop: string
    product_id: string
    session?: mongoose.ClientSession
  }) => {
    return ProductModel.updateOne(
      { product_shop, _id: product_id },
      { isDraft: true, isPublished: false },
      session ? { session } : {},
    )
  }

  static getDetailProduct = async ({ product_id }: { product_id: string }) => {
    return ProductModel.findById(product_id)
      .select({
        __v: 0,
      })
      .lean()
      .exec()
  }

  /*
    updateDerivedPricing — write the numbers that "climb up" from the SKUs.

    Called inside the create/update transaction, never from a post('save') hook:
    a hook runs outside the transaction, so a rollback would leave the SPU
    advertising a price range no SKU backs.
  */
  static updateDerivedPricing = async ({
    product_id,
    pricing,
    session,
  }: {
    product_id: string | mongoose.Types.ObjectId
    pricing: DerivedPricing
    session?: mongoose.ClientSession
  }) => {
    return ProductModel.updateOne(
      { _id: product_id },
      { $set: pricing },
      session ? { session } : {},
    )
  }

  // Whole-array replace: product_variations is positional, so a partial update
  // would need $set paths per index and could leave the axes half-renamed.
  static replaceVariations = async ({
    product_id,
    variations,
  }: {
    product_id: string
    variations: unknown[]
  }) => {
    return ProductModel.findByIdAndUpdate(
      product_id,
      { $set: { product_variations: variations } },
      { returnDocument: 'after' },
    )
      .lean()
      .exec()
  }

  static findAndUpdate = async ({
    product_id,
    payload,
    model,
  }: {
    product_id: mongoose.Types.ObjectId
    payload: FindAndUpdateProductPayload
    model: mongoose.Model<any>
  }) => {
    return model
      .findByIdAndUpdate(product_id, payload, { new: true })
      .lean()
      .exec()
  }

  static getProductPublishedById = async (
    product_id: string,
    select?: string[],
  ) => {
    return ProductModel.findOne({ _id: product_id, isPublished: true })
      .select(select || { __v: 0 })
      .lean()
      .exec()
  }

  static getProductByIdOwner = async ({
    productId,
    userId,
  }: {
    productId: string
    userId: string
  }) => {
    return ProductModel.findOne({
      _id: productId,
      product_shop: userId,
    }).select({ __v: 0 })
  }
}
