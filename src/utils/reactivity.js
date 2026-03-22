export const detachReactivity = (item) => {
  return JSON.parse(JSON.stringify(item))
}