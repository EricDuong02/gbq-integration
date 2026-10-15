export const extractIdFromGid = (gid: string) => {
  return gid.split('/').pop()!
}
