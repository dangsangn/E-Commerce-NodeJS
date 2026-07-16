import { BadRequestError } from '@/core/error.response'

type Pattern = {
  offset: number
  bytes: number[]
}

const SIGNATURES: {
  mine: string
  patterns: Pattern[]
}[] = [
  {
    mine: 'image/jpeg',
    patterns: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    mine: 'image/png',
    patterns: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }],
  },
  {
    mine: 'image/gif',
    patterns: [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }],
  },
  {
    // RIFF....WEBP — "RIFF" at offset 0, "WEBP" at offset 8
    mine: 'image/webp',
    patterns: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  },
  {
    // ISO-BMFF: 4-byte box size, then "ftyp" at offset 4, then "avif" brand at offset 8
    mine: 'image/avif',
    patterns: [
      { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
      { offset: 8, bytes: [0x61, 0x76, 0x69, 0x66] },
    ],
  },
]

export const validateImageBuffer = (buffer: Buffer): string => {
  const matched = SIGNATURES.find((signature) => {
    return signature.patterns.every((pattern) =>
      pattern.bytes.every((byte, index) => buffer[pattern.offset + index] === byte)
    )
  })
  if (!matched) {
    throw new BadRequestError('Invalid image file')
  }
  return matched.mine
}
