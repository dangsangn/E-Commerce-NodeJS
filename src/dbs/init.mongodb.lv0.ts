import mongoose from 'mongoose'

const connectString = `mongodb://localhost:27017/ecommerce_db`

mongoose
  .connect(connectString)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.log(err))

// dev
if (process.env.NODE_ENV !== 'production') {
  mongoose.set('debug', true)
  mongoose.set('debug', { color: true })
}

export default mongoose
