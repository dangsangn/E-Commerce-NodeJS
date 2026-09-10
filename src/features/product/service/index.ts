import mongoose from 'mongoose'
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from '../../../core/error.response'
import {
  ClothingModel,
  ElectronicModel,
  ProductModel,
  productType,
} from '../model'
import { ProductRepository } from '../repository'
import {
  SkuRepository,
  buildSkuCode,
  buildTierKey,
} from '../repository/sku.repository'
import { PAGINATION_DEFAULT_LIMIT } from '../../../constants/common'
import { FindAndUpdateProductPayload } from '../dto'
import { UpdateSkuInput } from '../dto/update.dto'
import { flattenObject } from '../../../utils'
import {
  getInventoryByProductIdGroupedBySku,
  insertInventoryMany,
  setInventoryStockBySku,
} from '../../inventory/repository'
import { validateImageBuffer } from '@/features/upload/validator/image.validator'
import { UploadService } from '@/features/upload/services'
import logger from '@/loggers'
import {
  DerivedPricing,
  ImageProps,
  ProductProps,
  SkuInputProps,
  VariationProps,
} from '../types'

type PricingRow = { price: number; stock: number; isDefault: boolean }

/*
  Price and stock CLIMB UP from the SKUs; they never flow down from the SPU.
  Letting a seller type a price at the SPU level would create two sources of
  truth for the same number.

  product_price / product_quantity are kept in sync here on purpose: cart and
  checkout still read them off the SPU, so they mirror the default SKU's price
  and the total stock across SKUs.
*/
const derivePricing = (rows: PricingRow[]): DerivedPricing => {
  if (!rows.length) throw new BadRequestError('A product needs at least one SKU')
  const prices = rows.map((r) => r.price)
  const fallback = rows[0]!
  const def = rows.find((r) => r.isDefault) ?? fallback
  return {
    product_price: def.price,
    product_quantity: rows.reduce((sum, r) => sum + r.stock, 0),
    product_price_min: Math.min(...prices),
    product_price_max: Math.max(...prices),
    product_sku_count: rows.length,
  }
}

/*
  assertOwnedPublicIds — every image must already live in this product's folder.

  Uploads land under `products/{shop}/{product}` before the product exists, so a
  public_id outside that prefix was never uploaded through this flow: it is a
  reference to somebody else's asset. Checked on create AND on every later write
  that accepts images, since each one is a fresh chance to smuggle a path in.
*/
const assertOwnedPublicIds = (prefix: string, publicIds: string[]) => {
  if (publicIds.some((id) => !id || !id.startsWith(prefix))) {
    throw new BadRequestError('Invalid public_id for product images')
  }
}

