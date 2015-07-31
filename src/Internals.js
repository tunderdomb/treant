var merge = require("../util/merge")

var defaultEventDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = Internals

function Internals () {
  this.autoAssign = true
  this.convertSubComponents = false
  this.components = {}
  this._events = {}
}

Internals.prototype.defineEvent = function (type, definition) {
  this._events[type] = definition
}

Internals.prototype.getEventDefinition = function (type, detail) {
  var definition = merge(defaultEventDefinition, this._events[type])
  definition.detail = typeof detail == "undefined" ? definition.detail : detail
  return definition
}
