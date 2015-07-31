Sub components
==============

In the example below, page numbers are sub components of the pagination.

```html
<div data-component="pagination">
    <a data-component="pagination:page-number">1</a>
    <a data-component="pagination:page-number">2</a>
    <a data-component="pagination:page-number">3</a>
</div>
```

Sub components are automatically collected and assigned to the `components` object
of a main component.

Their name are camelcase converted, so `page-number` becomes `components.pageNumber`.

## Component arrays

By default every sub component is considered a single element.
In the above example, only the first page number would be collected.

```js
console.log(pagination.components.pageNumber)
// Component({element: ...})
```

If you want to treat a sub component as a collection of elements,
configure it on the internals, when registering the custom component.

Like this:


```js
function plugin (prototype) {
  prototype.internals.components.pageNumber = []
}
treant.register("pagination", plugin, function (options) {})
```

And when you access it, it will be an array of sub components

```js
console.log(pagination.components.pageNumber)
// [Component, Component, Component]
console.log(pagination.components.pageNumber.length)
// 3
```

## Custom sub components

By default, sub components will be raw `Component` instances.
If you register a custom component with the sub components full name
then that will be used to instantiate the sub component.

For example:

```js
var PageNumber = treant.register("pagination:page-number", function (pagination) {})
```

```js
console.log(pagination.components.pageNumber)
// [PageNumber, PageNumber, PageNumber]
```

**IMPORTANT:** sub component constructors only receive the main component instead of the options object.

If you don't want this, you can disable auto assigning of sub components in the [internals](/docs/Internals.md),
and instantiate your sub components yourself.
