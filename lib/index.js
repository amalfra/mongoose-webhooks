import { EventEmitter } from 'events';

import OptionError from './errors/optionError.js';

export default function MongooseWebhooksPlugin(schema, opts = {}) {
  if (opts?.constructor !== Object) {
    throw new OptionError('Options must be an Object.');
  }

  opts.urls = opts.urls || opts.url;
  if (!opts.urls) {
    throw new OptionError('Missing required options: urls');
  }

  const urls = Array.isArray(opts.urls) ? opts.urls : [opts.urls];

  schema.statics._webhookEmitter = new EventEmitter();

  const emitAll = (event, doc) => {
    const payload = JSON.stringify({ event, data: doc });

    return Promise.allSettled(
      urls.map(url =>
        sendWebhook(url, payload, opts.useragent)
      )
    );
  };

  const getDoc = async (model, query) =>
    model.findOne(query).lean();

  const getDocsByIds = async (model, ids) =>
    model.find({ _id: { $in: ids } }).lean();

  schema.pre('save', function (next) {
    this.wasNew = this.isNew;
    next();
  });
  schema.post('save', function (doc) {
    const event = this.wasNew ? 'save' : 'update';
    emitAll(event, doc);
  });

  schema.post('updateOne', async function (result) {
    if (!(result.upsertedCount || result.modifiedCount)) return;

    const doc = await getDoc(this.model, this.getQuery());
    if (!doc) return;

    const event = result.upsertedCount ? 'save' : 'update';
    emitAll(event, doc);
  });

  schema.pre('updateMany', async function () {
    this._ids = await this.model
      .find(this.getFilter())
      .distinct('_id');
  });
  schema.post('updateMany', async function (result) {
    if (!(result.upsertedCount || result.modifiedCount)) return;

    const docs = await getDocsByIds(
      this.model,
      result.upsertedId ? [result.upsertedId] : this._ids
    );

    const event = result.upsertedCount ? 'save' : 'update';

    await Promise.allSettled(
      docs.map(doc => emitAll(event, doc))
    );
  });

  schema.post('insertMany', function (docs) {
    Promise.allSettled(
      docs.map(doc => emitAll('save', doc))
    );
  });

  schema.post('findOneAndUpdate', async function (doc) {
    const updated = doc
      ? await this.model.findById(doc.id).lean()
      : await getDoc(this.model, this.getQuery());

    if (!updated) return;

    const event = doc ? 'update' : 'save';
    emitAll(event, updated);
  });

  schema.post('replaceOne', async function (result) {
    if (!result.modifiedCount) return;

    const doc = await getDoc(this.model, this.getQuery());
    if (doc) emitAll('update', doc);
  });

  schema.post('findOneAndReplace', async function () {
    const doc = await getDoc(this.model, this.getQuery());
    if (doc) emitAll('update', doc);
  });

  const emitDelete = doc => emitAll('remove', doc);
  schema.pre('findOneAndDelete', async function () {
    this._doc = await getDoc(this.model, this.getFilter());
  });
  schema.post('findOneAndDelete', function () {
    if (this._doc) emitDelete(this._doc);
  });
  schema.pre('deleteOne', async function () {
    this._doc = await getDoc(this.model, this.getFilter());
  });
  schema.post('deleteOne', function () {
    if (this._doc) emitDelete(this._doc);
  });
  schema.pre('deleteMany', async function () {
    this._docs = await this.model.find(this.getFilter()).lean();
  });
  schema.post('deleteMany', function () {
    (this._docs || []).forEach(emitDelete);
  });
}

function sendWebhook(url, payload, useragent) {
  const headers = { 'Content-Type': 'application/json' };
  if (useragent) headers['User-Agent'] = useragent;

  return fetch(url, {
    method: 'POST',
    headers,
    body: payload,
  }).then(res => {
    if (!res.ok) {
      console.error('Failed to send Webhook: HTTP error', res.status);
    }
  }).catch(err => {
    console.error('Error in send Webhook: HTTP error', err?.message || err);
  });
}
