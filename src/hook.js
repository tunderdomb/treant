var camelcase = require("camelcase")
var COMPONENT_ATTRIBUTE = "data-component"

var hook = module.exports = {}

hook.createComponentSelector = createComponentSelector
hook.findComponent = findComponent
hook.findAllComponent = findAllComponent
hook.findSubComponents = findSubComponents
hook.getComponentName = getComponentName
hook.getMainComponentName = getMainComponentName
hook.getSubComponentName = getSubComponentName
hook.assignSubComponents = assignSubComponents
hook.filter = filter

function createComponentSelector (name) {
  return name
      ? '[' + COMPONENT_ATTRIBUTE + '="' + name + '"]'
      : '[' + COMPONENT_ATTRIBUTE + ']'
}

function findComponent (name, root) {
  return (root || document).querySelector(createComponentSelector(name))
}

function findAllComponent (name, root) {
  return (root || document).querySelectorAll(createComponentSelector(name))
}

function findSubComponents (name, root) {
  name = camelcase(name)
  return filter((root || document).querySelectorAll(createComponentSelector()), function (componentValue/*, element*/) {
    componentValue = componentValue || ""
    return !!~componentValue.indexOf(":") && componentValue.indexOf(name) === 0
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
  return cc ? camelcase(value[0]) : value[0]
}

function getSubComponentName (element, cc) {
  cc = cc == undefined || cc
  var value = getComponentName(element, false).split(":")
  return cc ? camelcase(value[1]) : value[1]
}

function assignSubComponents (obj, rootComponentName, root, transform) {
  return findSubComponents(rootComponentName, root)
      .reduce(function (obj, element) {
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
        return filter(getComponentName(element), element)
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
