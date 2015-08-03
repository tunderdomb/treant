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
    return this.dispatchEvent(new window.CustomEvent(type, definition))
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
var merge = require("../util/merge")

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

  Object.defineProperty(this, "_master", {
    get: function () {
      return master
    }
  })
}

Internals.prototype.defineEvent = function (type, definition) {
  this._events[type] = definition
}

Internals.prototype.getEventDefinition = function (type, detail) {
  var definition = merge(defaultEventDefinition, this._events[type])
  definition.detail = typeof detail == "undefined" ? definition.detail : detail
  return definition
}

Internals.prototype.defineAttribute = function (name, def) {
  var master = this._master
  if (!master) {
    return
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
      stringifyValue = function (value) { return "" }
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

  Object.defineProperty(master, name, {
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
}

},{"../util/merge":13}],5:[function(require,module,exports){
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

module.exports = function register (name, mixin, ComponentConstructor) {
  if (!ComponentConstructor) {
    ComponentConstructor = mixin
    mixin = []
  }
  else {
    // functions in-between are mixin
    mixin = [].slice.call(arguments, 1, -1)
    // main constructor is always last argument
    ComponentConstructor = [].slice.call(arguments, -1)[0]
  }

  if (!ComponentConstructor) {
    ComponentConstructor = function () {}
  }

  function CustomComponent (element, options) {
    if (!(this instanceof CustomComponent)) {
      return new CustomComponent(element, options)
    }
    var instance = this

    Component.call(instance, element, options)
    // at this point custom constructors can already access the element and sub components
    // so they only receive the options object for convenience
    ComponentConstructor.call(instance, options)
  }

  CustomComponent.prototype = Object.create(Component.prototype)
  CustomComponent.prototype.constructor = CustomComponent
  var internals = new Internals(CustomComponent.prototype)
  internals.autoAssign = true
  CustomComponent.prototype.internals = internals
  mixin.forEach(function (mixin) {
    mixin.call(CustomComponent.prototype, CustomComponent.prototype)
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
  return extension(extend({}, obj), extension)
}

},{"./extend":12}],14:[function(require,module,exports){
var object = module.exports = {}

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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBob29rID0gcmVxdWlyZShcIi4vc3JjL2hvb2tcIilcbnZhciByZWdpc3RlciA9IHJlcXVpcmUoXCIuL3NyYy9yZWdpc3RlclwiKVxudmFyIGNvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9jcmVhdGVcIilcbnZhciBzdG9yYWdlID0gcmVxdWlyZShcIi4vc3JjL3N0b3JhZ2VcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvQ29tcG9uZW50XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9zcmMvZGVsZWdhdGVcIilcbnZhciBmcmFnbWVudCA9IHJlcXVpcmUoXCIuL3NyYy9mcmFnbWVudFwiKVxuXG52YXIgdHJlYW50ID0ge31cbm1vZHVsZS5leHBvcnRzID0gdHJlYW50XG5cbnRyZWFudC5yZWdpc3RlciA9IHJlZ2lzdGVyXG50cmVhbnQuY29tcG9uZW50ID0gY29tcG9uZW50XG50cmVhbnQuc3RvcmFnZSA9IHN0b3JhZ2VcbnRyZWFudC5Db21wb25lbnQgPSBDb21wb25lbnRcbnRyZWFudC5kZWxlZ2F0ZSA9IGRlbGVnYXRlXG50cmVhbnQuZnJhZ21lbnQgPSBmcmFnbWVudFxudHJlYW50Lmhvb2sgPSBob29rXG5cbnZhciB1dGlsID0ge31cbnRyZWFudC51dGlsID0gdXRpbFxuXG51dGlsLmV4dGVuZCA9IHJlcXVpcmUoXCIuL3V0aWwvZXh0ZW5kXCIpXG51dGlsLm1lcmdlID0gcmVxdWlyZShcIi4vdXRpbC9tZXJnZVwiKVxudXRpbC5vYmplY3QgPSByZXF1aXJlKFwiLi91dGlsL29iamVjdFwiKVxuIiwiJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyKSB7XG5cdHN0ciA9IHN0ci50cmltKCk7XG5cblx0aWYgKHN0ci5sZW5ndGggPT09IDEgfHwgISgvW18uXFwtIF0rLykudGVzdChzdHIpICkge1xuXHRcdGlmIChzdHJbMF0gPT09IHN0clswXS50b0xvd2VyQ2FzZSgpICYmIHN0ci5zbGljZSgxKSAhPT0gc3RyLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0ci50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cblx0cmV0dXJuIHN0clxuXHQucmVwbGFjZSgvXltfLlxcLSBdKy8sICcnKVxuXHQudG9Mb3dlckNhc2UoKVxuXHQucmVwbGFjZSgvW18uXFwtIF0rKFxcd3wkKS9nLCBmdW5jdGlvbiAobSwgcDEpIHtcblx0XHRyZXR1cm4gcDEudG9VcHBlckNhc2UoKTtcblx0fSk7XG59O1xuIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG52YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIGRlbGVnYXRlID0gcmVxdWlyZShcIi4vZGVsZWdhdGVcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBDb21wb25lbnRcblxuZnVuY3Rpb24gQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDb21wb25lbnQpKSB7XG4gICAgcmV0dXJuIG5ldyBDb21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgfVxuXG4gIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQgfHwgbnVsbFxuICB0aGlzLmNvbXBvbmVudHMgPSB7fVxuXG4gIGlmICh0aGlzLmVsZW1lbnQgJiYgdGhpcy5pbnRlcm5hbHMuYXV0b0Fzc2lnbikge1xuICAgIHRoaXMuYXNzaWduU3ViQ29tcG9uZW50cygpXG4gIH1cbn1cblxuQ29tcG9uZW50LmNyZWF0ZSA9IGZ1bmN0aW9uIChlbGVtZW50LCBvcHRpb25zKSB7XG4gIHZhciBuYW1lID0gaG9vay5nZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKVxuXG4gIGlmICghbmFtZSkge1xuICAgIGNvbnNvbGUud2FybihcIlVuYWJsZSB0byBjcmVhdGUgY29tcG9uZW50LCB0aGlzIGVsZW1lbnQgZG9lc24ndCBoYXZlIGEgY29tcG9uZW50IGF0dHJpYnV0ZVwiLCBlbGVtZW50KVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICB2YXIgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBudWxsXG5cbiAgaWYgKHJlZ2lzdHJ5LmV4aXN0cyhuYW1lKSkge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gIHJlZ2lzdHJ5LmdldChuYW1lKVxuICB9XG4gIGVsc2UgaWYgKHJlZ2lzdHJ5LmV4aXN0cyhcIipcIikpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IHJlZ2lzdHJ5LmdldChcIipcIilcbiAgfVxuICBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oXCJNaXNzaW5nIGN1c3RvbSBjb21wb25lbnQgJyVzJyBmb3IgXCIsIG5hbWUsIGVsZW1lbnQsXG4gICAgICAgICcgVXNlIHRoZSBDb21wb25lbnQgY29uc3RydWN0b3IgdG8gY3JlYXRlIHJhdyBjb21wb25lbnRzIG9yIHJlZ2lzdGVyIGEgXCIqXCIgY29tcG9uZW50LicpXG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBDb21wb25lbnRcbiAgfVxuXG4gIHJldHVybiBuZXcgQ29tcG9uZW50Q29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucylcbn1cblxuQ29tcG9uZW50LnByb3RvdHlwZSA9IHtcbiAgaW50ZXJuYWxzOiBuZXcgSW50ZXJuYWxzKCksXG5cbiAgZGVsZWdhdGU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5lbGVtZW50ID0gdGhpcy5lbGVtZW50XG4gICAgb3B0aW9ucy5jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0IHx8IHRoaXNcbiAgICByZXR1cm4gZGVsZWdhdGUob3B0aW9ucylcbiAgfSxcblxuICBkaXNwYXRjaDogZnVuY3Rpb24gKHR5cGUsIGRldGFpbCkge1xuICAgIHZhciBkZWZpbml0aW9uID0gdGhpcy5pbnRlcm5hbHMuZ2V0RXZlbnREZWZpbml0aW9uKHR5cGUsIGRldGFpbClcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaEV2ZW50KG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQodHlwZSwgZGVmaW5pdGlvbikpXG4gIH0sXG5cbiAgZmluZENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZEFsbENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQWxsQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZFN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZFN1YkNvbXBvbmVudHMobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBnZXRDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRDb21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGdldE1haW5Db21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSh0aGlzLmVsZW1lbnQsIGNjKVxuICB9LFxuICBnZXRTdWJDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRTdWJDb21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGNsZWFyU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIH0sXG4gIGFzc2lnblN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICh0cmFuc2Zvcm0pIHtcbiAgICB2YXIgaG9zdENvbXBvbmVudCA9IHRoaXNcbiAgICB2YXIgc3ViQ29tcG9uZW50cyA9IGhvb2suZmluZFN1YkNvbXBvbmVudHModGhpcy5nZXRNYWluQ29tcG9uZW50TmFtZShmYWxzZSksIHRoaXMuZWxlbWVudClcblxuICAgIGlmICghc3ViQ29tcG9uZW50cy5sZW5ndGgpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICh0aGlzLmludGVybmFscy5jb252ZXJ0U3ViQ29tcG9uZW50cyAmJiAodHlwZW9mIHRyYW5zZm9ybSA9PSBcInVuZGVmaW5lZFwiIHx8IHRyYW5zZm9ybSA9PT0gdHJ1ZSkpIHtcbiAgICAgIHRyYW5zZm9ybSA9IGZ1bmN0aW9uIChlbGVtZW50LyosIG5hbWUqLykge1xuICAgICAgICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShlbGVtZW50LCBob3N0Q29tcG9uZW50KVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBpbnRlcm5hbHMgPSB0aGlzLmludGVybmFsc1xuXG4gICAgaG9vay5hc3NpZ25TdWJDb21wb25lbnRzKHRoaXMuY29tcG9uZW50cywgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBmdW5jdGlvbiAoY29tcG9uZW50cywgbmFtZSwgZWxlbWVudCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV0pKSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBjb21wb25lbnRzW25hbWVdIHx8IFtdXG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwidmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcblxudmFyIGRlZmF1bHRFdmVudERlZmluaXRpb24gPSB7XG4gIGRldGFpbDogbnVsbCxcbiAgdmlldzogd2luZG93LFxuICBidWJibGVzOiB0cnVlLFxuICBjYW5jZWxhYmxlOiB0cnVlXG59XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJuYWxzXG5cbmZ1bmN0aW9uIEludGVybmFscyAobWFzdGVyKSB7XG4gIHRoaXMuYXV0b0Fzc2lnbiA9IHRydWVcbiAgdGhpcy5jb252ZXJ0U3ViQ29tcG9uZW50cyA9IGZhbHNlXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIHRoaXMuX2V2ZW50cyA9IHt9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiX21hc3RlclwiLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gbWFzdGVyXG4gICAgfVxuICB9KVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmRlZmluZUV2ZW50ID0gZnVuY3Rpb24gKHR5cGUsIGRlZmluaXRpb24pIHtcbiAgdGhpcy5fZXZlbnRzW3R5cGVdID0gZGVmaW5pdGlvblxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmdldEV2ZW50RGVmaW5pdGlvbiA9IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgdmFyIGRlZmluaXRpb24gPSBtZXJnZShkZWZhdWx0RXZlbnREZWZpbml0aW9uLCB0aGlzLl9ldmVudHNbdHlwZV0pXG4gIGRlZmluaXRpb24uZGV0YWlsID0gdHlwZW9mIGRldGFpbCA9PSBcInVuZGVmaW5lZFwiID8gZGVmaW5pdGlvbi5kZXRhaWwgOiBkZXRhaWxcbiAgcmV0dXJuIGRlZmluaXRpb25cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5kZWZpbmVBdHRyaWJ1dGUgPSBmdW5jdGlvbiAobmFtZSwgZGVmKSB7XG4gIHZhciBtYXN0ZXIgPSB0aGlzLl9tYXN0ZXJcbiAgaWYgKCFtYXN0ZXIpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGlmIChkZWYgPT0gbnVsbCkge1xuICAgIGRlZiA9IHt9XG4gIH1cblxuICB2YXIgdHlwZU9mRGVmID0gdHlwZW9mIGRlZlxuICB2YXIgdHlwZVxuICB2YXIgZGVmYXVsdFZhbHVlXG4gIHZhciBnZXR0ZXJcbiAgdmFyIHNldHRlclxuXG4gIHN3aXRjaCAodHlwZU9mRGVmKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgLy8gdGhlIGRlZmluaXRpb24gaXMgYSBwcmltaXRpdmUgdmFsdWVcbiAgICAgIHR5cGUgPSB0eXBlT2ZEZWZcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IGRlZlxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIG9yIGEgZGVmaW5pdGlvbiBvYmplY3RcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHR5cGVvZiBkZWZbXCJkZWZhdWx0XCJdID09IFwidW5kZWZpbmVkXCIgPyBudWxsIDogZGVmW1wiZGVmYXVsdFwiXVxuICAgICAgaWYgKHR5cGVvZiBkZWZbXCJ0eXBlXCJdID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKGRlZmF1bHRWYWx1ZSA9PSBudWxsKSB7XG4gICAgICAgICAgdHlwZSA9IFwic3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0eXBlID0gdHlwZW9mIGRlZmF1bHRWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdHlwZSA9IGRlZltcInR5cGVcIl1cbiAgICAgIH1cbiAgICAgIGdldHRlciA9IGRlZltcImdldFwiXVxuICAgICAgc2V0dGVyID0gZGVmW1wic2V0XCJdXG4gIH1cblxuICB2YXIgcGFyc2VWYWx1ZVxuICB2YXIgc3RyaW5naWZ5VmFsdWVcbiAgdmFyIHNob3VsZFJlbW92ZVxuXG4gIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCB9XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT09IGZhbHNlIH1cbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9IG51bGwgfVxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIFwiXCIgfVxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiBwYXJzZUludCh2YWx1ZSwgMTApIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiBwYXJzZUZsb2F0KHZhbHVlKSB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICBkZWZhdWx0OlxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID8gXCJcIit2YWx1ZSA6IFwiXCIgfVxuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1hc3RlciwgbmFtZSwge1xuICAgIGdldDogZ2V0dGVyIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJzZVZhbHVlID8gcGFyc2VWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICAgIH0sXG4gICAgc2V0OiBzZXR0ZXIgfHwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoc2hvdWxkUmVtb3ZlKHZhbHVlKSkge1xuICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFsdWUgPSBzdHJpbmdpZnlWYWx1ZSA/IHN0cmluZ2lmeVZhbHVlKHZhbHVlKSA6IHN0cmluZ2lmeVZhbHVlXG4gICAgICAgIHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpXG4gICAgICB9XG4gICAgfVxuICB9KVxufVxuIiwidmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL0NvbXBvbmVudFwiKVxudmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcG9uZW50XG5cbmZ1bmN0aW9uIGNvbXBvbmVudCAobmFtZSwgcm9vdCwgb3B0aW9ucykge1xuICB2YXIgZWxlbWVudCA9IG51bGxcblxuICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIilcbiAgaWYgKHR5cGVvZiBuYW1lID09IFwic3RyaW5nXCIpIHtcbiAgICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIHt9XSlcbiAgICBpZiAoIShyb290IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICAgIG9wdGlvbnMgPSByb290XG4gICAgICByb290ID0gbnVsbFxuICAgIH1cbiAgICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIiwgRWxlbWVudClcbiAgICBlbGVtZW50ID0gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHJvb3QpXG4gIH1cbiAgLy8gY29tcG9uZW50KEVsZW1lbnRbLCB7fV0pXG4gIGVsc2UgaWYgKG5hbWUgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgZWxlbWVudCA9IG5hbWVcbiAgICBvcHRpb25zID0gcm9vdFxuICAgIHJvb3QgPSBudWxsXG4gIH1cblxuICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShlbGVtZW50LCBvcHRpb25zKVxufVxuIiwiLyoqXG4gKiBSZWdpc3RlcnMgYW4gZXZlbnQgbGlzdGVuZXIgb24gYW4gZWxlbWVudFxuICogYW5kIHJldHVybnMgYSBkZWxlZ2F0b3IuXG4gKiBBIGRlbGVnYXRlZCBldmVudCBydW5zIG1hdGNoZXMgdG8gZmluZCBhbiBldmVudCB0YXJnZXQsXG4gKiB0aGVuIGV4ZWN1dGVzIHRoZSBoYW5kbGVyIHBhaXJlZCB3aXRoIHRoZSBtYXRjaGVyLlxuICogTWF0Y2hlcnMgY2FuIGNoZWNrIGlmIGFuIGV2ZW50IHRhcmdldCBtYXRjaGVzIGEgZ2l2ZW4gc2VsZWN0b3IsXG4gKiBvciBzZWUgaWYgYW4gb2YgaXRzIHBhcmVudHMgZG8uXG4gKiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkZWxlZ2F0ZSggb3B0aW9ucyApe1xuICAgIHZhciBlbGVtZW50ID0gb3B0aW9ucy5lbGVtZW50XG4gICAgICAgICwgZXZlbnQgPSBvcHRpb25zLmV2ZW50XG4gICAgICAgICwgY2FwdHVyZSA9ICEhb3B0aW9ucy5jYXB0dXJlfHxmYWxzZVxuICAgICAgICAsIGNvbnRleHQgPSBvcHRpb25zLmNvbnRleHR8fGVsZW1lbnRcblxuICAgIGlmKCAhZWxlbWVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBlbGVtZW50XCIpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIGlmKCAhZXZlbnQgKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYW4ndCBkZWxlZ2F0ZSB1bmRlZmluZWQgZXZlbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgZGVsZWdhdG9yID0gY3JlYXRlRGVsZWdhdG9yKGNvbnRleHQpXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBkZWxlZ2F0b3IsIGNhcHR1cmUpXG5cbiAgICByZXR1cm4gZGVsZWdhdG9yXG59XG5cbi8qKlxuICogUmV0dXJucyBhIGRlbGVnYXRvciB0aGF0IGNhbiBiZSB1c2VkIGFzIGFuIGV2ZW50IGxpc3RlbmVyLlxuICogVGhlIGRlbGVnYXRvciBoYXMgc3RhdGljIG1ldGhvZHMgd2hpY2ggY2FuIGJlIHVzZWQgdG8gcmVnaXN0ZXIgaGFuZGxlcnMuXG4gKiAqL1xuZnVuY3Rpb24gY3JlYXRlRGVsZWdhdG9yKCBjb250ZXh0ICl7XG4gICAgdmFyIG1hdGNoZXJzID0gW11cblxuICAgIGZ1bmN0aW9uIGRlbGVnYXRvciggZSApe1xuICAgICAgICB2YXIgbCA9IG1hdGNoZXJzLmxlbmd0aFxuICAgICAgICBpZiggIWwgKXtcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZWwgPSB0aGlzXG4gICAgICAgICAgICAsIGkgPSAtMVxuICAgICAgICAgICAgLCBoYW5kbGVyXG4gICAgICAgICAgICAsIHNlbGVjdG9yXG4gICAgICAgICAgICAsIGRlbGVnYXRlRWxlbWVudFxuICAgICAgICAgICAgLCBzdG9wUHJvcGFnYXRpb25cbiAgICAgICAgICAgICwgYXJnc1xuXG4gICAgICAgIHdoaWxlKCArK2kgPCBsICl7XG4gICAgICAgICAgICBhcmdzID0gbWF0Y2hlcnNbaV1cbiAgICAgICAgICAgIGhhbmRsZXIgPSBhcmdzWzBdXG4gICAgICAgICAgICBzZWxlY3RvciA9IGFyZ3NbMV1cblxuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gbWF0Y2hDYXB0dXJlUGF0aChzZWxlY3RvciwgZWwsIGUpXG4gICAgICAgICAgICBpZiggZGVsZWdhdGVFbGVtZW50ICYmIGRlbGVnYXRlRWxlbWVudC5sZW5ndGggKSB7XG4gICAgICAgICAgICAgICAgc3RvcFByb3BhZ2F0aW9uID0gZmFsc2UgPT09IGhhbmRsZXIuYXBwbHkoY29udGV4dCwgW2VdLmNvbmNhdChkZWxlZ2F0ZUVsZW1lbnQpKVxuICAgICAgICAgICAgICAgIGlmKCBzdG9wUHJvcGFnYXRpb24gKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXJzIGEgaGFuZGxlciB3aXRoIGEgdGFyZ2V0IGZpbmRlciBsb2dpY1xuICAgICAqICovXG4gICAgZGVsZWdhdG9yLm1hdGNoID0gZnVuY3Rpb24oIHNlbGVjdG9yLCBoYW5kbGVyICl7XG4gICAgICAgIG1hdGNoZXJzLnB1c2goW2hhbmRsZXIsIHNlbGVjdG9yXSlcbiAgICAgICAgcmV0dXJuIGRlbGVnYXRvclxuICAgIH1cblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuZnVuY3Rpb24gbWF0Y2hDYXB0dXJlUGF0aCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudHMgPSBbXVxuICAgIHZhciBkZWxlZ2F0ZUVsZW1lbnQgPSBudWxsXG4gICAgaWYoIEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpICl7XG4gICAgICAgIHZhciBpID0gLTFcbiAgICAgICAgdmFyIGwgPSBzZWxlY3Rvci5sZW5ndGhcbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IGZpbmRQYXJlbnQoc2VsZWN0b3JbaV0sIGVsLCBlKVxuICAgICAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50cy5wdXNoKGRlbGVnYXRlRWxlbWVudClcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvciwgZWwsIGUpXG4gICAgICAgIGlmKCAhZGVsZWdhdGVFbGVtZW50ICkgcmV0dXJuIG51bGxcbiAgICAgICAgZGVsZWdhdGVFbGVtZW50cy5wdXNoKGRlbGVnYXRlRWxlbWVudClcbiAgICB9XG4gICAgcmV0dXJuIGRlbGVnYXRlRWxlbWVudHNcbn1cblxuLyoqXG4gKiBDaGVjayBpZiB0aGUgdGFyZ2V0IG9yIGFueSBvZiBpdHMgcGFyZW50IG1hdGNoZXMgYSBzZWxlY3RvclxuICogKi9cbmZ1bmN0aW9uIGZpbmRQYXJlbnQoIHNlbGVjdG9yLCBlbCwgZSApe1xuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldFxuICAgIHN3aXRjaCggdHlwZW9mIHNlbGVjdG9yICl7XG4gICAgICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHRhcmdldC5tYXRjaGVzKHNlbGVjdG9yKSApIHJldHVybiB0YXJnZXRcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICAgICAgICB3aGlsZSggdGFyZ2V0ICYmIHRhcmdldCAhPSBlbCApe1xuICAgICAgICAgICAgICAgIGlmKCBzZWxlY3Rvci5jYWxsKGVsLCB0YXJnZXQpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgcmV0dXJuIG51bGxcbn1cbiIsInZhciBtZXJnZSA9IHJlcXVpcmUoXCIuLi91dGlsL21lcmdlXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnJhZ21lbnRcblxuZnJhZ21lbnQub3B0aW9ucyA9IHtcbiAgdmFyaWFibGU6IFwiZlwiXG59XG5cbmZ1bmN0aW9uIGZyYWdtZW50KCBodG1sLCBjb21waWxlciwgY29tcGlsZXJPcHRpb25zICl7XG4gIGNvbXBpbGVyT3B0aW9ucyA9IG1lcmdlKGZyYWdtZW50Lm9wdGlvbnMsIGNvbXBpbGVyT3B0aW9ucylcbiAgdmFyIHJlbmRlciA9IG51bGxcbiAgcmV0dXJuIGZ1bmN0aW9uKCB0ZW1wbGF0ZURhdGEgKXtcbiAgICB2YXIgdGVtcCA9IHdpbmRvdy5kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpXG4gICAgaWYoIHR5cGVvZiBjb21waWxlciA9PSBcImZ1bmN0aW9uXCIgJiYgIXJlbmRlciApe1xuICAgICAgcmVuZGVyID0gY29tcGlsZXIoaHRtbCwgY29tcGlsZXJPcHRpb25zKVxuICAgIH1cbiAgICBpZiggcmVuZGVyICl7XG4gICAgICB0cnl7XG4gICAgICAgIGh0bWwgPSByZW5kZXIodGVtcGxhdGVEYXRhKVxuICAgICAgfVxuICAgICAgY2F0Y2goIGUgKXtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJlbmRlcmluZyBmcmFnbWVudCB3aXRoIGNvbnRleHQ6XCIsIHRlbXBsYXRlRGF0YSlcbiAgICAgICAgY29uc29sZS5lcnJvcihyZW5kZXIudG9TdHJpbmcoKSlcbiAgICAgICAgY29uc29sZS5lcnJvcihlKVxuICAgICAgICB0aHJvdyBlXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGVtcC5pbm5lckhUTUwgPSBodG1sXG4gICAgdmFyIGZyYWdtZW50ID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKVxuICAgIHdoaWxlKCB0ZW1wLmNoaWxkTm9kZXMubGVuZ3RoICl7XG4gICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh0ZW1wLmZpcnN0Q2hpbGQpXG4gICAgfVxuICAgIHJldHVybiBmcmFnbWVudFxuICB9XG59XG5mcmFnbWVudC5yZW5kZXIgPSBmdW5jdGlvbiggaHRtbCwgdGVtcGxhdGVEYXRhICl7XG4gIHJldHVybiBmcmFnbWVudChodG1sKSh0ZW1wbGF0ZURhdGEpXG59XG4iLCJ2YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxudmFyIENPTVBPTkVOVF9BVFRSSUJVVEUgPSBcImRhdGEtY29tcG9uZW50XCJcblxudmFyIGhvb2sgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbmhvb2suc2V0SG9va0F0dHJpYnV0ZSA9IHNldEhvb2tBdHRyaWJ1dGVcbmhvb2suY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IgPSBjcmVhdGVDb21wb25lbnRTZWxlY3RvclxuaG9vay5maW5kQ29tcG9uZW50ID0gZmluZENvbXBvbmVudFxuaG9vay5maW5kQWxsQ29tcG9uZW50ID0gZmluZEFsbENvbXBvbmVudFxuaG9vay5maW5kU3ViQ29tcG9uZW50cyA9IGZpbmRTdWJDb21wb25lbnRzXG5ob29rLmdldENvbXBvbmVudE5hbWUgPSBnZXRDb21wb25lbnROYW1lXG5ob29rLmdldE1haW5Db21wb25lbnROYW1lID0gZ2V0TWFpbkNvbXBvbmVudE5hbWVcbmhvb2suZ2V0U3ViQ29tcG9uZW50TmFtZSA9IGdldFN1YkNvbXBvbmVudE5hbWVcbmhvb2suYXNzaWduU3ViQ29tcG9uZW50cyA9IGFzc2lnblN1YkNvbXBvbmVudHNcbmhvb2suZmlsdGVyID0gZmlsdGVyXG5cbmZ1bmN0aW9uIHNldEhvb2tBdHRyaWJ1dGUgKGhvb2spIHtcbiAgQ09NUE9ORU5UX0FUVFJJQlVURSA9IGhvb2tcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IgKG5hbWUsIG9wZXJhdG9yKSB7XG4gIG5hbWUgPSBuYW1lICYmICdcIicgKyBuYW1lICsgJ1wiJ1xuICBvcGVyYXRvciA9IG5hbWUgPyBvcGVyYXRvciB8fCBcIj1cIiA6IFwiXCJcbiAgcmV0dXJuICdbJyArIENPTVBPTkVOVF9BVFRSSUJVVEUgKyBvcGVyYXRvciArIG5hbWUgKyAnXSdcbn1cblxuZnVuY3Rpb24gZmluZENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3IoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSkpXG59XG5cbmZ1bmN0aW9uIGZpbmRBbGxDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSkpKVxufVxuXG5mdW5jdGlvbiBmaW5kU3ViQ29tcG9uZW50cyAobmFtZSwgcm9vdCkge1xuICB2YXIgZWxlbWVudHMgPSAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lLCBcIl49XCIpKVxuICByZXR1cm4gZmlsdGVyKGVsZW1lbnRzLCBmdW5jdGlvbiAoZWxlbWVudCwgY29tcG9uZW50TmFtZSwgbWFpbkNvbXBvbmVudE5hbWUsIHN1YkNvbXBvbmVudE5hbWUpIHtcbiAgICByZXR1cm4gc3ViQ29tcG9uZW50TmFtZSAmJiBuYW1lID09PSBtYWluQ29tcG9uZW50TmFtZVxuICB9KVxufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBlbGVtZW50LmdldEF0dHJpYnV0ZShDT01QT05FTlRfQVRUUklCVVRFKVxuICByZXR1cm4gY2MgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0TWFpbkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzBdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldFN1YkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzFdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGFzc2lnblN1YkNvbXBvbmVudHMgKG9iaiwgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBhc3NpZ24pIHtcbiAgcmV0dXJuIHN1YkNvbXBvbmVudHMucmVkdWNlKGZ1bmN0aW9uIChvYmosIGVsZW1lbnQpIHtcbiAgICB2YXIgbmFtZSA9IGdldFN1YkNvbXBvbmVudE5hbWUoZWxlbWVudClcbiAgICBpZiAobmFtZSkge1xuXG4gICAgICBlbGVtZW50ID0gdHlwZW9mIHRyYW5zZm9ybSA9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgPyB0cmFuc2Zvcm0oZWxlbWVudCwgbmFtZSlcbiAgICAgICAgOiBlbGVtZW50XG5cbiAgICAgIGlmICh0eXBlb2YgYXNzaWduID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBhc3NpZ24ob2JqLCBuYW1lLCBlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShvYmpbbmFtZV0pKSB7XG4gICAgICAgIG9ialtuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb2JqW25hbWVdID0gZWxlbWVudFxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqXG4gIH0sIG9iailcbn1cblxuZnVuY3Rpb24gZmlsdGVyIChlbGVtZW50cywgZmlsdGVyKSB7XG4gIHN3aXRjaCAodHlwZW9mIGZpbHRlcikge1xuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZmlsdGVyKGVsZW1lbnQsIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLCBnZXRNYWluQ29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSksIGdldFN1YkNvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50KSA9PT0gZmlsdGVyXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuIiwidmFyIHJlZ2lzdHJ5ID0gcmVxdWlyZShcIi4vcmVnaXN0cnlcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZWdpc3RlciAobmFtZSwgbWl4aW4sIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIGlmICghQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IG1peGluXG4gICAgbWl4aW4gPSBbXVxuICB9XG4gIGVsc2Uge1xuICAgIC8vIGZ1bmN0aW9ucyBpbi1iZXR3ZWVuIGFyZSBtaXhpblxuICAgIG1peGluID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEsIC0xKVxuICAgIC8vIG1haW4gY29uc3RydWN0b3IgaXMgYWx3YXlzIGxhc3QgYXJndW1lbnRcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAtMSlbMF1cbiAgfVxuXG4gIGlmICghQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gIH1cblxuICBmdW5jdGlvbiBDdXN0b21Db21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ3VzdG9tQ29tcG9uZW50KSkge1xuICAgICAgcmV0dXJuIG5ldyBDdXN0b21Db21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgICB9XG4gICAgdmFyIGluc3RhbmNlID0gdGhpc1xuXG4gICAgQ29tcG9uZW50LmNhbGwoaW5zdGFuY2UsIGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgLy8gYXQgdGhpcyBwb2ludCBjdXN0b20gY29uc3RydWN0b3JzIGNhbiBhbHJlYWR5IGFjY2VzcyB0aGUgZWxlbWVudCBhbmQgc3ViIGNvbXBvbmVudHNcbiAgICAvLyBzbyB0aGV5IG9ubHkgcmVjZWl2ZSB0aGUgb3B0aW9ucyBvYmplY3QgZm9yIGNvbnZlbmllbmNlXG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IuY2FsbChpbnN0YW5jZSwgb3B0aW9ucylcbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKENvbXBvbmVudC5wcm90b3R5cGUpXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDdXN0b21Db21wb25lbnRcbiAgdmFyIGludGVybmFscyA9IG5ldyBJbnRlcm5hbHMoQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSlcbiAgaW50ZXJuYWxzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuaW50ZXJuYWxzID0gaW50ZXJuYWxzXG4gIG1peGluLmZvckVhY2goZnVuY3Rpb24gKG1peGluKSB7XG4gICAgbWl4aW4uY2FsbChDdXN0b21Db21wb25lbnQucHJvdG90eXBlLCBDdXN0b21Db21wb25lbnQucHJvdG90eXBlKVxuICB9KVxuXG4gIHJldHVybiByZWdpc3RyeS5zZXQobmFtZSwgQ3VzdG9tQ29tcG9uZW50KVxuICAvLyBkZWZpbmUgbWFpbiBwcm90b3R5cGUgYWZ0ZXIgcmVnaXN0ZXJpbmdcbn1cbiIsInZhciByZWdpc3RyeSA9IG1vZHVsZS5leHBvcnRzID0ge31cblxudmFyIGNvbXBvbmVudHMgPSB7fVxuXG5yZWdpc3RyeS5nZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbbmFtZV1cbn1cblxucmVnaXN0cnkuZXhpc3RzID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lKSB7XG4gIHJldHVybiAhIWNvbXBvbmVudHNbbmFtZV1cbn1cblxucmVnaXN0cnkuc2V0ID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lLCBDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXSA9IENvbXBvbmVudENvbnN0cnVjdG9yXG59XG4iLCJ2YXIgc3RvcmFnZSA9IG1vZHVsZS5leHBvcnRzID0ge31cbnZhciBjb21wb25lbnRzID0gW11cbnZhciBlbGVtZW50cyA9IFtdXG5cbnN0b3JhZ2UuZ2V0ID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbZWxlbWVudHMuaW5kZXhPZihlbGVtZW50KV1cbn1cblxuc3RvcmFnZS5zYXZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICBjb21wb25lbnRzLnB1c2goY29tcG9uZW50KVxuICBlbGVtZW50cy5wdXNoKGNvbXBvbmVudC5lbGVtZW50KVxufVxuXG5zdG9yYWdlLnJlbW92ZSA9IGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgdmFyIGkgPSBjb21wb25lbnQgaW5zdGFuY2VvZiBFbGVtZW50XG4gICAgICA/IGVsZW1lbnRzLmluZGV4T2YoY29tcG9uZW50KVxuICAgICAgOiBjb21wb25lbnRzLmluZGV4T2YoY29tcG9uZW50KVxuXG4gIGlmICh+aSkge1xuICAgIGNvbXBvbmVudHMuc3BsaWNlKGksIDEpXG4gICAgZWxlbWVudHMuc3BsaWNlKGksIDEpXG4gIH1cbn1cblxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoIG9iaiwgZXh0ZW5zaW9uICl7XG4gIGZvciggdmFyIG5hbWUgaW4gZXh0ZW5zaW9uICl7XG4gICAgaWYoIGV4dGVuc2lvbi5oYXNPd25Qcm9wZXJ0eShuYW1lKSApIG9ialtuYW1lXSA9IGV4dGVuc2lvbltuYW1lXVxuICB9XG4gIHJldHVybiBvYmpcbn1cbiIsInZhciBleHRlbmQgPSByZXF1aXJlKFwiLi9leHRlbmRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggb2JqLCBleHRlbnNpb24gKXtcbiAgcmV0dXJuIGV4dGVuc2lvbihleHRlbmQoe30sIG9iaiksIGV4dGVuc2lvbilcbn1cbiIsInZhciBvYmplY3QgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbm9iamVjdC5kZWZpbmVHZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lU2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHNldDogZm5cbiAgfSlcbn1cblxub2JqZWN0Lm1ldGhvZCA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm5cbiAgfSlcbn1cblxub2JqZWN0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmbixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn1cbiJdfQ==
