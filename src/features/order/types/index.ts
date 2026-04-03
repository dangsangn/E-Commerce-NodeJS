/*
  Interface for input from the client.
  The client sends products already GROUPED by shop.
  Each shop can have its own discount.
*/
export interface ShopOrderItem {
  shopId: string
  shop_discounts: Array<{
    code: string
    shopId: string
  }>
  item_products: Array<{
    productId: string
    quantity: number
    price: number // client sends price → server will VALIDATE it
  }>
}
