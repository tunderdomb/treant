treant
======

## Install

    npm install treant


## Usage

With browserify

```js
var treant = require("treant")
```

or use on of the scripts from the [`build`](/build) dir in the repo.


## Docs

  - [Component](/docs/Component.md)
  - [Custom components](/docs/Custom components.md)
  - [Internals](/docs/Sub components.md)
  - [Sub components](/docs/Sub components.md)


## API

```js
treant.register()
treant.component()
treant.Component()
treant.delegate()
treant.fragment()

treant.hook.<...>

treant.plugins.attributes()
treant.plugins.findBy()

treant.util.extend()
treant.util.merge()
treant.util.object()
```


## Example

```html
<div data-component="pagination">
    <a data-component="pagination:page-prev">prev</a>
    <a data-component="pagination:page-number">1</a>
    <a data-component="pagination:page-number">2</a>
    <a data-component="pagination:page-number">3</a>
    <a data-component="pagination:page-next">next</a>
</div>
```

```js
function plugin (prototype) {
  // this is a mixin
  prototype.hey = function () {
    return "hey "
  }
}
function plugin2 (prototype) {
  // this is a mixin too
  prototype.ho = function () {
    return "ho "
  }
}
function pagination (prototype) {
  // configure internals
  prototype.internals.components.pageNumber = []
}

var Pagination = treant.register("pagination", plugin, plugin2, pagination, function (options) {
  // this is a constructor
  this.lets = options.lets
  console.log(this.element)
  console.log(this.components)
})

var pagination = treant.component("pagination", {lets: "go"})
// <div data-component="pagination">
// {pageNumber: [Component, Component, Component], pagePrev: Component, pageNext: Component}
console.log(pagination.hey(), pagination.ho(), "let's ", pagination.lets)
// hey ho let's go
```

## Conventions, concepts, things to keep in mind


  - sub components are declared by having the main component in their name, separated by `":"`

    ```html
    <div data-component="pagination">
        <a data-component="pagination:page-number"></a>
    </div>
    ```

  - component names are converted to camelcase

    ```js
    pagination.components.pageNumber instanceOf treant.Component
    ```

  - if you register sub components too, then the matching constructor will be used

    ```js
    var PageNumber = treant.register("pagination:page-number", function(pagination){})
    pagination.components.pageNumber instanceOf PageNumber
    ```

  - custom component constructors only receive the options object
  - custom sub component constructors receive main component as their argument
  - if you need sub components as arrays, use the internals to pre-define an array like this:

    ```js
    function plugin (prototype) {
      prototype.internals.components.pageNumber = []
    }
    treant.register("pagination", plugin, function (options) {})

    pagination.components.pageNumber.length
    ```
    
  - there's no real inheritance; custom components extend the base once, but you can't extend custom components.
    If you need to share behaviour between components, or build upon a base prototype,
    define them as plugins/mixin and use them on those components that need them.
    
    ```js
    function inputBase (prototype) {
      prototype.getValue = function() {
        return this.element.value
      }
      prototype.convertValue = function() {
        return this.getValue()
      }
    }
    function numberInputBase(prototype) {
      prototype.convertValue = function() {
        return parseInt(this.getValue())
      }
    }
    treant.register("text-input", inputBase, function(){})
    treant.register("number-input", numberInputBase, function(){})
    ```

  - You can override what attribute is used for the hook

    ```js
    treant.hook.setHookAttribute("some-other-attribute")
    ```

    ```html
    <div some-other-attribute="pagination">
    ```

## Licence

MIT
