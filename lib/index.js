import fetch from 'node-fetch';

import OptionError from './errors/optionError.js';
import HttpError from './errors/httpError.js';

function MongooseWebhooksPlugin(schema, opts) {
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

  // Set the wasNew flag which determines whether its insert or update
  schema.pre('save',
    function(next) {
      this.wasNew = this.isNew;
      return next();
    },
  );

  schema.post('save',
    function(doc) {
      // If we have wasNew flag then it's an update
      const event = this.wasNew ? 'save' : 'update';
      opts.urls.forEach(
        function(url) {
          _sendWebhook(event, doc, url, opts.useragent);
        },
      );
    },
  );

  schema.post('findOneAndUpdate', function(doc) {
    opts.urls.forEach(
      function(url) {
        _sendWebhook('update', doc, url, opts.useragent);
      },
    );
  });

  function handleDelete(doc) {
    opts.urls.forEach(
      function(url) {
        _sendWebhook('remove', doc, url, opts.useragent);
      },
    );
  }
  schema.pre('findOneAndDelete', async function () {
    this._deletedDoc = await this.model.findOne(this.getFilter()).lean();
  });
  schema.post('findOneAndDelete', function () {
    handleDelete(this._deletedDoc);
  });
  schema.post(
    'deleteOne',
    { document: true, query: false },
    function() {
      handleDelete(this);
    }
  );
  schema.pre('deleteOne', { document: false, query: true }, async function() {
    this._deletedDoc = await this.model.findOne(this.getFilter()).lean();
  });
  schema.post('deleteOne', { document: false, query: true }, function() {
    handleDelete(this._deletedDoc);
  });
  schema.pre('deleteMany', async function() {
    this._deletedDocs = await this.model.find(this.getFilter()).lean();
  });
  schema.post('deleteMany', function() {
    (this._deletedDocs || []).forEach(handleDelete);
  });
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

export default MongooseWebhooksPlugin;
