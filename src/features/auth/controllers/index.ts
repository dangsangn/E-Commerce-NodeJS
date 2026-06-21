/// <reference path="../../../types/express.d.ts" />
import { Request, Response } from 'express'
import AuthService from '../services'
import { CreatedResponse, OkResponse } from '../../../core/success.response'
import { NotFoundError } from '../../../core/error.response'
import { pick } from 'lodash'
import { TokenPayload } from '../utils'

class AuthController {
  signup = async (req: Request, res: Response) => {
    const { email, password, name } = req.body
    const data = await AuthService.signup({ email, password, name })
    return CreatedResponse.send(res, { data })
  }

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body
    const data = await AuthService.login({ email, password })
    return OkResponse.send(res, { data })
  }

  logout = async (req: Request, res: Response) => {
    if (!req.keyToken) {
      throw new NotFoundError('KeyToken not found')
    }
    const userId = String(req.keyToken.user)
    const data = await AuthService.logout({ userId })
    return OkResponse.send(res, {
      data: { ...data, message: 'Logged out successfully' },
    })
  }

  refreshToken = async (req: Request, res: Response) => {
    const refreshToken = req.refreshToken as string
    const data = await AuthService.refreshToken({
      refreshToken,
      userInfo: pick(req.user, ['userId', 'email', 'roles']),
    })
    return OkResponse.send(res, { data })
  }
}

export default new AuthController()
