'use strict'
/* globals commands it describe beforeEach afterEach cli nock */

let cmd = commands.find((c) => c.topic === 'addons' && c.command === 'upgrade')
let expect = require('unexpected')
describe('addons:upgrade', () => {
  beforeEach(() => cli.mockConsole())
  afterEach(() => nock.cleanAll())

  it('upgrades an add-on', () => {
    let addon = {name: 'kafka-swiftly-123', addon_service: {name: 'heroku-kafka'}, app: {name: 'myapp'}, plan: {name: 'premium-0'}}

    let api = nock('https://api.heroku.com:443')
      .get('/addons/heroku-kafka').reply(200, addon)
      .patch('/apps/myapp/addons/kafka-swiftly-123', {plan: {name: 'heroku-kafka:hobby'}})
      .reply(200, {plan: {price: {cents: 0}}, provision_message: 'provision msg'})
    return cmd.run({app: 'myapp', args: {addon: 'heroku-kafka', plan: 'heroku-kafka:hobby'}})
      .then(() => expect(cli.stdout, 'to equal', 'provision msg\n'))
      .then(() => expect(cli.stderr, 'to equal', 'Changing kafka-swiftly-123 on myapp from premium-0 to heroku-kafka:hobby... done, free\n'))
      .then(() => api.done())
  })

  it('upgrades an add-on with only one argument', () => {
    let addon = {name: 'postgresql-swiftly-123', addon_service: {name: 'heroku-postgresql'}, app: {name: 'myapp'}, plan: {name: 'premium-0'}}

    let api = nock('https://api.heroku.com:443')
      .get('/addons/heroku-postgresql').reply(200, addon)
      .patch('/apps/myapp/addons/postgresql-swiftly-123', {plan: {name: 'heroku-postgresql:hobby'}})
      .reply(200, {plan: {price: {cents: 0}}})
    return cmd.run({app: 'myapp', args: {addon: 'heroku-postgresql:hobby'}})
      .then(() => expect(cli.stdout, 'to be empty'))
      .then(() => expect(cli.stderr, 'to equal', 'Changing postgresql-swiftly-123 on myapp from premium-0 to heroku-postgresql:hobby... done, free\n'))
      .then(() => api.done())
  })

  it('errors with no plan', () => {
    return expect(cmd.run({app: 'myapp', args: {addon: 'heroku-redis'}})
      , 'to be rejected with', /Error: No plan specified/)
  })

  it('errors with invalid plan', () => {
    let addon = {name: 'db1-swiftly-123', addon_service: {name: 'heroku-db1'}, app: {name: 'myapp'}, plan: {name: 'premium-0'}}

    let api = nock('https://api.heroku.com:443')
      .get('/addons/heroku-db1').reply(200, addon)
      .get('/addon-services/heroku-db1/plans').reply(200, [
        {name: 'heroku-db1:free'},
        {name: 'heroku-db1:premium-0'}
      ])
      .patch('/apps/myapp/addons/db1-swiftly-123', {plan: {name: 'heroku-db1:invalid'}})
      .reply(422, {message: 'Couldn\'t find either the add-on service or the add-on plan of "heroku-db1:invalid".'})
    return expect(cmd.run({app: 'myapp', args: {addon: 'heroku-db1:invalid'}})
      , 'to be rejected with', `Couldn't find either the add-on service or the add-on plan of "heroku-db1:invalid".

Here are the available plans for heroku-db1:
heroku-db1:free
heroku-db1:premium-0

See more plan information with heroku addons:plans heroku-db1

https://devcenter.heroku.com/articles/managing-add-ons`)
      .then(() => api.done())
  })

  it('handles multiple add-ons', () => {
    let api = nock('https://api.heroku.com:443')
      .get('/addons/heroku-redis').reply(422, {id: 'multiple_matches', message: 'Ambiguous identifier; multiple matching add-ons found: redis-defined-2951, redis-rigid-2920.'})
    return expect(cmd.run({args: {addon: 'heroku-redis:invalid'}}),
      'to be rejected with', /multiple matching add-ons found/)
      .then(() => api.done())
  })
})
