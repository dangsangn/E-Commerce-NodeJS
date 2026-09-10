import mongoose from 'mongoose'
import { skuModel } from '../model/sku.model'

export type SkuDocPayload = {
  sku_code: string
  sku_product_id: mongoose.Types.ObjectId
  sku_shop_id: mongoose.Types.ObjectId
  sku_tier_idx: number[]
  sku_tier_key: string
  sku_price: number
  sku_thumb?: { url: string; public_id: string } | null
  sku_default: boolean
  isPublished?: boolean
}

export class SkuRepository {
  static insertMany = async ({
    skus,
    session,
  }: {
    skus: SkuDocPayload[]
    session?: mongoose.ClientSession
  }) => {
    return skuModel.insertMany(skus, session ? { session } : {})
  }

  // Live SKUs of one SPU, ordered so the matrix reads row by row.
  static listByProduct = async ({
    productId,
    onlyPublished = false,
  }: {
    productId: string
    onlyPublished?: boolean
  }) => {
    return skuModel
      .find({
        sku_product_id: new mongoose.Types.ObjectId(productId),
        isDeleted: false,
        ...(onlyPublished ? { isPublished: true } : {}),
      })
      .select({ __v: 0 })
      .lean()
      .exec()
      // Sorted in JS, not by Mongo: sorting on the array field is done
      // element-wise, and sorting on sku_tier_key is lexicographic, which puts
      // "10-0" before "2-0" once an axis has ten options. The list is bounded by
      // the size of one product's matrix, so this costs nothing.
      .then((rows) => rows.sort((a, b) => compareTier(a.sku_tier_idx, b.sku_tier_idx)))
  }

  static getById = async (skuId: string) => {
    return skuModel
      .findOne({ _id: skuId, isDeleted: false })
      .select({ __v: 0 })
      .lean()
      .exec()
  }

  /*
    getForCheckout — the only SKU read checkout is allowed to trust.

    It takes the SPU id too on purpose: validating a SKU by id alone lets an
    attacker post { productId: <2M-dong jacket>, skuId: <5k pencil> } and be
    charged 5k. An id is a reference, not proof of ownership.
  */
  static getForCheckout = async ({
    skuId,
    productId,
  }: {
    skuId: string
    productId: string
  }) => {
    return skuModel
      .findOne({
        _id: skuId,
        sku_product_id: new mongoose.Types.ObjectId(productId),
        isDeleted: false,
        isPublished: true,
      })
      .lean()
      .exec()
  }

  static setPublishedByProduct = async ({
    productId,
    isPublished,
    session,
  }: {
    productId: string
    isPublished: boolean
    session?: mongoose.ClientSession
  }) => {
    return skuModel.updateMany(
      { sku_product_id: new mongoose.Types.ObjectId(productId) },
      { isPublished },
      session ? { session } : {},
    )
  }

  static updateOne = async ({
    skuId,
    productId,
    payload,
    session,
  }: {
    skuId: string
    productId: string
    payload: Record<string, unknown>
    session?: mongoose.ClientSession
  }) => {
    return skuModel
      .findOneAndUpdate(
        {
          _id: skuId,
          sku_product_id: new mongoose.Types.ObjectId(productId),
          isDeleted: false,
        },
        payload,
        { returnDocument: 'after', ...(session ? { session } : {}) },
      )
      .lean()
      .exec()
  }

  static clearDefault = async ({
    productId,
    session,
  }: {
    productId: string
    session?: mongoose.ClientSession
  }) => {
    return skuModel.updateMany(
      { sku_product_id: new mongoose.Types.ObjectId(productId) },
      { sku_default: false },
      session ? { session } : {},
    )
  }
}

// `${spuId}-0-1` — readable by the warehouse, distinct from the technical _id.
export const buildSkuCode = (productId: string, tierIdx: number[]): string =>
  tierIdx.length ? `${productId}-${tierIdx.join('-')}` : `${productId}-0`

/*
  The matrix coordinates flattened to one scalar, so the unique index on
  { sku_product_id, sku_tier_key } compares whole cells. Indexing the array
  itself would be a multikey index and would compare individual coordinates —
  see the comment on sku_tier_key in sku.model.ts.
*/
export const buildTierKey = (tierIdx: number[]): string => tierIdx.join('-')

const compareTier = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? -1) - (b[i] ?? -1)
    if (diff !== 0) return diff
  }
  return 0
}
