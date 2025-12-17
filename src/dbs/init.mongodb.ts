import mongoose from 'mongoose'
import config from '../configs'

const connectString = config.dbUrl
// singleton pattern
class Database {
  constructor() {
    this.connect()
  }

  connect() {
    if (process.env.NODE_ENV !== 'production') {
      mongoose.set('debug', true)
      mongoose.set('debug', { color: true })
    }

    mongoose
      .connect(connectString)
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.log(err))
  }

  private static _instance: Database

  static getInstance(): Database {
    if (!Database._instance) {
      Database._instance = new Database()
    }
    return Database._instance
  }

  close() {
    mongoose.connection.close()
  }
}

const instanceMongoDB = Database.getInstance()

export default instanceMongoDB
