import jwt from 'jsonwebtoken'

/**
 * Create JWT token pair (access + refresh)
 * Using HS256 (symmetric) - most common for single-service apps
 *
 * @param payload - User data to encode in token
 * @param secretKey - Secret key for signing (same key used for verify)
 * @returns Object with accessToken and refreshToken
 */
export type TokenPayload = {
  userId: string
  email: string
  roles: string[]
}

export const createTokenPair = async (
  payload: TokenPayload,
  secretKey: string,
) => {
  try {
    const accessToken = jwt.sign(payload, secretKey, {
      expiresIn: '2 days',
      algorithm: 'HS256',
    })

    const refreshToken = jwt.sign(payload, secretKey, {
      expiresIn: '7 days',
      algorithm: 'HS256',
    })

    // Optional: Verify token was created correctly (for debugging)
    try {
      const decoded = jwt.verify(accessToken, secretKey)
      console.log('✓ Access token created and verified:', decoded)
    } catch (err) {
      console.error('✗ Token verification failed:', err)
      throw new Error('Failed to create valid token')
    }

    return { accessToken, refreshToken }
  } catch (error) {
    throw error
  }
}

/**
 * Verify JWT token
 * @param token - JWT token to verify
 * @param secretKey - Secret key used to sign the token
 * @returns Decoded token payload or throws error
 */
export const verifyToken = (token: string, secretKey: string) => {
  return jwt.verify(token, secretKey)
}
