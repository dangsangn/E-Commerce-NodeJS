import { BadRequestError } from '@/core/error.response'

const SIGNATURES: {
  mine: string
  bytes: number[]
}[] = [
  {
    mine: 'image/jpeg',
    bytes: [0xff, 0xd8, 0xff],
  },
  {
    mine: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47],
  },
  {
    mine: 'image/gif',
    bytes: [0x47, 0x49, 0x46, 0x38],
  },
  {
    mine: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
  },
]

export const validateImageBuffer = (buffer: Buffer): string => {
  const matched = SIGNATURES.find((signature) => {
    return signature.bytes.every((byte, index) => buffer[index] === byte)
  })
  if (!matched) {
    throw new BadRequestError('Invalid image file')
  }
  return matched.mine
}
