var assert = window.chai.assert
var it = window.it
var describe = window.describe

if (!it || !describe || !assert) {
  throw new Error("Invalid test environment")
}

var pagination = document.getElementById("pagination")
var pagination2 = document.getElementById("pagination2")
var pagination3 = document.getElementById("pagination3")
var pagination4 = document.getElementById("pagination4")
var pagination5 = document.getElementById("pagination5")
var pagination6 = document.getElementById("pagination6")
var scope = document.getElementById("scope")
var scope2 = document.getElementById("scope2")
var customAttribute = document.getElementById("custom-attribute")

describe("Component()", function () {
  describe("constructor", function () {
    it("should work without arguments", function () {
      var component = new treant.Component()
      assert.isNull(component.element)
      assert.isObject(component.components)
    })
    it("should work without `new` keyword", function () {
      var component = treant.Component()
      assert.instanceOf(component, treant.Component)
    })
  })

  describe("instance.element", function () {
    it("should set the element as the component's element", function () {
      var component = new treant.Component(pagination)
      assert.equal(component.element, pagination)
    })
  })

  describe("instance.components", function () {
    // component.components.<subComponent>
    it("should auto assign single sub components by default", function () {
      var component = treant.component(pagination)
      assert.isDefined(component.components.pageNumber)
    })
    it("should work with dashed main component names", function () {
      var component = treant.component("custom-pagination")
      assert.isDefined(component.components.pageNumber)
    })
    // component.components.<Element>
    it("should assign native dom elements for sub components", function () {
      var component = treant.component(pagination)
      assert.instanceOf(component.components.pageNumber, Element)
    })
    // component.components.<Component>
    it("should create Component instances for sub components", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.convertSubComponents = true
      })
      var component = treant.component(pagination)
      assert.instanceOf(component.components.pageNumber, treant.Component)
    })
    // component.components.[<subComponent>]
    it("should assign sub component arrays if defined", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.components.pageNumber = []
      })
      var component = treant.component(pagination4, {})
      assert.isArray(component.components.pageNumber)
      assert.lengthOf(component.components.pageNumber, 4)
    })
    it("should assign default array for sub components", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.components.pageNumber = []
      })
      var component = treant.component(pagination6, {})
      assert.isArray(component.components.pageNumber)
      assert.lengthOf(component.components.pageNumber, 0)
    })
  })

  describe("prototype.assignSubComponents()", function () {
    it("should not run if autoAssign is disabled", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.autoAssign = false
      })
      var component = treant.component(pagination)
      assert.isUndefined(component.components.pageNumber)
    })
  })

  describe("prototype.dispatch", function () {
    it("should dispatch a custom event", function () {
      var component = new treant.Component(pagination)
      var dispatched = false
      component.element.addEventListener("hello", function (e) {
        dispatched = true
      }, false)

      component.dispatch("hello")

      assert.isTrue(dispatched)
    })
    it("should dispatch a click event", function () {
      var component = new treant.Component(pagination)
      var dispatched = false
      component.element.addEventListener("click", function (e) {
        dispatched = true
      }, false)

      component.dispatch("click")

      assert.isTrue(dispatched)
    })
    it("should carry data", function () {
      var component = new treant.Component(pagination)
      var data = {
        hey: "ho"
      }
      var eventData = null
      component.element.addEventListener("click", function (e) {
        eventData = e.detail
      }, false)

      component.dispatch("click", data)

      assert.equal(data, eventData)
    })
    it("should register an bubbling and non bubbling event definition", function () {
      var Pagination = treant.register("pagination", function () {
        this.internals.event("hey", {
          bubbles: true
        })
        this.internals.event("ho", {
          bubbles: false
        })
      })

      var component = new Pagination(pagination)
      var hey = false
      var ho = false
      document.body.addEventListener("hey", function (e) {
        hey = true
      }, false)
      document.body.addEventListener("ho", function (e) {
        ho = true
      }, false)

      component.dispatch("hey")
      component.dispatch("ho")

      assert.isTrue(hey)
      assert.isFalse(ho)
    })
    it("should register a cancellable event definition", function () {
      var Pagination = treant.register("pagination", function () {
        this.internals.event("cancellable", {
          cancelable: true,
          bubbles: true
        })
        this.internals.event("notcancellable", {
          cancelable: false,
          bubbles: true
        })
      })

      var component = new Pagination(pagination)
      var cancellable = false
      var notcancellable = false
      component.element.addEventListener("cancellable", function (e) {
        e.preventDefault()
      }, false)
      component.element.addEventListener("notcancellable", function (e) {
        e.preventDefault()
      }, false)
      document.body.addEventListener("cancellable", function (e) {
        cancellable = e.defaultPrevented
      }, false)
      document.body.addEventListener("notcancellable", function (e) {
        notcancellable = e.defaultPrevented
      }, false)

      component.dispatch("cancellable")
      component.dispatch("notcancellable")

      assert.isTrue(cancellable)
      assert.isFalse(notcancellable)
    })
  })
})

