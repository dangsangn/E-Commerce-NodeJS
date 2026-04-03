import { Request, Response } from 'express'
import { InventoryService } from '../services'

class InventoryController {
  static getByProductId = async (req: Request, res: Response) => {
    const inventory = await InventoryService.getByProductId(
      req.params.productId as string,
    )
    return res.status(200).json(inventory)
  }
}

export default InventoryController
