var registry = require("./registry")
var Component = require("./Component")
var Internals = require("./Internals")

module.exports = function register (name, mixin) {
  mixin = [].slice.call(arguments, 1)

  function CustomComponent (element, options) {
    if (!(this instanceof CustomComponent)) {
      return new CustomComponent(element, options)
    }
    var instance = this

    Component.call(instance, element, options)
    // at this point custom constructors can already access the element and sub components
    // so they only receive the options object for convenience
    internals.create(instance, [options])
  }

  var internals = new Internals(CustomComponent, name)
  internals.extend(Component)
  internals.autoAssign = true
  mixin.forEach(function (mixin) {
    if (typeof mixin == "function") {
      mixin.call(CustomComponent.prototype, internals)
    }
    else {
      internals.proto(mixin)
    }
  })

  return registry.set(name, CustomComponent)
}
