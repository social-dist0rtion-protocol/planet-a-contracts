/**
 * Copyright (c) 2019-present, Social Dist0rtion Protocol
 *
 * This source code is licensed under the Mozilla Public License, version 2,
 * found in the LICENSE file in the root directory of this source tree.
 */
const chai = require('chai');
const ethUtil = require('ethereumjs-util');
const Air = artifacts.require('./Air.sol');
const SimpleToken = artifacts.require('./mocks/SimpleToken');
const ERC1948 = artifacts.require('./mocks/ERC1948');
const PassportLib = require('./passportLib.js');

const should = chai
  .use(require('chai-as-promised'))
  .should();

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace.replace('0x', ''));
}


contract('Air Contract', (accounts) => {
  const citizenA = accounts[1];
  const earth = accounts[2];
  const citizenAPriv = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201';
  const passportA = 123;
  const totalCo2 = '10000000000000000000000';
  const totalGoe = '1000000000000000000000';
  let goellars;
  let co2;
  let country;
  let originalByteCode;

  beforeEach(async () => {
    goellars = await SimpleToken.new(totalGoe);
    await goellars.transfer(citizenA, '1000000000000000000');
    co2 = await SimpleToken.new(totalCo2);
    country = await ERC1948.new();
    originalByteCode = Air._json.bytecode;
  });

  afterEach(() => {
    Air._json.bytecode = originalByteCode;
  });

  it('should allow to plant', async () => {

    // deploy earth
    let tmp = Air._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    Air._json.bytecode = tmp;
    const air = await Air.new();

    // pollute air
    await co2.transfer(air.address, totalCo2);

    // print passports for citizenA
    await country.mint(citizenA, passportA);
    // citizonA fills in some data
    const before = '0x6a6f686261000000000000000000000000000000000000cc000000010000aabb';
    country.writeData(passportA, before, {from: citizenA});

    // citizen A signing transaction
    await country.approve(air.address, passportA, {from: citizenA});
    await goellars.approve(air.address, '1000000000000000000', {from: citizenA});

    // sending transaction
    const tx = await air.plantTree('1000000000000000000', country.address, passportA, earth).should.be.fulfilled;

    // check result
    const locked = await co2.balanceOf(earth);
    assert.equal(locked.toString(10), '2000000000000000000');
    const balanceAir = await goellars.balanceOf(air.address);
    assert.equal(balanceAir.toString(10), '1000000000000000000');
    const passA = await country.readData(passportA);
    const pl = new PassportLib(before);
    assert.equal(passA, pl.updateLockedCo2(2000));
  });


  it('should allow to lock', async () => {
    // deploy earth
    let tmp = Air._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '5671111111111111111111111111111111111567', citizenA);
    Air._json.bytecode = tmp;
    const air = await Air.new();

    await co2.transfer(air.address, totalCo2);

    const buf = Buffer.alloc(32, 0);
    Buffer.from(air.address.replace('0x', ''), 'hex').copy(buf, 12);
    buf.writeUInt32BE(123, 8);
    const sig = ethUtil.ecsign(buf, Buffer.from(citizenAPriv.replace('0x', '') , 'hex'));

    // sending transaction
    const tx = await air.lockCO2(123, sig.v, sig.r, sig.s, citizenA).should.be.fulfilled;    
  });


  it('should allow to consolidate', async () => {
    // deploy earth
    let tmp = Air._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '5671111111111111111111111111111111111567', citizenA);
    Air._json.bytecode = tmp;
    const air = await Air.new();

    await co2.transfer(air.address, totalCo2);

    const buf = Buffer.alloc(32, 0);
    Buffer.from(air.address.replace('0x', ''), 'hex').copy(buf);
    //buf.writeUInt32BE(123, 8);
    const sig = ethUtil.ecsign(buf, Buffer.from(citizenAPriv.replace('0x', '') , 'hex'));

    // sending transaction
    const tx = await air.consolidate(sig.v, sig.r, sig.s).should.be.fulfilled;    
  });

});
