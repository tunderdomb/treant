(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.treant = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var hook = require("./src/hook")
var register = require("./src/register")
var component = require("./src/create")
var storage = require("./src/storage")
var Component = require("./src/Component")
var delegate = require("./src/delegate")
var fragment = require("./src/fragment")

var treant = {}
module.exports = treant

treant.register = register
treant.component = component
treant.storage = storage
treant.Component = Component
treant.delegate = delegate
treant.fragment = fragment
treant.hook = hook

var util = {}
treant.util = util

util.extend = require("./util/extend")
util.merge = require("./util/merge")
util.object = require("./util/object")

},{"./src/Component":3,"./src/create":5,"./src/delegate":6,"./src/fragment":7,"./src/hook":8,"./src/register":9,"./src/storage":11,"./util/extend":12,"./util/merge":13,"./util/object":14}],2:[function(require,module,exports){
'use strict';
module.exports = function (str) {
	str = str.trim();

	if (str.length === 1 || !(/[_.\- ]+/).test(str) ) {
		if (str[0] === str[0].toLowerCase() && str.slice(1) !== str.slice(1).toLowerCase()) {
			return str;
		}

		return str.toLowerCase();
	}

	return str
	.replace(/^[_.\- ]+/, '')
	.toLowerCase()
	.replace(/[_.\- ]+(\w|$)/g, function (m, p1) {
		return p1.toUpperCase();
	});
};

},{}],3:[function(require,module,exports){
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
            ? Component.create(element, hostComponent)
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

},{"./Internals":4,"./delegate":6,"./hook":8,"./registry":10}],4:[function(require,module,exports){
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
      return hook.createComponentSelector(component, "~=")
    })
    selectors.unshift(hook.createComponentSelector(attributeName, "~="))

    delegator.match(selectors, function (e, main) {
      var instance = storage.get(main) || main
      var args = [e];

      [].slice.call(arguments, 2).forEach(function (element, i) {
        var name = components[i]
        name = name[0] == ":" ? name.substr(1) : name
        name = camelcase(name)
        var arg

        if (instance.components.hasOwnProperty(name)) {
          arg = instance.components[name]
          if (Array.isArray(arg)) {
            arg.some(function (member) {
              if (member == element || member.element == member) {
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

},{"../util/extend":12,"../util/merge":13,"../util/object":14,"./delegate":6,"./hook":8,"./storage":11,"camelcase":2}],5:[function(require,module,exports){
var Component = require("./Component")
var hook = require("./hook")

module.exports = component

function component (name, root, options) {
  // component("string"[, {}])
  if (!(root instanceof Element)) {
    options = root
    root = null
  }
  var element = hook.findComponent(name, root)

  return Component.create(name, element, options)
}

component.all = function (name, root, options) {
  // component("string"[, {}])
  if (!(root instanceof Element)) {
    options = root
    root = null
  }
  // component("string"[, Element])
  var elements = hook.findAllComponent(name, root)

  return [].map.call(elements, function (element) {
    return Component.create(name, element, options)
  })
}

},{"./Component":3,"./hook":8}],6:[function(require,module,exports){
/**
 * Registers an event listener on an element
 * and returns a delegator.
 * A delegated event runs matches to find an event target,
 * then executes the handler paired with the matcher.
 * Matchers can check if an event target matches a given selector,
 * or see if an of its parents do.
 * */
module.exports = function delegate( options ){
    var element = options.element
        , event = options.event
        , capture = !!options.capture||false
        , context = options.context||element

    if( !element ){
        console.log("Can't delegate undefined element")
        return null
    }
    if( !event ){
        console.log("Can't delegate undefined event")
        return null
    }

    var delegator = createDelegator(context)
    element.addEventListener(event, delegator, capture)

    return delegator
}

/**
 * Returns a delegator that can be used as an event listener.
 * The delegator has static methods which can be used to register handlers.
 * */
function createDelegator( context ){
    var matchers = []

    function delegator( e ){
        var l = matchers.length
        if( !l ){
            return true
        }

        var el = this
            , i = -1
            , handler
            , selector
            , delegateElement
            , stopPropagation
            , args

        while( ++i < l ){
            args = matchers[i]
            handler = args[0]
            selector = args[1]

            delegateElement = matchCapturePath(selector, el, e)
            if( delegateElement && delegateElement.length ) {
                stopPropagation = false === handler.apply(context, [e].concat(delegateElement))
                if( stopPropagation ) {
                    return false
                }
            }
        }

        return true
    }

    /**
     * Registers a handler with a target finder logic
     * */
    delegator.match = function( selector, handler ){
        matchers.push([handler, selector])
        return delegator
    }

    return delegator
}

function matchCapturePath( selector, el, e ){
    var delegateElements = []
    var delegateElement = null
    if( Array.isArray(selector) ){
        var i = -1
        var l = selector.length
        while( ++i < l ){
            delegateElement = findParent(selector[i], el, e)
            if( !delegateElement ) return null
            delegateElements.push(delegateElement)
        }
    }
    else {
        delegateElement = findParent(selector, el, e)
        if( !delegateElement ) return null
        delegateElements.push(delegateElement)
    }
    return delegateElements
}

/**
 * Check if the target or any of its parent matches a selector
 * */
function findParent( selector, el, e ){
    var target = e.target
    switch( typeof selector ){
        case "string":
            while( target && target != el ){
                if( target.matches(selector) ) return target
                target = target.parentNode
            }
            break
        case "function":
            while( target && target != el ){
                if( selector.call(el, target) ) return target
                target = target.parentNode
            }
            break
        default:
            return null
    }
    return null
}

},{}],7:[function(require,module,exports){
var merge = require("../util/merge")

module.exports = fragment

fragment.options = {
  variable: "f"
}

function fragment( html, compiler, compilerOptions ){
  compilerOptions = merge(fragment.options, compilerOptions)
  var render = null
  return function( templateData ){
    var temp = window.document.createElement("div")
    if( typeof compiler == "function" && !render ){
      render = compiler(html, compilerOptions)
    }
    if( render ){
      try{
        html = render(templateData)
      }
      catch( e ){
        console.error("Error rendering fragment with context:", templateData)
        console.error(render.toString())
        console.error(e)
        throw e
      }
    }

    temp.innerHTML = html
    var fragment = window.document.createDocumentFragment()
    while( temp.childNodes.length ){
      fragment.appendChild(temp.firstChild)
    }
    return fragment
  }
}
fragment.render = function( html, templateData ){
  return fragment(html)(templateData)
}

},{"../util/merge":13}],8:[function(require,module,exports){
var camelcase = require("camelcase")
var COMPONENT_ATTRIBUTE = "data-component"

var hook = module.exports = {}

hook.setHookAttribute = setHookAttribute
hook.createComponentSelector = createComponentSelector
hook.findComponent = findComponent
hook.findAllComponent = findAllComponent
hook.findSubComponents = findSubComponents
hook.getComponentName = getComponentName
hook.getMainComponentName = getMainComponentName
hook.getSubComponentName = getSubComponentName
hook.assignSubComponents = assignSubComponents
hook.filter = filter

function setHookAttribute (hook) {
  COMPONENT_ATTRIBUTE = hook
}

function createComponentSelector (name, operator) {
  name = name && '"' + name + '"'
  operator = name ? operator || "=" : ""
  return "[" + COMPONENT_ATTRIBUTE + operator + name + "]"
}

function compose (name, extra, operator) {
  return createComponentSelector(name, operator)+extra
}

function findComposed (selector, root) {
  return (root || document).querySelector(selector)
}

function findAllComposed (selector, root) {
  return (root || document).querySelectorAll(selector)
}

function findComponent (name, root) {
  return findComposed(createComponentSelector(name), root)
}

function findAllComponent (name, root) {
  return [].slice.call(findAllComposed(createComponentSelector(name), root))
}

function getComponentName (element, cc) {
  if (!element) return ""
  cc = cc == undefined || cc
  var value = typeof element == "string" ? element : element.getAttribute(COMPONENT_ATTRIBUTE) || ""
  return cc ? camelcase(value) : value
}

function getMainComponentName (element, cc) {
  cc = cc == undefined || cc
  var value = getComponentName(element, false).split(":")
  value = value[0] || ""
  return cc && value ? camelcase(value) : value
}

function getSubComponentName (element, cc) {
  cc = cc == undefined || cc
  var value = getComponentName(element, false).split(":")
  value = value[1] || ""
  return cc && value ? camelcase(value) : value
}

function getComponentNameList (element, cc) {
  return getComponentName(element, cc).split(/\s+/)
}

function findSubComponents (mainName, root) {
  var elements = findAllComposed(createComponentSelector(mainName+":", "*="), root)
  return filter(elements, function (element, componentName) {
    return getComponentNameList(componentName, false).some(function (name) {
      return getMainComponentName(name, false) == mainName && getSubComponentName(name)
    })
  })
}

function assignSubComponents (obj, subComponents, transform, assign) {
  return subComponents.reduce(function (obj, element) {
    getComponentNameList(element, false).forEach(function (name) {
      name = getSubComponentName(name, false)
      element = typeof transform == "function"
          // TODO: subclass subcomponents should be handled properly (B extends A that has a subcomponent A:a becomes B:a that's not in the registry)
          ? transform(element, name)
          : element
      name = camelcase(name)
      if (typeof assign == "function") {
        assign(obj, name, element)
      }
      else if (Array.isArray(obj[name])) {
        obj[name].push(element)
      }
      else {
        obj[name] = element
      }
    })
    return obj
  }, obj)
}

function filter (elements, filter) {
  switch (typeof filter) {
    case "function":
      return [].slice.call(elements).filter(function (element) {
        return filter(element, getComponentName(element, false))
      })
      break
    case "string":
      return [].slice.call(elements).filter(function (element) {
        return getComponentName(element) === filter
      })
      break
    default:
      return null
  }
}

},{"camelcase":2}],9:[function(require,module,exports){
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

  //CustomComponent.prototype = Object.create(Component.prototype)
  //CustomComponent.prototype.constructor = CustomComponent
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
  // define main prototype after registering
}

},{"./Component":3,"./Internals":4,"./registry":10}],10:[function(require,module,exports){
var registry = module.exports = {}

var components = {}

registry.get = function exists (name) {
  return components[name]
}

registry.exists = function exists (name) {
  return !!components[name]
}

registry.set = function exists (name, ComponentConstructor) {
  return components[name] = ComponentConstructor
}

},{}],11:[function(require,module,exports){
var storage = module.exports = {}
var components = []
var elements = []

function remove (array, element) {
  var i = array.indexOf(element)
  if (~i) array.splice(i, 1)
}

storage.all = function (element) {
  return components.filter(function (component) {
    return component.element == element
  })
}

storage.get = function (element, componentName) {
  var ret = null

  components.some(function (component) {
    if (component.element == element && (componentName ? component.internals.attributeName == componentName : true)) {
      ret = component
      return true
    }
    return false
  })

  return ret
}
storage.save = function (component) {
  if (component.element) {
    if (!~components.indexOf(component))
      components.push(component)
    if (!~elements.indexOf(component.element))
      elements.push(component.element)
  }
}
storage.remove = function (component) {
  var element = component instanceof Element
      ? component
      : component.element
  var all = storage.all(element)

  // remove all component for this element
  if (component instanceof Element) {
    all.forEach(function (component) {
      remove(components, component)
    })
  }
  // remove one component
  else {
    remove(components, component)
  }

  // remove element too, if it was its last component
  // because elements only stored once
  if (all.length == 1) {
    remove(elements, element)
  }
}


},{}],12:[function(require,module,exports){
module.exports = function extend( obj, extension ){
  for( var name in extension ){
    if( extension.hasOwnProperty(name) ) obj[name] = extension[name]
  }
  return obj
}

},{}],13:[function(require,module,exports){
var extend = require("./extend")

module.exports = function( obj, extension ){
  return extend(extend({}, obj), extension)
}

},{"./extend":12}],14:[function(require,module,exports){
var object = module.exports = {}

object.accessor = function (obj, name, get, set) {
  Object.defineProperty(obj, name, {
    get: get,
    set: set
  })
}

object.defineGetter = function (obj, name, fn) {
  Object.defineProperty(obj, name, {
    get: fn
  })
}

object.defineSetter = function (obj, name, fn) {
  Object.defineProperty(obj, name, {
    set: fn
  })
}

object.method = function (obj, name, fn) {
  Object.defineProperty(obj, name, {
    value: fn
  })
}

object.property = function (obj, name, fn) {
  Object.defineProperty(obj, name, {
    value: fn,
    configurable: true
  })
}

},{}]},{},[1])(1)
});