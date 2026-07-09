import config from '.'

export const mailerConfig = {
  from: config.mailer.from,
  host: config.mailer.host,
  port: config.mailer.port,
  secure: config.mailer.secure,
  user: config.mailer.user,
  pass: config.mailer.pass,
}
