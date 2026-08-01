'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const fixtureCredential = 'TEST_ONLY_DO_NOT_USE';
const fixtureRoot = join(__dirname, 'fixtures', 'xunji');

function readFixture(name) {
  return readFileSync(join(fixtureRoot, name));
}

function createMemoryCache(entries = {}) {
  const data = new Map(Object.entries(entries));
  return {
    get(date) { return data.get(date); },
    set(date, value) { data.set(date, value); },
    values() { return [...data.values()]; }
  };
}

function createFixtureClient(response) {
  const calls = [];
  return {
    calls,
    async fetchDay(date) {
      calls.push(date);
      return response;
    }
  };
}

function createMemoryLogger() {
  const entries = [];
  return { entries, info: (...values) => entries.push(values) };
}

function assertNoFixtureCredential(assert, surfaces) {
  for (const [name, value] of Object.entries(surfaces)) {
    assert.equal(JSON.stringify(value).includes(fixtureCredential), false, `${name} leaked the fixture credential`);
  }
}

module.exports = {
  assertNoFixtureCredential,
  createFixtureClient,
  createMemoryCache,
  createMemoryLogger,
  fixtureCredential,
  readFixture
};
