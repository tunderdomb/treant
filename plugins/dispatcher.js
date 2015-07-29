var object = require("../util/object")
var merge = require("../util/merge")

var defaultDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = function (eventDefinitions) {
  return function plugin(prototype) {
    var definitions = eventDefinitions || {}

    object.method(prototype, "defineEvent", function (type, definition) {
      definitions[type] = definition
    })

    object.method(prototype, "dispatch", function (type, detail) {
      var definition = merge(defaultDefinition, definitions[type])
      definition.detail = detail || definition.detail
      return this.dispatchEvent(new window.CustomEvent(type, definition))
    })
  }
}
