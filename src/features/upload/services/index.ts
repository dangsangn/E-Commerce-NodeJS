import { v2 as cloudinary, UploadApiOptions } from 'cloudinary'
import Multer from 'multer'
import config from '../../../configs'

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
})

export class UploadService {
  static uploadFromUrl = async (url: string, options?: UploadApiOptions) => {
    try {
      const result = await cloudinary.uploader.upload(url, options)
      return result
    } catch (error) {
      console.log('🚀 ~ UploadService.uploadFromUrl ~ error:', error)
      throw new Error('Failed to upload image from URL')
    }
  }
  static uploadFromFile = async (file: File) => {}
  static uploadFromFiles = async (files: File[]) => {}
}
