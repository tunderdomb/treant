var extend = require("./extend")

module.exports = function( obj, extension ){
  return extension(extend({}, obj), extension)
}
