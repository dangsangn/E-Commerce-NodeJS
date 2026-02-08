import { DiscountModel } from '../models'

/*
  - Generator Discount Code [Shop | Admin]
  - Get all discount codes [user | shop]
  - Get all products with discount [user]
  - Get discount amount [User]
  - Delete discount code [Shop | Admin]
  - Cancel discount code [User]
*/
export class DiscountService {

  static createDiscount = async (payload: any) => {
    return await DiscountModel.create(payload)
  }
}
