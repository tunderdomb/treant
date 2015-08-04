Custom components
=================


Custom components are instances of `Component`s.
They are registered internally and can be instantiated with their name or their constructor.

Custom components can define their own api on their prototype,
and do initialization in their own constructor.
Via mixins, there can be any number of constructors, which during creation will be called
in the order theye were defined. This way mixins can hook into component creation too.

A custom components constructor is always called after the base `Component`'s.

A custom component's constructor only receives the `options` object provided when instantiating a custom component.
This is for convenience, because at that point
the instance already have the `this.element` and `this.components` properties.

During a custom component's definition, this happens in order:

  - Use a proxy constructor that will be the return value
  - Extend the proxy constructor's prototype
  - Set `internals` property on the prototype
  - Apply mixins in argument order

During instantiation, this happens inside the proxy constructor:

  - Call the base `Component`'s constructor
  - Call the user provided constructors


## Register custom components


Before using them, you need to register custom components.
It's much like declaring a class, but you can add several definitions to it.

#### `treant.register(name, mixin...)`

**String** `name`

**Function|Object...** `mixin(prototype, internals)`

You can provide any number of mixin functions or objects,
they will be applied in the order provided.
Mixin functions receive the custom component's prototype and its internals as argument,
their `this` value is the also the custom component's prototype.
Their return value is ignored.

Mixin objects are used to augment the prototype with their properties.
Functions are defined as un-configurable, properties are defined configurable.

If there's a property in the mixin object named `onCreate`, it's used to register a constructor.
Learn more about internals in the [Internals](/docs/Internals.md) docs!

Usages for mixins:

  - if you need a custom API on the prototype, you can define it in a mixin,
    preferably in the last one, so it overrides existing methods
  - this is the place where you can configure the internals
  - enables you to define common/shared behaviours that can be applied to multiple components

Examples:

```js
treant.register("pagination", {
  onCreate: function (options) {
    // this is a constructor
  },
  testMethod: function(){},
  testProperty: 1
})
```

```js
function someMixin(prototype) {
  prototype.mixinMethod = function(){}
}
treant.register("pagination", someMixin, function(prototype) {
  prototype.testMethod = function(){}
})
```

## Using custom components


### Calling the constructor directly

#### `new CustomComponent(element, options)`

**Element** `element`

**Object** `options`

Using `element` and the `options` object, creates a custom component.


### Calling `treant.component()` with a `String`.

#### `treant.component(name)`

**String** `name`

Finds the first element where `data-component="<name>"` in the `document`.

If there's a registered custom component with this name, it uses that constructor.
If there's a component named `"*"` it uses that.
Else it uses the base `Component` to create a component.

#### `treant.component(name, options)`

**String** `name`

**Object** `options`

Finds the first element where `data-component="<name>"` in the `document`,
and passed the `options` object to the constructor.

#### `treant.component(name, root)`

**String** `name`

**Element** `root`

Finds the first element where `data-component="<name>"` in the `root` element.

#### `treant.component(name, root, options)`

**String** `name`

**Element** `root`

**Object** `options`

Finds the first element where `data-component="<name>"` in the `root` element,
and passed the `options` object to the constructor.


### Calling `treant.component()` with an `Element`.

It's basically the same as calling the constructor,
only that the constructor doesn't try to guess what constructor to use,
since it already is one.

#### `treant.component(element)`

**Element** `element`

If the element has a component attribute, it uses its value to figure out which constructor to use.

#### `treant.component(element, options)`

**Element** `element`

**Object** `options`

Provides an options object for the constructor.
