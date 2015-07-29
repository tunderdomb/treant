var Component = require("./Component")

var registry = module.exports = {}

var components = {
  "*": Component
}

registry.get = function exists (name) {
  return components[name]
}

registry.exists = function exists (name) {
  return !!components[name]
}

registry.add = function exists (name, ComponentConstructor) {
  return components[name] = ComponentConstructor
}

registry.register = function register (name, mixin, ComponentConstructor) {
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

  return components[name] = CustomComponent
  // define main prototype after registering
}
