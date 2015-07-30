var understudy = require("understudy")
var hook = require("./hook")
var registry = require("./registry")
var delegate = require("./delegate")

module.exports = Component

function Component (element, options) {
  if (!(this instanceof Component)) {
    return new Component(element, options)
  }

  this.element = element || null
  this.components = {}

  if (this.element && this.autoAssign) {
    this.assignSubComponents()
  }
}

Component.create = function (element, options) {
  var name = hook.getComponentName(element, false)
  var ComponentConstructor = null

  if (registry.exists(name)) {
    ComponentConstructor =  registry.get(name)
  }
  else {
    console.warn("Missing custom component '%s' for ", name, element)
    ComponentConstructor = registry.get("*") || Component
  }

  return new ComponentConstructor(element, options)
}

Component.prototype = {
  autoAssign: true,

  delegate: function (options) {
    options.element = this.element
    options.context = options.context || this
    return delegate(options)
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
    var subComponents = hook.findSubComponents(hostComponent.getMainComponentName(false), hostComponent.element)

    if (!subComponents.length) {
      return
    }

    hostComponent.perform("assignSubComponents", hostComponent, function () {
      hook.assignSubComponents(hostComponent.components, subComponents, transform || function (element, name) {
        return Component.create(element, hostComponent)
      })
    })
  }
}

understudy.call(Component.prototype)
