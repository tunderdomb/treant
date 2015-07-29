var registry = require("./registry")
var Component = require("./Component")


module.exports = function register (name, mixin, ComponentConstructor) {
  // main constructor is always last argument
  ComponentConstructor = [].slice.call(arguments, -1)[0]
  // functions in-between are mixin
  mixin = [].slice.call(arguments, 1, -1)

  function CustomComponent (options, rootComponentName, root) {
    rootComponentName = rootComponentName || name
    Component.call(this, rootComponentName, root)
    ComponentConstructor.call(this, options)
  }

  CustomComponent.prototype = new Component()
  mixin.forEach(function (mixin) {
    mixin.call(CustomComponent.prototype)
  })

  return registry.add(name, CustomComponent)
  // define main prototype after registering
}
