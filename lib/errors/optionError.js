(function () {
   'use strict';

  var util = require('util');

  module.exports = MongooseWebhookOptionError;

  function MongooseWebhookOptionError(message, extra) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.extra = extra;
  }

  // Custom Error `MongooseWebhookOptionError` Object thrown on
  // plugin option validation
  util.inherits(MongooseWebhookOptionError, Error);
}());
