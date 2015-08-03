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
  return extend(extend({}, obj), extension)
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBob29rID0gcmVxdWlyZShcIi4vc3JjL2hvb2tcIilcbnZhciByZWdpc3RlciA9IHJlcXVpcmUoXCIuL3NyYy9yZWdpc3RlclwiKVxudmFyIGNvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9jcmVhdGVcIilcbnZhciBzdG9yYWdlID0gcmVxdWlyZShcIi4vc3JjL3N0b3JhZ2VcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvQ29tcG9uZW50XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9zcmMvZGVsZWdhdGVcIilcbnZhciBmcmFnbWVudCA9IHJlcXVpcmUoXCIuL3NyYy9mcmFnbWVudFwiKVxuXG52YXIgdHJlYW50ID0ge31cbm1vZHVsZS5leHBvcnRzID0gdHJlYW50XG5cbnRyZWFudC5yZWdpc3RlciA9IHJlZ2lzdGVyXG50cmVhbnQuY29tcG9uZW50ID0gY29tcG9uZW50XG50cmVhbnQuc3RvcmFnZSA9IHN0b3JhZ2VcbnRyZWFudC5Db21wb25lbnQgPSBDb21wb25lbnRcbnRyZWFudC5kZWxlZ2F0ZSA9IGRlbGVnYXRlXG50cmVhbnQuZnJhZ21lbnQgPSBmcmFnbWVudFxudHJlYW50Lmhvb2sgPSBob29rXG5cbnZhciB1dGlsID0ge31cbnRyZWFudC51dGlsID0gdXRpbFxuXG51dGlsLmV4dGVuZCA9IHJlcXVpcmUoXCIuL3V0aWwvZXh0ZW5kXCIpXG51dGlsLm1lcmdlID0gcmVxdWlyZShcIi4vdXRpbC9tZXJnZVwiKVxudXRpbC5vYmplY3QgPSByZXF1aXJlKFwiLi91dGlsL29iamVjdFwiKVxuIiwiJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyKSB7XG5cdHN0ciA9IHN0ci50cmltKCk7XG5cblx0aWYgKHN0ci5sZW5ndGggPT09IDEgfHwgISgvW18uXFwtIF0rLykudGVzdChzdHIpICkge1xuXHRcdGlmIChzdHJbMF0gPT09IHN0clswXS50b0xvd2VyQ2FzZSgpICYmIHN0ci5zbGljZSgxKSAhPT0gc3RyLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0ci50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cblx0cmV0dXJuIHN0clxuXHQucmVwbGFjZSgvXltfLlxcLSBdKy8sICcnKVxuXHQudG9Mb3dlckNhc2UoKVxuXHQucmVwbGFjZSgvW18uXFwtIF0rKFxcd3wkKS9nLCBmdW5jdGlvbiAobSwgcDEpIHtcblx0XHRyZXR1cm4gcDEudG9VcHBlckNhc2UoKTtcblx0fSk7XG59O1xuIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG52YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIGRlbGVnYXRlID0gcmVxdWlyZShcIi4vZGVsZWdhdGVcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBDb21wb25lbnRcblxuZnVuY3Rpb24gQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDb21wb25lbnQpKSB7XG4gICAgcmV0dXJuIG5ldyBDb21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgfVxuXG4gIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQgfHwgbnVsbFxuICB0aGlzLmNvbXBvbmVudHMgPSB7fVxuXG4gIGlmICh0aGlzLmVsZW1lbnQgJiYgdGhpcy5pbnRlcm5hbHMuYXV0b0Fzc2lnbikge1xuICAgIHRoaXMuYXNzaWduU3ViQ29tcG9uZW50cygpXG4gIH1cbn1cblxuQ29tcG9uZW50LmNyZWF0ZSA9IGZ1bmN0aW9uIChlbGVtZW50LCBvcHRpb25zKSB7XG4gIHZhciBuYW1lID0gaG9vay5nZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKVxuXG4gIGlmICghbmFtZSkge1xuICAgIGNvbnNvbGUud2FybihcIlVuYWJsZSB0byBjcmVhdGUgY29tcG9uZW50LCB0aGlzIGVsZW1lbnQgZG9lc24ndCBoYXZlIGEgY29tcG9uZW50IGF0dHJpYnV0ZVwiLCBlbGVtZW50KVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICB2YXIgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBudWxsXG5cbiAgaWYgKHJlZ2lzdHJ5LmV4aXN0cyhuYW1lKSkge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gIHJlZ2lzdHJ5LmdldChuYW1lKVxuICB9XG4gIGVsc2UgaWYgKHJlZ2lzdHJ5LmV4aXN0cyhcIipcIikpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IHJlZ2lzdHJ5LmdldChcIipcIilcbiAgfVxuICBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oXCJNaXNzaW5nIGN1c3RvbSBjb21wb25lbnQgJyVzJyBmb3IgXCIsIG5hbWUsIGVsZW1lbnQsXG4gICAgICAgICcgVXNlIHRoZSBDb21wb25lbnQgY29uc3RydWN0b3IgdG8gY3JlYXRlIHJhdyBjb21wb25lbnRzIG9yIHJlZ2lzdGVyIGEgXCIqXCIgY29tcG9uZW50LicpXG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBDb21wb25lbnRcbiAgfVxuXG4gIHJldHVybiBuZXcgQ29tcG9uZW50Q29uc3RydWN0b3IoZWxlbWVudCwgb3B0aW9ucylcbn1cblxuQ29tcG9uZW50LnByb3RvdHlwZSA9IHtcbiAgaW50ZXJuYWxzOiBuZXcgSW50ZXJuYWxzKCksXG5cbiAgZGVsZWdhdGU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5lbGVtZW50ID0gdGhpcy5lbGVtZW50XG4gICAgb3B0aW9ucy5jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0IHx8IHRoaXNcbiAgICByZXR1cm4gZGVsZWdhdGUob3B0aW9ucylcbiAgfSxcblxuICBkaXNwYXRjaDogZnVuY3Rpb24gKHR5cGUsIGRldGFpbCkge1xuICAgIHZhciBkZWZpbml0aW9uID0gdGhpcy5pbnRlcm5hbHMuZ2V0RXZlbnREZWZpbml0aW9uKHR5cGUsIGRldGFpbClcbiAgICByZXR1cm4gdGhpcy5lbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IHdpbmRvdy5DdXN0b21FdmVudCh0eXBlLCBkZWZpbml0aW9uKSlcbiAgfSxcblxuICBmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRDb21wb25lbnQobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kQWxsQ29tcG9uZW50OiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRBbGxDb21wb25lbnQobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kU3ViQ29tcG9uZW50cyhuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGdldENvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldENvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgZ2V0TWFpbkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldE1haW5Db21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGdldFN1YkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldFN1YkNvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgY2xlYXJTdWJDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzID0ge31cbiAgfSxcbiAgYXNzaWduU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKHRyYW5zZm9ybSkge1xuICAgIHZhciBob3N0Q29tcG9uZW50ID0gdGhpc1xuICAgIHZhciBzdWJDb21wb25lbnRzID0gaG9vay5maW5kU3ViQ29tcG9uZW50cyh0aGlzLmdldE1haW5Db21wb25lbnROYW1lKGZhbHNlKSwgdGhpcy5lbGVtZW50KVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaW50ZXJuYWxzLmNvbnZlcnRTdWJDb21wb25lbnRzICYmICh0eXBlb2YgdHJhbnNmb3JtID09IFwidW5kZWZpbmVkXCIgfHwgdHJhbnNmb3JtID09PSB0cnVlKSkge1xuICAgICAgdHJhbnNmb3JtID0gZnVuY3Rpb24gKGVsZW1lbnQvKiwgbmFtZSovKSB7XG4gICAgICAgIHJldHVybiBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIGhvc3RDb21wb25lbnQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGludGVybmFscyA9IHRoaXMuaW50ZXJuYWxzXG5cbiAgICBob29rLmFzc2lnblN1YkNvbXBvbmVudHModGhpcy5jb21wb25lbnRzLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGZ1bmN0aW9uIChjb21wb25lbnRzLCBuYW1lLCBlbGVtZW50KSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGNvbXBvbmVudHNbbmFtZV0gfHwgW11cbiAgICAgICAgY29tcG9uZW50c1tuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxuXG52YXIgZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiA9IHtcbiAgZGV0YWlsOiBudWxsLFxuICB2aWV3OiB3aW5kb3csXG4gIGJ1YmJsZXM6IHRydWUsXG4gIGNhbmNlbGFibGU6IHRydWVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBJbnRlcm5hbHNcblxuZnVuY3Rpb24gSW50ZXJuYWxzIChtYXN0ZXIpIHtcbiAgdGhpcy5hdXRvQXNzaWduID0gdHJ1ZVxuICB0aGlzLmNvbnZlcnRTdWJDb21wb25lbnRzID0gZmFsc2VcbiAgdGhpcy5jb21wb25lbnRzID0ge31cbiAgdGhpcy5fZXZlbnRzID0ge31cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJfbWFzdGVyXCIsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBtYXN0ZXJcbiAgICB9XG4gIH0pXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuZGVmaW5lRXZlbnQgPSBmdW5jdGlvbiAodHlwZSwgZGVmaW5pdGlvbikge1xuICB0aGlzLl9ldmVudHNbdHlwZV0gPSBkZWZpbml0aW9uXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuZ2V0RXZlbnREZWZpbml0aW9uID0gZnVuY3Rpb24gKHR5cGUsIGRldGFpbCkge1xuICB2YXIgZGVmaW5pdGlvbiA9IG1lcmdlKGRlZmF1bHRFdmVudERlZmluaXRpb24sIHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgZGVmaW5pdGlvbi5kZXRhaWwgPSB0eXBlb2YgZGV0YWlsID09IFwidW5kZWZpbmVkXCIgPyBkZWZpbml0aW9uLmRldGFpbCA6IGRldGFpbFxuICByZXR1cm4gZGVmaW5pdGlvblxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmRlZmluZUF0dHJpYnV0ZSA9IGZ1bmN0aW9uIChuYW1lLCBkZWYpIHtcbiAgdmFyIG1hc3RlciA9IHRoaXMuX21hc3RlclxuICBpZiAoIW1hc3Rlcikge1xuICAgIHJldHVyblxuICB9XG5cbiAgaWYgKGRlZiA9PSBudWxsKSB7XG4gICAgZGVmID0ge31cbiAgfVxuXG4gIHZhciB0eXBlT2ZEZWYgPSB0eXBlb2YgZGVmXG4gIHZhciB0eXBlXG4gIHZhciBkZWZhdWx0VmFsdWVcbiAgdmFyIGdldHRlclxuICB2YXIgc2V0dGVyXG5cbiAgc3dpdGNoICh0eXBlT2ZEZWYpIHtcbiAgICBjYXNlIFwiYm9vbGVhblwiOlxuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAvLyB0aGUgZGVmaW5pdGlvbiBpcyBhIHByaW1pdGl2ZSB2YWx1ZVxuICAgICAgdHlwZSA9IHR5cGVPZkRlZlxuICAgICAgZGVmYXVsdFZhbHVlID0gZGVmXG4gICAgICBicmVha1xuICAgIGNhc2UgXCJvYmplY3RcIjpcbiAgICBkZWZhdWx0OlxuICAgICAgLy8gb3IgYSBkZWZpbml0aW9uIG9iamVjdFxuICAgICAgZGVmYXVsdFZhbHVlID0gdHlwZW9mIGRlZltcImRlZmF1bHRcIl0gPT0gXCJ1bmRlZmluZWRcIiA/IG51bGwgOiBkZWZbXCJkZWZhdWx0XCJdXG4gICAgICBpZiAodHlwZW9mIGRlZltcInR5cGVcIl0gPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICBpZiAoZGVmYXVsdFZhbHVlID09IG51bGwpIHtcbiAgICAgICAgICB0eXBlID0gXCJzdHJpbmdcIlxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHR5cGUgPSB0eXBlb2YgZGVmYXVsdFZhbHVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0eXBlID0gZGVmW1widHlwZVwiXVxuICAgICAgfVxuICAgICAgZ2V0dGVyID0gZGVmW1wiZ2V0XCJdXG4gICAgICBzZXR0ZXIgPSBkZWZbXCJzZXRcIl1cbiAgfVxuXG4gIHZhciBwYXJzZVZhbHVlXG4gIHZhciBzdHJpbmdpZnlWYWx1ZVxuICB2YXIgc2hvdWxkUmVtb3ZlXG5cbiAgc2hvdWxkUmVtb3ZlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSA9PSBudWxsIH1cblxuICBzd2l0Y2ggKHR5cGUpIHtcbiAgICBjYXNlIFwiYm9vbGVhblwiOlxuICAgICAgc2hvdWxkUmVtb3ZlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSA9PT0gZmFsc2UgfVxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT0gbnVsbCB9XG4gICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gXCJcIiB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHBhcnNlSW50KHZhbHVlLCAxMCkgfVxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHBhcnNlRmxvYXQodmFsdWUpIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgIGRlZmF1bHQ6XG4gICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPyBcIlwiK3ZhbHVlIDogXCJcIiB9XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobWFzdGVyLCBuYW1lLCB7XG4gICAgZ2V0OiBnZXR0ZXIgfHwgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIHZhbHVlID0gdGhpcy5lbGVtZW50LmdldEF0dHJpYnV0ZShuYW1lKVxuICAgICAgaWYgKHZhbHVlID09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZVxuICAgICAgfVxuICAgICAgcmV0dXJuIHBhcnNlVmFsdWUgPyBwYXJzZVZhbHVlKHZhbHVlKSA6IHZhbHVlXG4gICAgfSxcbiAgICBzZXQ6IHNldHRlciB8fCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIGlmIChzaG91bGRSZW1vdmUodmFsdWUpKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUobmFtZSlcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB2YWx1ZSA9IHN0cmluZ2lmeVZhbHVlID8gc3RyaW5naWZ5VmFsdWUodmFsdWUpIDogc3RyaW5naWZ5VmFsdWVcbiAgICAgICAgdGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgICAgIH1cbiAgICB9XG4gIH0pXG59XG4iLCJ2YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRcblxuZnVuY3Rpb24gY29tcG9uZW50IChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIHZhciBlbGVtZW50ID0gbnVsbFxuXG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiKVxuICBpZiAodHlwZW9mIG5hbWUgPT0gXCJzdHJpbmdcIikge1xuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICAgIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgICAgb3B0aW9ucyA9IHJvb3RcbiAgICAgIHJvb3QgPSBudWxsXG4gICAgfVxuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiLCBFbGVtZW50KVxuICAgIGVsZW1lbnQgPSBob29rLmZpbmRDb21wb25lbnQobmFtZSwgcm9vdClcbiAgfVxuICAvLyBjb21wb25lbnQoRWxlbWVudFssIHt9XSlcbiAgZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICBlbGVtZW50ID0gbmFtZVxuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuXG4gIHJldHVybiBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIG9wdGlvbnMpXG59XG4iLCIvKipcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciBvbiBhbiBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIGRlbGVnYXRvci5cbiAqIEEgZGVsZWdhdGVkIGV2ZW50IHJ1bnMgbWF0Y2hlcyB0byBmaW5kIGFuIGV2ZW50IHRhcmdldCxcbiAqIHRoZW4gZXhlY3V0ZXMgdGhlIGhhbmRsZXIgcGFpcmVkIHdpdGggdGhlIG1hdGNoZXIuXG4gKiBNYXRjaGVycyBjYW4gY2hlY2sgaWYgYW4gZXZlbnQgdGFyZ2V0IG1hdGNoZXMgYSBnaXZlbiBzZWxlY3RvcixcbiAqIG9yIHNlZSBpZiBhbiBvZiBpdHMgcGFyZW50cyBkby5cbiAqICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlbGVnYXRlKCBvcHRpb25zICl7XG4gICAgdmFyIGVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnRcbiAgICAgICAgLCBldmVudCA9IG9wdGlvbnMuZXZlbnRcbiAgICAgICAgLCBjYXB0dXJlID0gISFvcHRpb25zLmNhcHR1cmV8fGZhbHNlXG4gICAgICAgICwgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dHx8ZWxlbWVudFxuXG4gICAgaWYoICFlbGVtZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGVsZW1lbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgaWYoICFldmVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBldmVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBkZWxlZ2F0b3IgPSBjcmVhdGVEZWxlZ2F0b3IoY29udGV4dClcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGRlbGVnYXRvciwgY2FwdHVyZSlcblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZGVsZWdhdG9yIHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gZXZlbnQgbGlzdGVuZXIuXG4gKiBUaGUgZGVsZWdhdG9yIGhhcyBzdGF0aWMgbWV0aG9kcyB3aGljaCBjYW4gYmUgdXNlZCB0byByZWdpc3RlciBoYW5kbGVycy5cbiAqICovXG5mdW5jdGlvbiBjcmVhdGVEZWxlZ2F0b3IoIGNvbnRleHQgKXtcbiAgICB2YXIgbWF0Y2hlcnMgPSBbXVxuXG4gICAgZnVuY3Rpb24gZGVsZWdhdG9yKCBlICl7XG4gICAgICAgIHZhciBsID0gbWF0Y2hlcnMubGVuZ3RoXG4gICAgICAgIGlmKCAhbCApe1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbCA9IHRoaXNcbiAgICAgICAgICAgICwgaSA9IC0xXG4gICAgICAgICAgICAsIGhhbmRsZXJcbiAgICAgICAgICAgICwgc2VsZWN0b3JcbiAgICAgICAgICAgICwgZGVsZWdhdGVFbGVtZW50XG4gICAgICAgICAgICAsIHN0b3BQcm9wYWdhdGlvblxuICAgICAgICAgICAgLCBhcmdzXG5cbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGFyZ3MgPSBtYXRjaGVyc1tpXVxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF1cbiAgICAgICAgICAgIHNlbGVjdG9yID0gYXJnc1sxXVxuXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBtYXRjaENhcHR1cmVQYXRoKHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCBkZWxlZ2F0ZUVsZW1lbnQgJiYgZGVsZWdhdGVFbGVtZW50Lmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZSA9PT0gaGFuZGxlci5hcHBseShjb250ZXh0LCBbZV0uY29uY2F0KGRlbGVnYXRlRWxlbWVudCkpXG4gICAgICAgICAgICAgICAgaWYoIHN0b3BQcm9wYWdhdGlvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBoYW5kbGVyIHdpdGggYSB0YXJnZXQgZmluZGVyIGxvZ2ljXG4gICAgICogKi9cbiAgICBkZWxlZ2F0b3IubWF0Y2ggPSBmdW5jdGlvbiggc2VsZWN0b3IsIGhhbmRsZXIgKXtcbiAgICAgICAgbWF0Y2hlcnMucHVzaChbaGFuZGxlciwgc2VsZWN0b3JdKVxuICAgICAgICByZXR1cm4gZGVsZWdhdG9yXG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG5mdW5jdGlvbiBtYXRjaENhcHR1cmVQYXRoKCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50cyA9IFtdXG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudCA9IG51bGxcbiAgICBpZiggQXJyYXkuaXNBcnJheShzZWxlY3RvcikgKXtcbiAgICAgICAgdmFyIGkgPSAtMVxuICAgICAgICB2YXIgbCA9IHNlbGVjdG9yLmxlbmd0aFxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvcltpXSwgZWwsIGUpXG4gICAgICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgIH1cbiAgICByZXR1cm4gZGVsZWdhdGVFbGVtZW50c1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSB0YXJnZXQgb3IgYW55IG9mIGl0cyBwYXJlbnQgbWF0Y2hlcyBhIHNlbGVjdG9yXG4gKiAqL1xuZnVuY3Rpb24gZmluZFBhcmVudCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0XG4gICAgc3dpdGNoKCB0eXBlb2Ygc2VsZWN0b3IgKXtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggdGFyZ2V0Lm1hdGNoZXMoc2VsZWN0b3IpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHNlbGVjdG9yLmNhbGwoZWwsIHRhcmdldCkgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICByZXR1cm4gbnVsbFxufVxuIiwidmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmcmFnbWVudFxuXG5mcmFnbWVudC5vcHRpb25zID0ge1xuICB2YXJpYWJsZTogXCJmXCJcbn1cblxuZnVuY3Rpb24gZnJhZ21lbnQoIGh0bWwsIGNvbXBpbGVyLCBjb21waWxlck9wdGlvbnMgKXtcbiAgY29tcGlsZXJPcHRpb25zID0gbWVyZ2UoZnJhZ21lbnQub3B0aW9ucywgY29tcGlsZXJPcHRpb25zKVxuICB2YXIgcmVuZGVyID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlRGF0YSApe1xuICAgIHZhciB0ZW1wID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbiAgICBpZiggdHlwZW9mIGNvbXBpbGVyID09IFwiZnVuY3Rpb25cIiAmJiAhcmVuZGVyICl7XG4gICAgICByZW5kZXIgPSBjb21waWxlcihodG1sLCBjb21waWxlck9wdGlvbnMpXG4gICAgfVxuICAgIGlmKCByZW5kZXIgKXtcbiAgICAgIHRyeXtcbiAgICAgICAgaHRtbCA9IHJlbmRlcih0ZW1wbGF0ZURhdGEpXG4gICAgICB9XG4gICAgICBjYXRjaCggZSApe1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVuZGVyaW5nIGZyYWdtZW50IHdpdGggY29udGV4dDpcIiwgdGVtcGxhdGVEYXRhKVxuICAgICAgICBjb25zb2xlLmVycm9yKHJlbmRlci50b1N0cmluZygpKVxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0ZW1wLmlubmVySFRNTCA9IGh0bWxcbiAgICB2YXIgZnJhZ21lbnQgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gICAgd2hpbGUoIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggKXtcbiAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRlbXAuZmlyc3RDaGlsZClcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50XG4gIH1cbn1cbmZyYWdtZW50LnJlbmRlciA9IGZ1bmN0aW9uKCBodG1sLCB0ZW1wbGF0ZURhdGEgKXtcbiAgcmV0dXJuIGZyYWdtZW50KGh0bWwpKHRlbXBsYXRlRGF0YSlcbn1cbiIsInZhciBjYW1lbGNhc2UgPSByZXF1aXJlKFwiY2FtZWxjYXNlXCIpXG52YXIgQ09NUE9ORU5UX0FUVFJJQlVURSA9IFwiZGF0YS1jb21wb25lbnRcIlxuXG52YXIgaG9vayA9IG1vZHVsZS5leHBvcnRzID0ge31cblxuaG9vay5zZXRIb29rQXR0cmlidXRlID0gc2V0SG9va0F0dHJpYnV0ZVxuaG9vay5jcmVhdGVDb21wb25lbnRTZWxlY3RvciA9IGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yXG5ob29rLmZpbmRDb21wb25lbnQgPSBmaW5kQ29tcG9uZW50XG5ob29rLmZpbmRBbGxDb21wb25lbnQgPSBmaW5kQWxsQ29tcG9uZW50XG5ob29rLmZpbmRTdWJDb21wb25lbnRzID0gZmluZFN1YkNvbXBvbmVudHNcbmhvb2suZ2V0Q29tcG9uZW50TmFtZSA9IGdldENvbXBvbmVudE5hbWVcbmhvb2suZ2V0TWFpbkNvbXBvbmVudE5hbWUgPSBnZXRNYWluQ29tcG9uZW50TmFtZVxuaG9vay5nZXRTdWJDb21wb25lbnROYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZVxuaG9vay5hc3NpZ25TdWJDb21wb25lbnRzID0gYXNzaWduU3ViQ29tcG9uZW50c1xuaG9vay5maWx0ZXIgPSBmaWx0ZXJcblxuZnVuY3Rpb24gc2V0SG9va0F0dHJpYnV0ZSAoaG9vaykge1xuICBDT01QT05FTlRfQVRUUklCVVRFID0gaG9va1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnRTZWxlY3RvciAobmFtZSwgb3BlcmF0b3IpIHtcbiAgbmFtZSA9IG5hbWUgJiYgJ1wiJyArIG5hbWUgKyAnXCInXG4gIG9wZXJhdG9yID0gbmFtZSA/IG9wZXJhdG9yIHx8IFwiPVwiIDogXCJcIlxuICByZXR1cm4gJ1snICsgQ09NUE9ORU5UX0FUVFJJQlVURSArIG9wZXJhdG9yICsgbmFtZSArICddJ1xufVxuXG5mdW5jdGlvbiBmaW5kQ29tcG9uZW50IChuYW1lLCByb290KSB7XG4gIHJldHVybiAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvcihjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSlcbn1cblxuZnVuY3Rpb24gZmluZEFsbENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gW10uc2xpY2UuY2FsbCgocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSkpXG59XG5cbmZ1bmN0aW9uIGZpbmRTdWJDb21wb25lbnRzIChuYW1lLCByb290KSB7XG4gIHZhciBlbGVtZW50cyA9IChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUsIFwiXj1cIikpXG4gIHJldHVybiBmaWx0ZXIoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50LCBjb21wb25lbnROYW1lLCBtYWluQ29tcG9uZW50TmFtZSwgc3ViQ29tcG9uZW50TmFtZSkge1xuICAgIHJldHVybiBzdWJDb21wb25lbnROYW1lICYmIG5hbWUgPT09IG1haW5Db21wb25lbnROYW1lXG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKENPTVBPTkVOVF9BVFRSSUJVVEUpXG4gIHJldHVybiBjYyA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRNYWluQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMF0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0U3ViQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMV0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gYXNzaWduU3ViQ29tcG9uZW50cyAob2JqLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGFzc2lnbikge1xuICByZXR1cm4gc3ViQ29tcG9uZW50cy5yZWR1Y2UoZnVuY3Rpb24gKG9iaiwgZWxlbWVudCkge1xuICAgIHZhciBuYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50KVxuICAgIGlmIChuYW1lKSB7XG5cbiAgICAgIGVsZW1lbnQgPSB0eXBlb2YgdHJhbnNmb3JtID09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/IHRyYW5zZm9ybShlbGVtZW50LCBuYW1lKVxuICAgICAgICA6IGVsZW1lbnRcblxuICAgICAgaWYgKHR5cGVvZiBhc3NpZ24gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGFzc2lnbihvYmosIG5hbWUsIGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9ialtuYW1lXSkpIHtcbiAgICAgICAgb2JqW25hbWVdLnB1c2goZWxlbWVudClcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmpbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmpcbiAgfSwgb2JqKVxufVxuXG5mdW5jdGlvbiBmaWx0ZXIgKGVsZW1lbnRzLCBmaWx0ZXIpIHtcbiAgc3dpdGNoICh0eXBlb2YgZmlsdGVyKSB7XG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChlbGVtZW50cykuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBmaWx0ZXIoZWxlbWVudCwgZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSksIGdldE1haW5Db21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSwgZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkpXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChlbGVtZW50cykuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQpID09PSBmaWx0ZXJcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbFxuICB9XG59XG4iLCJ2YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL0NvbXBvbmVudFwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHJlZ2lzdGVyIChuYW1lLCBtaXhpbiwgQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgaWYgKCFDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gbWl4aW5cbiAgICBtaXhpbiA9IFtdXG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gZnVuY3Rpb25zIGluLWJldHdlZW4gYXJlIG1peGluXG4gICAgbWl4aW4gPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSwgLTEpXG4gICAgLy8gbWFpbiBjb25zdHJ1Y3RvciBpcyBhbHdheXMgbGFzdCBhcmd1bWVudFxuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIC0xKVswXVxuICB9XG5cbiAgaWYgKCFDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gZnVuY3Rpb24gKCkge31cbiAgfVxuXG4gIGZ1bmN0aW9uIEN1c3RvbUNvbXBvbmVudCAoZWxlbWVudCwgb3B0aW9ucykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDdXN0b21Db21wb25lbnQpKSB7XG4gICAgICByZXR1cm4gbmV3IEN1c3RvbUNvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICAgIH1cbiAgICB2YXIgaW5zdGFuY2UgPSB0aGlzXG5cbiAgICBDb21wb25lbnQuY2FsbChpbnN0YW5jZSwgZWxlbWVudCwgb3B0aW9ucylcbiAgICAvLyBhdCB0aGlzIHBvaW50IGN1c3RvbSBjb25zdHJ1Y3RvcnMgY2FuIGFscmVhZHkgYWNjZXNzIHRoZSBlbGVtZW50IGFuZCBzdWIgY29tcG9uZW50c1xuICAgIC8vIHNvIHRoZXkgb25seSByZWNlaXZlIHRoZSBvcHRpb25zIG9iamVjdCBmb3IgY29udmVuaWVuY2VcbiAgICBDb21wb25lbnRDb25zdHJ1Y3Rvci5jYWxsKGluc3RhbmNlLCBvcHRpb25zKVxuICB9XG5cbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ29tcG9uZW50LnByb3RvdHlwZSlcbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEN1c3RvbUNvbXBvbmVudFxuICB2YXIgaW50ZXJuYWxzID0gbmV3IEludGVybmFscyhDdXN0b21Db21wb25lbnQucHJvdG90eXBlKVxuICBpbnRlcm5hbHMuYXV0b0Fzc2lnbiA9IHRydWVcbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZS5pbnRlcm5hbHMgPSBpbnRlcm5hbHNcbiAgbWl4aW4uZm9yRWFjaChmdW5jdGlvbiAobWl4aW4pIHtcbiAgICBtaXhpbi5jYWxsKEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUsIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUpXG4gIH0pXG5cbiAgcmV0dXJuIHJlZ2lzdHJ5LnNldChuYW1lLCBDdXN0b21Db21wb25lbnQpXG4gIC8vIGRlZmluZSBtYWluIHByb3RvdHlwZSBhZnRlciByZWdpc3RlcmluZ1xufVxuIiwidmFyIHJlZ2lzdHJ5ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG52YXIgY29tcG9uZW50cyA9IHt9XG5cbnJlZ2lzdHJ5LmdldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5leGlzdHMgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuICEhY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5zZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUsIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdID0gQ29tcG9uZW50Q29uc3RydWN0b3Jcbn1cbiIsInZhciBzdG9yYWdlID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxudmFyIGNvbXBvbmVudHMgPSBbXVxudmFyIGVsZW1lbnRzID0gW11cblxuc3RvcmFnZS5nZXQgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICByZXR1cm4gY29tcG9uZW50c1tlbGVtZW50cy5pbmRleE9mKGVsZW1lbnQpXVxufVxuXG5zdG9yYWdlLnNhdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gIGNvbXBvbmVudHMucHVzaChjb21wb25lbnQpXG4gIGVsZW1lbnRzLnB1c2goY29tcG9uZW50LmVsZW1lbnQpXG59XG5cbnN0b3JhZ2UucmVtb3ZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICB2YXIgaSA9IGNvbXBvbmVudCBpbnN0YW5jZW9mIEVsZW1lbnRcbiAgICAgID8gZWxlbWVudHMuaW5kZXhPZihjb21wb25lbnQpXG4gICAgICA6IGNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnQpXG5cbiAgaWYgKH5pKSB7XG4gICAgY29tcG9uZW50cy5zcGxpY2UoaSwgMSlcbiAgICBlbGVtZW50cy5zcGxpY2UoaSwgMSlcbiAgfVxufVxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCggb2JqLCBleHRlbnNpb24gKXtcbiAgZm9yKCB2YXIgbmFtZSBpbiBleHRlbnNpb24gKXtcbiAgICBpZiggZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KG5hbWUpICkgb2JqW25hbWVdID0gZXh0ZW5zaW9uW25hbWVdXG4gIH1cbiAgcmV0dXJuIG9ialxufVxuIiwidmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuL2V4dGVuZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBvYmosIGV4dGVuc2lvbiApe1xuICByZXR1cm4gZXh0ZW5kKGV4dGVuZCh7fSwgb2JqKSwgZXh0ZW5zaW9uKVxufVxuIiwidmFyIG9iamVjdCA9IG1vZHVsZS5leHBvcnRzID0ge31cblxub2JqZWN0LmRlZmluZUdldHRlciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBnZXQ6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVTZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgc2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QubWV0aG9kID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmblxuICB9KVxufVxuXG5vYmplY3QucHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgdmFsdWU6IGZuLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KVxufVxuIl19