describe("CustomComponent", function () {
  // new CustomComponent()
  it("should call the custom constructor", function () {
    var called = false
    treant.register("pagination", {
      onCreate: function () {
        called = true
      }
    })
    treant.component(pagination)
    assert.isTrue(called)
  })
  // new CustomComponent()+
  it("should work with plugins", function () {
    function testMethod () {}

    function plugin (prototype) {
      prototype.testMethod = testMethod
    }

    var Pagination = treant.register("pagination", plugin)
    treant.component(pagination)
    assert.equal(Pagination.prototype.testMethod, testMethod)
  })
  // new CustomComponent()+
  it("should work with multiple plugins", function () {
    function testMethod () {}

    function testMethod2 () {}

    function plugin (prototype) {
      prototype.testMethod = testMethod
    }

    function plugin2 (prototype) {
      prototype.testMethod2 = testMethod2
    }

    var Pagination = treant.register("pagination", plugin, plugin2)
    treant.component(pagination)
    assert.equal(Pagination.prototype.testMethod, testMethod)
    assert.equal(Pagination.prototype.testMethod2, testMethod2)
  })
  // new CustomComponent()
  it("should instantiate a custom component with the constructor", function () {
    var Pagination = treant.register("pagination")
    var component = new Pagination()
    assert.instanceOf(component, Pagination)
  })
  // new CustomComponent(Element)
  it("should set the element of the custom component to the first argument", function () {
    var Pagination = treant.register("pagination")
    var component = new Pagination(pagination)
    assert.equal(component.element, pagination)
  })
  // new CustomComponent(Element, {})
  it("should accept an options object as second argument", function () {
    var testOptions = {}
    var passedArguments = null
    var Pagination = treant.register("pagination", {
      onCreate: function (options) {
        passedArguments = options
      }
    })
    new Pagination(pagination, testOptions)
    assert.equal(testOptions, passedArguments)
  })
  // CustomComponent extend Component
  it("should be an instance of the base Component", function () {
    treant.register("pagination")
    var component = treant.component(pagination)
    assert.instanceOf(component, treant.Component)
  })
})

describe("register()", function () {
  it("should return a constructor", function () {
    var Pagination = treant.register("pagination")
    assert.isFunction(Pagination)
  })
  it("should work without a custom constructor", function () {
    treant.register("pagination")
    var component = treant.component(pagination)
  })
  it("should allow overwriting existing registry entries", function () {
    var Pagination = treant.register("pagination")
    var Pagination2 = treant.register("pagination")
    assert.notEqual(Pagination, Pagination2)
  })
})

describe("component()", function () {

  // .component() signatures

  // treant.component(String)
  it("should accept string as first argument and find the first component in the document with that name", function () {
    var component = treant.component("pagination")
    assert.equal(component.element, pagination)
  })
  // treant.component(String)
  it("should work dashed with component names", function () {
    var component = treant.component("custom-pagination")
    assert.equal(component.element, pagination2)
  })
  // treant.component(String)
  it("should create custom components if defined", function () {
    var Pagination = treant.register("pagination")
    var component = treant.component("pagination")
    assert.instanceOf(component, Pagination)
  })
  // treant.component(String, Element)
  it("should scope the search with the second argument", function () {
    var component = treant.component("pagination", scope)
    assert.equal(component.element, pagination3)
  })
  // treant.component(Element)
  it("should accept an element as first argument", function () {
    var component = treant.component(pagination)
    assert.equal(component.element, pagination)
  })
  // treant.component(Element)
  it("should figure out the custom component from the name of an element", function () {
    var Pagination = treant.register("pagination")
    var component = treant.component(pagination)
    assert.instanceOf(component, Pagination)
  })
  // treant.component(Element)
  it("should create a base component in the absence of a custom one", function () {
    var component = treant.component(pagination)
    assert.instanceOf(component, treant.Component)
  })

  it("should create an array of components", function () {
    var Pagination = treant.register("pagination")
    var components = treant.component.all("pagination", scope2)
    assert.isArray(components)
    assert.lengthOf(components, 4)
    assert.instanceOf(components[0], Pagination)
  })
})