// Exactly one SKU per SPU carries sku_default — it is the one the page opens on.
const withSingleDefault = (skus: SkuInputProps[]): SkuInputProps[] => {
  const flagged = skus.findIndex((s) => s.sku_default)
  const defaultIdx = flagged === -1 ? 0 : flagged
  return skus.map((s, i) => ({ ...s, sku_default: i === defaultIdx }))
}

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

    /*
      Every public_id must live under this shop's folder for this product.
      The list has to include sku_thumb and the per-option variation images:
      they are new upload surfaces, and an unchecked public_id lets a seller
      point a SKU image at any asset in the Cloudinary account.
    */
    assertOwnedPublicIds(`products/${payload.product_shop}/${payload._id}`, [
      payload.product_thumb_public_id,
      ...(payload.product_images ?? []).map((img: ImageProps) => img.public_id),
      ...(payload.product_variations ?? []).flatMap((v: VariationProps) =>
        (v.images ?? []).map((img) => img.public_id),
      ),
      ...(payload.sku_list ?? [])
        .map((s: SkuInputProps) => s.sku_thumb?.public_id)
        .filter((id: string | undefined): id is string => Boolean(id)),
    ])

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
      filters: query,
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

  // Publishing an SPU publishes its SKUs: a live product page whose SKUs are all
  // unpublished would render an empty variant matrix.
  static setPublishedProductByShop = async ({
    product_shop,
    product_id,
  }: {
    product_shop: string
    product_id: string
  }) => {
    const product = await ProductRepository.getDetailProduct({ product_id })
    if (!product) throw new BadRequestError('Product not found')
    if (String(product.product_shop) !== String(product_shop))
      throw new ForbiddenError('Not your product')
    const ProductClass = this.productRegister[product.product_type as string]
    if (!ProductClass) {
      throw new BadRequestError('Invalid product type')
    }

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const result = await ProductRepository.setPublishedProductByShop({
        product_shop,
        product_id,
        session,
      })
      await SkuRepository.setPublishedByProduct({
        productId: product_id,
        isPublished: true,
        session,
      })
      await session.commitTransaction()
      return result
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  static setDraftProductByShop = async ({
    product_shop,
    product_id,
  }: {
    product_shop: string
    product_id: string
  }) => {
    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const result = await ProductRepository.setDraftProductByShop({
        product_shop,
        product_id,
        session,
      })
      await SkuRepository.setPublishedByProduct({
        productId: product_id,
        isPublished: false,
        session,
      })
      await session.commitTransaction()
      return result
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  /*
    Read detail — three indexed queries in parallel, then merge:
      SPU (variant axes) + SKUs (matrix cells) + stock per SKU.
    The client builds the matrix from `spu.product_variations` + `skus`, and
    disables the cells that have no SKU or zero stock.
  */
  static getDetailProduct = async ({ product_id }: { product_id: string }) => {
    if (!mongoose.isValidObjectId(product_id))
      throw new BadRequestError('Invalid product id')

    const [spu, skus, stockBySku] = await Promise.all([
      ProductRepository.getDetailProduct({ product_id }),
      SkuRepository.listByProduct({ productId: product_id }),
      getInventoryByProductIdGroupedBySku(product_id),
    ])
    if (!spu) throw new NotFoundError('Product not found')

    return {
      spu,
      skus: skus.map((sku) => ({
        ...sku,
        stock: stockBySku.get(String(sku._id)) ?? 0,
      })),
    }
  }

  // Shopee-style single-cell read: called when the buyer picks a variant, so the
  // page refreshes one price + stock instead of refetching the whole detail.
  static getSkuDetail = async ({
    product_id,
    sku_id,
  }: {
    product_id: string
    sku_id: string
  }) => {
    if (!mongoose.isValidObjectId(sku_id))
      throw new BadRequestError('Invalid sku id')

    const sku = await SkuRepository.getById(sku_id)
    // An id is a reference, not proof of ownership — check the SKU really is a
    // cell of the SPU the caller named.
    if (!sku || String(sku.sku_product_id) !== String(product_id))
      throw new NotFoundError('Sku not found')

    const stockBySku = await getInventoryByProductIdGroupedBySku(product_id)
    return { ...sku, stock: stockBySku.get(String(sku._id)) ?? 0 }
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

  /*
    updateVariations — rename axes and options, and set each option's photo.

    The SHAPE is frozen: same number of axes, same number of options on each.
    A SKU stores coordinates ([0, 1]), not labels, so inserting or removing an
    option renumbers the ones after it and every existing SKU would quietly come
    to mean a different variant. Renaming is safe for exactly the same reason —
    coordinates do not care what an option is called.

    Adding a variant is therefore a create-SKU operation, not a rename, and is
    not what this endpoint is for.
  */
  static updateVariations = async ({
    product_id,
    product_shop,
    variations,
  }: {
    product_id: string
    product_shop: string
    variations: VariationProps[]
  }) => {
    const product = await ProductRepository.getDetailProduct({ product_id })
    if (!product) throw new NotFoundError('Product not found')
    if (String(product.product_shop) !== String(product_shop))
      throw new ForbiddenError('Not your product')

    const current = (product.product_variations ?? []) as VariationProps[]
    if (variations.length !== current.length) {
      throw new BadRequestError(
        `This product has ${current.length} variation(s); adding or removing one would repoint its existing SKUs`,
      )
    }
    variations.forEach((axis, i) => {
      const before = current[i]!
      if (axis.options.length !== before.options.length) {
        throw new BadRequestError(
          `"${before.name}" has ${before.options.length} option(s); adding or removing one would repoint its existing SKUs`,
        )
      }
      const unique = new Set(axis.options.map((o) => o.toLowerCase()))
      if (unique.size !== axis.options.length) {
        throw new BadRequestError(`"${axis.name}" has duplicate options`)
      }
      // images is indexed BY OPTION POSITION — a short array shifts every photo
      // after the gap onto the wrong option.
      const images = axis.images ?? []
      if (images.length > 0 && images.length !== axis.options.length) {
        throw new BadRequestError(
          `"${axis.name}" needs a photo for every option, or none`,
        )
      }
    })

    assertOwnedPublicIds(
      `products/${product_shop}/${product_id}`,
      variations.flatMap((v) => (v.images ?? []).map((img) => img.public_id)),
    )

    return ProductRepository.replaceVariations({
      product_id,
      variations: variations.map((v) => ({
        name: v.name,
        options: v.options,
        images: v.images ?? [],
      })),
    })
  }

  /*
    updateSkus — the only way to change price or stock after creation.

    Stock is written to Inventories (the source of truth), price to Skus, and the
    SPU's derived range is recomputed from the result — all in one transaction,
    so the range can never advertise a price no SKU backs.
  */
  static updateSkus = async ({
    product_id,
    product_shop,
    skus,
  }: {
    product_id: string
    product_shop: string
    skus: UpdateSkuInput['skus']
  }) => {
    const product = await ProductRepository.getDetailProduct({ product_id })
    if (!product) throw new NotFoundError('Product not found')
    if (String(product.product_shop) !== String(product_shop))
      throw new ForbiddenError('Not your product')

    const existing = await SkuRepository.listByProduct({ productId: product_id })
    const known = new Set(existing.map((s) => String(s._id)))
    const unknown = skus.find((s) => !known.has(s.sku_id))
    if (unknown) throw new BadRequestError(`Sku ${unknown.sku_id} not found`)

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      if (skus.some((s) => s.sku_default)) {
        await SkuRepository.clearDefault({ productId: product_id, session })
      }

      for (const patch of skus) {
        const fields: Record<string, unknown> = {}
        if (patch.sku_price !== undefined) fields.sku_price = patch.sku_price
        if (patch.sku_default !== undefined)
          fields.sku_default = patch.sku_default
        if (Object.keys(fields).length > 0) {
          await SkuRepository.updateOne({
            skuId: patch.sku_id,
            productId: product_id,
            payload: fields,
            session,
          })
        }
        if (patch.sku_stock !== undefined) {
          await setInventoryStockBySku({
            skuId: patch.sku_id,
            stock: patch.sku_stock,
            session,
          })
        }
      }

      const [fresh, stockBySku] = await Promise.all([
        SkuRepository.listByProduct({ productId: product_id }),
        getInventoryByProductIdGroupedBySku(product_id),
      ])
      const pricing = derivePricing(
        fresh.map((s) => ({
          price: Number(s.sku_price),
          stock: stockBySku.get(String(s._id)) ?? 0,
          isDefault: Boolean(s.sku_default),
        })),
      )
      await ProductRepository.updateDerivedPricing({
        product_id,
        pricing,
        session,
      })

      await session.commitTransaction()
      return {
        skus: fresh.map((s) => ({
          ...s,
          stock: stockBySku.get(String(s._id)) ?? 0,
        })),
        pricing,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  /*
    prepareImages — upload into a draft folder before the product exists.

    `draftId` lets the seller upload in several batches while filling the form:
    without it every batch would mint a new id, land in a different folder, and
    only the last batch would survive the public_id prefix check at create time.
    It is only ever joined onto this shop's own path, so the worst a caller can
    do with a forged id is write into their own namespace.
  */
  static prepareImages = async ({
    shopId,
    files,
    draftId,
  }: {
    shopId: string
    files: Express.Multer.File[]
    draftId?: string
  }) => {
    files.forEach((file) => validateImageBuffer(file.buffer))

    if (draftId && !mongoose.isValidObjectId(draftId))
      throw new BadRequestError('Invalid product id')

    const productId = draftId ?? new mongoose.Types.ObjectId().toString()
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
      logger.error('attackProductImages failed', { error })
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
  product_type!: string
  product_shop!: string
  product_attributes!: any
  product_images?: ImageProps[]
  product_variations!: VariationProps[]
  sku_list!: SkuInputProps[]

  constructor(props: ProductProps) {
    Object.assign(this, props)
  }

  protected toProductObject() {
    return {
      _id: this._id,
      product_name: this.product_name,
      product_thumb: this.product_thumb,
      product_description: this.product_description,
      product_type: this.product_type,
      product_shop: this.product_shop,
      product_attributes: this.product_attributes,
      product_thumb_public_id: this.product_thumb_public_id,
      product_images: this.product_images,
      product_variations: this.product_variations ?? [],
    }
  }

  /*
    One transaction, four writes:
      1. the SPU, already carrying its derived price range
      2. N SKUs (the matrix cells the seller actually filled in)
      3. N inventory rows, 1:1 with the SKUs
    A partial write here would leave a product page nobody can buy from, so the
    caller opens the session and this method never commits on its own.
  */
  async createProduct(session: mongoose.ClientSession) {
    const skus = withSingleDefault(this.sku_list ?? [])
    const pricing = derivePricing(
      skus.map((s) => ({
        price: s.sku_price,
        stock: s.sku_stock,
        isDefault: Boolean(s.sku_default),
      })),
    )

    const newProduct = (
      await ProductModel.create(
        [{ ...this.toProductObject(), ...pricing, _id: this._id }],
        { session },
      )
    )[0]

    if (!newProduct) throw new BadRequestError('Create product failed')

    const productObjectId = newProduct._id as mongoose.Types.ObjectId
    const shopObjectId = new mongoose.Types.ObjectId(this.product_shop)

    const createdSkus = await SkuRepository.insertMany({
      skus: skus.map((sku) => ({
        sku_code: buildSkuCode(String(productObjectId), sku.sku_tier_idx),
        sku_product_id: productObjectId,
        sku_shop_id: shopObjectId,
        sku_tier_idx: sku.sku_tier_idx,
        sku_tier_key: buildTierKey(sku.sku_tier_idx),
        sku_price: sku.sku_price,
        sku_thumb: sku.sku_thumb ?? null,
        sku_default: Boolean(sku.sku_default),
        isPublished: false, // follows the SPU, which starts as a draft
      })),
      session,
    })

    await insertInventoryMany({
      rows: createdSkus.map((created, i) => ({
        inven_product_id: productObjectId,
        inven_sku_id: created._id as mongoose.Types.ObjectId,
        inven_shop_id: shopObjectId,
        inven_stock: skus[i]!.sku_stock,
      })),
      session,
    })

    return { spu: newProduct, skus: createdSkus }
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
      const created = await super.createProduct(session)
      if (!created) throw new BadRequestError('Create product failed')
      await session.commitTransaction()
      return created
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
      const created = await super.createProduct(session)
      if (!created) throw new BadRequestError('Create product failed')
      await session.commitTransaction()
      return created
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
