import mongoose from "mongoose"
import { InventoryModel } from "../models"

export const insertInventory = async ({
  product_id,
  shop_id,
  stock,
  location = 'unKnow',
}: {
  product_id: mongoose.Types.ObjectId
  shop_id: mongoose.Types.ObjectId
  stock: number
  location?: string
}) => {
  return await InventoryModel.create({ inven_product_id: product_id, inven_shop_id: shop_id, inven_stock: stock, inven_location: location })
}