import { ResourceModel } from '../features/rbac/models/resource.model'
import { ROLE_NAME, RoleModel } from '../features/rbac/models/role.model'

const RESOURCES = ['profile', 'product', 'order', 'discount', 'cart']

const ROLE_GRANTS: Record<string, any[]> = {
  [ROLE_NAME.USER]: [
    {
      resource: 'profile',
      actions: ['read:own', 'update:own'],
      attributes: '*, !usr_password',
    },
    { resource: 'product', actions: ['read:any'], attributes: '*' },
    {
      resource: 'cart',
      actions: ['create:own', 'read:own', 'update:own', 'delete:own'],
      attributes: '*',
    },
    { resource: 'order', actions: ['create:own', 'read:own'], attributes: '*' },
  ],
  [ROLE_NAME.SHOP]: [
    {
      resource: 'profile',
      actions: ['read:own', 'update:own'],
      attributes: '*, !usr_password',
    },
    {
      resource: 'product',
      actions: ['create:own', 'read:any', 'update:own', 'delete:own'],
      attributes: '*',
    },
    {
      resource: 'discount',
      actions: ['create:own', 'read:own', 'update:own', 'delete:own'],
      attributes: '*',
    },
    { resource: 'order', actions: ['read:own', 'update:own'], attributes: '*' },
  ],
  [ROLE_NAME.ADMIN]: [
    {
      resource: 'profile',
      actions: ['read:any', 'update:any', 'delete:any'],
      attributes: '*',
    },
    {
      resource: 'product',
      actions: ['create:any', 'read:any', 'update:any', 'delete:any'],
      attributes: '*',
    },
    {
      resource: 'order',
      actions: ['create:any', 'read:any', 'update:any', 'delete:any'],
      attributes: '*',
    },
    {
      resource: 'discount',
      actions: ['create:any', 'read:any', 'update:any', 'delete:any'],
      attributes: '*',
    },
  ],
}

export async function up(): Promise<void> {
  // 1. registry resources (idempotent via upsert with src_name)
  for (const name of RESOURCES) {
    await ResourceModel.findOneAndUpdate(
      { src_name: name },
      { src_name: name, src_slug: name },
      { upsert: true, returnDocument: 'after' },
    )
    console.log(`   resource: ${name}`)
  }

  // 2. roles + grants
  for (const roleName of Object.values(ROLE_NAME)) {
    await RoleModel.findOneAndUpdate(
      { rol_name: roleName },
      {
        rol_name: roleName,
        rol_slug: roleName,
        rol_grants: ROLE_GRANTS[roleName],
      },
      { upsert: true, returnDocument: 'after' },
    )
    console.log(`   role: ${roleName} (${ROLE_GRANTS[roleName].length} grants)`)
  }
}

export async function down(): Promise<void> {
  await ResourceModel.deleteMany({ src_name: { $in: RESOURCES } })
  await RoleModel.deleteMany({ rol_name: { $in: Object.values(ROLE_NAME) } })
  console.log('   🗑️  Removed seeded resources and roles')
}
