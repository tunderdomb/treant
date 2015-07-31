Custom components
=================


Custom components are instances of `Component`s.
They are registered internally and can be instantiated with their name or their constructor.

Custom components can define their own api on their prototype,
and do initialization in their own constructor.

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
  - Call the user provided constructor


## Register custom components


Before using them, you need to register custom components.
These are essentially class declarations.

#### `treant.register(name, constructor)`

**String** `name`

**Function** `constructor(options)`

Registers a custom component with this name, and this constructor.
The name and the constructor is required.

**The constructor is always the last argument.** See the below signature to understand more.

Every constructor receives an options object,
which may contain component specific data; e.g. needed to initialize the component.

#### `treant.register(name, mixin..., constructor)`

**String** `name`

**Function...** `mixin(prototype)`

**Function** `constructor(options)`

You can provide any number of mixin functions.
They will be executed in the order provided.
These functions receive the custom component's prototype as their only argument,
and their return value is ignored.

Usages for mixins:

  - if you need a custom API on the prototype, you can define it in a mixin,
    preferably in the last one, so it overrides existing methods
  - this is the place where you can configure the internals
  - enables you to define common/shared behaviours that can be applied to multiple components


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
