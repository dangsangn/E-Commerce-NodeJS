import { IsNotEmpty, IsString, MinLength } from 'class-validator'

// Validated in middleware, before AuthService sees the request: a malformed
// body must be a 400, not a bcrypt crash halfway through the reset.
export class ResetPasswordDTO {
  @IsString()
  @IsNotEmpty()
  resetTicket!: string

  // Same rule as the signup form on the frontend.
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string
}
