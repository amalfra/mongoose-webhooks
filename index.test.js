import mongoose from 'mongoose';
import { jest } from '@jest/globals';

import MongooseWebhooksPlugin from './index.js';
import OptionError from './lib/errors/optionError.js';

let TestModel;

beforeAll(async () => {
  const testSchema = new mongoose.Schema({
    name: String,
  });

  testSchema.plugin(MongooseWebhooksPlugin, {
    urls: 'http://example.com/webhook',
    useragent: 'test-agent',
  });

  TestModel =
    mongoose.models.TestModel ||
    mongoose.model('TestModel', testSchema);
});

beforeEach(async () => {
  await TestModel.deleteMany({});
  jest.clearAllMocks();
});

function mockFetchSuccess() {
  fetch.mockResolvedValue({
    ok: true,
    status: 200,
  });
}

function mockFetchFail() {
  fetch.mockResolvedValue({
    ok: false,
    status: 500,
  });
}

describe('MongooseWebhooksPlugin - options', () => {
  test('throws OptionError if options missing', () => {
    const schema = new mongoose.Schema({});
    expect(() => schema.plugin(MongooseWebhooksPlugin)).toThrow(OptionError);
  });

  test('throws OptionError if options is not object', () => {
    const schema = new mongoose.Schema({});
    expect(() =>
      schema.plugin(MongooseWebhooksPlugin, 'invalid')
    ).toThrow(OptionError);
  });

  test('throws OptionError if urls missing', () => {
    const schema = new mongoose.Schema({});
    expect(() =>
      schema.plugin(MongooseWebhooksPlugin, {})
    ).toThrow(OptionError);
  });

  test('passes if url given', () => {
    const schema = new mongoose.Schema({});
    expect(() =>
      schema.plugin(MongooseWebhooksPlugin, { url: 'http://example.com/webhook' })
    ).not.toThrow();
  });

  test('passes if urls given as string', () => {
    const schema = new mongoose.Schema({});
    expect(() =>
      schema.plugin(MongooseWebhooksPlugin, { urls: 'http://example.com/webhook' })
    ).not.toThrow();
  });

  test('passes if multiple urls given', () => {
    const schema = new mongoose.Schema({});
    expect(() =>
      schema.plugin(MongooseWebhooksPlugin, { urls: ['http://example.com/webhook', 'http://example2.com/webhook'] })
    ).not.toThrow();
  });
});

describe('MongooseWebhooksPlugin - save hook', () => {
  test('sends save webhook on insert using create', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'insert' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];

    expect(url).toBe('http://example.com/webhook');
    const body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert');
    expect(opts.headers['User-Agent']).toBe('test-agent');
  });

  test('sends save webhook on insert using save', async () => {
    mockFetchSuccess();

    const doc = new TestModel({ name: 'insert' });
    await doc.save();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];

    expect(url).toBe('http://example.com/webhook');
    const body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert');
    expect(opts.headers['User-Agent']).toBe('test-agent');
  });

  test('sends save webhook on insert using insertMany', async () => {
    mockFetchSuccess();

    await TestModel.insertMany([
      { name: 'insert' },
      { name: 'insert2' },
    ]);

    expect(fetch).toHaveBeenCalledTimes(2);
    let [url, opts] = fetch.mock.calls[0];

    expect(url).toBe('http://example.com/webhook');
    let body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert');
    expect(opts.headers['User-Agent']).toBe('test-agent');

    [url, opts] = fetch.mock.calls[1];

    expect(url).toBe('http://example.com/webhook');
    body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert2');
    expect(opts.headers['User-Agent']).toBe('test-agent');
  });

  test('sends save webhook on insert using updateOnce', async () => {
    mockFetchSuccess();

    await TestModel.updateOne(
      { name: 'insert' },
      { $set: { name: 'insert' } },
      { upsert: true },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];

    expect(url).toBe('http://example.com/webhook');
    const body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert');
    expect(opts.headers['User-Agent']).toBe('test-agent');
  });

  test('sends save webhook on insert using updateMany', async () => {
    mockFetchSuccess();

    await TestModel.updateMany(
      { name: 'insert' },
      { $set: { name: 'insert' } },
      { upsert: true },
    );

    // since there is no match of documents matching name "insert" only one document will be upserted
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];

    expect(url).toBe('http://example.com/webhook');
    const body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert');
    expect(opts.headers['User-Agent']).toBe('test-agent');
  });

  test('sends save webhook on insert using findByIdAndUpdate', async () => {
    mockFetchSuccess();

    await TestModel.findByIdAndUpdate(
      '65b2f1a3e4b0ab123456789a',
      { name: 'insert' },
      { upsert: true },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = fetch.mock.calls[0];

    expect(url).toBe('http://example.com/webhook');
    const body = JSON.parse(opts.body);

    expect(body.event).toBe('save');
    expect(body.data.name).toBe('insert');
    expect(opts.headers['User-Agent']).toBe('test-agent');
  });
});

