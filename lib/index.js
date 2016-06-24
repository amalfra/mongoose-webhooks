(function () {
   'use strict';

  var request = require('request');
  var OptionError = require('./errors/optionError');
  var HttpError = require('./errors/httpError');
  module.exports = MongooseWebhooksPlugin;

  function MongooseWebhooksPlugin(schema, opts) {
    var isNew = false;
    // These are the required options
    var requiredOpts = ['url'];

    if (!opts)
      opts = {};

    // The plugin accepts only `Object` as options
    if (!opts || (opts.constructor !== Object))
      throw new OptionError('Invalid options - Options passed to' +
        'plugin must be Object.');

    // Check whether required options are passed. If not throw Error
    var diff = requiredOpts.filter(function(i) { return !(i in opts); });
    if (diff.length)
      throw new OptionError('Missing required options: ' + diff.join());

    // Set the isNew flag which determines whether its insert or update
    schema.pre('save',
      function (next) {
        isNew = this.isNew;
        return next();
      }
    );

    schema.post('save',
      function (doc) {
        // If we have isNew flag then it's an update
        var event = (isNew) ? 'save' : 'update';
        _sendWebhook(event, doc, opts.url, opts.useragent);
      }
    );

    schema.post('remove',
      function (doc) {
        _sendWebhook('remove', doc, opts.url, opts.useragent);
      }
    );
  }

  function _sendWebhook(event, doc, url, useragent) {
    // The JSON payload that will be send. eg:
    //    {
    //      "event": "save",
    //      "data": {"__v":0,"name":"dummy","_id":"576cf0eacdefabd20a52ac89"}
    //    }
    var payload = {
      event: event,
      data: doc
    };

    var requestOpts = {
      uri: url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    };

    // If `useragent` option is present set the header
    if (useragent)
      requestOpts.headers['User-Agent'] = useragent;

    request(requestOpts,
      function (err) {
        if (err)
          throw new HttpError('Failed to send Webhook: HTTP error - ' +
            err.code);
      }
    );
  }
}());
