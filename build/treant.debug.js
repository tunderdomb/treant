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
            ? Component.create(name, element, hostComponent)
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
      var subName = getSubComponentName(name, true)
      element = typeof transform == "function"
          // TODO: subclass subcomponents should be handled properly (B extends A that has a subcomponent A:a becomes B:a that's not in the registry)
          ? transform(element, name)
          : element
      if (typeof assign == "function") {
        assign(obj, subName, element)
      }
      else if (Array.isArray(obj[subName])) {
        obj[subName].push(element)
      }
      else {
        obj[subName] = element
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
    if (component.element == element && (componentName ? component.internals.name == componentName : true)) {
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBob29rID0gcmVxdWlyZShcIi4vc3JjL2hvb2tcIilcbnZhciByZWdpc3RlciA9IHJlcXVpcmUoXCIuL3NyYy9yZWdpc3RlclwiKVxudmFyIGNvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9jcmVhdGVcIilcbnZhciBzdG9yYWdlID0gcmVxdWlyZShcIi4vc3JjL3N0b3JhZ2VcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvQ29tcG9uZW50XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9zcmMvZGVsZWdhdGVcIilcbnZhciBmcmFnbWVudCA9IHJlcXVpcmUoXCIuL3NyYy9mcmFnbWVudFwiKVxuXG52YXIgdHJlYW50ID0ge31cbm1vZHVsZS5leHBvcnRzID0gdHJlYW50XG5cbnRyZWFudC5yZWdpc3RlciA9IHJlZ2lzdGVyXG50cmVhbnQuY29tcG9uZW50ID0gY29tcG9uZW50XG50cmVhbnQuc3RvcmFnZSA9IHN0b3JhZ2VcbnRyZWFudC5Db21wb25lbnQgPSBDb21wb25lbnRcbnRyZWFudC5kZWxlZ2F0ZSA9IGRlbGVnYXRlXG50cmVhbnQuZnJhZ21lbnQgPSBmcmFnbWVudFxudHJlYW50Lmhvb2sgPSBob29rXG5cbnZhciB1dGlsID0ge31cbnRyZWFudC51dGlsID0gdXRpbFxuXG51dGlsLmV4dGVuZCA9IHJlcXVpcmUoXCIuL3V0aWwvZXh0ZW5kXCIpXG51dGlsLm1lcmdlID0gcmVxdWlyZShcIi4vdXRpbC9tZXJnZVwiKVxudXRpbC5vYmplY3QgPSByZXF1aXJlKFwiLi91dGlsL29iamVjdFwiKVxuIiwiJ3VzZSBzdHJpY3QnO1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3RyKSB7XG5cdHN0ciA9IHN0ci50cmltKCk7XG5cblx0aWYgKHN0ci5sZW5ndGggPT09IDEgfHwgISgvW18uXFwtIF0rLykudGVzdChzdHIpICkge1xuXHRcdGlmIChzdHJbMF0gPT09IHN0clswXS50b0xvd2VyQ2FzZSgpICYmIHN0ci5zbGljZSgxKSAhPT0gc3RyLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBzdHI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0ci50b0xvd2VyQ2FzZSgpO1xuXHR9XG5cblx0cmV0dXJuIHN0clxuXHQucmVwbGFjZSgvXltfLlxcLSBdKy8sICcnKVxuXHQudG9Mb3dlckNhc2UoKVxuXHQucmVwbGFjZSgvW18uXFwtIF0rKFxcd3wkKS9nLCBmdW5jdGlvbiAobSwgcDEpIHtcblx0XHRyZXR1cm4gcDEudG9VcHBlckNhc2UoKTtcblx0fSk7XG59O1xuIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG52YXIgcmVnaXN0cnkgPSByZXF1aXJlKFwiLi9yZWdpc3RyeVwiKVxudmFyIGRlbGVnYXRlID0gcmVxdWlyZShcIi4vZGVsZWdhdGVcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBDb21wb25lbnRcblxuZnVuY3Rpb24gQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmIChlbGVtZW50ICYmICEoZWxlbWVudCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZWxlbWVudCBzaG91bGQgYmUgYW4gRWxlbWVudCBpbnN0YW5jZSBvciBudWxsXCIpXG4gIH1cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENvbXBvbmVudCkpIHtcbiAgICByZXR1cm4gbmV3IENvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICB9XG5cbiAgdGhpcy5lbGVtZW50ID0gZWxlbWVudCB8fCBudWxsXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG5cbiAgdGhpcy5pbml0aWFsaXplKClcbn1cblxuQ29tcG9uZW50LmNyZWF0ZSA9IGZ1bmN0aW9uIChuYW1lLCBlbGVtZW50LCBvcHRpb25zKSB7XG4gIHZhciBDb21wb25lbnRDb25zdHJ1Y3RvciA9IG51bGxcblxuICBpZiAocmVnaXN0cnkuZXhpc3RzKG5hbWUpKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSByZWdpc3RyeS5nZXQobmFtZSlcbiAgfVxuICBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oXCJNaXNzaW5nIGNvbXBvbmVudCBkZWZpbml0aW9uOiBcIiwgbmFtZSlcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgcmV0dXJuIG5ldyBDb21wb25lbnRDb25zdHJ1Y3RvcihlbGVtZW50LCBvcHRpb25zKVxufVxuXG5Db21wb25lbnQucHJvdG90eXBlID0ge1xuICBpbnRlcm5hbHM6IG5ldyBJbnRlcm5hbHMoKSxcblxuICBpbml0aWFsaXplOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCF0aGlzLmVsZW1lbnQpIHJldHVyblxuXG4gICAgaWYgKHRoaXMuaW50ZXJuYWxzLmF1dG9Bc3NpZ24pIHtcbiAgICAgIHRoaXMuYXNzaWduU3ViQ29tcG9uZW50cygpXG4gICAgfVxuICAgIHRoaXMuaW50ZXJuYWxzLnJlc2V0QXR0cmlidXRlcyh0aGlzKVxuICB9LFxuICBkZWxlZ2F0ZTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zLmVsZW1lbnQgPSB0aGlzLmVsZW1lbnRcbiAgICBvcHRpb25zLmNvbnRleHQgPSBvcHRpb25zLmNvbnRleHQgfHwgdGhpc1xuICAgIHJldHVybiBkZWxlZ2F0ZShvcHRpb25zKVxuICB9LFxuXG4gIGRpc3BhdGNoOiBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gICAgdmFyIGRlZmluaXRpb24gPSB0aGlzLmludGVybmFscy5nZXRFdmVudERlZmluaXRpb24odHlwZSwgZGV0YWlsKVxuICAgIHJldHVybiB0aGlzLmVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgd2luZG93LkN1c3RvbUV2ZW50KHR5cGUsIGRlZmluaXRpb24pKVxuICB9LFxuXG4gIGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZENvbXBvbmVudChuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGZpbmRBbGxDb21wb25lbnQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZEFsbENvbXBvbmVudChuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGZpbmRTdWJDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZFN1YkNvbXBvbmVudHModGhpcy5nZXRNYWluQ29tcG9uZW50TmFtZShmYWxzZSksIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZ2V0Q29tcG9uZW50TmFtZTogZnVuY3Rpb24gKGNjKSB7XG4gICAgcmV0dXJuIGhvb2suZ2V0Q29tcG9uZW50TmFtZSh0aGlzLmludGVybmFscy5uYW1lLCBjYylcbiAgfSxcbiAgZ2V0TWFpbkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldE1haW5Db21wb25lbnROYW1lKHRoaXMuaW50ZXJuYWxzLm5hbWUsIGNjKVxuICB9LFxuICBnZXRTdWJDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRTdWJDb21wb25lbnROYW1lKHRoaXMuaW50ZXJuYWxzLm5hbWUsIGNjKVxuICB9LFxuICBjbGVhclN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW50ZXJuYWxzID0gdGhpcy5pbnRlcm5hbHNcblxuICAgIGZvciAodmFyIG5hbWUgaW4gaW50ZXJuYWxzLmNvbXBvbmVudHMpIHtcbiAgICAgIGlmIChpbnRlcm5hbHMuY29tcG9uZW50cy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgICB0aGlzLmNvbXBvbmVudHNbbmFtZV0gPSBbXVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuY29tcG9uZW50c1tuYW1lXSA9IGludGVybmFscy5jb21wb25lbnRzW25hbWVdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGFzc2lnblN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICh0cmFuc2Zvcm0pIHtcbiAgICBpZiAoIXRoaXMuZWxlbWVudCkgcmV0dXJuXG5cbiAgICB2YXIgaG9zdENvbXBvbmVudCA9IHRoaXNcbiAgICB2YXIgc3ViQ29tcG9uZW50cyA9IHRoaXMuZmluZFN1YkNvbXBvbmVudHMoKVxuICAgIHZhciBpbnRlcm5hbHMgPSB0aGlzLmludGVybmFsc1xuXG4gICAgdGhpcy5jbGVhclN1YkNvbXBvbmVudHMoKVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0cmFuc2Zvcm0gPT0gXCJ1bmRlZmluZWRcIiB8fCB0cmFuc2Zvcm0gPT09IHRydWUpIHtcbiAgICAgIHRyYW5zZm9ybSA9IGZ1bmN0aW9uIChlbGVtZW50LCBuYW1lKSB7XG4gICAgICAgIHJldHVybiByZWdpc3RyeS5leGlzdHMobmFtZSlcbiAgICAgICAgICAgID8gQ29tcG9uZW50LmNyZWF0ZShuYW1lLCBlbGVtZW50LCBob3N0Q29tcG9uZW50KVxuICAgICAgICAgICAgOiBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuXG4gICAgaG9vay5hc3NpZ25TdWJDb21wb25lbnRzKHRoaXMuY29tcG9uZW50cywgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBmdW5jdGlvbiAoY29tcG9uZW50cywgbmFtZSwgZWxlbWVudCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV0pKSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBjb21wb25lbnRzW25hbWVdIHx8IFtdXG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBleHRlbmQgPSByZXF1aXJlKFwiLi4vdXRpbC9leHRlbmRcIilcbnZhciBtZXJnZSA9IHJlcXVpcmUoXCIuLi91dGlsL21lcmdlXCIpXG52YXIgb2JqZWN0ID0gcmVxdWlyZShcIi4uL3V0aWwvb2JqZWN0XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9kZWxlZ2F0ZVwiKVxudmFyIHN0b3JhZ2UgPSByZXF1aXJlKFwiLi9zdG9yYWdlXCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxudmFyIGRlZmF1bHRFdmVudERlZmluaXRpb24gPSB7XG4gIGRldGFpbDogbnVsbCxcbiAgdmlldzogd2luZG93LFxuICBidWJibGVzOiB0cnVlLFxuICBjYW5jZWxhYmxlOiB0cnVlXG59XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJuYWxzXG5cbmZ1bmN0aW9uIEludGVybmFscyAobWFzdGVyLCBuYW1lKSB7XG4gIHRoaXMubmFtZSA9IG5hbWVcbiAgdGhpcy5hdXRvQXNzaWduID0gdHJ1ZVxuICB0aGlzLmNvbXBvbmVudHMgPSB7fVxuICB0aGlzLl9ldmVudHMgPSB7fVxuICB0aGlzLl9jb25zdHJ1Y3RvcnMgPSBbXVxuICB0aGlzLl9hdHRyaWJ1dGVzID0ge31cbiAgdGhpcy5fYWN0aW9ucyA9IFtdXG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiX21hc3RlckNvbnN0cnVjdG9yXCIsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBtYXN0ZXJcbiAgICB9XG4gIH0pXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIl9tYXN0ZXJcIiwge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG1hc3Rlci5wcm90b3R5cGVcbiAgICB9XG4gIH0pXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuZXh0ZW5kID0gZnVuY3Rpb24gKENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHRoaXMuX21hc3RlckNvbnN0cnVjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ29tcG9uZW50Q29uc3RydWN0b3IucHJvdG90eXBlKVxuICB0aGlzLl9tYXN0ZXJDb25zdHJ1Y3Rvci5wcm90b3R5cGUuY29uc3RydWN0b3IgPSB0aGlzLl9tYXN0ZXJDb25zdHJ1Y3RvclxuICB2YXIgaW50ZXJuYWxzID0gQ29tcG9uZW50Q29uc3RydWN0b3IuaW50ZXJuYWxzXG4gIHRoaXMuX21hc3RlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5pbnRlcm5hbHMgPSB0aGlzXG4gIHRoaXMuX21hc3RlckNvbnN0cnVjdG9yLmludGVybmFscyA9IHRoaXNcbiAgaWYgKGludGVybmFscykge1xuICAgIHRoaXMuYXV0b0Fzc2lnbiA9IGludGVybmFscy5hdXRvQXNzaWduXG4gICAgZXh0ZW5kKHRoaXMuY29tcG9uZW50cywgaW50ZXJuYWxzLmNvbXBvbmVudHMpXG4gICAgZXh0ZW5kKHRoaXMuX2V2ZW50cywgaW50ZXJuYWxzLl9ldmVudHMpXG4gICAgdGhpcy5fY29uc3RydWN0b3JzID0gdGhpcy5fY29uc3RydWN0b3JzLmNvbmNhdChpbnRlcm5hbHMuX2NvbnN0cnVjdG9ycylcbiAgICBleHRlbmQodGhpcy5fYXR0cmlidXRlcywgaW50ZXJuYWxzLl9hdHRyaWJ1dGVzKVxuICAgIGludGVybmFscy5fYWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICB2YXIgZXZlbnQgPSBhcmdzWzBdXG4gICAgICB2YXIgbWF0Y2hlcyA9IGFyZ3NbMV1cbiAgICAgIHZhciBtYXRjaGVyID0gdGhpcy5hY3Rpb24uY2FsbCh0aGlzLCBldmVudClcbiAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbiAoYXJncykge1xuICAgICAgICBtYXRjaGVyLm1hdGNoLmFwcGx5KG1hdGNoZXIsIGFyZ3MpXG4gICAgICB9KVxuICAgIH0sIHRoaXMpXG4gIH1cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5vbkNyZWF0ZSA9IGZ1bmN0aW9uIChjb25zdHJ1Y3Rvcikge1xuICB0aGlzLl9jb25zdHJ1Y3RvcnMucHVzaChjb25zdHJ1Y3RvcilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoaW5zdGFuY2UsIGFyZ3MpIHtcbiAgdGhpcy5fY29uc3RydWN0b3JzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cnVjdG9yKSB7XG4gICAgY29uc3RydWN0b3IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gIH0pXG59XG5cbkludGVybmFscy5wcm90b3R5cGUubWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5tZXRob2QodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QucHJvcGVydHkodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0LmRlZmluZUdldHRlcih0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QuZGVmaW5lR2V0dGVyKHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuYWNjZXNzb3IgPSBmdW5jdGlvbiAobmFtZSwgZ2V0LCBzZXQpIHtcbiAgb2JqZWN0LmFjY2Vzc29yKHRoaXMuX21hc3RlciwgbmFtZSwgZ2V0LCBzZXQpXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUucHJvdG8gPSBmdW5jdGlvbiAocHJvdG90eXBlKSB7XG4gIGZvciAodmFyIHByb3AgaW4gcHJvdG90eXBlKSB7XG4gICAgaWYgKHByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgaWYgKHR5cGVvZiBwcm90b3R5cGVbcHJvcF0gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGlmIChwcm9wID09PSBcIm9uQ3JlYXRlXCIpIHtcbiAgICAgICAgICB0aGlzLm9uQ3JlYXRlKHByb3RvdHlwZVtwcm9wXSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0aGlzLm1ldGhvZChwcm9wLCBwcm90b3R5cGVbcHJvcF0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aGlzLnByb3BlcnR5KHByb3AsIHByb3RvdHlwZVtwcm9wXSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5hY3Rpb24gPSBmdW5jdGlvbiBhY3Rpb24oZXZlbnQpIHtcbiAgdmFyIGludGVybmFscyA9IHRoaXNcbiAgdmFyIGF0dHJpYnV0ZU5hbWUgPSBpbnRlcm5hbHMubmFtZVxuICB2YXIgbWF0Y2hlciA9IHt9XG4gIHZhciBtYXRjaGVzID0gW11cbiAgdmFyIGRlbGVnYXRvciA9IGRlbGVnYXRlKHtlbGVtZW50OiBkb2N1bWVudC5ib2R5LCBldmVudDogZXZlbnR9KVxuXG4gIGludGVybmFscy5fYWN0aW9ucy5wdXNoKFtldmVudCwgbWF0Y2hlc10pXG5cbiAgbWF0Y2hlci5tYXRjaCA9IGZ1bmN0aW9uIChjb21wb25lbnRzLCBjYikge1xuICAgIG1hdGNoZXMucHVzaChbY29tcG9uZW50cywgY2JdKVxuXG4gICAgaWYgKCFjYikge1xuICAgICAgY2IgPSBjb21wb25lbnRzXG4gICAgICBjb21wb25lbnRzID0gW11cbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGNvbXBvbmVudHMgPT0gXCJzdHJpbmdcIikge1xuICAgICAgY29tcG9uZW50cyA9IFtjb21wb25lbnRzXVxuICAgIH1cblxuICAgIHZhciBzZWxlY3RvcnMgPSBjb21wb25lbnRzLm1hcChmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gICAgICBpZiAoY29tcG9uZW50WzBdID09IFwiOlwiKSB7XG4gICAgICAgIGNvbXBvbmVudCA9IGF0dHJpYnV0ZU5hbWUrY29tcG9uZW50XG4gICAgICB9XG4gICAgICByZXR1cm4gaG9vay5jcmVhdGVDb21wb25lbnRTZWxlY3Rvcihjb21wb25lbnQsIFwifj1cIilcbiAgICB9KVxuICAgIHNlbGVjdG9ycy51bnNoaWZ0KGhvb2suY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IoYXR0cmlidXRlTmFtZSwgXCJ+PVwiKSlcblxuICAgIGRlbGVnYXRvci5tYXRjaChzZWxlY3RvcnMsIGZ1bmN0aW9uIChlLCBtYWluKSB7XG4gICAgICB2YXIgaW5zdGFuY2UgPSBzdG9yYWdlLmdldChtYWluKSB8fCBtYWluXG4gICAgICB2YXIgYXJncyA9IFtlXTtcblxuICAgICAgW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpLmZvckVhY2goZnVuY3Rpb24gKGVsZW1lbnQsIGkpIHtcbiAgICAgICAgdmFyIG5hbWUgPSBjb21wb25lbnRzW2ldXG4gICAgICAgIG5hbWUgPSBuYW1lWzBdID09IFwiOlwiID8gbmFtZS5zdWJzdHIoMSkgOiBuYW1lXG4gICAgICAgIG5hbWUgPSBjYW1lbGNhc2UobmFtZSlcbiAgICAgICAgdmFyIGFyZ1xuXG4gICAgICAgIGlmIChpbnN0YW5jZS5jb21wb25lbnRzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgICAgYXJnID0gaW5zdGFuY2UuY29tcG9uZW50c1tuYW1lXVxuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgICAgICAgIGFyZy5zb21lKGZ1bmN0aW9uIChtZW1iZXIpIHtcbiAgICAgICAgICAgICAgaWYgKG1lbWJlciA9PSBlbGVtZW50IHx8IG1lbWJlci5lbGVtZW50ID09IG1lbWJlcikge1xuICAgICAgICAgICAgICAgIGFyZyA9IG1lbWJlclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBhcmcgPSBzdG9yYWdlLmdldChlbGVtZW50LCBuYW1lKSB8fCBlbGVtZW50XG4gICAgICAgIH1cblxuICAgICAgICBhcmdzLnB1c2goYXJnKVxuICAgICAgfSlcblxuICAgICAgcmV0dXJuIGNiLmFwcGx5KGluc3RhbmNlLCBhcmdzKVxuICAgIH0pXG5cbiAgICByZXR1cm4gbWF0Y2hlclxuICB9XG5cbiAgcmV0dXJuIG1hdGNoZXJcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5ldmVudCA9IGZ1bmN0aW9uICh0eXBlLCBkZWZpbml0aW9uKSB7XG4gIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGRlZmluaXRpb25cbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5nZXRFdmVudERlZmluaXRpb24gPSBmdW5jdGlvbiAodHlwZSwgZGV0YWlsKSB7XG4gIHZhciBkZWZpbml0aW9uID0gbWVyZ2UoZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiwgdGhpcy5fZXZlbnRzW3R5cGVdKVxuICBkZWZpbml0aW9uLmRldGFpbCA9IHR5cGVvZiBkZXRhaWwgPT0gXCJ1bmRlZmluZWRcIiA/IGRlZmluaXRpb24uZGV0YWlsIDogZGV0YWlsXG4gIHJldHVybiBkZWZpbml0aW9uXG59XG5cbkludGVybmFscy5wcm90b3R5cGUucmVzZXRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKGluc3RhbmNlKSB7XG4gIGlmICghaW5zdGFuY2UuZWxlbWVudCkgcmV0dXJuXG5cbiAgdmFyIGF0dHJpYnV0ZVxuICB2YXIgdmFsdWVcbiAgZm9yICh2YXIgbmFtZSBpbiB0aGlzLl9hdHRyaWJ1dGVzKSB7XG4gICAgaWYgKHRoaXMuX2F0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgIGF0dHJpYnV0ZSA9IHRoaXMuX2F0dHJpYnV0ZXNbbmFtZV1cbiAgICAgIHZhbHVlID0gYXR0cmlidXRlLmdldC5jYWxsKGluc3RhbmNlLCBmYWxzZSlcbiAgICAgIGlmIChhdHRyaWJ1dGUuaGFzRGVmYXVsdCAmJiAhYXR0cmlidXRlLmhhcy5jYWxsKGluc3RhbmNlLCB2YWx1ZSkpIHtcbiAgICAgICAgYXR0cmlidXRlLnNldC5jYWxsKGluc3RhbmNlLCBhdHRyaWJ1dGUuZGVmYXVsdFZhbHVlLCBmYWxzZSlcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5hdHRyaWJ1dGUgPSBmdW5jdGlvbiAobmFtZSwgZGVmKSB7XG4gIHZhciBtYXN0ZXIgPSB0aGlzLl9tYXN0ZXJcbiAgaWYgKCFtYXN0ZXIpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgaWYgKGRlZiA9PSBudWxsKSB7XG4gICAgZGVmID0ge31cbiAgfVxuXG4gIHZhciB0eXBlT2ZEZWYgPSB0eXBlb2YgZGVmXG4gIHZhciB0eXBlXG4gIHZhciBkZWZhdWx0VmFsdWVcbiAgdmFyIGdldHRlclxuICB2YXIgc2V0dGVyXG4gIHZhciBvbmNoYW5nZVxuICB2YXIgcHJvcGVydHkgPSBjYW1lbGNhc2UobmFtZSlcblxuICBzd2l0Y2ggKHR5cGVPZkRlZikge1xuICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIC8vIHRoZSBkZWZpbml0aW9uIGlzIGEgcHJpbWl0aXZlIHZhbHVlXG4gICAgICB0eXBlID0gdHlwZU9mRGVmXG4gICAgICBkZWZhdWx0VmFsdWUgPSBkZWZcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcIm9iamVjdFwiOlxuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBvciBhIGRlZmluaXRpb24gb2JqZWN0XG4gICAgICBkZWZhdWx0VmFsdWUgPSB0eXBlb2YgZGVmW1wiZGVmYXVsdFwiXSA9PSBcInVuZGVmaW5lZFwiID8gbnVsbCA6IGRlZltcImRlZmF1bHRcIl1cbiAgICAgIGlmICh0eXBlb2YgZGVmW1widHlwZVwiXSA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGlmIChkZWZhdWx0VmFsdWUgPT0gbnVsbCkge1xuICAgICAgICAgIHR5cGUgPSBcInN0cmluZ1wiXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdHlwZSA9IHR5cGVvZiBkZWZhdWx0VmFsdWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHR5cGUgPSBkZWZbXCJ0eXBlXCJdXG4gICAgICB9XG4gICAgICBnZXR0ZXIgPSBkZWZbXCJnZXRcIl1cbiAgICAgIHNldHRlciA9IGRlZltcInNldFwiXVxuICAgICAgb25jaGFuZ2UgPSBkZWZbXCJvbmNoYW5nZVwiXVxuICB9XG5cbiAgdmFyIHBhcnNlVmFsdWVcbiAgdmFyIHN0cmluZ2lmeVZhbHVlXG4gIHZhciBoYXNcblxuICBoYXMgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9IG51bGwgfVxuXG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgICBoYXMgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9PSBmYWxzZSB9XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSAhPSBudWxsIH1cbiAgICAgIHN0cmluZ2lmeVZhbHVlID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gXCJcIiB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgPyBudWxsIDogcGFyc2VJbnQodmFsdWUsIDEwKSB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiBwYXJzZUZsb2F0KHZhbHVlKSB9XG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICBkZWZhdWx0OlxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgPyBudWxsIDogdmFsdWUgPyBcIlwiK3ZhbHVlIDogXCJcIiB9XG4gIH1cblxuICB0aGlzLl9hdHRyaWJ1dGVzW3Byb3BlcnR5XSA9IHtcbiAgICBnZXQ6IGdldCxcbiAgICBzZXQ6IHNldCxcbiAgICBoYXM6IGhhcyxcbiAgICBkZWZhdWx0VmFsdWU6IGRlZmF1bHRWYWx1ZSxcbiAgICBoYXNEZWZhdWx0OiBkZWZhdWx0VmFsdWUgIT0gbnVsbFxuICB9XG5cbiAgZnVuY3Rpb24gZ2V0KHVzZURlZmF1bHQpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLmVsZW1lbnQuZ2V0QXR0cmlidXRlKG5hbWUpXG4gICAgaWYgKHZhbHVlID09IG51bGwgJiYgdXNlRGVmYXVsdCA9PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZGVmYXVsdFZhbHVlXG4gICAgfVxuICAgIHJldHVybiBwYXJzZVZhbHVlID8gcGFyc2VWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICB9XG5cbiAgZnVuY3Rpb24gc2V0KHZhbHVlLCBjYWxsT25jaGFuZ2UpIHtcbiAgICB2YXIgb2xkID0gZ2V0LmNhbGwodGhpcywgZmFsc2UpXG4gICAgaWYgKCFoYXModmFsdWUpKSB7XG4gICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgfVxuICAgIGVsc2UgaWYgKG9sZCA9PT0gdmFsdWUpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciBuZXdWYWx1ZSA9IHN0cmluZ2lmeVZhbHVlID8gc3RyaW5naWZ5VmFsdWUodmFsdWUpIDogdmFsdWVcbiAgICAgIHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUobmFtZSwgbmV3VmFsdWUpXG4gICAgfVxuICAgIG9uY2hhbmdlICYmIGNhbGxPbmNoYW5nZSAhPSBmYWxzZSAmJiBvbmNoYW5nZS5jYWxsKHRoaXMsIG9sZCwgdmFsdWUpXG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkobWFzdGVyLCBwcm9wZXJ0eSwge1xuICAgIGdldDogZ2V0dGVyIHx8IGdldCxcbiAgICBzZXQ6IHNldHRlciB8fCBzZXRcbiAgfSlcblxuICByZXR1cm4gdGhpc1xufVxuIiwidmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL0NvbXBvbmVudFwiKVxudmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gY29tcG9uZW50XG5cbmZ1bmN0aW9uIGNvbXBvbmVudCAobmFtZSwgcm9vdCwgb3B0aW9ucykge1xuICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIHt9XSlcbiAgaWYgKCEocm9vdCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgb3B0aW9ucyA9IHJvb3RcbiAgICByb290ID0gbnVsbFxuICB9XG4gIHZhciBlbGVtZW50ID0gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHJvb3QpXG5cbiAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUobmFtZSwgZWxlbWVudCwgb3B0aW9ucylcbn1cblxuY29tcG9uZW50LmFsbCA9IGZ1bmN0aW9uIChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICBpZiAoIShyb290IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICBvcHRpb25zID0gcm9vdFxuICAgIHJvb3QgPSBudWxsXG4gIH1cbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCBFbGVtZW50XSlcbiAgdmFyIGVsZW1lbnRzID0gaG9vay5maW5kQWxsQ29tcG9uZW50KG5hbWUsIHJvb3QpXG5cbiAgcmV0dXJuIFtdLm1hcC5jYWxsKGVsZW1lbnRzLCBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgIHJldHVybiBDb21wb25lbnQuY3JlYXRlKG5hbWUsIGVsZW1lbnQsIG9wdGlvbnMpXG4gIH0pXG59XG4iLCIvKipcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciBvbiBhbiBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIGRlbGVnYXRvci5cbiAqIEEgZGVsZWdhdGVkIGV2ZW50IHJ1bnMgbWF0Y2hlcyB0byBmaW5kIGFuIGV2ZW50IHRhcmdldCxcbiAqIHRoZW4gZXhlY3V0ZXMgdGhlIGhhbmRsZXIgcGFpcmVkIHdpdGggdGhlIG1hdGNoZXIuXG4gKiBNYXRjaGVycyBjYW4gY2hlY2sgaWYgYW4gZXZlbnQgdGFyZ2V0IG1hdGNoZXMgYSBnaXZlbiBzZWxlY3RvcixcbiAqIG9yIHNlZSBpZiBhbiBvZiBpdHMgcGFyZW50cyBkby5cbiAqICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlbGVnYXRlKCBvcHRpb25zICl7XG4gICAgdmFyIGVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnRcbiAgICAgICAgLCBldmVudCA9IG9wdGlvbnMuZXZlbnRcbiAgICAgICAgLCBjYXB0dXJlID0gISFvcHRpb25zLmNhcHR1cmV8fGZhbHNlXG4gICAgICAgICwgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dHx8ZWxlbWVudFxuXG4gICAgaWYoICFlbGVtZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGVsZW1lbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgaWYoICFldmVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBldmVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBkZWxlZ2F0b3IgPSBjcmVhdGVEZWxlZ2F0b3IoY29udGV4dClcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGRlbGVnYXRvciwgY2FwdHVyZSlcblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZGVsZWdhdG9yIHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gZXZlbnQgbGlzdGVuZXIuXG4gKiBUaGUgZGVsZWdhdG9yIGhhcyBzdGF0aWMgbWV0aG9kcyB3aGljaCBjYW4gYmUgdXNlZCB0byByZWdpc3RlciBoYW5kbGVycy5cbiAqICovXG5mdW5jdGlvbiBjcmVhdGVEZWxlZ2F0b3IoIGNvbnRleHQgKXtcbiAgICB2YXIgbWF0Y2hlcnMgPSBbXVxuXG4gICAgZnVuY3Rpb24gZGVsZWdhdG9yKCBlICl7XG4gICAgICAgIHZhciBsID0gbWF0Y2hlcnMubGVuZ3RoXG4gICAgICAgIGlmKCAhbCApe1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbCA9IHRoaXNcbiAgICAgICAgICAgICwgaSA9IC0xXG4gICAgICAgICAgICAsIGhhbmRsZXJcbiAgICAgICAgICAgICwgc2VsZWN0b3JcbiAgICAgICAgICAgICwgZGVsZWdhdGVFbGVtZW50XG4gICAgICAgICAgICAsIHN0b3BQcm9wYWdhdGlvblxuICAgICAgICAgICAgLCBhcmdzXG5cbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGFyZ3MgPSBtYXRjaGVyc1tpXVxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF1cbiAgICAgICAgICAgIHNlbGVjdG9yID0gYXJnc1sxXVxuXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBtYXRjaENhcHR1cmVQYXRoKHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCBkZWxlZ2F0ZUVsZW1lbnQgJiYgZGVsZWdhdGVFbGVtZW50Lmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZSA9PT0gaGFuZGxlci5hcHBseShjb250ZXh0LCBbZV0uY29uY2F0KGRlbGVnYXRlRWxlbWVudCkpXG4gICAgICAgICAgICAgICAgaWYoIHN0b3BQcm9wYWdhdGlvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBoYW5kbGVyIHdpdGggYSB0YXJnZXQgZmluZGVyIGxvZ2ljXG4gICAgICogKi9cbiAgICBkZWxlZ2F0b3IubWF0Y2ggPSBmdW5jdGlvbiggc2VsZWN0b3IsIGhhbmRsZXIgKXtcbiAgICAgICAgbWF0Y2hlcnMucHVzaChbaGFuZGxlciwgc2VsZWN0b3JdKVxuICAgICAgICByZXR1cm4gZGVsZWdhdG9yXG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG5mdW5jdGlvbiBtYXRjaENhcHR1cmVQYXRoKCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50cyA9IFtdXG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudCA9IG51bGxcbiAgICBpZiggQXJyYXkuaXNBcnJheShzZWxlY3RvcikgKXtcbiAgICAgICAgdmFyIGkgPSAtMVxuICAgICAgICB2YXIgbCA9IHNlbGVjdG9yLmxlbmd0aFxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvcltpXSwgZWwsIGUpXG4gICAgICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgIH1cbiAgICByZXR1cm4gZGVsZWdhdGVFbGVtZW50c1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSB0YXJnZXQgb3IgYW55IG9mIGl0cyBwYXJlbnQgbWF0Y2hlcyBhIHNlbGVjdG9yXG4gKiAqL1xuZnVuY3Rpb24gZmluZFBhcmVudCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0XG4gICAgc3dpdGNoKCB0eXBlb2Ygc2VsZWN0b3IgKXtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggdGFyZ2V0Lm1hdGNoZXMoc2VsZWN0b3IpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHNlbGVjdG9yLmNhbGwoZWwsIHRhcmdldCkgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICByZXR1cm4gbnVsbFxufVxuIiwidmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmcmFnbWVudFxuXG5mcmFnbWVudC5vcHRpb25zID0ge1xuICB2YXJpYWJsZTogXCJmXCJcbn1cblxuZnVuY3Rpb24gZnJhZ21lbnQoIGh0bWwsIGNvbXBpbGVyLCBjb21waWxlck9wdGlvbnMgKXtcbiAgY29tcGlsZXJPcHRpb25zID0gbWVyZ2UoZnJhZ21lbnQub3B0aW9ucywgY29tcGlsZXJPcHRpb25zKVxuICB2YXIgcmVuZGVyID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlRGF0YSApe1xuICAgIHZhciB0ZW1wID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbiAgICBpZiggdHlwZW9mIGNvbXBpbGVyID09IFwiZnVuY3Rpb25cIiAmJiAhcmVuZGVyICl7XG4gICAgICByZW5kZXIgPSBjb21waWxlcihodG1sLCBjb21waWxlck9wdGlvbnMpXG4gICAgfVxuICAgIGlmKCByZW5kZXIgKXtcbiAgICAgIHRyeXtcbiAgICAgICAgaHRtbCA9IHJlbmRlcih0ZW1wbGF0ZURhdGEpXG4gICAgICB9XG4gICAgICBjYXRjaCggZSApe1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVuZGVyaW5nIGZyYWdtZW50IHdpdGggY29udGV4dDpcIiwgdGVtcGxhdGVEYXRhKVxuICAgICAgICBjb25zb2xlLmVycm9yKHJlbmRlci50b1N0cmluZygpKVxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0ZW1wLmlubmVySFRNTCA9IGh0bWxcbiAgICB2YXIgZnJhZ21lbnQgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gICAgd2hpbGUoIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggKXtcbiAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRlbXAuZmlyc3RDaGlsZClcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50XG4gIH1cbn1cbmZyYWdtZW50LnJlbmRlciA9IGZ1bmN0aW9uKCBodG1sLCB0ZW1wbGF0ZURhdGEgKXtcbiAgcmV0dXJuIGZyYWdtZW50KGh0bWwpKHRlbXBsYXRlRGF0YSlcbn1cbiIsInZhciBjYW1lbGNhc2UgPSByZXF1aXJlKFwiY2FtZWxjYXNlXCIpXG52YXIgQ09NUE9ORU5UX0FUVFJJQlVURSA9IFwiZGF0YS1jb21wb25lbnRcIlxuXG52YXIgaG9vayA9IG1vZHVsZS5leHBvcnRzID0ge31cblxuaG9vay5zZXRIb29rQXR0cmlidXRlID0gc2V0SG9va0F0dHJpYnV0ZVxuaG9vay5jcmVhdGVDb21wb25lbnRTZWxlY3RvciA9IGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yXG5ob29rLmZpbmRDb21wb25lbnQgPSBmaW5kQ29tcG9uZW50XG5ob29rLmZpbmRBbGxDb21wb25lbnQgPSBmaW5kQWxsQ29tcG9uZW50XG5ob29rLmZpbmRTdWJDb21wb25lbnRzID0gZmluZFN1YkNvbXBvbmVudHNcbmhvb2suZ2V0Q29tcG9uZW50TmFtZSA9IGdldENvbXBvbmVudE5hbWVcbmhvb2suZ2V0TWFpbkNvbXBvbmVudE5hbWUgPSBnZXRNYWluQ29tcG9uZW50TmFtZVxuaG9vay5nZXRTdWJDb21wb25lbnROYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZVxuaG9vay5hc3NpZ25TdWJDb21wb25lbnRzID0gYXNzaWduU3ViQ29tcG9uZW50c1xuaG9vay5maWx0ZXIgPSBmaWx0ZXJcblxuZnVuY3Rpb24gc2V0SG9va0F0dHJpYnV0ZSAoaG9vaykge1xuICBDT01QT05FTlRfQVRUUklCVVRFID0gaG9va1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnRTZWxlY3RvciAobmFtZSwgb3BlcmF0b3IpIHtcbiAgbmFtZSA9IG5hbWUgJiYgJ1wiJyArIG5hbWUgKyAnXCInXG4gIG9wZXJhdG9yID0gbmFtZSA/IG9wZXJhdG9yIHx8IFwiPVwiIDogXCJcIlxuICByZXR1cm4gXCJbXCIgKyBDT01QT05FTlRfQVRUUklCVVRFICsgb3BlcmF0b3IgKyBuYW1lICsgXCJdXCJcbn1cblxuZnVuY3Rpb24gY29tcG9zZSAobmFtZSwgZXh0cmEsIG9wZXJhdG9yKSB7XG4gIHJldHVybiBjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lLCBvcGVyYXRvcikrZXh0cmFcbn1cblxuZnVuY3Rpb24gZmluZENvbXBvc2VkIChzZWxlY3Rvciwgcm9vdCkge1xuICByZXR1cm4gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpXG59XG5cbmZ1bmN0aW9uIGZpbmRBbGxDb21wb3NlZCAoc2VsZWN0b3IsIHJvb3QpIHtcbiAgcmV0dXJuIChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKVxufVxuXG5mdW5jdGlvbiBmaW5kQ29tcG9uZW50IChuYW1lLCByb290KSB7XG4gIHJldHVybiBmaW5kQ29tcG9zZWQoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSksIHJvb3QpXG59XG5cbmZ1bmN0aW9uIGZpbmRBbGxDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZmluZEFsbENvbXBvc2VkKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUpLCByb290KSlcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgaWYgKCFlbGVtZW50KSByZXR1cm4gXCJcIlxuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSB0eXBlb2YgZWxlbWVudCA9PSBcInN0cmluZ1wiID8gZWxlbWVudCA6IGVsZW1lbnQuZ2V0QXR0cmlidXRlKENPTVBPTkVOVF9BVFRSSUJVVEUpIHx8IFwiXCJcbiAgcmV0dXJuIGNjID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldE1haW5Db21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKS5zcGxpdChcIjpcIilcbiAgdmFsdWUgPSB2YWx1ZVswXSB8fCBcIlwiXG4gIHJldHVybiBjYyAmJiB2YWx1ZSA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRTdWJDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKS5zcGxpdChcIjpcIilcbiAgdmFsdWUgPSB2YWx1ZVsxXSB8fCBcIlwiXG4gIHJldHVybiBjYyAmJiB2YWx1ZSA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnROYW1lTGlzdCAoZWxlbWVudCwgY2MpIHtcbiAgcmV0dXJuIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgY2MpLnNwbGl0KC9cXHMrLylcbn1cblxuZnVuY3Rpb24gZmluZFN1YkNvbXBvbmVudHMgKG1haW5OYW1lLCByb290KSB7XG4gIHZhciBlbGVtZW50cyA9IGZpbmRBbGxDb21wb3NlZChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihtYWluTmFtZStcIjpcIiwgXCIqPVwiKSwgcm9vdClcbiAgcmV0dXJuIGZpbHRlcihlbGVtZW50cywgZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIHtcbiAgICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZUxpc3QoY29tcG9uZW50TmFtZSwgZmFsc2UpLnNvbWUoZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHJldHVybiBnZXRNYWluQ29tcG9uZW50TmFtZShuYW1lLCBmYWxzZSkgPT0gbWFpbk5hbWUgJiYgZ2V0U3ViQ29tcG9uZW50TmFtZShuYW1lKVxuICAgIH0pXG4gIH0pXG59XG5cbmZ1bmN0aW9uIGFzc2lnblN1YkNvbXBvbmVudHMgKG9iaiwgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBhc3NpZ24pIHtcbiAgcmV0dXJuIHN1YkNvbXBvbmVudHMucmVkdWNlKGZ1bmN0aW9uIChvYmosIGVsZW1lbnQpIHtcbiAgICBnZXRDb21wb25lbnROYW1lTGlzdChlbGVtZW50LCBmYWxzZSkuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgdmFyIHN1Yk5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lKG5hbWUsIHRydWUpXG4gICAgICBlbGVtZW50ID0gdHlwZW9mIHRyYW5zZm9ybSA9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgICAvLyBUT0RPOiBzdWJjbGFzcyBzdWJjb21wb25lbnRzIHNob3VsZCBiZSBoYW5kbGVkIHByb3Blcmx5IChCIGV4dGVuZHMgQSB0aGF0IGhhcyBhIHN1YmNvbXBvbmVudCBBOmEgYmVjb21lcyBCOmEgdGhhdCdzIG5vdCBpbiB0aGUgcmVnaXN0cnkpXG4gICAgICAgICAgPyB0cmFuc2Zvcm0oZWxlbWVudCwgbmFtZSlcbiAgICAgICAgICA6IGVsZW1lbnRcbiAgICAgIGlmICh0eXBlb2YgYXNzaWduID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBhc3NpZ24ob2JqLCBzdWJOYW1lLCBlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShvYmpbc3ViTmFtZV0pKSB7XG4gICAgICAgIG9ialtzdWJOYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb2JqW3N1Yk5hbWVdID0gZWxlbWVudFxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIG9ialxuICB9LCBvYmopXG59XG5cbmZ1bmN0aW9uIGZpbHRlciAoZWxlbWVudHMsIGZpbHRlcikge1xuICBzd2l0Y2ggKHR5cGVvZiBmaWx0ZXIpIHtcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGZpbHRlcihlbGVtZW50LCBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSlcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCkgPT09IGZpbHRlclxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsInZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgSW50ZXJuYWxzID0gcmVxdWlyZShcIi4vSW50ZXJuYWxzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcmVnaXN0ZXIgKG5hbWUsIG1peGluKSB7XG4gIG1peGluID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG5cbiAgZnVuY3Rpb24gQ3VzdG9tQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEN1c3RvbUNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiBuZXcgQ3VzdG9tQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgfVxuICAgIHZhciBpbnN0YW5jZSA9IHRoaXNcblxuICAgIENvbXBvbmVudC5jYWxsKGluc3RhbmNlLCBlbGVtZW50LCBvcHRpb25zKVxuICAgIC8vIGF0IHRoaXMgcG9pbnQgY3VzdG9tIGNvbnN0cnVjdG9ycyBjYW4gYWxyZWFkeSBhY2Nlc3MgdGhlIGVsZW1lbnQgYW5kIHN1YiBjb21wb25lbnRzXG4gICAgLy8gc28gdGhleSBvbmx5IHJlY2VpdmUgdGhlIG9wdGlvbnMgb2JqZWN0IGZvciBjb252ZW5pZW5jZVxuICAgIGludGVybmFscy5jcmVhdGUoaW5zdGFuY2UsIFtvcHRpb25zXSlcbiAgfVxuXG4gIHZhciBpbnRlcm5hbHMgPSBuZXcgSW50ZXJuYWxzKEN1c3RvbUNvbXBvbmVudCwgbmFtZSlcbiAgaW50ZXJuYWxzLmV4dGVuZChDb21wb25lbnQpXG4gIGludGVybmFscy5hdXRvQXNzaWduID0gdHJ1ZVxuICBtaXhpbi5mb3JFYWNoKGZ1bmN0aW9uIChtaXhpbikge1xuICAgIGlmICh0eXBlb2YgbWl4aW4gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBtaXhpbi5jYWxsKEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUsIGludGVybmFscylcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpbnRlcm5hbHMucHJvdG8obWl4aW4pXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZWdpc3RyeS5zZXQobmFtZSwgQ3VzdG9tQ29tcG9uZW50KVxufVxuIiwidmFyIHJlZ2lzdHJ5ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG52YXIgY29tcG9uZW50cyA9IHt9XG5cbnJlZ2lzdHJ5LmdldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5leGlzdHMgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuICEhY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5zZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUsIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdID0gQ29tcG9uZW50Q29uc3RydWN0b3Jcbn1cbiIsInZhciBzdG9yYWdlID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxudmFyIGNvbXBvbmVudHMgPSBbXVxudmFyIGVsZW1lbnRzID0gW11cblxuZnVuY3Rpb24gcmVtb3ZlIChhcnJheSwgZWxlbWVudCkge1xuICB2YXIgaSA9IGFycmF5LmluZGV4T2YoZWxlbWVudClcbiAgaWYgKH5pKSBhcnJheS5zcGxpY2UoaSwgMSlcbn1cblxuc3RvcmFnZS5hbGwgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICByZXR1cm4gY29tcG9uZW50cy5maWx0ZXIoZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICAgIHJldHVybiBjb21wb25lbnQuZWxlbWVudCA9PSBlbGVtZW50XG4gIH0pXG59XG5cbnN0b3JhZ2UuZ2V0ID0gZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIHtcbiAgdmFyIHJldCA9IG51bGxcblxuICBjb21wb25lbnRzLnNvbWUoZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICAgIGlmIChjb21wb25lbnQuZWxlbWVudCA9PSBlbGVtZW50ICYmIChjb21wb25lbnROYW1lID8gY29tcG9uZW50LmludGVybmFscy5uYW1lID09IGNvbXBvbmVudE5hbWUgOiB0cnVlKSkge1xuICAgICAgcmV0ID0gY29tcG9uZW50XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfSlcblxuICByZXR1cm4gcmV0XG59XG5zdG9yYWdlLnNhdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gIGlmIChjb21wb25lbnQuZWxlbWVudCkge1xuICAgIGlmICghfmNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnQpKVxuICAgICAgY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudClcbiAgICBpZiAoIX5lbGVtZW50cy5pbmRleE9mKGNvbXBvbmVudC5lbGVtZW50KSlcbiAgICAgIGVsZW1lbnRzLnB1c2goY29tcG9uZW50LmVsZW1lbnQpXG4gIH1cbn1cbnN0b3JhZ2UucmVtb3ZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICB2YXIgZWxlbWVudCA9IGNvbXBvbmVudCBpbnN0YW5jZW9mIEVsZW1lbnRcbiAgICAgID8gY29tcG9uZW50XG4gICAgICA6IGNvbXBvbmVudC5lbGVtZW50XG4gIHZhciBhbGwgPSBzdG9yYWdlLmFsbChlbGVtZW50KVxuXG4gIC8vIHJlbW92ZSBhbGwgY29tcG9uZW50IGZvciB0aGlzIGVsZW1lbnRcbiAgaWYgKGNvbXBvbmVudCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICBhbGwuZm9yRWFjaChmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gICAgICByZW1vdmUoY29tcG9uZW50cywgY29tcG9uZW50KVxuICAgIH0pXG4gIH1cbiAgLy8gcmVtb3ZlIG9uZSBjb21wb25lbnRcbiAgZWxzZSB7XG4gICAgcmVtb3ZlKGNvbXBvbmVudHMsIGNvbXBvbmVudClcbiAgfVxuXG4gIC8vIHJlbW92ZSBlbGVtZW50IHRvbywgaWYgaXQgd2FzIGl0cyBsYXN0IGNvbXBvbmVudFxuICAvLyBiZWNhdXNlIGVsZW1lbnRzIG9ubHkgc3RvcmVkIG9uY2VcbiAgaWYgKGFsbC5sZW5ndGggPT0gMSkge1xuICAgIHJlbW92ZShlbGVtZW50cywgZWxlbWVudClcbiAgfVxufVxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCggb2JqLCBleHRlbnNpb24gKXtcbiAgZm9yKCB2YXIgbmFtZSBpbiBleHRlbnNpb24gKXtcbiAgICBpZiggZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KG5hbWUpICkgb2JqW25hbWVdID0gZXh0ZW5zaW9uW25hbWVdXG4gIH1cbiAgcmV0dXJuIG9ialxufVxuIiwidmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuL2V4dGVuZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBvYmosIGV4dGVuc2lvbiApe1xuICByZXR1cm4gZXh0ZW5kKGV4dGVuZCh7fSwgb2JqKSwgZXh0ZW5zaW9uKVxufVxuIiwidmFyIG9iamVjdCA9IG1vZHVsZS5leHBvcnRzID0ge31cblxub2JqZWN0LmFjY2Vzc29yID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZ2V0LCBzZXQpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIGdldDogZ2V0LFxuICAgIHNldDogc2V0XG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVHZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lU2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHNldDogZm5cbiAgfSlcbn1cblxub2JqZWN0Lm1ldGhvZCA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm5cbiAgfSlcbn1cblxub2JqZWN0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmbixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn1cbiJdfQ==
