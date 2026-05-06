import * as amqp from 'amqplib'

async function receiveMessage() {
  const queue = 'hello'

  const connection = await amqp.connect('amqp://myuser:mypassword@localhost')
  const channel = await connection.createChannel()

  await channel.assertQueue(queue, { durable: true })

  console.log('Waiting for messages...')

  channel.consume(
    queue,
    (msg: amqp.ConsumeMessage | null) => {
      if (!msg) return
      console.log('Received:', msg.content.toString())
    },
    {
      noAck: true,
    },
  )
}

receiveMessage()
