var merge = require("../util/merge")

var defaultEventDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = Internals

function Internals (master) {
  this.autoAssign = true
  this.convertSubComponents = false
  this.components = {}
  this._events = {}

  Object.defineProperty(this, "_master", {
    get: function () {
      return master
    }
  })
}

Internals.prototype.defineEvent = function (type, definition) {
  this._events[type] = definition
}

Internals.prototype.getEventDefinition = function (type, detail) {
  var definition = merge(defaultEventDefinition, this._events[type])
  definition.detail = typeof detail == "undefined" ? definition.detail : detail
  return definition
}

Internals.prototype.defineAttribute = function (name, def) {
  var master = this._master
  if (!master) {
    return
  }

  if (def == null) {
    def = {}
  }

  var typeOfDef = typeof def
  var type
  var defaultValue
  var getter
  var setter

  switch (typeOfDef) {
    case "boolean":
    case "number":
    case "string":
      // the definition is a primitive value
      type = typeOfDef
      defaultValue = def
      break
    case "object":
    default:
      // or a definition object
      defaultValue = typeof def["default"] == "undefined" ? null : def["default"]
      if (typeof def["type"] == "undefined") {
        if (defaultValue == null) {
          type = "string"
        }
        else {
          type = typeof defaultValue
        }
      }
      else {
        type = def["type"]
      }
      getter = def["get"]
      setter = def["set"]
  }

  var parseValue
  var stringifyValue
  var shouldRemove

  shouldRemove = function (value) { return value == null }

  switch (type) {
    case "boolean":
      shouldRemove = function (value) { return value === false }
      parseValue = function (value) { return value != null }
      stringifyValue = function (value) { return "" }
      break
    case "number":
      parseValue = function (value) { return parseInt(value, 10) }
      break
    case "float":
      parseValue = function (value) { return parseFloat(value) }
      break
    case "string":
    default:
      stringifyValue = function (value) { return value ? ""+value : "" }
  }

  Object.defineProperty(master, name, {
    get: getter || function () {
      var value = this.element.getAttribute(name)
      if (value == null) {
        return defaultValue
      }
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
}
