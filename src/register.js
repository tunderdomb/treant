var registry = require("./registry")
var Component = require("./Component")

module.exports = function register (name, mixin, ComponentConstructor) {
  if (!ComponentConstructor) {
    ComponentConstructor = mixin
    mixin = []
  }
  else {
    // functions in-between are mixin
    mixin = [].slice.call(arguments, 1, -1)
    // main constructor is always last argument
    ComponentConstructor = [].slice.call(arguments, -1)[0]
  }

  if (!ComponentConstructor) {
    ComponentConstructor = function () {}
  }

  function CustomComponent (element, options) {
    if (!(this instanceof CustomComponent)) {
      return new CustomComponent(element, options)
    }

    var instance = this
    instance.perform("create", instance, function () {
      Component.call(instance, element, options)
      // at this point custom constructors can already access the element
      // so they only receive the options object for convenience
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
