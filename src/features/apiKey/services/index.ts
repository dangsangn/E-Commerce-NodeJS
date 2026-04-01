import { ApiKeyModel } from '../models'

export class ApiKeyService {
  static findByApiKey = async (key: string) => {
    const apiKey = await ApiKeyModel.findOne({ key, status: true }).lean()
    return apiKey
  }
}
