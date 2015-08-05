var hook = require("./hook")
var registry = require("./registry")
var delegate = require("./delegate")
var Internals = require("./Internals")

module.exports = Component

function Component (element, options) {
  if (element && !(element instanceof Element)) {
    throw new Error("element should be an Element instance or null")
  }
  if (!(this instanceof Component)) {
    return new Component(element, options)
  }

  this.element = element || null
  this.components = {}

  if (this.element && this.internals.autoAssign) {
    this.assignSubComponents()
  }

  if (this.element) {
    this.internals.resetAttributes(this)
  }
}

Component.create = function (element, options) {
  var name = hook.getComponentName(element, false)

  if (!name) {
    console.warn("Unable to create component, this element doesn't have a component attribute", element)
    return null
  }

  var ComponentConstructor = null

  if (registry.exists(name)) {
    ComponentConstructor =  registry.get(name)
  }
  else if (registry.exists("*")) {
    ComponentConstructor = registry.get("*")
  }
  else {
    console.warn("Missing custom component '%s' for ", name, element,
        ' Use the Component constructor to create raw components or register a "*" component.')
    ComponentConstructor = Component
  }

  return new ComponentConstructor(element, options)
}

Component.prototype = {
  internals: new Internals(),

  delegate: function (options) {
    options.element = this.element
    options.context = options.context || this
    return delegate(options)
  },

  dispatch: function (type, detail) {
    var definition = this.internals.getEventDefinition(type, detail)
    return this.element.dispatchEvent(new window.CustomEvent(type, definition))
  },

  findComponent: function (name) {
    return hook.findComponent(name, this.element)
  },
  findAllComponent: function (name) {
    return hook.findAllComponent(name, this.element)
  },
  findSubComponents: function (name) {
    return hook.findSubComponents(name, this.element)
  },
  getComponentName: function (cc) {
    return hook.getComponentName(this.element, cc)
  },
  getMainComponentName: function (cc) {
    return hook.getMainComponentName(this.element, cc)
  },
  getSubComponentName: function (cc) {
    return hook.getSubComponentName(this.element, cc)
  },
  clearSubComponents: function () {
    this.components = {}
  },
  assignSubComponents: function (transform) {
    var hostComponent = this
    var subComponents = hook.findSubComponents(this.getMainComponentName(false), this.element)
    var internals = this.internals

    for (var name in internals.components) {
      if (internals.components.hasOwnProperty(name)) {
        if (Array.isArray(internals.components[name])) {
          this.components[name] = []
        }
        else {
          this.components[name] = internals.components[name]
        }
      }
    }

    if (!subComponents.length) {
      return
    }

    if (this.internals.convertSubComponents && (typeof transform == "undefined" || transform === true)) {
      transform = function (element/*, name*/) {
        return Component.create(element, hostComponent)
      }
    }

    hook.assignSubComponents(this.components, subComponents, transform, function (components, name, element) {
      if (Array.isArray(internals.components[name])) {
        components[name] = components[name] || []
        components[name].push(element)
      }
      else {
        components[name] = element
      }
    })
  }
}
