import mongoose from 'mongoose'
import {
  BadRequestError,
  InternalServerError,
} from '../../../core/error.response'
import {
  ClothingModel,
  ElectronicModel,
  ProductModel,
  productType,
} from '../model'

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
    return new ProductClass(payload).createProduct()
  }
}

export abstract class ProductService {
  product_name: string
  product_thumb: string
  product_description?: string
  product_price: number
  product_quantity: number
  product_type: string
  product_shop: string
  product_attributes: any

  constructor({
    product_name,
    product_thumb,
    product_description,
    product_price,
    product_quantity,
    product_type,
    product_shop,
    product_attributes,
  }: {
    product_name: string
    product_thumb: string
    product_description?: string
    product_price: number
    product_quantity: number
    product_type: string
    product_shop: string
    product_attributes: any
  }) {
    this.product_name = product_name
    this.product_thumb = product_thumb
    this.product_description = product_description
    this.product_price = product_price
    this.product_quantity = product_quantity
    this.product_type = product_type
    this.product_shop = product_shop
    this.product_attributes = product_attributes
  }

  protected toProductObject() {
    return {
      product_name: this.product_name,
      product_thumb: this.product_thumb,
      product_description: this.product_description,
      product_price: this.product_price,
      product_quantity: this.product_quantity,
      product_type: this.product_type,
      product_shop: this.product_shop,
      product_attributes: this.product_attributes,
    }
  }

  async createProduct(
    session: mongoose.mongo.ClientSession,
    product_id: mongoose.Types.ObjectId
  ) {
    return await ProductModel.create(
      [{ ...this.toProductObject(), _id: product_id.toString() }],
      { session }
    )
  }
}

export class ClothingService extends ProductService {
  async createProduct() {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const createClothing = await ClothingModel.create(
        [{ ...this.product_attributes, product_shop: this.product_shop }],
        {
          session,
        }
      )
      if (!createClothing) throw new BadRequestError('Create clothing failed')
      const newProduct = await super.createProduct(
        session,
        createClothing[0]._id
      )
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
}

export class ElectronicService extends ProductService {
  async createProduct() {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const createElectronic = await ElectronicModel.create(
        [this.product_attributes],
        {
          session,
        }
      )
      if (!createElectronic)
        throw new BadRequestError('Create electronic failed')
      const newProduct = await super.createProduct(
        session,
        createElectronic[0]._id
      )
      if (!newProduct) throw new BadRequestError('Create product failed')
      await session.commitTransaction()
      return newProduct
    } catch (error) {
      await session.abortTransaction()
      throw new InternalServerError()
    } finally {
      session.endSession()
    }
  }
}

ProductServiceFactory.registerProductType(productType.CLOTHING, ClothingService)
ProductServiceFactory.registerProductType(
  productType.ELECTRONICS,
  ElectronicService
)

// create data payload for clothing product

export const clothingPayload = {
  product_name: 'Product 1',
  product_thumb: 'https://example.com/product-1.jpg',
  product_description: 'Description 1',
  product_price: 100,
  product_quantity: 10,
  product_type: productType.CLOTHING,
  product_shop: 'shop1',
  product_attributes: {
    brand: 'Brand 1',
    color: 'Color 1',
    size: 'Size 1',
    material: 'Material 1',
  },
}

// create data payload for electronic product

export const electronicPayload = {
  product_name: 'Product 1',
  product_thumb: 'https://example.com/product-1.jpg',
  product_description: 'Description 1',
  product_price: 100,
  product_quantity: 10,
  product_type: productType.ELECTRONICS,
  product_shop: 'shop1',
  product_attributes: {
    manufacturer: 'Manufacturer 1',
    model: 'Model 1',
  },
}
