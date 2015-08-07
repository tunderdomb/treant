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

