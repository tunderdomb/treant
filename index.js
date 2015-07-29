var registry = require("./src/registry")
var register = require("./src/register")
var component = require("./src/create")
var Component = require("./src/Component")
var delegate = require("./src/delegate")
var fragment = require("./src/fragment")

var treant = {}
module.exports = treant

treant.register = register
treant.component = component
treant.Component = Component
treant.delegate = delegate
treant.fragment = fragment

var plugins = {}
treant.plugins = plugins

plugins.attributes = require("./plugins/attributes")
plugins.dispatcher = require("./plugins/dispatcher")
plugins.findBy = require("./plugins/findBy")

var util = {}
treant.util = util

util.extend = require("./util/extend")
util.merge = require("./util/merge")
util.object = require("./util/object")
