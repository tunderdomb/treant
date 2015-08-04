Internals
=========

Every component prototype has a property named `.internals` which contains configurations for instances.
You can set values on it in a plugin/mixin.
Use this to change how the component behaves.

### `internals.autoAssign`

type: **Boolean**

default: `true`

If set to `true`, the component will automatically discover and assign sub components for an element.
Custom components' constructors will already have access to these members.


### `internals.convertSubComponents`

type: **Boolean**

default: `false`

By default, sub components are wrapped in a `Component` object (or whatever is defined as the wildcard `"*"` component).
You can change this behaviour with this flag.
If it's set to false, the native DOM Element will be assigned.


### `internals.components`

type: **Object**

default: `{}`

Use this object to pre-define components.
For now, you can pre-set a sub component to an array so every element with that name
will be collected, not just the first.


### `internals.onCreate(constructor)`

**Function** `constructor`

Register a constructor for this component.
These functions will be called each time when a new component instance is created.

A constructor's signature is: `function (options) {}`.
It receives the options object provided during creation.


### `internals.method(name, fn)`

**String** `name`

**Function** `fn`

Register a method on the prototype with this name.
Using this will define an object property that is not configurable and not enumerable.


### `internals.property(name, value)`

**String** `name`

**any** `value`

Register a property on the prototype with this name.
Using this will define an object property that is configurable but not enumerable.


### `internals.get(name, fn)`

**String** `name`

**Function** `fn`

Register a getter on the prototype with this name.


### `internals.set(name, fn)`

**String** `name`

**Function** `fn`

Register a setter on the prototype with this name.


### `internals.accessor(name, get, set)`

**String** `name`

**Function** `get`

**Function** `set`

Register a getter and a setter on the prototype with this name.


### `internals.accessor(name, get, set)`

**String** `name`

**Function** `get`

**Function** `set`

Register a getter and a setter on the prototype with this name.


### `internals.event(type, definition)`

**String** `type`

**Object** `definition` with the following properties

**Object** `definition.detail` default: `null`

**Element** `definition.view` default: `window`

**Boolean** `definition.bubbles` default: `true`

**Boolean** `definition.cancelable` default: `true`

Define event definitions for dispatching.
the `detail` property is always provided to the `dispatch(type, detail)` method,
but you can set a sensible default here if you want.


### `internals.attribute(name, definition)`

**String** `name` the attribute name on the element. This will be converted to camelCase when added as a property.

**Object|String|Boolean|Number** `definition` If not a definition object, this value will be used to guess the type, and also as the default value.

**String** `definition.type` `"string"`, `"number"`, `"float"`, `"boolean"`. According to this, the actual attribute value will be converted from string.

**String|Boolean|Number** `definition.default` a value returned when the element's attribute is `null` (not set).

**Function** `definition.get` optional

**Function** `definition.set` optional

Register an attribute getter/setter on the prototype.

Attribute accessors are proxies to the element's attributes.
You can use them to have a clear access to DOM attributes.

Example:

```html
<div hey-ho="let's go" counter="10.2" visible>
```

```js
internals.attribute("hey-ho", "default")
internals.attribute("counter", 9)
internals.attribute("visible", true)
internals.attribute("blah", {
    type: "string",
    default: "blah"
})
```

```js
component.heyHo == "let's go"
component.counter == 10.2
component.visible == true
component.blah == "blah"
```
