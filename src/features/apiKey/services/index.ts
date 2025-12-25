import crypto from 'crypto'
import { ApiKeyModel } from '../models'

export const findById = async (key: string) => {
  // const createdKey = await ApiKeyModel.create({
  //   key: crypto.randomBytes(64).toString('hex'),
  //   permissions: ['0000'],
  // })
  // console.log('apiKey', createdKey)
  const apiKey = await ApiKeyModel.findOne({ key, status: true }).lean()
  return apiKey
}
