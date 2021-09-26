export const isEmptyObject = obj => JSON.stringify(obj) === "{}";
export function isObject(obj) {
  return Object.prototype.toString.call(obj) === "[object Object]";
}
