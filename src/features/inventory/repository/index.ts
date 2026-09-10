import mongoose from 'mongoose'
import { InventoryModel } from '../models'

/*
  One inventory row per SKU — `inven_sku_id` is required and uniquely indexed.
  `inven_product_id` is kept alongside it so "total stock of this SPU" stays a
  single indexed aggregate instead of a join.
*/
export const insertInventoryMany = async ({
  rows,
  session,
}: {
  rows: {
    inven_product_id: mongoose.Types.ObjectId
    inven_sku_id: mongoose.Types.ObjectId
    inven_shop_id: mongoose.Types.ObjectId
    inven_stock: number
    inven_location?: string
  }[]
  session?: mongoose.ClientSession
}) => {
  return InventoryModel.insertMany(rows, session ? { session } : {})
}

/*
  reserveInventory — Reserve a product when creating an order.

  How it works:
  - Uses { $gte: quantity } to check if inventory is sufficient
  - If sufficient → deduct stock ($inc: -quantity) + add reservation
  - If NOT sufficient → findOneAndUpdate returns null

  This is an atomic operation — MongoDB guarantees no race conditions.
  No pessimistic lock needed, no distributed lock needed.

  `skuId` is optional so existing callers keep compiling, but pass it whenever
  you have it: a multi-variant SPU now owns several inventory rows, and matching
  on inven_product_id alone would deduct from an arbitrary variant.
*/
export const reserveInventory = async ({
  productId,
  skuId,
  quantity,
  cartId,
  session,
}: {
  productId: string
  skuId?: string
  quantity: number
  cartId: string
  session: mongoose.ClientSession
}) => {
  return InventoryModel.findOneAndUpdate(
    {
      ...(skuId
        ? { inven_sku_id: new mongoose.Types.ObjectId(skuId) }
        : { inven_product_id: new mongoose.Types.ObjectId(productId) }),
      inven_stock: { $gte: quantity }, // ONLY update if stock >= quantity
    },
    {
      $inc: { inven_stock: -quantity },
      $push: {
        inven_reservation: {
          quantity,
          cartId,
          createdAt: new Date(),
        },
      },
    },
    {
      new: true,
      session,
    },
  )
}

/*
  releaseInventory — Restore inventory when a user cancels an order.

  How it works:
  - Add the quantity back to stock ($inc: +quantity)
  - Remove the reservation record ($pull)
*/
export const releaseInventory = async ({
  productId,
  skuId,
  quantity,
  cartId,
  session,
}: {
  productId: string
  skuId?: string
  quantity: number
  cartId: string
  session: mongoose.ClientSession
}) => {
  return InventoryModel.findOneAndUpdate(
    {
      ...(skuId
        ? { inven_sku_id: new mongoose.Types.ObjectId(skuId) }
        : { inven_product_id: new mongoose.Types.ObjectId(productId) }),
    },
    {
      $inc: { inven_stock: quantity }, // add back to stock
      $pull: {
        inven_reservation: { cartId }, // remove reservation
      },
    },
    {
      new: true,
      session,
    },
  )
}

export const getInventoryByProductId = async (productId: string) => {
  return InventoryModel.findOne({
    inven_product_id: new mongoose.Types.ObjectId(productId),
  }).lean()
}

// Stock per SKU for one SPU — what the product detail page renders the matrix from.
export const getInventoryByProductIdGroupedBySku = async (
  productId: string,
): Promise<Map<string, number>> => {
  const rows = await InventoryModel.find({
    inven_product_id: new mongoose.Types.ObjectId(productId),
  })
    .select({ inven_sku_id: 1, inven_stock: 1 })
    .lean()
  return new Map(
    rows.map((r) => [String(r.inven_sku_id), r.inven_stock ?? 0]),
  )
}

/*
  setInventoryStockBySku — absolute stock write from the seller dashboard.

  Deliberately NOT an $inc: the seller is stating "there are 20 in the box now",
  not "add 20". Reservations are left untouched — releasing them still adds back
  on top of whatever the seller set.
*/
export const setInventoryStockBySku = async ({
  skuId,
  stock,
  session,
}: {
  skuId: string
  stock: number
  session?: mongoose.ClientSession
}) => {
  return InventoryModel.updateOne(
    { inven_sku_id: new mongoose.Types.ObjectId(skuId) },
    { $set: { inven_stock: stock } },
    session ? { session } : {},
  )
}
