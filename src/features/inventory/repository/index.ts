import mongoose from 'mongoose'
import { InventoryModel } from '../models'

export const insertInventory = async ({
  product_id,
  shop_id,
  stock,
  location = 'unKnow',
  session,
}: {
  product_id: mongoose.Types.ObjectId
  shop_id: mongoose.Types.ObjectId
  stock: number
  location?: string
  session: mongoose.ClientSession
}) => {
  const payload = {
    inven_product_id: product_id,
    inven_shop_id: shop_id,
    inven_stock: stock,
    inven_location: location,
  }
  if (session) {
    return (
      await InventoryModel.create(
        await InventoryModel.create([payload], { session }),
      )
    )[0]
  }
  return await InventoryModel.create(payload)
}

/*
  reserveInventory — Reserve a product when creating an order.

  How it works:
  - Uses { $gte: quantity } to check if inventory is sufficient
  - If sufficient → deduct stock ($inc: -quantity) + add reservation
  - If NOT sufficient → findOneAndUpdate returns null

  This is an atomic operation — MongoDB guarantees no race conditions.
  No pessimistic lock needed, no distributed lock needed.
*/
export const reserveInventory = async ({
  productId,
  quantity,
  cartId,
  session,
}: {
  productId: string
  quantity: number
  cartId: string
  session: mongoose.ClientSession
}) => {
  return InventoryModel.findOneAndUpdate(
    {
      inven_product_id: new mongoose.Types.ObjectId(productId),
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
  quantity,
  cartId,
  session,
}: {
  productId: string
  quantity: number
  cartId: string
  session: mongoose.ClientSession
}) => {
  return InventoryModel.findOneAndUpdate(
    {
      inven_product_id: new mongoose.Types.ObjectId(productId),
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
