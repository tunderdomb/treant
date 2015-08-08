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
var storage = require("./storage")
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

  this._element = null
  this._id = null
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
  destroy: function () {
    storage.remove(this)
    this.element = null

    var components = this.components
    var component
    for (var name in components) {
      if (components.hasOwnProperty(name)) {
        component = components[name]
        if (component.destroy) {
          component.destroy()
        }
      }
    }
    this.components = null
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
  findAllComponents: function (name) {
    return hook.findAllComponents(name, this.element)
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

Object.defineProperty(Component.prototype, "element", {
  get: function () {
    return this._element
  },
  set: function (element) {
    this._element = element
    if (element && this.internals.name) storage.save(this)
  }
})

},{"./Internals":4,"./delegate":6,"./hook":8,"./registry":10,"./storage":11}],4:[function(require,module,exports){
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
  var elements = hook.findAllComponents(name, root)

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
hook.selector = selector
hook.findComponent = findComponent
hook.findAllComponents = findAllComponents
hook.findSubComponents = findSubComponents
hook.getComponentName = getComponentName
hook.getMainComponentName = getMainComponentName
hook.getSubComponentName = getSubComponentName
hook.assignSubComponents = assignSubComponents
hook.filter = filter

function setHookAttribute (hook) {
  COMPONENT_ATTRIBUTE = hook
}

function selector (name, operator, extra) {
  name = name && '"' + name + '"'
  operator = name ? operator || "=" : ""
  extra = extra || ""
  return "[" + COMPONENT_ATTRIBUTE + operator + name + "]" + extra
}

function find (selector, root) {
  return (root || document).querySelector(selector)
}

function findAll (selector, root) {
  return (root || document).querySelectorAll(selector)
}

function findComponent (name, root) {
  return find(selector(name), root)
}

function findAllComponents (name, root) {
  return [].slice.call(findAll(selector(name), root))
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
  var elements = findAll(selector(mainName+":", "*="), root)
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
var hook = require("./hook")
var camelcase = require("camelcase")

var storage = module.exports = {}
var components = []
var elements = []
var counter = 0

function remove (array, element) {
  var i = array.indexOf(element)
  if (~i) array.splice(i, 1)
}

function createProperty (componentName) {
  return camelcase(componentName+"-id")
}

function getId (element, componentName) {
  return element.dataset[createProperty(componentName)]
}

function setId (element, componentName, id) {
  element.dataset[createProperty(componentName)] = id
}

function hasId (element, componentName) {
  return !!(element.dataset[createProperty(componentName)])
}

function removeId (element, componentName) {
  if (hasId(element, componentName)) {
    delete element.dataset[createProperty(componentName)]
  }
}

storage.get = function (element, componentName) {
  //componentName = componentName || hook.getComponentName(element, false)
  var store = components[getId(element, componentName)]
  return store ? store[componentName] : null
}
storage.save = function (component) {
  if (component.element) {
    var id = component._id
    var componentName = component.internals.name
    var store

    if (!id) {
      id = ++counter
      setId(component.element, componentName, id)
      component._id = id
    }

    store = components[id]
    if (!store) {
      store = components[id] = {length: 0}
    }

    if (store[componentName] !== component) {
      ++store.length
      store[componentName] = component
    }

    var existingElement = elements[id]
    if (existingElement) {
      removeId(existingElement, componentName)
      setId(component.element, componentName, id)
    }

    elements[id] = component.element
  }
}
storage.remove = function (component, onlyComponent) {
  var element = component instanceof Element
      ? component
      : component.element
  var componentName = component.internals.name
  var id = getId(element, componentName)
  var store = components[id]

  if (component instanceof Element) {
    if (onlyComponent) {
      if (delete store[onlyComponent]) --store.length
    }
    else {
      for (var prop in store) {
        if (store.hasOwnProperty(id)) {
          store[prop]._id = null
          //--store.length
        }
      }
      delete components[id]
    }
  }
  else {
    var existing = store[componentName]
    if (existing == component) {
      existing._id = null
      delete store[componentName]
      --store.length
    }
  }

  if (store && !store.length) {
    removeId(elements[id], componentName)
    delete elements[id]
  }
}


},{"./hook":8,"camelcase":2}],12:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9zcmMvaG9va1wiKVxudmFyIHJlZ2lzdGVyID0gcmVxdWlyZShcIi4vc3JjL3JlZ2lzdGVyXCIpXG52YXIgY29tcG9uZW50ID0gcmVxdWlyZShcIi4vc3JjL2NyZWF0ZVwiKVxudmFyIHN0b3JhZ2UgPSByZXF1aXJlKFwiLi9zcmMvc3RvcmFnZVwiKVxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9Db21wb25lbnRcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL3NyYy9kZWxlZ2F0ZVwiKVxudmFyIGZyYWdtZW50ID0gcmVxdWlyZShcIi4vc3JjL2ZyYWdtZW50XCIpXG5cbnZhciB0cmVhbnQgPSB7fVxubW9kdWxlLmV4cG9ydHMgPSB0cmVhbnRcblxudHJlYW50LnJlZ2lzdGVyID0gcmVnaXN0ZXJcbnRyZWFudC5jb21wb25lbnQgPSBjb21wb25lbnRcbnRyZWFudC5zdG9yYWdlID0gc3RvcmFnZVxudHJlYW50LkNvbXBvbmVudCA9IENvbXBvbmVudFxudHJlYW50LmRlbGVnYXRlID0gZGVsZWdhdGVcbnRyZWFudC5mcmFnbWVudCA9IGZyYWdtZW50XG50cmVhbnQuaG9vayA9IGhvb2tcblxudmFyIHV0aWwgPSB7fVxudHJlYW50LnV0aWwgPSB1dGlsXG5cbnV0aWwuZXh0ZW5kID0gcmVxdWlyZShcIi4vdXRpbC9leHRlbmRcIilcbnV0aWwubWVyZ2UgPSByZXF1aXJlKFwiLi91dGlsL21lcmdlXCIpXG51dGlsLm9iamVjdCA9IHJlcXVpcmUoXCIuL3V0aWwvb2JqZWN0XCIpXG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzdHIpIHtcblx0c3RyID0gc3RyLnRyaW0oKTtcblxuXHRpZiAoc3RyLmxlbmd0aCA9PT0gMSB8fCAhKC9bXy5cXC0gXSsvKS50ZXN0KHN0cikgKSB7XG5cdFx0aWYgKHN0clswXSA9PT0gc3RyWzBdLnRvTG93ZXJDYXNlKCkgJiYgc3RyLnNsaWNlKDEpICE9PSBzdHIuc2xpY2UoMSkudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRyZXR1cm4gc3RyXG5cdC5yZXBsYWNlKC9eW18uXFwtIF0rLywgJycpXG5cdC50b0xvd2VyQ2FzZSgpXG5cdC5yZXBsYWNlKC9bXy5cXC0gXSsoXFx3fCQpL2csIGZ1bmN0aW9uIChtLCBwMSkge1xuXHRcdHJldHVybiBwMS50b1VwcGVyQ2FzZSgpO1xuXHR9KTtcbn07XG4iLCJ2YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcbnZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoXCIuL3N0b3JhZ2VcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL2RlbGVnYXRlXCIpXG52YXIgSW50ZXJuYWxzID0gcmVxdWlyZShcIi4vSW50ZXJuYWxzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gQ29tcG9uZW50XG5cbmZ1bmN0aW9uIENvbXBvbmVudCAoZWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAoZWxlbWVudCAmJiAhKGVsZW1lbnQgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcImVsZW1lbnQgc2hvdWxkIGJlIGFuIEVsZW1lbnQgaW5zdGFuY2Ugb3IgbnVsbFwiKVxuICB9XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBDb21wb25lbnQpKSB7XG4gICAgcmV0dXJuIG5ldyBDb21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgfVxuXG4gIHRoaXMuX2VsZW1lbnQgPSBudWxsXG4gIHRoaXMuX2lkID0gbnVsbFxuICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50IHx8IG51bGxcbiAgdGhpcy5jb21wb25lbnRzID0ge31cblxuICB0aGlzLmluaXRpYWxpemUoKVxufVxuXG5Db21wb25lbnQuY3JlYXRlID0gZnVuY3Rpb24gKG5hbWUsIGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgdmFyIENvbXBvbmVudENvbnN0cnVjdG9yID0gbnVsbFxuXG4gIGlmIChyZWdpc3RyeS5leGlzdHMobmFtZSkpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IHJlZ2lzdHJ5LmdldChuYW1lKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIk1pc3NpbmcgY29tcG9uZW50IGRlZmluaXRpb246IFwiLCBuYW1lKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICByZXR1cm4gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbkNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG4gIGludGVybmFsczogbmV3IEludGVybmFscygpLFxuXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIXRoaXMuZWxlbWVudCkgcmV0dXJuXG5cbiAgICBpZiAodGhpcy5pbnRlcm5hbHMuYXV0b0Fzc2lnbikge1xuICAgICAgdGhpcy5hc3NpZ25TdWJDb21wb25lbnRzKClcbiAgICB9XG4gICAgdGhpcy5pbnRlcm5hbHMucmVzZXRBdHRyaWJ1dGVzKHRoaXMpXG4gIH0sXG4gIGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcbiAgICBzdG9yYWdlLnJlbW92ZSh0aGlzKVxuICAgIHRoaXMuZWxlbWVudCA9IG51bGxcblxuICAgIHZhciBjb21wb25lbnRzID0gdGhpcy5jb21wb25lbnRzXG4gICAgdmFyIGNvbXBvbmVudFxuICAgIGZvciAodmFyIG5hbWUgaW4gY29tcG9uZW50cykge1xuICAgICAgaWYgKGNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgY29tcG9uZW50ID0gY29tcG9uZW50c1tuYW1lXVxuICAgICAgICBpZiAoY29tcG9uZW50LmRlc3Ryb3kpIHtcbiAgICAgICAgICBjb21wb25lbnQuZGVzdHJveSgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jb21wb25lbnRzID0gbnVsbFxuICB9LFxuXG4gIGRlbGVnYXRlOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuZWxlbWVudCA9IHRoaXMuZWxlbWVudFxuICAgIG9wdGlvbnMuY29udGV4dCA9IG9wdGlvbnMuY29udGV4dCB8fCB0aGlzXG4gICAgcmV0dXJuIGRlbGVnYXRlKG9wdGlvbnMpXG4gIH0sXG5cbiAgZGlzcGF0Y2g6IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IHRoaXMuaW50ZXJuYWxzLmdldEV2ZW50RGVmaW5pdGlvbih0eXBlLCBkZXRhaWwpXG4gICAgcmV0dXJuIHRoaXMuZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQodHlwZSwgZGVmaW5pdGlvbikpXG4gIH0sXG5cbiAgZmluZENvbXBvbmVudDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kQ29tcG9uZW50KG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZEFsbENvbXBvbmVudHM6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZEFsbENvbXBvbmVudHMobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBob29rLmZpbmRTdWJDb21wb25lbnRzKHRoaXMuZ2V0TWFpbkNvbXBvbmVudE5hbWUoZmFsc2UpLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGdldENvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldENvbXBvbmVudE5hbWUodGhpcy5pbnRlcm5hbHMubmFtZSwgY2MpXG4gIH0sXG4gIGdldE1haW5Db21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSh0aGlzLmludGVybmFscy5uYW1lLCBjYylcbiAgfSxcbiAgZ2V0U3ViQ29tcG9uZW50TmFtZTogZnVuY3Rpb24gKGNjKSB7XG4gICAgcmV0dXJuIGhvb2suZ2V0U3ViQ29tcG9uZW50TmFtZSh0aGlzLmludGVybmFscy5uYW1lLCBjYylcbiAgfSxcblxuICBjbGVhclN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaW50ZXJuYWxzID0gdGhpcy5pbnRlcm5hbHNcblxuICAgIGZvciAodmFyIG5hbWUgaW4gaW50ZXJuYWxzLmNvbXBvbmVudHMpIHtcbiAgICAgIGlmIChpbnRlcm5hbHMuY29tcG9uZW50cy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpbnRlcm5hbHMuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgICB0aGlzLmNvbXBvbmVudHNbbmFtZV0gPSBbXVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuY29tcG9uZW50c1tuYW1lXSA9IGludGVybmFscy5jb21wb25lbnRzW25hbWVdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIGFzc2lnblN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICh0cmFuc2Zvcm0pIHtcbiAgICBpZiAoIXRoaXMuZWxlbWVudCkgcmV0dXJuXG5cbiAgICB2YXIgaG9zdENvbXBvbmVudCA9IHRoaXNcbiAgICB2YXIgc3ViQ29tcG9uZW50cyA9IHRoaXMuZmluZFN1YkNvbXBvbmVudHMoKVxuICAgIHZhciBpbnRlcm5hbHMgPSB0aGlzLmludGVybmFsc1xuXG4gICAgdGhpcy5jbGVhclN1YkNvbXBvbmVudHMoKVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0cmFuc2Zvcm0gPT0gXCJ1bmRlZmluZWRcIiB8fCB0cmFuc2Zvcm0gPT09IHRydWUpIHtcbiAgICAgIHRyYW5zZm9ybSA9IGZ1bmN0aW9uIChlbGVtZW50LCBuYW1lKSB7XG4gICAgICAgIHJldHVybiByZWdpc3RyeS5leGlzdHMobmFtZSlcbiAgICAgICAgICAgID8gQ29tcG9uZW50LmNyZWF0ZShuYW1lLCBlbGVtZW50LCBob3N0Q29tcG9uZW50KVxuICAgICAgICAgICAgOiBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuXG4gICAgaG9vay5hc3NpZ25TdWJDb21wb25lbnRzKHRoaXMuY29tcG9uZW50cywgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBmdW5jdGlvbiAoY29tcG9uZW50cywgbmFtZSwgZWxlbWVudCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW50ZXJuYWxzLmNvbXBvbmVudHNbbmFtZV0pKSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBjb21wb25lbnRzW25hbWVdIHx8IFtdXG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudHNbbmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ29tcG9uZW50LnByb3RvdHlwZSwgXCJlbGVtZW50XCIsIHtcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2VsZW1lbnRcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50XG4gICAgaWYgKGVsZW1lbnQgJiYgdGhpcy5pbnRlcm5hbHMubmFtZSkgc3RvcmFnZS5zYXZlKHRoaXMpXG4gIH1cbn0pXG4iLCJ2YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxudmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuLi91dGlsL2V4dGVuZFwiKVxudmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcbnZhciBvYmplY3QgPSByZXF1aXJlKFwiLi4vdXRpbC9vYmplY3RcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL2RlbGVnYXRlXCIpXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoXCIuL3N0b3JhZ2VcIilcbnZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxuXG52YXIgZGVmYXVsdEV2ZW50RGVmaW5pdGlvbiA9IHtcbiAgZGV0YWlsOiBudWxsLFxuICB2aWV3OiB3aW5kb3csXG4gIGJ1YmJsZXM6IHRydWUsXG4gIGNhbmNlbGFibGU6IHRydWVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBJbnRlcm5hbHNcblxuZnVuY3Rpb24gSW50ZXJuYWxzIChtYXN0ZXIsIG5hbWUpIHtcbiAgdGhpcy5uYW1lID0gbmFtZVxuICB0aGlzLmF1dG9Bc3NpZ24gPSB0cnVlXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIHRoaXMuX2V2ZW50cyA9IHt9XG4gIHRoaXMuX2NvbnN0cnVjdG9ycyA9IFtdXG4gIHRoaXMuX2F0dHJpYnV0ZXMgPSB7fVxuICB0aGlzLl9hY3Rpb25zID0gW11cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJfbWFzdGVyQ29uc3RydWN0b3JcIiwge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG1hc3RlclxuICAgIH1cbiAgfSlcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiX21hc3RlclwiLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gbWFzdGVyLnByb3RvdHlwZVxuICAgIH1cbiAgfSlcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5leHRlbmQgPSBmdW5jdGlvbiAoQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgdGhpcy5fbWFzdGVyQ29uc3RydWN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDb21wb25lbnRDb25zdHJ1Y3Rvci5wcm90b3R5cGUpXG4gIHRoaXMuX21hc3RlckNvbnN0cnVjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IHRoaXMuX21hc3RlckNvbnN0cnVjdG9yXG4gIHZhciBpbnRlcm5hbHMgPSBDb21wb25lbnRDb25zdHJ1Y3Rvci5pbnRlcm5hbHNcbiAgdGhpcy5fbWFzdGVyQ29uc3RydWN0b3IucHJvdG90eXBlLmludGVybmFscyA9IHRoaXNcbiAgdGhpcy5fbWFzdGVyQ29uc3RydWN0b3IuaW50ZXJuYWxzID0gdGhpc1xuICBpZiAoaW50ZXJuYWxzKSB7XG4gICAgdGhpcy5hdXRvQXNzaWduID0gaW50ZXJuYWxzLmF1dG9Bc3NpZ25cbiAgICBleHRlbmQodGhpcy5jb21wb25lbnRzLCBpbnRlcm5hbHMuY29tcG9uZW50cylcbiAgICBleHRlbmQodGhpcy5fZXZlbnRzLCBpbnRlcm5hbHMuX2V2ZW50cylcbiAgICB0aGlzLl9jb25zdHJ1Y3RvcnMgPSB0aGlzLl9jb25zdHJ1Y3RvcnMuY29uY2F0KGludGVybmFscy5fY29uc3RydWN0b3JzKVxuICAgIGV4dGVuZCh0aGlzLl9hdHRyaWJ1dGVzLCBpbnRlcm5hbHMuX2F0dHJpYnV0ZXMpXG4gICAgaW50ZXJuYWxzLl9hY3Rpb25zLmZvckVhY2goZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICAgIHZhciBldmVudCA9IGFyZ3NbMF1cbiAgICAgIHZhciBtYXRjaGVzID0gYXJnc1sxXVxuICAgICAgdmFyIG1hdGNoZXIgPSB0aGlzLmFjdGlvbi5jYWxsKHRoaXMsIGV2ZW50KVxuICAgICAgbWF0Y2hlcy5mb3JFYWNoKGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgICAgIG1hdGNoZXIubWF0Y2guYXBwbHkobWF0Y2hlciwgYXJncylcbiAgICAgIH0pXG4gICAgfSwgdGhpcylcbiAgfVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLm9uQ3JlYXRlID0gZnVuY3Rpb24gKGNvbnN0cnVjdG9yKSB7XG4gIHRoaXMuX2NvbnN0cnVjdG9ycy5wdXNoKGNvbnN0cnVjdG9yKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmNyZWF0ZSA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgYXJncykge1xuICB0aGlzLl9jb25zdHJ1Y3RvcnMuZm9yRWFjaChmdW5jdGlvbiAoY29uc3RydWN0b3IpIHtcbiAgICBjb25zdHJ1Y3Rvci5hcHBseShpbnN0YW5jZSwgYXJncylcbiAgfSlcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5tZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgb2JqZWN0Lm1ldGhvZCh0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLnByb3BlcnR5ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5wcm9wZXJ0eSh0aGlzLl9tYXN0ZXIsIG5hbWUsIGZuKVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICBvYmplY3QuZGVmaW5lR2V0dGVyKHRoaXMuX21hc3RlciwgbmFtZSwgZm4pXG4gIHJldHVybiB0aGlzXG59XG5cbkludGVybmFscy5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gIG9iamVjdC5kZWZpbmVHZXR0ZXIodGhpcy5fbWFzdGVyLCBuYW1lLCBmbilcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5hY2Nlc3NvciA9IGZ1bmN0aW9uIChuYW1lLCBnZXQsIHNldCkge1xuICBvYmplY3QuYWNjZXNzb3IodGhpcy5fbWFzdGVyLCBuYW1lLCBnZXQsIHNldClcbiAgcmV0dXJuIHRoaXNcbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5wcm90byA9IGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgZm9yICh2YXIgcHJvcCBpbiBwcm90b3R5cGUpIHtcbiAgICBpZiAocHJvdG90eXBlLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICBpZiAodHlwZW9mIHByb3RvdHlwZVtwcm9wXSA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgaWYgKHByb3AgPT09IFwib25DcmVhdGVcIikge1xuICAgICAgICAgIHRoaXMub25DcmVhdGUocHJvdG90eXBlW3Byb3BdKVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMubWV0aG9kKHByb3AsIHByb3RvdHlwZVtwcm9wXSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHRoaXMucHJvcGVydHkocHJvcCwgcHJvdG90eXBlW3Byb3BdKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmFjdGlvbiA9IGZ1bmN0aW9uIGFjdGlvbihldmVudCkge1xuICB2YXIgaW50ZXJuYWxzID0gdGhpc1xuICB2YXIgYXR0cmlidXRlTmFtZSA9IGludGVybmFscy5uYW1lXG4gIHZhciBtYXRjaGVyID0ge31cbiAgdmFyIG1hdGNoZXMgPSBbXVxuICB2YXIgZGVsZWdhdG9yID0gZGVsZWdhdGUoe2VsZW1lbnQ6IGRvY3VtZW50LmJvZHksIGV2ZW50OiBldmVudH0pXG5cbiAgaW50ZXJuYWxzLl9hY3Rpb25zLnB1c2goW2V2ZW50LCBtYXRjaGVzXSlcblxuICBtYXRjaGVyLm1hdGNoID0gZnVuY3Rpb24gKGNvbXBvbmVudHMsIGNiKSB7XG4gICAgbWF0Y2hlcy5wdXNoKFtjb21wb25lbnRzLCBjYl0pXG5cbiAgICBpZiAoIWNiKSB7XG4gICAgICBjYiA9IGNvbXBvbmVudHNcbiAgICAgIGNvbXBvbmVudHMgPSBbXVxuICAgIH1cblxuICAgIGlmICh0eXBlb2YgY29tcG9uZW50cyA9PSBcInN0cmluZ1wiKSB7XG4gICAgICBjb21wb25lbnRzID0gW2NvbXBvbmVudHNdXG4gICAgfVxuXG4gICAgdmFyIHNlbGVjdG9ycyA9IGNvbXBvbmVudHMubWFwKGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgICAgIGlmIChjb21wb25lbnRbMF0gPT0gXCI6XCIpIHtcbiAgICAgICAgY29tcG9uZW50ID0gYXR0cmlidXRlTmFtZStjb21wb25lbnRcbiAgICAgIH1cbiAgICAgIHJldHVybiBob29rLnNlbGVjdG9yKGNvbXBvbmVudCwgXCJ+PVwiKVxuICAgIH0pXG4gICAgc2VsZWN0b3JzLnVuc2hpZnQoaG9vay5zZWxlY3RvcihhdHRyaWJ1dGVOYW1lLCBcIn49XCIpKVxuXG4gICAgZGVsZWdhdG9yLm1hdGNoKHNlbGVjdG9ycywgZnVuY3Rpb24gKGUsIG1haW4pIHtcbiAgICAgIHZhciBpbnN0YW5jZSA9IHN0b3JhZ2UuZ2V0KG1haW4sIGludGVybmFscy5uYW1lKSB8fCBtYWluXG4gICAgICB2YXIgYXJncyA9IFtlXTtcblxuICAgICAgW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpLmZvckVhY2goZnVuY3Rpb24gKGVsZW1lbnQsIGkpIHtcbiAgICAgICAgdmFyIG5hbWUgPSBjb21wb25lbnRzW2ldXG4gICAgICAgIG5hbWUgPSBuYW1lWzBdID09IFwiOlwiID8gbmFtZS5zdWJzdHIoMSkgOiBuYW1lXG4gICAgICAgIHZhciBwcm9wZXJ0eU5hbWUgPSBjYW1lbGNhc2UobmFtZSlcbiAgICAgICAgdmFyIGFyZ1xuXG4gICAgICAgIGlmIChpbnN0YW5jZS5jb21wb25lbnRzLmhhc093blByb3BlcnR5KHByb3BlcnR5TmFtZSkpIHtcbiAgICAgICAgICBhcmcgPSBpbnN0YW5jZS5jb21wb25lbnRzW3Byb3BlcnR5TmFtZV1cbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICAgICAgICBhcmcuc29tZShmdW5jdGlvbiAobWVtYmVyKSB7XG4gICAgICAgICAgICAgIGlmIChtZW1iZXIgPT0gZWxlbWVudCB8fCBtZW1iZXIuZWxlbWVudCA9PSBlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgYXJnID0gbWVtYmVyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIGFyZyA9IHN0b3JhZ2UuZ2V0KGVsZW1lbnQsIG5hbWUpIHx8IGVsZW1lbnRcbiAgICAgICAgfVxuXG4gICAgICAgIGFyZ3MucHVzaChhcmcpXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gY2IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gICAgfSlcblxuICAgIHJldHVybiBtYXRjaGVyXG4gIH1cblxuICByZXR1cm4gbWF0Y2hlclxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmV2ZW50ID0gZnVuY3Rpb24gKHR5cGUsIGRlZmluaXRpb24pIHtcbiAgdGhpcy5fZXZlbnRzW3R5cGVdID0gZGVmaW5pdGlvblxuICByZXR1cm4gdGhpc1xufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmdldEV2ZW50RGVmaW5pdGlvbiA9IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgdmFyIGRlZmluaXRpb24gPSBtZXJnZShkZWZhdWx0RXZlbnREZWZpbml0aW9uLCB0aGlzLl9ldmVudHNbdHlwZV0pXG4gIGRlZmluaXRpb24uZGV0YWlsID0gdHlwZW9mIGRldGFpbCA9PSBcInVuZGVmaW5lZFwiID8gZGVmaW5pdGlvbi5kZXRhaWwgOiBkZXRhaWxcbiAgcmV0dXJuIGRlZmluaXRpb25cbn1cblxuSW50ZXJuYWxzLnByb3RvdHlwZS5yZXNldEF0dHJpYnV0ZXMgPSBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcbiAgaWYgKCFpbnN0YW5jZS5lbGVtZW50KSByZXR1cm5cblxuICB2YXIgYXR0cmlidXRlXG4gIHZhciB2YWx1ZVxuICBmb3IgKHZhciBuYW1lIGluIHRoaXMuX2F0dHJpYnV0ZXMpIHtcbiAgICBpZiAodGhpcy5fYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgYXR0cmlidXRlID0gdGhpcy5fYXR0cmlidXRlc1tuYW1lXVxuICAgICAgdmFsdWUgPSBhdHRyaWJ1dGUuZ2V0LmNhbGwoaW5zdGFuY2UsIGZhbHNlKVxuICAgICAgaWYgKGF0dHJpYnV0ZS5oYXNEZWZhdWx0ICYmICFhdHRyaWJ1dGUuaGFzLmNhbGwoaW5zdGFuY2UsIHZhbHVlKSkge1xuICAgICAgICBhdHRyaWJ1dGUuc2V0LmNhbGwoaW5zdGFuY2UsIGF0dHJpYnV0ZS5kZWZhdWx0VmFsdWUsIGZhbHNlKVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5JbnRlcm5hbHMucHJvdG90eXBlLmF0dHJpYnV0ZSA9IGZ1bmN0aW9uIChuYW1lLCBkZWYpIHtcbiAgdmFyIG1hc3RlciA9IHRoaXMuX21hc3RlclxuICBpZiAoIW1hc3Rlcikge1xuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBpZiAoZGVmID09IG51bGwpIHtcbiAgICBkZWYgPSB7fVxuICB9XG5cbiAgdmFyIHR5cGVPZkRlZiA9IHR5cGVvZiBkZWZcbiAgdmFyIHR5cGVcbiAgdmFyIGRlZmF1bHRWYWx1ZVxuICB2YXIgZ2V0dGVyXG4gIHZhciBzZXR0ZXJcbiAgdmFyIG9uY2hhbmdlXG4gIHZhciBwcm9wZXJ0eSA9IGNhbWVsY2FzZShuYW1lKVxuXG4gIHN3aXRjaCAodHlwZU9mRGVmKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgLy8gdGhlIGRlZmluaXRpb24gaXMgYSBwcmltaXRpdmUgdmFsdWVcbiAgICAgIHR5cGUgPSB0eXBlT2ZEZWZcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IGRlZlxuICAgICAgYnJlYWtcbiAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIG9yIGEgZGVmaW5pdGlvbiBvYmplY3RcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHR5cGVvZiBkZWZbXCJkZWZhdWx0XCJdID09IFwidW5kZWZpbmVkXCIgPyBudWxsIDogZGVmW1wiZGVmYXVsdFwiXVxuICAgICAgaWYgKHR5cGVvZiBkZWZbXCJ0eXBlXCJdID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKGRlZmF1bHRWYWx1ZSA9PSBudWxsKSB7XG4gICAgICAgICAgdHlwZSA9IFwic3RyaW5nXCJcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB0eXBlID0gdHlwZW9mIGRlZmF1bHRWYWx1ZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdHlwZSA9IGRlZltcInR5cGVcIl1cbiAgICAgIH1cbiAgICAgIGdldHRlciA9IGRlZltcImdldFwiXVxuICAgICAgc2V0dGVyID0gZGVmW1wic2V0XCJdXG4gICAgICBvbmNoYW5nZSA9IGRlZltcIm9uY2hhbmdlXCJdXG4gIH1cblxuICB2YXIgcGFyc2VWYWx1ZVxuICB2YXIgc3RyaW5naWZ5VmFsdWVcbiAgdmFyIGhhc1xuXG4gIGhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT0gbnVsbCB9XG5cbiAgc3dpdGNoICh0eXBlKSB7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIGhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT09IGZhbHNlIH1cbiAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlICE9IG51bGwgfVxuICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAoKSB7IHJldHVybiBcIlwiIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiBwYXJzZUludCh2YWx1ZSwgMTApIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcImZsb2F0XCI6XG4gICAgICBwYXJzZVZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7IHJldHVybiB2YWx1ZSA9PSBudWxsID8gbnVsbCA6IHBhcnNlRmxvYXQodmFsdWUpIH1cbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgIGRlZmF1bHQ6XG4gICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiB2YWx1ZSA/IFwiXCIrdmFsdWUgOiBcIlwiIH1cbiAgfVxuXG4gIHRoaXMuX2F0dHJpYnV0ZXNbcHJvcGVydHldID0ge1xuICAgIGdldDogZ2V0LFxuICAgIHNldDogc2V0LFxuICAgIGhhczogaGFzLFxuICAgIGRlZmF1bHRWYWx1ZTogZGVmYXVsdFZhbHVlLFxuICAgIGhhc0RlZmF1bHQ6IGRlZmF1bHRWYWx1ZSAhPSBudWxsXG4gIH1cblxuICBmdW5jdGlvbiBnZXQodXNlRGVmYXVsdCkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICBpZiAodmFsdWUgPT0gbnVsbCAmJiB1c2VEZWZhdWx0ID09IHRydWUpIHtcbiAgICAgIHJldHVybiBkZWZhdWx0VmFsdWVcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlVmFsdWUgPyBwYXJzZVZhbHVlKHZhbHVlKSA6IHZhbHVlXG4gIH1cblxuICBmdW5jdGlvbiBzZXQodmFsdWUsIGNhbGxPbmNoYW5nZSkge1xuICAgIHZhciBvbGQgPSBnZXQuY2FsbCh0aGlzLCBmYWxzZSlcbiAgICBpZiAoIWhhcyh2YWx1ZSkpIHtcbiAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUobmFtZSlcbiAgICB9XG4gICAgZWxzZSBpZiAob2xkID09PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIG5ld1ZhbHVlID0gc3RyaW5naWZ5VmFsdWUgPyBzdHJpbmdpZnlWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICAgICAgdGhpcy5lbGVtZW50LnNldEF0dHJpYnV0ZShuYW1lLCBuZXdWYWx1ZSlcbiAgICB9XG4gICAgb25jaGFuZ2UgJiYgY2FsbE9uY2hhbmdlICE9IGZhbHNlICYmIG9uY2hhbmdlLmNhbGwodGhpcywgb2xkLCB2YWx1ZSlcbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShtYXN0ZXIsIHByb3BlcnR5LCB7XG4gICAgZ2V0OiBnZXR0ZXIgfHwgZ2V0LFxuICAgIHNldDogc2V0dGVyIHx8IHNldFxuICB9KVxuXG4gIHJldHVybiB0aGlzXG59XG4iLCJ2YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjb21wb25lbnRcblxuZnVuY3Rpb24gY29tcG9uZW50IChuYW1lLCByb290LCBvcHRpb25zKSB7XG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywge31dKVxuICBpZiAoIShyb290IGluc3RhbmNlb2YgRWxlbWVudCkpIHtcbiAgICBvcHRpb25zID0gcm9vdFxuICAgIHJvb3QgPSBudWxsXG4gIH1cbiAgdmFyIGVsZW1lbnQgPSBob29rLmZpbmRDb21wb25lbnQobmFtZSwgcm9vdClcblxuICByZXR1cm4gQ29tcG9uZW50LmNyZWF0ZShuYW1lLCBlbGVtZW50LCBvcHRpb25zKVxufVxuXG5jb21wb25lbnQuYWxsID0gZnVuY3Rpb24gKG5hbWUsIHJvb3QsIG9wdGlvbnMpIHtcbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCB7fV0pXG4gIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIEVsZW1lbnRdKVxuICB2YXIgZWxlbWVudHMgPSBob29rLmZpbmRBbGxDb21wb25lbnRzKG5hbWUsIHJvb3QpXG5cbiAgcmV0dXJuIFtdLm1hcC5jYWxsKGVsZW1lbnRzLCBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgIHJldHVybiBDb21wb25lbnQuY3JlYXRlKG5hbWUsIGVsZW1lbnQsIG9wdGlvbnMpXG4gIH0pXG59XG4iLCIvKipcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciBvbiBhbiBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIGRlbGVnYXRvci5cbiAqIEEgZGVsZWdhdGVkIGV2ZW50IHJ1bnMgbWF0Y2hlcyB0byBmaW5kIGFuIGV2ZW50IHRhcmdldCxcbiAqIHRoZW4gZXhlY3V0ZXMgdGhlIGhhbmRsZXIgcGFpcmVkIHdpdGggdGhlIG1hdGNoZXIuXG4gKiBNYXRjaGVycyBjYW4gY2hlY2sgaWYgYW4gZXZlbnQgdGFyZ2V0IG1hdGNoZXMgYSBnaXZlbiBzZWxlY3RvcixcbiAqIG9yIHNlZSBpZiBhbiBvZiBpdHMgcGFyZW50cyBkby5cbiAqICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlbGVnYXRlKCBvcHRpb25zICl7XG4gICAgdmFyIGVsZW1lbnQgPSBvcHRpb25zLmVsZW1lbnRcbiAgICAgICAgLCBldmVudCA9IG9wdGlvbnMuZXZlbnRcbiAgICAgICAgLCBjYXB0dXJlID0gISFvcHRpb25zLmNhcHR1cmV8fGZhbHNlXG4gICAgICAgICwgY29udGV4dCA9IG9wdGlvbnMuY29udGV4dHx8ZWxlbWVudFxuXG4gICAgaWYoICFlbGVtZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGVsZW1lbnRcIilcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgaWYoICFldmVudCApe1xuICAgICAgICBjb25zb2xlLmxvZyhcIkNhbid0IGRlbGVnYXRlIHVuZGVmaW5lZCBldmVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIHZhciBkZWxlZ2F0b3IgPSBjcmVhdGVEZWxlZ2F0b3IoY29udGV4dClcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGRlbGVnYXRvciwgY2FwdHVyZSlcblxuICAgIHJldHVybiBkZWxlZ2F0b3Jcbn1cblxuLyoqXG4gKiBSZXR1cm5zIGEgZGVsZWdhdG9yIHRoYXQgY2FuIGJlIHVzZWQgYXMgYW4gZXZlbnQgbGlzdGVuZXIuXG4gKiBUaGUgZGVsZWdhdG9yIGhhcyBzdGF0aWMgbWV0aG9kcyB3aGljaCBjYW4gYmUgdXNlZCB0byByZWdpc3RlciBoYW5kbGVycy5cbiAqICovXG5mdW5jdGlvbiBjcmVhdGVEZWxlZ2F0b3IoIGNvbnRleHQgKXtcbiAgICB2YXIgbWF0Y2hlcnMgPSBbXVxuXG4gICAgZnVuY3Rpb24gZGVsZWdhdG9yKCBlICl7XG4gICAgICAgIHZhciBsID0gbWF0Y2hlcnMubGVuZ3RoXG4gICAgICAgIGlmKCAhbCApe1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBlbCA9IHRoaXNcbiAgICAgICAgICAgICwgaSA9IC0xXG4gICAgICAgICAgICAsIGhhbmRsZXJcbiAgICAgICAgICAgICwgc2VsZWN0b3JcbiAgICAgICAgICAgICwgZGVsZWdhdGVFbGVtZW50XG4gICAgICAgICAgICAsIHN0b3BQcm9wYWdhdGlvblxuICAgICAgICAgICAgLCBhcmdzXG5cbiAgICAgICAgd2hpbGUoICsraSA8IGwgKXtcbiAgICAgICAgICAgIGFyZ3MgPSBtYXRjaGVyc1tpXVxuICAgICAgICAgICAgaGFuZGxlciA9IGFyZ3NbMF1cbiAgICAgICAgICAgIHNlbGVjdG9yID0gYXJnc1sxXVxuXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBtYXRjaENhcHR1cmVQYXRoKHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCBkZWxlZ2F0ZUVsZW1lbnQgJiYgZGVsZWdhdGVFbGVtZW50Lmxlbmd0aCApIHtcbiAgICAgICAgICAgICAgICBzdG9wUHJvcGFnYXRpb24gPSBmYWxzZSA9PT0gaGFuZGxlci5hcHBseShjb250ZXh0LCBbZV0uY29uY2F0KGRlbGVnYXRlRWxlbWVudCkpXG4gICAgICAgICAgICAgICAgaWYoIHN0b3BQcm9wYWdhdGlvbiApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBoYW5kbGVyIHdpdGggYSB0YXJnZXQgZmluZGVyIGxvZ2ljXG4gICAgICogKi9cbiAgICBkZWxlZ2F0b3IubWF0Y2ggPSBmdW5jdGlvbiggc2VsZWN0b3IsIGhhbmRsZXIgKXtcbiAgICAgICAgbWF0Y2hlcnMucHVzaChbaGFuZGxlciwgc2VsZWN0b3JdKVxuICAgICAgICByZXR1cm4gZGVsZWdhdG9yXG4gICAgfVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG5mdW5jdGlvbiBtYXRjaENhcHR1cmVQYXRoKCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50cyA9IFtdXG4gICAgdmFyIGRlbGVnYXRlRWxlbWVudCA9IG51bGxcbiAgICBpZiggQXJyYXkuaXNBcnJheShzZWxlY3RvcikgKXtcbiAgICAgICAgdmFyIGkgPSAtMVxuICAgICAgICB2YXIgbCA9IHNlbGVjdG9yLmxlbmd0aFxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgZGVsZWdhdGVFbGVtZW50ID0gZmluZFBhcmVudChzZWxlY3RvcltpXSwgZWwsIGUpXG4gICAgICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yLCBlbCwgZSlcbiAgICAgICAgaWYoICFkZWxlZ2F0ZUVsZW1lbnQgKSByZXR1cm4gbnVsbFxuICAgICAgICBkZWxlZ2F0ZUVsZW1lbnRzLnB1c2goZGVsZWdhdGVFbGVtZW50KVxuICAgIH1cbiAgICByZXR1cm4gZGVsZWdhdGVFbGVtZW50c1xufVxuXG4vKipcbiAqIENoZWNrIGlmIHRoZSB0YXJnZXQgb3IgYW55IG9mIGl0cyBwYXJlbnQgbWF0Y2hlcyBhIHNlbGVjdG9yXG4gKiAqL1xuZnVuY3Rpb24gZmluZFBhcmVudCggc2VsZWN0b3IsIGVsLCBlICl7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0XG4gICAgc3dpdGNoKCB0eXBlb2Ygc2VsZWN0b3IgKXtcbiAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggdGFyZ2V0Lm1hdGNoZXMoc2VsZWN0b3IpICkgcmV0dXJuIHRhcmdldFxuICAgICAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgICAgICAgIHdoaWxlKCB0YXJnZXQgJiYgdGFyZ2V0ICE9IGVsICl7XG4gICAgICAgICAgICAgICAgaWYoIHNlbGVjdG9yLmNhbGwoZWwsIHRhcmdldCkgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICByZXR1cm4gbnVsbFxufVxuIiwidmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmcmFnbWVudFxuXG5mcmFnbWVudC5vcHRpb25zID0ge1xuICB2YXJpYWJsZTogXCJmXCJcbn1cblxuZnVuY3Rpb24gZnJhZ21lbnQoIGh0bWwsIGNvbXBpbGVyLCBjb21waWxlck9wdGlvbnMgKXtcbiAgY29tcGlsZXJPcHRpb25zID0gbWVyZ2UoZnJhZ21lbnQub3B0aW9ucywgY29tcGlsZXJPcHRpb25zKVxuICB2YXIgcmVuZGVyID0gbnVsbFxuICByZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlRGF0YSApe1xuICAgIHZhciB0ZW1wID0gd2luZG93LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIilcbiAgICBpZiggdHlwZW9mIGNvbXBpbGVyID09IFwiZnVuY3Rpb25cIiAmJiAhcmVuZGVyICl7XG4gICAgICByZW5kZXIgPSBjb21waWxlcihodG1sLCBjb21waWxlck9wdGlvbnMpXG4gICAgfVxuICAgIGlmKCByZW5kZXIgKXtcbiAgICAgIHRyeXtcbiAgICAgICAgaHRtbCA9IHJlbmRlcih0ZW1wbGF0ZURhdGEpXG4gICAgICB9XG4gICAgICBjYXRjaCggZSApe1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmVuZGVyaW5nIGZyYWdtZW50IHdpdGggY29udGV4dDpcIiwgdGVtcGxhdGVEYXRhKVxuICAgICAgICBjb25zb2xlLmVycm9yKHJlbmRlci50b1N0cmluZygpKVxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0ZW1wLmlubmVySFRNTCA9IGh0bWxcbiAgICB2YXIgZnJhZ21lbnQgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXG4gICAgd2hpbGUoIHRlbXAuY2hpbGROb2Rlcy5sZW5ndGggKXtcbiAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRlbXAuZmlyc3RDaGlsZClcbiAgICB9XG4gICAgcmV0dXJuIGZyYWdtZW50XG4gIH1cbn1cbmZyYWdtZW50LnJlbmRlciA9IGZ1bmN0aW9uKCBodG1sLCB0ZW1wbGF0ZURhdGEgKXtcbiAgcmV0dXJuIGZyYWdtZW50KGh0bWwpKHRlbXBsYXRlRGF0YSlcbn1cbiIsInZhciBjYW1lbGNhc2UgPSByZXF1aXJlKFwiY2FtZWxjYXNlXCIpXG52YXIgQ09NUE9ORU5UX0FUVFJJQlVURSA9IFwiZGF0YS1jb21wb25lbnRcIlxuXG52YXIgaG9vayA9IG1vZHVsZS5leHBvcnRzID0ge31cblxuaG9vay5zZXRIb29rQXR0cmlidXRlID0gc2V0SG9va0F0dHJpYnV0ZVxuaG9vay5zZWxlY3RvciA9IHNlbGVjdG9yXG5ob29rLmZpbmRDb21wb25lbnQgPSBmaW5kQ29tcG9uZW50XG5ob29rLmZpbmRBbGxDb21wb25lbnRzID0gZmluZEFsbENvbXBvbmVudHNcbmhvb2suZmluZFN1YkNvbXBvbmVudHMgPSBmaW5kU3ViQ29tcG9uZW50c1xuaG9vay5nZXRDb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZVxuaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSA9IGdldE1haW5Db21wb25lbnROYW1lXG5ob29rLmdldFN1YkNvbXBvbmVudE5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lXG5ob29rLmFzc2lnblN1YkNvbXBvbmVudHMgPSBhc3NpZ25TdWJDb21wb25lbnRzXG5ob29rLmZpbHRlciA9IGZpbHRlclxuXG5mdW5jdGlvbiBzZXRIb29rQXR0cmlidXRlIChob29rKSB7XG4gIENPTVBPTkVOVF9BVFRSSUJVVEUgPSBob29rXG59XG5cbmZ1bmN0aW9uIHNlbGVjdG9yIChuYW1lLCBvcGVyYXRvciwgZXh0cmEpIHtcbiAgbmFtZSA9IG5hbWUgJiYgJ1wiJyArIG5hbWUgKyAnXCInXG4gIG9wZXJhdG9yID0gbmFtZSA/IG9wZXJhdG9yIHx8IFwiPVwiIDogXCJcIlxuICBleHRyYSA9IGV4dHJhIHx8IFwiXCJcbiAgcmV0dXJuIFwiW1wiICsgQ09NUE9ORU5UX0FUVFJJQlVURSArIG9wZXJhdG9yICsgbmFtZSArIFwiXVwiICsgZXh0cmFcbn1cblxuZnVuY3Rpb24gZmluZCAoc2VsZWN0b3IsIHJvb3QpIHtcbiAgcmV0dXJuIChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKVxufVxuXG5mdW5jdGlvbiBmaW5kQWxsIChzZWxlY3Rvciwgcm9vdCkge1xuICByZXR1cm4gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpXG59XG5cbmZ1bmN0aW9uIGZpbmRDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIGZpbmQoc2VsZWN0b3IobmFtZSksIHJvb3QpXG59XG5cbmZ1bmN0aW9uIGZpbmRBbGxDb21wb25lbnRzIChuYW1lLCByb290KSB7XG4gIHJldHVybiBbXS5zbGljZS5jYWxsKGZpbmRBbGwoc2VsZWN0b3IobmFtZSksIHJvb3QpKVxufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBpZiAoIWVsZW1lbnQpIHJldHVybiBcIlwiXG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IHR5cGVvZiBlbGVtZW50ID09IFwic3RyaW5nXCIgPyBlbGVtZW50IDogZWxlbWVudC5nZXRBdHRyaWJ1dGUoQ09NUE9ORU5UX0FUVFJJQlVURSkgfHwgXCJcIlxuICByZXR1cm4gY2MgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0TWFpbkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzBdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldFN1YkNvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGNjID0gY2MgPT0gdW5kZWZpbmVkIHx8IGNjXG4gIHZhciB2YWx1ZSA9IGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLnNwbGl0KFwiOlwiKVxuICB2YWx1ZSA9IHZhbHVlWzFdIHx8IFwiXCJcbiAgcmV0dXJuIGNjICYmIHZhbHVlID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWVMaXN0IChlbGVtZW50LCBjYykge1xuICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBjYykuc3BsaXQoL1xccysvKVxufVxuXG5mdW5jdGlvbiBmaW5kU3ViQ29tcG9uZW50cyAobWFpbk5hbWUsIHJvb3QpIHtcbiAgdmFyIGVsZW1lbnRzID0gZmluZEFsbChzZWxlY3RvcihtYWluTmFtZStcIjpcIiwgXCIqPVwiKSwgcm9vdClcbiAgcmV0dXJuIGZpbHRlcihlbGVtZW50cywgZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIHtcbiAgICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZUxpc3QoY29tcG9uZW50TmFtZSwgZmFsc2UpLnNvbWUoZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHJldHVybiBnZXRNYWluQ29tcG9uZW50TmFtZShuYW1lLCBmYWxzZSkgPT0gbWFpbk5hbWUgJiYgZ2V0U3ViQ29tcG9uZW50TmFtZShuYW1lKVxuICAgIH0pXG4gIH0pXG59XG5cbmZ1bmN0aW9uIGFzc2lnblN1YkNvbXBvbmVudHMgKG9iaiwgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBhc3NpZ24pIHtcbiAgcmV0dXJuIHN1YkNvbXBvbmVudHMucmVkdWNlKGZ1bmN0aW9uIChvYmosIGVsZW1lbnQpIHtcbiAgICBnZXRDb21wb25lbnROYW1lTGlzdChlbGVtZW50LCBmYWxzZSkuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgdmFyIHN1Yk5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lKG5hbWUsIHRydWUpXG4gICAgICBlbGVtZW50ID0gdHlwZW9mIHRyYW5zZm9ybSA9PSBcImZ1bmN0aW9uXCJcbiAgICAgICAgICAvLyBUT0RPOiBzdWJjbGFzcyBzdWJjb21wb25lbnRzIHNob3VsZCBiZSBoYW5kbGVkIHByb3Blcmx5IChCIGV4dGVuZHMgQSB0aGF0IGhhcyBhIHN1YmNvbXBvbmVudCBBOmEgYmVjb21lcyBCOmEgdGhhdCdzIG5vdCBpbiB0aGUgcmVnaXN0cnkpXG4gICAgICAgICAgPyB0cmFuc2Zvcm0oZWxlbWVudCwgbmFtZSlcbiAgICAgICAgICA6IGVsZW1lbnRcbiAgICAgIGlmICh0eXBlb2YgYXNzaWduID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBhc3NpZ24ob2JqLCBzdWJOYW1lLCBlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoQXJyYXkuaXNBcnJheShvYmpbc3ViTmFtZV0pKSB7XG4gICAgICAgIG9ialtzdWJOYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgb2JqW3N1Yk5hbWVdID0gZWxlbWVudFxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIG9ialxuICB9LCBvYmopXG59XG5cbmZ1bmN0aW9uIGZpbHRlciAoZWxlbWVudHMsIGZpbHRlcikge1xuICBzd2l0Y2ggKHR5cGVvZiBmaWx0ZXIpIHtcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGZpbHRlcihlbGVtZW50LCBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSlcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCkgPT09IGZpbHRlclxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsInZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG52YXIgSW50ZXJuYWxzID0gcmVxdWlyZShcIi4vSW50ZXJuYWxzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcmVnaXN0ZXIgKG5hbWUsIG1peGluKSB7XG4gIG1peGluID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG5cbiAgZnVuY3Rpb24gQ3VzdG9tQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEN1c3RvbUNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiBuZXcgQ3VzdG9tQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgfVxuICAgIHZhciBpbnN0YW5jZSA9IHRoaXNcblxuICAgIENvbXBvbmVudC5jYWxsKGluc3RhbmNlLCBlbGVtZW50LCBvcHRpb25zKVxuICAgIC8vIGF0IHRoaXMgcG9pbnQgY3VzdG9tIGNvbnN0cnVjdG9ycyBjYW4gYWxyZWFkeSBhY2Nlc3MgdGhlIGVsZW1lbnQgYW5kIHN1YiBjb21wb25lbnRzXG4gICAgLy8gc28gdGhleSBvbmx5IHJlY2VpdmUgdGhlIG9wdGlvbnMgb2JqZWN0IGZvciBjb252ZW5pZW5jZVxuICAgIGludGVybmFscy5jcmVhdGUoaW5zdGFuY2UsIFtvcHRpb25zXSlcbiAgfVxuXG4gIHZhciBpbnRlcm5hbHMgPSBuZXcgSW50ZXJuYWxzKEN1c3RvbUNvbXBvbmVudCwgbmFtZSlcbiAgaW50ZXJuYWxzLmV4dGVuZChDb21wb25lbnQpXG4gIGludGVybmFscy5hdXRvQXNzaWduID0gdHJ1ZVxuICBtaXhpbi5mb3JFYWNoKGZ1bmN0aW9uIChtaXhpbikge1xuICAgIGlmICh0eXBlb2YgbWl4aW4gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBtaXhpbi5jYWxsKEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUsIGludGVybmFscylcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBpbnRlcm5hbHMucHJvdG8obWl4aW4pXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZWdpc3RyeS5zZXQobmFtZSwgQ3VzdG9tQ29tcG9uZW50KVxufVxuIiwidmFyIHJlZ2lzdHJ5ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG52YXIgY29tcG9uZW50cyA9IHt9XG5cbnJlZ2lzdHJ5LmdldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5leGlzdHMgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuICEhY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5zZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUsIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdID0gQ29tcG9uZW50Q29uc3RydWN0b3Jcbn1cbiIsInZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxudmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcblxudmFyIHN0b3JhZ2UgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG52YXIgY29tcG9uZW50cyA9IFtdXG52YXIgZWxlbWVudHMgPSBbXVxudmFyIGNvdW50ZXIgPSAwXG5cbmZ1bmN0aW9uIHJlbW92ZSAoYXJyYXksIGVsZW1lbnQpIHtcbiAgdmFyIGkgPSBhcnJheS5pbmRleE9mKGVsZW1lbnQpXG4gIGlmICh+aSkgYXJyYXkuc3BsaWNlKGksIDEpXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnR5IChjb21wb25lbnROYW1lKSB7XG4gIHJldHVybiBjYW1lbGNhc2UoY29tcG9uZW50TmFtZStcIi1pZFwiKVxufVxuXG5mdW5jdGlvbiBnZXRJZCAoZWxlbWVudCwgY29tcG9uZW50TmFtZSkge1xuICByZXR1cm4gZWxlbWVudC5kYXRhc2V0W2NyZWF0ZVByb3BlcnR5KGNvbXBvbmVudE5hbWUpXVxufVxuXG5mdW5jdGlvbiBzZXRJZCAoZWxlbWVudCwgY29tcG9uZW50TmFtZSwgaWQpIHtcbiAgZWxlbWVudC5kYXRhc2V0W2NyZWF0ZVByb3BlcnR5KGNvbXBvbmVudE5hbWUpXSA9IGlkXG59XG5cbmZ1bmN0aW9uIGhhc0lkIChlbGVtZW50LCBjb21wb25lbnROYW1lKSB7XG4gIHJldHVybiAhIShlbGVtZW50LmRhdGFzZXRbY3JlYXRlUHJvcGVydHkoY29tcG9uZW50TmFtZSldKVxufVxuXG5mdW5jdGlvbiByZW1vdmVJZCAoZWxlbWVudCwgY29tcG9uZW50TmFtZSkge1xuICBpZiAoaGFzSWQoZWxlbWVudCwgY29tcG9uZW50TmFtZSkpIHtcbiAgICBkZWxldGUgZWxlbWVudC5kYXRhc2V0W2NyZWF0ZVByb3BlcnR5KGNvbXBvbmVudE5hbWUpXVxuICB9XG59XG5cbnN0b3JhZ2UuZ2V0ID0gZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIHtcbiAgLy9jb21wb25lbnROYW1lID0gY29tcG9uZW50TmFtZSB8fCBob29rLmdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpXG4gIHZhciBzdG9yZSA9IGNvbXBvbmVudHNbZ2V0SWQoZWxlbWVudCwgY29tcG9uZW50TmFtZSldXG4gIHJldHVybiBzdG9yZSA/IHN0b3JlW2NvbXBvbmVudE5hbWVdIDogbnVsbFxufVxuc3RvcmFnZS5zYXZlID0gZnVuY3Rpb24gKGNvbXBvbmVudCkge1xuICBpZiAoY29tcG9uZW50LmVsZW1lbnQpIHtcbiAgICB2YXIgaWQgPSBjb21wb25lbnQuX2lkXG4gICAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnQuaW50ZXJuYWxzLm5hbWVcbiAgICB2YXIgc3RvcmVcblxuICAgIGlmICghaWQpIHtcbiAgICAgIGlkID0gKytjb3VudGVyXG4gICAgICBzZXRJZChjb21wb25lbnQuZWxlbWVudCwgY29tcG9uZW50TmFtZSwgaWQpXG4gICAgICBjb21wb25lbnQuX2lkID0gaWRcbiAgICB9XG5cbiAgICBzdG9yZSA9IGNvbXBvbmVudHNbaWRdXG4gICAgaWYgKCFzdG9yZSkge1xuICAgICAgc3RvcmUgPSBjb21wb25lbnRzW2lkXSA9IHtsZW5ndGg6IDB9XG4gICAgfVxuXG4gICAgaWYgKHN0b3JlW2NvbXBvbmVudE5hbWVdICE9PSBjb21wb25lbnQpIHtcbiAgICAgICsrc3RvcmUubGVuZ3RoXG4gICAgICBzdG9yZVtjb21wb25lbnROYW1lXSA9IGNvbXBvbmVudFxuICAgIH1cblxuICAgIHZhciBleGlzdGluZ0VsZW1lbnQgPSBlbGVtZW50c1tpZF1cbiAgICBpZiAoZXhpc3RpbmdFbGVtZW50KSB7XG4gICAgICByZW1vdmVJZChleGlzdGluZ0VsZW1lbnQsIGNvbXBvbmVudE5hbWUpXG4gICAgICBzZXRJZChjb21wb25lbnQuZWxlbWVudCwgY29tcG9uZW50TmFtZSwgaWQpXG4gICAgfVxuXG4gICAgZWxlbWVudHNbaWRdID0gY29tcG9uZW50LmVsZW1lbnRcbiAgfVxufVxuc3RvcmFnZS5yZW1vdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50LCBvbmx5Q29tcG9uZW50KSB7XG4gIHZhciBlbGVtZW50ID0gY29tcG9uZW50IGluc3RhbmNlb2YgRWxlbWVudFxuICAgICAgPyBjb21wb25lbnRcbiAgICAgIDogY29tcG9uZW50LmVsZW1lbnRcbiAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnQuaW50ZXJuYWxzLm5hbWVcbiAgdmFyIGlkID0gZ2V0SWQoZWxlbWVudCwgY29tcG9uZW50TmFtZSlcbiAgdmFyIHN0b3JlID0gY29tcG9uZW50c1tpZF1cblxuICBpZiAoY29tcG9uZW50IGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIGlmIChvbmx5Q29tcG9uZW50KSB7XG4gICAgICBpZiAoZGVsZXRlIHN0b3JlW29ubHlDb21wb25lbnRdKSAtLXN0b3JlLmxlbmd0aFxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc3RvcmUpIHtcbiAgICAgICAgaWYgKHN0b3JlLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgIHN0b3JlW3Byb3BdLl9pZCA9IG51bGxcbiAgICAgICAgICAvLy0tc3RvcmUubGVuZ3RoXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBjb21wb25lbnRzW2lkXVxuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICB2YXIgZXhpc3RpbmcgPSBzdG9yZVtjb21wb25lbnROYW1lXVxuICAgIGlmIChleGlzdGluZyA9PSBjb21wb25lbnQpIHtcbiAgICAgIGV4aXN0aW5nLl9pZCA9IG51bGxcbiAgICAgIGRlbGV0ZSBzdG9yZVtjb21wb25lbnROYW1lXVxuICAgICAgLS1zdG9yZS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICBpZiAoc3RvcmUgJiYgIXN0b3JlLmxlbmd0aCkge1xuICAgIHJlbW92ZUlkKGVsZW1lbnRzW2lkXSwgY29tcG9uZW50TmFtZSlcbiAgICBkZWxldGUgZWxlbWVudHNbaWRdXG4gIH1cbn1cblxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBleHRlbmQoIG9iaiwgZXh0ZW5zaW9uICl7XG4gIGZvciggdmFyIG5hbWUgaW4gZXh0ZW5zaW9uICl7XG4gICAgaWYoIGV4dGVuc2lvbi5oYXNPd25Qcm9wZXJ0eShuYW1lKSApIG9ialtuYW1lXSA9IGV4dGVuc2lvbltuYW1lXVxuICB9XG4gIHJldHVybiBvYmpcbn1cbiIsInZhciBleHRlbmQgPSByZXF1aXJlKFwiLi9leHRlbmRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiggb2JqLCBleHRlbnNpb24gKXtcbiAgcmV0dXJuIGV4dGVuZChleHRlbmQoe30sIG9iaiksIGV4dGVuc2lvbilcbn1cbiIsInZhciBvYmplY3QgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbm9iamVjdC5hY2Nlc3NvciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGdldCwgc2V0KSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBnZXQ6IGdldCxcbiAgICBzZXQ6IHNldFxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lR2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIGdldDogZm5cbiAgfSlcbn1cblxub2JqZWN0LmRlZmluZVNldHRlciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBzZXQ6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5tZXRob2QgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgdmFsdWU6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5wcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm4sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pXG59XG4iXX0=
