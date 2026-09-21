import config from '@/configs'
import logger from '@/loggers'
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: config.mailer.host,
  port: config.mailer.port,
  secure: config.mailer.secure,
  auth: {
    user: config.mailer.user,
    pass: config.mailer.pass,
  },
})

class EmailService {
  static async sendOtpMail(to: string, otp: string) {
    await transporter.sendMail({
      from: config.mailer.from ?? '"Ecommerce" <no-reply@ecommerce.local>',
      to,
      subject: 'Account registration verification code',
      html: `
        <p>Your verification code is:</p>
        <h2 style="letter-spacing: 4px">${otp}</h2>
        <p>The code is valid for 5 minutes</b>. Do not share this code with anyone.</p>
        <p>If you do not register, please ignore this email..</p>`,
    })
    logger.info('OTP mail sent', { to })
  }

  static async sendResetPasswordOtpMail(to: string, otp: string) {
    await transporter.sendMail({
      from: config.mailer.from ?? '"Ecommerce" <no-reply@ecommerce.local>',
      to,
      subject: 'Password reset code',
      html: `
        <p>Your password reset code is:</p>
        <h2 style="letter-spacing: 4px">${otp}</h2>
        <p>The code is valid for 5 minutes. Do not share this code with anyone.</p>
        <p><b>If you did not ask to reset your password, you can ignore this
        email — your account is safe and your password has not changed.</b></p>`,
    })
    logger.info('Reset password OTP mail sent', { to })
  }

  // Sent AFTER a successful reset. This is the last safety net: if the person
  // reading it did not just reset their password, they learn their account is
  // compromised while they can still act on it.
  static async sendPasswordChangedMail(to: string) {
    await transporter.sendMail({
      from: config.mailer.from ?? '"Ecommerce" <no-reply@ecommerce.local>',
      to,
      subject: 'Your password was changed',
      html: `
        <p>Your account password was just reset. All devices have been signed out.</p>
        <p>If this <b>was not you</b>, reset your password again immediately and
        contact support.</p>`,
    })
    logger.info('Password changed notification sent', { to })
  }
}

export default EmailService
