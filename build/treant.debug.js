(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.treant = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var hook = require("./src/hook")
var register = require("./src/register")
var component = require("./src/create")
var Component = require("./src/Component")
var delegate = require("./src/delegate")
var fragment = require("./src/fragment")

var treant = {}
module.exports = treant

treant.register = register
treant.component = component
treant.Component = Component
treant.delegate = delegate
treant.fragment = fragment
treant.hook = hook

var plugins = {}
treant.plugins = plugins

plugins.attributes = require("./plugins/attributes")
plugins.findBy = require("./plugins/findBy")

var util = {}
treant.util = util

util.extend = require("./util/extend")
util.merge = require("./util/merge")
util.object = require("./util/object")

},{"./plugins/attributes":3,"./plugins/findBy":4,"./src/Component":5,"./src/create":7,"./src/delegate":8,"./src/fragment":9,"./src/hook":10,"./src/register":11,"./util/extend":13,"./util/merge":14,"./util/object":15}],2:[function(require,module,exports){
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
var object = require("../util/object")

module.exports = function () {
  return function plugin (prototype) {

    prototype.before("create", function () {
      debugger
    })

    object.method(prototype, "defineAttribute", function (name, def) {
      def = def || {}
      var type
      var parseValue
      var stringifyValue
      var shouldRemove
      var getter
      var setter

      shouldRemove = function (value) {
        return value === null
      }

      type = def.type
      getter = def.get
      setter = def.set

      switch (type) {
        case "boolean":
          shouldRemove = function (value) {
            return value === false
          }
          parseValue = function (value) {
            return !!value
          }
          stringifyValue = function () {
            return ""
          }
          break
        case "number":
          parseValue = function (value) {
            return parseInt(value, 10)
          }
          break
        case "float":
          parseValue = function (value) {
            return parseFloat(value)
          }
          break
        case "string":
        default:
          stringifyValue = function (value) {
            return value ? ""+value : ""
          }
      }

      Object.defineProperty(prototype, name, {
        get: getter || function () {
          var value = this.element.getAttribute(name)
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
    })
  }
}

},{"../util/object":15}],4:[function(require,module,exports){
var object = require("../util/object")

module.exports = function () {
  return function plugin(prototype) {

    function process( element, processor, result ){
      switch( true ){
        case typeof processor == "function":
          return processor.call(element, result)
        case processor == "array":
          return [].slice.call(result)
        default:
          return result
      }
    }

    object.method(prototype, "byClassName", function (className, processor) {
      return process(this, processor, this.getElementsByClassName(className))
    })

    object.method(prototype, "byClassName", function( className, processor ){
      return process(this, processor, this.getElementsByClassName(className))
    })

    object.method(prototype, "byTagName", function( tagName, processor ){
      return process(this, processor, this.getElementsByTagName(tagName))
    })

    object.method(prototype, "byId", function( id, processor ){
      return process(this, processor, this.getElementById(id))
    })

    object.method(prototype, "bySelector", function( selector, processor ){
      return process(this, processor, this.querySelector(selector))
    })

    object.method(prototype, "bySelectorALl", function( selector, processor ){
      return process(this, processor, this.querySelectorAll(selector))
    })

    object.method(prototype, "byAttribute", function( attribute, processor ){
      return process(this, processor, this.querySelector('['+attribute+']'))
    })

    object.method(prototype, "byAttributeAll", function( attribute, processor ){
      return process(this, processor, this.querySelectorAll('['+attribute+']'))
    })
  }
}

},{"../util/object":15}],5:[function(require,module,exports){
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

},{"./Internals":6,"./delegate":8,"./hook":10,"./registry":12}],6:[function(require,module,exports){
var merge = require("../util/merge")

var defaultEventDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = Internals

function Internals () {
  this.autoAssign = true
  this.convertSubComponents = false
  this.components = {}
  this._events = {}
}

Internals.prototype.defineEvent = function (type, definition) {
  this._events[type] = definition
}

Internals.prototype.getEventDefinition = function (type, detail) {
  var definition = merge(defaultEventDefinition, this._events[type])
  definition.detail = typeof detail == "undefined" ? definition.detail : detail
  return definition
}

},{"../util/merge":14}],7:[function(require,module,exports){
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

},{"./Component":5,"./hook":10}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{"../util/merge":14}],10:[function(require,module,exports){
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

},{"camelcase":2}],11:[function(require,module,exports){
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

  var internals = new Internals()
  internals.autoAssign = true

  CustomComponent.prototype = new Component()
  CustomComponent.prototype.internals = internals
  mixin.forEach(function (mixin) {
    mixin(CustomComponent.prototype)
  })

  return registry.set(name, CustomComponent)
  // define main prototype after registering
}

},{"./Component":5,"./Internals":6,"./registry":12}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
module.exports = function extend( obj, extension ){
  for( var name in extension ){
    if( extension.hasOwnProperty(name) ) obj[name] = extension[name]
  }
  return obj
}

},{}],14:[function(require,module,exports){
var extend = require("./extend")

module.exports = function( obj, extension ){
  return extension(extend({}, obj), extension)
}

},{"./extend":13}],15:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJwbHVnaW5zL2F0dHJpYnV0ZXMuanMiLCJwbHVnaW5zL2ZpbmRCeS5qcyIsInNyYy9Db21wb25lbnQuanMiLCJzcmMvSW50ZXJuYWxzLmpzIiwic3JjL2NyZWF0ZS5qcyIsInNyYy9kZWxlZ2F0ZS5qcyIsInNyYy9mcmFnbWVudC5qcyIsInNyYy9ob29rLmpzIiwic3JjL3JlZ2lzdGVyLmpzIiwic3JjL3JlZ2lzdHJ5LmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBob29rID0gcmVxdWlyZShcIi4vc3JjL2hvb2tcIilcbnZhciByZWdpc3RlciA9IHJlcXVpcmUoXCIuL3NyYy9yZWdpc3RlclwiKVxudmFyIGNvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9jcmVhdGVcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvQ29tcG9uZW50XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9zcmMvZGVsZWdhdGVcIilcbnZhciBmcmFnbWVudCA9IHJlcXVpcmUoXCIuL3NyYy9mcmFnbWVudFwiKVxuXG52YXIgdHJlYW50ID0ge31cbm1vZHVsZS5leHBvcnRzID0gdHJlYW50XG5cbnRyZWFudC5yZWdpc3RlciA9IHJlZ2lzdGVyXG50cmVhbnQuY29tcG9uZW50ID0gY29tcG9uZW50XG50cmVhbnQuQ29tcG9uZW50ID0gQ29tcG9uZW50XG50cmVhbnQuZGVsZWdhdGUgPSBkZWxlZ2F0ZVxudHJlYW50LmZyYWdtZW50ID0gZnJhZ21lbnRcbnRyZWFudC5ob29rID0gaG9va1xuXG52YXIgcGx1Z2lucyA9IHt9XG50cmVhbnQucGx1Z2lucyA9IHBsdWdpbnNcblxucGx1Z2lucy5hdHRyaWJ1dGVzID0gcmVxdWlyZShcIi4vcGx1Z2lucy9hdHRyaWJ1dGVzXCIpXG5wbHVnaW5zLmZpbmRCeSA9IHJlcXVpcmUoXCIuL3BsdWdpbnMvZmluZEJ5XCIpXG5cbnZhciB1dGlsID0ge31cbnRyZWFudC51dGlsID0gdXRpbFxuXG51dGlsLmV4dGVuZCA9IHJlcXVpcmUoXCIuL3V0aWwvZXh0ZW5kXCIpXG51dGlsLm1lcmdlID0gcmVxdWlyZShcIi4vdXRpbC9tZXJnZVwiKVxudXRpbC5vYmplY3QgPSByZXF1aXJlKFwiLi91dGlsL29iamVjdFwiKVxuIiwiJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyKSB7XG5cdHN0ciA9IHN0ci50cmltKCk7XG5cblx0aWYgKHN0ci5sZW5ndGggPT09IDEgfHwgISgvW18uXFwtIF0rLykudGVzdChzdHIpICkge1xuXHRcdGlmIChzdHJbMF0gPT09IHN0clswXS50b0xvd2VyQ2FzZSgpICYmIHN0ci5zbGljZSgxKSAhPT0gc3RyLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0ci50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cblx0cmV0dXJuIHN0clxuXHQucmVwbGFjZSgvXltfLlxcLSBdKy8sICcnKVxuXHQudG9Mb3dlckNhc2UoKVxuXHQucmVwbGFjZSgvW18uXFwtIF0rKFxcd3wkKS9nLCBmdW5jdGlvbiAobSwgcDEpIHtcblx0XHRyZXR1cm4gcDEudG9VcHBlckNhc2UoKTtcblx0fSk7XG59O1xuIiwidmFyIG9iamVjdCA9IHJlcXVpcmUoXCIuLi91dGlsL29iamVjdFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHBsdWdpbiAocHJvdG90eXBlKSB7XG5cbiAgICBwcm90b3R5cGUuYmVmb3JlKFwiY3JlYXRlXCIsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGRlYnVnZ2VyXG4gICAgfSlcblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImRlZmluZUF0dHJpYnV0ZVwiLCBmdW5jdGlvbiAobmFtZSwgZGVmKSB7XG4gICAgICBkZWYgPSBkZWYgfHwge31cbiAgICAgIHZhciB0eXBlXG4gICAgICB2YXIgcGFyc2VWYWx1ZVxuICAgICAgdmFyIHN0cmluZ2lmeVZhbHVlXG4gICAgICB2YXIgc2hvdWxkUmVtb3ZlXG4gICAgICB2YXIgZ2V0dGVyXG4gICAgICB2YXIgc2V0dGVyXG5cbiAgICAgIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdmFsdWUgPT09IG51bGxcbiAgICAgIH1cblxuICAgICAgdHlwZSA9IGRlZi50eXBlXG4gICAgICBnZXR0ZXIgPSBkZWYuZ2V0XG4gICAgICBzZXR0ZXIgPSBkZWYuc2V0XG5cbiAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFwiYm9vbGVhblwiOlxuICAgICAgICAgIHNob3VsZFJlbW92ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlID09PSBmYWxzZVxuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gISF2YWx1ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBcIlwiXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQodmFsdWUsIDEwKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHN0cmluZ2lmeVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgPyBcIlwiK3ZhbHVlIDogXCJcIlxuICAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICBnZXQ6IGdldHRlciB8fCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gdGhpcy5lbGVtZW50LmdldEF0dHJpYnV0ZShuYW1lKVxuICAgICAgICAgIHJldHVybiBwYXJzZVZhbHVlID8gcGFyc2VWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICAgICAgICB9LFxuICAgICAgICBzZXQ6IHNldHRlciB8fCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2hvdWxkUmVtb3ZlKHZhbHVlKSkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnJlbW92ZUF0dHJpYnV0ZShuYW1lKVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhbHVlID0gc3RyaW5naWZ5VmFsdWUgPyBzdHJpbmdpZnlWYWx1ZSh2YWx1ZSkgOiBzdHJpbmdpZnlWYWx1ZVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZShuYW1lLCB2YWx1ZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgfVxufVxuIiwidmFyIG9iamVjdCA9IHJlcXVpcmUoXCIuLi91dGlsL29iamVjdFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHBsdWdpbihwcm90b3R5cGUpIHtcblxuICAgIGZ1bmN0aW9uIHByb2Nlc3MoIGVsZW1lbnQsIHByb2Nlc3NvciwgcmVzdWx0ICl7XG4gICAgICBzd2l0Y2goIHRydWUgKXtcbiAgICAgICAgY2FzZSB0eXBlb2YgcHJvY2Vzc29yID09IFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICByZXR1cm4gcHJvY2Vzc29yLmNhbGwoZWxlbWVudCwgcmVzdWx0KVxuICAgICAgICBjYXNlIHByb2Nlc3NvciA9PSBcImFycmF5XCI6XG4gICAgICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwocmVzdWx0KVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHJldHVybiByZXN1bHRcbiAgICAgIH1cbiAgICB9XG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJieUNsYXNzTmFtZVwiLCBmdW5jdGlvbiAoY2xhc3NOYW1lLCBwcm9jZXNzb3IpIHtcbiAgICAgIHJldHVybiBwcm9jZXNzKHRoaXMsIHByb2Nlc3NvciwgdGhpcy5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGNsYXNzTmFtZSkpXG4gICAgfSlcblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImJ5Q2xhc3NOYW1lXCIsIGZ1bmN0aW9uKCBjbGFzc05hbWUsIHByb2Nlc3NvciApe1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoY2xhc3NOYW1lKSlcbiAgICB9KVxuXG4gICAgb2JqZWN0Lm1ldGhvZChwcm90b3R5cGUsIFwiYnlUYWdOYW1lXCIsIGZ1bmN0aW9uKCB0YWdOYW1lLCBwcm9jZXNzb3IgKXtcbiAgICAgIHJldHVybiBwcm9jZXNzKHRoaXMsIHByb2Nlc3NvciwgdGhpcy5nZXRFbGVtZW50c0J5VGFnTmFtZSh0YWdOYW1lKSlcbiAgICB9KVxuXG4gICAgb2JqZWN0Lm1ldGhvZChwcm90b3R5cGUsIFwiYnlJZFwiLCBmdW5jdGlvbiggaWQsIHByb2Nlc3NvciApe1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLmdldEVsZW1lbnRCeUlkKGlkKSlcbiAgICB9KVxuXG4gICAgb2JqZWN0Lm1ldGhvZChwcm90b3R5cGUsIFwiYnlTZWxlY3RvclwiLCBmdW5jdGlvbiggc2VsZWN0b3IsIHByb2Nlc3NvciApe1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpKVxuICAgIH0pXG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJieVNlbGVjdG9yQUxsXCIsIGZ1bmN0aW9uKCBzZWxlY3RvciwgcHJvY2Vzc29yICl7XG4gICAgICByZXR1cm4gcHJvY2Vzcyh0aGlzLCBwcm9jZXNzb3IsIHRoaXMucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpXG4gICAgfSlcblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImJ5QXR0cmlidXRlXCIsIGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIHByb2Nlc3NvciApe1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ1snK2F0dHJpYnV0ZSsnXScpKVxuICAgIH0pXG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJieUF0dHJpYnV0ZUFsbFwiLCBmdW5jdGlvbiggYXR0cmlidXRlLCBwcm9jZXNzb3IgKXtcbiAgICAgIHJldHVybiBwcm9jZXNzKHRoaXMsIHByb2Nlc3NvciwgdGhpcy5xdWVyeVNlbGVjdG9yQWxsKCdbJythdHRyaWJ1dGUrJ10nKSlcbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcbnZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9kZWxlZ2F0ZVwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudFxuXG5mdW5jdGlvbiBDb21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENvbXBvbmVudCkpIHtcbiAgICByZXR1cm4gbmV3IENvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICB9XG5cbiAgdGhpcy5lbGVtZW50ID0gZWxlbWVudCB8fCBudWxsXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG5cbiAgaWYgKHRoaXMuZWxlbWVudCAmJiB0aGlzLmludGVybmFscy5hdXRvQXNzaWduKSB7XG4gICAgdGhpcy5hc3NpZ25TdWJDb21wb25lbnRzKClcbiAgfVxufVxuXG5Db21wb25lbnQuY3JlYXRlID0gZnVuY3Rpb24gKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgdmFyIG5hbWUgPSBob29rLmdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpXG5cbiAgaWYgKCFuYW1lKSB7XG4gICAgY29uc29sZS53YXJuKFwiVW5hYmxlIHRvIGNyZWF0ZSBjb21wb25lbnQsIHRoaXMgZWxlbWVudCBkb2Vzbid0IGhhdmUgYSBjb21wb25lbnQgYXR0cmlidXRlXCIsIGVsZW1lbnQpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIHZhciBDb21wb25lbnRDb25zdHJ1Y3RvciA9IG51bGxcblxuICBpZiAocmVnaXN0cnkuZXhpc3RzKG5hbWUpKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSAgcmVnaXN0cnkuZ2V0KG5hbWUpXG4gIH1cbiAgZWxzZSBpZiAocmVnaXN0cnkuZXhpc3RzKFwiKlwiKSkge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gcmVnaXN0cnkuZ2V0KFwiKlwiKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIk1pc3NpbmcgY3VzdG9tIGNvbXBvbmVudCAnJXMnIGZvciBcIiwgbmFtZSwgZWxlbWVudCxcbiAgICAgICAgJyBVc2UgdGhlIENvbXBvbmVudCBjb25zdHJ1Y3RvciB0byBjcmVhdGUgcmF3IGNvbXBvbmVudHMgb3IgcmVnaXN0ZXIgYSBcIipcIiBjb21wb25lbnQuJylcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IENvbXBvbmVudFxuICB9XG5cbiAgcmV0dXJuIG5ldyBDb21wb25lbnRDb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKVxufVxuXG5Db21wb25lbnQucHJvdG90eXBlID0ge1xuICBpbnRlcm5hbHM6IG5ldyBJbnRlcm5hbHMoKSxcblxuICBkZWxlZ2F0ZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmVsZW1lbnQgPSB0aGlzLmVsZW1lbnRcbiAgICBvcHRpb25zLmNvbnRleHQgPSBvcHRpb25zLmNvbnRleHQgfHwgdGhpc1xuICAgIHJldHVybiBkZWxlZ2F0ZShvcHRpb25zKVxuICB9LFxuXG4gIGRpc3BhdGNoOiBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gICAgdmFyIGRlZmluaXRpb24gPSB0aGlzLmludGVybmFscy5nZXRFdmVudERlZmluaXRpb24odHlwZSwgZGV0YWlsKVxuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IHdpbmRvdy5DdXN0b21FdmVudCh0eXBlLCBkZWZpbml0aW9uKSlcbiAgfSxcblxuICBmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRDb21wb25lbnQobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kQWxsQ29tcG9uZW50OiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRBbGxDb21wb25lbnQobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kU3ViQ29tcG9uZW50cyhuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGdldENvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldENvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgZ2V0TWFpbkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldE1haW5Db21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGdldFN1YkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldFN1YkNvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgY2xlYXJTdWJDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzID0ge31cbiAgfSxcbiAgYXNzaWduU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKHRyYW5zZm9ybSkge1xuICAgIHZhciBob3N0Q29tcG9uZW50ID0gdGhpc1xuICAgIHZhciBzdWJDb21wb25lbnRzID0gaG9vay5maW5kU3ViQ29tcG9uZW50cyh0aGlzLmdldE1haW5Db21wb25lbnROYW1lKGZhbHNlKSwgdGhpcy5lbGVtZW50KVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaW50ZXJuYWxzLmNvbnZlcnRTdWJDb21wb25lbnRzICYmICh0eXBlb2YgdHJhbnNmb3JtID09IFwidW5kZWZpbmVkXCIgfHwgdHJhbnNmb3JtID09PSB0cnVlKSkge1xuICAgICAgdHJhbnNmb3JtID0gZnVuY3Rpb24gKGVsZW1lbnQvKiwgbmFtZSovKSB7XG4gICAgICAgIHJldHVybiBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIGhvc3RDb21wb25lbnQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGludGVybmFscyA9IHRoaXMuaW50ZXJuYWxzXG5cbiAgICBob29rLmFzc2lnblN1YkNvbXBvbmVudHModGhpcy5jb21wb25lbnRzLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGZ1bmN0aW9uIChjb21wb25lbnRzLCBuYW1lLCBlbGVtZW50KSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGNvbXBvbmVudHNbbmFtZV0gfHwgW11cbiAgICAgICAgY29tcG9uZW50c1tuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxuXG52YXIgZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiA9IHtcbiAgZGV0YWlsOiBudWxsLFxuICB2aWV3OiB3aW5kb3csXG4gIGJ1YmJsZXM6IHRydWUsXG4gIGNhbmNlbGFibGU6IHRydWVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBJbnRlcm5hbHNcblxuZnVuY3Rpb24gSW50ZXJuYWxzICgpIHtcbiAgdGhpcy5hdXRvQXNzaWduID0gdHJ1ZVxuICB0aGlzLmNvbnZlcnRTdWJDb21wb25lbnRzID0gZmFsc2VcbiAgdGhpcy5jb21wb25lbnRzID0ge31cbiAgdGhpcy5fZXZlbnRzID0ge31cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5kZWZpbmVFdmVudCA9IGZ1bmN0aW9uICh0eXBlLCBkZWZpbml0aW9uKSB7XG4gIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGRlZmluaXRpb25cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXRFdmVudERlZmluaXRpb24gPSBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gIHZhciBkZWZpbml0aW9uID0gbWVyZ2UoZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiwgdGhpcy5fZXZlbnRzW3R5cGVdKVxuICBkZWZpbml0aW9uLmRldGFpbCA9IHR5cGVvZiBkZXRhaWwgPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmluaXRpb24uZGV0YWlsIDogZGV0YWlsXG4gIHJldHVybiBkZWZpbml0aW9uXG59XG4iLCJ2YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRcblxuZnVuY3Rpb24gY29tcG9uZW50IChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIHZhciBlbGVtZW50ID0gbnVsbFxuXG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiKVxuICBpZiAodHlwZW9mIG5hbWUgPT0gXCJzdHJpbmdcIikge1xuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICAgIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgICAgb3B0aW9ucyA9IHJvb3RcbiAgICAgIHJvb3QgPSBudWxsXG4gICAgfVxuICAgIC8vIGNvbXBvbmVudChcInN0cmluZ1wiLCBFbGVtZW50KVxuICAgIGVsZW1lbnQgPSBob29rLmZpbmRDb21wb25lbnQobmFtZSwgcm9vdClcbiAgfVxuICAvLyBjb21wb25lbnQoRWxlbWVudFssIHt9XSlcbiAgZWxzZSBpZiAobmFtZSBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICBlbGVtZW50ID0gbmFtZVxuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuXG4gIHJldHVybiBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIG9wdGlvbnMpXG59XG4iLCIvKipcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciBvbiBhbiBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIGRlbGVnYXRvci5cbiAqIEEgZGVsZWdhdGVkIGV2ZW50IHJ1bnMgbWF0Y2hlcyB0byBmaW5kIGFuIGV2ZW50IHRhcmdldCxcbiAqIHRoZW4gZXhlY3V0ZXMgdGhlIGhhbmRsZXIgcGFpcmVkIHdpdGggdGhlIG1hdGNoZXIuXG4gKiBNYXRjaGVycyBjYW4gY2hlY2sgaWYgYW4gZXZlbnQgdGFyZ2V0IG1hdGNoZXMgYSBnaXZlbiBzZWxlY3RvcixcbiAqIG9yIHNlZSBpZiBhbiBvZiBpdHMgcGFyZW50cyBkby5cbiAqICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlbGVnYXRlKCBvcHRpb25zICl7XG4gICAgdmFyIGVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnRcbiAgICAgICAgLCBldmVudCA9IG9wdGlvbnMuZXZlbnRcbiAgICAgICAgLCBjYXB0dXJlID0gISFvcHRpb25zLmNhcHR1cmV8fGZhbHNlXG4gICAgICAgICwgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dHx8ZWxlbWVudFxuXG4gICAgaWYoICFlbGVtZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGVsZW1lbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgaWYoICFldmVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBldmVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBkZWxlZ2F0b3IgPSBjcmVhdGVEZWxlZ2F0b3IoY29udGV4dClcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGRlbGVnYXRvciwgY2FwdHVyZSlcblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZGVsZWdhdG9yIHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gZXZlbnQgbGlzdGVuZXIuXG4gKiBUaGUgZGVsZWdhdG9yIGhhcyBzdGF0aWMgbWV0aG9kcyB3aGljaCBjYW4gYmUgdXNlZCB0byByZWdpc3RlciBoYW5kbGVycy5cbiAqICovXG5mdW5jdGlvbiBjcmVhdGVEZWxlZ2F0b3IoIGNvbnRleHQgKXtcbiAgICB2YXIgbWF0Y2hlcnMgPSBbXVxuXG4gICAgZnVuY3Rpb24gZGVsZWdhdG9yKCBlICl7XG4gICAgICAgIHZhciBsID0gbWF0Y2hlcnMubGVuZ3RoXG4gICAgICAgIGlmKCAhbCApe1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbCA9IHRoaXNcbiAgICAgICAgICAgICwgaSA9IC0xXG4gICAgICAgICAgICAsIGhhbmRsZXJcbiAgICAgICAgICAgICwgc2VsZWN0b3JcbiAgICAgICAgICAgICwgZGVsZWdhdGVFbGVtZW50XG4gICAgICAgICAgICAsIHN0b3BQcm9wYWdhdGlvblxuICAgICAgICAgICAgLCBhcmdzXG5cbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGFyZ3MgPSBtYXRjaGVyc1tpXVxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF1cbiAgICAgICAgICAgIHNlbGVjdG9yID0gYXJnc1sxXVxuXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBtYXRjaENhcHR1cmVQYXRoKHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCBkZWxlZ2F0ZUVsZW1lbnQgJiYgZGVsZWdhdGVFbGVtZW50Lmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZSA9PT0gaGFuZGxlci5hcHBseShjb250ZXh0LCBbZV0uY29uY2F0KGRlbGVnYXRlRWxlbWVudCkpXG4gICAgICAgICAgICAgICAgaWYoIHN0b3BQcm9wYWdhdGlvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBoYW5kbGVyIHdpdGggYSB0YXJnZXQgZmluZGVyIGxvZ2ljXG4gICAgICogKi9cbiAgICBkZWxlZ2F0b3IubWF0Y2ggPSBmdW5jdGlvbiggc2VsZWN0b3IsIGhhbmRsZXIgKXtcbiAgICAgICAgbWF0Y2hlcnMucHVzaChbaGFuZGxlciwgc2VsZWN0b3JdKVxuICAgICAgICByZXR1cm4gZGVsZWdhdG9yXG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG5mdW5jdGlvbiBtYXRjaENhcHR1cmVQYXRoKCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50cyA9IFtdXG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudCA9IG51bGxcbiAgICBpZiggQXJyYXkuaXNBcnJheShzZWxlY3RvcikgKXtcbiAgICAgICAgdmFyIGkgPSAtMVxuICAgICAgICB2YXIgbCA9IHNlbGVjdG9yLmxlbmd0aFxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvcltpXSwgZWwsIGUpXG4gICAgICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgIH1cbiAgICByZXR1cm4gZGVsZWdhdGVFbGVtZW50c1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSB0YXJnZXQgb3IgYW55IG9mIGl0cyBwYXJlbnQgbWF0Y2hlcyBhIHNlbGVjdG9yXG4gKiAqL1xuZnVuY3Rpb24gZmluZFBhcmVudCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0XG4gICAgc3dpdGNoKCB0eXBlb2Ygc2VsZWN0b3IgKXtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggdGFyZ2V0Lm1hdGNoZXMoc2VsZWN0b3IpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHNlbGVjdG9yLmNhbGwoZWwsIHRhcmdldCkgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICByZXR1cm4gbnVsbFxufVxuIiwidmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmcmFnbWVudFxuXG5mcmFnbWVudC5vcHRpb25zID0ge1xuICB2YXJpYWJsZTogXCJmXCJcbn1cblxuZnVuY3Rpb24gZnJhZ21lbnQoIGh0bWwsIGNvbXBpbGVyLCBjb21waWxlck9wdGlvbnMgKXtcbiAgY29tcGlsZXJPcHRpb25zID0gbWVyZ2UoZnJhZ21lbnQub3B0aW9ucywgY29tcGlsZXJPcHRpb25zKVxuICB2YXIgcmVuZGVyID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlRGF0YSApe1xuICAgIHZhciB0ZW1wID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbiAgICBpZiggdHlwZW9mIGNvbXBpbGVyID09IFwiZnVuY3Rpb25cIiAmJiAhcmVuZGVyICl7XG4gICAgICByZW5kZXIgPSBjb21waWxlcihodG1sLCBjb21waWxlck9wdGlvbnMpXG4gICAgfVxuICAgIGlmKCByZW5kZXIgKXtcbiAgICAgIHRyeXtcbiAgICAgICAgaHRtbCA9IHJlbmRlcih0ZW1wbGF0ZURhdGEpXG4gICAgICB9XG4gICAgICBjYXRjaCggZSApe1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVuZGVyaW5nIGZyYWdtZW50IHdpdGggY29udGV4dDpcIiwgdGVtcGxhdGVEYXRhKVxuICAgICAgICBjb25zb2xlLmVycm9yKHJlbmRlci50b1N0cmluZygpKVxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0ZW1wLmlubmVySFRNTCA9IGh0bWxcbiAgICB2YXIgZnJhZ21lbnQgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gICAgd2hpbGUoIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggKXtcbiAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRlbXAuZmlyc3RDaGlsZClcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50XG4gIH1cbn1cbmZyYWdtZW50LnJlbmRlciA9IGZ1bmN0aW9uKCBodG1sLCB0ZW1wbGF0ZURhdGEgKXtcbiAgcmV0dXJuIGZyYWdtZW50KGh0bWwpKHRlbXBsYXRlRGF0YSlcbn1cbiIsInZhciBjYW1lbGNhc2UgPSByZXF1aXJlKFwiY2FtZWxjYXNlXCIpXG52YXIgQ09NUE9ORU5UX0FUVFJJQlVURSA9IFwiZGF0YS1jb21wb25lbnRcIlxuXG52YXIgaG9vayA9IG1vZHVsZS5leHBvcnRzID0ge31cblxuaG9vay5zZXRIb29rQXR0cmlidXRlID0gc2V0SG9va0F0dHJpYnV0ZVxuaG9vay5jcmVhdGVDb21wb25lbnRTZWxlY3RvciA9IGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yXG5ob29rLmZpbmRDb21wb25lbnQgPSBmaW5kQ29tcG9uZW50XG5ob29rLmZpbmRBbGxDb21wb25lbnQgPSBmaW5kQWxsQ29tcG9uZW50XG5ob29rLmZpbmRTdWJDb21wb25lbnRzID0gZmluZFN1YkNvbXBvbmVudHNcbmhvb2suZ2V0Q29tcG9uZW50TmFtZSA9IGdldENvbXBvbmVudE5hbWVcbmhvb2suZ2V0TWFpbkNvbXBvbmVudE5hbWUgPSBnZXRNYWluQ29tcG9uZW50TmFtZVxuaG9vay5nZXRTdWJDb21wb25lbnROYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZVxuaG9vay5hc3NpZ25TdWJDb21wb25lbnRzID0gYXNzaWduU3ViQ29tcG9uZW50c1xuaG9vay5maWx0ZXIgPSBmaWx0ZXJcblxuZnVuY3Rpb24gc2V0SG9va0F0dHJpYnV0ZSAoaG9vaykge1xuICBDT01QT05FTlRfQVRUUklCVVRFID0gaG9va1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnRTZWxlY3RvciAobmFtZSwgb3BlcmF0b3IpIHtcbiAgbmFtZSA9IG5hbWUgJiYgJ1wiJyArIG5hbWUgKyAnXCInXG4gIG9wZXJhdG9yID0gbmFtZSA/IG9wZXJhdG9yIHx8IFwiPVwiIDogXCJcIlxuICByZXR1cm4gJ1snICsgQ09NUE9ORU5UX0FUVFJJQlVURSArIG9wZXJhdG9yICsgbmFtZSArICddJ1xufVxuXG5mdW5jdGlvbiBmaW5kQ29tcG9uZW50IChuYW1lLCByb290KSB7XG4gIHJldHVybiAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvcihjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSlcbn1cblxuZnVuY3Rpb24gZmluZEFsbENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gW10uc2xpY2UuY2FsbCgocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSkpXG59XG5cbmZ1bmN0aW9uIGZpbmRTdWJDb21wb25lbnRzIChuYW1lLCByb290KSB7XG4gIHZhciBlbGVtZW50cyA9IChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUsIFwiXj1cIikpXG4gIHJldHVybiBmaWx0ZXIoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50LCBjb21wb25lbnROYW1lLCBtYWluQ29tcG9uZW50TmFtZSwgc3ViQ29tcG9uZW50TmFtZSkge1xuICAgIHJldHVybiBzdWJDb21wb25lbnROYW1lICYmIG5hbWUgPT09IG1haW5Db21wb25lbnROYW1lXG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKENPTVBPTkVOVF9BVFRSSUJVVEUpXG4gIHJldHVybiBjYyA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRNYWluQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMF0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0U3ViQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMV0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gYXNzaWduU3ViQ29tcG9uZW50cyAob2JqLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGFzc2lnbikge1xuICByZXR1cm4gc3ViQ29tcG9uZW50cy5yZWR1Y2UoZnVuY3Rpb24gKG9iaiwgZWxlbWVudCkge1xuICAgIHZhciBuYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50KVxuICAgIGlmIChuYW1lKSB7XG5cbiAgICAgIGVsZW1lbnQgPSB0eXBlb2YgdHJhbnNmb3JtID09IFwiZnVuY3Rpb25cIlxuICAgICAgICA/IHRyYW5zZm9ybShlbGVtZW50LCBuYW1lKVxuICAgICAgICA6IGVsZW1lbnRcblxuICAgICAgaWYgKHR5cGVvZiBhc3NpZ24gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGFzc2lnbihvYmosIG5hbWUsIGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9ialtuYW1lXSkpIHtcbiAgICAgICAgb2JqW25hbWVdLnB1c2goZWxlbWVudClcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmpbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBvYmpcbiAgfSwgb2JqKVxufVxuXG5mdW5jdGlvbiBmaWx0ZXIgKGVsZW1lbnRzLCBmaWx0ZXIpIHtcbiAgc3dpdGNoICh0eXBlb2YgZmlsdGVyKSB7XG4gICAgY2FzZSBcImZ1bmN0aW9uXCI6XG4gICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChlbGVtZW50cykuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBmaWx0ZXIoZWxlbWVudCwgZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSksIGdldE1haW5Db21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSwgZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkpXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChlbGVtZW50cykuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQpID09PSBmaWx0ZXJcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gbnVsbFxuICB9XG59XG4iLCJ2YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL0NvbXBvbmVudFwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHJlZ2lzdGVyIChuYW1lLCBtaXhpbiwgQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgaWYgKCFDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gbWl4aW5cbiAgICBtaXhpbiA9IFtdXG4gIH1cbiAgZWxzZSB7XG4gICAgLy8gZnVuY3Rpb25zIGluLWJldHdlZW4gYXJlIG1peGluXG4gICAgbWl4aW4gPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSwgLTEpXG4gICAgLy8gbWFpbiBjb25zdHJ1Y3RvciBpcyBhbHdheXMgbGFzdCBhcmd1bWVudFxuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIC0xKVswXVxuICB9XG5cbiAgaWYgKCFDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gZnVuY3Rpb24gKCkge31cbiAgfVxuXG4gIGZ1bmN0aW9uIEN1c3RvbUNvbXBvbmVudCAoZWxlbWVudCwgb3B0aW9ucykge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDdXN0b21Db21wb25lbnQpKSB7XG4gICAgICByZXR1cm4gbmV3IEN1c3RvbUNvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICAgIH1cbiAgICB2YXIgaW5zdGFuY2UgPSB0aGlzXG5cbiAgICBDb21wb25lbnQuY2FsbChpbnN0YW5jZSwgZWxlbWVudCwgb3B0aW9ucylcbiAgICAvLyBhdCB0aGlzIHBvaW50IGN1c3RvbSBjb25zdHJ1Y3RvcnMgY2FuIGFscmVhZHkgYWNjZXNzIHRoZSBlbGVtZW50IGFuZCBzdWIgY29tcG9uZW50c1xuICAgIC8vIHNvIHRoZXkgb25seSByZWNlaXZlIHRoZSBvcHRpb25zIG9iamVjdCBmb3IgY29udmVuaWVuY2VcbiAgICBDb21wb25lbnRDb25zdHJ1Y3Rvci5jYWxsKGluc3RhbmNlLCBvcHRpb25zKVxuICB9XG5cbiAgdmFyIGludGVybmFscyA9IG5ldyBJbnRlcm5hbHMoKVxuICBpbnRlcm5hbHMuYXV0b0Fzc2lnbiA9IHRydWVcblxuICBDdXN0b21Db21wb25lbnQucHJvdG90eXBlID0gbmV3IENvbXBvbmVudCgpXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuaW50ZXJuYWxzID0gaW50ZXJuYWxzXG4gIG1peGluLmZvckVhY2goZnVuY3Rpb24gKG1peGluKSB7XG4gICAgbWl4aW4oQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSlcbiAgfSlcblxuICByZXR1cm4gcmVnaXN0cnkuc2V0KG5hbWUsIEN1c3RvbUNvbXBvbmVudClcbiAgLy8gZGVmaW5lIG1haW4gcHJvdG90eXBlIGFmdGVyIHJlZ2lzdGVyaW5nXG59XG4iLCJ2YXIgcmVnaXN0cnkgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbnZhciBjb21wb25lbnRzID0ge31cblxucmVnaXN0cnkuZ2V0ID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdXG59XG5cbnJlZ2lzdHJ5LmV4aXN0cyA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gISFjb21wb25lbnRzW25hbWVdXG59XG5cbnJlZ2lzdHJ5LnNldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSwgQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbbmFtZV0gPSBDb21wb25lbnRDb25zdHJ1Y3RvclxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoIG9iaiwgZXh0ZW5zaW9uICl7XG4gIGZvciggdmFyIG5hbWUgaW4gZXh0ZW5zaW9uICl7XG4gICAgaWYoIGV4dGVuc2lvbi5oYXNPd25Qcm9wZXJ0eShuYW1lKSApIG9ialtuYW1lXSA9IGV4dGVuc2lvbltuYW1lXVxuICB9XG4gIHJldHVybiBvYmpcbn1cbiIsInZhciBleHRlbmQgPSByZXF1aXJlKFwiLi9leHRlbmRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggb2JqLCBleHRlbnNpb24gKXtcbiAgcmV0dXJuIGV4dGVuc2lvbihleHRlbmQoe30sIG9iaiksIGV4dGVuc2lvbilcbn1cbiIsInZhciBvYmplY3QgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbm9iamVjdC5kZWZpbmVHZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lU2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHNldDogZm5cbiAgfSlcbn1cblxub2JqZWN0Lm1ldGhvZCA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm5cbiAgfSlcbn1cblxub2JqZWN0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmbixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn1cbiJdfQ==
