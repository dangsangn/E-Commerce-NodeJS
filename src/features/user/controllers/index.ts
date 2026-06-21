import { Request, Response } from 'express'
import { UserService } from '../services'
import AuthService from '../../auth/services'
import { OkResponse } from '../../../core/success.response'

export default class UserController {
  static upgradeToShop = async (req: Request, res: Response) => {
    const userId = req.user.userId
    const { roles } = await UserService.upgradeToShop(
      userId,
      req.body?.shopName,
    )

    const tokens = await AuthService.reissueTokens({
      userId,
      email: req.user.email,
      roles,
    })
    return new OkResponse({
      message: 'Upgraded to shop',
      data: { roles, tokens },
    }).send(res)
  }
}
