import { createPaginationResponse, parsePagination } from '../../../utils'
import { ProductModel } from '../model'

export class ProductRepository {
  static searchProductByUser = async ({
    query,
    page = 1,
    limit = 50,
  }: {
    query: any
    page: number
    limit: number
  }) => {
    const {
      skip,
      limit: limitNum,
      page: pageNum,
    } = parsePagination({ page, limit })
    const { keySearch, ...others } = query
    const hasTextSearch = keySearch && keySearch.trim()
    const queryBuilt = {
      ...(hasTextSearch && { $text: { $search: hasTextSearch } }),
      isPublished: true,
      ...others,
    } satisfies any
    const [result, total] = await Promise.all([
      ProductModel.find(
        queryBuilt,
        hasTextSearch ? { score: { $meta: 'textScore' } } : {}
      )
        .sort(
          hasTextSearch ? { score: { $meta: 'textScore' } } : { updatedAt: -1 }
        )
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
      ProductModel.find({ ...query, isDraft: true })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      ProductModel.countDocuments({ ...query, isDraft: true }),
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
      ProductModel.find({ ...query, isPublished: true })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      ProductModel.countDocuments({ ...query, isPublished: true }),
    ])
    return createPaginationResponse(result, total, pageNum, limitNum)
  }

  static setPublishedProductByShop = async ({
    product_shop,
    product_id,
  }: {
    product_shop: string
    product_id: string
  }) => {
    return ProductModel.updateOne(
      { product_shop, _id: product_id },
      { isPublished: true, isDraft: false }
    )
  }

  static setDraftProductByShop = async ({
    product_shop,
    product_id,
  }: {
    product_shop: string
    product_id: string
  }) => {
    return ProductModel.updateOne(
      { product_shop, _id: product_id },
      { isDraft: true, isPublished: false }
    )
  }
}
