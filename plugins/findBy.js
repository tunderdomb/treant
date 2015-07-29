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
