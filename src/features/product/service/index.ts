import mongoose from 'mongoose'
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from '../../../core/error.response'
import {
  ClothingModel,
  ElectronicModel,
  ProductModel,
  productType,
} from '../model'
import { ProductRepository } from '../repository'
import { PAGINATION_DEFAULT_LIMIT } from '../../../constants/common'
import { FindAndUpdateProductPayload } from '../dto'
import { flattenObject } from '../../../utils'
import { insertInventory } from '../../inventory/repository'
import { validateImageBuffer } from '@/features/upload/validator/image.validator'
import { UploadService } from '@/features/upload/services'
import logger from '@/loggers'
import { ProductProps } from '../types'

export class ProductServiceFactory {
  static productRegister: Record<string, any> = {} // key: product_type, value: Class

  static registerProductType = (type: string, Class: any) => {
    this.productRegister[type] = Class
  }
  static createProduct = (payload: any) => {
    const type = payload.product_type

    const ProductClass = this.productRegister[type]
    if (!ProductClass) {
      throw new BadRequestError('Invalid product type')
    }

    const prefix = `products/${payload.product_shop}/${payload._id}`
    const publicIds = [
      payload.product_thumb_public_id,
      ...(payload.product_images || []).map((img: any) => img.public_id),
    ]
    if (publicIds.some((id) => !id.startsWith(prefix))) {
      throw new BadRequestError('Invalid public_id for product images')
    }

    return new ProductClass(payload).createProduct()
  }

  static searchProducts = async ({
    query,
    page = 1,
    limit = PAGINATION_DEFAULT_LIMIT,
  }: {
    query: any
    page?: number
    limit?: number
  }) => {
    return await ProductRepository.searchProducts({
      query,
      page,
      limit,
    })
  }

  static getDraftProductByShop = async ({
    query,
    limit = PAGINATION_DEFAULT_LIMIT,
    page = 1,
  }: {
    query: any
    limit?: number
    page?: number
  }) => {
    return await ProductRepository.getDraftProductByShop({ query, limit, page })
  }

  static getPublishedProductByShop = async ({
    query,
    limit = PAGINATION_DEFAULT_LIMIT,
    page = 1,
  }: {
    query: any
    limit?: number
    page?: number
  }) => {
    return await ProductRepository.getPublishedProductByShop({
      query,
      limit,
      page,
    })
  }

  static setPublishedProductByShop = async ({
    product_shop,
    product_id,
  }: {
    product_shop: string
    product_id: string
  }) => {
    // check product exist
    const product = await ProductRepository.getDetailProduct({ product_id })
    if (!product) throw new BadRequestError('Product not found')
    const type = product.product_type
    const ProductClass = this.productRegister[type]
    if (!ProductClass) {
      throw new BadRequestError('Invalid product type')
    }

    return ProductRepository.setPublishedProductByShop({
      product_shop,
      product_id,
    })
  }

  static setDraftProductByShop = async ({
    product_shop,
    product_id,
  }: {
    product_shop: string
    product_id: string
  }) => {
    return await ProductRepository.setDraftProductByShop({
      product_shop,
      product_id,
    })
  }

  static getDetailProduct = async ({ product_id }: { product_id: string }) => {
    return await ProductRepository.getDetailProduct({ product_id })
  }

  static updateProduct = async ({
    product_id,
    product_shop,
    payload,
  }: {
    product_id: string
    product_shop: string
    payload: FindAndUpdateProductPayload
  }) => {
    const product = await ProductRepository.getDetailProduct({ product_id })
    if (!product) throw new BadRequestError('Product not found')
    if (String(product.product_shop) !== String(product_shop))
      throw new ForbiddenError('Not your product')

    const type = product.product_type

    const ProductClass =
      this.productRegister[type as keyof typeof this.productRegister]
    if (!ProductClass) {
      throw new BadRequestError('Invalid product type')
    }
    return new ProductClass(product).updateProduct(product_id, payload)
  }

  static prepareImages = async ({
    shopId,
    files,
  }: {
    shopId: string
    files: Express.Multer.File[]
  }) => {
    files.forEach((file) => validateImageBuffer(file.buffer))

    const productId = new mongoose.Types.ObjectId().toString()
    const folder = `products/${shopId}/${productId}`

    const settled = await Promise.allSettled(
      files.map((f) => UploadService.uploadBuffer(f.buffer, { folder })),
    )
    const ok = settled
      .filter((s) => s.status === 'fulfilled')
      .map((s) => s.value)
    const failed = settled.filter((s) => s.status === 'rejected')
    if (failed.length > 0) {
      await Promise.all(ok.map((r) => UploadService.destroy(r.publicId)))
      throw new InternalServerError(
        `Failed to upload some images: ${failed.length}/${files.length}`,
      )
    }
    const images = ok.map((r) => ({
      url: r.url,
      public_id: r.publicId,
    }))
    return { productId, images, thumb: images[0] }
  }

