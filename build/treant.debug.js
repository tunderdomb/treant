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

    if (!subComponents.length) {
      return
    }

    if (this.internals.convertSubComponents && (typeof transform == "undefined" || transform === true)) {
      transform = function (element/*, name*/) {
        return Component.create(element, hostComponent)
      }
    }

    var internals = this.internals

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
      parseValue = function (value) { return parseInt(value, 10) }
      break
    case "float":
      parseValue = function (value) { return parseFloat(value) }
      break
    case "string":
    default:
      stringifyValue = function (value) { return value ? ""+value : "" }
  }

  Object.defineProperty(master, camelcase(name), {
    get: getter || function () {
      var value = this.element.getAttribute(name)
      if (value == null) {
        return defaultValue
      }
      return parseValue ? parseValue(value) : value
    },
    set: setter || function (value) {
      if (shouldRemove(value)) {
        this.element.removeAttribute(name)
      }
      else {
        value = stringifyValue ? stringifyValue(value) : stringifyValue
        this.element.setAttribute(name, value)
      }
    }
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
    // component("string", Element)
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9zcmMvaG9va1wiKVxudmFyIHJlZ2lzdGVyID0gcmVxdWlyZShcIi4vc3JjL3JlZ2lzdGVyXCIpXG52YXIgY29tcG9uZW50ID0gcmVxdWlyZShcIi4vc3JjL2NyZWF0ZVwiKVxudmFyIHN0b3JhZ2UgPSByZXF1aXJlKFwiLi9zcmMvc3RvcmFnZVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9Db21wb25lbnRcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL3NyYy9kZWxlZ2F0ZVwiKVxudmFyIGZyYWdtZW50ID0gcmVxdWlyZShcIi4vc3JjL2ZyYWdtZW50XCIpXG5cbnZhciB0cmVhbnQgPSB7fVxubW9kdWxlLmV4cG9ydHMgPSB0cmVhbnRcblxudHJlYW50LnJlZ2lzdGVyID0gcmVnaXN0ZXJcbnRyZWFudC5jb21wb25lbnQgPSBjb21wb25lbnRcbnRyZWFudC5zdG9yYWdlID0gc3RvcmFnZVxudHJlYW50LkNvbXBvbmVudCA9IENvbXBvbmVudFxudHJlYW50LmRlbGVnYXRlID0gZGVsZWdhdGVcbnRyZWFudC5mcmFnbWVudCA9IGZyYWdtZW50XG50cmVhbnQuaG9vayA9IGhvb2tcblxudmFyIHV0aWwgPSB7fVxudHJlYW50LnV0aWwgPSB1dGlsXG5cbnV0aWwuZXh0ZW5kID0gcmVxdWlyZShcIi4vdXRpbC9leHRlbmRcIilcbnV0aWwubWVyZ2UgPSByZXF1aXJlKFwiLi91dGlsL21lcmdlXCIpXG51dGlsLm9iamVjdCA9IHJlcXVpcmUoXCIuL3V0aWwvb2JqZWN0XCIpXG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzdHIpIHtcblx0c3RyID0gc3RyLnRyaW0oKTtcblxuXHRpZiAoc3RyLmxlbmd0aCA9PT0gMSB8fCAhKC9bXy5cXC0gXSsvKS50ZXN0KHN0cikgKSB7XG5cdFx0aWYgKHN0clswXSA9PT0gc3RyWzBdLnRvTG93ZXJDYXNlKCkgJiYgc3RyLnNsaWNlKDEpICE9PSBzdHIuc2xpY2UoMSkudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRyZXR1cm4gc3RyXG5cdC5yZXBsYWNlKC9eW18uXFwtIF0rLywgJycpXG5cdC50b0xvd2VyQ2FzZSgpXG5cdC5yZXBsYWNlKC9bXy5cXC0gXSsoXFx3fCQpL2csIGZ1bmN0aW9uIChtLCBwMSkge1xuXHRcdHJldHVybiBwMS50b1VwcGVyQ2FzZSgpO1xuXHR9KTtcbn07XG4iLCJ2YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcbnZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9kZWxlZ2F0ZVwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudFxuXG5mdW5jdGlvbiBDb21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKGVsZW1lbnQgJiYgIShlbGVtZW50IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJlbGVtZW50IHNob3VsZCBiZSBhbiBFbGVtZW50IGluc3RhbmNlIG9yIG51bGxcIilcbiAgfVxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29tcG9uZW50KSkge1xuICAgIHJldHVybiBuZXcgQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gIH1cblxuICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50IHx8IG51bGxcbiAgdGhpcy5jb21wb25lbnRzID0ge31cblxuICBpZiAodGhpcy5lbGVtZW50ICYmIHRoaXMuaW50ZXJuYWxzLmF1dG9Bc3NpZ24pIHtcbiAgICB0aGlzLmFzc2lnblN1YkNvbXBvbmVudHMoKVxuICB9XG59XG5cbkNvbXBvbmVudC5jcmVhdGUgPSBmdW5jdGlvbiAoZWxlbWVudCwgb3B0aW9ucykge1xuICB2YXIgbmFtZSA9IGhvb2suZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSlcblxuICBpZiAoIW5hbWUpIHtcbiAgICBjb25zb2xlLndhcm4oXCJVbmFibGUgdG8gY3JlYXRlIGNvbXBvbmVudCwgdGhpcyBlbGVtZW50IGRvZXNuJ3QgaGF2ZSBhIGNvbXBvbmVudCBhdHRyaWJ1dGVcIiwgZWxlbWVudClcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgdmFyIENvbXBvbmVudENvbnN0cnVjdG9yID0gbnVsbFxuXG4gIGlmIChyZWdpc3RyeS5leGlzdHMobmFtZSkpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9ICByZWdpc3RyeS5nZXQobmFtZSlcbiAgfVxuICBlbHNlIGlmIChyZWdpc3RyeS5leGlzdHMoXCIqXCIpKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSByZWdpc3RyeS5nZXQoXCIqXCIpXG4gIH1cbiAgZWxzZSB7XG4gICAgY29uc29sZS53YXJuKFwiTWlzc2luZyBjdXN0b20gY29tcG9uZW50ICclcycgZm9yIFwiLCBuYW1lLCBlbGVtZW50LFxuICAgICAgICAnIFVzZSB0aGUgQ29tcG9uZW50IGNvbnN0cnVjdG9yIHRvIGNyZWF0ZSByYXcgY29tcG9uZW50cyBvciByZWdpc3RlciBhIFwiKlwiIGNvbXBvbmVudC4nKVxuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gQ29tcG9uZW50XG4gIH1cblxuICByZXR1cm4gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbkNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG4gIGludGVybmFsczogbmV3IEludGVybmFscygpLFxuXG4gIGRlbGVnYXRlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZWxlbWVudCA9IHRoaXMuZWxlbWVudFxuICAgIG9wdGlvbnMuY29udGV4dCA9IG9wdGlvbnMuY29udGV4dCB8fCB0aGlzXG4gICAgcmV0dXJuIGRlbGVnYXRlKG9wdGlvbnMpXG4gIH0sXG5cbiAgZGlzcGF0Y2g6IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IHRoaXMuaW50ZXJuYWxzLmdldEV2ZW50RGVmaW5pdGlvbih0eXBlLCBkZXRhaWwpXG4gICAgcmV0dXJuIHRoaXMuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQodHlwZSwgZGVmaW5pdGlvbikpXG4gIH0sXG5cbiAgZmluZENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZEFsbENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQWxsQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZFN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZFN1YkNvbXBvbmVudHMobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBnZXRDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRDb21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGdldE1haW5Db21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSh0aGlzLmVsZW1lbnQsIGNjKVxuICB9LFxuICBnZXRTdWJDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRTdWJDb21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGNsZWFyU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIH0sXG4gIGFzc2lnblN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICh0cmFuc2Zvcm0pIHtcbiAgICB2YXIgaG9zdENvbXBvbmVudCA9IHRoaXNcbiAgICB2YXIgc3ViQ29tcG9uZW50cyA9IGhvb2suZmluZFN1YkNvbXBvbmVudHModGhpcy5nZXRNYWluQ29tcG9uZW50TmFtZShmYWxzZSksIHRoaXMuZWxlbWVudClcblxuICAgIGlmICghc3ViQ29tcG9uZW50cy5sZW5ndGgpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICh0aGlzLmludGVybmFscy5jb252ZXJ0U3ViQ29tcG9uZW50cyAmJiAodHlwZW9mIHRyYW5zZm9ybSA9PSBcInVuZGVmaW5lZFwiIHx8IHRyYW5zZm9ybSA9PT0gdHJ1ZSkpIHtcbiAgICAgIHRyYW5zZm9ybSA9IGZ1bmN0aW9uIChlbGVtZW50LyosIG5hbWUqLykge1xuICAgICAgICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShlbGVtZW50LCBob3N0Q29tcG9uZW50KVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBpbnRlcm5hbHMgPSB0aGlzLmludGVybmFsc1xuXG4gICAgaG9vay5hc3NpZ25TdWJDb21wb25lbnRzKHRoaXMuY29tcG9uZW50cywgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBmdW5jdGlvbiAoY29tcG9uZW50cywgbmFtZSwgZWxlbWVudCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV0pKSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBjb21wb25lbnRzW25hbWVdIHx8IFtdXG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBtZXJnZSA9IHJlcXVpcmUoXCIuLi91dGlsL21lcmdlXCIpXG52YXIgb2JqZWN0ID0gcmVxdWlyZShcIi4uL3V0aWwvb2JqZWN0XCIpXG5cbnZhciBkZWZhdWx0RXZlbnREZWZpbml0aW9uID0ge1xuICBkZXRhaWw6IG51bGwsXG4gIHZpZXc6IHdpbmRvdyxcbiAgYnViYmxlczogdHJ1ZSxcbiAgY2FuY2VsYWJsZTogdHJ1ZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVybmFsc1xuXG5mdW5jdGlvbiBJbnRlcm5hbHMgKG1hc3Rlcikge1xuICB0aGlzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIHRoaXMuY29udmVydFN1YkNvbXBvbmVudHMgPSBmYWxzZVxuICB0aGlzLmNvbXBvbmVudHMgPSB7fVxuICB0aGlzLl9ldmVudHMgPSB7fVxuICB0aGlzLl9jb25zdHJ1Y3RvcnMgPSBbXVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIl9tYXN0ZXJcIiwge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG1hc3RlclxuICAgIH1cbiAgfSlcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5vbkNyZWF0ZSA9IGZ1bmN0aW9uIChjb25zdHJ1Y3Rvcikge1xuICB0aGlzLl9jb25zdHJ1Y3RvcnMucHVzaChjb25zdHJ1Y3RvcilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoaW5zdGFuY2UsIGFyZ3MpIHtcbiAgdGhpcy5fY29uc3RydWN0b3JzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cnVjdG9yKSB7XG4gICAgY29uc3RydWN0b3IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gIH0pXG59XG5cbkludGVybmFscy5wcm90b3R5cGUubWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5tZXRob2QodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QucHJvcGVydHkodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0LmRlZmluZUdldHRlcih0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QuZGVmaW5lR2V0dGVyKHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuYWNjZXNzb3IgPSBmdW5jdGlvbiAobmFtZSwgZ2V0LCBzZXQpIHtcbiAgb2JqZWN0LmFjY2Vzc29yKHRoaXMuX21hc3RlciwgbmFtZSwgZ2V0LCBzZXQpXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUucHJvdG8gPSBmdW5jdGlvbiAocHJvdG90eXBlKSB7XG4gIGZvciAodmFyIHByb3AgaW4gcHJvdG90eXBlKSB7XG4gICAgaWYgKHByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgaWYgKHR5cGVvZiBwcm90b3R5cGVbcHJvcF0gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGlmIChwcm9wID09PSBcIm9uQ3JlYXRlXCIpIHtcbiAgICAgICAgICB0aGlzLm9uQ3JlYXRlKHByb3RvdHlwZVtwcm9wXSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1ldGhvZChwcm9wLCBwcm90b3R5cGVbcHJvcF0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnByb3BlcnR5KHByb3AsIHByb3RvdHlwZVtwcm9wXSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5ldmVudCA9IGZ1bmN0aW9uICh0eXBlLCBkZWZpbml0aW9uKSB7XG4gIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGRlZmluaXRpb25cbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXRFdmVudERlZmluaXRpb24gPSBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gIHZhciBkZWZpbml0aW9uID0gbWVyZ2UoZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiwgdGhpcy5fZXZlbnRzW3R5cGVdKVxuICBkZWZpbml0aW9uLmRldGFpbCA9IHR5cGVvZiBkZXRhaWwgPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmluaXRpb24uZGV0YWlsIDogZGV0YWlsXG4gIHJldHVybiBkZWZpbml0aW9uXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuYXR0cmlidXRlID0gZnVuY3Rpb24gKG5hbWUsIGRlZikge1xuICB2YXIgbWFzdGVyID0gdGhpcy5fbWFzdGVyXG4gIGlmICghbWFzdGVyKSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGlmIChkZWYgPT0gbnVsbCkge1xuICAgIGRlZiA9IHt9XG4gIH1cblxuICB2YXIgdHlwZU9mRGVmID0gdHlwZW9mIGRlZlxuICB2YXIgdHlwZVxuICB2YXIgZGVmYXVsdFZhbHVlXG4gIHZhciBnZXR0ZXJcbiAgdmFyIHNldHRlclxuXG4gIHN3aXRjaCAodHlwZU9mRGVmKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgLy8gdGhlIGRlZmluaXRpb24gaXMgYSBwcmltaXRpdmUgdmFsdWVcbiAgICAgIHR5cGUgPSB0eXBlT2ZEZWZcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IGRlZlxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIG9yIGEgZGVmaW5pdGlvbiBvYmplY3RcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHR5cGVvZiBkZWZbXCJkZWZhdWx0XCJdID09IFwidW5kZWZpbmVkXCIgPyBudWxsIDogZGVmW1wiZGVmYXVsdFwiXVxuICAgICAgaWYgKHR5cGVvZiBkZWZbXCJ0eXBlXCJdID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKGRlZmF1bHRWYWx1ZSA9PSBudWxsKSB7XG4gICAgICAgICAgdHlwZSA9IFwic3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0eXBlID0gdHlwZW9mIGRlZmF1bHRWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdHlwZSA9IGRlZltcInR5cGVcIl1cbiAgICAgIH1cbiAgICAgIGdldHRlciA9IGRlZltcImdldFwiXVxuICAgICAgc2V0dGVyID0gZGVmW1wic2V0XCJdXG4gIH1cblxuICB2YXIgcGFyc2VWYWx1ZVxuICB2YXIgc3RyaW5naWZ5VmFsdWVcbiAgdmFyIHNob3VsZFJlbW92ZVxuXG4gIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCB9XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT09IGZhbHNlIH1cbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9IG51bGwgfVxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBcIlwiIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gcGFyc2VJbnQodmFsdWUsIDEwKSB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZSkgfVxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0cmluZ2lmeVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSA/IFwiXCIrdmFsdWUgOiBcIlwiIH1cbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtYXN0ZXIsIGNhbWVsY2FzZShuYW1lKSwge1xuICAgIGdldDogZ2V0dGVyIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJzZVZhbHVlID8gcGFyc2VWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICAgIH0sXG4gICAgc2V0OiBzZXR0ZXIgfHwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoc2hvdWxkUmVtb3ZlKHZhbHVlKSkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBzdHJpbmdpZnlWYWx1ZSA/IHN0cmluZ2lmeVZhbHVlKHZhbHVlKSA6IHN0cmluZ2lmeVZhbHVlXG4gICAgICAgIHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHJldHVybiB0aGlzXG59XG4iLCJ2YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRcblxuZnVuY3Rpb24gY29tcG9uZW50IChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIHZhciBlbGVtZW50ID0gbnVsbFxuXG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiKVxuICBpZiAodHlwZW9mIG5hbWUgPT0gXCJzdHJpbmdcIikge1xuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICAgIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgICAgb3B0aW9ucyA9IHJvb3RcbiAgICAgIHJvb3QgPSBudWxsXG4gICAgfVxuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiLCBFbGVtZW50KVxuICAgIGVsZW1lbnQgPSBob29rLmZpbmRDb21wb25lbnQobmFtZSwgcm9vdClcbiAgfVxuICAvLyBjb21wb25lbnQoRWxlbWVudFssIHt9XSlcbiAgZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICBlbGVtZW50ID0gbmFtZVxuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuXG4gIHJldHVybiBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIG9wdGlvbnMpXG59XG4iLCIvKipcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciBvbiBhbiBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIGRlbGVnYXRvci5cbiAqIEEgZGVsZWdhdGVkIGV2ZW50IHJ1bnMgbWF0Y2hlcyB0byBmaW5kIGFuIGV2ZW50IHRhcmdldCxcbiAqIHRoZW4gZXhlY3V0ZXMgdGhlIGhhbmRsZXIgcGFpcmVkIHdpdGggdGhlIG1hdGNoZXIuXG4gKiBNYXRjaGVycyBjYW4gY2hlY2sgaWYgYW4gZXZlbnQgdGFyZ2V0IG1hdGNoZXMgYSBnaXZlbiBzZWxlY3RvcixcbiAqIG9yIHNlZSBpZiBhbiBvZiBpdHMgcGFyZW50cyBkby5cbiAqICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlbGVnYXRlKCBvcHRpb25zICl7XG4gICAgdmFyIGVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnRcbiAgICAgICAgLCBldmVudCA9IG9wdGlvbnMuZXZlbnRcbiAgICAgICAgLCBjYXB0dXJlID0gISFvcHRpb25zLmNhcHR1cmV8fGZhbHNlXG4gICAgICAgICwgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dHx8ZWxlbWVudFxuXG4gICAgaWYoICFlbGVtZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGVsZW1lbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgaWYoICFldmVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBldmVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBkZWxlZ2F0b3IgPSBjcmVhdGVEZWxlZ2F0b3IoY29udGV4dClcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGRlbGVnYXRvciwgY2FwdHVyZSlcblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZGVsZWdhdG9yIHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gZXZlbnQgbGlzdGVuZXIuXG4gKiBUaGUgZGVsZWdhdG9yIGhhcyBzdGF0aWMgbWV0aG9kcyB3aGljaCBjYW4gYmUgdXNlZCB0byByZWdpc3RlciBoYW5kbGVycy5cbiAqICovXG5mdW5jdGlvbiBjcmVhdGVEZWxlZ2F0b3IoIGNvbnRleHQgKXtcbiAgICB2YXIgbWF0Y2hlcnMgPSBbXVxuXG4gICAgZnVuY3Rpb24gZGVsZWdhdG9yKCBlICl7XG4gICAgICAgIHZhciBsID0gbWF0Y2hlcnMubGVuZ3RoXG4gICAgICAgIGlmKCAhbCApe1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbCA9IHRoaXNcbiAgICAgICAgICAgICwgaSA9IC0xXG4gICAgICAgICAgICAsIGhhbmRsZXJcbiAgICAgICAgICAgICwgc2VsZWN0b3JcbiAgICAgICAgICAgICwgZGVsZWdhdGVFbGVtZW50XG4gICAgICAgICAgICAsIHN0b3BQcm9wYWdhdGlvblxuICAgICAgICAgICAgLCBhcmdzXG5cbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGFyZ3MgPSBtYXRjaGVyc1tpXVxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF1cbiAgICAgICAgICAgIHNlbGVjdG9yID0gYXJnc1sxXVxuXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBtYXRjaENhcHR1cmVQYXRoKHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCBkZWxlZ2F0ZUVsZW1lbnQgJiYgZGVsZWdhdGVFbGVtZW50Lmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZSA9PT0gaGFuZGxlci5hcHBseShjb250ZXh0LCBbZV0uY29uY2F0KGRlbGVnYXRlRWxlbWVudCkpXG4gICAgICAgICAgICAgICAgaWYoIHN0b3BQcm9wYWdhdGlvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBoYW5kbGVyIHdpdGggYSB0YXJnZXQgZmluZGVyIGxvZ2ljXG4gICAgICogKi9cbiAgICBkZWxlZ2F0b3IubWF0Y2ggPSBmdW5jdGlvbiggc2VsZWN0b3IsIGhhbmRsZXIgKXtcbiAgICAgICAgbWF0Y2hlcnMucHVzaChbaGFuZGxlciwgc2VsZWN0b3JdKVxuICAgICAgICByZXR1cm4gZGVsZWdhdG9yXG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG5mdW5jdGlvbiBtYXRjaENhcHR1cmVQYXRoKCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50cyA9IFtdXG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudCA9IG51bGxcbiAgICBpZiggQXJyYXkuaXNBcnJheShzZWxlY3RvcikgKXtcbiAgICAgICAgdmFyIGkgPSAtMVxuICAgICAgICB2YXIgbCA9IHNlbGVjdG9yLmxlbmd0aFxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvcltpXSwgZWwsIGUpXG4gICAgICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgIH1cbiAgICByZXR1cm4gZGVsZWdhdGVFbGVtZW50c1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSB0YXJnZXQgb3IgYW55IG9mIGl0cyBwYXJlbnQgbWF0Y2hlcyBhIHNlbGVjdG9yXG4gKiAqL1xuZnVuY3Rpb24gZmluZFBhcmVudCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0XG4gICAgc3dpdGNoKCB0eXBlb2Ygc2VsZWN0b3IgKXtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggdGFyZ2V0Lm1hdGNoZXMoc2VsZWN0b3IpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHNlbGVjdG9yLmNhbGwoZWwsIHRhcmdldCkgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICByZXR1cm4gbnVsbFxufVxuIiwidmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmcmFnbWVudFxuXG5mcmFnbWVudC5vcHRpb25zID0ge1xuICB2YXJpYWJsZTogXCJmXCJcbn1cblxuZnVuY3Rpb24gZnJhZ21lbnQoIGh0bWwsIGNvbXBpbGVyLCBjb21waWxlck9wdGlvbnMgKXtcbiAgY29tcGlsZXJPcHRpb25zID0gbWVyZ2UoZnJhZ21lbnQub3B0aW9ucywgY29tcGlsZXJPcHRpb25zKVxuICB2YXIgcmVuZGVyID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlRGF0YSApe1xuICAgIHZhciB0ZW1wID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbiAgICBpZiggdHlwZW9mIGNvbXBpbGVyID09IFwiZnVuY3Rpb25cIiAmJiAhcmVuZGVyICl7XG4gICAgICByZW5kZXIgPSBjb21waWxlcihodG1sLCBjb21waWxlck9wdGlvbnMpXG4gICAgfVxuICAgIGlmKCByZW5kZXIgKXtcbiAgICAgIHRyeXtcbiAgICAgICAgaHRtbCA9IHJlbmRlcih0ZW1wbGF0ZURhdGEpXG4gICAgICB9XG4gICAgICBjYXRjaCggZSApe1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVuZGVyaW5nIGZyYWdtZW50IHdpdGggY29udGV4dDpcIiwgdGVtcGxhdGVEYXRhKVxuICAgICAgICBjb25zb2xlLmVycm9yKHJlbmRlci50b1N0cmluZygpKVxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0ZW1wLmlubmVySFRNTCA9IGh0bWxcbiAgICB2YXIgZnJhZ21lbnQgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gICAgd2hpbGUoIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggKXtcbiAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRlbXAuZmlyc3RDaGlsZClcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50XG4gIH1cbn1cbmZyYWdtZW50LnJlbmRlciA9IGZ1bmN0aW9uKCBodG1sLCB0ZW1wbGF0ZURhdGEgKXtcbiAgcmV0dXJuIGZyYWdtZW50KGh0bWwpKHRlbXBsYXRlRGF0YSlcbn1cbiIsInZhciBjYW1lbGNhc2UgPSByZXF1aXJlKFwiY2FtZWxjYXNlXCIpXG52YXIgQ09NUE9ORU5UX0FUVFJJQlVURSA9IFwiZGF0YS1jb21wb25lbnRcIlxuXG52YXIgaG9vayA9IG1vZHVsZS5leHBvcnRzID0ge31cblxuaG9vay5zZXRIb29rQXR0cmlidXRlID0gc2V0SG9va0F0dHJpYnV0ZVxuaG9vay5jcmVhdGVDb21wb25lbnRTZWxlY3RvciA9IGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yXG5ob29rLmZpbmRDb21wb25lbnQgPSBmaW5kQ29tcG9uZW50XG5ob29rLmZpbmRBbGxDb21wb25lbnQgPSBmaW5kQWxsQ29tcG9uZW50XG5ob29rLmZpbmRTdWJDb21wb25lbnRzID0gZmluZFN1YkNvbXBvbmVudHNcbmhvb2suZ2V0Q29tcG9uZW50TmFtZSA9IGdldENvbXBvbmVudE5hbWVcbmhvb2suZ2V0TWFpbkNvbXBvbmVudE5hbWUgPSBnZXRNYWluQ29tcG9uZW50TmFtZVxuaG9vay5nZXRTdWJDb21wb25lbnROYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZVxuaG9vay5hc3NpZ25TdWJDb21wb25lbnRzID0gYXNzaWduU3ViQ29tcG9uZW50c1xuaG9vay5maWx0ZXIgPSBmaWx0ZXJcblxuZnVuY3Rpb24gc2V0SG9va0F0dHJpYnV0ZSAoaG9vaykge1xuICBDT01QT05FTlRfQVRUUklCVVRFID0gaG9va1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnRTZWxlY3RvciAobmFtZSwgb3BlcmF0b3IpIHtcbiAgbmFtZSA9IG5hbWUgJiYgJ1wiJyArIG5hbWUgKyAnXCInXG4gIG9wZXJhdG9yID0gbmFtZSA/IG9wZXJhdG9yIHx8IFwiPVwiIDogXCJcIlxuICByZXR1cm4gJ1snICsgQ09NUE9ORU5UX0FUVFJJQlVURSArIG9wZXJhdG9yICsgbmFtZSArICddJ1xufVxuXG5mdW5jdGlvbiBmaW5kQ29tcG9uZW50IChuYW1lLCByb290KSB7XG4gIHJldHVybiAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvcihjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSlcbn1cblxuZnVuY3Rpb24gZmluZEFsbENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gW10uc2xpY2UuY2FsbCgocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSkpXG59XG5cbmZ1bmN0aW9uIGZpbmRTdWJDb21wb25lbnRzIChuYW1lLCByb290KSB7XG4gIHZhciBlbGVtZW50cyA9IChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUsIFwiXj1cIikpXG4gIHJldHVybiBmaWx0ZXIoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50LCBjb21wb25lbnROYW1lLCBtYWluQ29tcG9uZW50TmFtZSwgc3ViQ29tcG9uZW50TmFtZSkge1xuICAgIHJldHVybiBzdWJDb21wb25lbnROYW1lICYmIG5hbWUgPT09IG1haW5Db21wb25lbnROYW1lXG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKENPTVBPTkVOVF9BVFRSSUJVVEUpXG4gIHJldHVybiBjYyA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRNYWluQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMF0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0U3ViQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMV0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gYXNzaWduU3ViQ29tcG9uZW50cyAob2JqLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGFzc2lnbikge1xuICByZXR1cm4gc3ViQ29tcG9uZW50cy5yZWR1Y2UoZnVuY3Rpb24gKG9iaiwgZWxlbWVudCkge1xuICAgIHZhciBuYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50KVxuICAgIGlmIChuYW1lKSB7XG5cbiAgICAgIGVsZW1lbnQgPSB0eXBlb2YgdHJhbnNmb3JtID09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/IHRyYW5zZm9ybShlbGVtZW50LCBuYW1lKVxuICAgICAgICA6IGVsZW1lbnRcblxuICAgICAgaWYgKHR5cGVvZiBhc3NpZ24gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGFzc2lnbihvYmosIG5hbWUsIGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9ialtuYW1lXSkpIHtcbiAgICAgICAgb2JqW25hbWVdLnB1c2goZWxlbWVudClcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmpbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmpcbiAgfSwgb2JqKVxufVxuXG5mdW5jdGlvbiBmaWx0ZXIgKGVsZW1lbnRzLCBmaWx0ZXIpIHtcbiAgc3dpdGNoICh0eXBlb2YgZmlsdGVyKSB7XG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChlbGVtZW50cykuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBmaWx0ZXIoZWxlbWVudCwgZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSksIGdldE1haW5Db21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSwgZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkpXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChlbGVtZW50cykuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQpID09PSBmaWx0ZXJcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbFxuICB9XG59XG4iLCJ2YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL0NvbXBvbmVudFwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHJlZ2lzdGVyIChuYW1lLCBtaXhpbikge1xuICBtaXhpbiA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKVxuXG4gIGZ1bmN0aW9uIEN1c3RvbUNvbXBvbmVudCAoZWxlbWVudCwgb3B0aW9ucykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDdXN0b21Db21wb25lbnQpKSB7XG4gICAgICByZXR1cm4gbmV3IEN1c3RvbUNvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICAgIH1cbiAgICB2YXIgaW5zdGFuY2UgPSB0aGlzXG5cbiAgICBDb21wb25lbnQuY2FsbChpbnN0YW5jZSwgZWxlbWVudCwgb3B0aW9ucylcbiAgICAvLyBhdCB0aGlzIHBvaW50IGN1c3RvbSBjb25zdHJ1Y3RvcnMgY2FuIGFscmVhZHkgYWNjZXNzIHRoZSBlbGVtZW50IGFuZCBzdWIgY29tcG9uZW50c1xuICAgIC8vIHNvIHRoZXkgb25seSByZWNlaXZlIHRoZSBvcHRpb25zIG9iamVjdCBmb3IgY29udmVuaWVuY2VcbiAgICBpbnRlcm5hbHMuY3JlYXRlKGluc3RhbmNlLCBbb3B0aW9uc10pXG4gIH1cblxuICBDdXN0b21Db21wb25lbnQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDb21wb25lbnQucHJvdG90eXBlKVxuICBDdXN0b21Db21wb25lbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ3VzdG9tQ29tcG9uZW50XG4gIHZhciBpbnRlcm5hbHMgPSBuZXcgSW50ZXJuYWxzKEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUpXG4gIGludGVybmFscy5hdXRvQXNzaWduID0gdHJ1ZVxuICBDdXN0b21Db21wb25lbnQucHJvdG90eXBlLmludGVybmFscyA9IGludGVybmFsc1xuICBDdXN0b21Db21wb25lbnQuaW50ZXJuYWxzID0gaW50ZXJuYWxzXG4gIG1peGluLmZvckVhY2goZnVuY3Rpb24gKG1peGluKSB7XG4gICAgaWYgKHR5cGVvZiBtaXhpbiA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIG1peGluLmNhbGwoQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSwgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSwgaW50ZXJuYWxzKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGludGVybmFscy5wcm90byhtaXhpbilcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJlZ2lzdHJ5LnNldChuYW1lLCBDdXN0b21Db21wb25lbnQpXG4gIC8vIGRlZmluZSBtYWluIHByb3RvdHlwZSBhZnRlciByZWdpc3RlcmluZ1xufVxuIiwidmFyIHJlZ2lzdHJ5ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG52YXIgY29tcG9uZW50cyA9IHt9XG5cbnJlZ2lzdHJ5LmdldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5leGlzdHMgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuICEhY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5zZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUsIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdID0gQ29tcG9uZW50Q29uc3RydWN0b3Jcbn1cbiIsInZhciBzdG9yYWdlID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxudmFyIGNvbXBvbmVudHMgPSBbXVxudmFyIGVsZW1lbnRzID0gW11cblxuc3RvcmFnZS5nZXQgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICByZXR1cm4gY29tcG9uZW50c1tlbGVtZW50cy5pbmRleE9mKGVsZW1lbnQpXVxufVxuXG5zdG9yYWdlLnNhdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gIGNvbXBvbmVudHMucHVzaChjb21wb25lbnQpXG4gIGVsZW1lbnRzLnB1c2goY29tcG9uZW50LmVsZW1lbnQpXG59XG5cbnN0b3JhZ2UucmVtb3ZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICB2YXIgaSA9IGNvbXBvbmVudCBpbnN0YW5jZW9mIEVsZW1lbnRcbiAgICAgID8gZWxlbWVudHMuaW5kZXhPZihjb21wb25lbnQpXG4gICAgICA6IGNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnQpXG5cbiAgaWYgKH5pKSB7XG4gICAgY29tcG9uZW50cy5zcGxpY2UoaSwgMSlcbiAgICBlbGVtZW50cy5zcGxpY2UoaSwgMSlcbiAgfVxufVxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCggb2JqLCBleHRlbnNpb24gKXtcbiAgZm9yKCB2YXIgbmFtZSBpbiBleHRlbnNpb24gKXtcbiAgICBpZiggZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KG5hbWUpICkgb2JqW25hbWVdID0gZXh0ZW5zaW9uW25hbWVdXG4gIH1cbiAgcmV0dXJuIG9ialxufVxuIiwidmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuL2V4dGVuZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBvYmosIGV4dGVuc2lvbiApe1xuICByZXR1cm4gZXh0ZW5kKGV4dGVuZCh7fSwgb2JqKSwgZXh0ZW5zaW9uKVxufVxuIiwidmFyIG9iamVjdCA9IG1vZHVsZS5leHBvcnRzID0ge31cblxub2JqZWN0LmFjY2Vzc29yID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZ2V0LCBzZXQpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIGdldDogZ2V0LFxuICAgIHNldDogc2V0XG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVHZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lU2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHNldDogZm5cbiAgfSlcbn1cblxub2JqZWN0Lm1ldGhvZCA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm5cbiAgfSlcbn1cblxub2JqZWN0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmbixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn1cbiJdfQ==
