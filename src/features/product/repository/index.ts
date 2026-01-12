import { ProductModel } from '../model'

export class ProductRepository {
  static searchProductByUser = async ({
    keySearch,
    page,
    limit,
  }: {
    keySearch: string
    page: number
    limit: number
  }) => {
    const result = await ProductModel.find(
      {
        $text: {
          $search: keySearch,
        },
        isPublished: true,
      },
      {
        score: { $meta: 'textScore' },
      }
    )
      .sort({
        updatedAt: -1,
      })
      .skip(page * limit)
      .limit(limit)
      .lean()
      .exec()
    return result
  }
}
