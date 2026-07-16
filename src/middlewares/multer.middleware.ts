import { ALLOWED_MINE, MAX_FILE_SIZE, MAX_FILES } from '@/constants/common'
import { Request } from 'express'
import multer from 'multer'

// memoryStorage: files are stored in RAM as a buffer, NOT written to disk.
// Suitable because we stream directly to Cloudinary.
const storage = multer.memoryStorage()

const fileFilter: multer.Options['fileFilter'] = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  console.log('🚀 ~ file:', file)
  if (!ALLOWED_MINE.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only images are allowed.'))
  }
  cb(null, true)
}

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
})