describe("storage", function () {

  it("should save and retrieve the component by element", function () {
    var Pagination = treant.register("pagination", function () {
    })
    var p = new Pagination(pagination)
    treant.storage.save(p)
    assert.equal(p, treant.storage.get(pagination))
  })
  it("should save and remove the component by element", function () {
    var Pagination = treant.register("pagination", function () {
    })
    var p = new Pagination(pagination2)
    treant.storage.save(p)
    treant.storage.remove(p)
    assert.isUndefined(treant.storage.get(pagination2))
  })
})

describe("Internals", function () {

  it("should work with prototype object", function () {
    function testMethod () {}
    treant.register("pagination", {
      testMethod: testMethod,
      testProperty: 1
    })
    var component = treant.component(pagination)
    assert.equal(component.testMethod, testMethod)
    assert.equal(component.testProperty, 1)
  })

  it("should create a constructor via a prototype object", function () {
    var testOptions = {}
    var passedOptions = null
    function testConstructor (options) {
      passedOptions = options
    }
    treant.register("pagination", {
      onCreate: testConstructor
    })
    var component = treant.component(pagination, testOptions)
    assert.isUndefined(component.onCreate)
    assert.equal(testOptions, passedOptions)
  })

  it("should create a constructor via a internals", function () {
    var testOptions = {}
    var passedOptions = null
    function testConstructor (options) {
      passedOptions = options
    }
    treant.register("pagination", function (prototype, interals) {
      interals.onCreate(testConstructor)
    })
    var component = treant.component(pagination, testOptions)
    assert.isUndefined(component.onCreate)
    assert.equal(testOptions, passedOptions)
  })

  it("should be chainable", function () {
    treant.register("pagination", function (prototype, internals) {
      internals
          .onCreate(function (options) {

          })
          .event("close", {})
          .attribute("value", 2)
          .method("heyHo", function () {
            this.letsGo()
          })
          .proto({
            letsGo: function () {
              this.heyHo()
            }
          })
    })
    var component = treant.component(pagination)
    assert.isFunction(component.heyHo)
    assert.isFunction(component.letsGo)
  })

  it("should be available on the constructor", function () {
    treant
        .register("pagination")
        .internals
        .onCreate(function (options) {})
        .event("close", {})
        .attribute("value", 2)
        .method("heyHo", function () {
          this.letsGo()
        })
        .proto({
          letsGo: function () {
            this.heyHo()
          }
        })

    var component = treant.component(pagination)
    assert.isFunction(component.heyHo)
    assert.isFunction(component.letsGo)
  })

  it("should enable auto assign", function () {
    treant.register("pagination", function (prototype) {
      prototype.internals.autoAssign = true
    })


    var component = treant.component(pagination)
    assert.isDefined(component.components.pageNumber)
  })

  it("should disable auto assign", function () {
    treant.register("pagination", function (prototype) {
      prototype.internals.autoAssign = false
    })


    var component = treant.component(pagination)
    assert.isUndefined(component.components.pageNumber)
  })

  it("should convert sub components", function () {
    treant.register("pagination", function (prototype) {
      prototype.internals.convertSubComponents = true
    })

    var component = treant.component(pagination)
    assert.instanceOf(component.components.pageNumber, treant.Component)
  })

  it("should not convert sub components", function () {
    treant.register("pagination", function (prototype) {
      prototype.internals.convertSubComponents = false
    })


    var component = treant.component(pagination)
    assert.instanceOf(component.components.pageNumber, Element)
  })

  it("should collect all sub components into an array", function () {
    treant.register("pagination", function (prototype) {
      prototype.internals.components.pageNumber = []
    })

    var component = treant.component(pagination)
    assert.isArray(component.components.pageNumber)
  })

  describe("attributes", function () {

    it("should define a custom attribute", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("string")
      })

      var component = treant.component(pagination5)
      assert.isDefined(component.string)
    })

    it("should define a string attribute", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("string")
      })

      var component = treant.component(pagination5)
      assert.isString(component.string)
      assert.equal(component.string, "hello")
    })

    it("should define a number attribute", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("number", {
          type: "number"
        })
      })

      var component = treant.component(pagination5)
      assert.isDefined(component.number)
      assert.isNumber(component.number)
      assert.equal(component.number, 10)
    })

    it("should define a number attribute with a default number value", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("number", {
          'default': 20
        })
      })


      var component = treant.component(pagination5)
      assert.isDefined(component.number)
      assert.isNumber(component.number)
      assert.equal(component.number, 10)
    })

    it("should define a number attribute with a default number value", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("number", 15)
      })


      var component = treant.component(pagination5)
      assert.isDefined(component.number)
      assert.isNumber(component.number)
      assert.equal(component.number, 10)
    })

    it("should define a boolean attribute", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("boolean", {
          type: "boolean"
        })
      })


      var component = treant.component(pagination5)
      assert.isDefined(component.boolean)
      assert.isBoolean(component.boolean)
      assert.equal(component.boolean, true)
    })

    it("should have a default string value", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("string", "hello")
      })


      var component = treant.component(pagination)
      assert.isDefined(component.string)
      assert.isString(component.string)
      assert.equal(component.string, "hello")
    })

    it("should have a default number value", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("number", 10)
        prototype.internals.attribute("number2", {
          'default': 20
        })
      })

      var component = treant.component(pagination)
      assert.equal(pagination.getAttribute("number"), "10")
      assert.isDefined(component.number)
      assert.isNumber(component.number)
      assert.equal(component.number, 10)
      assert.isDefined(component.number2)
      assert.isNumber(component.number2)
      assert.equal(component.number2, 20)
    })

    it("should define a default boolean value", function () {
      treant.register("pagination", function (prototype) {
        prototype.internals.attribute("boolean", true)
        prototype.internals.attribute("boolean2", false)
        prototype.internals.attribute("boolean3", {
          'default': true
        })
        prototype.internals.attribute("boolean4", {
          'default': false
        })
      })

      var component = treant.component(pagination)
      assert.isDefined(component.boolean)
      assert.isBoolean(component.boolean)
      assert.equal(component.boolean, true)
      assert.isDefined(component.boolean2)
      assert.isBoolean(component.boolean2)
      assert.equal(component.boolean2, false)
      assert.isDefined(component.boolean3)
      assert.isBoolean(component.boolean3)
      assert.equal(component.boolean3, true)
      assert.isDefined(component.boolean4)
      assert.isBoolean(component.boolean4)
      assert.equal(component.boolean4, false)
    })

    it("should call the onchange callback if the value changed", function () {
      var newValue = "new"
      var oldValue = "old"
      var testOldValue = ""
      var testNewValue = ""
      var called = false

      treant.register("pagination", function (prototype, internals) {
        internals.attribute("test", {
          default: oldValue,
          onchange: function (old, value) {
            testOldValue = old
            testNewValue = value
            called = true
          }
        })
      })
      var component = treant.component(pagination6)
      assert.equal(component.test, oldValue)
      component.test = oldValue
      assert.isFalse(called)
      component.test = newValue
      assert.isTrue(called)
      assert.equal(component.test, newValue)
      assert.equal(testOldValue, oldValue)
      assert.equal(testNewValue, newValue)
    })
  })
})

