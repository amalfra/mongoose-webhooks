const fetch = require('node-fetch');
const OptionError = require('./errors/optionError');
const HttpError = require('./errors/httpError');

function MongooseWebhooksPlugin(schema, opts) {
  let isNew = false;
  // Support for single url
  opts.urls = opts.urls || opts.url;
  // These are the required options
  const requiredOpts = ['urls'];

  if (!opts) {
    opts = {};
  }

  // The plugin accepts only `Object` as options
  if (!opts || (opts.constructor !== Object)) {
    throw new OptionError('Invalid options - Options passed to' +
      'plugin must be Object.');
  }

  // Check whether required options are passed. If not throw Error
  const diff = requiredOpts.filter(function(i) { return !(i in opts); });
  if (diff.length) {
    throw new OptionError('Missing required options: ' + diff.join());
  }

  // Make url an array for multiple webhooks
  if (typeof opts.urls === 'string') {
    opts.urls = [opts.urls];
  }

  // Set the isNew flag which determines whether its insert or update
  schema.pre('save',
    function(next) {
      isNew = this.isNew;
      return next();
    },
  );

  schema.post('save',
    function(doc) {
      // If we have isNew flag then it's an update
      const event = isNew ? 'save' : 'update';
      opts.urls.forEach(
        function(url) {
          _sendWebhook(event, doc, url, opts.useragent);
        },
      );
    },
  );

  schema.post('remove',
    function(doc) {
      opts.urls.forEach(
        function(url) {
          _sendWebhook('remove', doc, url, opts.useragent);
        },
      );
    },
  );
}

function _sendWebhook(event, doc, url, useragent) {
  /*
    The JSON payload that will be send. eg:
      {
        "event": "save",
        "data": {"__v":0,"name":"dummy","_id":"576cf0eacdefabd20a52ac89"}
      }
  */
  const payload = {
    event: event,
    data: doc,
  };

  const requestOpts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };

  // If `useragent` option is present set the header
  if (useragent) {
    requestOpts.headers['User-Agent'] = useragent;
  }

  fetch(url, requestOpts)
    .then(function(res) {
      if (!res.ok) {
        throw new HttpError('Failed to send Webhook: HTTP error - ' +
          res.status);
      }
    })
    .catch(function(err) {
      if (err) {
        throw new HttpError('Failed to send Webhook: HTTP error - ' +
          err.code);
      }
    });
}

module.exports = MongooseWebhooksPlugin;
