import pick from 'lodash/pick'

export const getInfoData = ({
  fields = [] as string[],
  object = {},
}: {
  fields: string[]
  object: any
}) => {
  return pick(object, fields)
}
