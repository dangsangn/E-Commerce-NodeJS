import jwt from 'jsonwebtoken'

export const createTokenPair = async (
  payload: { userId: string; email: string },
  publicKey: string,
  privateKey: string
) => {
  try {
    const accessToken = jwt.sign(payload, privateKey, {
      expiresIn: '2 days',
      algorithm: 'RS256',
    })
    const refreshToken = jwt.sign(payload, privateKey, {
      expiresIn: '7 days',
      algorithm: 'RS256',
    })

    jwt.verify(accessToken, publicKey, (err: any, decoded: any) => {
      if (err) {
        console.log('Error verifying access token:', err)
      }
      console.log('Decoded access token:', decoded)
    })
    return { accessToken, refreshToken }
  } catch (error) {
    throw error
  }
}
