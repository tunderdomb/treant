var registry = require("./registry")
var Component = require("./Component")

module.exports = function register (name, mixin, ComponentConstructor) {
  // main constructor is always last argument
  ComponentConstructor = [].slice.call(arguments, -1)[0]
  // functions in-between are mixin
  mixin = [].slice.call(arguments, 1, -1)

  function CustomComponent (options, rootComponentName, root) {
    if (!(this instanceof CustomComponent)) {
      return new CustomComponent(options, rootComponentName, root)
    }

    rootComponentName = rootComponentName || name
    var instance = this
    instance.perform("create", instance, function () {
      Component.call(instance, rootComponentName, root)
      ComponentConstructor.call(instance, options)
    })
  }

  CustomComponent.prototype = new Component()
  mixin.forEach(function (mixin) {
    mixin(CustomComponent.prototype)
  })

  return registry.set(name, CustomComponent)
  // define main prototype after registering
}
