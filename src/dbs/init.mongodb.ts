import mongoose from 'mongoose'

const connectString = `mongodb+srv://dangsangnguyen260399_db_user:c03jDgEGgHLQeq77@cluster0.2p8zr1t.mongodb.net/`

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
