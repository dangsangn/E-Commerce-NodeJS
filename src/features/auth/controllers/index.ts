import { Request, Response } from 'express'
import AuthService from '../services'

class AuthController {
  signup = async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body
      const data = await AuthService.signup({ email, password, name })
      return res.status(201).json(data)
    } catch (error) {
      throw error
    }
  }
}

export default new AuthController()
