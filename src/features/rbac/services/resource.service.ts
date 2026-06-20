import { ResourceModel } from '../models/resource.model'

export default class ResourceService {
  static createResource = (payload: {
    src_name: string
    src_description?: string
  }) => {
    ResourceModel.create({ ...payload, src_slug: payload.src_name })
  }

  static getResources = () =>
    ResourceModel.find({}).select('src_name src_slug').lean()
}
