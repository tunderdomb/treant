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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9zcmMvaG9va1wiKVxudmFyIHJlZ2lzdGVyID0gcmVxdWlyZShcIi4vc3JjL3JlZ2lzdGVyXCIpXG52YXIgY29tcG9uZW50ID0gcmVxdWlyZShcIi4vc3JjL2NyZWF0ZVwiKVxudmFyIHN0b3JhZ2UgPSByZXF1aXJlKFwiLi9zcmMvc3RvcmFnZVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9Db21wb25lbnRcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL3NyYy9kZWxlZ2F0ZVwiKVxudmFyIGZyYWdtZW50ID0gcmVxdWlyZShcIi4vc3JjL2ZyYWdtZW50XCIpXG5cbnZhciB0cmVhbnQgPSB7fVxubW9kdWxlLmV4cG9ydHMgPSB0cmVhbnRcblxudHJlYW50LnJlZ2lzdGVyID0gcmVnaXN0ZXJcbnRyZWFudC5jb21wb25lbnQgPSBjb21wb25lbnRcbnRyZWFudC5zdG9yYWdlID0gc3RvcmFnZVxudHJlYW50LkNvbXBvbmVudCA9IENvbXBvbmVudFxudHJlYW50LmRlbGVnYXRlID0gZGVsZWdhdGVcbnRyZWFudC5mcmFnbWVudCA9IGZyYWdtZW50XG50cmVhbnQuaG9vayA9IGhvb2tcblxudmFyIHV0aWwgPSB7fVxudHJlYW50LnV0aWwgPSB1dGlsXG5cbnV0aWwuZXh0ZW5kID0gcmVxdWlyZShcIi4vdXRpbC9leHRlbmRcIilcbnV0aWwubWVyZ2UgPSByZXF1aXJlKFwiLi91dGlsL21lcmdlXCIpXG51dGlsLm9iamVjdCA9IHJlcXVpcmUoXCIuL3V0aWwvb2JqZWN0XCIpXG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzdHIpIHtcblx0c3RyID0gc3RyLnRyaW0oKTtcblxuXHRpZiAoc3RyLmxlbmd0aCA9PT0gMSB8fCAhKC9bXy5cXC0gXSsvKS50ZXN0KHN0cikgKSB7XG5cdFx0aWYgKHN0clswXSA9PT0gc3RyWzBdLnRvTG93ZXJDYXNlKCkgJiYgc3RyLnNsaWNlKDEpICE9PSBzdHIuc2xpY2UoMSkudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRyZXR1cm4gc3RyXG5cdC5yZXBsYWNlKC9eW18uXFwtIF0rLywgJycpXG5cdC50b0xvd2VyQ2FzZSgpXG5cdC5yZXBsYWNlKC9bXy5cXC0gXSsoXFx3fCQpL2csIGZ1bmN0aW9uIChtLCBwMSkge1xuXHRcdHJldHVybiBwMS50b1VwcGVyQ2FzZSgpO1xuXHR9KTtcbn07XG4iLCJ2YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcbnZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9kZWxlZ2F0ZVwiKVxudmFyIEludGVybmFscyA9IHJlcXVpcmUoXCIuL0ludGVybmFsc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvbmVudFxuXG5mdW5jdGlvbiBDb21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgaWYgKGVsZW1lbnQgJiYgIShlbGVtZW50IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJlbGVtZW50IHNob3VsZCBiZSBhbiBFbGVtZW50IGluc3RhbmNlIG9yIG51bGxcIilcbiAgfVxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29tcG9uZW50KSkge1xuICAgIHJldHVybiBuZXcgQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gIH1cblxuICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50IHx8IG51bGxcbiAgdGhpcy5jb21wb25lbnRzID0ge31cblxuICB0aGlzLmluaXRpYWxpemUoKVxufVxuXG5Db21wb25lbnQuY3JlYXRlID0gZnVuY3Rpb24gKG5hbWUsIGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgdmFyIENvbXBvbmVudENvbnN0cnVjdG9yID0gbnVsbFxuXG4gIGlmIChyZWdpc3RyeS5leGlzdHMobmFtZSkpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IHJlZ2lzdHJ5LmdldChuYW1lKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIk1pc3NpbmcgY29tcG9uZW50IGRlZmluaXRpb246IFwiLCBuYW1lKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICByZXR1cm4gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbkNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG4gIGludGVybmFsczogbmV3IEludGVybmFscygpLFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuZWxlbWVudCkgcmV0dXJuXG5cbiAgICBpZiAodGhpcy5pbnRlcm5hbHMuYXV0b0Fzc2lnbikge1xuICAgICAgdGhpcy5hc3NpZ25TdWJDb21wb25lbnRzKClcbiAgICB9XG4gICAgdGhpcy5pbnRlcm5hbHMucmVzZXRBdHRyaWJ1dGVzKHRoaXMpXG4gIH0sXG4gIGRlbGVnYXRlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZWxlbWVudCA9IHRoaXMuZWxlbWVudFxuICAgIG9wdGlvbnMuY29udGV4dCA9IG9wdGlvbnMuY29udGV4dCB8fCB0aGlzXG4gICAgcmV0dXJuIGRlbGVnYXRlKG9wdGlvbnMpXG4gIH0sXG5cbiAgZGlzcGF0Y2g6IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IHRoaXMuaW50ZXJuYWxzLmdldEV2ZW50RGVmaW5pdGlvbih0eXBlLCBkZXRhaWwpXG4gICAgcmV0dXJuIHRoaXMuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQodHlwZSwgZGVmaW5pdGlvbikpXG4gIH0sXG5cbiAgZmluZENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZEFsbENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQWxsQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZFN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gaG9vay5maW5kU3ViQ29tcG9uZW50cyh0aGlzLmdldE1haW5Db21wb25lbnROYW1lKGZhbHNlKSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBnZXRDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRDb21wb25lbnROYW1lKHRoaXMuaW50ZXJuYWxzLm5hbWUsIGNjKVxuICB9LFxuICBnZXRNYWluQ29tcG9uZW50TmFtZTogZnVuY3Rpb24gKGNjKSB7XG4gICAgcmV0dXJuIGhvb2suZ2V0TWFpbkNvbXBvbmVudE5hbWUodGhpcy5pbnRlcm5hbHMubmFtZSwgY2MpXG4gIH0sXG4gIGdldFN1YkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldFN1YkNvbXBvbmVudE5hbWUodGhpcy5pbnRlcm5hbHMubmFtZSwgY2MpXG4gIH0sXG4gIGNsZWFyU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgIHZhciBpbnRlcm5hbHMgPSB0aGlzLmludGVybmFsc1xuXG4gICAgZm9yICh2YXIgbmFtZSBpbiBpbnRlcm5hbHMuY29tcG9uZW50cykge1xuICAgICAgaWYgKGludGVybmFscy5jb21wb25lbnRzLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGludGVybmFscy5jb21wb25lbnRzW25hbWVdKSkge1xuICAgICAgICAgIHRoaXMuY29tcG9uZW50c1tuYW1lXSA9IFtdXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5jb21wb25lbnRzW25hbWVdID0gaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgYXNzaWduU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKHRyYW5zZm9ybSkge1xuICAgIGlmICghdGhpcy5lbGVtZW50KSByZXR1cm5cblxuICAgIHZhciBob3N0Q29tcG9uZW50ID0gdGhpc1xuICAgIHZhciBzdWJDb21wb25lbnRzID0gdGhpcy5maW5kU3ViQ29tcG9uZW50cygpXG4gICAgdmFyIGludGVybmFscyA9IHRoaXMuaW50ZXJuYWxzXG5cbiAgICB0aGlzLmNsZWFyU3ViQ29tcG9uZW50cygpXG5cbiAgICBpZiAoIXN1YkNvbXBvbmVudHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHRyYW5zZm9ybSA9PSBcInVuZGVmaW5lZFwiIHx8IHRyYW5zZm9ybSA9PT0gdHJ1ZSkge1xuICAgICAgdHJhbnNmb3JtID0gZnVuY3Rpb24gKGVsZW1lbnQsIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHJlZ2lzdHJ5LmV4aXN0cyhuYW1lKVxuICAgICAgICAgICAgPyBDb21wb25lbnQuY3JlYXRlKGVsZW1lbnQsIGhvc3RDb21wb25lbnQpXG4gICAgICAgICAgICA6IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9XG5cbiAgICBob29rLmFzc2lnblN1YkNvbXBvbmVudHModGhpcy5jb21wb25lbnRzLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGZ1bmN0aW9uIChjb21wb25lbnRzLCBuYW1lLCBlbGVtZW50KSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGNvbXBvbmVudHNbbmFtZV0gfHwgW11cbiAgICAgICAgY29tcG9uZW50c1tuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxudmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuLi91dGlsL2V4dGVuZFwiKVxudmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcbnZhciBvYmplY3QgPSByZXF1aXJlKFwiLi4vdXRpbC9vYmplY3RcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL2RlbGVnYXRlXCIpXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoXCIuL3N0b3JhZ2VcIilcbnZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxuXG52YXIgZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiA9IHtcbiAgZGV0YWlsOiBudWxsLFxuICB2aWV3OiB3aW5kb3csXG4gIGJ1YmJsZXM6IHRydWUsXG4gIGNhbmNlbGFibGU6IHRydWVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBJbnRlcm5hbHNcblxuZnVuY3Rpb24gSW50ZXJuYWxzIChtYXN0ZXIsIG5hbWUpIHtcbiAgdGhpcy5uYW1lID0gbmFtZVxuICB0aGlzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIHRoaXMuX2V2ZW50cyA9IHt9XG4gIHRoaXMuX2NvbnN0cnVjdG9ycyA9IFtdXG4gIHRoaXMuX2F0dHJpYnV0ZXMgPSB7fVxuICB0aGlzLl9hY3Rpb25zID0gW11cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJfbWFzdGVyQ29uc3RydWN0b3JcIiwge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG1hc3RlclxuICAgIH1cbiAgfSlcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiX21hc3RlclwiLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gbWFzdGVyLnByb3RvdHlwZVxuICAgIH1cbiAgfSlcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5leHRlbmQgPSBmdW5jdGlvbiAoQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgdGhpcy5fbWFzdGVyQ29uc3RydWN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDb21wb25lbnRDb25zdHJ1Y3Rvci5wcm90b3R5cGUpXG4gIHRoaXMuX21hc3RlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IHRoaXMuX21hc3RlckNvbnN0cnVjdG9yXG4gIHZhciBpbnRlcm5hbHMgPSBDb21wb25lbnRDb25zdHJ1Y3Rvci5pbnRlcm5hbHNcbiAgdGhpcy5fbWFzdGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmludGVybmFscyA9IHRoaXNcbiAgdGhpcy5fbWFzdGVyQ29uc3RydWN0b3IuaW50ZXJuYWxzID0gdGhpc1xuICBpZiAoaW50ZXJuYWxzKSB7XG4gICAgdGhpcy5hdXRvQXNzaWduID0gaW50ZXJuYWxzLmF1dG9Bc3NpZ25cbiAgICBleHRlbmQodGhpcy5jb21wb25lbnRzLCBpbnRlcm5hbHMuY29tcG9uZW50cylcbiAgICBleHRlbmQodGhpcy5fZXZlbnRzLCBpbnRlcm5hbHMuX2V2ZW50cylcbiAgICB0aGlzLl9jb25zdHJ1Y3RvcnMgPSB0aGlzLl9jb25zdHJ1Y3RvcnMuY29uY2F0KGludGVybmFscy5fY29uc3RydWN0b3JzKVxuICAgIGV4dGVuZCh0aGlzLl9hdHRyaWJ1dGVzLCBpbnRlcm5hbHMuX2F0dHJpYnV0ZXMpXG4gICAgaW50ZXJuYWxzLl9hY3Rpb25zLmZvckVhY2goZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgIHZhciBldmVudCA9IGFyZ3NbMF1cbiAgICAgIHZhciBtYXRjaGVzID0gYXJnc1sxXVxuICAgICAgdmFyIG1hdGNoZXIgPSB0aGlzLmFjdGlvbi5jYWxsKHRoaXMsIGV2ZW50KVxuICAgICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICAgIG1hdGNoZXIubWF0Y2guYXBwbHkobWF0Y2hlciwgYXJncylcbiAgICAgIH0pXG4gICAgfSwgdGhpcylcbiAgfVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLm9uQ3JlYXRlID0gZnVuY3Rpb24gKGNvbnN0cnVjdG9yKSB7XG4gIHRoaXMuX2NvbnN0cnVjdG9ycy5wdXNoKGNvbnN0cnVjdG9yKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgYXJncykge1xuICB0aGlzLl9jb25zdHJ1Y3RvcnMuZm9yRWFjaChmdW5jdGlvbiAoY29uc3RydWN0b3IpIHtcbiAgICBjb25zdHJ1Y3Rvci5hcHBseShpbnN0YW5jZSwgYXJncylcbiAgfSlcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5tZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0Lm1ldGhvZCh0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnByb3BlcnR5ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5wcm9wZXJ0eSh0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QuZGVmaW5lR2V0dGVyKHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5kZWZpbmVHZXR0ZXIodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5hY2Nlc3NvciA9IGZ1bmN0aW9uIChuYW1lLCBnZXQsIHNldCkge1xuICBvYmplY3QuYWNjZXNzb3IodGhpcy5fbWFzdGVyLCBuYW1lLCBnZXQsIHNldClcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5wcm90byA9IGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgZm9yICh2YXIgcHJvcCBpbiBwcm90b3R5cGUpIHtcbiAgICBpZiAocHJvdG90eXBlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICBpZiAodHlwZW9mIHByb3RvdHlwZVtwcm9wXSA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgaWYgKHByb3AgPT09IFwib25DcmVhdGVcIikge1xuICAgICAgICAgIHRoaXMub25DcmVhdGUocHJvdG90eXBlW3Byb3BdKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMubWV0aG9kKHByb3AsIHByb3RvdHlwZVtwcm9wXSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMucHJvcGVydHkocHJvcCwgcHJvdG90eXBlW3Byb3BdKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmFjdGlvbiA9IGZ1bmN0aW9uIGFjdGlvbihldmVudCkge1xuICB2YXIgaW50ZXJuYWxzID0gdGhpc1xuICB2YXIgYXR0cmlidXRlTmFtZSA9IGludGVybmFscy5uYW1lXG4gIHZhciBtYXRjaGVyID0ge31cbiAgdmFyIG1hdGNoZXMgPSBbXVxuICB2YXIgZGVsZWdhdG9yID0gZGVsZWdhdGUoe2VsZW1lbnQ6IGRvY3VtZW50LmJvZHksIGV2ZW50OiBldmVudH0pXG5cbiAgaW50ZXJuYWxzLl9hY3Rpb25zLnB1c2goW2V2ZW50LCBtYXRjaGVzXSlcblxuICBtYXRjaGVyLm1hdGNoID0gZnVuY3Rpb24gKGNvbXBvbmVudHMsIGNiKSB7XG4gICAgbWF0Y2hlcy5wdXNoKFtjb21wb25lbnRzLCBjYl0pXG5cbiAgICBpZiAoIWNiKSB7XG4gICAgICBjYiA9IGNvbXBvbmVudHNcbiAgICAgIGNvbXBvbmVudHMgPSBbXVxuICAgIH1cblxuICAgIGlmICh0eXBlb2YgY29tcG9uZW50cyA9PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb21wb25lbnRzID0gW2NvbXBvbmVudHNdXG4gICAgfVxuXG4gICAgdmFyIHNlbGVjdG9ycyA9IGNvbXBvbmVudHMubWFwKGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgICAgIGlmIChjb21wb25lbnRbMF0gPT0gXCI6XCIpIHtcbiAgICAgICAgY29tcG9uZW50ID0gYXR0cmlidXRlTmFtZStjb21wb25lbnRcbiAgICAgIH1cbiAgICAgIHJldHVybiBob29rLmNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKGNvbXBvbmVudCwgXCJ+PVwiKVxuICAgIH0pXG4gICAgc2VsZWN0b3JzLnVuc2hpZnQoaG9vay5jcmVhdGVDb21wb25lbnRTZWxlY3RvcihhdHRyaWJ1dGVOYW1lLCBcIn49XCIpKVxuXG4gICAgZGVsZWdhdG9yLm1hdGNoKHNlbGVjdG9ycywgZnVuY3Rpb24gKGUsIG1haW4pIHtcbiAgICAgIHZhciBpbnN0YW5jZSA9IHN0b3JhZ2UuZ2V0KG1haW4pIHx8IG1haW5cbiAgICAgIHZhciBhcmdzID0gW2VdO1xuXG4gICAgICBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikuZm9yRWFjaChmdW5jdGlvbiAoZWxlbWVudCwgaSkge1xuICAgICAgICB2YXIgbmFtZSA9IGNvbXBvbmVudHNbaV1cbiAgICAgICAgbmFtZSA9IG5hbWVbMF0gPT0gXCI6XCIgPyBuYW1lLnN1YnN0cigxKSA6IG5hbWVcbiAgICAgICAgbmFtZSA9IGNhbWVsY2FzZShuYW1lKVxuICAgICAgICB2YXIgYXJnXG5cbiAgICAgICAgaWYgKGluc3RhbmNlLmNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgICBhcmcgPSBpbnN0YW5jZS5jb21wb25lbnRzW25hbWVdXG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXJnKSkge1xuICAgICAgICAgICAgYXJnLnNvbWUoZnVuY3Rpb24gKG1lbWJlcikge1xuICAgICAgICAgICAgICBpZiAobWVtYmVyID09IGVsZW1lbnQgfHwgbWVtYmVyLmVsZW1lbnQgPT0gbWVtYmVyKSB7XG4gICAgICAgICAgICAgICAgYXJnID0gbWVtYmVyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGFyZyA9IHN0b3JhZ2UuZ2V0KGVsZW1lbnQsIG5hbWUpIHx8IGVsZW1lbnRcbiAgICAgICAgfVxuXG4gICAgICAgIGFyZ3MucHVzaChhcmcpXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gY2IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gICAgfSlcblxuICAgIHJldHVybiBtYXRjaGVyXG4gIH1cblxuICByZXR1cm4gbWF0Y2hlclxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmV2ZW50ID0gZnVuY3Rpb24gKHR5cGUsIGRlZmluaXRpb24pIHtcbiAgdGhpcy5fZXZlbnRzW3R5cGVdID0gZGVmaW5pdGlvblxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmdldEV2ZW50RGVmaW5pdGlvbiA9IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgdmFyIGRlZmluaXRpb24gPSBtZXJnZShkZWZhdWx0RXZlbnREZWZpbml0aW9uLCB0aGlzLl9ldmVudHNbdHlwZV0pXG4gIGRlZmluaXRpb24uZGV0YWlsID0gdHlwZW9mIGRldGFpbCA9PSBcInVuZGVmaW5lZFwiID8gZGVmaW5pdGlvbi5kZXRhaWwgOiBkZXRhaWxcbiAgcmV0dXJuIGRlZmluaXRpb25cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5yZXNldEF0dHJpYnV0ZXMgPSBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcbiAgaWYgKCFpbnN0YW5jZS5lbGVtZW50KSByZXR1cm5cblxuICB2YXIgYXR0cmlidXRlXG4gIHZhciB2YWx1ZVxuICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX2F0dHJpYnV0ZXMpIHtcbiAgICBpZiAodGhpcy5fYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlc1tuYW1lXVxuICAgICAgdmFsdWUgPSBhdHRyaWJ1dGUuZ2V0LmNhbGwoaW5zdGFuY2UsIGZhbHNlKVxuICAgICAgaWYgKGF0dHJpYnV0ZS5oYXNEZWZhdWx0ICYmICFhdHRyaWJ1dGUuaGFzLmNhbGwoaW5zdGFuY2UsIHZhbHVlKSkge1xuICAgICAgICBhdHRyaWJ1dGUuc2V0LmNhbGwoaW5zdGFuY2UsIGF0dHJpYnV0ZS5kZWZhdWx0VmFsdWUsIGZhbHNlKVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmF0dHJpYnV0ZSA9IGZ1bmN0aW9uIChuYW1lLCBkZWYpIHtcbiAgdmFyIG1hc3RlciA9IHRoaXMuX21hc3RlclxuICBpZiAoIW1hc3Rlcikge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBpZiAoZGVmID09IG51bGwpIHtcbiAgICBkZWYgPSB7fVxuICB9XG5cbiAgdmFyIHR5cGVPZkRlZiA9IHR5cGVvZiBkZWZcbiAgdmFyIHR5cGVcbiAgdmFyIGRlZmF1bHRWYWx1ZVxuICB2YXIgZ2V0dGVyXG4gIHZhciBzZXR0ZXJcbiAgdmFyIG9uY2hhbmdlXG4gIHZhciBwcm9wZXJ0eSA9IGNhbWVsY2FzZShuYW1lKVxuXG4gIHN3aXRjaCAodHlwZU9mRGVmKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgLy8gdGhlIGRlZmluaXRpb24gaXMgYSBwcmltaXRpdmUgdmFsdWVcbiAgICAgIHR5cGUgPSB0eXBlT2ZEZWZcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IGRlZlxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIG9yIGEgZGVmaW5pdGlvbiBvYmplY3RcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHR5cGVvZiBkZWZbXCJkZWZhdWx0XCJdID09IFwidW5kZWZpbmVkXCIgPyBudWxsIDogZGVmW1wiZGVmYXVsdFwiXVxuICAgICAgaWYgKHR5cGVvZiBkZWZbXCJ0eXBlXCJdID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKGRlZmF1bHRWYWx1ZSA9PSBudWxsKSB7XG4gICAgICAgICAgdHlwZSA9IFwic3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0eXBlID0gdHlwZW9mIGRlZmF1bHRWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdHlwZSA9IGRlZltcInR5cGVcIl1cbiAgICAgIH1cbiAgICAgIGdldHRlciA9IGRlZltcImdldFwiXVxuICAgICAgc2V0dGVyID0gZGVmW1wic2V0XCJdXG4gICAgICBvbmNoYW5nZSA9IGRlZltcIm9uY2hhbmdlXCJdXG4gIH1cblxuICB2YXIgcGFyc2VWYWx1ZVxuICB2YXIgc3RyaW5naWZ5VmFsdWVcbiAgdmFyIGhhc1xuXG4gIGhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT0gbnVsbCB9XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIGhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT09IGZhbHNlIH1cbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9IG51bGwgfVxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBcIlwiIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiBwYXJzZUludCh2YWx1ZSwgMTApIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSA9PSBudWxsID8gbnVsbCA6IHBhcnNlRmxvYXQodmFsdWUpIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgIGRlZmF1bHQ6XG4gICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiB2YWx1ZSA/IFwiXCIrdmFsdWUgOiBcIlwiIH1cbiAgfVxuXG4gIHRoaXMuX2F0dHJpYnV0ZXNbcHJvcGVydHldID0ge1xuICAgIGdldDogZ2V0LFxuICAgIHNldDogc2V0LFxuICAgIGhhczogaGFzLFxuICAgIGRlZmF1bHRWYWx1ZTogZGVmYXVsdFZhbHVlLFxuICAgIGhhc0RlZmF1bHQ6IGRlZmF1bHRWYWx1ZSAhPSBudWxsXG4gIH1cblxuICBmdW5jdGlvbiBnZXQodXNlRGVmYXVsdCkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICBpZiAodmFsdWUgPT0gbnVsbCAmJiB1c2VEZWZhdWx0ID09IHRydWUpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlVmFsdWUgPyBwYXJzZVZhbHVlKHZhbHVlKSA6IHZhbHVlXG4gIH1cblxuICBmdW5jdGlvbiBzZXQodmFsdWUsIGNhbGxPbmNoYW5nZSkge1xuICAgIHZhciBvbGQgPSBnZXQuY2FsbCh0aGlzLCBmYWxzZSlcbiAgICBpZiAoIWhhcyh2YWx1ZSkpIHtcbiAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUobmFtZSlcbiAgICB9XG4gICAgZWxzZSBpZiAob2xkID09PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gc3RyaW5naWZ5VmFsdWUgPyBzdHJpbmdpZnlWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICAgICAgdGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZShuYW1lLCBuZXdWYWx1ZSlcbiAgICB9XG4gICAgb25jaGFuZ2UgJiYgY2FsbE9uY2hhbmdlICE9IGZhbHNlICYmIG9uY2hhbmdlLmNhbGwodGhpcywgb2xkLCB2YWx1ZSlcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtYXN0ZXIsIHByb3BlcnR5LCB7XG4gICAgZ2V0OiBnZXR0ZXIgfHwgZ2V0LFxuICAgIHNldDogc2V0dGVyIHx8IHNldFxuICB9KVxuXG4gIHJldHVybiB0aGlzXG59XG4iLCJ2YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRcblxuZnVuY3Rpb24gY29tcG9uZW50IChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICBpZiAoIShyb290IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICBvcHRpb25zID0gcm9vdFxuICAgIHJvb3QgPSBudWxsXG4gIH1cbiAgdmFyIGVsZW1lbnQgPSBob29rLmZpbmRDb21wb25lbnQobmFtZSwgcm9vdClcblxuICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShuYW1lLCBlbGVtZW50LCBvcHRpb25zKVxufVxuXG5jb21wb25lbnQuYWxsID0gZnVuY3Rpb24gKG5hbWUsIHJvb3QsIG9wdGlvbnMpIHtcbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCB7fV0pXG4gIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIEVsZW1lbnRdKVxuICB2YXIgZWxlbWVudHMgPSBob29rLmZpbmRBbGxDb21wb25lbnQobmFtZSwgcm9vdClcblxuICByZXR1cm4gW10ubWFwLmNhbGwoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUobmFtZSwgZWxlbWVudCwgb3B0aW9ucylcbiAgfSlcbn1cbiIsIi8qKlxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIG9uIGFuIGVsZW1lbnRcbiAqIGFuZCByZXR1cm5zIGEgZGVsZWdhdG9yLlxuICogQSBkZWxlZ2F0ZWQgZXZlbnQgcnVucyBtYXRjaGVzIHRvIGZpbmQgYW4gZXZlbnQgdGFyZ2V0LFxuICogdGhlbiBleGVjdXRlcyB0aGUgaGFuZGxlciBwYWlyZWQgd2l0aCB0aGUgbWF0Y2hlci5cbiAqIE1hdGNoZXJzIGNhbiBjaGVjayBpZiBhbiBldmVudCB0YXJnZXQgbWF0Y2hlcyBhIGdpdmVuIHNlbGVjdG9yLFxuICogb3Igc2VlIGlmIGFuIG9mIGl0cyBwYXJlbnRzIGRvLlxuICogKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVsZWdhdGUoIG9wdGlvbnMgKXtcbiAgICB2YXIgZWxlbWVudCA9IG9wdGlvbnMuZWxlbWVudFxuICAgICAgICAsIGV2ZW50ID0gb3B0aW9ucy5ldmVudFxuICAgICAgICAsIGNhcHR1cmUgPSAhIW9wdGlvbnMuY2FwdHVyZXx8ZmFsc2VcbiAgICAgICAgLCBjb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0fHxlbGVtZW50XG5cbiAgICBpZiggIWVsZW1lbnQgKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYW4ndCBkZWxlZ2F0ZSB1bmRlZmluZWQgZWxlbWVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBpZiggIWV2ZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGV2ZW50XCIpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIGRlbGVnYXRvciA9IGNyZWF0ZURlbGVnYXRvcihjb250ZXh0KVxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGVsZWdhdG9yLCBjYXB0dXJlKVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG4vKipcbiAqIFJldHVybnMgYSBkZWxlZ2F0b3IgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBldmVudCBsaXN0ZW5lci5cbiAqIFRoZSBkZWxlZ2F0b3IgaGFzIHN0YXRpYyBtZXRob2RzIHdoaWNoIGNhbiBiZSB1c2VkIHRvIHJlZ2lzdGVyIGhhbmRsZXJzLlxuICogKi9cbmZ1bmN0aW9uIGNyZWF0ZURlbGVnYXRvciggY29udGV4dCApe1xuICAgIHZhciBtYXRjaGVycyA9IFtdXG5cbiAgICBmdW5jdGlvbiBkZWxlZ2F0b3IoIGUgKXtcbiAgICAgICAgdmFyIGwgPSBtYXRjaGVycy5sZW5ndGhcbiAgICAgICAgaWYoICFsICl7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVsID0gdGhpc1xuICAgICAgICAgICAgLCBpID0gLTFcbiAgICAgICAgICAgICwgaGFuZGxlclxuICAgICAgICAgICAgLCBzZWxlY3RvclxuICAgICAgICAgICAgLCBkZWxlZ2F0ZUVsZW1lbnRcbiAgICAgICAgICAgICwgc3RvcFByb3BhZ2F0aW9uXG4gICAgICAgICAgICAsIGFyZ3NcblxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgYXJncyA9IG1hdGNoZXJzW2ldXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXVxuICAgICAgICAgICAgc2VsZWN0b3IgPSBhcmdzWzFdXG5cbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IG1hdGNoQ2FwdHVyZVBhdGgoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICAgICAgaWYoIGRlbGVnYXRlRWxlbWVudCAmJiBkZWxlZ2F0ZUVsZW1lbnQubGVuZ3RoICkge1xuICAgICAgICAgICAgICAgIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlID09PSBoYW5kbGVyLmFwcGx5KGNvbnRleHQsIFtlXS5jb25jYXQoZGVsZWdhdGVFbGVtZW50KSlcbiAgICAgICAgICAgICAgICBpZiggc3RvcFByb3BhZ2F0aW9uICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIGhhbmRsZXIgd2l0aCBhIHRhcmdldCBmaW5kZXIgbG9naWNcbiAgICAgKiAqL1xuICAgIGRlbGVnYXRvci5tYXRjaCA9IGZ1bmN0aW9uKCBzZWxlY3RvciwgaGFuZGxlciApe1xuICAgICAgICBtYXRjaGVycy5wdXNoKFtoYW5kbGVyLCBzZWxlY3Rvcl0pXG4gICAgICAgIHJldHVybiBkZWxlZ2F0b3JcbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZWdhdG9yXG59XG5cbmZ1bmN0aW9uIG1hdGNoQ2FwdHVyZVBhdGgoIHNlbGVjdG9yLCBlbCwgZSApe1xuICAgIHZhciBkZWxlZ2F0ZUVsZW1lbnRzID0gW11cbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50ID0gbnVsbFxuICAgIGlmKCBBcnJheS5pc0FycmF5KHNlbGVjdG9yKSApe1xuICAgICAgICB2YXIgaSA9IC0xXG4gICAgICAgIHZhciBsID0gc2VsZWN0b3IubGVuZ3RoXG4gICAgICAgIHdoaWxlKCArK2kgPCBsICl7XG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yW2ldLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCAhZGVsZWdhdGVFbGVtZW50ICkgcmV0dXJuIG51bGxcbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IGZpbmRQYXJlbnQoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgfVxuICAgIHJldHVybiBkZWxlZ2F0ZUVsZW1lbnRzXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIHRhcmdldCBvciBhbnkgb2YgaXRzIHBhcmVudCBtYXRjaGVzIGEgc2VsZWN0b3JcbiAqICovXG5mdW5jdGlvbiBmaW5kUGFyZW50KCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXRcbiAgICBzd2l0Y2goIHR5cGVvZiBzZWxlY3RvciApe1xuICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgICAgICB3aGlsZSggdGFyZ2V0ICYmIHRhcmdldCAhPSBlbCApe1xuICAgICAgICAgICAgICAgIGlmKCB0YXJnZXQubWF0Y2hlcyhzZWxlY3RvcikgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggc2VsZWN0b3IuY2FsbChlbCwgdGFyZ2V0KSApIHJldHVybiB0YXJnZXRcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIHJldHVybiBudWxsXG59XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZyYWdtZW50XG5cbmZyYWdtZW50Lm9wdGlvbnMgPSB7XG4gIHZhcmlhYmxlOiBcImZcIlxufVxuXG5mdW5jdGlvbiBmcmFnbWVudCggaHRtbCwgY29tcGlsZXIsIGNvbXBpbGVyT3B0aW9ucyApe1xuICBjb21waWxlck9wdGlvbnMgPSBtZXJnZShmcmFnbWVudC5vcHRpb25zLCBjb21waWxlck9wdGlvbnMpXG4gIHZhciByZW5kZXIgPSBudWxsXG4gIHJldHVybiBmdW5jdGlvbiggdGVtcGxhdGVEYXRhICl7XG4gICAgdmFyIHRlbXAgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgIGlmKCB0eXBlb2YgY29tcGlsZXIgPT0gXCJmdW5jdGlvblwiICYmICFyZW5kZXIgKXtcbiAgICAgIHJlbmRlciA9IGNvbXBpbGVyKGh0bWwsIGNvbXBpbGVyT3B0aW9ucylcbiAgICB9XG4gICAgaWYoIHJlbmRlciApe1xuICAgICAgdHJ5e1xuICAgICAgICBodG1sID0gcmVuZGVyKHRlbXBsYXRlRGF0YSlcbiAgICAgIH1cbiAgICAgIGNhdGNoKCBlICl7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZW5kZXJpbmcgZnJhZ21lbnQgd2l0aCBjb250ZXh0OlwiLCB0ZW1wbGF0ZURhdGEpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVuZGVyLnRvU3RyaW5nKCkpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgIH1cblxuICAgIHRlbXAuaW5uZXJIVE1MID0gaHRtbFxuICAgIHZhciBmcmFnbWVudCA9IHdpbmRvdy5kb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcbiAgICB3aGlsZSggdGVtcC5jaGlsZE5vZGVzLmxlbmd0aCApe1xuICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGVtcC5maXJzdENoaWxkKVxuICAgIH1cbiAgICByZXR1cm4gZnJhZ21lbnRcbiAgfVxufVxuZnJhZ21lbnQucmVuZGVyID0gZnVuY3Rpb24oIGh0bWwsIHRlbXBsYXRlRGF0YSApe1xuICByZXR1cm4gZnJhZ21lbnQoaHRtbCkodGVtcGxhdGVEYXRhKVxufVxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBDT01QT05FTlRfQVRUUklCVVRFID0gXCJkYXRhLWNvbXBvbmVudFwiXG5cbnZhciBob29rID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG5ob29rLnNldEhvb2tBdHRyaWJ1dGUgPSBzZXRIb29rQXR0cmlidXRlXG5ob29rLmNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yID0gY3JlYXRlQ29tcG9uZW50U2VsZWN0b3Jcbmhvb2suZmluZENvbXBvbmVudCA9IGZpbmRDb21wb25lbnRcbmhvb2suZmluZEFsbENvbXBvbmVudCA9IGZpbmRBbGxDb21wb25lbnRcbmhvb2suZmluZFN1YkNvbXBvbmVudHMgPSBmaW5kU3ViQ29tcG9uZW50c1xuaG9vay5nZXRDb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZVxuaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSA9IGdldE1haW5Db21wb25lbnROYW1lXG5ob29rLmdldFN1YkNvbXBvbmVudE5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lXG5ob29rLmFzc2lnblN1YkNvbXBvbmVudHMgPSBhc3NpZ25TdWJDb21wb25lbnRzXG5ob29rLmZpbHRlciA9IGZpbHRlclxuXG5mdW5jdGlvbiBzZXRIb29rQXR0cmlidXRlIChob29rKSB7XG4gIENPTVBPTkVOVF9BVFRSSUJVVEUgPSBob29rXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yIChuYW1lLCBvcGVyYXRvcikge1xuICBuYW1lID0gbmFtZSAmJiAnXCInICsgbmFtZSArICdcIidcbiAgb3BlcmF0b3IgPSBuYW1lID8gb3BlcmF0b3IgfHwgXCI9XCIgOiBcIlwiXG4gIHJldHVybiBcIltcIiArIENPTVBPTkVOVF9BVFRSSUJVVEUgKyBvcGVyYXRvciArIG5hbWUgKyBcIl1cIlxufVxuXG5mdW5jdGlvbiBjb21wb3NlIChuYW1lLCBleHRyYSwgb3BlcmF0b3IpIHtcbiAgcmV0dXJuIGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUsIG9wZXJhdG9yKStleHRyYVxufVxuXG5mdW5jdGlvbiBmaW5kQ29tcG9zZWQgKHNlbGVjdG9yLCByb290KSB7XG4gIHJldHVybiAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvcihzZWxlY3Rvcilcbn1cblxuZnVuY3Rpb24gZmluZEFsbENvbXBvc2VkIChzZWxlY3Rvciwgcm9vdCkge1xuICByZXR1cm4gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpXG59XG5cbmZ1bmN0aW9uIGZpbmRDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIGZpbmRDb21wb3NlZChjcmVhdGVDb21wb25lbnRTZWxlY3RvcihuYW1lKSwgcm9vdClcbn1cblxuZnVuY3Rpb24gZmluZEFsbENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gW10uc2xpY2UuY2FsbChmaW5kQWxsQ29tcG9zZWQoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSksIHJvb3QpKVxufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBpZiAoIWVsZW1lbnQpIHJldHVybiBcIlwiXG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IHR5cGVvZiBlbGVtZW50ID09IFwic3RyaW5nXCIgPyBlbGVtZW50IDogZWxlbWVudC5nZXRBdHRyaWJ1dGUoQ09NUE9ORU5UX0FUVFJJQlVURSkgfHwgXCJcIlxuICByZXR1cm4gY2MgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0TWFpbkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzBdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldFN1YkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzFdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWVMaXN0IChlbGVtZW50LCBjYykge1xuICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBjYykuc3BsaXQoL1xccysvKVxufVxuXG5mdW5jdGlvbiBmaW5kU3ViQ29tcG9uZW50cyAobWFpbk5hbWUsIHJvb3QpIHtcbiAgdmFyIGVsZW1lbnRzID0gZmluZEFsbENvbXBvc2VkKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG1haW5OYW1lK1wiOlwiLCBcIio9XCIpLCByb290KVxuICByZXR1cm4gZmlsdGVyKGVsZW1lbnRzLCBmdW5jdGlvbiAoZWxlbWVudCwgY29tcG9uZW50TmFtZSkge1xuICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lTGlzdChjb21wb25lbnROYW1lLCBmYWxzZSkuc29tZShmdW5jdGlvbiAobmFtZSkge1xuICAgICAgcmV0dXJuIGdldE1haW5Db21wb25lbnROYW1lKG5hbWUsIGZhbHNlKSA9PSBtYWluTmFtZSAmJiBnZXRTdWJDb21wb25lbnROYW1lKG5hbWUpXG4gICAgfSlcbiAgfSlcbn1cblxuZnVuY3Rpb24gYXNzaWduU3ViQ29tcG9uZW50cyAob2JqLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGFzc2lnbikge1xuICByZXR1cm4gc3ViQ29tcG9uZW50cy5yZWR1Y2UoZnVuY3Rpb24gKG9iaiwgZWxlbWVudCkge1xuICAgIGdldENvbXBvbmVudE5hbWVMaXN0KGVsZW1lbnQsIGZhbHNlKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICBuYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZShuYW1lLCBmYWxzZSlcbiAgICAgIGVsZW1lbnQgPSB0eXBlb2YgdHJhbnNmb3JtID09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgIC8vIFRPRE86IHN1YmNsYXNzIHN1YmNvbXBvbmVudHMgc2hvdWxkIGJlIGhhbmRsZWQgcHJvcGVybHkgKEIgZXh0ZW5kcyBBIHRoYXQgaGFzIGEgc3ViY29tcG9uZW50IEE6YSBiZWNvbWVzIEI6YSB0aGF0J3Mgbm90IGluIHRoZSByZWdpc3RyeSlcbiAgICAgICAgICA/IHRyYW5zZm9ybShlbGVtZW50LCBuYW1lKVxuICAgICAgICAgIDogZWxlbWVudFxuICAgICAgbmFtZSA9IGNhbWVsY2FzZShuYW1lKVxuICAgICAgaWYgKHR5cGVvZiBhc3NpZ24gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGFzc2lnbihvYmosIG5hbWUsIGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9ialtuYW1lXSkpIHtcbiAgICAgICAgb2JqW25hbWVdLnB1c2goZWxlbWVudClcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmpbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gb2JqXG4gIH0sIG9iailcbn1cblxuZnVuY3Rpb24gZmlsdGVyIChlbGVtZW50cywgZmlsdGVyKSB7XG4gIHN3aXRjaCAodHlwZW9mIGZpbHRlcikge1xuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZmlsdGVyKGVsZW1lbnQsIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50KSA9PT0gZmlsdGVyXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuIiwidmFyIHJlZ2lzdHJ5ID0gcmVxdWlyZShcIi4vcmVnaXN0cnlcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZWdpc3RlciAobmFtZSwgbWl4aW4pIHtcbiAgbWl4aW4gPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcblxuICBmdW5jdGlvbiBDdXN0b21Db21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ3VzdG9tQ29tcG9uZW50KSkge1xuICAgICAgcmV0dXJuIG5ldyBDdXN0b21Db21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgICB9XG4gICAgdmFyIGluc3RhbmNlID0gdGhpc1xuXG4gICAgQ29tcG9uZW50LmNhbGwoaW5zdGFuY2UsIGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgLy8gYXQgdGhpcyBwb2ludCBjdXN0b20gY29uc3RydWN0b3JzIGNhbiBhbHJlYWR5IGFjY2VzcyB0aGUgZWxlbWVudCBhbmQgc3ViIGNvbXBvbmVudHNcbiAgICAvLyBzbyB0aGV5IG9ubHkgcmVjZWl2ZSB0aGUgb3B0aW9ucyBvYmplY3QgZm9yIGNvbnZlbmllbmNlXG4gICAgaW50ZXJuYWxzLmNyZWF0ZShpbnN0YW5jZSwgW29wdGlvbnNdKVxuICB9XG5cbiAgLy9DdXN0b21Db21wb25lbnQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDb21wb25lbnQucHJvdG90eXBlKVxuICAvL0N1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDdXN0b21Db21wb25lbnRcbiAgdmFyIGludGVybmFscyA9IG5ldyBJbnRlcm5hbHMoQ3VzdG9tQ29tcG9uZW50LCBuYW1lKVxuICBpbnRlcm5hbHMuZXh0ZW5kKENvbXBvbmVudClcbiAgaW50ZXJuYWxzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIG1peGluLmZvckVhY2goZnVuY3Rpb24gKG1peGluKSB7XG4gICAgaWYgKHR5cGVvZiBtaXhpbiA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIG1peGluLmNhbGwoQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSwgaW50ZXJuYWxzKVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGludGVybmFscy5wcm90byhtaXhpbilcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJlZ2lzdHJ5LnNldChuYW1lLCBDdXN0b21Db21wb25lbnQpXG4gIC8vIGRlZmluZSBtYWluIHByb3RvdHlwZSBhZnRlciByZWdpc3RlcmluZ1xufVxuIiwidmFyIHJlZ2lzdHJ5ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG52YXIgY29tcG9uZW50cyA9IHt9XG5cbnJlZ2lzdHJ5LmdldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5leGlzdHMgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuICEhY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5zZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUsIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdID0gQ29tcG9uZW50Q29uc3RydWN0b3Jcbn1cbiIsInZhciBzdG9yYWdlID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxudmFyIGNvbXBvbmVudHMgPSBbXVxudmFyIGVsZW1lbnRzID0gW11cblxuZnVuY3Rpb24gcmVtb3ZlIChhcnJheSwgZWxlbWVudCkge1xuICB2YXIgaSA9IGFycmF5LmluZGV4T2YoZWxlbWVudClcbiAgaWYgKH5pKSBhcnJheS5zcGxpY2UoaSwgMSlcbn1cblxuc3RvcmFnZS5hbGwgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICByZXR1cm4gY29tcG9uZW50cy5maWx0ZXIoZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICAgIHJldHVybiBjb21wb25lbnQuZWxlbWVudCA9PSBlbGVtZW50XG4gIH0pXG59XG5cbnN0b3JhZ2UuZ2V0ID0gZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIHtcbiAgdmFyIHJldCA9IG51bGxcblxuICBjb21wb25lbnRzLnNvbWUoZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICAgIGlmIChjb21wb25lbnQuZWxlbWVudCA9PSBlbGVtZW50ICYmIChjb21wb25lbnROYW1lID8gY29tcG9uZW50LmludGVybmFscy5hdHRyaWJ1dGVOYW1lID09IGNvbXBvbmVudE5hbWUgOiB0cnVlKSkge1xuICAgICAgcmV0ID0gY29tcG9uZW50XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfSlcblxuICByZXR1cm4gcmV0XG59XG5zdG9yYWdlLnNhdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gIGlmIChjb21wb25lbnQuZWxlbWVudCkge1xuICAgIGlmICghfmNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnQpKVxuICAgICAgY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudClcbiAgICBpZiAoIX5lbGVtZW50cy5pbmRleE9mKGNvbXBvbmVudC5lbGVtZW50KSlcbiAgICAgIGVsZW1lbnRzLnB1c2goY29tcG9uZW50LmVsZW1lbnQpXG4gIH1cbn1cbnN0b3JhZ2UucmVtb3ZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICB2YXIgZWxlbWVudCA9IGNvbXBvbmVudCBpbnN0YW5jZW9mIEVsZW1lbnRcbiAgICAgID8gY29tcG9uZW50XG4gICAgICA6IGNvbXBvbmVudC5lbGVtZW50XG4gIHZhciBhbGwgPSBzdG9yYWdlLmFsbChlbGVtZW50KVxuXG4gIC8vIHJlbW92ZSBhbGwgY29tcG9uZW50IGZvciB0aGlzIGVsZW1lbnRcbiAgaWYgKGNvbXBvbmVudCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICBhbGwuZm9yRWFjaChmdW5jdGlvbiAoY29tcG9uZW50KSB7XG4gICAgICByZW1vdmUoY29tcG9uZW50cywgY29tcG9uZW50KVxuICAgIH0pXG4gIH1cbiAgLy8gcmVtb3ZlIG9uZSBjb21wb25lbnRcbiAgZWxzZSB7XG4gICAgcmVtb3ZlKGNvbXBvbmVudHMsIGNvbXBvbmVudClcbiAgfVxuXG4gIC8vIHJlbW92ZSBlbGVtZW50IHRvbywgaWYgaXQgd2FzIGl0cyBsYXN0IGNvbXBvbmVudFxuICAvLyBiZWNhdXNlIGVsZW1lbnRzIG9ubHkgc3RvcmVkIG9uY2VcbiAgaWYgKGFsbC5sZW5ndGggPT0gMSkge1xuICAgIHJlbW92ZShlbGVtZW50cywgZWxlbWVudClcbiAgfVxufVxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCggb2JqLCBleHRlbnNpb24gKXtcbiAgZm9yKCB2YXIgbmFtZSBpbiBleHRlbnNpb24gKXtcbiAgICBpZiggZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KG5hbWUpICkgb2JqW25hbWVdID0gZXh0ZW5zaW9uW25hbWVdXG4gIH1cbiAgcmV0dXJuIG9ialxufVxuIiwidmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuL2V4dGVuZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBvYmosIGV4dGVuc2lvbiApe1xuICByZXR1cm4gZXh0ZW5kKGV4dGVuZCh7fSwgb2JqKSwgZXh0ZW5zaW9uKVxufVxuIiwidmFyIG9iamVjdCA9IG1vZHVsZS5leHBvcnRzID0ge31cblxub2JqZWN0LmFjY2Vzc29yID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZ2V0LCBzZXQpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIGdldDogZ2V0LFxuICAgIHNldDogc2V0XG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVHZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lU2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHNldDogZm5cbiAgfSlcbn1cblxub2JqZWN0Lm1ldGhvZCA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm5cbiAgfSlcbn1cblxub2JqZWN0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmbixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn1cbiJdfQ==
