var understudy = require("understudy")
var hook = require("./hook")
var registry = require("./registry")
var delegate = require("./delegate")

registry.set("*", Component)

module.exports = Component

function Component (rootComponentName, root) {
  if (!(this instanceof Component)) {
    return new Component(rootComponentName, root)
  }

  this.element = null
  this.components = {}

  if (typeof rootComponentName == "string") {
    this.element = hook.findComponent(rootComponentName, root)
  }
  else if (rootComponentName instanceof Element) {
    this.element = rootComponentName
    rootComponentName = this.getMainComponentValue()
  }

  if (rootComponentName && this.element && this.autoAssign) {
    this.assignSubComponents()
  }
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
  getComponentValue: function (cc) {
    return hook.getComponentName(this.element, cc)
  },
  getMainComponentValue: function (cc) {
    return hook.getMainComponentName(this.element, cc)
  },
  getSubComponentValue: function (cc) {
    return hook.getSubComponentName(this.element, cc)
  },
  assignSubComponents: function (transform) {
    var hostComponent = this

    hostComponent.perform("assignSubComponents", hostComponent, function () {
      hook.assignSubComponents(hostComponent.components, hostComponent.getMainComponentValue(), this.element, transform || function (element, name) {
        var CustomComponent = registry.exists(name)
            ? registry.get(name)
            : registry.get("*") === Component
              ? null // not a custom component
              : registry.get("*")

        element = CustomComponent
          // instantiate custom components with host as first argument
            ? new CustomComponent(hostComponent, element)
            : new Component(element)

        return element
      })
    })
  }
}

understudy.call(Component.prototype)
