import { pubClient, subClient } from '../utils/redis.util'

class PubSubService {
  async publish(channel: string, message: any) {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message)
    await pubClient.publish(channel, payload)
    console.log(`[Pub] Publish message ${payload} to chanel ${channel}`)
  }

  async subscribe(channel: string, callback: (message: string) => void) {
    await subClient.subscribe(channel, (message: string) => {
      console.log(`[Sub] Receive message ${message} from chanel ${channel}`)
      callback(message)
    })
    console.log(`[Sub] Subscribed to chanel: ${channel}`)
  }
}

export default new PubSubService()
