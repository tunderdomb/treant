Component
=========


### The constructor

#### `Component(element, options)`

**Element** `element`

**Object** `options`


### Static functions

#### `Component.create(element, options)`

**Element** `element`

**Object** `options`

Instantiates a component based on these rules:

Takes the element's component name and

  - see if there's a custom component registered with this name
  - see if there's a wildcard component registered with this name as `"*"`
  - returns a raw component


### Instance properties

#### `component.element`

type: **Element**

default: `null`

The element given to this component.


#### `component.components`

type: **Object**

default: `{}`

The sub components of this component.

For more info on sub components, see the [Sub components doc](/docs/Sub components.md).


#### `component.internals`

type: **Internals**

default: `new Internals()`

The internals of this component.


### Instance methods

#### `component.delegate(options)`

Maps to `treant.delegate(options)`
with the addition that it sets `options.element` to `this.element`
and `options.context` to `this` if its not defined.


#### `component.dispatch(type, detail)`

**String** `type`

**Object** `detail`

Dispatches a `window.CustomEvent` on this component's element.
If there's an event type defined on the internals, it uses that for the event definition.

For more info on event definitions and internals, see the [Internals doc](/docs/Internals.md).

#### `component.findComponent(name)`

**String** `name`

Maps to `treant.hook.findComponent(name)`.


#### `component.findAllComponent(name)`

**String** `name`

Maps to `treant.hook.findAllComponent(name)`.


#### `component.findSubComponents(name)`

**String** `name`

Maps to `treant.hook.findSubComponents(name)`.


#### `component.getComponentName(name)`

**String** `name`

Maps to `treant.hook.getComponentName(name)`.


#### `component.getMainComponentName(name)`

**String** `name`

Maps to `treant.hook.getMainComponentName(name)`.


#### `component.getSubComponentName(name)`

**String** `name`

Maps to `treant.hook.getSubComponentName(name)`.


#### `component.clearSubComponents(name)`

**String** `name`

Resets the `this.components` object on this component.


#### `component.assignSubComponents(transform)`

**Function|Boolean** `transform`

Collects sub components for this element and assigns them by name to
the component's `components` object.

Component names are converted to camelCase.

For more info on sub components, see the [Sub components doc](/docs/Sub components.md).


