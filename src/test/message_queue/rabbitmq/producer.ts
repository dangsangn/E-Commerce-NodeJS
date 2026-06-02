import * as amqp from 'amqplib'

async function sendMessage() {
  const queue = 'hello'

  const connection = await amqp.connect('amqp://guest:guest@localhost:5672')
  const channel = await connection.createChannel()

  await channel.assertQueue(queue, { durable: true })

  const msg = 'Hello RabbitMQ!'
  channel.sendToQueue(queue, Buffer.from(msg), {
    persistent: true,
  })

  console.log('Sent:', msg)

  setTimeout(() => {
    connection.close()
  }, 500)
}

sendMessage().catch(console.error)
