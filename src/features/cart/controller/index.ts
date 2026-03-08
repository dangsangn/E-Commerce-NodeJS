import { Request, Response } from 'express'
import { CartService } from '../service'
import { CreatedResponse, OkResponse } from '../../../core/success.response'

class CartController {
  addToCart = async (req: Request, res: Response) => {
    const data = await CartService.addToCart({
      userId: req.user!.userId,
      productId: req.body.productId,
      quantity: req.body.quantity,
    })
    return CreatedResponse.send(res, {
      data,
      message: 'Added to cart successfully',
    })
  }

  getCart = async (req: Request, res: Response) => {
    const data = await CartService.getCart({
      userId: req.user!.userId,
    })
    return OkResponse.send(res, {
      data,
    })
  }

  updateCartQuantity = async (req: Request, res: Response) => {
    const data = await CartService.updateCartProductQuantity({
      userId: req.user!.userId,
      productId: req.body.productId,
      oldQuantity: Number(req.body.oldQuantity),
      newQuantity: Number(req.body.newQuantity),
    })
    return OkResponse.send(res, {
      data,
      message: 'Update to cart successfully',
    })
  }

  removeFromCart = async (req: Request, res: Response) => {
    const data = await CartService.removeFromCart({
      userId: req.user!.userId,
      productId: req.body.productId,
      oldQuantity: Number(req.body.oldQuantity),
    })
    return OkResponse.send(res, {
      data,
      message: 'Remove to cart successfully',
    })
  }

  clearCart = async (req: Request, res: Response) => {
    const data = await CartService.clearCart(req.user.userId)
    return OkResponse.send(res, { data, message: 'Cart cleared successfully' })
  }
}

export default new CartController()
