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
  this.components = {}
  this.element = element || null
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
  constructor: Component,

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
    var definition = this.constructor.getEventDefinition(type, detail)
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
    return hook.getComponentName(this.constructor.componentName, cc)
  },
  getMainComponentName: function (cc) {
    return hook.getMainComponentName(this.constructor.componentName, cc)
  },
  getSubComponentName: function (cc) {
    return hook.getSubComponentName(this.constructor.componentName, cc)
  },

  clearSubComponents: function () {
    var components = this.constructor.components

    for (var name in components) {
      if (components.hasOwnProperty(name)) {
        if (Array.isArray(components[name])) {
          this.components[name] = []
        }
        else {
          this.components[name] = components[name]
        }
      }
    }
  },
  assignSubComponents: function (transform) {
    if (!this.element) return

    var hostComponent = this
    var subComponents = this.findSubComponents()
    var constructor = this.constructor

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
      if (Array.isArray(constructor.components[name])) {
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
    if (element && this.constructor.componentName) {
      if (this.constructor.autoSave) {
        storage.save(this)
      }
      if (this.constructor.autoAssign) {
        this.assignSubComponents()
      }
      this.constructor.resetAttributes(this)
    }
  }
})

},{"./delegate":6,"./hook":8,"./registry":10,"./storage":11}],4:[function(require,module,exports){
var camelcase = require("camelcase")
var extend = require("../util/extend")
var merge = require("../util/merge")
var object = require("../util/object")
var delegate = require("./delegate")
var storage = require("./storage")
var registry = require("./registry")
var hook = require("./hook")

var defaultEventDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = function (CustomComponent, componentName) {

  CustomComponent.componentName = componentName
  CustomComponent.autoAssign = true
  CustomComponent.autoSave = true
  CustomComponent.components = {}
  
  var prototype = CustomComponent.prototype
  
  var _events = CustomComponent._events = {}
  var _constructors = CustomComponent._constructors = []
  var _attributes = CustomComponent._attributes = {}
  var _actions = CustomComponent._actions = []

  CustomComponent.extend = function (BaseComponent) {
    prototype = CustomComponent.prototype = Object.create(BaseComponent.prototype)
    CustomComponent.prototype.constructor = CustomComponent
    if (BaseComponent.componentName) {
      CustomComponent.autoAssign = BaseComponent.autoAssign
      extend(CustomComponent.components, BaseComponent.components)
      extend(_events, BaseComponent._events)
      _constructors = _constructors.concat(BaseComponent._constructors)
      extend(_attributes, BaseComponent._attributes)
      BaseComponent._actions.forEach(function (args) {
        var event = args[0]
        var matches = args[1]
        var matcher = CustomComponent.action(event)
        matches.forEach(function (args) {
          matcher.match.apply(matcher, args)
        })
      })
    }
  }
  CustomComponent.onCreate = function (constructor) {
    _constructors.push(constructor)
    return CustomComponent
  }

  CustomComponent.create = function (instance, args) {
    _constructors.forEach(function (constructor) {
      constructor.apply(instance, args)
    })
  }

  CustomComponent.method = function (name, fn) {
    object.method(prototype, name, fn)
    return CustomComponent
  }

  CustomComponent.property = function (name, fn) {
    object.property(prototype, name, fn)
    return CustomComponent
  }

  CustomComponent.get = function (name, fn) {
    object.defineGetter(prototype, name, fn)
    return CustomComponent
  }

  CustomComponent.set = function (name, fn) {
    object.defineGetter(prototype, name, fn)
    return CustomComponent
  }

  CustomComponent.accessor = function (name, get, set) {
    object.accessor(prototype, name, get, set)
    return CustomComponent
  }

  CustomComponent.proto = function (prototype) {
    for (var prop in prototype) {
      if (prototype.hasOwnProperty(prop)) {
        if (typeof prototype[prop] == "function") {
          if (prop === "onCreate") {
            CustomComponent.onCreate(prototype[prop])
          }
          else {
            CustomComponent.method(prop, prototype[prop])
          }
        }
        else {
          CustomComponent.property(prop, prototype[prop])
        }
      }
    }
    return CustomComponent
  }

  CustomComponent.shortcut = function (name, componentName, extra) {
    CustomComponent.get(name, function () {
      var element = this.element.querySelector(hook.selector(componentName, "~=", extra))
      return registry.exists(componentName) ? storage.get(element, componentName) : element
    })
  }

  CustomComponent.action = function action(event) {
    var matcher = {}
    var matches = []
    var delegator = delegate({element: document.body, event: event})

    _actions.push([event, matches])

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
          component = componentName+component
        }
        return hook.selector(component, "~=")
      })
      selectors.unshift(hook.selector(componentName, "~="))

      delegator.match(selectors, function (e, main) {
        var instance = storage.get(main, componentName) || main
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

  CustomComponent.event = function (type, definition) {
    _events[type] = definition
    return CustomComponent
  }

  CustomComponent.getEventDefinition = function (type, detail) {
    var definition = merge(defaultEventDefinition, _events[type])
    definition.detail = typeof detail == "undefined" ? definition.detail : detail
    return definition
  }

  CustomComponent.resetAttributes = function (instance) {
    if (!instance.element) return

    var attribute
    var value
    for (var name in _attributes) {
      if (_attributes.hasOwnProperty(name)) {
        attribute = _attributes[name]
        value = attribute.get.call(instance, false)
        if (attribute.hasDefault && !attribute.has.call(instance, value)) {
          attribute.set.call(instance, attribute.defaultValue, false)
        }
      }
    }
  }

  CustomComponent.attribute = function (name, def) {
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

    _attributes[property] = {
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

    Object.defineProperty(prototype, property, {
      get: getter || get,
      set: setter || set
    })

    return CustomComponent
  }

  return CustomComponent
}

},{"../util/extend":12,"../util/merge":13,"../util/object":14,"./delegate":6,"./hook":8,"./registry":10,"./storage":11,"camelcase":2}],5:[function(require,module,exports){
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

    this.name = name

    Component.call(instance, element, options)
    // at this point custom constructors can already access the element and sub components
    // so they only receive the options object for convenience
    CustomComponent.create(instance, [options])
  }

  Internals(CustomComponent, name)
  CustomComponent.extend(Component)
  CustomComponent.autoAssign = true
  mixin.forEach(function (mixin) {
    if (typeof mixin == "function") {
      if (mixin.componentName) {
        CustomComponent.extend(mixin)
      }
      else {
        mixin.call(CustomComponent.prototype, CustomComponent)
      }
    }
    else {
      CustomComponent.proto(mixin)
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
  var store = components[getId(element, componentName)]
  return store ? store[componentName] : null
}
storage.save = function (component) {
  if (component.element) {
    var id = component._id
    var componentName = component.name
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
  var componentName = component.name
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJzcmMvQ29tcG9uZW50LmpzIiwic3JjL0ludGVybmFscy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInNyYy9zdG9yYWdlLmpzIiwidXRpbC9leHRlbmQuanMiLCJ1dGlsL21lcmdlLmpzIiwidXRpbC9vYmplY3QuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgaG9vayA9IHJlcXVpcmUoXCIuL3NyYy9ob29rXCIpXG52YXIgcmVnaXN0ZXIgPSByZXF1aXJlKFwiLi9zcmMvcmVnaXN0ZXJcIilcbnZhciBjb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvY3JlYXRlXCIpXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoXCIuL3NyYy9zdG9yYWdlXCIpXG52YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vc3JjL0NvbXBvbmVudFwiKVxudmFyIGRlbGVnYXRlID0gcmVxdWlyZShcIi4vc3JjL2RlbGVnYXRlXCIpXG52YXIgZnJhZ21lbnQgPSByZXF1aXJlKFwiLi9zcmMvZnJhZ21lbnRcIilcblxudmFyIHRyZWFudCA9IHt9XG5tb2R1bGUuZXhwb3J0cyA9IHRyZWFudFxuXG50cmVhbnQucmVnaXN0ZXIgPSByZWdpc3RlclxudHJlYW50LmNvbXBvbmVudCA9IGNvbXBvbmVudFxudHJlYW50LnN0b3JhZ2UgPSBzdG9yYWdlXG50cmVhbnQuQ29tcG9uZW50ID0gQ29tcG9uZW50XG50cmVhbnQuZGVsZWdhdGUgPSBkZWxlZ2F0ZVxudHJlYW50LmZyYWdtZW50ID0gZnJhZ21lbnRcbnRyZWFudC5ob29rID0gaG9va1xuXG52YXIgdXRpbCA9IHt9XG50cmVhbnQudXRpbCA9IHV0aWxcblxudXRpbC5leHRlbmQgPSByZXF1aXJlKFwiLi91dGlsL2V4dGVuZFwiKVxudXRpbC5tZXJnZSA9IHJlcXVpcmUoXCIuL3V0aWwvbWVyZ2VcIilcbnV0aWwub2JqZWN0ID0gcmVxdWlyZShcIi4vdXRpbC9vYmplY3RcIilcbiIsIid1c2Ugc3RyaWN0Jztcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0cikge1xuXHRzdHIgPSBzdHIudHJpbSgpO1xuXG5cdGlmIChzdHIubGVuZ3RoID09PSAxIHx8ICEoL1tfLlxcLSBdKy8pLnRlc3Qoc3RyKSApIHtcblx0XHRpZiAoc3RyWzBdID09PSBzdHJbMF0udG9Mb3dlckNhc2UoKSAmJiBzdHIuc2xpY2UoMSkgIT09IHN0ci5zbGljZSgxKS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRyZXR1cm4gc3RyO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdHIudG9Mb3dlckNhc2UoKTtcblx0fVxuXG5cdHJldHVybiBzdHJcblx0LnJlcGxhY2UoL15bXy5cXC0gXSsvLCAnJylcblx0LnRvTG93ZXJDYXNlKClcblx0LnJlcGxhY2UoL1tfLlxcLSBdKyhcXHd8JCkvZywgZnVuY3Rpb24gKG0sIHAxKSB7XG5cdFx0cmV0dXJuIHAxLnRvVXBwZXJDYXNlKCk7XG5cdH0pO1xufTtcbiIsInZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxudmFyIHJlZ2lzdHJ5ID0gcmVxdWlyZShcIi4vcmVnaXN0cnlcIilcbnZhciBzdG9yYWdlID0gcmVxdWlyZShcIi4vc3RvcmFnZVwiKVxudmFyIGRlbGVnYXRlID0gcmVxdWlyZShcIi4vZGVsZWdhdGVcIilcblxubW9kdWxlLmV4cG9ydHMgPSBDb21wb25lbnRcblxuZnVuY3Rpb24gQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gIGlmIChlbGVtZW50ICYmICEoZWxlbWVudCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiZWxlbWVudCBzaG91bGQgYmUgYW4gRWxlbWVudCBpbnN0YW5jZSBvciBudWxsXCIpXG4gIH1cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIENvbXBvbmVudCkpIHtcbiAgICByZXR1cm4gbmV3IENvbXBvbmVudChlbGVtZW50LCBvcHRpb25zKVxuICB9XG5cbiAgdGhpcy5fZWxlbWVudCA9IG51bGxcbiAgdGhpcy5faWQgPSBudWxsXG4gIHRoaXMuY29tcG9uZW50cyA9IHt9XG4gIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQgfHwgbnVsbFxufVxuXG5Db21wb25lbnQuY3JlYXRlID0gZnVuY3Rpb24gKG5hbWUsIGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgdmFyIENvbXBvbmVudENvbnN0cnVjdG9yID0gbnVsbFxuXG4gIGlmIChyZWdpc3RyeS5leGlzdHMobmFtZSkpIHtcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IHJlZ2lzdHJ5LmdldChuYW1lKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIk1pc3NpbmcgY29tcG9uZW50IGRlZmluaXRpb246IFwiLCBuYW1lKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICByZXR1cm4gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbkNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBDb21wb25lbnQsXG5cbiAgZGVzdHJveTogZnVuY3Rpb24gKCkge1xuICAgIHN0b3JhZ2UucmVtb3ZlKHRoaXMpXG4gICAgdGhpcy5lbGVtZW50ID0gbnVsbFxuXG4gICAgdmFyIGNvbXBvbmVudHMgPSB0aGlzLmNvbXBvbmVudHNcbiAgICB2YXIgY29tcG9uZW50XG4gICAgZm9yICh2YXIgbmFtZSBpbiBjb21wb25lbnRzKSB7XG4gICAgICBpZiAoY29tcG9uZW50cy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgICAgICBjb21wb25lbnQgPSBjb21wb25lbnRzW25hbWVdXG4gICAgICAgIGlmIChjb21wb25lbnQuZGVzdHJveSkge1xuICAgICAgICAgIGNvbXBvbmVudC5kZXN0cm95KClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbXBvbmVudHMgPSBudWxsXG4gIH0sXG5cbiAgZGVsZWdhdGU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5lbGVtZW50ID0gdGhpcy5lbGVtZW50XG4gICAgb3B0aW9ucy5jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0IHx8IHRoaXNcbiAgICByZXR1cm4gZGVsZWdhdGUob3B0aW9ucylcbiAgfSxcblxuICBkaXNwYXRjaDogZnVuY3Rpb24gKHR5cGUsIGRldGFpbCkge1xuICAgIHZhciBkZWZpbml0aW9uID0gdGhpcy5jb25zdHJ1Y3Rvci5nZXRFdmVudERlZmluaXRpb24odHlwZSwgZGV0YWlsKVxuICAgIHJldHVybiB0aGlzLmVsZW1lbnQuZGlzcGF0Y2hFdmVudChuZXcgd2luZG93LkN1c3RvbUV2ZW50KHR5cGUsIGRlZmluaXRpb24pKVxuICB9LFxuXG4gIGZpbmRDb21wb25lbnQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIGhvb2suZmluZENvbXBvbmVudChuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGZpbmRBbGxDb21wb25lbnRzOiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRBbGxDb21wb25lbnRzKG5hbWUsIHRoaXMuZWxlbWVudClcbiAgfSxcbiAgZmluZFN1YkNvbXBvbmVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gaG9vay5maW5kU3ViQ29tcG9uZW50cyh0aGlzLmdldE1haW5Db21wb25lbnROYW1lKGZhbHNlKSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBnZXRDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRDb21wb25lbnROYW1lKHRoaXMuY29uc3RydWN0b3IuY29tcG9uZW50TmFtZSwgY2MpXG4gIH0sXG4gIGdldE1haW5Db21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSh0aGlzLmNvbnN0cnVjdG9yLmNvbXBvbmVudE5hbWUsIGNjKVxuICB9LFxuICBnZXRTdWJDb21wb25lbnROYW1lOiBmdW5jdGlvbiAoY2MpIHtcbiAgICByZXR1cm4gaG9vay5nZXRTdWJDb21wb25lbnROYW1lKHRoaXMuY29uc3RydWN0b3IuY29tcG9uZW50TmFtZSwgY2MpXG4gIH0sXG5cbiAgY2xlYXJTdWJDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNvbXBvbmVudHMgPSB0aGlzLmNvbnN0cnVjdG9yLmNvbXBvbmVudHNcblxuICAgIGZvciAodmFyIG5hbWUgaW4gY29tcG9uZW50cykge1xuICAgICAgaWYgKGNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgICB0aGlzLmNvbXBvbmVudHNbbmFtZV0gPSBbXVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIHRoaXMuY29tcG9uZW50c1tuYW1lXSA9IGNvbXBvbmVudHNbbmFtZV1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgYXNzaWduU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKHRyYW5zZm9ybSkge1xuICAgIGlmICghdGhpcy5lbGVtZW50KSByZXR1cm5cblxuICAgIHZhciBob3N0Q29tcG9uZW50ID0gdGhpc1xuICAgIHZhciBzdWJDb21wb25lbnRzID0gdGhpcy5maW5kU3ViQ29tcG9uZW50cygpXG4gICAgdmFyIGNvbnN0cnVjdG9yID0gdGhpcy5jb25zdHJ1Y3RvclxuXG4gICAgdGhpcy5jbGVhclN1YkNvbXBvbmVudHMoKVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB0cmFuc2Zvcm0gPT0gXCJ1bmRlZmluZWRcIiB8fCB0cmFuc2Zvcm0gPT09IHRydWUpIHtcbiAgICAgIHRyYW5zZm9ybSA9IGZ1bmN0aW9uIChlbGVtZW50LCBuYW1lKSB7XG4gICAgICAgIHJldHVybiByZWdpc3RyeS5leGlzdHMobmFtZSlcbiAgICAgICAgICAgID8gQ29tcG9uZW50LmNyZWF0ZShuYW1lLCBlbGVtZW50LCBob3N0Q29tcG9uZW50KVxuICAgICAgICAgICAgOiBlbGVtZW50XG4gICAgICB9XG4gICAgfVxuXG4gICAgaG9vay5hc3NpZ25TdWJDb21wb25lbnRzKHRoaXMuY29tcG9uZW50cywgc3ViQ29tcG9uZW50cywgdHJhbnNmb3JtLCBmdW5jdGlvbiAoY29tcG9uZW50cywgbmFtZSwgZWxlbWVudCkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29uc3RydWN0b3IuY29tcG9uZW50c1tuYW1lXSkpIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGNvbXBvbmVudHNbbmFtZV0gfHwgW11cbiAgICAgICAgY29tcG9uZW50c1tuYW1lXS5wdXNoKGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50c1tuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb21wb25lbnQucHJvdG90eXBlLCBcImVsZW1lbnRcIiwge1xuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fZWxlbWVudFxuICB9LFxuICBzZXQ6IGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnRcbiAgICBpZiAoZWxlbWVudCAmJiB0aGlzLmNvbnN0cnVjdG9yLmNvbXBvbmVudE5hbWUpIHtcbiAgICAgIGlmICh0aGlzLmNvbnN0cnVjdG9yLmF1dG9TYXZlKSB7XG4gICAgICAgIHN0b3JhZ2Uuc2F2ZSh0aGlzKVxuICAgICAgfVxuICAgICAgaWYgKHRoaXMuY29uc3RydWN0b3IuYXV0b0Fzc2lnbikge1xuICAgICAgICB0aGlzLmFzc2lnblN1YkNvbXBvbmVudHMoKVxuICAgICAgfVxuICAgICAgdGhpcy5jb25zdHJ1Y3Rvci5yZXNldEF0dHJpYnV0ZXModGhpcylcbiAgICB9XG4gIH1cbn0pXG4iLCJ2YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxudmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuLi91dGlsL2V4dGVuZFwiKVxudmFyIG1lcmdlID0gcmVxdWlyZShcIi4uL3V0aWwvbWVyZ2VcIilcbnZhciBvYmplY3QgPSByZXF1aXJlKFwiLi4vdXRpbC9vYmplY3RcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL2RlbGVnYXRlXCIpXG52YXIgc3RvcmFnZSA9IHJlcXVpcmUoXCIuL3N0b3JhZ2VcIilcbnZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgaG9vayA9IHJlcXVpcmUoXCIuL2hvb2tcIilcblxudmFyIGRlZmF1bHRFdmVudERlZmluaXRpb24gPSB7XG4gIGRldGFpbDogbnVsbCxcbiAgdmlldzogd2luZG93LFxuICBidWJibGVzOiB0cnVlLFxuICBjYW5jZWxhYmxlOiB0cnVlXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKEN1c3RvbUNvbXBvbmVudCwgY29tcG9uZW50TmFtZSkge1xuXG4gIEN1c3RvbUNvbXBvbmVudC5jb21wb25lbnROYW1lID0gY29tcG9uZW50TmFtZVxuICBDdXN0b21Db21wb25lbnQuYXV0b0Fzc2lnbiA9IHRydWVcbiAgQ3VzdG9tQ29tcG9uZW50LmF1dG9TYXZlID0gdHJ1ZVxuICBDdXN0b21Db21wb25lbnQuY29tcG9uZW50cyA9IHt9XG4gIFxuICB2YXIgcHJvdG90eXBlID0gQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZVxuICBcbiAgdmFyIF9ldmVudHMgPSBDdXN0b21Db21wb25lbnQuX2V2ZW50cyA9IHt9XG4gIHZhciBfY29uc3RydWN0b3JzID0gQ3VzdG9tQ29tcG9uZW50Ll9jb25zdHJ1Y3RvcnMgPSBbXVxuICB2YXIgX2F0dHJpYnV0ZXMgPSBDdXN0b21Db21wb25lbnQuX2F0dHJpYnV0ZXMgPSB7fVxuICB2YXIgX2FjdGlvbnMgPSBDdXN0b21Db21wb25lbnQuX2FjdGlvbnMgPSBbXVxuXG4gIEN1c3RvbUNvbXBvbmVudC5leHRlbmQgPSBmdW5jdGlvbiAoQmFzZUNvbXBvbmVudCkge1xuICAgIHByb3RvdHlwZSA9IEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEJhc2VDb21wb25lbnQucHJvdG90eXBlKVxuICAgIEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDdXN0b21Db21wb25lbnRcbiAgICBpZiAoQmFzZUNvbXBvbmVudC5jb21wb25lbnROYW1lKSB7XG4gICAgICBDdXN0b21Db21wb25lbnQuYXV0b0Fzc2lnbiA9IEJhc2VDb21wb25lbnQuYXV0b0Fzc2lnblxuICAgICAgZXh0ZW5kKEN1c3RvbUNvbXBvbmVudC5jb21wb25lbnRzLCBCYXNlQ29tcG9uZW50LmNvbXBvbmVudHMpXG4gICAgICBleHRlbmQoX2V2ZW50cywgQmFzZUNvbXBvbmVudC5fZXZlbnRzKVxuICAgICAgX2NvbnN0cnVjdG9ycyA9IF9jb25zdHJ1Y3RvcnMuY29uY2F0KEJhc2VDb21wb25lbnQuX2NvbnN0cnVjdG9ycylcbiAgICAgIGV4dGVuZChfYXR0cmlidXRlcywgQmFzZUNvbXBvbmVudC5fYXR0cmlidXRlcylcbiAgICAgIEJhc2VDb21wb25lbnQuX2FjdGlvbnMuZm9yRWFjaChmdW5jdGlvbiAoYXJncykge1xuICAgICAgICB2YXIgZXZlbnQgPSBhcmdzWzBdXG4gICAgICAgIHZhciBtYXRjaGVzID0gYXJnc1sxXVxuICAgICAgICB2YXIgbWF0Y2hlciA9IEN1c3RvbUNvbXBvbmVudC5hY3Rpb24oZXZlbnQpXG4gICAgICAgIG1hdGNoZXMuZm9yRWFjaChmdW5jdGlvbiAoYXJncykge1xuICAgICAgICAgIG1hdGNoZXIubWF0Y2guYXBwbHkobWF0Y2hlciwgYXJncylcbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgfVxuICB9XG4gIEN1c3RvbUNvbXBvbmVudC5vbkNyZWF0ZSA9IGZ1bmN0aW9uIChjb25zdHJ1Y3Rvcikge1xuICAgIF9jb25zdHJ1Y3RvcnMucHVzaChjb25zdHJ1Y3RvcilcbiAgICByZXR1cm4gQ3VzdG9tQ29tcG9uZW50XG4gIH1cblxuICBDdXN0b21Db21wb25lbnQuY3JlYXRlID0gZnVuY3Rpb24gKGluc3RhbmNlLCBhcmdzKSB7XG4gICAgX2NvbnN0cnVjdG9ycy5mb3JFYWNoKGZ1bmN0aW9uIChjb25zdHJ1Y3Rvcikge1xuICAgICAgY29uc3RydWN0b3IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gICAgfSlcbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5tZXRob2QgPSBmdW5jdGlvbiAobmFtZSwgZm4pIHtcbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgbmFtZSwgZm4pXG4gICAgcmV0dXJuIEN1c3RvbUNvbXBvbmVudFxuICB9XG5cbiAgQ3VzdG9tQ29tcG9uZW50LnByb3BlcnR5ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgb2JqZWN0LnByb3BlcnR5KHByb3RvdHlwZSwgbmFtZSwgZm4pXG4gICAgcmV0dXJuIEN1c3RvbUNvbXBvbmVudFxuICB9XG5cbiAgQ3VzdG9tQ29tcG9uZW50LmdldCA9IGZ1bmN0aW9uIChuYW1lLCBmbikge1xuICAgIG9iamVjdC5kZWZpbmVHZXR0ZXIocHJvdG90eXBlLCBuYW1lLCBmbilcbiAgICByZXR1cm4gQ3VzdG9tQ29tcG9uZW50XG4gIH1cblxuICBDdXN0b21Db21wb25lbnQuc2V0ID0gZnVuY3Rpb24gKG5hbWUsIGZuKSB7XG4gICAgb2JqZWN0LmRlZmluZUdldHRlcihwcm90b3R5cGUsIG5hbWUsIGZuKVxuICAgIHJldHVybiBDdXN0b21Db21wb25lbnRcbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5hY2Nlc3NvciA9IGZ1bmN0aW9uIChuYW1lLCBnZXQsIHNldCkge1xuICAgIG9iamVjdC5hY2Nlc3Nvcihwcm90b3R5cGUsIG5hbWUsIGdldCwgc2V0KVxuICAgIHJldHVybiBDdXN0b21Db21wb25lbnRcbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5wcm90byA9IGZ1bmN0aW9uIChwcm90b3R5cGUpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIHByb3RvdHlwZSkge1xuICAgICAgaWYgKHByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBpZiAodHlwZW9mIHByb3RvdHlwZVtwcm9wXSA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICBpZiAocHJvcCA9PT0gXCJvbkNyZWF0ZVwiKSB7XG4gICAgICAgICAgICBDdXN0b21Db21wb25lbnQub25DcmVhdGUocHJvdG90eXBlW3Byb3BdKVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIEN1c3RvbUNvbXBvbmVudC5tZXRob2QocHJvcCwgcHJvdG90eXBlW3Byb3BdKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICBDdXN0b21Db21wb25lbnQucHJvcGVydHkocHJvcCwgcHJvdG90eXBlW3Byb3BdKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBDdXN0b21Db21wb25lbnRcbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5zaG9ydGN1dCA9IGZ1bmN0aW9uIChuYW1lLCBjb21wb25lbnROYW1lLCBleHRyYSkge1xuICAgIEN1c3RvbUNvbXBvbmVudC5nZXQobmFtZSwgZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGVsZW1lbnQgPSB0aGlzLmVsZW1lbnQucXVlcnlTZWxlY3Rvcihob29rLnNlbGVjdG9yKGNvbXBvbmVudE5hbWUsIFwifj1cIiwgZXh0cmEpKVxuICAgICAgcmV0dXJuIHJlZ2lzdHJ5LmV4aXN0cyhjb21wb25lbnROYW1lKSA/IHN0b3JhZ2UuZ2V0KGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIDogZWxlbWVudFxuICAgIH0pXG4gIH1cblxuICBDdXN0b21Db21wb25lbnQuYWN0aW9uID0gZnVuY3Rpb24gYWN0aW9uKGV2ZW50KSB7XG4gICAgdmFyIG1hdGNoZXIgPSB7fVxuICAgIHZhciBtYXRjaGVzID0gW11cbiAgICB2YXIgZGVsZWdhdG9yID0gZGVsZWdhdGUoe2VsZW1lbnQ6IGRvY3VtZW50LmJvZHksIGV2ZW50OiBldmVudH0pXG5cbiAgICBfYWN0aW9ucy5wdXNoKFtldmVudCwgbWF0Y2hlc10pXG5cbiAgICBtYXRjaGVyLm1hdGNoID0gZnVuY3Rpb24gKGNvbXBvbmVudHMsIGNiKSB7XG4gICAgICBtYXRjaGVzLnB1c2goW2NvbXBvbmVudHMsIGNiXSlcblxuICAgICAgaWYgKCFjYikge1xuICAgICAgICBjYiA9IGNvbXBvbmVudHNcbiAgICAgICAgY29tcG9uZW50cyA9IFtdXG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50cyA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIGNvbXBvbmVudHMgPSBbY29tcG9uZW50c11cbiAgICAgIH1cblxuICAgICAgdmFyIHNlbGVjdG9ycyA9IGNvbXBvbmVudHMubWFwKGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKGNvbXBvbmVudFswXSA9PSBcIjpcIikge1xuICAgICAgICAgIGNvbXBvbmVudCA9IGNvbXBvbmVudE5hbWUrY29tcG9uZW50XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhvb2suc2VsZWN0b3IoY29tcG9uZW50LCBcIn49XCIpXG4gICAgICB9KVxuICAgICAgc2VsZWN0b3JzLnVuc2hpZnQoaG9vay5zZWxlY3Rvcihjb21wb25lbnROYW1lLCBcIn49XCIpKVxuXG4gICAgICBkZWxlZ2F0b3IubWF0Y2goc2VsZWN0b3JzLCBmdW5jdGlvbiAoZSwgbWFpbikge1xuICAgICAgICB2YXIgaW5zdGFuY2UgPSBzdG9yYWdlLmdldChtYWluLCBjb21wb25lbnROYW1lKSB8fCBtYWluXG4gICAgICAgIHZhciBhcmdzID0gW2VdO1xuXG4gICAgICAgIFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKS5mb3JFYWNoKGZ1bmN0aW9uIChlbGVtZW50LCBpKSB7XG4gICAgICAgICAgdmFyIG5hbWUgPSBjb21wb25lbnRzW2ldXG4gICAgICAgICAgbmFtZSA9IG5hbWVbMF0gPT0gXCI6XCIgPyBuYW1lLnN1YnN0cigxKSA6IG5hbWVcbiAgICAgICAgICB2YXIgcHJvcGVydHlOYW1lID0gY2FtZWxjYXNlKG5hbWUpXG4gICAgICAgICAgdmFyIGFyZ1xuXG4gICAgICAgICAgaWYgKGluc3RhbmNlLmNvbXBvbmVudHMuaGFzT3duUHJvcGVydHkocHJvcGVydHlOYW1lKSkge1xuICAgICAgICAgICAgYXJnID0gaW5zdGFuY2UuY29tcG9uZW50c1twcm9wZXJ0eU5hbWVdXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShhcmcpKSB7XG4gICAgICAgICAgICAgIGFyZy5zb21lKGZ1bmN0aW9uIChtZW1iZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVtYmVyID09IGVsZW1lbnQgfHwgbWVtYmVyLmVsZW1lbnQgPT0gZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgYXJnID0gbWVtYmVyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBhcmcgPSBzdG9yYWdlLmdldChlbGVtZW50LCBuYW1lKSB8fCBlbGVtZW50XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXJncy5wdXNoKGFyZylcbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gY2IuYXBwbHkoaW5zdGFuY2UsIGFyZ3MpXG4gICAgICB9KVxuXG4gICAgICByZXR1cm4gbWF0Y2hlclxuICAgIH1cblxuICAgIHJldHVybiBtYXRjaGVyXG4gIH1cblxuICBDdXN0b21Db21wb25lbnQuZXZlbnQgPSBmdW5jdGlvbiAodHlwZSwgZGVmaW5pdGlvbikge1xuICAgIF9ldmVudHNbdHlwZV0gPSBkZWZpbml0aW9uXG4gICAgcmV0dXJuIEN1c3RvbUNvbXBvbmVudFxuICB9XG5cbiAgQ3VzdG9tQ29tcG9uZW50LmdldEV2ZW50RGVmaW5pdGlvbiA9IGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgICB2YXIgZGVmaW5pdGlvbiA9IG1lcmdlKGRlZmF1bHRFdmVudERlZmluaXRpb24sIF9ldmVudHNbdHlwZV0pXG4gICAgZGVmaW5pdGlvbi5kZXRhaWwgPSB0eXBlb2YgZGV0YWlsID09IFwidW5kZWZpbmVkXCIgPyBkZWZpbml0aW9uLmRldGFpbCA6IGRldGFpbFxuICAgIHJldHVybiBkZWZpbml0aW9uXG4gIH1cblxuICBDdXN0b21Db21wb25lbnQucmVzZXRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKGluc3RhbmNlKSB7XG4gICAgaWYgKCFpbnN0YW5jZS5lbGVtZW50KSByZXR1cm5cblxuICAgIHZhciBhdHRyaWJ1dGVcbiAgICB2YXIgdmFsdWVcbiAgICBmb3IgKHZhciBuYW1lIGluIF9hdHRyaWJ1dGVzKSB7XG4gICAgICBpZiAoX2F0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgYXR0cmlidXRlID0gX2F0dHJpYnV0ZXNbbmFtZV1cbiAgICAgICAgdmFsdWUgPSBhdHRyaWJ1dGUuZ2V0LmNhbGwoaW5zdGFuY2UsIGZhbHNlKVxuICAgICAgICBpZiAoYXR0cmlidXRlLmhhc0RlZmF1bHQgJiYgIWF0dHJpYnV0ZS5oYXMuY2FsbChpbnN0YW5jZSwgdmFsdWUpKSB7XG4gICAgICAgICAgYXR0cmlidXRlLnNldC5jYWxsKGluc3RhbmNlLCBhdHRyaWJ1dGUuZGVmYXVsdFZhbHVlLCBmYWxzZSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIEN1c3RvbUNvbXBvbmVudC5hdHRyaWJ1dGUgPSBmdW5jdGlvbiAobmFtZSwgZGVmKSB7XG4gICAgaWYgKGRlZiA9PSBudWxsKSB7XG4gICAgICBkZWYgPSB7fVxuICAgIH1cblxuICAgIHZhciB0eXBlT2ZEZWYgPSB0eXBlb2YgZGVmXG4gICAgdmFyIHR5cGVcbiAgICB2YXIgZGVmYXVsdFZhbHVlXG4gICAgdmFyIGdldHRlclxuICAgIHZhciBzZXR0ZXJcbiAgICB2YXIgb25jaGFuZ2VcbiAgICB2YXIgcHJvcGVydHkgPSBjYW1lbGNhc2UobmFtZSlcblxuICAgIHN3aXRjaCAodHlwZU9mRGVmKSB7XG4gICAgICBjYXNlIFwiYm9vbGVhblwiOlxuICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAvLyB0aGUgZGVmaW5pdGlvbiBpcyBhIHByaW1pdGl2ZSB2YWx1ZVxuICAgICAgICB0eXBlID0gdHlwZU9mRGVmXG4gICAgICAgIGRlZmF1bHRWYWx1ZSA9IGRlZlxuICAgICAgICBicmVha1xuICAgICAgY2FzZSBcIm9iamVjdFwiOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgLy8gb3IgYSBkZWZpbml0aW9uIG9iamVjdFxuICAgICAgICBkZWZhdWx0VmFsdWUgPSB0eXBlb2YgZGVmW1wiZGVmYXVsdFwiXSA9PSBcInVuZGVmaW5lZFwiID8gbnVsbCA6IGRlZltcImRlZmF1bHRcIl1cbiAgICAgICAgaWYgKHR5cGVvZiBkZWZbXCJ0eXBlXCJdID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICBpZiAoZGVmYXVsdFZhbHVlID09IG51bGwpIHtcbiAgICAgICAgICAgIHR5cGUgPSBcInN0cmluZ1wiXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdHlwZSA9IHR5cGVvZiBkZWZhdWx0VmFsdWVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdHlwZSA9IGRlZltcInR5cGVcIl1cbiAgICAgICAgfVxuICAgICAgICBnZXR0ZXIgPSBkZWZbXCJnZXRcIl1cbiAgICAgICAgc2V0dGVyID0gZGVmW1wic2V0XCJdXG4gICAgICAgIG9uY2hhbmdlID0gZGVmW1wib25jaGFuZ2VcIl1cbiAgICB9XG5cbiAgICB2YXIgcGFyc2VWYWx1ZVxuICAgIHZhciBzdHJpbmdpZnlWYWx1ZVxuICAgIHZhciBoYXNcblxuICAgIGhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT0gbnVsbCB9XG5cbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgICAgIGhhcyA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT09IGZhbHNlIH1cbiAgICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgIT0gbnVsbCB9XG4gICAgICAgIHN0cmluZ2lmeVZhbHVlID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gXCJcIiB9XG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHsgcmV0dXJuIHZhbHVlID09IG51bGwgPyBudWxsIDogcGFyc2VJbnQodmFsdWUsIDEwKSB9XG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIFwiZmxvYXRcIjpcbiAgICAgICAgcGFyc2VWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiBwYXJzZUZsb2F0KHZhbHVlKSB9XG4gICAgICAgIGJyZWFrXG4gICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBzdHJpbmdpZnlWYWx1ZSA9IGZ1bmN0aW9uICh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgPT0gbnVsbCA/IG51bGwgOiB2YWx1ZSA/IFwiXCIrdmFsdWUgOiBcIlwiIH1cbiAgICB9XG5cbiAgICBfYXR0cmlidXRlc1twcm9wZXJ0eV0gPSB7XG4gICAgICBnZXQ6IGdldCxcbiAgICAgIHNldDogc2V0LFxuICAgICAgaGFzOiBoYXMsXG4gICAgICBkZWZhdWx0VmFsdWU6IGRlZmF1bHRWYWx1ZSxcbiAgICAgIGhhc0RlZmF1bHQ6IGRlZmF1bHRWYWx1ZSAhPSBudWxsXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0KHVzZURlZmF1bHQpIHtcbiAgICAgIHZhciB2YWx1ZSA9IHRoaXMuZWxlbWVudC5nZXRBdHRyaWJ1dGUobmFtZSlcbiAgICAgIGlmICh2YWx1ZSA9PSBudWxsICYmIHVzZURlZmF1bHQgPT0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gZGVmYXVsdFZhbHVlXG4gICAgICB9XG4gICAgICByZXR1cm4gcGFyc2VWYWx1ZSA/IHBhcnNlVmFsdWUodmFsdWUpIDogdmFsdWVcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXQodmFsdWUsIGNhbGxPbmNoYW5nZSkge1xuICAgICAgdmFyIG9sZCA9IGdldC5jYWxsKHRoaXMsIGZhbHNlKVxuICAgICAgaWYgKCFoYXModmFsdWUpKSB7XG4gICAgICAgIHRoaXMuZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUobmFtZSlcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG9sZCA9PT0gdmFsdWUpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgdmFyIG5ld1ZhbHVlID0gc3RyaW5naWZ5VmFsdWUgPyBzdHJpbmdpZnlWYWx1ZSh2YWx1ZSkgOiB2YWx1ZVxuICAgICAgICB0aGlzLmVsZW1lbnQuc2V0QXR0cmlidXRlKG5hbWUsIG5ld1ZhbHVlKVxuICAgICAgfVxuICAgICAgb25jaGFuZ2UgJiYgY2FsbE9uY2hhbmdlICE9IGZhbHNlICYmIG9uY2hhbmdlLmNhbGwodGhpcywgb2xkLCB2YWx1ZSlcbiAgICB9XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG90eXBlLCBwcm9wZXJ0eSwge1xuICAgICAgZ2V0OiBnZXR0ZXIgfHwgZ2V0LFxuICAgICAgc2V0OiBzZXR0ZXIgfHwgc2V0XG4gICAgfSlcblxuICAgIHJldHVybiBDdXN0b21Db21wb25lbnRcbiAgfVxuXG4gIHJldHVybiBDdXN0b21Db21wb25lbnRcbn1cbiIsInZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBvbmVudFxuXG5mdW5jdGlvbiBjb21wb25lbnQgKG5hbWUsIHJvb3QsIG9wdGlvbnMpIHtcbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCB7fV0pXG4gIGlmICghKHJvb3QgaW5zdGFuY2VvZiBFbGVtZW50KSkge1xuICAgIG9wdGlvbnMgPSByb290XG4gICAgcm9vdCA9IG51bGxcbiAgfVxuICB2YXIgZWxlbWVudCA9IGhvb2suZmluZENvbXBvbmVudChuYW1lLCByb290KVxuXG4gIHJldHVybiBDb21wb25lbnQuY3JlYXRlKG5hbWUsIGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbmNvbXBvbmVudC5hbGwgPSBmdW5jdGlvbiAobmFtZSwgcm9vdCwgb3B0aW9ucykge1xuICAvLyBjb21wb25lbnQoXCJzdHJpbmdcIlssIHt9XSlcbiAgaWYgKCEocm9vdCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgb3B0aW9ucyA9IHJvb3RcbiAgICByb290ID0gbnVsbFxuICB9XG4gIC8vIGNvbXBvbmVudChcInN0cmluZ1wiWywgRWxlbWVudF0pXG4gIHZhciBlbGVtZW50cyA9IGhvb2suZmluZEFsbENvbXBvbmVudHMobmFtZSwgcm9vdClcblxuICByZXR1cm4gW10ubWFwLmNhbGwoZWxlbWVudHMsIGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gICAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUobmFtZSwgZWxlbWVudCwgb3B0aW9ucylcbiAgfSlcbn1cbiIsIi8qKlxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIG9uIGFuIGVsZW1lbnRcbiAqIGFuZCByZXR1cm5zIGEgZGVsZWdhdG9yLlxuICogQSBkZWxlZ2F0ZWQgZXZlbnQgcnVucyBtYXRjaGVzIHRvIGZpbmQgYW4gZXZlbnQgdGFyZ2V0LFxuICogdGhlbiBleGVjdXRlcyB0aGUgaGFuZGxlciBwYWlyZWQgd2l0aCB0aGUgbWF0Y2hlci5cbiAqIE1hdGNoZXJzIGNhbiBjaGVjayBpZiBhbiBldmVudCB0YXJnZXQgbWF0Y2hlcyBhIGdpdmVuIHNlbGVjdG9yLFxuICogb3Igc2VlIGlmIGFuIG9mIGl0cyBwYXJlbnRzIGRvLlxuICogKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVsZWdhdGUoIG9wdGlvbnMgKXtcbiAgICB2YXIgZWxlbWVudCA9IG9wdGlvbnMuZWxlbWVudFxuICAgICAgICAsIGV2ZW50ID0gb3B0aW9ucy5ldmVudFxuICAgICAgICAsIGNhcHR1cmUgPSAhIW9wdGlvbnMuY2FwdHVyZXx8ZmFsc2VcbiAgICAgICAgLCBjb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0fHxlbGVtZW50XG5cbiAgICBpZiggIWVsZW1lbnQgKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYW4ndCBkZWxlZ2F0ZSB1bmRlZmluZWQgZWxlbWVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBpZiggIWV2ZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGV2ZW50XCIpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIGRlbGVnYXRvciA9IGNyZWF0ZURlbGVnYXRvcihjb250ZXh0KVxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGVsZWdhdG9yLCBjYXB0dXJlKVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG4vKipcbiAqIFJldHVybnMgYSBkZWxlZ2F0b3IgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBldmVudCBsaXN0ZW5lci5cbiAqIFRoZSBkZWxlZ2F0b3IgaGFzIHN0YXRpYyBtZXRob2RzIHdoaWNoIGNhbiBiZSB1c2VkIHRvIHJlZ2lzdGVyIGhhbmRsZXJzLlxuICogKi9cbmZ1bmN0aW9uIGNyZWF0ZURlbGVnYXRvciggY29udGV4dCApe1xuICAgIHZhciBtYXRjaGVycyA9IFtdXG5cbiAgICBmdW5jdGlvbiBkZWxlZ2F0b3IoIGUgKXtcbiAgICAgICAgdmFyIGwgPSBtYXRjaGVycy5sZW5ndGhcbiAgICAgICAgaWYoICFsICl7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVsID0gdGhpc1xuICAgICAgICAgICAgLCBpID0gLTFcbiAgICAgICAgICAgICwgaGFuZGxlclxuICAgICAgICAgICAgLCBzZWxlY3RvclxuICAgICAgICAgICAgLCBkZWxlZ2F0ZUVsZW1lbnRcbiAgICAgICAgICAgICwgc3RvcFByb3BhZ2F0aW9uXG4gICAgICAgICAgICAsIGFyZ3NcblxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgYXJncyA9IG1hdGNoZXJzW2ldXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXVxuICAgICAgICAgICAgc2VsZWN0b3IgPSBhcmdzWzFdXG5cbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IG1hdGNoQ2FwdHVyZVBhdGgoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICAgICAgaWYoIGRlbGVnYXRlRWxlbWVudCAmJiBkZWxlZ2F0ZUVsZW1lbnQubGVuZ3RoICkge1xuICAgICAgICAgICAgICAgIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlID09PSBoYW5kbGVyLmFwcGx5KGNvbnRleHQsIFtlXS5jb25jYXQoZGVsZWdhdGVFbGVtZW50KSlcbiAgICAgICAgICAgICAgICBpZiggc3RvcFByb3BhZ2F0aW9uICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIGhhbmRsZXIgd2l0aCBhIHRhcmdldCBmaW5kZXIgbG9naWNcbiAgICAgKiAqL1xuICAgIGRlbGVnYXRvci5tYXRjaCA9IGZ1bmN0aW9uKCBzZWxlY3RvciwgaGFuZGxlciApe1xuICAgICAgICBtYXRjaGVycy5wdXNoKFtoYW5kbGVyLCBzZWxlY3Rvcl0pXG4gICAgICAgIHJldHVybiBkZWxlZ2F0b3JcbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZWdhdG9yXG59XG5cbmZ1bmN0aW9uIG1hdGNoQ2FwdHVyZVBhdGgoIHNlbGVjdG9yLCBlbCwgZSApe1xuICAgIHZhciBkZWxlZ2F0ZUVsZW1lbnRzID0gW11cbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50ID0gbnVsbFxuICAgIGlmKCBBcnJheS5pc0FycmF5KHNlbGVjdG9yKSApe1xuICAgICAgICB2YXIgaSA9IC0xXG4gICAgICAgIHZhciBsID0gc2VsZWN0b3IubGVuZ3RoXG4gICAgICAgIHdoaWxlKCArK2kgPCBsICl7XG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yW2ldLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCAhZGVsZWdhdGVFbGVtZW50ICkgcmV0dXJuIG51bGxcbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IGZpbmRQYXJlbnQoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgfVxuICAgIHJldHVybiBkZWxlZ2F0ZUVsZW1lbnRzXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIHRhcmdldCBvciBhbnkgb2YgaXRzIHBhcmVudCBtYXRjaGVzIGEgc2VsZWN0b3JcbiAqICovXG5mdW5jdGlvbiBmaW5kUGFyZW50KCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXRcbiAgICBzd2l0Y2goIHR5cGVvZiBzZWxlY3RvciApe1xuICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgICAgICB3aGlsZSggdGFyZ2V0ICYmIHRhcmdldCAhPSBlbCApe1xuICAgICAgICAgICAgICAgIGlmKCB0YXJnZXQubWF0Y2hlcyhzZWxlY3RvcikgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggc2VsZWN0b3IuY2FsbChlbCwgdGFyZ2V0KSApIHJldHVybiB0YXJnZXRcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIHJldHVybiBudWxsXG59XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZyYWdtZW50XG5cbmZyYWdtZW50Lm9wdGlvbnMgPSB7XG4gIHZhcmlhYmxlOiBcImZcIlxufVxuXG5mdW5jdGlvbiBmcmFnbWVudCggaHRtbCwgY29tcGlsZXIsIGNvbXBpbGVyT3B0aW9ucyApe1xuICBjb21waWxlck9wdGlvbnMgPSBtZXJnZShmcmFnbWVudC5vcHRpb25zLCBjb21waWxlck9wdGlvbnMpXG4gIHZhciByZW5kZXIgPSBudWxsXG4gIHJldHVybiBmdW5jdGlvbiggdGVtcGxhdGVEYXRhICl7XG4gICAgdmFyIHRlbXAgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxuICAgIGlmKCB0eXBlb2YgY29tcGlsZXIgPT0gXCJmdW5jdGlvblwiICYmICFyZW5kZXIgKXtcbiAgICAgIHJlbmRlciA9IGNvbXBpbGVyKGh0bWwsIGNvbXBpbGVyT3B0aW9ucylcbiAgICB9XG4gICAgaWYoIHJlbmRlciApe1xuICAgICAgdHJ5e1xuICAgICAgICBodG1sID0gcmVuZGVyKHRlbXBsYXRlRGF0YSlcbiAgICAgIH1cbiAgICAgIGNhdGNoKCBlICl7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZW5kZXJpbmcgZnJhZ21lbnQgd2l0aCBjb250ZXh0OlwiLCB0ZW1wbGF0ZURhdGEpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IocmVuZGVyLnRvU3RyaW5nKCkpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSlcbiAgICAgICAgdGhyb3cgZVxuICAgICAgfVxuICAgIH1cblxuICAgIHRlbXAuaW5uZXJIVE1MID0gaHRtbFxuICAgIHZhciBmcmFnbWVudCA9IHdpbmRvdy5kb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KClcbiAgICB3aGlsZSggdGVtcC5jaGlsZE5vZGVzLmxlbmd0aCApe1xuICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGVtcC5maXJzdENoaWxkKVxuICAgIH1cbiAgICByZXR1cm4gZnJhZ21lbnRcbiAgfVxufVxuZnJhZ21lbnQucmVuZGVyID0gZnVuY3Rpb24oIGh0bWwsIHRlbXBsYXRlRGF0YSApe1xuICByZXR1cm4gZnJhZ21lbnQoaHRtbCkodGVtcGxhdGVEYXRhKVxufVxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBDT01QT05FTlRfQVRUUklCVVRFID0gXCJkYXRhLWNvbXBvbmVudFwiXG5cbnZhciBob29rID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG5ob29rLnNldEhvb2tBdHRyaWJ1dGUgPSBzZXRIb29rQXR0cmlidXRlXG5ob29rLnNlbGVjdG9yID0gc2VsZWN0b3Jcbmhvb2suZmluZENvbXBvbmVudCA9IGZpbmRDb21wb25lbnRcbmhvb2suZmluZEFsbENvbXBvbmVudHMgPSBmaW5kQWxsQ29tcG9uZW50c1xuaG9vay5maW5kU3ViQ29tcG9uZW50cyA9IGZpbmRTdWJDb21wb25lbnRzXG5ob29rLmdldENvbXBvbmVudE5hbWUgPSBnZXRDb21wb25lbnROYW1lXG5ob29rLmdldE1haW5Db21wb25lbnROYW1lID0gZ2V0TWFpbkNvbXBvbmVudE5hbWVcbmhvb2suZ2V0U3ViQ29tcG9uZW50TmFtZSA9IGdldFN1YkNvbXBvbmVudE5hbWVcbmhvb2suYXNzaWduU3ViQ29tcG9uZW50cyA9IGFzc2lnblN1YkNvbXBvbmVudHNcbmhvb2suZmlsdGVyID0gZmlsdGVyXG5cbmZ1bmN0aW9uIHNldEhvb2tBdHRyaWJ1dGUgKGhvb2spIHtcbiAgQ09NUE9ORU5UX0FUVFJJQlVURSA9IGhvb2tcbn1cblxuZnVuY3Rpb24gc2VsZWN0b3IgKG5hbWUsIG9wZXJhdG9yLCBleHRyYSkge1xuICBuYW1lID0gbmFtZSAmJiAnXCInICsgbmFtZSArICdcIidcbiAgb3BlcmF0b3IgPSBuYW1lID8gb3BlcmF0b3IgfHwgXCI9XCIgOiBcIlwiXG4gIGV4dHJhID0gZXh0cmEgfHwgXCJcIlxuICByZXR1cm4gXCJbXCIgKyBDT01QT05FTlRfQVRUUklCVVRFICsgb3BlcmF0b3IgKyBuYW1lICsgXCJdXCIgKyBleHRyYVxufVxuXG5mdW5jdGlvbiBmaW5kIChzZWxlY3Rvciwgcm9vdCkge1xuICByZXR1cm4gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpXG59XG5cbmZ1bmN0aW9uIGZpbmRBbGwgKHNlbGVjdG9yLCByb290KSB7XG4gIHJldHVybiAocm9vdCB8fCBkb2N1bWVudCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcilcbn1cblxuZnVuY3Rpb24gZmluZENvbXBvbmVudCAobmFtZSwgcm9vdCkge1xuICByZXR1cm4gZmluZChzZWxlY3RvcihuYW1lKSwgcm9vdClcbn1cblxuZnVuY3Rpb24gZmluZEFsbENvbXBvbmVudHMgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZmluZEFsbChzZWxlY3RvcihuYW1lKSwgcm9vdCkpXG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudE5hbWUgKGVsZW1lbnQsIGNjKSB7XG4gIGlmICghZWxlbWVudCkgcmV0dXJuIFwiXCJcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gdHlwZW9mIGVsZW1lbnQgPT0gXCJzdHJpbmdcIiA/IGVsZW1lbnQgOiBlbGVtZW50LmdldEF0dHJpYnV0ZShDT01QT05FTlRfQVRUUklCVVRFKSB8fCBcIlwiXG4gIHJldHVybiBjYyA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRNYWluQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMF0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0U3ViQ29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50LCBmYWxzZSkuc3BsaXQoXCI6XCIpXG4gIHZhbHVlID0gdmFsdWVbMV0gfHwgXCJcIlxuICByZXR1cm4gY2MgJiYgdmFsdWUgPyBjYW1lbGNhc2UodmFsdWUpIDogdmFsdWVcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50TmFtZUxpc3QgKGVsZW1lbnQsIGNjKSB7XG4gIHJldHVybiBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGNjKS5zcGxpdCgvXFxzKy8pXG59XG5cbmZ1bmN0aW9uIGZpbmRTdWJDb21wb25lbnRzIChtYWluTmFtZSwgcm9vdCkge1xuICB2YXIgZWxlbWVudHMgPSBmaW5kQWxsKHNlbGVjdG9yKG1haW5OYW1lK1wiOlwiLCBcIio9XCIpLCByb290KVxuICByZXR1cm4gZmlsdGVyKGVsZW1lbnRzLCBmdW5jdGlvbiAoZWxlbWVudCwgY29tcG9uZW50TmFtZSkge1xuICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lTGlzdChjb21wb25lbnROYW1lLCBmYWxzZSkuc29tZShmdW5jdGlvbiAobmFtZSkge1xuICAgICAgcmV0dXJuIGdldE1haW5Db21wb25lbnROYW1lKG5hbWUsIGZhbHNlKSA9PSBtYWluTmFtZSAmJiBnZXRTdWJDb21wb25lbnROYW1lKG5hbWUpXG4gICAgfSlcbiAgfSlcbn1cblxuZnVuY3Rpb24gYXNzaWduU3ViQ29tcG9uZW50cyAob2JqLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0sIGFzc2lnbikge1xuICByZXR1cm4gc3ViQ29tcG9uZW50cy5yZWR1Y2UoZnVuY3Rpb24gKG9iaiwgZWxlbWVudCkge1xuICAgIGdldENvbXBvbmVudE5hbWVMaXN0KGVsZW1lbnQsIGZhbHNlKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICB2YXIgc3ViTmFtZSA9IGdldFN1YkNvbXBvbmVudE5hbWUobmFtZSwgdHJ1ZSlcbiAgICAgIGVsZW1lbnQgPSB0eXBlb2YgdHJhbnNmb3JtID09IFwiZnVuY3Rpb25cIlxuICAgICAgICAgIC8vIFRPRE86IHN1YmNsYXNzIHN1YmNvbXBvbmVudHMgc2hvdWxkIGJlIGhhbmRsZWQgcHJvcGVybHkgKEIgZXh0ZW5kcyBBIHRoYXQgaGFzIGEgc3ViY29tcG9uZW50IEE6YSBiZWNvbWVzIEI6YSB0aGF0J3Mgbm90IGluIHRoZSByZWdpc3RyeSlcbiAgICAgICAgICA/IHRyYW5zZm9ybShlbGVtZW50LCBuYW1lKVxuICAgICAgICAgIDogZWxlbWVudFxuICAgICAgaWYgKHR5cGVvZiBhc3NpZ24gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGFzc2lnbihvYmosIHN1Yk5hbWUsIGVsZW1lbnQpXG4gICAgICB9XG4gICAgICBlbHNlIGlmIChBcnJheS5pc0FycmF5KG9ialtzdWJOYW1lXSkpIHtcbiAgICAgICAgb2JqW3N1Yk5hbWVdLnB1c2goZWxlbWVudClcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBvYmpbc3ViTmFtZV0gPSBlbGVtZW50XG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gb2JqXG4gIH0sIG9iailcbn1cblxuZnVuY3Rpb24gZmlsdGVyIChlbGVtZW50cywgZmlsdGVyKSB7XG4gIHN3aXRjaCAodHlwZW9mIGZpbHRlcikge1xuICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZmlsdGVyKGVsZW1lbnQsIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgcmV0dXJuIFtdLnNsaWNlLmNhbGwoZWxlbWVudHMpLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICByZXR1cm4gZ2V0Q29tcG9uZW50TmFtZShlbGVtZW50KSA9PT0gZmlsdGVyXG4gICAgICB9KVxuICAgICAgYnJlYWtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuIiwidmFyIHJlZ2lzdHJ5ID0gcmVxdWlyZShcIi4vcmVnaXN0cnlcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBJbnRlcm5hbHMgPSByZXF1aXJlKFwiLi9JbnRlcm5hbHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZWdpc3RlciAobmFtZSwgbWl4aW4pIHtcbiAgbWl4aW4gPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSlcblxuICBmdW5jdGlvbiBDdXN0b21Db21wb25lbnQgKGVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ3VzdG9tQ29tcG9uZW50KSkge1xuICAgICAgcmV0dXJuIG5ldyBDdXN0b21Db21wb25lbnQoZWxlbWVudCwgb3B0aW9ucylcbiAgICB9XG4gICAgdmFyIGluc3RhbmNlID0gdGhpc1xuXG4gICAgdGhpcy5uYW1lID0gbmFtZVxuXG4gICAgQ29tcG9uZW50LmNhbGwoaW5zdGFuY2UsIGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgLy8gYXQgdGhpcyBwb2ludCBjdXN0b20gY29uc3RydWN0b3JzIGNhbiBhbHJlYWR5IGFjY2VzcyB0aGUgZWxlbWVudCBhbmQgc3ViIGNvbXBvbmVudHNcbiAgICAvLyBzbyB0aGV5IG9ubHkgcmVjZWl2ZSB0aGUgb3B0aW9ucyBvYmplY3QgZm9yIGNvbnZlbmllbmNlXG4gICAgQ3VzdG9tQ29tcG9uZW50LmNyZWF0ZShpbnN0YW5jZSwgW29wdGlvbnNdKVxuICB9XG5cbiAgSW50ZXJuYWxzKEN1c3RvbUNvbXBvbmVudCwgbmFtZSlcbiAgQ3VzdG9tQ29tcG9uZW50LmV4dGVuZChDb21wb25lbnQpXG4gIEN1c3RvbUNvbXBvbmVudC5hdXRvQXNzaWduID0gdHJ1ZVxuICBtaXhpbi5mb3JFYWNoKGZ1bmN0aW9uIChtaXhpbikge1xuICAgIGlmICh0eXBlb2YgbWl4aW4gPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBpZiAobWl4aW4uY29tcG9uZW50TmFtZSkge1xuICAgICAgICBDdXN0b21Db21wb25lbnQuZXh0ZW5kKG1peGluKVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG1peGluLmNhbGwoQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSwgQ3VzdG9tQ29tcG9uZW50KVxuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIEN1c3RvbUNvbXBvbmVudC5wcm90byhtaXhpbilcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJlZ2lzdHJ5LnNldChuYW1lLCBDdXN0b21Db21wb25lbnQpXG59XG4iLCJ2YXIgcmVnaXN0cnkgPSBtb2R1bGUuZXhwb3J0cyA9IHt9XG5cbnZhciBjb21wb25lbnRzID0ge31cblxucmVnaXN0cnkuZ2V0ID0gZnVuY3Rpb24gZXhpc3RzIChuYW1lKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdXG59XG5cbnJlZ2lzdHJ5LmV4aXN0cyA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gISFjb21wb25lbnRzW25hbWVdXG59XG5cbnJlZ2lzdHJ5LnNldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSwgQ29tcG9uZW50Q29uc3RydWN0b3IpIHtcbiAgcmV0dXJuIGNvbXBvbmVudHNbbmFtZV0gPSBDb21wb25lbnRDb25zdHJ1Y3RvclxufVxuIiwidmFyIGhvb2sgPSByZXF1aXJlKFwiLi9ob29rXCIpXG52YXIgY2FtZWxjYXNlID0gcmVxdWlyZShcImNhbWVsY2FzZVwiKVxuXG52YXIgc3RvcmFnZSA9IG1vZHVsZS5leHBvcnRzID0ge31cbnZhciBjb21wb25lbnRzID0gW11cbnZhciBlbGVtZW50cyA9IFtdXG52YXIgY291bnRlciA9IDBcblxuZnVuY3Rpb24gY3JlYXRlUHJvcGVydHkgKGNvbXBvbmVudE5hbWUpIHtcbiAgcmV0dXJuIGNhbWVsY2FzZShjb21wb25lbnROYW1lK1wiLWlkXCIpXG59XG5cbmZ1bmN0aW9uIGdldElkIChlbGVtZW50LCBjb21wb25lbnROYW1lKSB7XG4gIHJldHVybiBlbGVtZW50LmRhdGFzZXRbY3JlYXRlUHJvcGVydHkoY29tcG9uZW50TmFtZSldXG59XG5cbmZ1bmN0aW9uIHNldElkIChlbGVtZW50LCBjb21wb25lbnROYW1lLCBpZCkge1xuICBlbGVtZW50LmRhdGFzZXRbY3JlYXRlUHJvcGVydHkoY29tcG9uZW50TmFtZSldID0gaWRcbn1cblxuZnVuY3Rpb24gaGFzSWQgKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpIHtcbiAgcmV0dXJuICEhKGVsZW1lbnQuZGF0YXNldFtjcmVhdGVQcm9wZXJ0eShjb21wb25lbnROYW1lKV0pXG59XG5cbmZ1bmN0aW9uIHJlbW92ZUlkIChlbGVtZW50LCBjb21wb25lbnROYW1lKSB7XG4gIGlmIChoYXNJZChlbGVtZW50LCBjb21wb25lbnROYW1lKSkge1xuICAgIGRlbGV0ZSBlbGVtZW50LmRhdGFzZXRbY3JlYXRlUHJvcGVydHkoY29tcG9uZW50TmFtZSldXG4gIH1cbn1cblxuc3RvcmFnZS5nZXQgPSBmdW5jdGlvbiAoZWxlbWVudCwgY29tcG9uZW50TmFtZSkge1xuICB2YXIgc3RvcmUgPSBjb21wb25lbnRzW2dldElkKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUpXVxuICByZXR1cm4gc3RvcmUgPyBzdG9yZVtjb21wb25lbnROYW1lXSA6IG51bGxcbn1cbnN0b3JhZ2Uuc2F2ZSA9IGZ1bmN0aW9uIChjb21wb25lbnQpIHtcbiAgaWYgKGNvbXBvbmVudC5lbGVtZW50KSB7XG4gICAgdmFyIGlkID0gY29tcG9uZW50Ll9pZFxuICAgIHZhciBjb21wb25lbnROYW1lID0gY29tcG9uZW50Lm5hbWVcbiAgICB2YXIgc3RvcmVcblxuICAgIGlmICghaWQpIHtcbiAgICAgIGlkID0gKytjb3VudGVyXG4gICAgICBzZXRJZChjb21wb25lbnQuZWxlbWVudCwgY29tcG9uZW50TmFtZSwgaWQpXG4gICAgICBjb21wb25lbnQuX2lkID0gaWRcbiAgICB9XG5cbiAgICBzdG9yZSA9IGNvbXBvbmVudHNbaWRdXG4gICAgaWYgKCFzdG9yZSkge1xuICAgICAgc3RvcmUgPSBjb21wb25lbnRzW2lkXSA9IHtsZW5ndGg6IDB9XG4gICAgfVxuXG4gICAgaWYgKHN0b3JlW2NvbXBvbmVudE5hbWVdICE9PSBjb21wb25lbnQpIHtcbiAgICAgICsrc3RvcmUubGVuZ3RoXG4gICAgICBzdG9yZVtjb21wb25lbnROYW1lXSA9IGNvbXBvbmVudFxuICAgIH1cblxuICAgIHZhciBleGlzdGluZ0VsZW1lbnQgPSBlbGVtZW50c1tpZF1cbiAgICBpZiAoZXhpc3RpbmdFbGVtZW50KSB7XG4gICAgICByZW1vdmVJZChleGlzdGluZ0VsZW1lbnQsIGNvbXBvbmVudE5hbWUpXG4gICAgICBzZXRJZChjb21wb25lbnQuZWxlbWVudCwgY29tcG9uZW50TmFtZSwgaWQpXG4gICAgfVxuXG4gICAgZWxlbWVudHNbaWRdID0gY29tcG9uZW50LmVsZW1lbnRcbiAgfVxufVxuc3RvcmFnZS5yZW1vdmUgPSBmdW5jdGlvbiAoY29tcG9uZW50LCBvbmx5Q29tcG9uZW50KSB7XG4gIHZhciBlbGVtZW50ID0gY29tcG9uZW50IGluc3RhbmNlb2YgRWxlbWVudFxuICAgICAgPyBjb21wb25lbnRcbiAgICAgIDogY29tcG9uZW50LmVsZW1lbnRcbiAgdmFyIGNvbXBvbmVudE5hbWUgPSBjb21wb25lbnQubmFtZVxuICB2YXIgaWQgPSBnZXRJZChlbGVtZW50LCBjb21wb25lbnROYW1lKVxuICB2YXIgc3RvcmUgPSBjb21wb25lbnRzW2lkXVxuXG4gIGlmIChjb21wb25lbnQgaW5zdGFuY2VvZiBFbGVtZW50KSB7XG4gICAgaWYgKG9ubHlDb21wb25lbnQpIHtcbiAgICAgIGlmIChkZWxldGUgc3RvcmVbb25seUNvbXBvbmVudF0pIC0tc3RvcmUubGVuZ3RoXG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgZm9yICh2YXIgcHJvcCBpbiBzdG9yZSkge1xuICAgICAgICBpZiAoc3RvcmUuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgc3RvcmVbcHJvcF0uX2lkID0gbnVsbFxuICAgICAgICAgIC8vLS1zdG9yZS5sZW5ndGhcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZGVsZXRlIGNvbXBvbmVudHNbaWRdXG4gICAgfVxuICB9XG4gIGVsc2Uge1xuICAgIHZhciBleGlzdGluZyA9IHN0b3JlW2NvbXBvbmVudE5hbWVdXG4gICAgaWYgKGV4aXN0aW5nID09IGNvbXBvbmVudCkge1xuICAgICAgZXhpc3RpbmcuX2lkID0gbnVsbFxuICAgICAgZGVsZXRlIHN0b3JlW2NvbXBvbmVudE5hbWVdXG4gICAgICAtLXN0b3JlLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIGlmIChzdG9yZSAmJiAhc3RvcmUubGVuZ3RoKSB7XG4gICAgcmVtb3ZlSWQoZWxlbWVudHNbaWRdLCBjb21wb25lbnROYW1lKVxuICAgIGRlbGV0ZSBlbGVtZW50c1tpZF1cbiAgfVxufVxuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGV4dGVuZCggb2JqLCBleHRlbnNpb24gKXtcbiAgZm9yKCB2YXIgbmFtZSBpbiBleHRlbnNpb24gKXtcbiAgICBpZiggZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KG5hbWUpICkgb2JqW25hbWVdID0gZXh0ZW5zaW9uW25hbWVdXG4gIH1cbiAgcmV0dXJuIG9ialxufVxuIiwidmFyIGV4dGVuZCA9IHJlcXVpcmUoXCIuL2V4dGVuZFwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBvYmosIGV4dGVuc2lvbiApe1xuICByZXR1cm4gZXh0ZW5kKGV4dGVuZCh7fSwgb2JqKSwgZXh0ZW5zaW9uKVxufVxuIiwidmFyIG9iamVjdCA9IG1vZHVsZS5leHBvcnRzID0ge31cblxub2JqZWN0LmFjY2Vzc29yID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZ2V0LCBzZXQpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIGdldDogZ2V0LFxuICAgIHNldDogc2V0XG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVHZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgZ2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QuZGVmaW5lU2V0dGVyID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHNldDogZm5cbiAgfSlcbn1cblxub2JqZWN0Lm1ldGhvZCA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICB2YWx1ZTogZm5cbiAgfSlcbn1cblxub2JqZWN0LnByb3BlcnR5ID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmbixcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn1cbiJdfQ==
