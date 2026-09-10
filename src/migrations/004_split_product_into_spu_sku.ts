/**
 * 004 — split flat Products into SPU + SKU.
 *
 * Every existing product is an SPU with no variants, so each one gets exactly
 * one default SKU at `sku_tier_idx: []`. After this runs the system is uniform:
 * everything sellable is a SKU, most SPUs just happen to have one. Real variants
 * are added by shops afterwards.
 *
 * Deliberately NOT touched: `order_products` on past orders. A snapshot is a
 * historical record — stamping it with a SKU id that did not exist when the
 * order was placed is rewriting history. Readers of old orders handle a missing
 * skuId instead.
 *
 * `Clothes.color` / `Clothes.size` are also left alone. Merging twelve flat
 * products into one 3×4 SPU is a business call ("are these the same shirt?"),
 * and grouping by product_name would merge two different shops' products.
 */
import { ProductModel } from '../features/product/model'
import { skuModel } from '../features/product/model/sku.model'
import { InventoryModel } from '../features/inventory/models'
import { CartModel, CART_STATE } from '../features/cart/model'

// Written through the raw collection so it survives Mongoose's strict filter.
// down() uses it to delete exactly the SKUs this migration created, instead of
// guessing from sku_code and taking real no-variant SKUs with it.
const MIGRATION_MARKER = '_migrated_from_flat_004'

export async function up() {
  // Read raw: product_price / product_quantity kept their names but a schema
  // refactor could drop them, and isPublished / isDraft are `select: false`,
  // so a Mongoose read would silently return undefined for them.
  const products = await ProductModel.collection.find({}).toArray()

  let migrated = 0
  for (const p of products) {
    const already = await skuModel.collection.countDocuments({
      sku_product_id: p._id,
    })
    if (already > 0) continue // re-runnable: this product already has SKUs

    const insert = await skuModel.collection.insertOne({
      sku_code: `${p._id}-0`,
      sku_product_id: p._id,
      sku_shop_id: p.product_shop,
      sku_tier_idx: [], // no variant
      sku_tier_key: '', // scalar mirror of sku_tier_idx — see 005
      sku_price: p.product_price,
      sku_thumb: p.product_thumb
        ? { url: p.product_thumb, public_id: p.product_thumb_public_id }
        : null,
      sku_default: true,
      isPublished: p.isPublished ?? false,
      isDeleted: p.isDeleted ?? false,
      deletedAt: p.deletedAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      [MIGRATION_MARKER]: true,
    })
    const skuId = insert.insertedId

    // updateMany, not updateOne: legacy data can hold several inventory rows for
    // one product (one per inven_location).
    await InventoryModel.collection.updateMany(
      { inven_product_id: p._id },
      { $set: { inven_sku_id: skuId } },
    )

    // A product with no inventory row at all would be unbuyable once
    // inven_sku_id becomes required — give it one at zero stock.
    const invenCount = await InventoryModel.collection.countDocuments({
      inven_product_id: p._id,
    })
    if (invenCount === 0) {
      await InventoryModel.collection.insertOne({
        inven_product_id: p._id,
        inven_sku_id: skuId,
        inven_shop_id: p.product_shop,
        inven_stock: p.product_quantity ?? 0,
        inven_location: 'unKnow',
        inven_reservation: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    // product_price / product_quantity keep their values — only their meaning
    // changes (client input → derived from SKUs). The numbers stay put so cart
    // and checkout, which still read them, keep working through the switch.
    await ProductModel.collection.updateOne(
      { _id: p._id },
      {
        $set: {
          product_variations: Array.isArray(p.product_variations)
            ? p.product_variations.filter(
                (v: unknown) =>
                  typeof v === 'object' && v !== null && 'options' in v,
              )
            : [],
          product_price_min: p.product_price,
          product_price_max: p.product_price,
          product_sku_count: 1,
        },
      },
    )

    migrated += 1
    console.log(`migrated product ${p._id} → sku ${skuId}`)
  }
  console.log(`migrated ${migrated} product(s)`)

  /*
    Active carts are DELETED, not backfilled.

    Backfilling is technically possible (point every line at the default SKU),
    but a cart is throwaway data a shopper rebuilds in 30 seconds, while a
    wrong backfill means paying for the wrong variant. Losing it costs little;
    getting it wrong costs real money.
  */
  const cleared = await CartModel.deleteMany({ cart_state: CART_STATE.ACTIVE })
  console.log(`cleared ${cleared.deletedCount} active cart(s)`)

  // Indexes last: building them after the inserts keeps the loop fast.
  await skuModel.syncIndexes()
  await InventoryModel.collection.createIndex(
    { inven_sku_id: 1 },
    { unique: true },
  )
}

/**
 * Note honestly what this does NOT undo: the active carts deleted in up() are
 * gone for good.
 */
export async function down() {
  // Drop the unique index BEFORE $unset-ing the field. Lesson from 003: a unique
  // index treats documents missing the field as null, so unsetting it in bulk
  // produces many duplicate nulls → E11000.
  const idx = await InventoryModel.collection.indexes()
  if (idx.some((i) => i.name === 'inven_sku_id_1')) {
    await InventoryModel.collection.dropIndex('inven_sku_id_1')
  }

  await InventoryModel.collection.updateMany(
    {},
    { $unset: { inven_sku_id: '' } },
  )
  const removed = await skuModel.collection.deleteMany({
    [MIGRATION_MARKER]: true,
  })
  console.log(`removed ${removed.deletedCount} migration-created sku(s)`)

  await ProductModel.collection.updateMany(
    {},
    {
      $unset: {
        product_price_min: '',
        product_price_max: '',
        product_sku_count: '',
      },
    },
  )
}
