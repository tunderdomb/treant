var object = require("../util/object")

module.exports = function () {
  return function plugin (prototype) {

    object.method(prototype, "defineAttribute", function (name, def) {
      def = def || {}
      var type
      var parseValue
      var stringifyValue
      var shouldRemove
      var getter
      var setter

      shouldRemove = function (value) {
        return value === null
      }

      type = def.type
      getter = def.get
      setter = def.set

      switch (type) {
        case "boolean":
          shouldRemove = function (value) {
            return value === false
          }
          parseValue = function (value) {
            return !!value
          }
          stringifyValue = function () {
            return ""
          }
          break
        case "number":
          parseValue = function (value) {
            return parseInt(value, 10)
          }
          break
        case "float":
          parseValue = function (value) {
            return parseFloat(value)
          }
          break
        case "string":
        default:
          stringifyValue = function (value) {
            return value ? ""+value : ""
          }
      }

      Object.defineProperty(prototype, name, {
        get: getter || function () {
          var value = this.element.getAttribute(name)
          return parseValue ? parseValue(value) : value
        },
        set: setter || function (value) {
          if (shouldRemove(value)) {
            this.element.removeAttribute(name)
          }
          else {
            value = stringifyValue ? stringifyValue(value) : stringifyValue
            this.element.setAttribute(name, value)
          }
        }
      })
    })
  }
}
