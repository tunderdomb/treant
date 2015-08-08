var hook = require("./hook")
var registry = require("./registry")
var storage = require("./storage")
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

  this._element = null
  this._id = null
  this.element = element || null
  this.components = {}

  this.initialize()
}

Component.create = function (name, element, options) {
  var ComponentConstructor = null

  if (registry.exists(name)) {
    ComponentConstructor = registry.get(name)
  }
  else {
    console.warn("Missing component definition: ", name)
    return null
  }

  return new ComponentConstructor(element, options)
}

Component.prototype = {
  internals: new Internals(),

  initialize: function () {
    if (!this.element) return

    if (this.internals.autoAssign) {
      this.assignSubComponents()
    }
    this.internals.resetAttributes(this)
  },
  destroy: function () {
    storage.remove(this)
    this.element = null

    var components = this.components
    var component
    for (var name in components) {
      if (components.hasOwnProperty(name)) {
        component = components[name]
        if (component.destroy) {
          component.destroy()
        }
      }
    }
    this.components = null
  },

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
  findAllComponents: function (name) {
    return hook.findAllComponents(name, this.element)
  },
  findSubComponents: function () {
    return hook.findSubComponents(this.getMainComponentName(false), this.element)
  },
  getComponentName: function (cc) {
    return hook.getComponentName(this.internals.name, cc)
  },
  getMainComponentName: function (cc) {
    return hook.getMainComponentName(this.internals.name, cc)
  },
  getSubComponentName: function (cc) {
    return hook.getSubComponentName(this.internals.name, cc)
  },

  clearSubComponents: function () {
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
  },
  assignSubComponents: function (transform) {
    if (!this.element) return

    var hostComponent = this
    var subComponents = this.findSubComponents()
    var internals = this.internals

    this.clearSubComponents()

    if (!subComponents.length) {
      return
    }

    if (typeof transform == "undefined" || transform === true) {
      transform = function (element, name) {
        return registry.exists(name)
            ? Component.create(name, element, hostComponent)
            : element
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

Object.defineProperty(Component.prototype, "element", {
  get: function () {
    return this._element
  },
  set: function (element) {
    this._element = element
    if (element && this.internals.name && this.internals.autoSave) {
      storage.save(this)
    }
  }
})
