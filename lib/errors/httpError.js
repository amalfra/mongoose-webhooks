(function () {
   'use strict';

  var util = require('util');

  module.exports = MongooseWebhookHttpError;

  function MongooseWebhookHttpError(message, extra) {
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.message = message;
    this.extra = extra;
  }

  // Custom Error `MongooseWebhookHttpError` Object thrown on
  // HTTP errors when sending webhook
  util.inherits(MongooseWebhookHttpError, Error);
}());
