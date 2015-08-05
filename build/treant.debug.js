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

},{"./Internals":4,"./delegate":6,"./hook":8,"./registry":10}],4:[function(require,module,exports){
var camelcase = require("camelcase")
var merge = require("../util/merge")
var object = require("../util/object")

var defaultEventDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = Internals

function Internals (master) {
  this.autoAssign = true
  this.convertSubComponents = false
  this.components = {}
  this._events = {}
  this._constructors = []
  this._attributes = {}

  Object.defineProperty(this, "_master", {
    get: function () {
      return master
    }
  })
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
  for (var name in this._attributes) {
    if (this._attributes.hasOwnProperty(name)) {
      this._attributes[name].set.call(instance, instance[name], false)
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
  var shouldRemove

  shouldRemove = function (value) { return value == null }

  switch (type) {
    case "boolean":
      shouldRemove = function (value) { return value === false }
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
    get: getValue,
    set: setValue
  }

  function getValue(useDefault) {
    var value = this.element.getAttribute(name)
    if (value == null && useDefault != false) {
      return defaultValue
    }
    return parseValue ? parseValue(value) : value
  }

  function setValue(value, callOnchange) {
    var old = getValue.call(this, false)
    if (shouldRemove(value)) {
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
    get: getter || getValue,
    set: setter || setValue
  })

  return this
}

},{"../util/merge":13,"../util/object":14,"camelcase":2}],5:[function(require,module,exports){
var Component = require("./Component")
var hook = require("./hook")

module.exports = component

function component (name, root, options) {
  var element = null

  // component("string")
  if (typeof name == "string") {
    // component("string"[, {}])
    if (!(root instanceof Element)) {
      options = root
      root = null
    }
    // component("string"[, Element])
    element = hook.findComponent(name, root)
  }
  // component(Element[, {}])
  else if (name instanceof Element) {
    element = name
    options = root
    root = null
  }

  return Component.create(element, options)
}

component.all = function (name, root, options) {
  var elements = []

  // component("string")
  if (typeof name == "string") {
    // component("string"[, {}])
    if (!(root instanceof Element)) {
      options = root
      root = null
    }
    // component("string"[, Element])
    elements = hook.findAllComponent(name, root)
  }
  // component(Element[][, {}])
  else if (Array.isArray(name)) {
    elements = name
    options = root
    root = null
  }

  return [].map.call(elements, function (element) {
    return Component.create(element, options)
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
  return '[' + COMPONENT_ATTRIBUTE + operator + name + ']'
}

function findComponent (name, root) {
  return (root || document).querySelector(createComponentSelector(name))
}

function findAllComponent (name, root) {
  return [].slice.call((root || document).querySelectorAll(createComponentSelector(name)))
}

function findSubComponents (name, root) {
  var elements = (root || document).querySelectorAll(createComponentSelector(name, "^="))
  return filter(elements, function (element, componentName, mainComponentName, subComponentName) {
    return subComponentName && name === mainComponentName
  })
}

function getComponentName (element, cc) {
  cc = cc == undefined || cc
  var value = element.getAttribute(COMPONENT_ATTRIBUTE)
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

function assignSubComponents (obj, subComponents, transform, assign) {
  return subComponents.reduce(function (obj, element) {
    var name = getSubComponentName(element)
    if (name) {

      element = typeof transform == "function"
        ? transform(element, name)
        : element

      if (typeof assign == "function") {
        assign(obj, name, element)
      }
      else if (Array.isArray(obj[name])) {
        obj[name].push(element)
      }
      else {
        obj[name] = element
      }
    }
    return obj
  }, obj)
}

function filter (elements, filter) {
  switch (typeof filter) {
    case "function":
      return [].slice.call(elements).filter(function (element) {
        return filter(element, getComponentName(element, false), getMainComponentName(element, false), getSubComponentName(element, false))
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

  CustomComponent.prototype = Object.create(Component.prototype)
  CustomComponent.prototype.constructor = CustomComponent
  var internals = new Internals(CustomComponent.prototype)
  internals.autoAssign = true
  CustomComponent.prototype.internals = internals
  CustomComponent.internals = internals
  mixin.forEach(function (mixin) {
    if (typeof mixin == "function") {
      mixin.call(CustomComponent.prototype, CustomComponent.prototype, internals)
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

storage.get = function (element) {
  return components[elements.indexOf(element)]
}

storage.save = function (component) {
  components.push(component)
  elements.push(component.element)
}

storage.remove = function (component) {
  var i = component instanceof Element
      ? elements.indexOf(component)
      : components.indexOf(component)

  if (~i) {
    components.splice(i, 1)
    elements.splice(i, 1)
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBob29rID0gcmVxdWlyZShcIi4vc3JjL2hvb2tcIilcbnZhciByZWdpc3RlciA9IHJlcXVpcmUoXCIuL3NyYy9yZWdpc3RlclwiKVxudmFyIGNvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9jcmVhdGVcIilcbnZhciBzdG9yYWdlID0gcmVxdWlyZShcIi4vc3JjL3N0b3JhZ2VcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvQ29tcG9uZW50XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9zcmMvZGVsZWdhdGVcIilcbnZhciBmcmFnbWVudCA9IHJlcXVpcmUoXCIuL3NyYy9mcmFnbWVudFwiKVxuXG52YXIgdHJlYW50ID0ge31cbm1vZHVsZS5leHBvcnRzID0gdHJlYW50XG5cbnRyZWFudC5yZWdpc3RlciA9IHJlZ2lzdGVyXG50cmVhbnQuY29tcG9uZW50ID0gY29tcG9uZW50XG50cmVhbnQuc3RvcmFnZSA9IHN0b3JhZ2VcbnRyZWFudC5Db21wb25lbnQgPSBDb21wb25lbnRcbnRyZWFudC5kZWxlZ2F0ZSA9IGRlbGVnYXRlXG50cmVhbnQuZnJhZ21lbnQgPSBmcmFnbWVudFxudHJlYW50Lmhvb2sgPSBob29rXG5cbnZhciB1dGlsID0ge31cbnRyZWFudC51dGlsID0gdXRpbFxuXG51dGlsLmV4dGVuZCA9IHJlcXVpcmUoXCIuL3V0aWwvZXh0ZW5kXCIpXG51dGlsLm1lcmdlID0gcmVxdWlyZShcIi4vdXRpbC9tZXJnZVwiKVxudXRpbC5vYmplY3QgPSByZXF1aXJlKFwiLi91dGlsL29iamVjdFwiKVxuIiwiJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyKSB7XG5cdHN0ciA9IHN0ci50cmltKCk7XG5cblx0aWYgKHN0ci5sZW5ndGggPT09IDEgfHwgISgvW18uXFwtIF0rLykudGVzdChzdHIpICkge1xuXHRcdGlmIChzdHJbMF0gPT09IHN0clswXS50b0xvd2VyQ2FzZSgpICYmIHN0ci5zbGljZSgxKSAhPT0gc3RyLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0ci50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cblx0cmV0dXJuIHN0clxuXHQucmVwbGFjZSgvXltfLlxcLSBdKy8sICcnKVxuXHQudG9Mb3dlckNhc2UoKVxuXHQucmVwbGFjZSgvW18uXFwtIF0rKFxcd3wkKS9nLCBmdW5jdGlvbiAobSwgcDEpIHtcblx0XHRyZXR1cm4gcDEudG9VcHBlckNhc2UoKTtcblx0fSk7XG59O1xuIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG52YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIGRlbGVnYXRlID0gcmVxdWlyZShcIi4vZGVsZWdhdGVcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBDb21wb25lbnRcblxuZnVuY3Rpb24gQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmIChlbGVtZW50ICYmICEoZWxlbWVudCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZWxlbWVudCBzaG91bGQgYmUgYW4gRWxlbWVudCBpbnN0YW5jZSBvciBudWxsXCIpXG4gIH1cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENvbXBvbmVudCkpIHtcbiAgICByZXR1cm4gbmV3IENvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICB9XG5cbiAgdGhpcy5lbGVtZW50ID0gZWxlbWVudCB8fCBudWxsXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG5cbiAgaWYgKHRoaXMuZWxlbWVudCAmJiB0aGlzLmludGVybmFscy5hdXRvQXNzaWduKSB7XG4gICAgdGhpcy5hc3NpZ25TdWJDb21wb25lbnRzKClcbiAgfVxuXG4gIGlmICh0aGlzLmVsZW1lbnQpIHtcbiAgICB0aGlzLmludGVybmFscy5yZXNldEF0dHJpYnV0ZXModGhpcylcbiAgfVxufVxuXG5Db21wb25lbnQuY3JlYXRlID0gZnVuY3Rpb24gKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgdmFyIG5hbWUgPSBob29rLmdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpXG5cbiAgaWYgKCFuYW1lKSB7XG4gICAgY29uc29sZS53YXJuKFwiVW5hYmxlIHRvIGNyZWF0ZSBjb21wb25lbnQsIHRoaXMgZWxlbWVudCBkb2Vzbid0IGhhdmUgYSBjb21wb25lbnQgYXR0cmlidXRlXCIsIGVsZW1lbnQpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIHZhciBDb21wb25lbnRDb25zdHJ1Y3RvciA9IG51bGxcblxuICBpZiAocmVnaXN0cnkuZXhpc3RzKG5hbWUpKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSAgcmVnaXN0cnkuZ2V0KG5hbWUpXG4gIH1cbiAgZWxzZSBpZiAocmVnaXN0cnkuZXhpc3RzKFwiKlwiKSkge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gcmVnaXN0cnkuZ2V0KFwiKlwiKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIk1pc3NpbmcgY3VzdG9tIGNvbXBvbmVudCAnJXMnIGZvciBcIiwgbmFtZSwgZWxlbWVudCxcbiAgICAgICAgJyBVc2UgdGhlIENvbXBvbmVudCBjb25zdHJ1Y3RvciB0byBjcmVhdGUgcmF3IGNvbXBvbmVudHMgb3IgcmVnaXN0ZXIgYSBcIipcIiBjb21wb25lbnQuJylcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IENvbXBvbmVudFxuICB9XG5cbiAgcmV0dXJuIG5ldyBDb21wb25lbnRDb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKVxufVxuXG5Db21wb25lbnQucHJvdG90eXBlID0ge1xuICBpbnRlcm5hbHM6IG5ldyBJbnRlcm5hbHMoKSxcblxuICBkZWxlZ2F0ZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmVsZW1lbnQgPSB0aGlzLmVsZW1lbnRcbiAgICBvcHRpb25zLmNvbnRleHQgPSBvcHRpb25zLmNvbnRleHQgfHwgdGhpc1xuICAgIHJldHVybiBkZWxlZ2F0ZShvcHRpb25zKVxuICB9LFxuXG4gIGRpc3BhdGNoOiBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gICAgdmFyIGRlZmluaXRpb24gPSB0aGlzLmludGVybmFscy5nZXRFdmVudERlZmluaXRpb24odHlwZSwgZGV0YWlsKVxuICAgIHJldHVybiB0aGlzLmVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgd2luZG93LkN1c3RvbUV2ZW50KHR5cGUsIGRlZmluaXRpb24pKVxuICB9LFxuXG4gIGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZENvbXBvbmVudChuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGZpbmRBbGxDb21wb25lbnQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZEFsbENvbXBvbmVudChuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGZpbmRTdWJDb21wb25lbnRzOiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRTdWJDb21wb25lbnRzKG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZ2V0Q29tcG9uZW50TmFtZTogZnVuY3Rpb24gKGNjKSB7XG4gICAgcmV0dXJuIGhvb2suZ2V0Q29tcG9uZW50TmFtZSh0aGlzLmVsZW1lbnQsIGNjKVxuICB9LFxuICBnZXRNYWluQ29tcG9uZW50TmFtZTogZnVuY3Rpb24gKGNjKSB7XG4gICAgcmV0dXJuIGhvb2suZ2V0TWFpbkNvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgZ2V0U3ViQ29tcG9uZW50TmFtZTogZnVuY3Rpb24gKGNjKSB7XG4gICAgcmV0dXJuIGhvb2suZ2V0U3ViQ29tcG9uZW50TmFtZSh0aGlzLmVsZW1lbnQsIGNjKVxuICB9LFxuICBjbGVhclN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmNvbXBvbmVudHMgPSB7fVxuICB9LFxuICBhc3NpZ25TdWJDb21wb25lbnRzOiBmdW5jdGlvbiAodHJhbnNmb3JtKSB7XG4gICAgdmFyIGhvc3RDb21wb25lbnQgPSB0aGlzXG4gICAgdmFyIHN1YkNvbXBvbmVudHMgPSBob29rLmZpbmRTdWJDb21wb25lbnRzKHRoaXMuZ2V0TWFpbkNvbXBvbmVudE5hbWUoZmFsc2UpLCB0aGlzLmVsZW1lbnQpXG4gICAgdmFyIGludGVybmFscyA9IHRoaXMuaW50ZXJuYWxzXG5cbiAgICBmb3IgKHZhciBuYW1lIGluIGludGVybmFscy5jb21wb25lbnRzKSB7XG4gICAgICBpZiAoaW50ZXJuYWxzLmNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV0pKSB7XG4gICAgICAgICAgdGhpcy5jb21wb25lbnRzW25hbWVdID0gW11cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLmNvbXBvbmVudHNbbmFtZV0gPSBpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaW50ZXJuYWxzLmNvbnZlcnRTdWJDb21wb25lbnRzICYmICh0eXBlb2YgdHJhbnNmb3JtID09IFwidW5kZWZpbmVkXCIgfHwgdHJhbnNmb3JtID09PSB0cnVlKSkge1xuICAgICAgdHJhbnNmb3JtID0gZnVuY3Rpb24gKGVsZW1lbnQvKiwgbmFtZSovKSB7XG4gICAgICAgIHJldHVybiBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIGhvc3RDb21wb25lbnQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaG9vay5hc3NpZ25TdWJDb21wb25lbnRzKHRoaXMuY29tcG9uZW50cywgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBmdW5jdGlvbiAoY29tcG9uZW50cywgbmFtZSwgZWxlbWVudCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV0pKSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBjb21wb25lbnRzW25hbWVdIHx8IFtdXG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBtZXJnZSA9IHJlcXVpcmUoXCIuLi91dGlsL21lcmdlXCIpXG52YXIgb2JqZWN0ID0gcmVxdWlyZShcIi4uL3V0aWwvb2JqZWN0XCIpXG5cbnZhciBkZWZhdWx0RXZlbnREZWZpbml0aW9uID0ge1xuICBkZXRhaWw6IG51bGwsXG4gIHZpZXc6IHdpbmRvdyxcbiAgYnViYmxlczogdHJ1ZSxcbiAgY2FuY2VsYWJsZTogdHJ1ZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVybmFsc1xuXG5mdW5jdGlvbiBJbnRlcm5hbHMgKG1hc3Rlcikge1xuICB0aGlzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIHRoaXMuY29udmVydFN1YkNvbXBvbmVudHMgPSBmYWxzZVxuICB0aGlzLmNvbXBvbmVudHMgPSB7fVxuICB0aGlzLl9ldmVudHMgPSB7fVxuICB0aGlzLl9jb25zdHJ1Y3RvcnMgPSBbXVxuICB0aGlzLl9hdHRyaWJ1dGVzID0ge31cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJfbWFzdGVyXCIsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBtYXN0ZXJcbiAgICB9XG4gIH0pXG59XG5cbkludGVybmFscy5wcm90b3R5cGUub25DcmVhdGUgPSBmdW5jdGlvbiAoY29uc3RydWN0b3IpIHtcbiAgdGhpcy5fY29uc3RydWN0b3JzLnB1c2goY29uc3RydWN0b3IpXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKGluc3RhbmNlLCBhcmdzKSB7XG4gIHRoaXMuX2NvbnN0cnVjdG9ycy5mb3JFYWNoKGZ1bmN0aW9uIChjb25zdHJ1Y3Rvcikge1xuICAgIGNvbnN0cnVjdG9yLmFwcGx5KGluc3RhbmNlLCBhcmdzKVxuICB9KVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLm1ldGhvZCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QubWV0aG9kKHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUucHJvcGVydHkgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0LnByb3BlcnR5KHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5kZWZpbmVHZXR0ZXIodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0LmRlZmluZUdldHRlcih0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmFjY2Vzc29yID0gZnVuY3Rpb24gKG5hbWUsIGdldCwgc2V0KSB7XG4gIG9iamVjdC5hY2Nlc3Nvcih0aGlzLl9tYXN0ZXIsIG5hbWUsIGdldCwgc2V0KVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnByb3RvID0gZnVuY3Rpb24gKHByb3RvdHlwZSkge1xuICBmb3IgKHZhciBwcm9wIGluIHByb3RvdHlwZSkge1xuICAgIGlmIChwcm90b3R5cGUuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGlmICh0eXBlb2YgcHJvdG90eXBlW3Byb3BdID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBpZiAocHJvcCA9PT0gXCJvbkNyZWF0ZVwiKSB7XG4gICAgICAgICAgdGhpcy5vbkNyZWF0ZShwcm90b3R5cGVbcHJvcF0pXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5tZXRob2QocHJvcCwgcHJvdG90eXBlW3Byb3BdKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdGhpcy5wcm9wZXJ0eShwcm9wLCBwcm90b3R5cGVbcHJvcF0pXG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuZXZlbnQgPSBmdW5jdGlvbiAodHlwZSwgZGVmaW5pdGlvbikge1xuICB0aGlzLl9ldmVudHNbdHlwZV0gPSBkZWZpbml0aW9uXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuZ2V0RXZlbnREZWZpbml0aW9uID0gZnVuY3Rpb24gKHR5cGUsIGRldGFpbCkge1xuICB2YXIgZGVmaW5pdGlvbiA9IG1lcmdlKGRlZmF1bHRFdmVudERlZmluaXRpb24sIHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgZGVmaW5pdGlvbi5kZXRhaWwgPSB0eXBlb2YgZGV0YWlsID09IFwidW5kZWZpbmVkXCIgPyBkZWZpbml0aW9uLmRldGFpbCA6IGRldGFpbFxuICByZXR1cm4gZGVmaW5pdGlvblxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnJlc2V0QXR0cmlidXRlcyA9IGZ1bmN0aW9uIChpbnN0YW5jZSkge1xuICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX2F0dHJpYnV0ZXMpIHtcbiAgICBpZiAodGhpcy5fYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgdGhpcy5fYXR0cmlidXRlc1tuYW1lXS5zZXQuY2FsbChpbnN0YW5jZSwgaW5zdGFuY2VbbmFtZV0sIGZhbHNlKVxuICAgIH1cbiAgfVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmF0dHJpYnV0ZSA9IGZ1bmN0aW9uIChuYW1lLCBkZWYpIHtcbiAgdmFyIG1hc3RlciA9IHRoaXMuX21hc3RlclxuICBpZiAoIW1hc3Rlcikge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBpZiAoZGVmID09IG51bGwpIHtcbiAgICBkZWYgPSB7fVxuICB9XG5cbiAgdmFyIHR5cGVPZkRlZiA9IHR5cGVvZiBkZWZcbiAgdmFyIHR5cGVcbiAgdmFyIGRlZmF1bHRWYWx1ZVxuICB2YXIgZ2V0dGVyXG4gIHZhciBzZXR0ZXJcbiAgdmFyIG9uY2hhbmdlXG4gIHZhciBwcm9wZXJ0eSA9IGNhbWVsY2FzZShuYW1lKVxuXG4gIHN3aXRjaCAodHlwZU9mRGVmKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgLy8gdGhlIGRlZmluaXRpb24gaXMgYSBwcmltaXRpdmUgdmFsdWVcbiAgICAgIHR5cGUgPSB0eXBlT2ZEZWZcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IGRlZlxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIG9yIGEgZGVmaW5pdGlvbiBvYmplY3RcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHR5cGVvZiBkZWZbXCJkZWZhdWx0XCJdID09IFwidW5kZWZpbmVkXCIgPyBudWxsIDogZGVmW1wiZGVmYXVsdFwiXVxuICAgICAgaWYgKHR5cGVvZiBkZWZbXCJ0eXBlXCJdID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKGRlZmF1bHRWYWx1ZSA9PSBudWxsKSB7XG4gICAgICAgICAgdHlwZSA9IFwic3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0eXBlID0gdHlwZW9mIGRlZmF1bHRWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdHlwZSA9IGRlZltcInR5cGVcIl1cbiAgICAgIH1cbiAgICAgIGdldHRlciA9IGRlZltcImdldFwiXVxuICAgICAgc2V0dGVyID0gZGVmW1wic2V0XCJdXG4gICAgICBvbmNoYW5nZSA9IGRlZltcIm9uY2hhbmdlXCJdXG4gIH1cblxuICB2YXIgcGFyc2VWYWx1ZVxuICB2YXIgc3RyaW5naWZ5VmFsdWVcbiAgdmFyIHNob3VsZFJlbW92ZVxuXG4gIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCB9XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT09IGZhbHNlIH1cbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9IG51bGwgfVxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBcIlwiIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiBwYXJzZUludCh2YWx1ZSwgMTApIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSA9PSBudWxsID8gbnVsbCA6IHBhcnNlRmxvYXQodmFsdWUpIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgIGRlZmF1bHQ6XG4gICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiB2YWx1ZSA/IFwiXCIrdmFsdWUgOiBcIlwiIH1cbiAgfVxuXG4gIHRoaXMuX2F0dHJpYnV0ZXNbcHJvcGVydHldID0ge1xuICAgIGdldDogZ2V0VmFsdWUsXG4gICAgc2V0OiBzZXRWYWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0VmFsdWUodXNlRGVmYXVsdCkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICBpZiAodmFsdWUgPT0gbnVsbCAmJiB1c2VEZWZhdWx0ICE9IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlXG4gICAgfVxuICAgIHJldHVybiBwYXJzZVZhbHVlID8gcGFyc2VWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0VmFsdWUodmFsdWUsIGNhbGxPbmNoYW5nZSkge1xuICAgIHZhciBvbGQgPSBnZXRWYWx1ZS5jYWxsKHRoaXMsIGZhbHNlKVxuICAgIGlmIChzaG91bGRSZW1vdmUodmFsdWUpKSB7XG4gICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgfVxuICAgIGVsc2UgaWYgKG9sZCA9PT0gdmFsdWUpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IHN0cmluZ2lmeVZhbHVlID8gc3RyaW5naWZ5VmFsdWUodmFsdWUpIDogdmFsdWVcbiAgICAgIHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUobmFtZSwgbmV3VmFsdWUpXG4gICAgfVxuICAgIG9uY2hhbmdlICYmIGNhbGxPbmNoYW5nZSAhPSBmYWxzZSAmJiBvbmNoYW5nZS5jYWxsKHRoaXMsIG9sZCwgdmFsdWUpXG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobWFzdGVyLCBwcm9wZXJ0eSwge1xuICAgIGdldDogZ2V0dGVyIHx8IGdldFZhbHVlLFxuICAgIHNldDogc2V0dGVyIHx8IHNldFZhbHVlXG4gIH0pXG5cbiAgcmV0dXJuIHRoaXNcbn1cbiIsInZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBvbmVudFxuXG5mdW5jdGlvbiBjb21wb25lbnQgKG5hbWUsIHJvb3QsIG9wdGlvbnMpIHtcbiAgdmFyIGVsZW1lbnQgPSBudWxsXG5cbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCIpXG4gIGlmICh0eXBlb2YgbmFtZSA9PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCB7fV0pXG4gICAgaWYgKCEocm9vdCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgICBvcHRpb25zID0gcm9vdFxuICAgICAgcm9vdCA9IG51bGxcbiAgICB9XG4gICAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCBFbGVtZW50XSlcbiAgICBlbGVtZW50ID0gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHJvb3QpXG4gIH1cbiAgLy8gY29tcG9uZW50KEVsZW1lbnRbLCB7fV0pXG4gIGVsc2UgaWYgKG5hbWUgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgZWxlbWVudCA9IG5hbWVcbiAgICBvcHRpb25zID0gcm9vdFxuICAgIHJvb3QgPSBudWxsXG4gIH1cblxuICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShlbGVtZW50LCBvcHRpb25zKVxufVxuXG5jb21wb25lbnQuYWxsID0gZnVuY3Rpb24gKG5hbWUsIHJvb3QsIG9wdGlvbnMpIHtcbiAgdmFyIGVsZW1lbnRzID0gW11cblxuICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIilcbiAgaWYgKHR5cGVvZiBuYW1lID09IFwic3RyaW5nXCIpIHtcbiAgICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIHt9XSlcbiAgICBpZiAoIShyb290IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICAgIG9wdGlvbnMgPSByb290XG4gICAgICByb290ID0gbnVsbFxuICAgIH1cbiAgICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIEVsZW1lbnRdKVxuICAgIGVsZW1lbnRzID0gaG9vay5maW5kQWxsQ29tcG9uZW50KG5hbWUsIHJvb3QpXG4gIH1cbiAgLy8gY29tcG9uZW50KEVsZW1lbnRbXVssIHt9XSlcbiAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShuYW1lKSkge1xuICAgIGVsZW1lbnRzID0gbmFtZVxuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuXG4gIHJldHVybiBbXS5tYXAuY2FsbChlbGVtZW50cywgZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShlbGVtZW50LCBvcHRpb25zKVxuICB9KVxufVxuIiwiLyoqXG4gKiBSZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIgb24gYW4gZWxlbWVudFxuICogYW5kIHJldHVybnMgYSBkZWxlZ2F0b3IuXG4gKiBBIGRlbGVnYXRlZCBldmVudCBydW5zIG1hdGNoZXMgdG8gZmluZCBhbiBldmVudCB0YXJnZXQsXG4gKiB0aGVuIGV4ZWN1dGVzIHRoZSBoYW5kbGVyIHBhaXJlZCB3aXRoIHRoZSBtYXRjaGVyLlxuICogTWF0Y2hlcnMgY2FuIGNoZWNrIGlmIGFuIGV2ZW50IHRhcmdldCBtYXRjaGVzIGEgZ2l2ZW4gc2VsZWN0b3IsXG4gKiBvciBzZWUgaWYgYW4gb2YgaXRzIHBhcmVudHMgZG8uXG4gKiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWxlZ2F0ZSggb3B0aW9ucyApe1xuICAgIHZhciBlbGVtZW50ID0gb3B0aW9ucy5lbGVtZW50XG4gICAgICAgICwgZXZlbnQgPSBvcHRpb25zLmV2ZW50XG4gICAgICAgICwgY2FwdHVyZSA9ICEhb3B0aW9ucy5jYXB0dXJlfHxmYWxzZVxuICAgICAgICAsIGNvbnRleHQgPSBvcHRpb25zLmNvbnRleHR8fGVsZW1lbnRcblxuICAgIGlmKCAhZWxlbWVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBlbGVtZW50XCIpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIGlmKCAhZXZlbnQgKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYW4ndCBkZWxlZ2F0ZSB1bmRlZmluZWQgZXZlbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgZGVsZWdhdG9yID0gY3JlYXRlRGVsZWdhdG9yKGNvbnRleHQpXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBkZWxlZ2F0b3IsIGNhcHR1cmUpXG5cbiAgICByZXR1cm4gZGVsZWdhdG9yXG59XG5cbi8qKlxuICogUmV0dXJucyBhIGRlbGVnYXRvciB0aGF0IGNhbiBiZSB1c2VkIGFzIGFuIGV2ZW50IGxpc3RlbmVyLlxuICogVGhlIGRlbGVnYXRvciBoYXMgc3RhdGljIG1ldGhvZHMgd2hpY2ggY2FuIGJlIHVzZWQgdG8gcmVnaXN0ZXIgaGFuZGxlcnMuXG4gKiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVsZWdhdG9yKCBjb250ZXh0ICl7XG4gICAgdmFyIG1hdGNoZXJzID0gW11cblxuICAgIGZ1bmN0aW9uIGRlbGVnYXRvciggZSApe1xuICAgICAgICB2YXIgbCA9IG1hdGNoZXJzLmxlbmd0aFxuICAgICAgICBpZiggIWwgKXtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZWwgPSB0aGlzXG4gICAgICAgICAgICAsIGkgPSAtMVxuICAgICAgICAgICAgLCBoYW5kbGVyXG4gICAgICAgICAgICAsIHNlbGVjdG9yXG4gICAgICAgICAgICAsIGRlbGVnYXRlRWxlbWVudFxuICAgICAgICAgICAgLCBzdG9wUHJvcGFnYXRpb25cbiAgICAgICAgICAgICwgYXJnc1xuXG4gICAgICAgIHdoaWxlKCArK2kgPCBsICl7XG4gICAgICAgICAgICBhcmdzID0gbWF0Y2hlcnNbaV1cbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdXG4gICAgICAgICAgICBzZWxlY3RvciA9IGFyZ3NbMV1cblxuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gbWF0Y2hDYXB0dXJlUGF0aChzZWxlY3RvciwgZWwsIGUpXG4gICAgICAgICAgICBpZiggZGVsZWdhdGVFbGVtZW50ICYmIGRlbGVnYXRlRWxlbWVudC5sZW5ndGggKSB7XG4gICAgICAgICAgICAgICAgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2UgPT09IGhhbmRsZXIuYXBwbHkoY29udGV4dCwgW2VdLmNvbmNhdChkZWxlZ2F0ZUVsZW1lbnQpKVxuICAgICAgICAgICAgICAgIGlmKCBzdG9wUHJvcGFnYXRpb24gKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXJzIGEgaGFuZGxlciB3aXRoIGEgdGFyZ2V0IGZpbmRlciBsb2dpY1xuICAgICAqICovXG4gICAgZGVsZWdhdG9yLm1hdGNoID0gZnVuY3Rpb24oIHNlbGVjdG9yLCBoYW5kbGVyICl7XG4gICAgICAgIG1hdGNoZXJzLnB1c2goW2hhbmRsZXIsIHNlbGVjdG9yXSlcbiAgICAgICAgcmV0dXJuIGRlbGVnYXRvclxuICAgIH1cblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuZnVuY3Rpb24gbWF0Y2hDYXB0dXJlUGF0aCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudHMgPSBbXVxuICAgIHZhciBkZWxlZ2F0ZUVsZW1lbnQgPSBudWxsXG4gICAgaWYoIEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpICl7XG4gICAgICAgIHZhciBpID0gLTFcbiAgICAgICAgdmFyIGwgPSBzZWxlY3Rvci5sZW5ndGhcbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IGZpbmRQYXJlbnQoc2VsZWN0b3JbaV0sIGVsLCBlKVxuICAgICAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50cy5wdXNoKGRlbGVnYXRlRWxlbWVudClcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvciwgZWwsIGUpXG4gICAgICAgIGlmKCAhZGVsZWdhdGVFbGVtZW50ICkgcmV0dXJuIG51bGxcbiAgICAgICAgZGVsZWdhdGVFbGVtZW50cy5wdXNoKGRlbGVnYXRlRWxlbWVudClcbiAgICB9XG4gICAgcmV0dXJuIGRlbGVnYXRlRWxlbWVudHNcbn1cblxuLyoqXG4gKiBDaGVjayBpZiB0aGUgdGFyZ2V0IG9yIGFueSBvZiBpdHMgcGFyZW50IG1hdGNoZXMgYSBzZWxlY3RvclxuICogKi9cbmZ1bmN0aW9uIGZpbmRQYXJlbnQoIHNlbGVjdG9yLCBlbCwgZSApe1xuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldFxuICAgIHN3aXRjaCggdHlwZW9mIHNlbGVjdG9yICl7XG4gICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHRhcmdldC5tYXRjaGVzKHNlbGVjdG9yKSApIHJldHVybiB0YXJnZXRcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgICAgICB3aGlsZSggdGFyZ2V0ICYmIHRhcmdldCAhPSBlbCApe1xuICAgICAgICAgICAgICAgIGlmKCBzZWxlY3Rvci5jYWxsKGVsLCB0YXJnZXQpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgcmV0dXJuIG51bGxcbn1cbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoXCIuLi91dGlsL21lcmdlXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnJhZ21lbnRcblxuZnJhZ21lbnQub3B0aW9ucyA9IHtcbiAgdmFyaWFibGU6IFwiZlwiXG59XG5cbmZ1bmN0aW9uIGZyYWdtZW50KCBodG1sLCBjb21waWxlciwgY29tcGlsZXJPcHRpb25zICl7XG4gIGNvbXBpbGVyT3B0aW9ucyA9IG1lcmdlKGZyYWdtZW50Lm9wdGlvbnMsIGNvbXBpbGVyT3B0aW9ucylcbiAgdmFyIHJlbmRlciA9IG51bGxcbiAgcmV0dXJuIGZ1bmN0aW9uKCB0ZW1wbGF0ZURhdGEgKXtcbiAgICB2YXIgdGVtcCA9IHdpbmRvdy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG4gICAgaWYoIHR5cGVvZiBjb21waWxlciA9PSBcImZ1bmN0aW9uXCIgJiYgIXJlbmRlciApe1xuICAgICAgcmVuZGVyID0gY29tcGlsZXIoaHRtbCwgY29tcGlsZXJPcHRpb25zKVxuICAgIH1cbiAgICBpZiggcmVuZGVyICl7XG4gICAgICB0cnl7XG4gICAgICAgIGh0bWwgPSByZW5kZXIodGVtcGxhdGVEYXRhKVxuICAgICAgfVxuICAgICAgY2F0Y2goIGUgKXtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJlbmRlcmluZyBmcmFnbWVudCB3aXRoIGNvbnRleHQ6XCIsIHRlbXBsYXRlRGF0YSlcbiAgICAgICAgY29uc29sZS5lcnJvcihyZW5kZXIudG9TdHJpbmcoKSlcbiAgICAgICAgY29uc29sZS5lcnJvcihlKVxuICAgICAgICB0aHJvdyBlXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGVtcC5pbm5lckhUTUwgPSBodG1sXG4gICAgdmFyIGZyYWdtZW50ID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuICAgIHdoaWxlKCB0ZW1wLmNoaWxkTm9kZXMubGVuZ3RoICl7XG4gICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh0ZW1wLmZpcnN0Q2hpbGQpXG4gICAgfVxuICAgIHJldHVybiBmcmFnbWVudFxuICB9XG59XG5mcmFnbWVudC5yZW5kZXIgPSBmdW5jdGlvbiggaHRtbCwgdGVtcGxhdGVEYXRhICl7XG4gIHJldHVybiBmcmFnbWVudChodG1sKSh0ZW1wbGF0ZURhdGEpXG59XG4iLCJ2YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxudmFyIENPTVBPTkVOVF9BVFRSSUJVVEUgPSBcImRhdGEtY29tcG9uZW50XCJcblxudmFyIGhvb2sgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbmhvb2suc2V0SG9va0F0dHJpYnV0ZSA9IHNldEhvb2tBdHRyaWJ1dGVcbmhvb2suY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IgPSBjcmVhdGVDb21wb25lbnRTZWxlY3RvclxuaG9vay5maW5kQ29tcG9uZW50ID0gZmluZENvbXBvbmVudFxuaG9vay5maW5kQWxsQ29tcG9uZW50ID0gZmluZEFsbENvbXBvbmVudFxuaG9vay5maW5kU3ViQ29tcG9uZW50cyA9IGZpbmRTdWJDb21wb25lbnRzXG5ob29rLmdldENvbXBvbmVudE5hbWUgPSBnZXRDb21wb25lbnROYW1lXG5ob29rLmdldE1haW5Db21wb25lbnROYW1lID0gZ2V0TWFpbkNvbXBvbmVudE5hbWVcbmhvb2suZ2V0U3ViQ29tcG9uZW50TmFtZSA9IGdldFN1YkNvbXBvbmVudE5hbWVcbmhvb2suYXNzaWduU3ViQ29tcG9uZW50cyA9IGFzc2lnblN1YkNvbXBvbmVudHNcbmhvb2suZmlsdGVyID0gZmlsdGVyXG5cbmZ1bmN0aW9uIHNldEhvb2tBdHRyaWJ1dGUgKGhvb2spIHtcbiAgQ09NUE9ORU5UX0FUVFJJQlVURSA9IGhvb2tcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IgKG5hbWUsIG9wZXJhdG9yKSB7XG4gIG5hbWUgPSBuYW1lICYmICdcIicgKyBuYW1lICsgJ1wiJ1xuICBvcGVyYXRvciA9IG5hbWUgPyBvcGVyYXRvciB8fCBcIj1cIiA6IFwiXCJcbiAgcmV0dXJuICdbJyArIENPTVBPTkVOVF9BVFRSSUJVVEUgKyBvcGVyYXRvciArIG5hbWUgKyAnXSdcbn1cblxuZnVuY3Rpb24gZmluZENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3IoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSkpXG59XG5cbmZ1bmN0aW9uIGZpbmRBbGxDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSkpKVxufVxuXG5mdW5jdGlvbiBmaW5kU3ViQ29tcG9uZW50cyAobmFtZSwgcm9vdCkge1xuICB2YXIgZWxlbWVudHMgPSAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lLCBcIl49XCIpKVxuICByZXR1cm4gZmlsdGVyKGVsZW1lbnRzLCBmdW5jdGlvbiAoZWxlbWVudCwgY29tcG9uZW50TmFtZSwgbWFpbkNvbXBvbmVudE5hbWUsIHN1YkNvbXBvbmVudE5hbWUpIHtcbiAgICByZXR1cm4gc3ViQ29tcG9uZW50TmFtZSAmJiBuYW1lID09PSBtYWluQ29tcG9uZW50TmFtZVxuICB9KVxufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZShDT01QT05FTlRfQVRUUklCVVRFKVxuICByZXR1cm4gY2MgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0TWFpbkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzBdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldFN1YkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzFdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGFzc2lnblN1YkNvbXBvbmVudHMgKG9iaiwgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBhc3NpZ24pIHtcbiAgcmV0dXJuIHN1YkNvbXBvbmVudHMucmVkdWNlKGZ1bmN0aW9uIChvYmosIGVsZW1lbnQpIHtcbiAgICB2YXIgbmFtZSA9IGdldFN1YkNvbXBvbmVudE5hbWUoZWxlbWVudClcbiAgICBpZiAobmFtZSkge1xuXG4gICAgICBlbGVtZW50ID0gdHlwZW9mIHRyYW5zZm9ybSA9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgPyB0cmFuc2Zvcm0oZWxlbWVudCwgbmFtZSlcbiAgICAgICAgOiBlbGVtZW50XG5cbiAgICAgIGlmICh0eXBlb2YgYXNzaWduID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBhc3NpZ24ob2JqLCBuYW1lLCBlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShvYmpbbmFtZV0pKSB7XG4gICAgICAgIG9ialtuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb2JqW25hbWVdID0gZWxlbWVudFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqXG4gIH0sIG9iailcbn1cblxuZnVuY3Rpb24gZmlsdGVyIChlbGVtZW50cywgZmlsdGVyKSB7XG4gIHN3aXRjaCAodHlwZW9mIGZpbHRlcikge1xuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZmlsdGVyKGVsZW1lbnQsIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLCBnZXRNYWluQ29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSksIGdldFN1YkNvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50KSA9PT0gZmlsdGVyXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuIiwidmFyIHJlZ2lzdHJ5ID0gcmVxdWlyZShcIi4vcmVnaXN0cnlcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZWdpc3RlciAobmFtZSwgbWl4aW4pIHtcbiAgbWl4aW4gPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcblxuICBmdW5jdGlvbiBDdXN0b21Db21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ3VzdG9tQ29tcG9uZW50KSkge1xuICAgICAgcmV0dXJuIG5ldyBDdXN0b21Db21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgICB9XG4gICAgdmFyIGluc3RhbmNlID0gdGhpc1xuXG4gICAgQ29tcG9uZW50LmNhbGwoaW5zdGFuY2UsIGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgLy8gYXQgdGhpcyBwb2ludCBjdXN0b20gY29uc3RydWN0b3JzIGNhbiBhbHJlYWR5IGFjY2VzcyB0aGUgZWxlbWVudCBhbmQgc3ViIGNvbXBvbmVudHNcbiAgICAvLyBzbyB0aGV5IG9ubHkgcmVjZWl2ZSB0aGUgb3B0aW9ucyBvYmplY3QgZm9yIGNvbnZlbmllbmNlXG4gICAgaW50ZXJuYWxzLmNyZWF0ZShpbnN0YW5jZSwgW29wdGlvbnNdKVxuICB9XG5cbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ29tcG9uZW50LnByb3RvdHlwZSlcbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEN1c3RvbUNvbXBvbmVudFxuICB2YXIgaW50ZXJuYWxzID0gbmV3IEludGVybmFscyhDdXN0b21Db21wb25lbnQucHJvdG90eXBlKVxuICBpbnRlcm5hbHMuYXV0b0Fzc2lnbiA9IHRydWVcbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZS5pbnRlcm5hbHMgPSBpbnRlcm5hbHNcbiAgQ3VzdG9tQ29tcG9uZW50LmludGVybmFscyA9IGludGVybmFsc1xuICBtaXhpbi5mb3JFYWNoKGZ1bmN0aW9uIChtaXhpbikge1xuICAgIGlmICh0eXBlb2YgbWl4aW4gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBtaXhpbi5jYWxsKEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUsIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUsIGludGVybmFscylcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpbnRlcm5hbHMucHJvdG8obWl4aW4pXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZWdpc3RyeS5zZXQobmFtZSwgQ3VzdG9tQ29tcG9uZW50KVxuICAvLyBkZWZpbmUgbWFpbiBwcm90b3R5cGUgYWZ0ZXIgcmVnaXN0ZXJpbmdcbn1cbiIsInZhciByZWdpc3RyeSA9IG1vZHVsZS5leHBvcnRzID0ge31cblxudmFyIGNvbXBvbmVudHMgPSB7fVxuXG5yZWdpc3RyeS5nZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbbmFtZV1cbn1cblxucmVnaXN0cnkuZXhpc3RzID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lKSB7XG4gIHJldHVybiAhIWNvbXBvbmVudHNbbmFtZV1cbn1cblxucmVnaXN0cnkuc2V0ID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lLCBDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXSA9IENvbXBvbmVudENvbnN0cnVjdG9yXG59XG4iLCJ2YXIgc3RvcmFnZSA9IG1vZHVsZS5leHBvcnRzID0ge31cbnZhciBjb21wb25lbnRzID0gW11cbnZhciBlbGVtZW50cyA9IFtdXG5cbnN0b3JhZ2UuZ2V0ID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbZWxlbWVudHMuaW5kZXhPZihlbGVtZW50KV1cbn1cblxuc3RvcmFnZS5zYXZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICBjb21wb25lbnRzLnB1c2goY29tcG9uZW50KVxuICBlbGVtZW50cy5wdXNoKGNvbXBvbmVudC5lbGVtZW50KVxufVxuXG5zdG9yYWdlLnJlbW92ZSA9IGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgdmFyIGkgPSBjb21wb25lbnQgaW5zdGFuY2VvZiBFbGVtZW50XG4gICAgICA/IGVsZW1lbnRzLmluZGV4T2YoY29tcG9uZW50KVxuICAgICAgOiBjb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50KVxuXG4gIGlmICh+aSkge1xuICAgIGNvbXBvbmVudHMuc3BsaWNlKGksIDEpXG4gICAgZWxlbWVudHMuc3BsaWNlKGksIDEpXG4gIH1cbn1cblxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoIG9iaiwgZXh0ZW5zaW9uICl7XG4gIGZvciggdmFyIG5hbWUgaW4gZXh0ZW5zaW9uICl7XG4gICAgaWYoIGV4dGVuc2lvbi5oYXNPd25Qcm9wZXJ0eShuYW1lKSApIG9ialtuYW1lXSA9IGV4dGVuc2lvbltuYW1lXVxuICB9XG4gIHJldHVybiBvYmpcbn1cbiIsInZhciBleHRlbmQgPSByZXF1aXJlKFwiLi9leHRlbmRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggb2JqLCBleHRlbnNpb24gKXtcbiAgcmV0dXJuIGV4dGVuZChleHRlbmQoe30sIG9iaiksIGV4dGVuc2lvbilcbn1cbiIsInZhciBvYmplY3QgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbm9iamVjdC5hY2Nlc3NvciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGdldCwgc2V0KSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBnZXQ6IGdldCxcbiAgICBzZXQ6IHNldFxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lR2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIGdldDogZm5cbiAgfSlcbn1cblxub2JqZWN0LmRlZmluZVNldHRlciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBzZXQ6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5tZXRob2QgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgdmFsdWU6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm4sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pXG59XG4iXX0=
