import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary'
import Multer from 'multer'
import config from '../../../configs'
import logger from '@/loggers'
import { InternalServerError } from '@/core/error.response'
import { Readable } from 'stream'

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
  secure: true,
})

export interface UploadResult {
  url: string
  publicId: string
  width: number
  height: number
  format: string
  bytes: number
}

export class UploadService {
  static uploadBuffer = async (
    buffer: Buffer,
    option?: UploadApiOptions,
  ): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          transformation: [
            {
              width: 2000,
              height: 2000,
              crop: 'limit',
            },
          ],
          ...option,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            logger.error('Cloudinary upload error:', { error })
            return reject(new InternalServerError('Failed to upload image'))
          }
          resolve(UploadService.toResult(result))
        },
      )
      Readable.from(buffer).pipe(stream)
    })
  }

  static uploadFromUrl = async (
    url: string,
    options: UploadApiOptions,
  ): Promise<UploadResult> => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        url,
        options,
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            logger.error('Cloudinary upload error:', { error })
            return reject(
              new InternalServerError('Failed to upload image from URL'),
            )
          }
          resolve(UploadService.toResult(result))
        },
      )
    })
  }

  static destroy = async (publicId: string): Promise<void> => {
    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (error) {
      logger.error('Cloudinary destroy error:', { error })
      throw new InternalServerError('Failed to delete image')
    }
  }

  private static toResult = (result: UploadApiResponse): UploadResult => {
    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    }
  }

  /* version 2: Signed upload 
  The server only signs the file; it doesn't receive it. The client uses this signature to upload it directly to Cloudinary.
  */
  static createUploadSignature = (
    params: Record<string, string | number>,
    timestamp: number,
  ) => {
    const toSign = { timestamp, ...params }
    const signature = cloudinary.utils.api_sign_request(
      toSign,
      config.cloudinaryApiSecret,
    )
    return { signature, timestamp, apiKey: config.cloudinaryApiKey }
  }
}
