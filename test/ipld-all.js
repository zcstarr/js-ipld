/* eslint-env mocha */
'use strict'

/*
 * Test different types of data structures living together
 * &
 * Test data made of mixed data structures!
 */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)
const dagPB = require('ipld-dag-pb')
const dagCBOR = require('ipld-dag-cbor')
const each = require('async/each')
const waterfall = require('async/waterfall')
const pull = require('pull-stream')

const IPLDResolver = require('../src')

describe('IPLD Resolver for dag-cbor + dag-pb', () => {
  let resolver

  let nodeCbor
  let nodePb
  let cidCbor
  let cidPb

  before((done) => {
    waterfall([
      (cb) => IPLDResolver.inMemory(cb),
      (res, cb) => {
        resolver = res
        dagPB.DAGNode.create(Buffer.from('I am inside a Protobuf'), cb)
      },
      (node, cb) => {
        nodePb = node
        dagPB.util.cid(nodePb, cb)
      },
      (cid, cb) => {
        cidPb = cid
        nodeCbor = {
          someData: 'I am inside a Cbor object',
          pb: { '/': cidPb.toBaseEncodedString() }
        }

        dagCBOR.util.cid(nodeCbor, cb)
      },
      (cid, cb) => {
        cidCbor = cid

        each([
          { node: nodePb, cid: cidPb },
          { node: nodeCbor, cid: cidCbor }
        ], (nac, cb) => {
          resolver.put(nac.node, { cid: nac.cid }, cb)
        }, cb)
      }
    ], done)
  })

  it('resolve through different formats', (done) => {
    resolver.get(cidCbor, 'pb/Data', (err, results) => {
      expect(err).to.not.exist()
      expect(results.length).to.eq(2)
      expect(results[0].value['/']).to.eql(cidPb.multihash)
      expect(results[1].value).to.eql(Buffer.from('I am inside a Protobuf'))
      done()
    })
  })

  it('resolver.getPullStream through different formats', (done) => {
    pull(resolver.getPullStream(cidCbor, 'pb/Data'),
      pull.collect((err, results) => {
        expect(err).to.not.exist()
        expect(results.length).to.eq(2)
        expect(results[0].value['/']).to.eql(cidPb.multihash)
        expect(results[1].value).to.eql(Buffer.from('I am inside a Protobuf'))
        done()
      }))
  })

  it('resolve honors onlyNode option', (done) => {
    resolver.get(cidCbor, 'pb/Data', { onlyNode: true }, (err, results) => {
      expect(err).to.not.exist()
      expect(results.length).to.eq(1)
      expect(results[0].value).to.eql(Buffer.from('I am inside a Protobuf'))
      done()
    })
  })
})
