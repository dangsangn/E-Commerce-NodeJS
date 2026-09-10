/**
 * 005 — replace the multikey unique index on Skus with a scalar one.
 *
 * `sku_tier_idx` is an array, so `{ sku_product_id: 1, sku_tier_idx: 1 }` built a
 * MULTIKEY index: Mongo indexes each ELEMENT of the array rather than the array
 * as a single key. Two cells of the same SPU, [0,0] and [0,1], both emit the
 * entry (product, 0) and the second insert dies with
 *
 *   E11000 duplicate key ... dup key: { sku_product_id: ..., sku_tier_idx: 0 }
 *
 * — note the scalar 0, the giveaway that the array was expanded. The bug is
 * invisible on single-axis products ([0] and [1] never collide) and fires the
 * first time a shop adds a second axis.
 *
 * The fix is a derived scalar, `sku_tier_key` ("0-1"), carrying the constraint.
 * `sku_tier_idx` stays as the working representation everything else reads.
 *
 * Safe to run on a database that has no SKUs yet — every step is conditional.
 */
import { skuModel } from '../features/product/model/sku.model'

const OLD_INDEX = 'sku_product_id_1_sku_tier_idx_1'
const NEW_INDEX = 'sku_product_id_1_sku_tier_key_1'

export async function up() {
  // 1. Backfill BEFORE indexing: a unique index over a field most documents are
  //    missing would see them all as null and collide on the spot.
  const backfilled = await skuModel.collection
    .find({ sku_tier_key: { $exists: false } })
    .toArray()
  for (const sku of backfilled) {
    await skuModel.collection.updateOne(
      { _id: sku._id },
      { $set: { sku_tier_key: (sku.sku_tier_idx ?? []).join('-') } },
    )
  }
  console.log(`backfilled sku_tier_key on ${backfilled.length} sku(s)`)

  // 2. Drop the broken index. Do it before creating the new one so a database
  //    that somehow holds cells the old index rejected can still be fixed.
  const indexes = await skuModel.collection.indexes()
  if (indexes.some((i) => i.name === OLD_INDEX)) {
    await skuModel.collection.dropIndex(OLD_INDEX)
    console.log(`dropped multikey index ${OLD_INDEX}`)
  }

  // 3. Create the scalar one.
  if (!indexes.some((i) => i.name === NEW_INDEX)) {
    await skuModel.collection.createIndex(
      { sku_product_id: 1, sku_tier_key: 1 },
      { unique: true },
    )
    console.log(`created ${NEW_INDEX}`)
  }
}

/**
 * Restores the broken index, because that is what "undo" means here. Any SPU
 * with two or more variant axes created since up() ran will make this fail with
 * E11000 — that is the original bug reasserting itself, not a fault in the
 * rollback. Delete those products first if you genuinely need to go back.
 */
export async function down() {
  const indexes = await skuModel.collection.indexes()
  if (indexes.some((i) => i.name === NEW_INDEX)) {
    await skuModel.collection.dropIndex(NEW_INDEX)
  }
  await skuModel.collection.updateMany({}, { $unset: { sku_tier_key: '' } })
  if (!indexes.some((i) => i.name === OLD_INDEX)) {
    await skuModel.collection.createIndex(
      { sku_product_id: 1, sku_tier_idx: 1 },
      { unique: true },
    )
  }
}
