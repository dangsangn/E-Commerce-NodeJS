import { Request, Response } from 'express'
import { OrderService } from '../service'
import { CreatedResponse, OkResponse } from '../../../core/success.response'

class OrderController {
  createOrder = async (req: Request, res: Response) => {
    const data = await OrderService.createOrder({
      ...req.body,
      userId: req.user?.userId,
    })
    return CreatedResponse.send(res, { data })
  }

  getOrdersByUser = async (req: Request, res: Response) => {
    const data = await OrderService.getOrdersByUser({
      userId: req.user?.userId,
    })
    return OkResponse.send(res, { data })
  }

  getOrderDetail = async (req: Request, res: Response) => {
    const data = await OrderService.getOrderDetail({
      orderId: req.params.id as string,
      userId: req.user?.userId,
    })
    return OkResponse.send(res, { data })
  }

  cancelOrder = async (req: Request, res: Response) => {
    const data = await OrderService.cancelOrder({
      orderId: req.params.id as string,
      userId: req.user?.userId,
    })
    return OkResponse.send(res, { data })
  }
}

export default new OrderController()
