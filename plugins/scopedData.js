var object = require("../util/object")
var camelcase = require("camelcase")

module.exports = function () {
  return function plugin (prototype) {

    object.method(prototype, "getScopedData", function (scope) {
      var attributes = this.element.attributes
      scope = scope || this.getComponentName()

      return [].reduce.call(attributes, function (scopedData, attribute) {
        var name = attribute.name
        var value = attribute.value

        if (name.indexOf(scope) === 0) {
          name = name.replace(scope, "")
          scopedData[name] = value
        }

        return scopedData
      }, {})
    })
  }
}
