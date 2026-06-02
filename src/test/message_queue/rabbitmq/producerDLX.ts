import amqp from 'amqplib'

// override console.log to include timestamp
const log = console.log
console.log = (...args) => {
  const timestamp = new Date().toISOString()
  log.bind(console)(`[${timestamp}]`, ...args)
}

const runProducer = async () => {
  try {
    const connection = await amqp.connect('amqp://guest:guest@localhost:5672')
    const channel = await connection.createChannel()

    const notificationExchange = 'notification_exchange'
    const notificationQueue = 'notification_queue'
    const notificationRoutingKey = 'notification_routing_key'

    const notificationExchangeDLX = 'notification_exchange_dlx'
    const notificationQueueDLX = 'notification_queue_dlx'
    const notificationRoutingKeyDLX = 'notification_routing_key_dlx'

    // 1. create exchange
    await channel.assertExchange(notificationExchange, 'direct', {
      durable: true,
    })

    // DLX exchange
    await channel.assertExchange(notificationExchangeDLX, 'direct', {
      durable: true,
    })

    // 2.create queue
    await channel.assertQueue(notificationQueue, {
      durable: true,
      exclusive: false, // allow multiple consumers
      deadLetterExchange: notificationExchangeDLX, // specify DLX for failed messages
      deadLetterRoutingKey: notificationRoutingKeyDLX, // specify routing key for DLX
    })

    await channel.assertQueue(notificationQueueDLX, {
      durable: true,
      exclusive: false,
    })

    // 3. bind queue to exchange
    await channel.bindQueue(
      notificationQueue,
      notificationExchange,
      notificationRoutingKey,
    )

    await channel.bindQueue(
      notificationQueueDLX,
      notificationExchangeDLX,
      notificationRoutingKeyDLX,
    )

    // 4. send message to exchange with routing key
    const payload = {
      message: 'A new user has registered',
      timestamp: new Date().toISOString(),
    }
    const message = JSON.stringify(payload)
    log('Sending message:', message)
    channel.publish(
      notificationExchange,
      notificationRoutingKey,
      Buffer.from(message),
      {
        expiration: '10000', // message expires after 10 seconds
      },
    )

    // close connection after a short delay to ensure message is sent
    setTimeout(() => {
      connection.close()
    }, 500)
  } catch (error) {
    log('Error in producer:', error)
  }
}

runProducer().catch(log)
