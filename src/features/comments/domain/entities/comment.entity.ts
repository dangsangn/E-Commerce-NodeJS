// Định nghĩa Comment Entity thuần túy
export interface CommentEntity {
  id?: string
  productId: string
  userId: string
  content: string
  parentId: string | null
  replyToUserId: string | null
  replyToUser?: {
    name: string
    email: string
  }
  user?: {
    name: string
    email: string
  }
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}