describe("hook", function () {

  // setHookAttribute()
  describe("setHookAttribute()", function () {
    it("should be able to change hook attribute", function () {
      treant.hook.setHookAttribute("component")
      var element = treant.hook.findComponent("pagination")
      assert.equal(element, customAttribute)
      treant.hook.setHookAttribute("data-component")
    })
  })

  // createComponentSelector()
  //describe("createComponentSelector()", function () {
  //  it("should return a component selector that matches components", function () {})
  //})

  // findComponent()
  describe("findComponent()", function () {
    it("should find a component in the document", function () {
      var element = treant.hook.findComponent("pagination")
      assert.equal(element, pagination)
    })
    it("should find a component in the given element", function () {
      var element = treant.hook.findComponent("pagination", scope)
      assert.equal(element, pagination3)
    })
  })

  // findAllComponent()
  describe("findAllComponent()", function () {
    it("should find all components in the document", function () {
      var elements = treant.hook.findAllComponent("pagination", scope2)
      assert.isArray(elements)
      assert.lengthOf(elements, 4)
    })
    it("should find all components in the given element", function () {
      var elements = treant.hook.findAllComponent("pagination", scope)
      assert.isArray(elements)
      assert.lengthOf(elements, 1)
    })
  })

  // findSubComponents()
  describe("findSubComponents()", function () {
    it("should find the sub components of a given element", function () {
      var elements = treant.hook.findSubComponents("pagination", pagination)
      assert.isArray(elements)
      assert.lengthOf(elements, 1)
      elements = treant.hook.findSubComponents("pagination", pagination4)
      assert.lengthOf(elements, 4)
    })
  })

  // getComponentName()
  describe("getComponentName()", function () {
    it("should return the full component name", function () {
      var name = treant.hook.getComponentName(pagination)
      assert.equal(name, "pagination")
    })
    it("should return the full component name of a sub component camelized", function () {
      var element = treant.hook.findSubComponents("pagination", pagination)[0]
      var name = treant.hook.getComponentName(element)
      assert.equal(name, "pagination:pageNumber")
    })
    it("should return the full component name of a sub component raw", function () {
      var element = treant.hook.findSubComponents("pagination", pagination)[0]
      var name = treant.hook.getComponentName(element, false)
      assert.equal(name, "pagination:page-number")
    })
  })

  // getMainComponentName()
  describe("getMainComponentName()", function () {
    it("should return the component name of a main element", function () {
      var name = treant.hook.getMainComponentName(pagination)
      assert.equal(name, "pagination")
    })
    it("should return the main part of a sub component", function () {
      var element = treant.hook.findSubComponents("pagination", pagination)[0]
      var name = treant.hook.getMainComponentName(element)
      assert.equal(name, "pagination")
    })
    it("should return the main part of a sub component camelized", function () {
      var element = treant.hook.findSubComponents("custom-pagination", pagination2)[0]
      var name = treant.hook.getMainComponentName(element)
      assert.equal(name, "customPagination")
    })
    it("should return the main part of a sub component raw", function () {
      var element = treant.hook.findSubComponents("custom-pagination", pagination2)[0]
      var name = treant.hook.getMainComponentName(element, false)
      assert.equal(name, "custom-pagination")
    })
  })

  // getSubComponentName()
  describe("getSubComponentName()", function () {
    it("should return an empty string for a main element", function () {
      var name = treant.hook.getSubComponentName(pagination)
      assert.equal(name, "")
    })
    it("should return the sub part of a sub component", function () {
      var element = treant.hook.findSubComponents("pagination", pagination)[0]
      var name = treant.hook.getSubComponentName(element)
      assert.equal(name, "pageNumber")
    })
    it("should return the sub part of a sub component camelized", function () {
      var element = treant.hook.findSubComponents("custom-pagination", pagination2)[0]
      var name = treant.hook.getSubComponentName(element)
      assert.equal(name, "pageNumber")
    })
    it("should return the sub part of a sub component raw", function () {
      var element = treant.hook.findSubComponents("custom-pagination", pagination2)[0]
      var name = treant.hook.getSubComponentName(element, false)
      assert.equal(name, "page-number")
    })
  })

  // assignSubComponents()
  describe("assignSubComponents()", function () {
    it("should assign sub component to an object", function () {
      var object = {}
      var elements = treant.hook.findSubComponents("pagination", pagination)
      treant.hook.assignSubComponents(object, elements)
      assert.isDefined(object.pageNumber)
    })
    it("should assign raw nodes by default", function () {
      var object = {}
      var elements = treant.hook.findSubComponents("pagination", pagination)
      treant.hook.assignSubComponents(object, elements)
      assert.isDefined(object.pageNumber)
      assert.instanceOf(object.pageNumber, Element)
    })
  })

  // filter()
  //describe("filter()", function () {
  //  it("should filter components in an array", function () {})
  //})

})
