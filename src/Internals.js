var camelcase = require("camelcase")
var extend = require("../util/extend")
var merge = require("../util/merge")
var object = require("../util/object")
var delegate = require("./delegate")
var storage = require("./storage")
var hook = require("./hook")

var defaultEventDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = Internals

function Internals (master, name) {
  this.name = name
  this.autoAssign = true
  this.autoSave = true
  this.components = {}
  this._events = {}
  this._constructors = []
  this._attributes = {}
  this._actions = []

  Object.defineProperty(this, "_masterConstructor", {
    get: function () {
      return master
    }
  })
  Object.defineProperty(this, "_master", {
    get: function () {
      return master.prototype
    }
  })
}

Internals.prototype.extend = function (ComponentConstructor) {
  this._masterConstructor.prototype = Object.create(ComponentConstructor.prototype)
  this._masterConstructor.prototype.constructor = this._masterConstructor
  var internals = ComponentConstructor.internals
  this._masterConstructor.prototype.internals = this
  this._masterConstructor.internals = this
  if (internals) {
    this.autoAssign = internals.autoAssign
    extend(this.components, internals.components)
    extend(this._events, internals._events)
    this._constructors = this._constructors.concat(internals._constructors)
    extend(this._attributes, internals._attributes)
    internals._actions.forEach(function (args) {
      var event = args[0]
      var matches = args[1]
      var matcher = this.action.call(this, event)
      matches.forEach(function (args) {
        matcher.match.apply(matcher, args)
      })
    }, this)
  }
}

Internals.prototype.onCreate = function (constructor) {
  this._constructors.push(constructor)
  return this
}

Internals.prototype.create = function (instance, args) {
  this._constructors.forEach(function (constructor) {
    constructor.apply(instance, args)
  })
}

Internals.prototype.method = function (name, fn) {
  object.method(this._master, name, fn)
  return this
}

Internals.prototype.property = function (name, fn) {
  object.property(this._master, name, fn)
  return this
}

Internals.prototype.get = function (name, fn) {
  object.defineGetter(this._master, name, fn)
  return this
}

Internals.prototype.set = function (name, fn) {
  object.defineGetter(this._master, name, fn)
  return this
}

Internals.prototype.accessor = function (name, get, set) {
  object.accessor(this._master, name, get, set)
  return this
}

Internals.prototype.proto = function (prototype) {
  for (var prop in prototype) {
    if (prototype.hasOwnProperty(prop)) {
      if (typeof prototype[prop] == "function") {
        if (prop === "onCreate") {
          this.onCreate(prototype[prop])
        }
        else {
          this.method(prop, prototype[prop])
        }
      }
      else {
        this.property(prop, prototype[prop])
      }
    }
  }
  return this
}

Internals.prototype.action = function action(event) {
  var internals = this
  var attributeName = internals.name
  var matcher = {}
  var matches = []
  var delegator = delegate({element: document.body, event: event})

  internals._actions.push([event, matches])

  matcher.match = function (components, cb) {
    matches.push([components, cb])

    if (!cb) {
      cb = components
      components = []
    }

    if (typeof components == "string") {
      components = [components]
    }

    var selectors = components.map(function (component) {
      if (component[0] == ":") {
        component = attributeName+component
      }
      return hook.selector(component, "~=")
    })
    selectors.unshift(hook.selector(attributeName, "~="))

    delegator.match(selectors, function (e, main) {
      var instance = storage.get(main, internals.name) || main
      var args = [e];

      [].slice.call(arguments, 2).forEach(function (element, i) {
        var name = components[i]
        name = name[0] == ":" ? name.substr(1) : name
        var propertyName = camelcase(name)
        var arg

        if (instance.components.hasOwnProperty(propertyName)) {
          arg = instance.components[propertyName]
          if (Array.isArray(arg)) {
            arg.some(function (member) {
              if (member == element || member.element == element) {
                arg = member
                return true
              }
              return false
            })
          }
        }
        else {
          arg = storage.get(element, name) || element
        }

        args.push(arg)
      })

      return cb.apply(instance, args)
    })

    return matcher
  }

  return matcher
}

Internals.prototype.event = function (type, definition) {
  this._events[type] = definition
  return this
}

Internals.prototype.getEventDefinition = function (type, detail) {
  var definition = merge(defaultEventDefinition, this._events[type])
  definition.detail = typeof detail == "undefined" ? definition.detail : detail
  return definition
}

Internals.prototype.resetAttributes = function (instance) {
  if (!instance.element) return

  var attribute
  var value
  for (var name in this._attributes) {
    if (this._attributes.hasOwnProperty(name)) {
      attribute = this._attributes[name]
      value = attribute.get.call(instance, false)
      if (attribute.hasDefault && !attribute.has.call(instance, value)) {
        attribute.set.call(instance, attribute.defaultValue, false)
      }
    }
  }
}

Internals.prototype.attribute = function (name, def) {
  var master = this._master
  if (!master) {
    return this
  }

  if (def == null) {
    def = {}
  }

  var typeOfDef = typeof def
  var type
  var defaultValue
  var getter
  var setter
  var onchange
  var property = camelcase(name)

  switch (typeOfDef) {
    case "boolean":
    case "number":
    case "string":
      // the definition is a primitive value
      type = typeOfDef
      defaultValue = def
      break
    case "object":
    default:
      // or a definition object
      defaultValue = typeof def["default"] == "undefined" ? null : def["default"]
      if (typeof def["type"] == "undefined") {
        if (defaultValue == null) {
          type = "string"
        }
        else {
          type = typeof defaultValue
        }
      }
      else {
        type = def["type"]
      }
      getter = def["get"]
      setter = def["set"]
      onchange = def["onchange"]
  }

  var parseValue
  var stringifyValue
  var has

  has = function (value) { return value != null }

  switch (type) {
    case "boolean":
      has = function (value) { return value !== false }
      parseValue = function (value) { return value != null }
      stringifyValue = function () { return "" }
      break
    case "number":
      parseValue = function (value) { return value == null ? null : parseInt(value, 10) }
      break
    case "float":
      parseValue = function (value) { return value == null ? null : parseFloat(value) }
      break
    case "string":
    default:
      stringifyValue = function (value) { return value == null ? null : value ? ""+value : "" }
  }

  this._attributes[property] = {
    get: get,
    set: set,
    has: has,
    defaultValue: defaultValue,
    hasDefault: defaultValue != null
  }

  function get(useDefault) {
    var value = this.element.getAttribute(name)
    if (value == null && useDefault == true) {
      return defaultValue
    }
    return parseValue ? parseValue(value) : value
  }

  function set(value, callOnchange) {
    var old = get.call(this, false)
    if (!has(value)) {
      this.element.removeAttribute(name)
    }
    else if (old === value) {
      return
    }
    else {
      var newValue = stringifyValue ? stringifyValue(value) : value
      this.element.setAttribute(name, newValue)
    }
    onchange && callOnchange != false && onchange.call(this, old, value)
  }

  Object.defineProperty(master, property, {
    get: getter || get,
    set: setter || set
  })

  return this
}
