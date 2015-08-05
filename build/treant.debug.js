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

  this._attributes[name] = {
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
    if (shouldRemove(value)) {
      this.element.removeAttribute(name)
    }
    else {
      value = stringifyValue ? stringifyValue(value) : value
      var old = getValue.call(this, false)
      if (old != value) {
        this.element.setAttribute(name, value)
        onchange && callOnchange != false && onchange.call(this, old, value)
      }
    }
  }

  Object.defineProperty(master, camelcase(name), {
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9zcmMvaG9va1wiKVxudmFyIHJlZ2lzdGVyID0gcmVxdWlyZShcIi4vc3JjL3JlZ2lzdGVyXCIpXG52YXIgY29tcG9uZW50ID0gcmVxdWlyZShcIi4vc3JjL2NyZWF0ZVwiKVxudmFyIHN0b3JhZ2UgPSByZXF1aXJlKFwiLi9zcmMvc3RvcmFnZVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9Db21wb25lbnRcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL3NyYy9kZWxlZ2F0ZVwiKVxudmFyIGZyYWdtZW50ID0gcmVxdWlyZShcIi4vc3JjL2ZyYWdtZW50XCIpXG5cbnZhciB0cmVhbnQgPSB7fVxubW9kdWxlLmV4cG9ydHMgPSB0cmVhbnRcblxudHJlYW50LnJlZ2lzdGVyID0gcmVnaXN0ZXJcbnRyZWFudC5jb21wb25lbnQgPSBjb21wb25lbnRcbnRyZWFudC5zdG9yYWdlID0gc3RvcmFnZVxudHJlYW50LkNvbXBvbmVudCA9IENvbXBvbmVudFxudHJlYW50LmRlbGVnYXRlID0gZGVsZWdhdGVcbnRyZWFudC5mcmFnbWVudCA9IGZyYWdtZW50XG50cmVhbnQuaG9vayA9IGhvb2tcblxudmFyIHV0aWwgPSB7fVxudHJlYW50LnV0aWwgPSB1dGlsXG5cbnV0aWwuZXh0ZW5kID0gcmVxdWlyZShcIi4vdXRpbC9leHRlbmRcIilcbnV0aWwubWVyZ2UgPSByZXF1aXJlKFwiLi91dGlsL21lcmdlXCIpXG51dGlsLm9iamVjdCA9IHJlcXVpcmUoXCIuL3V0aWwvb2JqZWN0XCIpXG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzdHIpIHtcblx0c3RyID0gc3RyLnRyaW0oKTtcblxuXHRpZiAoc3RyLmxlbmd0aCA9PT0gMSB8fCAhKC9bXy5cXC0gXSsvKS50ZXN0KHN0cikgKSB7XG5cdFx0aWYgKHN0clswXSA9PT0gc3RyWzBdLnRvTG93ZXJDYXNlKCkgJiYgc3RyLnNsaWNlKDEpICE9PSBzdHIuc2xpY2UoMSkudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRyZXR1cm4gc3RyXG5cdC5yZXBsYWNlKC9eW18uXFwtIF0rLywgJycpXG5cdC50b0xvd2VyQ2FzZSgpXG5cdC5yZXBsYWNlKC9bXy5cXC0gXSsoXFx3fCQpL2csIGZ1bmN0aW9uIChtLCBwMSkge1xuXHRcdHJldHVybiBwMS50b1VwcGVyQ2FzZSgpO1xuXHR9KTtcbn07XG4iLCJ2YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcbnZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9kZWxlZ2F0ZVwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudFxuXG5mdW5jdGlvbiBDb21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKGVsZW1lbnQgJiYgIShlbGVtZW50IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJlbGVtZW50IHNob3VsZCBiZSBhbiBFbGVtZW50IGluc3RhbmNlIG9yIG51bGxcIilcbiAgfVxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29tcG9uZW50KSkge1xuICAgIHJldHVybiBuZXcgQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gIH1cblxuICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50IHx8IG51bGxcbiAgdGhpcy5jb21wb25lbnRzID0ge31cblxuICBpZiAodGhpcy5lbGVtZW50ICYmIHRoaXMuaW50ZXJuYWxzLmF1dG9Bc3NpZ24pIHtcbiAgICB0aGlzLmFzc2lnblN1YkNvbXBvbmVudHMoKVxuICB9XG5cbiAgaWYgKHRoaXMuZWxlbWVudCkge1xuICAgIHRoaXMuaW50ZXJuYWxzLnJlc2V0QXR0cmlidXRlcyh0aGlzKVxuICB9XG59XG5cbkNvbXBvbmVudC5jcmVhdGUgPSBmdW5jdGlvbiAoZWxlbWVudCwgb3B0aW9ucykge1xuICB2YXIgbmFtZSA9IGhvb2suZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSlcblxuICBpZiAoIW5hbWUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJVbmFibGUgdG8gY3JlYXRlIGNvbXBvbmVudCwgdGhpcyBlbGVtZW50IGRvZXNuJ3QgaGF2ZSBhIGNvbXBvbmVudCBhdHRyaWJ1dGVcIiwgZWxlbWVudClcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgdmFyIENvbXBvbmVudENvbnN0cnVjdG9yID0gbnVsbFxuXG4gIGlmIChyZWdpc3RyeS5leGlzdHMobmFtZSkpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9ICByZWdpc3RyeS5nZXQobmFtZSlcbiAgfVxuICBlbHNlIGlmIChyZWdpc3RyeS5leGlzdHMoXCIqXCIpKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSByZWdpc3RyeS5nZXQoXCIqXCIpXG4gIH1cbiAgZWxzZSB7XG4gICAgY29uc29sZS53YXJuKFwiTWlzc2luZyBjdXN0b20gY29tcG9uZW50ICclcycgZm9yIFwiLCBuYW1lLCBlbGVtZW50LFxuICAgICAgICAnIFVzZSB0aGUgQ29tcG9uZW50IGNvbnN0cnVjdG9yIHRvIGNyZWF0ZSByYXcgY29tcG9uZW50cyBvciByZWdpc3RlciBhIFwiKlwiIGNvbXBvbmVudC4nKVxuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gQ29tcG9uZW50XG4gIH1cblxuICByZXR1cm4gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbkNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG4gIGludGVybmFsczogbmV3IEludGVybmFscygpLFxuXG4gIGRlbGVnYXRlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZWxlbWVudCA9IHRoaXMuZWxlbWVudFxuICAgIG9wdGlvbnMuY29udGV4dCA9IG9wdGlvbnMuY29udGV4dCB8fCB0aGlzXG4gICAgcmV0dXJuIGRlbGVnYXRlKG9wdGlvbnMpXG4gIH0sXG5cbiAgZGlzcGF0Y2g6IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IHRoaXMuaW50ZXJuYWxzLmdldEV2ZW50RGVmaW5pdGlvbih0eXBlLCBkZXRhaWwpXG4gICAgcmV0dXJuIHRoaXMuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQodHlwZSwgZGVmaW5pdGlvbikpXG4gIH0sXG5cbiAgZmluZENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZEFsbENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQWxsQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZFN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZFN1YkNvbXBvbmVudHMobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBnZXRDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRDb21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGdldE1haW5Db21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSh0aGlzLmVsZW1lbnQsIGNjKVxuICB9LFxuICBnZXRTdWJDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRTdWJDb21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGNsZWFyU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIH0sXG4gIGFzc2lnblN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICh0cmFuc2Zvcm0pIHtcbiAgICB2YXIgaG9zdENvbXBvbmVudCA9IHRoaXNcbiAgICB2YXIgc3ViQ29tcG9uZW50cyA9IGhvb2suZmluZFN1YkNvbXBvbmVudHModGhpcy5nZXRNYWluQ29tcG9uZW50TmFtZShmYWxzZSksIHRoaXMuZWxlbWVudClcbiAgICB2YXIgaW50ZXJuYWxzID0gdGhpcy5pbnRlcm5hbHNcblxuICAgIGZvciAodmFyIG5hbWUgaW4gaW50ZXJuYWxzLmNvbXBvbmVudHMpIHtcbiAgICAgIGlmIChpbnRlcm5hbHMuY29tcG9uZW50cy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgICB0aGlzLmNvbXBvbmVudHNbbmFtZV0gPSBbXVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuY29tcG9uZW50c1tuYW1lXSA9IGludGVybmFscy5jb21wb25lbnRzW25hbWVdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXN1YkNvbXBvbmVudHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAodGhpcy5pbnRlcm5hbHMuY29udmVydFN1YkNvbXBvbmVudHMgJiYgKHR5cGVvZiB0cmFuc2Zvcm0gPT0gXCJ1bmRlZmluZWRcIiB8fCB0cmFuc2Zvcm0gPT09IHRydWUpKSB7XG4gICAgICB0cmFuc2Zvcm0gPSBmdW5jdGlvbiAoZWxlbWVudC8qLCBuYW1lKi8pIHtcbiAgICAgICAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUoZWxlbWVudCwgaG9zdENvbXBvbmVudClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBob29rLmFzc2lnblN1YkNvbXBvbmVudHModGhpcy5jb21wb25lbnRzLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGZ1bmN0aW9uIChjb21wb25lbnRzLCBuYW1lLCBlbGVtZW50KSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGNvbXBvbmVudHNbbmFtZV0gfHwgW11cbiAgICAgICAgY29tcG9uZW50c1tuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxudmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcbnZhciBvYmplY3QgPSByZXF1aXJlKFwiLi4vdXRpbC9vYmplY3RcIilcblxudmFyIGRlZmF1bHRFdmVudERlZmluaXRpb24gPSB7XG4gIGRldGFpbDogbnVsbCxcbiAgdmlldzogd2luZG93LFxuICBidWJibGVzOiB0cnVlLFxuICBjYW5jZWxhYmxlOiB0cnVlXG59XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJuYWxzXG5cbmZ1bmN0aW9uIEludGVybmFscyAobWFzdGVyKSB7XG4gIHRoaXMuYXV0b0Fzc2lnbiA9IHRydWVcbiAgdGhpcy5jb252ZXJ0U3ViQ29tcG9uZW50cyA9IGZhbHNlXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIHRoaXMuX2V2ZW50cyA9IHt9XG4gIHRoaXMuX2NvbnN0cnVjdG9ycyA9IFtdXG4gIHRoaXMuX2F0dHJpYnV0ZXMgPSB7fVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIl9tYXN0ZXJcIiwge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG1hc3RlclxuICAgIH1cbiAgfSlcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5vbkNyZWF0ZSA9IGZ1bmN0aW9uIChjb25zdHJ1Y3Rvcikge1xuICB0aGlzLl9jb25zdHJ1Y3RvcnMucHVzaChjb25zdHJ1Y3RvcilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoaW5zdGFuY2UsIGFyZ3MpIHtcbiAgdGhpcy5fY29uc3RydWN0b3JzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cnVjdG9yKSB7XG4gICAgY29uc3RydWN0b3IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gIH0pXG59XG5cbkludGVybmFscy5wcm90b3R5cGUubWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5tZXRob2QodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QucHJvcGVydHkodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0LmRlZmluZUdldHRlcih0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QuZGVmaW5lR2V0dGVyKHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuYWNjZXNzb3IgPSBmdW5jdGlvbiAobmFtZSwgZ2V0LCBzZXQpIHtcbiAgb2JqZWN0LmFjY2Vzc29yKHRoaXMuX21hc3RlciwgbmFtZSwgZ2V0LCBzZXQpXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUucHJvdG8gPSBmdW5jdGlvbiAocHJvdG90eXBlKSB7XG4gIGZvciAodmFyIHByb3AgaW4gcHJvdG90eXBlKSB7XG4gICAgaWYgKHByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgaWYgKHR5cGVvZiBwcm90b3R5cGVbcHJvcF0gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGlmIChwcm9wID09PSBcIm9uQ3JlYXRlXCIpIHtcbiAgICAgICAgICB0aGlzLm9uQ3JlYXRlKHByb3RvdHlwZVtwcm9wXSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1ldGhvZChwcm9wLCBwcm90b3R5cGVbcHJvcF0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnByb3BlcnR5KHByb3AsIHByb3RvdHlwZVtwcm9wXSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5ldmVudCA9IGZ1bmN0aW9uICh0eXBlLCBkZWZpbml0aW9uKSB7XG4gIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGRlZmluaXRpb25cbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXRFdmVudERlZmluaXRpb24gPSBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gIHZhciBkZWZpbml0aW9uID0gbWVyZ2UoZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiwgdGhpcy5fZXZlbnRzW3R5cGVdKVxuICBkZWZpbml0aW9uLmRldGFpbCA9IHR5cGVvZiBkZXRhaWwgPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmluaXRpb24uZGV0YWlsIDogZGV0YWlsXG4gIHJldHVybiBkZWZpbml0aW9uXG59XG5cbkludGVybmFscy5wcm90b3R5cGUucmVzZXRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKGluc3RhbmNlKSB7XG4gIGZvciAodmFyIG5hbWUgaW4gdGhpcy5fYXR0cmlidXRlcykge1xuICAgIGlmICh0aGlzLl9hdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICB0aGlzLl9hdHRyaWJ1dGVzW25hbWVdLnNldC5jYWxsKGluc3RhbmNlLCBpbnN0YW5jZVtuYW1lXSwgZmFsc2UpXG4gICAgfVxuICB9XG59XG5cbkludGVybmFscy5wcm90b3R5cGUuYXR0cmlidXRlID0gZnVuY3Rpb24gKG5hbWUsIGRlZikge1xuICB2YXIgbWFzdGVyID0gdGhpcy5fbWFzdGVyXG4gIGlmICghbWFzdGVyKSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGlmIChkZWYgPT0gbnVsbCkge1xuICAgIGRlZiA9IHt9XG4gIH1cblxuICB2YXIgdHlwZU9mRGVmID0gdHlwZW9mIGRlZlxuICB2YXIgdHlwZVxuICB2YXIgZGVmYXVsdFZhbHVlXG4gIHZhciBnZXR0ZXJcbiAgdmFyIHNldHRlclxuICB2YXIgb25jaGFuZ2VcblxuICBzd2l0Y2ggKHR5cGVPZkRlZikge1xuICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIC8vIHRoZSBkZWZpbml0aW9uIGlzIGEgcHJpbWl0aXZlIHZhbHVlXG4gICAgICB0eXBlID0gdHlwZU9mRGVmXG4gICAgICBkZWZhdWx0VmFsdWUgPSBkZWZcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcIm9iamVjdFwiOlxuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBvciBhIGRlZmluaXRpb24gb2JqZWN0XG4gICAgICBkZWZhdWx0VmFsdWUgPSB0eXBlb2YgZGVmW1wiZGVmYXVsdFwiXSA9PSBcInVuZGVmaW5lZFwiID8gbnVsbCA6IGRlZltcImRlZmF1bHRcIl1cbiAgICAgIGlmICh0eXBlb2YgZGVmW1widHlwZVwiXSA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGlmIChkZWZhdWx0VmFsdWUgPT0gbnVsbCkge1xuICAgICAgICAgIHR5cGUgPSBcInN0cmluZ1wiXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdHlwZSA9IHR5cGVvZiBkZWZhdWx0VmFsdWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHR5cGUgPSBkZWZbXCJ0eXBlXCJdXG4gICAgICB9XG4gICAgICBnZXR0ZXIgPSBkZWZbXCJnZXRcIl1cbiAgICAgIHNldHRlciA9IGRlZltcInNldFwiXVxuICAgICAgb25jaGFuZ2UgPSBkZWZbXCJvbmNoYW5nZVwiXVxuICB9XG5cbiAgdmFyIHBhcnNlVmFsdWVcbiAgdmFyIHN0cmluZ2lmeVZhbHVlXG4gIHZhciBzaG91bGRSZW1vdmVcblxuICBzaG91bGRSZW1vdmUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgfVxuXG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgICBzaG91bGRSZW1vdmUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09PSBmYWxzZSB9XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSAhPSBudWxsIH1cbiAgICAgIHN0cmluZ2lmeVZhbHVlID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gXCJcIiB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgPyBudWxsIDogcGFyc2VJbnQodmFsdWUsIDEwKSB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiBwYXJzZUZsb2F0KHZhbHVlKSB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICBkZWZhdWx0OlxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgPyBudWxsIDogdmFsdWUgPyBcIlwiK3ZhbHVlIDogXCJcIiB9XG4gIH1cblxuICB0aGlzLl9hdHRyaWJ1dGVzW25hbWVdID0ge1xuICAgIGdldDogZ2V0VmFsdWUsXG4gICAgc2V0OiBzZXRWYWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0VmFsdWUodXNlRGVmYXVsdCkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICBpZiAodmFsdWUgPT0gbnVsbCAmJiB1c2VEZWZhdWx0ICE9IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlXG4gICAgfVxuICAgIHJldHVybiBwYXJzZVZhbHVlID8gcGFyc2VWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0VmFsdWUodmFsdWUsIGNhbGxPbmNoYW5nZSkge1xuICAgIGlmIChzaG91bGRSZW1vdmUodmFsdWUpKSB7XG4gICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFsdWUgPSBzdHJpbmdpZnlWYWx1ZSA/IHN0cmluZ2lmeVZhbHVlKHZhbHVlKSA6IHZhbHVlXG4gICAgICB2YXIgb2xkID0gZ2V0VmFsdWUuY2FsbCh0aGlzLCBmYWxzZSlcbiAgICAgIGlmIChvbGQgIT0gdmFsdWUpIHtcbiAgICAgICAgdGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgICAgICAgb25jaGFuZ2UgJiYgY2FsbE9uY2hhbmdlICE9IGZhbHNlICYmIG9uY2hhbmdlLmNhbGwodGhpcywgb2xkLCB2YWx1ZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobWFzdGVyLCBjYW1lbGNhc2UobmFtZSksIHtcbiAgICBnZXQ6IGdldHRlciB8fCBnZXRWYWx1ZSxcbiAgICBzZXQ6IHNldHRlciB8fCBzZXRWYWx1ZVxuICB9KVxuXG4gIHJldHVybiB0aGlzXG59XG4iLCJ2YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRcblxuZnVuY3Rpb24gY29tcG9uZW50IChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIHZhciBlbGVtZW50ID0gbnVsbFxuXG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiKVxuICBpZiAodHlwZW9mIG5hbWUgPT0gXCJzdHJpbmdcIikge1xuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICAgIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgICAgb3B0aW9ucyA9IHJvb3RcbiAgICAgIHJvb3QgPSBudWxsXG4gICAgfVxuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywgRWxlbWVudF0pXG4gICAgZWxlbWVudCA9IGhvb2suZmluZENvbXBvbmVudChuYW1lLCByb290KVxuICB9XG4gIC8vIGNvbXBvbmVudChFbGVtZW50Wywge31dKVxuICBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIGVsZW1lbnQgPSBuYW1lXG4gICAgb3B0aW9ucyA9IHJvb3RcbiAgICByb290ID0gbnVsbFxuICB9XG5cbiAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUoZWxlbWVudCwgb3B0aW9ucylcbn1cblxuY29tcG9uZW50LmFsbCA9IGZ1bmN0aW9uIChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIHZhciBlbGVtZW50cyA9IFtdXG5cbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCIpXG4gIGlmICh0eXBlb2YgbmFtZSA9PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCB7fV0pXG4gICAgaWYgKCEocm9vdCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgICBvcHRpb25zID0gcm9vdFxuICAgICAgcm9vdCA9IG51bGxcbiAgICB9XG4gICAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCBFbGVtZW50XSlcbiAgICBlbGVtZW50cyA9IGhvb2suZmluZEFsbENvbXBvbmVudChuYW1lLCByb290KVxuICB9XG4gIC8vIGNvbXBvbmVudChFbGVtZW50W11bLCB7fV0pXG4gIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkobmFtZSkpIHtcbiAgICBlbGVtZW50cyA9IG5hbWVcbiAgICBvcHRpb25zID0gcm9vdFxuICAgIHJvb3QgPSBudWxsXG4gIH1cblxuICByZXR1cm4gW10ubWFwLmNhbGwoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUoZWxlbWVudCwgb3B0aW9ucylcbiAgfSlcbn1cbiIsIi8qKlxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIG9uIGFuIGVsZW1lbnRcbiAqIGFuZCByZXR1cm5zIGEgZGVsZWdhdG9yLlxuICogQSBkZWxlZ2F0ZWQgZXZlbnQgcnVucyBtYXRjaGVzIHRvIGZpbmQgYW4gZXZlbnQgdGFyZ2V0LFxuICogdGhlbiBleGVjdXRlcyB0aGUgaGFuZGxlciBwYWlyZWQgd2l0aCB0aGUgbWF0Y2hlci5cbiAqIE1hdGNoZXJzIGNhbiBjaGVjayBpZiBhbiBldmVudCB0YXJnZXQgbWF0Y2hlcyBhIGdpdmVuIHNlbGVjdG9yLFxuICogb3Igc2VlIGlmIGFuIG9mIGl0cyBwYXJlbnRzIGRvLlxuICogKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVsZWdhdGUoIG9wdGlvbnMgKXtcbiAgICB2YXIgZWxlbWVudCA9IG9wdGlvbnMuZWxlbWVudFxuICAgICAgICAsIGV2ZW50ID0gb3B0aW9ucy5ldmVudFxuICAgICAgICAsIGNhcHR1cmUgPSAhIW9wdGlvbnMuY2FwdHVyZXx8ZmFsc2VcbiAgICAgICAgLCBjb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0fHxlbGVtZW50XG5cbiAgICBpZiggIWVsZW1lbnQgKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYW4ndCBkZWxlZ2F0ZSB1bmRlZmluZWQgZWxlbWVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBpZiggIWV2ZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGV2ZW50XCIpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIGRlbGVnYXRvciA9IGNyZWF0ZURlbGVnYXRvcihjb250ZXh0KVxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGVsZWdhdG9yLCBjYXB0dXJlKVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG4vKipcbiAqIFJldHVybnMgYSBkZWxlZ2F0b3IgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBldmVudCBsaXN0ZW5lci5cbiAqIFRoZSBkZWxlZ2F0b3IgaGFzIHN0YXRpYyBtZXRob2RzIHdoaWNoIGNhbiBiZSB1c2VkIHRvIHJlZ2lzdGVyIGhhbmRsZXJzLlxuICogKi9cbmZ1bmN0aW9uIGNyZWF0ZURlbGVnYXRvciggY29udGV4dCApe1xuICAgIHZhciBtYXRjaGVycyA9IFtdXG5cbiAgICBmdW5jdGlvbiBkZWxlZ2F0b3IoIGUgKXtcbiAgICAgICAgdmFyIGwgPSBtYXRjaGVycy5sZW5ndGhcbiAgICAgICAgaWYoICFsICl7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVsID0gdGhpc1xuICAgICAgICAgICAgLCBpID0gLTFcbiAgICAgICAgICAgICwgaGFuZGxlclxuICAgICAgICAgICAgLCBzZWxlY3RvclxuICAgICAgICAgICAgLCBkZWxlZ2F0ZUVsZW1lbnRcbiAgICAgICAgICAgICwgc3RvcFByb3BhZ2F0aW9uXG4gICAgICAgICAgICAsIGFyZ3NcblxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgYXJncyA9IG1hdGNoZXJzW2ldXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXVxuICAgICAgICAgICAgc2VsZWN0b3IgPSBhcmdzWzFdXG5cbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IG1hdGNoQ2FwdHVyZVBhdGgoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICAgICAgaWYoIGRlbGVnYXRlRWxlbWVudCAmJiBkZWxlZ2F0ZUVsZW1lbnQubGVuZ3RoICkge1xuICAgICAgICAgICAgICAgIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlID09PSBoYW5kbGVyLmFwcGx5KGNvbnRleHQsIFtlXS5jb25jYXQoZGVsZWdhdGVFbGVtZW50KSlcbiAgICAgICAgICAgICAgICBpZiggc3RvcFByb3BhZ2F0aW9uICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIGhhbmRsZXIgd2l0aCBhIHRhcmdldCBmaW5kZXIgbG9naWNcbiAgICAgKiAqL1xuICAgIGRlbGVnYXRvci5tYXRjaCA9IGZ1bmN0aW9uKCBzZWxlY3RvciwgaGFuZGxlciApe1xuICAgICAgICBtYXRjaGVycy5wdXNoKFtoYW5kbGVyLCBzZWxlY3Rvcl0pXG4gICAgICAgIHJldHVybiBkZWxlZ2F0b3JcbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZWdhdG9yXG59XG5cbmZ1bmN0aW9uIG1hdGNoQ2FwdHVyZVBhdGgoIHNlbGVjdG9yLCBlbCwgZSApe1xuICAgIHZhciBkZWxlZ2F0ZUVsZW1lbnRzID0gW11cbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50ID0gbnVsbFxuICAgIGlmKCBBcnJheS5pc0FycmF5KHNlbGVjdG9yKSApe1xuICAgICAgICB2YXIgaSA9IC0xXG4gICAgICAgIHZhciBsID0gc2VsZWN0b3IubGVuZ3RoXG4gICAgICAgIHdoaWxlKCArK2kgPCBsICl7XG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yW2ldLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCAhZGVsZWdhdGVFbGVtZW50ICkgcmV0dXJuIG51bGxcbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IGZpbmRQYXJlbnQoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgfVxuICAgIHJldHVybiBkZWxlZ2F0ZUVsZW1lbnRzXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIHRhcmdldCBvciBhbnkgb2YgaXRzIHBhcmVudCBtYXRjaGVzIGEgc2VsZWN0b3JcbiAqICovXG5mdW5jdGlvbiBmaW5kUGFyZW50KCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXRcbiAgICBzd2l0Y2goIHR5cGVvZiBzZWxlY3RvciApe1xuICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgICAgICB3aGlsZSggdGFyZ2V0ICYmIHRhcmdldCAhPSBlbCApe1xuICAgICAgICAgICAgICAgIGlmKCB0YXJnZXQubWF0Y2hlcyhzZWxlY3RvcikgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggc2VsZWN0b3IuY2FsbChlbCwgdGFyZ2V0KSApIHJldHVybiB0YXJnZXRcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIHJldHVybiBudWxsXG59XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZyYWdtZW50XG5cbmZyYWdtZW50Lm9wdGlvbnMgPSB7XG4gIHZhcmlhYmxlOiBcImZcIlxufVxuXG5mdW5jdGlvbiBmcmFnbWVudCggaHRtbCwgY29tcGlsZXIsIGNvbXBpbGVyT3B0aW9ucyApe1xuICBjb21waWxlck9wdGlvbnMgPSBtZXJnZShmcmFnbWVudC5vcHRpb25zLCBjb21waWxlck9wdGlvbnMpXG4gIHZhciByZW5kZXIgPSBudWxsXG4gIHJldHVybiBmdW5jdGlvbiggdGVtcGxhdGVEYXRhICl7XG4gICAgdmFyIHRlbXAgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgIGlmKCB0eXBlb2YgY29tcGlsZXIgPT0gXCJmdW5jdGlvblwiICYmICFyZW5kZXIgKXtcbiAgICAgIHJlbmRlciA9IGNvbXBpbGVyKGh0bWwsIGNvbXBpbGVyT3B0aW9ucylcbiAgICB9XG4gICAgaWYoIHJlbmRlciApe1xuICAgICAgdHJ5e1xuICAgICAgICBodG1sID0gcmVuZGVyKHRlbXBsYXRlRGF0YSlcbiAgICAgIH1cbiAgICAgIGNhdGNoKCBlICl7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZW5kZXJpbmcgZnJhZ21lbnQgd2l0aCBjb250ZXh0OlwiLCB0ZW1wbGF0ZURhdGEpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVuZGVyLnRvU3RyaW5nKCkpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgIH1cblxuICAgIHRlbXAuaW5uZXJIVE1MID0gaHRtbFxuICAgIHZhciBmcmFnbWVudCA9IHdpbmRvdy5kb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcbiAgICB3aGlsZSggdGVtcC5jaGlsZE5vZGVzLmxlbmd0aCApe1xuICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGVtcC5maXJzdENoaWxkKVxuICAgIH1cbiAgICByZXR1cm4gZnJhZ21lbnRcbiAgfVxufVxuZnJhZ21lbnQucmVuZGVyID0gZnVuY3Rpb24oIGh0bWwsIHRlbXBsYXRlRGF0YSApe1xuICByZXR1cm4gZnJhZ21lbnQoaHRtbCkodGVtcGxhdGVEYXRhKVxufVxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBDT01QT05FTlRfQVRUUklCVVRFID0gXCJkYXRhLWNvbXBvbmVudFwiXG5cbnZhciBob29rID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG5ob29rLnNldEhvb2tBdHRyaWJ1dGUgPSBzZXRIb29rQXR0cmlidXRlXG5ob29rLmNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yID0gY3JlYXRlQ29tcG9uZW50U2VsZWN0b3Jcbmhvb2suZmluZENvbXBvbmVudCA9IGZpbmRDb21wb25lbnRcbmhvb2suZmluZEFsbENvbXBvbmVudCA9IGZpbmRBbGxDb21wb25lbnRcbmhvb2suZmluZFN1YkNvbXBvbmVudHMgPSBmaW5kU3ViQ29tcG9uZW50c1xuaG9vay5nZXRDb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZVxuaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSA9IGdldE1haW5Db21wb25lbnROYW1lXG5ob29rLmdldFN1YkNvbXBvbmVudE5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lXG5ob29rLmFzc2lnblN1YkNvbXBvbmVudHMgPSBhc3NpZ25TdWJDb21wb25lbnRzXG5ob29rLmZpbHRlciA9IGZpbHRlclxuXG5mdW5jdGlvbiBzZXRIb29rQXR0cmlidXRlIChob29rKSB7XG4gIENPTVBPTkVOVF9BVFRSSUJVVEUgPSBob29rXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yIChuYW1lLCBvcGVyYXRvcikge1xuICBuYW1lID0gbmFtZSAmJiAnXCInICsgbmFtZSArICdcIidcbiAgb3BlcmF0b3IgPSBuYW1lID8gb3BlcmF0b3IgfHwgXCI9XCIgOiBcIlwiXG4gIHJldHVybiAnWycgKyBDT01QT05FTlRfQVRUUklCVVRFICsgb3BlcmF0b3IgKyBuYW1lICsgJ10nXG59XG5cbmZ1bmN0aW9uIGZpbmRDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUpKVxufVxuXG5mdW5jdGlvbiBmaW5kQWxsQ29tcG9uZW50IChuYW1lLCByb290KSB7XG4gIHJldHVybiBbXS5zbGljZS5jYWxsKChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUpKSlcbn1cblxuZnVuY3Rpb24gZmluZFN1YkNvbXBvbmVudHMgKG5hbWUsIHJvb3QpIHtcbiAgdmFyIGVsZW1lbnRzID0gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSwgXCJePVwiKSlcbiAgcmV0dXJuIGZpbHRlcihlbGVtZW50cywgZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUsIG1haW5Db21wb25lbnROYW1lLCBzdWJDb21wb25lbnROYW1lKSB7XG4gICAgcmV0dXJuIHN1YkNvbXBvbmVudE5hbWUgJiYgbmFtZSA9PT0gbWFpbkNvbXBvbmVudE5hbWVcbiAgfSlcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoQ09NUE9ORU5UX0FUVFJJQlVURSlcbiAgcmV0dXJuIGNjID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldE1haW5Db21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKS5zcGxpdChcIjpcIilcbiAgdmFsdWUgPSB2YWx1ZVswXSB8fCBcIlwiXG4gIHJldHVybiBjYyAmJiB2YWx1ZSA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRTdWJDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKS5zcGxpdChcIjpcIilcbiAgdmFsdWUgPSB2YWx1ZVsxXSB8fCBcIlwiXG4gIHJldHVybiBjYyAmJiB2YWx1ZSA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBhc3NpZ25TdWJDb21wb25lbnRzIChvYmosIHN1YkNvbXBvbmVudHMsIHRyYW5zZm9ybSwgYXNzaWduKSB7XG4gIHJldHVybiBzdWJDb21wb25lbnRzLnJlZHVjZShmdW5jdGlvbiAob2JqLCBlbGVtZW50KSB7XG4gICAgdmFyIG5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lKGVsZW1lbnQpXG4gICAgaWYgKG5hbWUpIHtcblxuICAgICAgZWxlbWVudCA9IHR5cGVvZiB0cmFuc2Zvcm0gPT0gXCJmdW5jdGlvblwiXG4gICAgICAgID8gdHJhbnNmb3JtKGVsZW1lbnQsIG5hbWUpXG4gICAgICAgIDogZWxlbWVudFxuXG4gICAgICBpZiAodHlwZW9mIGFzc2lnbiA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgYXNzaWduKG9iaiwgbmFtZSwgZWxlbWVudClcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKEFycmF5LmlzQXJyYXkob2JqW25hbWVdKSkge1xuICAgICAgICBvYmpbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG9ialtuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9ialxuICB9LCBvYmopXG59XG5cbmZ1bmN0aW9uIGZpbHRlciAoZWxlbWVudHMsIGZpbHRlcikge1xuICBzd2l0Y2ggKHR5cGVvZiBmaWx0ZXIpIHtcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGZpbHRlcihlbGVtZW50LCBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSwgZ2V0TWFpbkNvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLCBnZXRTdWJDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSlcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCkgPT09IGZpbHRlclxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsInZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgSW50ZXJuYWxzID0gcmVxdWlyZShcIi4vSW50ZXJuYWxzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcmVnaXN0ZXIgKG5hbWUsIG1peGluKSB7XG4gIG1peGluID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG5cbiAgZnVuY3Rpb24gQ3VzdG9tQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEN1c3RvbUNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiBuZXcgQ3VzdG9tQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgfVxuICAgIHZhciBpbnN0YW5jZSA9IHRoaXNcblxuICAgIENvbXBvbmVudC5jYWxsKGluc3RhbmNlLCBlbGVtZW50LCBvcHRpb25zKVxuICAgIC8vIGF0IHRoaXMgcG9pbnQgY3VzdG9tIGNvbnN0cnVjdG9ycyBjYW4gYWxyZWFkeSBhY2Nlc3MgdGhlIGVsZW1lbnQgYW5kIHN1YiBjb21wb25lbnRzXG4gICAgLy8gc28gdGhleSBvbmx5IHJlY2VpdmUgdGhlIG9wdGlvbnMgb2JqZWN0IGZvciBjb252ZW5pZW5jZVxuICAgIGludGVybmFscy5jcmVhdGUoaW5zdGFuY2UsIFtvcHRpb25zXSlcbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKENvbXBvbmVudC5wcm90b3R5cGUpXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDdXN0b21Db21wb25lbnRcbiAgdmFyIGludGVybmFscyA9IG5ldyBJbnRlcm5hbHMoQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSlcbiAgaW50ZXJuYWxzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuaW50ZXJuYWxzID0gaW50ZXJuYWxzXG4gIEN1c3RvbUNvbXBvbmVudC5pbnRlcm5hbHMgPSBpbnRlcm5hbHNcbiAgbWl4aW4uZm9yRWFjaChmdW5jdGlvbiAobWl4aW4pIHtcbiAgICBpZiAodHlwZW9mIG1peGluID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgbWl4aW4uY2FsbChDdXN0b21Db21wb25lbnQucHJvdG90eXBlLCBDdXN0b21Db21wb25lbnQucHJvdG90eXBlLCBpbnRlcm5hbHMpXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgaW50ZXJuYWxzLnByb3RvKG1peGluKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gcmVnaXN0cnkuc2V0KG5hbWUsIEN1c3RvbUNvbXBvbmVudClcbiAgLy8gZGVmaW5lIG1haW4gcHJvdG90eXBlIGFmdGVyIHJlZ2lzdGVyaW5nXG59XG4iLCJ2YXIgcmVnaXN0cnkgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbnZhciBjb21wb25lbnRzID0ge31cblxucmVnaXN0cnkuZ2V0ID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdXG59XG5cbnJlZ2lzdHJ5LmV4aXN0cyA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gISFjb21wb25lbnRzW25hbWVdXG59XG5cbnJlZ2lzdHJ5LnNldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSwgQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbbmFtZV0gPSBDb21wb25lbnRDb25zdHJ1Y3RvclxufVxuIiwidmFyIHN0b3JhZ2UgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG52YXIgY29tcG9uZW50cyA9IFtdXG52YXIgZWxlbWVudHMgPSBbXVxuXG5zdG9yYWdlLmdldCA9IGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gIHJldHVybiBjb21wb25lbnRzW2VsZW1lbnRzLmluZGV4T2YoZWxlbWVudCldXG59XG5cbnN0b3JhZ2Uuc2F2ZSA9IGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudClcbiAgZWxlbWVudHMucHVzaChjb21wb25lbnQuZWxlbWVudClcbn1cblxuc3RvcmFnZS5yZW1vdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gIHZhciBpID0gY29tcG9uZW50IGluc3RhbmNlb2YgRWxlbWVudFxuICAgICAgPyBlbGVtZW50cy5pbmRleE9mKGNvbXBvbmVudClcbiAgICAgIDogY29tcG9uZW50cy5pbmRleE9mKGNvbXBvbmVudClcblxuICBpZiAofmkpIHtcbiAgICBjb21wb25lbnRzLnNwbGljZShpLCAxKVxuICAgIGVsZW1lbnRzLnNwbGljZShpLCAxKVxuICB9XG59XG5cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZXh0ZW5kKCBvYmosIGV4dGVuc2lvbiApe1xuICBmb3IoIHZhciBuYW1lIGluIGV4dGVuc2lvbiApe1xuICAgIGlmKCBleHRlbnNpb24uaGFzT3duUHJvcGVydHkobmFtZSkgKSBvYmpbbmFtZV0gPSBleHRlbnNpb25bbmFtZV1cbiAgfVxuICByZXR1cm4gb2JqXG59XG4iLCJ2YXIgZXh0ZW5kID0gcmVxdWlyZShcIi4vZXh0ZW5kXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oIG9iaiwgZXh0ZW5zaW9uICl7XG4gIHJldHVybiBleHRlbmQoZXh0ZW5kKHt9LCBvYmopLCBleHRlbnNpb24pXG59XG4iLCJ2YXIgb2JqZWN0ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG5vYmplY3QuYWNjZXNzb3IgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBnZXQsIHNldCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBnZXQsXG4gICAgc2V0OiBzZXRcbiAgfSlcbn1cblxub2JqZWN0LmRlZmluZUdldHRlciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBnZXQ6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVTZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgc2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QubWV0aG9kID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmblxuICB9KVxufVxuXG5vYmplY3QucHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgdmFsdWU6IGZuLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KVxufVxuIl19
