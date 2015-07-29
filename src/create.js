var Component = require("./Component")
var hook = require("./hook")
var registry = require("./registry")

module.exports = component

function component (rootComponentName, root) {
  if (typeof rootComponentName != "string") {
    rootComponentName = hook.getMainComponentName(rootComponentName)
  }
  var ComponentConstructor = registry.exists(rootComponentName)
    ? registry.get(rootComponentName)
    : Component

  return new ComponentConstructor(rootComponentName, root)
}
