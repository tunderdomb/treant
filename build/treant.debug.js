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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jYW1lbGNhc2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdW5kZXJzdHVkeS9pbmRleC5qcyIsInBsdWdpbnMvYXR0cmlidXRlcy5qcyIsInBsdWdpbnMvZGlzcGF0Y2hlci5qcyIsInBsdWdpbnMvZmluZEJ5LmpzIiwic3JjL0NvbXBvbmVudC5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZGVsZWdhdGUuanMiLCJzcmMvZnJhZ21lbnQuanMiLCJzcmMvaG9vay5qcyIsInNyYy9yZWdpc3Rlci5qcyIsInNyYy9yZWdpc3RyeS5qcyIsInV0aWwvZXh0ZW5kLmpzIiwidXRpbC9tZXJnZS5qcyIsInV0aWwvb2JqZWN0LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBob29rID0gcmVxdWlyZShcIi4vc3JjL2hvb2tcIilcbnZhciByZWdpc3RlciA9IHJlcXVpcmUoXCIuL3NyYy9yZWdpc3RlclwiKVxudmFyIGNvbXBvbmVudCA9IHJlcXVpcmUoXCIuL3NyYy9jcmVhdGVcIilcbnZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9zcmMvQ29tcG9uZW50XCIpXG52YXIgZGVsZWdhdGUgPSByZXF1aXJlKFwiLi9zcmMvZGVsZWdhdGVcIilcbnZhciBmcmFnbWVudCA9IHJlcXVpcmUoXCIuL3NyYy9mcmFnbWVudFwiKVxuXG52YXIgdHJlYW50ID0ge31cbm1vZHVsZS5leHBvcnRzID0gdHJlYW50XG5cbnRyZWFudC5yZWdpc3RlciA9IHJlZ2lzdGVyXG50cmVhbnQuY29tcG9uZW50ID0gY29tcG9uZW50XG50cmVhbnQuQ29tcG9uZW50ID0gQ29tcG9uZW50XG50cmVhbnQuZGVsZWdhdGUgPSBkZWxlZ2F0ZVxudHJlYW50LmZyYWdtZW50ID0gZnJhZ21lbnRcbnRyZWFudC5ob29rID0gaG9va1xuXG52YXIgcGx1Z2lucyA9IHt9XG50cmVhbnQucGx1Z2lucyA9IHBsdWdpbnNcblxucGx1Z2lucy5hdHRyaWJ1dGVzID0gcmVxdWlyZShcIi4vcGx1Z2lucy9hdHRyaWJ1dGVzXCIpXG5wbHVnaW5zLmRpc3BhdGNoZXIgPSByZXF1aXJlKFwiLi9wbHVnaW5zL2Rpc3BhdGNoZXJcIilcbnBsdWdpbnMuZmluZEJ5ID0gcmVxdWlyZShcIi4vcGx1Z2lucy9maW5kQnlcIilcblxudmFyIHV0aWwgPSB7fVxudHJlYW50LnV0aWwgPSB1dGlsXG5cbnV0aWwuZXh0ZW5kID0gcmVxdWlyZShcIi4vdXRpbC9leHRlbmRcIilcbnV0aWwubWVyZ2UgPSByZXF1aXJlKFwiLi91dGlsL21lcmdlXCIpXG51dGlsLm9iamVjdCA9IHJlcXVpcmUoXCIuL3V0aWwvb2JqZWN0XCIpXG4iLCIndXNlIHN0cmljdCc7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzdHIpIHtcblx0c3RyID0gc3RyLnRyaW0oKTtcblxuXHRpZiAoc3RyLmxlbmd0aCA9PT0gMSB8fCAhKC9bXy5cXC0gXSsvKS50ZXN0KHN0cikgKSB7XG5cdFx0aWYgKHN0clswXSA9PT0gc3RyWzBdLnRvTG93ZXJDYXNlKCkgJiYgc3RyLnNsaWNlKDEpICE9PSBzdHIuc2xpY2UoMSkudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIHN0cjtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRyZXR1cm4gc3RyXG5cdC5yZXBsYWNlKC9eW18uXFwtIF0rLywgJycpXG5cdC50b0xvd2VyQ2FzZSgpXG5cdC5yZXBsYWNlKC9bXy5cXC0gXSsoXFx3fCQpL2csIGZ1bmN0aW9uIChtLCBwMSkge1xuXHRcdHJldHVybiBwMS50b1VwcGVyQ2FzZSgpO1xuXHR9KTtcbn07XG4iLCIvKlxuICogaW5kZXguanM6IFNpbXBsZSBwYXR0ZXJuIGZvciBkZWZlcmFibGUgZXZlbnRzLCB3aGVuIHlvdSB3YW50IGFuIGFjdGlvbiB0byBiZSBpbnRlcnJ1cHRhYmxlXG4gKlxuICogYWN0aW9uIC0gc3RyaW5nXG4gKiBhcmdzLi4uIC0gYW55dGhpbmdcbiAqIHBlcmZvcm1GbiAtIG9uY2UgYWxsIFwiYmVmb3JlXCIgZGVmZXJlbmNlcyBhcmUgZG9uZSBjYWxsIHRoaXMgZnVuY3Rpb24sXG4gKiAgICAgICAgICAgICB0aGVuIGNhbGwgYWxsIFwiYWZ0ZXJcIiBkZWZlcmVuY2VzLlxuICogb25GaW5pc2ggLSBvbmNlIGFsbCBcImFmdGVyXCIgZGVmZXJlbmNlcyBhcmUgZG9uZSBjYWxsIHRoaXMgZnVuY3Rpb24uXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IFVuZGVyc3R1ZHk7XG5tb2R1bGUuZXhwb3J0cy5VbmRlcnN0dWR5ID0gVW5kZXJzdHVkeTtcblxuZnVuY3Rpb24gVW5kZXJzdHVkeSgpIHtcbiAgdGhpcy5wZXJmb3JtID0gcGVyZm9ybTtcbiAgdGhpcy5hZnRlciA9IHJlZ2lzdHJhcignX2FmdGVyX2ludGVyY2VwdG9ycycpO1xuICB0aGlzLmJlZm9yZSA9IHJlZ2lzdHJhcignX2JlZm9yZV9pbnRlcmNlcHRvcnMnKTtcbiAgdGhpcy5fYmVmb3JlX2ludGVyY2VwdG9ycyA9IG51bGw7XG4gIHRoaXMuX2FmdGVyX2ludGVyY2VwdG9ycyA9IG51bGw7XG4gIHJldHVybiB0aGlzO1xufVxuXG5mdW5jdGlvbiByZWdpc3RyYXIocHJvcGVydHkpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChhY3Rpb24sIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBhY3Rpb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXNbcHJvcGVydHldIHx8ICh0aGlzW3Byb3BlcnR5XSA9IHt9KTtcbiAgICAgICAgdGhpc1twcm9wZXJ0eV1bYWN0aW9uXSB8fCAodGhpc1twcm9wZXJ0eV1bYWN0aW9uXSA9IFtdKTtcbiAgICAgICAgdmFyIGludGVyY2VwdG9ycyA9IHRoaXNbcHJvcGVydHldW2FjdGlvbl07XG4gICAgICAgIGludGVyY2VwdG9yc1tpbnRlcmNlcHRvcnMubGVuZ3RoXSA9IGNhbGxiYWNrO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2V2ZW50IG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwZXJmb3JtKGFjdGlvbiAvKiAsIGFyZ3MuLi4sIHBlcmZvcm1GbiwgY2FsbGJhY2sqLykge1xuICBpZiAodHlwZW9mIGFjdGlvbiAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcignZXZlbnQgbXVzdCBiZSBhIHN0cmluZycpO1xuICB2YXIgY2FsbGJhY2sgPSBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdO1xuICB2YXIgcGVyZm9ybUZuID0gYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAyXTtcbiAgdmFyIHNsaWNlID0gLTI7XG4gIGlmICh0eXBlb2YgcGVyZm9ybUZuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdwZXJmb3JtRm4gYW5kIGNhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgIH1cblxuICAgIHBlcmZvcm1GbiA9IGNhbGxiYWNrO1xuICAgIGNhbGxiYWNrID0gbnVsbDtcbiAgICBzbGljZSA9IC0xO1xuICB9XG5cbiAgLy9cbiAgLy8gR2V0IFwiYXJndW1lbnRzXCIgQXJyYXkgYW5kIHNldCBmaXJzdCB0byBudWxsIHRvIGluZGljYXRlXG4gIC8vIHRvIG5leHRJbnRlcmNlcHRvciB0aGF0IHRoZXJlIGlzIG5vIGVycm9yLlxuICAvL1xuICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCwgc2xpY2UpO1xuICBhcmdzWzBdID0gbnVsbDtcblxuICAvL1xuICAvLyBUaGlzIGlzIGNhbGxlZCBpbiBtdWx0aXBsZSB0ZW1wb3JhbCBsb2NhbGl0aWVzLCBwdXQgaW50byBhIGZ1bmN0aW9uIGluc3RlYWQgb2YgaW5saW5lXG4gIC8vIG1pbm9yIHNwZWVkIGxvc3MgZm9yIG1vcmUgbWFpbnRhaW5hYmlsaXR5XG4gIC8vXG4gIGZ1bmN0aW9uIGl0ZXJhdGUoc2VsZiwgaW50ZXJjZXB0b3JzLCBhcmdzLCBhZnRlcikge1xuICAgIGlmICghaW50ZXJjZXB0b3JzKSB7XG4gICAgICBhZnRlci5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpbnRlcmNlcHRvcnMgPSBpbnRlcmNlcHRvcnMuY29uY2F0KCk7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsZW4gPSBpbnRlcmNlcHRvcnMubGVuZ3RoO1xuICAgIGlmICghbGVuKSB7XG4gICAgICBhZnRlci5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBuZXh0SW50ZXJjZXB0b3IoKSB7XG4gICAgICBpZiAoaSA9PT0gbGVuKSB7XG4gICAgICAgIGkrKztcbiAgICAgICAgYWZ0ZXIuYXBwbHkoc2VsZiwgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGkgPCBsZW4pIHtcbiAgICAgICAgdmFyIHVzZWQgPSBmYWxzZTtcbiAgICAgICAgdmFyIGludGVyY2VwdG9yID0gaW50ZXJjZXB0b3JzW2krK107XG4gICAgICAgIGludGVyY2VwdG9yLmFwcGx5KHNlbGYsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkuY29uY2F0KGZ1bmN0aW9uIG5leHQoZXJyKSB7XG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBEbyBub3QgYWxsb3cgbXVsdGlwbGUgY29udGludWF0aW9uc1xuICAgICAgICAgIC8vXG4gICAgICAgICAgaWYgKHVzZWQpIHsgcmV0dXJuOyB9XG5cbiAgICAgICAgICB1c2VkID0gdHJ1ZTtcbiAgICAgICAgICBpZiAoIWVyciB8fCAhY2FsbGJhY2spIHtcbiAgICAgICAgICAgIG5leHRJbnRlcmNlcHRvci5hcHBseShudWxsLCBhcmdzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWZ0ZXIuY2FsbChzZWxmLCBlcnIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkpO1xuICAgICAgfVxuICAgIH1cbiAgICBuZXh0SW50ZXJjZXB0b3IuYXBwbHkobnVsbCwgYXJncyk7XG4gIH1cblxuICAvL1xuICAvLyBSZW1hcmsgKGpjcnVnenopOiBJcyB0aGlzIHRoZSBtb3N0IG9wdGltaXplZCB3YXkgdG8gZG8gdGhpcz9cbiAgLy9cbiAgZnVuY3Rpb24gZXhlY3V0ZVBlcmZvcm0oZXJyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChlcnIgJiYgY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpcywgZXJyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy9cbiAgICAgIC8vIFJlbWFyayAoaW5kZXh6ZXJvKTogU2hvdWxkIHdlIGNvbnNvbGUud2FybiBpZiBgYXJndW1lbnRzLmxlbmd0aCA+IDFgIGhlcmU/XG4gICAgICAvL1xuICAgICAgcGVyZm9ybUZuLmNhbGwodGhpcywgZnVuY3Rpb24gYWZ0ZXJQZXJmb3JtKGVycikge1xuICAgICAgICB2YXIgcGVyZm9ybUFyZ3M7XG4gICAgICAgIGlmIChlcnIgJiYgY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjay5jYWxsKHNlbGYsIGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVyZm9ybUFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgIGl0ZXJhdGUoc2VsZiwgc2VsZi5fYWZ0ZXJfaW50ZXJjZXB0b3JzICYmIHNlbGYuX2FmdGVyX2ludGVyY2VwdG9yc1thY3Rpb25dLCBhcmdzLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyICYmIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoc2VsZiwgZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkoc2VsZiwgcGVyZm9ybUFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIGl0ZXJhdGUodGhpcywgdGhpcy5fYmVmb3JlX2ludGVyY2VwdG9ycyAmJiB0aGlzLl9iZWZvcmVfaW50ZXJjZXB0b3JzW2FjdGlvbl0sIGFyZ3MsIGV4ZWN1dGVQZXJmb3JtKTtcbiAgcmV0dXJuIHRoaXM7XG59XG4iLCJ2YXIgb2JqZWN0ID0gcmVxdWlyZShcIi4uL3V0aWwvb2JqZWN0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gZnVuY3Rpb24gcGx1Z2luIChwcm90b3R5cGUpIHtcblxuICAgIHByb3RvdHlwZS5iZWZvcmUoXCJjcmVhdGVcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgZGVidWdnZXJcbiAgICB9KVxuXG4gICAgb2JqZWN0Lm1ldGhvZChwcm90b3R5cGUsIFwiZGVmaW5lQXR0cmlidXRlXCIsIGZ1bmN0aW9uIChuYW1lLCBkZWYpIHtcbiAgICAgIGRlZiA9IGRlZiB8fCB7fVxuICAgICAgdmFyIHR5cGVcbiAgICAgIHZhciBwYXJzZVZhbHVlXG4gICAgICB2YXIgc3RyaW5naWZ5VmFsdWVcbiAgICAgIHZhciBzaG91bGRSZW1vdmVcbiAgICAgIHZhciBnZXR0ZXJcbiAgICAgIHZhciBzZXR0ZXJcblxuICAgICAgc2hvdWxkUmVtb3ZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSA9PT0gbnVsbFxuICAgICAgfVxuXG4gICAgICB0eXBlID0gZGVmLnR5cGVcbiAgICAgIGdldHRlciA9IGRlZi5nZXRcbiAgICAgIHNldHRlciA9IGRlZi5zZXRcblxuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgXCJib29sZWFuXCI6XG4gICAgICAgICAgc2hvdWxkUmVtb3ZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgPT09IGZhbHNlXG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiAhIXZhbHVlXG4gICAgICAgICAgfVxuICAgICAgICAgIHN0cmluZ2lmeVZhbHVlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFwiXCJcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUludCh2YWx1ZSwgMTApXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgXCJmbG9hdFwiOlxuICAgICAgICAgIHBhcnNlVmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUZsb2F0KHZhbHVlKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgc3RyaW5naWZ5VmFsdWUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSA/IFwiXCIrdmFsdWUgOiBcIlwiXG4gICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocHJvdG90eXBlLCBuYW1lLCB7XG4gICAgICAgIGdldDogZ2V0dGVyIHx8IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLmVsZW1lbnQuZ2V0QXR0cmlidXRlKG5hbWUpXG4gICAgICAgICAgcmV0dXJuIHBhcnNlVmFsdWUgPyBwYXJzZVZhbHVlKHZhbHVlKSA6IHZhbHVlXG4gICAgICAgIH0sXG4gICAgICAgIHNldDogc2V0dGVyIHx8IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgIGlmIChzaG91bGRSZW1vdmUodmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKG5hbWUpXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFsdWUgPSBzdHJpbmdpZnlWYWx1ZSA/IHN0cmluZ2lmeVZhbHVlKHZhbHVlKSA6IHN0cmluZ2lmeVZhbHVlXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgb2JqZWN0ID0gcmVxdWlyZShcIi4uL3V0aWwvb2JqZWN0XCIpXG52YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxuXG52YXIgZGVmYXVsdERlZmluaXRpb24gPSB7XG4gIGRldGFpbDogbnVsbCxcbiAgdmlldzogd2luZG93LFxuICBidWJibGVzOiB0cnVlLFxuICBjYW5jZWxhYmxlOiB0cnVlXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGV2ZW50RGVmaW5pdGlvbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHBsdWdpbihwcm90b3R5cGUpIHtcbiAgICB2YXIgZGVmaW5pdGlvbnMgPSBldmVudERlZmluaXRpb25zIHx8IHt9XG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJkZWZpbmVFdmVudFwiLCBmdW5jdGlvbiAodHlwZSwgZGVmaW5pdGlvbikge1xuICAgICAgZGVmaW5pdGlvbnNbdHlwZV0gPSBkZWZpbml0aW9uXG4gICAgfSlcblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImRpc3BhdGNoXCIsIGZ1bmN0aW9uICh0eXBlLCBkZXRhaWwpIHtcbiAgICAgIHZhciBkZWZpbml0aW9uID0gbWVyZ2UoZGVmYXVsdERlZmluaXRpb24sIGRlZmluaXRpb25zW3R5cGVdKVxuICAgICAgZGVmaW5pdGlvbi5kZXRhaWwgPSBkZXRhaWwgfHwgZGVmaW5pdGlvbi5kZXRhaWxcbiAgICAgIHJldHVybiB0aGlzLmRpc3BhdGNoRXZlbnQobmV3IHdpbmRvdy5DdXN0b21FdmVudCh0eXBlLCBkZWZpbml0aW9uKSlcbiAgICB9KVxuICB9XG59XG4iLCJ2YXIgb2JqZWN0ID0gcmVxdWlyZShcIi4uL3V0aWwvb2JqZWN0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gZnVuY3Rpb24gcGx1Z2luKHByb3RvdHlwZSkge1xuXG4gICAgZnVuY3Rpb24gcHJvY2VzcyggZWxlbWVudCwgcHJvY2Vzc29yLCByZXN1bHQgKXtcbiAgICAgIHN3aXRjaCggdHJ1ZSApe1xuICAgICAgICBjYXNlIHR5cGVvZiBwcm9jZXNzb3IgPT0gXCJmdW5jdGlvblwiOlxuICAgICAgICAgIHJldHVybiBwcm9jZXNzb3IuY2FsbChlbGVtZW50LCByZXN1bHQpXG4gICAgICAgIGNhc2UgcHJvY2Vzc29yID09IFwiYXJyYXlcIjpcbiAgICAgICAgICByZXR1cm4gW10uc2xpY2UuY2FsbChyZXN1bHQpXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgfVxuICAgIH1cblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImJ5Q2xhc3NOYW1lXCIsIGZ1bmN0aW9uIChjbGFzc05hbWUsIHByb2Nlc3Nvcikge1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoY2xhc3NOYW1lKSlcbiAgICB9KVxuXG4gICAgb2JqZWN0Lm1ldGhvZChwcm90b3R5cGUsIFwiYnlDbGFzc05hbWVcIiwgZnVuY3Rpb24oIGNsYXNzTmFtZSwgcHJvY2Vzc29yICl7XG4gICAgICByZXR1cm4gcHJvY2Vzcyh0aGlzLCBwcm9jZXNzb3IsIHRoaXMuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShjbGFzc05hbWUpKVxuICAgIH0pXG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJieVRhZ05hbWVcIiwgZnVuY3Rpb24oIHRhZ05hbWUsIHByb2Nlc3NvciApe1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLmdldEVsZW1lbnRzQnlUYWdOYW1lKHRhZ05hbWUpKVxuICAgIH0pXG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJieUlkXCIsIGZ1bmN0aW9uKCBpZCwgcHJvY2Vzc29yICl7XG4gICAgICByZXR1cm4gcHJvY2Vzcyh0aGlzLCBwcm9jZXNzb3IsIHRoaXMuZ2V0RWxlbWVudEJ5SWQoaWQpKVxuICAgIH0pXG5cbiAgICBvYmplY3QubWV0aG9kKHByb3RvdHlwZSwgXCJieVNlbGVjdG9yXCIsIGZ1bmN0aW9uKCBzZWxlY3RvciwgcHJvY2Vzc29yICl7XG4gICAgICByZXR1cm4gcHJvY2Vzcyh0aGlzLCBwcm9jZXNzb3IsIHRoaXMucXVlcnlTZWxlY3RvcihzZWxlY3RvcikpXG4gICAgfSlcblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImJ5U2VsZWN0b3JBTGxcIiwgZnVuY3Rpb24oIHNlbGVjdG9yLCBwcm9jZXNzb3IgKXtcbiAgICAgIHJldHVybiBwcm9jZXNzKHRoaXMsIHByb2Nlc3NvciwgdGhpcy5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKSlcbiAgICB9KVxuXG4gICAgb2JqZWN0Lm1ldGhvZChwcm90b3R5cGUsIFwiYnlBdHRyaWJ1dGVcIiwgZnVuY3Rpb24oIGF0dHJpYnV0ZSwgcHJvY2Vzc29yICl7XG4gICAgICByZXR1cm4gcHJvY2Vzcyh0aGlzLCBwcm9jZXNzb3IsIHRoaXMucXVlcnlTZWxlY3RvcignWycrYXR0cmlidXRlKyddJykpXG4gICAgfSlcblxuICAgIG9iamVjdC5tZXRob2QocHJvdG90eXBlLCBcImJ5QXR0cmlidXRlQWxsXCIsIGZ1bmN0aW9uKCBhdHRyaWJ1dGUsIHByb2Nlc3NvciApe1xuICAgICAgcmV0dXJuIHByb2Nlc3ModGhpcywgcHJvY2Vzc29yLCB0aGlzLnF1ZXJ5U2VsZWN0b3JBbGwoJ1snK2F0dHJpYnV0ZSsnXScpKVxuICAgIH0pXG4gIH1cbn1cbiIsInZhciB1bmRlcnN0dWR5ID0gcmVxdWlyZShcInVuZGVyc3R1ZHlcIilcbnZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxudmFyIHJlZ2lzdHJ5ID0gcmVxdWlyZShcIi4vcmVnaXN0cnlcIilcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoXCIuL2RlbGVnYXRlXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gQ29tcG9uZW50XG5cbmZ1bmN0aW9uIENvbXBvbmVudCAoZWxlbWVudCwgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29tcG9uZW50KSkge1xuICAgIHJldHVybiBuZXcgQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gIH1cblxuICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50IHx8IG51bGxcbiAgdGhpcy5jb21wb25lbnRzID0ge31cblxuICBpZiAodGhpcy5lbGVtZW50ICYmIHRoaXMuYXV0b0Fzc2lnbikge1xuICAgIHRoaXMuYXNzaWduU3ViQ29tcG9uZW50cygpXG4gIH1cbn1cblxuQ29tcG9uZW50LmNyZWF0ZSA9IGZ1bmN0aW9uIChlbGVtZW50LCBvcHRpb25zKSB7XG4gIHZhciBuYW1lID0gaG9vay5nZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKVxuICB2YXIgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBudWxsXG5cbiAgaWYgKHJlZ2lzdHJ5LmV4aXN0cyhuYW1lKSkge1xuICAgIENvbXBvbmVudENvbnN0cnVjdG9yID0gIHJlZ2lzdHJ5LmdldChuYW1lKVxuICB9XG4gIGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIk1pc3NpbmcgY3VzdG9tIGNvbXBvbmVudCAnJXMnIGZvciBcIiwgbmFtZSwgZWxlbWVudClcbiAgICBDb21wb25lbnRDb25zdHJ1Y3RvciA9IHJlZ2lzdHJ5LmdldChcIipcIikgfHwgQ29tcG9uZW50XG4gIH1cblxuICByZXR1cm4gbmV3IENvbXBvbmVudENvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMpXG59XG5cbkNvbXBvbmVudC5wcm90b3R5cGUgPSB7XG4gIGF1dG9Bc3NpZ246IHRydWUsXG5cbiAgZGVsZWdhdGU6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgb3B0aW9ucy5lbGVtZW50ID0gdGhpcy5lbGVtZW50XG4gICAgb3B0aW9ucy5jb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0IHx8IHRoaXNcbiAgICByZXR1cm4gZGVsZWdhdGUob3B0aW9ucylcbiAgfSxcblxuICBmaW5kQ29tcG9uZW50OiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRDb21wb25lbnQobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kQWxsQ29tcG9uZW50OiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHJldHVybiBob29rLmZpbmRBbGxDb21wb25lbnQobmFtZSwgdGhpcy5lbGVtZW50KVxuICB9LFxuICBmaW5kU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gaG9vay5maW5kU3ViQ29tcG9uZW50cyhuYW1lLCB0aGlzLmVsZW1lbnQpXG4gIH0sXG4gIGdldENvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldENvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgZ2V0TWFpbkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldE1haW5Db21wb25lbnROYW1lKHRoaXMuZWxlbWVudCwgY2MpXG4gIH0sXG4gIGdldFN1YkNvbXBvbmVudE5hbWU6IGZ1bmN0aW9uIChjYykge1xuICAgIHJldHVybiBob29rLmdldFN1YkNvbXBvbmVudE5hbWUodGhpcy5lbGVtZW50LCBjYylcbiAgfSxcbiAgY2xlYXJTdWJDb21wb25lbnRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5jb21wb25lbnRzID0ge31cbiAgfSxcbiAgYXNzaWduU3ViQ29tcG9uZW50czogZnVuY3Rpb24gKHRyYW5zZm9ybSkge1xuICAgIHZhciBob3N0Q29tcG9uZW50ID0gdGhpc1xuICAgIHZhciBzdWJDb21wb25lbnRzID0gaG9vay5maW5kU3ViQ29tcG9uZW50cyhob3N0Q29tcG9uZW50LmdldE1haW5Db21wb25lbnROYW1lKGZhbHNlKSwgaG9zdENvbXBvbmVudC5lbGVtZW50KVxuXG4gICAgaWYgKCFzdWJDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaG9zdENvbXBvbmVudC5wZXJmb3JtKFwiYXNzaWduU3ViQ29tcG9uZW50c1wiLCBob3N0Q29tcG9uZW50LCBmdW5jdGlvbiAoKSB7XG4gICAgICBob29rLmFzc2lnblN1YkNvbXBvbmVudHMoaG9zdENvbXBvbmVudC5jb21wb25lbnRzLCBzdWJDb21wb25lbnRzLCB0cmFuc2Zvcm0gfHwgZnVuY3Rpb24gKGVsZW1lbnQsIG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUoZWxlbWVudCwgaG9zdENvbXBvbmVudClcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxufVxuXG51bmRlcnN0dWR5LmNhbGwoQ29tcG9uZW50LnByb3RvdHlwZSlcbiIsInZhciBDb21wb25lbnQgPSByZXF1aXJlKFwiLi9Db21wb25lbnRcIilcbnZhciBob29rID0gcmVxdWlyZShcIi4vaG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBvbmVudFxuXG5mdW5jdGlvbiBjb21wb25lbnQgKG5hbWUsIHJvb3QsIG9wdGlvbnMpIHtcbiAgdmFyIGVsZW1lbnQgPSBudWxsXG5cbiAgLy8gY29tcG9uZW50KFwic3RyaW5nXCIpXG4gIGlmICh0eXBlb2YgbmFtZSA9PSBcInN0cmluZ1wiKSB7XG4gICAgLy8gY29tcG9uZW50KFwic3RyaW5nXCJbLCB7fV0pXG4gICAgaWYgKCEocm9vdCBpbnN0YW5jZW9mIEVsZW1lbnQpKSB7XG4gICAgICBvcHRpb25zID0gcm9vdFxuICAgICAgcm9vdCA9IG51bGxcbiAgICB9XG4gICAgLy8gY29tcG9uZW50KFwic3RyaW5nXCIsIEVsZW1lbnQpXG4gICAgZWxlbWVudCA9IGhvb2suZmluZENvbXBvbmVudChuYW1lLCByb290KVxuICB9XG4gIC8vIGNvbXBvbmVudChFbGVtZW50Wywge31dKVxuICBlbHNlIGlmIChuYW1lIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgIGVsZW1lbnQgPSBuYW1lXG4gICAgb3B0aW9ucyA9IHJvb3RcbiAgICByb290ID0gbnVsbFxuICB9XG5cbiAgcmV0dXJuIENvbXBvbmVudC5jcmVhdGUoZWxlbWVudCwgb3B0aW9ucylcbn1cbiIsIi8qKlxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIG9uIGFuIGVsZW1lbnRcbiAqIGFuZCByZXR1cm5zIGEgZGVsZWdhdG9yLlxuICogQSBkZWxlZ2F0ZWQgZXZlbnQgcnVucyBtYXRjaGVzIHRvIGZpbmQgYW4gZXZlbnQgdGFyZ2V0LFxuICogdGhlbiBleGVjdXRlcyB0aGUgaGFuZGxlciBwYWlyZWQgd2l0aCB0aGUgbWF0Y2hlci5cbiAqIE1hdGNoZXJzIGNhbiBjaGVjayBpZiBhbiBldmVudCB0YXJnZXQgbWF0Y2hlcyBhIGdpdmVuIHNlbGVjdG9yLFxuICogb3Igc2VlIGlmIGFuIG9mIGl0cyBwYXJlbnRzIGRvLlxuICogKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGVsZWdhdGUoIG9wdGlvbnMgKXtcbiAgICB2YXIgZWxlbWVudCA9IG9wdGlvbnMuZWxlbWVudFxuICAgICAgICAsIGV2ZW50ID0gb3B0aW9ucy5ldmVudFxuICAgICAgICAsIGNhcHR1cmUgPSAhIW9wdGlvbnMuY2FwdHVyZXx8ZmFsc2VcbiAgICAgICAgLCBjb250ZXh0ID0gb3B0aW9ucy5jb250ZXh0fHxlbGVtZW50XG5cbiAgICBpZiggIWVsZW1lbnQgKXtcbiAgICAgICAgY29uc29sZS5sb2coXCJDYW4ndCBkZWxlZ2F0ZSB1bmRlZmluZWQgZWxlbWVudFwiKVxuICAgICAgICByZXR1cm4gbnVsbFxuICAgIH1cbiAgICBpZiggIWV2ZW50ICl7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQ2FuJ3QgZGVsZWdhdGUgdW5kZWZpbmVkIGV2ZW50XCIpXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIGRlbGVnYXRvciA9IGNyZWF0ZURlbGVnYXRvcihjb250ZXh0KVxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgZGVsZWdhdG9yLCBjYXB0dXJlKVxuXG4gICAgcmV0dXJuIGRlbGVnYXRvclxufVxuXG4vKipcbiAqIFJldHVybnMgYSBkZWxlZ2F0b3IgdGhhdCBjYW4gYmUgdXNlZCBhcyBhbiBldmVudCBsaXN0ZW5lci5cbiAqIFRoZSBkZWxlZ2F0b3IgaGFzIHN0YXRpYyBtZXRob2RzIHdoaWNoIGNhbiBiZSB1c2VkIHRvIHJlZ2lzdGVyIGhhbmRsZXJzLlxuICogKi9cbmZ1bmN0aW9uIGNyZWF0ZURlbGVnYXRvciggY29udGV4dCApe1xuICAgIHZhciBtYXRjaGVycyA9IFtdXG5cbiAgICBmdW5jdGlvbiBkZWxlZ2F0b3IoIGUgKXtcbiAgICAgICAgdmFyIGwgPSBtYXRjaGVycy5sZW5ndGhcbiAgICAgICAgaWYoICFsICl7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVsID0gdGhpc1xuICAgICAgICAgICAgLCBpID0gLTFcbiAgICAgICAgICAgICwgaGFuZGxlclxuICAgICAgICAgICAgLCBzZWxlY3RvclxuICAgICAgICAgICAgLCBkZWxlZ2F0ZUVsZW1lbnRcbiAgICAgICAgICAgICwgc3RvcFByb3BhZ2F0aW9uXG4gICAgICAgICAgICAsIGFyZ3NcblxuICAgICAgICB3aGlsZSggKytpIDwgbCApe1xuICAgICAgICAgICAgYXJncyA9IG1hdGNoZXJzW2ldXG4gICAgICAgICAgICBoYW5kbGVyID0gYXJnc1swXVxuICAgICAgICAgICAgc2VsZWN0b3IgPSBhcmdzWzFdXG5cbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IG1hdGNoQ2FwdHVyZVBhdGgoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICAgICAgaWYoIGRlbGVnYXRlRWxlbWVudCAmJiBkZWxlZ2F0ZUVsZW1lbnQubGVuZ3RoICkge1xuICAgICAgICAgICAgICAgIHN0b3BQcm9wYWdhdGlvbiA9IGZhbHNlID09PSBoYW5kbGVyLmFwcGx5KGNvbnRleHQsIFtlXS5jb25jYXQoZGVsZWdhdGVFbGVtZW50KSlcbiAgICAgICAgICAgICAgICBpZiggc3RvcFByb3BhZ2F0aW9uICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIGhhbmRsZXIgd2l0aCBhIHRhcmdldCBmaW5kZXIgbG9naWNcbiAgICAgKiAqL1xuICAgIGRlbGVnYXRvci5tYXRjaCA9IGZ1bmN0aW9uKCBzZWxlY3RvciwgaGFuZGxlciApe1xuICAgICAgICBtYXRjaGVycy5wdXNoKFtoYW5kbGVyLCBzZWxlY3Rvcl0pXG4gICAgICAgIHJldHVybiBkZWxlZ2F0b3JcbiAgICB9XG5cbiAgICByZXR1cm4gZGVsZWdhdG9yXG59XG5cbmZ1bmN0aW9uIG1hdGNoQ2FwdHVyZVBhdGgoIHNlbGVjdG9yLCBlbCwgZSApe1xuICAgIHZhciBkZWxlZ2F0ZUVsZW1lbnRzID0gW11cbiAgICB2YXIgZGVsZWdhdGVFbGVtZW50ID0gbnVsbFxuICAgIGlmKCBBcnJheS5pc0FycmF5KHNlbGVjdG9yKSApe1xuICAgICAgICB2YXIgaSA9IC0xXG4gICAgICAgIHZhciBsID0gc2VsZWN0b3IubGVuZ3RoXG4gICAgICAgIHdoaWxlKCArK2kgPCBsICl7XG4gICAgICAgICAgICBkZWxlZ2F0ZUVsZW1lbnQgPSBmaW5kUGFyZW50KHNlbGVjdG9yW2ldLCBlbCwgZSlcbiAgICAgICAgICAgIGlmKCAhZGVsZWdhdGVFbGVtZW50ICkgcmV0dXJuIG51bGxcbiAgICAgICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGRlbGVnYXRlRWxlbWVudCA9IGZpbmRQYXJlbnQoc2VsZWN0b3IsIGVsLCBlKVxuICAgICAgICBpZiggIWRlbGVnYXRlRWxlbWVudCApIHJldHVybiBudWxsXG4gICAgICAgIGRlbGVnYXRlRWxlbWVudHMucHVzaChkZWxlZ2F0ZUVsZW1lbnQpXG4gICAgfVxuICAgIHJldHVybiBkZWxlZ2F0ZUVsZW1lbnRzXG59XG5cbi8qKlxuICogQ2hlY2sgaWYgdGhlIHRhcmdldCBvciBhbnkgb2YgaXRzIHBhcmVudCBtYXRjaGVzIGEgc2VsZWN0b3JcbiAqICovXG5mdW5jdGlvbiBmaW5kUGFyZW50KCBzZWxlY3RvciwgZWwsIGUgKXtcbiAgICB2YXIgdGFyZ2V0ID0gZS50YXJnZXRcbiAgICBzd2l0Y2goIHR5cGVvZiBzZWxlY3RvciApe1xuICAgICAgICBjYXNlIFwic3RyaW5nXCI6XG4gICAgICAgICAgICB3aGlsZSggdGFyZ2V0ICYmIHRhcmdldCAhPSBlbCApe1xuICAgICAgICAgICAgICAgIGlmKCB0YXJnZXQubWF0Y2hlcyhzZWxlY3RvcikgKSByZXR1cm4gdGFyZ2V0XG4gICAgICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGVcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgXCJmdW5jdGlvblwiOlxuICAgICAgICAgICAgd2hpbGUoIHRhcmdldCAmJiB0YXJnZXQgIT0gZWwgKXtcbiAgICAgICAgICAgICAgICBpZiggc2VsZWN0b3IuY2FsbChlbCwgdGFyZ2V0KSApIHJldHVybiB0YXJnZXRcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiBudWxsXG4gICAgfVxuICAgIHJldHVybiBudWxsXG59XG4iLCJ2YXIgbWVyZ2UgPSByZXF1aXJlKFwiLi4vdXRpbC9tZXJnZVwiKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmcmFnbWVudFxyXG5cclxuZnJhZ21lbnQub3B0aW9ucyA9IHtcclxuICB2YXJpYWJsZTogXCJmXCJcclxufVxyXG5cclxuZnVuY3Rpb24gZnJhZ21lbnQoIGh0bWwsIGNvbXBpbGVyLCBjb21waWxlck9wdGlvbnMgKXtcclxuICBjb21waWxlck9wdGlvbnMgPSBtZXJnZShmcmFnbWVudC5vcHRpb25zLCBjb21waWxlck9wdGlvbnMpXHJcbiAgdmFyIHJlbmRlciA9IG51bGxcclxuICByZXR1cm4gZnVuY3Rpb24oIHRlbXBsYXRlRGF0YSApe1xyXG4gICAgdmFyIHRlbXAgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKVxyXG4gICAgaWYoIHR5cGVvZiBjb21waWxlciA9PSBcImZ1bmN0aW9uXCIgJiYgIXJlbmRlciApe1xyXG4gICAgICByZW5kZXIgPSBjb21waWxlcihodG1sLCBjb21waWxlck9wdGlvbnMpXHJcbiAgICB9XHJcbiAgICBpZiggcmVuZGVyICl7XHJcbiAgICAgIHRyeXtcclxuICAgICAgICBodG1sID0gcmVuZGVyKHRlbXBsYXRlRGF0YSlcclxuICAgICAgfVxyXG4gICAgICBjYXRjaCggZSApe1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZW5kZXJpbmcgZnJhZ21lbnQgd2l0aCBjb250ZXh0OlwiLCB0ZW1wbGF0ZURhdGEpXHJcbiAgICAgICAgY29uc29sZS5lcnJvcihyZW5kZXIudG9TdHJpbmcoKSlcclxuICAgICAgICBjb25zb2xlLmVycm9yKGUpXHJcbiAgICAgICAgdGhyb3cgZVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGVtcC5pbm5lckhUTUwgPSBodG1sXHJcbiAgICB2YXIgZnJhZ21lbnQgPSB3aW5kb3cuZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpXHJcbiAgICB3aGlsZSggdGVtcC5jaGlsZE5vZGVzLmxlbmd0aCApe1xyXG4gICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh0ZW1wLmZpcnN0Q2hpbGQpXHJcbiAgICB9XHJcbiAgICByZXR1cm4gZnJhZ21lbnRcclxuICB9XHJcbn1cclxuZnJhZ21lbnQucmVuZGVyID0gZnVuY3Rpb24oIGh0bWwsIHRlbXBsYXRlRGF0YSApe1xyXG4gIHJldHVybiBmcmFnbWVudChodG1sKSh0ZW1wbGF0ZURhdGEpXHJcbn1cclxuIiwidmFyIGNhbWVsY2FzZSA9IHJlcXVpcmUoXCJjYW1lbGNhc2VcIilcbnZhciBDT01QT05FTlRfQVRUUklCVVRFID0gXCJkYXRhLWNvbXBvbmVudFwiXG5cbnZhciBob29rID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG5ob29rLnNldEhvb2tBdHRyaWJ1dGUgPSBzZXRIb29rQXR0cmlidXRlXG5ob29rLmNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yID0gY3JlYXRlQ29tcG9uZW50U2VsZWN0b3Jcbmhvb2suZmluZENvbXBvbmVudCA9IGZpbmRDb21wb25lbnRcbmhvb2suZmluZEFsbENvbXBvbmVudCA9IGZpbmRBbGxDb21wb25lbnRcbmhvb2suZmluZFN1YkNvbXBvbmVudHMgPSBmaW5kU3ViQ29tcG9uZW50c1xuaG9vay5nZXRDb21wb25lbnROYW1lID0gZ2V0Q29tcG9uZW50TmFtZVxuaG9vay5nZXRNYWluQ29tcG9uZW50TmFtZSA9IGdldE1haW5Db21wb25lbnROYW1lXG5ob29rLmdldFN1YkNvbXBvbmVudE5hbWUgPSBnZXRTdWJDb21wb25lbnROYW1lXG5ob29rLmFzc2lnblN1YkNvbXBvbmVudHMgPSBhc3NpZ25TdWJDb21wb25lbnRzXG5ob29rLmZpbHRlciA9IGZpbHRlclxuXG5mdW5jdGlvbiBzZXRIb29rQXR0cmlidXRlIChob29rKSB7XG4gIENPTVBPTkVOVF9BVFRSSUJVVEUgPSBob29rXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yIChuYW1lLCBvcGVyYXRvcikge1xuICBuYW1lID0gbmFtZSAmJiAnXCInICsgbmFtZSArICdcIidcbiAgb3BlcmF0b3IgPSBuYW1lID8gb3BlcmF0b3IgfHwgXCI9XCIgOiBcIlwiXG4gIHJldHVybiAnWycgKyBDT01QT05FTlRfQVRUUklCVVRFICsgb3BlcmF0b3IgKyBuYW1lICsgJ10nXG59XG5cbmZ1bmN0aW9uIGZpbmRDb21wb25lbnQgKG5hbWUsIHJvb3QpIHtcbiAgcmV0dXJuIChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUpKVxufVxuXG5mdW5jdGlvbiBmaW5kQWxsQ29tcG9uZW50IChuYW1lLCByb290KSB7XG4gIHJldHVybiBbXS5zbGljZS5jYWxsKChyb290IHx8IGRvY3VtZW50KS5xdWVyeVNlbGVjdG9yQWxsKGNyZWF0ZUNvbXBvbmVudFNlbGVjdG9yKG5hbWUpKSlcbn1cblxuZnVuY3Rpb24gZmluZFN1YkNvbXBvbmVudHMgKG5hbWUsIHJvb3QpIHtcbiAgdmFyIGVsZW1lbnRzID0gKHJvb3QgfHwgZG9jdW1lbnQpLnF1ZXJ5U2VsZWN0b3JBbGwoY3JlYXRlQ29tcG9uZW50U2VsZWN0b3IobmFtZSwgXCJePVwiKSlcbiAgcmV0dXJuIGZpbHRlcihlbGVtZW50cywgZnVuY3Rpb24gKGVsZW1lbnQsIGNvbXBvbmVudE5hbWUsIG1haW5Db21wb25lbnROYW1lLCBzdWJDb21wb25lbnROYW1lKSB7XG4gICAgcmV0dXJuIHN1YkNvbXBvbmVudE5hbWUgJiYgbmFtZSA9PT0gbWFpbkNvbXBvbmVudE5hbWVcbiAgfSlcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50TmFtZSAoZWxlbWVudCwgY2MpIHtcbiAgY2MgPSBjYyA9PSB1bmRlZmluZWQgfHwgY2NcbiAgdmFyIHZhbHVlID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoQ09NUE9ORU5UX0FUVFJJQlVURSlcbiAgcmV0dXJuIGNjID8gY2FtZWxjYXNlKHZhbHVlKSA6IHZhbHVlXG59XG5cbmZ1bmN0aW9uIGdldE1haW5Db21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKS5zcGxpdChcIjpcIilcbiAgdmFsdWUgPSB2YWx1ZVswXSB8fCBcIlwiXG4gIHJldHVybiBjYyAmJiB2YWx1ZSA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBnZXRTdWJDb21wb25lbnROYW1lIChlbGVtZW50LCBjYykge1xuICBjYyA9IGNjID09IHVuZGVmaW5lZCB8fCBjY1xuICB2YXIgdmFsdWUgPSBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKS5zcGxpdChcIjpcIilcbiAgdmFsdWUgPSB2YWx1ZVsxXSB8fCBcIlwiXG4gIHJldHVybiBjYyAmJiB2YWx1ZSA/IGNhbWVsY2FzZSh2YWx1ZSkgOiB2YWx1ZVxufVxuXG5mdW5jdGlvbiBhc3NpZ25TdWJDb21wb25lbnRzIChvYmosIHN1YkNvbXBvbmVudHMsIHRyYW5zZm9ybSkge1xuICByZXR1cm4gc3ViQ29tcG9uZW50cy5yZWR1Y2UoZnVuY3Rpb24gKG9iaiwgZWxlbWVudCkge1xuICAgIHZhciBuYW1lID0gZ2V0U3ViQ29tcG9uZW50TmFtZShlbGVtZW50KVxuICAgIGlmIChuYW1lKSB7XG4gICAgICBlbGVtZW50ID0gdHJhbnNmb3JtXG4gICAgICAgID8gdHJhbnNmb3JtKGVsZW1lbnQsIG5hbWUpXG4gICAgICAgIDogZWxlbWVudFxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob2JqW25hbWVdKSkge1xuICAgICAgICBvYmpbbmFtZV0ucHVzaChlbGVtZW50KVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIG9ialtuYW1lXSA9IGVsZW1lbnRcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9ialxuICB9LCBvYmopXG59XG5cbmZ1bmN0aW9uIGZpbHRlciAoZWxlbWVudHMsIGZpbHRlcikge1xuICBzd2l0Y2ggKHR5cGVvZiBmaWx0ZXIpIHtcbiAgICBjYXNlIFwiZnVuY3Rpb25cIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGZpbHRlcihlbGVtZW50LCBnZXRDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSwgZ2V0TWFpbkNvbXBvbmVudE5hbWUoZWxlbWVudCwgZmFsc2UpLCBnZXRTdWJDb21wb25lbnROYW1lKGVsZW1lbnQsIGZhbHNlKSlcbiAgICAgIH0pXG4gICAgICBicmVha1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIHJldHVybiBbXS5zbGljZS5jYWxsKGVsZW1lbnRzKS5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGdldENvbXBvbmVudE5hbWUoZWxlbWVudCkgPT09IGZpbHRlclxuICAgICAgfSlcbiAgICAgIGJyZWFrXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBudWxsXG4gIH1cbn1cbiIsInZhciByZWdpc3RyeSA9IHJlcXVpcmUoXCIuL3JlZ2lzdHJ5XCIpXG52YXIgQ29tcG9uZW50ID0gcmVxdWlyZShcIi4vQ29tcG9uZW50XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcmVnaXN0ZXIgKG5hbWUsIG1peGluLCBDb21wb25lbnRDb25zdHJ1Y3Rvcikge1xuICBpZiAoIUNvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBtaXhpblxuICAgIG1peGluID0gW11cbiAgfVxuICBlbHNlIHtcbiAgICAvLyBmdW5jdGlvbnMgaW4tYmV0d2VlbiBhcmUgbWl4aW5cbiAgICBtaXhpbiA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxLCAtMSlcbiAgICAvLyBtYWluIGNvbnN0cnVjdG9yIGlzIGFsd2F5cyBsYXN0IGFyZ3VtZW50XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgLTEpWzBdXG4gIH1cblxuICBpZiAoIUNvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gICAgQ29tcG9uZW50Q29uc3RydWN0b3IgPSBmdW5jdGlvbiAoKSB7fVxuICB9XG5cbiAgZnVuY3Rpb24gQ3VzdG9tQ29tcG9uZW50IChlbGVtZW50LCBvcHRpb25zKSB7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEN1c3RvbUNvbXBvbmVudCkpIHtcbiAgICAgIHJldHVybiBuZXcgQ3VzdG9tQ29tcG9uZW50KGVsZW1lbnQsIG9wdGlvbnMpXG4gICAgfVxuXG4gICAgdmFyIGluc3RhbmNlID0gdGhpc1xuICAgIGluc3RhbmNlLnBlcmZvcm0oXCJjcmVhdGVcIiwgaW5zdGFuY2UsIGZ1bmN0aW9uICgpIHtcbiAgICAgIENvbXBvbmVudC5jYWxsKGluc3RhbmNlLCBlbGVtZW50LCBvcHRpb25zKVxuICAgICAgLy8gYXQgdGhpcyBwb2ludCBjdXN0b20gY29uc3RydWN0b3JzIGNhbiBhbHJlYWR5IGFjY2VzcyB0aGUgZWxlbWVudFxuICAgICAgLy8gc28gdGhleSBvbmx5IHJlY2VpdmUgdGhlIG9wdGlvbnMgb2JqZWN0IGZvciBjb252ZW5pZW5jZVxuICAgICAgQ29tcG9uZW50Q29uc3RydWN0b3IuY2FsbChpbnN0YW5jZSwgb3B0aW9ucylcbiAgICB9KVxuICB9XG5cbiAgQ3VzdG9tQ29tcG9uZW50LnByb3RvdHlwZSA9IG5ldyBDb21wb25lbnQoKVxuICBtaXhpbi5mb3JFYWNoKGZ1bmN0aW9uIChtaXhpbikge1xuICAgIG1peGluKEN1c3RvbUNvbXBvbmVudC5wcm90b3R5cGUpXG4gIH0pXG5cbiAgcmV0dXJuIHJlZ2lzdHJ5LnNldChuYW1lLCBDdXN0b21Db21wb25lbnQpXG4gIC8vIGRlZmluZSBtYWluIHByb3RvdHlwZSBhZnRlciByZWdpc3RlcmluZ1xufVxuIiwidmFyIHJlZ2lzdHJ5ID0gbW9kdWxlLmV4cG9ydHMgPSB7fVxuXG52YXIgY29tcG9uZW50cyA9IHt9XG5cbnJlZ2lzdHJ5LmdldCA9IGZ1bmN0aW9uIGV4aXN0cyAobmFtZSkge1xuICByZXR1cm4gY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5leGlzdHMgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUpIHtcbiAgcmV0dXJuICEhY29tcG9uZW50c1tuYW1lXVxufVxuXG5yZWdpc3RyeS5zZXQgPSBmdW5jdGlvbiBleGlzdHMgKG5hbWUsIENvbXBvbmVudENvbnN0cnVjdG9yKSB7XG4gIHJldHVybiBjb21wb25lbnRzW25hbWVdID0gQ29tcG9uZW50Q29uc3RydWN0b3Jcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZXh0ZW5kKCBvYmosIGV4dGVuc2lvbiApe1xyXG4gIGZvciggdmFyIG5hbWUgaW4gZXh0ZW5zaW9uICl7XHJcbiAgICBpZiggZXh0ZW5zaW9uLmhhc093blByb3BlcnR5KG5hbWUpICkgb2JqW25hbWVdID0gZXh0ZW5zaW9uW25hbWVdXHJcbiAgfVxyXG4gIHJldHVybiBvYmpcclxufVxyXG4iLCJ2YXIgZXh0ZW5kID0gcmVxdWlyZShcIi4vZXh0ZW5kXCIpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCBvYmosIGV4dGVuc2lvbiApe1xyXG4gIHJldHVybiBleHRlbnNpb24oZXh0ZW5kKHt9LCBvYmopLCBleHRlbnNpb24pXHJcbn1cclxuIiwidmFyIG9iamVjdCA9IG1vZHVsZS5leHBvcnRzID0ge31cblxub2JqZWN0LmRlZmluZUdldHRlciA9IGZ1bmN0aW9uIChvYmosIG5hbWUsIGZuKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosIG5hbWUsIHtcbiAgICBnZXQ6IGZuXG4gIH0pXG59XG5cbm9iamVjdC5kZWZpbmVTZXR0ZXIgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgc2V0OiBmblxuICB9KVxufVxuXG5vYmplY3QubWV0aG9kID0gZnVuY3Rpb24gKG9iaiwgbmFtZSwgZm4pIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgbmFtZSwge1xuICAgIHZhbHVlOiBmblxuICB9KVxufVxuXG5vYmplY3QucHJvcGVydHkgPSBmdW5jdGlvbiAob2JqLCBuYW1lLCBmbikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBuYW1lLCB7XG4gICAgdmFsdWU6IGZuLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KVxufVxuIl19
