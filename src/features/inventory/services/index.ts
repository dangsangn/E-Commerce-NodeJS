import { getInventoryByProductId } from '../repository'

export class InventoryService {
  static getByProductId = async (id: string) => {
    const inventory = await getInventoryByProductId(id)
    if (!inventory) throw new Error('Inventory not found')
    return inventory
  }
}
