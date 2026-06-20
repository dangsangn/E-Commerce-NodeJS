import { UserModel } from '../models'

export class UserService {
  static findByEmailWithPassword = async (email: string) => {
    return UserModel.findOne({ usr_email: email })
      .select('+usr_password')
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()
  }

  static findById = async (id: string) =>
    UserModel.findById(id)
      .populate({ path: 'usr_roles', select: 'rol_name' })
      .lean()

  static createUser = async (payload: any) => UserModel.create(payload)
}
