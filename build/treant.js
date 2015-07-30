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
plugins.dispatcher = require("./plugins/dispatcher")
plugins.findBy = require("./plugins/findBy")

var util = {}
treant.util = util

util.extend = require("./util/extend")
util.merge = require("./util/merge")
util.object = require("./util/object")

},{"./plugins/attributes":4,"./plugins/dispatcher":5,"./plugins/findBy":6,"./src/Component":7,"./src/create":8,"./src/delegate":9,"./src/fragment":10,"./src/hook":11,"./src/register":12,"./util/extend":14,"./util/merge":15,"./util/object":16}],2:[function(require,module,exports){
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
/*
 * index.js: Simple pattern for deferable events, when you want an action to be interruptable
 *
 * action - string
 * args... - anything
 * performFn - once all "before" deferences are done call this function,
 *             then call all "after" deferences.
 * onFinish - once all "after" deferences are done call this function.
 *
 */
module.exports = Understudy;
module.exports.Understudy = Understudy;

function Understudy() {
  this.perform = perform;
  this.after = registrar('_after_interceptors');
  this.before = registrar('_before_interceptors');
  this._before_interceptors = null;
  this._after_interceptors = null;
  return this;
}

function registrar(property) {
  return function (action, callback) {
    if (typeof action === 'string') {
      if (typeof callback === 'function') {
        this[property] || (this[property] = {});
        this[property][action] || (this[property][action] = []);
        var interceptors = this[property][action];
        interceptors[interceptors.length] = callback;
        return this;
      }
      else {
        throw new Error('callback must be a function');
      }
    }
    throw new Error('event must be a string');
  }
}

function perform(action /* , args..., performFn, callback*/) {
  if (typeof action !== 'string') throw new Error('event must be a string');
  var callback = arguments[arguments.length - 1];
  var performFn = arguments[arguments.length - 2];
  var slice = -2;
  if (typeof performFn !== 'function') {
    if (typeof callback !== 'function') {
      throw new Error('performFn and callback must be a function');
    }

    performFn = callback;
    callback = null;
    slice = -1;
  }

  //
  // Get "arguments" Array and set first to null to indicate
  // to nextInterceptor that there is no error.
  //
  var args = Array.prototype.slice.call(arguments, 0, slice);
  args[0] = null;

  //
  // This is called in multiple temporal localities, put into a function instead of inline
  // minor speed loss for more maintainability
  //
  function iterate(self, interceptors, args, after) {
    if (!interceptors) {
      after.apply(self, args);
      return;
    }

    interceptors = interceptors.concat();
    var i = 0;
    var len = interceptors.length;
    if (!len) {
      after.apply(self, args);
      return;
    }

    function nextInterceptor() {
      if (i === len) {
        i++;
        after.apply(self, arguments);
      }
      else if (i < len) {
        var used = false;
        var interceptor = interceptors[i++];
        interceptor.apply(self, Array.prototype.slice.call(arguments, 1).concat(function next(err) {
          //
          // Do not allow multiple continuations
          //
          if (used) { return; }

          used = true;
          if (!err || !callback) {
            nextInterceptor.apply(null, args);
          } else {
            after.call(self, err);
          }
        }));
      }
    }
    nextInterceptor.apply(null, args);
  }

  //
  // Remark (jcrugzz): Is this the most optimized way to do this?
  //
  function executePerform(err) {
    var self = this;
    if (err && callback) {
      callback.call(this, err);
    } else {
      //
      // Remark (indexzero): Should we console.warn if `arguments.length > 1` here?
      //
      performFn.call(this, function afterPerform(err) {
        var performArgs;
        if (err && callback) {
          callback.call(self, err);
        } else {
          performArgs = Array.prototype.slice.call(arguments);
          iterate(self, self._after_interceptors && self._after_interceptors[action], args, function (err) {
            if (err && callback) {
              callback.call(self, err);
            } else if (callback) {
              callback.apply(self, performArgs);
            }
          });
        }
      })
    }
  }

  iterate(this, this._before_interceptors && this._before_interceptors[action], args, executePerform);
  return this;
}

},{}],4:[function(require,module,exports){
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

},{"../util/object":16}],5:[function(require,module,exports){
var object = require("../util/object")
var merge = require("../util/merge")

var defaultDefinition = {
  detail: null,
  view: window,
  bubbles: true,
  cancelable: true
}

module.exports = function (eventDefinitions) {
  return function plugin(prototype) {
    var definitions = eventDefinitions || {}

    object.method(prototype, "defineEvent", function (type, definition) {
      definitions[type] = definition
    })

    object.method(prototype, "dispatch", function (type, detail) {
      var definition = merge(defaultDefinition, definitions[type])
      definition.detail = detail || definition.detail
      return this.dispatchEvent(new window.CustomEvent(type, definition))
    })
  }
}

},{"../util/merge":15,"../util/object":16}],6:[function(require,module,exports){
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

},{"../util/object":16}],7:[function(require,module,exports){
var understudy = require("understudy")
var hook = require("./hook")
var registry = require("./registry")
var delegate = require("./delegate")

module.exports = Component

function Component (element, options) {
  if (!(this instanceof Component)) {
    return new Component(element, options)
  }

  this.element = element || null
  this.components = {}

  if (this.element && this.autoAssign) {
    this.assignSubComponents()
  }
}

Component.create = function (element, options) {
  var name = hook.getComponentName(element, false)
  var ComponentConstructor = null

  if (registry.exists(name)) {
    ComponentConstructor =  registry.get(name)
  }
  else {
    console.warn("Missing custom component '%s' for ", name, element)
    ComponentConstructor = registry.get("*") || Component
  }

  return new ComponentConstructor(element, options)
}

Component.prototype = {
  autoAssign: true,

  delegate: function (options) {
    options.element = this.element
    options.context = options.context || this
    return delegate(options)
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
    var subComponents = hook.findSubComponents(hostComponent.getMainComponentName(false), hostComponent.element)

    if (!subComponents.length) {
      return
    }

    hostComponent.perform("assignSubComponents", hostComponent, function () {
      hook.assignSubComponents(hostComponent.components, subComponents, transform || function (element, name) {
        return Component.create(element, hostComponent)
      })
    })
  }
}

understudy.call(Component.prototype)

},{"./delegate":9,"./hook":11,"./registry":13,"understudy":3}],8:[function(require,module,exports){
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

},{"./Component":7,"./hook":11}],9:[function(require,module,exports){
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

},{}],10:[function(require,module,exports){
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

},{"../util/merge":15}],11:[function(require,module,exports){
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

function assignSubComponents (obj, subComponents, transform) {
  return subComponents.reduce(function (obj, element) {
    var name = getSubComponentName(element)
    if (name) {
      element = transform
        ? transform(element, name)
        : element
      if (Array.isArray(obj[name])) {
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

},{"camelcase":2}],12:[function(require,module,exports){
var registry = require("./registry")
var Component = require("./Component")

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
    instance.perform("create", instance, function () {
      Component.call(instance, element, options)
      // at this point custom constructors can already access the element
      // so they only receive the options object for convenience
      ComponentConstructor.call(instance, options)
    })
  }

  CustomComponent.prototype = new Component()
  mixin.forEach(function (mixin) {
    mixin(CustomComponent.prototype)
  })

  return registry.set(name, CustomComponent)
  // define main prototype after registering
}

},{"./Component":7,"./registry":13}],13:[function(require,module,exports){
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

},{}],14:[function(require,module,exports){
module.exports = function extend( obj, extension ){
  for( var name in extension ){
    if( extension.hasOwnProperty(name) ) obj[name] = extension[name]
  }
  return obj
}

},{}],15:[function(require,module,exports){
var extend = require("./extend")

module.exports = function( obj, extension ){
  return extension(extend({}, obj), extension)
}

},{"./extend":14}],16:[function(require,module,exports){
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