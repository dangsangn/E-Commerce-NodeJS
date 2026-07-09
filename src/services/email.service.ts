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
}

export default EmailService