  static attackProductImages = async ({
    productId,
    shopId,
    files,
  }: {
    productId: string
    shopId: string
    files: Express.Multer.File[]
  }) => {
    const product = await ProductRepository.getProductByIdOwner({
      productId,
      userId: shopId,
    })
    if (!product) throw new BadRequestError('Product not found')
    files.forEach((file) => validateImageBuffer(file.buffer))

    const folder = `products/${shopId}/${productId}`
    const settled = await Promise.allSettled(
      files.map((f) => UploadService.uploadBuffer(f.buffer, { folder })),
    )
    const ok = settled
      .filter((s) => s.status === 'fulfilled')
      .map((s) => s.value)
    const failed = settled.filter((s) => s.status === 'rejected')
    if (failed.length) {
      await Promise.all(ok.map((r) => UploadService.destroy(r.publicId)))
      throw new InternalServerError(
        `Failed to upload some images: ${failed.length}/${files.length}`,
      )
    }
    const images = ok.map((r) => ({
      url: r.url,
      public_id: r.publicId,
    }))
    try {
      product.product_images.push(...images)
      await product.save()
      return product.product_images
    } catch (error) {
      throw error
    }
  }
}

export abstract class ProductService implements ProductProps {
  _id!: string
  product_name!: string
  product_thumb!: string
  product_thumb_public_id!: string
  product_description?: string
  product_price!: number
  product_quantity!: number
  product_type!: string
  product_shop!: string
  product_attributes!: any
  product_images?: { url: string; public_id: string }[]

  constructor(props: ProductProps) {
    Object.assign(this, props)
  }

  protected toProductObject() {
    return {
      _id: this._id,
      product_name: this.product_name,
      product_thumb: this.product_thumb,
      product_description: this.product_description,
      product_price: this.product_price,
      product_quantity: this.product_quantity,
      product_type: this.product_type,
      product_shop: this.product_shop,
      product_attributes: this.product_attributes,
      product_thumb_public_id: this.product_thumb_public_id,
      product_images: this.product_images,
    }
  }

  async createProduct(session: mongoose.mongo.ClientSession) {
    const newProduct = (
      await ProductModel.create(
        [{ ...this.toProductObject(), _id: this._id }],
        { session },
      )
    )[0]

    if (!newProduct) throw new BadRequestError('Create product failed')

    await insertInventory({
      product_id: newProduct._id,
      shop_id: new mongoose.Types.ObjectId(this.product_shop),
      stock: this.product_quantity,
      session,
    })

    return newProduct
  }
  async updateProduct(
    product_id: mongoose.Types.ObjectId,
    payload: FindAndUpdateProductPayload,
  ) {
    return await ProductRepository.findAndUpdate({
      product_id,
      payload,
      model: ProductModel,
    })
  }
}

export class ClothingService extends ProductService {
  async createProduct() {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const createClothing = await ClothingModel.create(
        [
          {
            ...this.product_attributes,
            product_shop: this.product_shop,
            _id: this._id,
          },
        ],
        {
          session,
        },
      )
      if (!createClothing) throw new BadRequestError('Create clothing failed')
      const newProduct = await super.createProduct(session)
      if (!newProduct) throw new BadRequestError('Create product failed')
      await session.commitTransaction()
      return newProduct
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  async updateProduct(
    product_id: mongoose.Types.ObjectId,
    payload: FindAndUpdateProductPayload,
  ) {
    const flattenedPayload = flattenObject(payload)
    // update product
    const updatedProduct = await super.updateProduct(
      product_id,
      flattenedPayload,
    )
    if (payload.product_attributes) {
      const flattenedProductAttributes = flattenObject(
        payload.product_attributes,
      )
      await ProductRepository.findAndUpdate({
        product_id,
        payload: flattenedProductAttributes,
        model: ClothingModel,
      })
    }
    return updatedProduct
  }
}

export class ElectronicService extends ProductService {
  async createProduct() {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const createElectronic = await ElectronicModel.create(
        [
          {
            ...this.product_attributes,
            product_shop: this.product_shop,
            _id: this._id,
          },
        ],
        {
          session,
        },
      )
      if (!createElectronic)
        throw new BadRequestError('Create electronic failed')
      const newProduct = await super.createProduct(session)
      if (!newProduct) throw new BadRequestError('Create product failed')
      await session.commitTransaction()
      return newProduct
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // update product electronic
  async updateProduct(
    product_id: mongoose.Types.ObjectId,
    payload: FindAndUpdateProductPayload,
  ) {
    const flattenedPayload = flattenObject(payload)
    // update product
    const updatedProduct = await super.updateProduct(
      product_id,
      flattenedPayload,
    )
    if (payload.product_attributes) {
      const flattenedProductAttributes = flattenObject(
        payload.product_attributes,
      )
      await ProductRepository.findAndUpdate({
        product_id,
        payload: flattenedProductAttributes,
        model: ElectronicModel,
      })
    }
    return updatedProduct
  }
}

ProductServiceFactory.registerProductType(productType.CLOTHING, ClothingService)
ProductServiceFactory.registerProductType(
  productType.ELECTRONICS,
  ElectronicService,
)