describe('MongooseWebhooksPlugin - update hook', () => {
  test('sends update webhook when using updateOne', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });

    await TestModel.updateOne(
      { _id: doc._id },
      { $set: { name: 'b' } },
    );

    expect(fetch).toHaveBeenCalledTimes(2);

    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('b');
  });

  test('sends update webhook when using updateMany', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });
    await TestModel.create({ name: 'b' });

    await TestModel.updateMany(
      { name: ['a', 'b'] },
      { $set: { name: 'c' } },
    );

    expect(fetch).toHaveBeenCalledTimes(4);

    let body = JSON.parse(fetch.mock.calls[2][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('c');
    body = JSON.parse(fetch.mock.calls[3][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('c');
  });

  test('sends update webhook when using findByIdAndUpdate', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });

    await TestModel.findByIdAndUpdate(
      doc._id,
      { $set: { name: 'b' } },
    );

    expect(fetch).toHaveBeenCalledTimes(2);

    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('b');
  });

  test('sends update webhook when using findOneAndUpdate', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });
    await TestModel.create({ name: 'b' });

    await TestModel.findOneAndUpdate(
      { name: { $in: ['a', 'b'] } },
      { $set: { name: 'c' } },
    );

    expect(fetch).toHaveBeenCalledTimes(3);

    // findOneAndUpdate updates only the first matching document. So expect only one webhook.
    const body = JSON.parse(fetch.mock.calls[2][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('c');
  });

  test('sends update webhook when using save', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });
    doc.name = 'b';
    await doc.save();

    expect(fetch).toHaveBeenCalledTimes(2);

    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('b');
  });

  test('sends update webhook when using replaceOne', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });

    await TestModel.replaceOne(
      { _id: doc.id },
      { name: 'b' },
    );

    expect(fetch).toHaveBeenCalledTimes(2);

    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('b');
  });

  test('sends update webhook when using findOneAndReplace', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'a' });

    await TestModel.findOneAndReplace(
      { _id: doc.id },
      { name: 'b' },
    );

    expect(fetch).toHaveBeenCalledTimes(2);

    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body.event).toBe('update');
    expect(body.data.name).toBe('b');
  });
});

describe('MongooseWebhooksPlugin - remove hook', () => {
  test('sends remove webhook for document when using deleteOne', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'del' });
    await doc.deleteOne({ name: 'del' });

    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetch.mock.calls[1][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del');
  });

  test('sends remove webhook for document when using findOneAndDelete', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'del' });
    await TestModel.findOneAndDelete({ name: 'del' });

    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetch.mock.calls[1][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del');
  });

  test('sends remove webhook for document when using findByIdAndDelete', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'del' });
    await TestModel.findByIdAndDelete(doc._id);

    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetch.mock.calls[1][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del');
  });

  test('sends remove webhook for document when using deleteMany', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'del' });
    await TestModel.create({ name: 'del2' });
    await TestModel.deleteMany({ name: ['del', 'del2'] },);

    expect(fetch).toHaveBeenCalledTimes(4);
    let body = JSON.parse(fetch.mock.calls[2][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del');

    body = JSON.parse(fetch.mock.calls[3][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del2');
  });

  test('sends remove webhook for document when using deleting through document instance', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'del' });
    await doc.deleteOne();

    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetch.mock.calls[1][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del');
  });

  test('sends remove webhook for document when removing all documents in collection', async () => {
    mockFetchSuccess();

    const doc = await TestModel.create({ name: 'del' });
    await TestModel.create({ name: 'del2' });
    await TestModel.deleteMany({});

    expect(fetch).toHaveBeenCalledTimes(4);
    let body = JSON.parse(fetch.mock.calls[2][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del');

    body = JSON.parse(fetch.mock.calls[3][1].body);

    expect(body.event).toBe('remove');
    expect(body.data.name).toBe('del2');
  });
});

describe('MongooseWebhooksPlugin - error handling', () => {
  test('prints error when webhook fails', async () => {
    mockFetchFail();

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await TestModel.create({ name: 'err' });

    expect(spy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('Failed to send Webhook: HTTP error', 500);

    expect(fetch).toHaveBeenCalled();
    spy.mockRestore();
  });
});
