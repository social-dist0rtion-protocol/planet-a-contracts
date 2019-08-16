/**
 * Copyright (c) 2019-present, Social Dist0rtion Protocol
 *
 * This source code is licensed under the Mozilla Public License, version 2,
 * found in the LICENSE file in the root directory of this source tree.
 */
const chai = require('chai');
const ethUtil = require('ethereumjs-util');
const Earth = artifacts.require('./Earth.sol');
const SimpleToken = artifacts.require('./mocks/SimpleToken');
const ERC1948 = artifacts.require('./mocks/ERC1948');
const EVMRevert = 'revert';
const should = chai
  .use(require('chai-as-promised'))
  .should();

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace.replace('0x', ''));
}


contract('Earth Contract', (accounts) => {
  const citizenA = accounts[1];
  const citizenB = accounts[2];
  const air = accounts[3];
  const citizenAPriv = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501201';
  const dataBefore = '0000000000000000000000000000000000000000000000000000000000000001';
  const passportA = 123;
  const passportB = 234;
  const totalCo2 = '10000000000000000000000';
  const totalGoe = '1000000000000000000000';
  let goellars;
  let co2;
  let countryA;
  let countryB;
  let originalByteCode;

  beforeEach(async () => {
    goellars = await SimpleToken.new(totalGoe);
    co2 = await SimpleToken.new(totalCo2);
    countryA = await ERC1948.new();
    countryB = await ERC1948.new();

    // print passports for citizens
    await countryA.mint(citizenA, passportA);
    await countryA.writeData(passportA, `0x${dataBefore}`, {from: citizenA});
    await countryB.mint(citizenB, passportB);
    await countryB.writeData(passportB, `0x${dataBefore}`, {from: citizenB});

    originalByteCode = Earth._json.bytecode;
  });

  afterEach(() => {
    Earth._json.bytecode = originalByteCode;
  });

  it('should allow to shake, both collaborate', async () => {

    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    // fund earth
    await goellars.transfer(earth.address, '500000000000000000000');
    await co2.transfer(earth.address, totalCo2);

    // citizen A sharing signed receipt through QR code
    const dataAfterColaborate = '00000000000000000000000000000000000000000000000000000000000000c9'; // 0.2 GigaTons
    const hash = ethUtil.hashPersonalMessage(Buffer.from(dataBefore + dataAfterColaborate, 'hex'));
    const sig = ethUtil.ecsign(
      hash,
      Buffer.from(citizenAPriv.replace('0x', ''), 'hex'),
    );
    // citizen B signing transaction
    await countryB.approve(earth.address, passportB, {from: citizenB});

    // sending transaction
    const tx = await earth.trade(
      passportA,           // uint256 passportA,
      `0x${dataAfterColaborate}`,      // bytes32 passDataAfter, 
      `0x${sig.r.toString('hex')}${sig.s.toString('hex')}${sig.v.toString(16)}`, // sig
      passportB,           // uint256 passportB,
      countryA.address,    // NFT contract 
      countryB.address,    // NFT contract 
    ).should.be.fulfilled;

    // check result when citizen A collaborates and citizen B collaborates
    const emission = await co2.balanceOf(air);
    assert.equal(emission.toString(10), '400000000000000000'); // low CO2 + low CO2 = 0.4 GigaTons
    const balanceA = await goellars.balanceOf(citizenA);
    assert.equal(balanceA.toString(10), '6000000000000000'); // medium $ = 6 cents
    const balanceB = await goellars.balanceOf(citizenB);
    assert.equal(balanceB.toString(10), '6000000000000000'); // medum $ = 6 cents
    const passA = await countryA.readData(passportA);
    assert.equal(passA, `0x${dataAfterColaborate}`);
  });

  it('should prevent trade with oneself', async () => {

    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    // fund earth
    await goellars.transfer(earth.address, '500000000000000000000');
    await co2.transfer(earth.address, totalCo2);

    await countryB.transferFrom(citizenB, citizenA, passportB, {from: citizenB});

    // citizen A sharing signed receipt through QR code
    const dataAfterColaborate = '00000000000000000000000000000000000000000000000000000000000000c9'; // 0.2 GigaTons
    const hash = ethUtil.hashPersonalMessage(Buffer.from(dataBefore + dataAfterColaborate, 'hex'));
    const sig = ethUtil.ecsign(
      hash,
      Buffer.from(citizenAPriv.replace('0x', ''), 'hex'),
    );
    // citizen A signing transaction
    await countryB.approve(earth.address, passportB, {from: citizenA});

    // sending transaction
    const tx = await earth.trade(
      passportA,           // uint256 passportA,
      `0x${dataAfterColaborate}`,      // bytes32 passDataAfter, 
      `0x${sig.r.toString('hex')}${sig.s.toString('hex')}${sig.v.toString(16)}`, // sig
      passportB,           // uint256 passportB,
      countryA.address,    // NFT contract 
      countryB.address,    // NFT contract 
    ).should.be.rejectedWith(EVMRevert);
  });


  it('should allow to shake, citizen B defect', async () => {

    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    // fund earth
    await goellars.transfer(earth.address, '500000000000000000000');
    await co2.transfer(earth.address, totalCo2);

    // citizen A sharing signed receipt through QR code
    const dataAfterColaborate = '00000000000000000000000000000000000000000000000000000000000000c9'; // 0.2 GigaTons
    const hash = ethUtil.hashPersonalMessage(Buffer.from(dataBefore + dataAfterColaborate, 'hex'));
    const sig = ethUtil.ecsign(
      hash,
      Buffer.from(citizenAPriv.replace('0x', ''), 'hex'),
    );
    // citizen B signing transaction
    await countryB.approve(earth.address, passportB, {from: citizenB});

    // citizen B collaborates
    await goellars.approve(earth.address, 1, {from: citizenB});

    // sending transaction
    const tx = await earth.trade(
      passportA,           // uint256 passportA,
      `0x${dataAfterColaborate}`,      // bytes32 passDataAfter, 
      `0x${sig.r.toString('hex')}${sig.s.toString('hex')}${sig.v.toString(16)}`, // sig
      passportB,           // uint256 passportB,
      countryA.address,    // NFT contract 
      countryB.address,    // NFT contract 
    ).should.be.fulfilled;

    // check result when citizen A collaborates and citizen B defects
    const emission = await co2.balanceOf(air);
    assert.equal(emission.toString(10), '20200000000000000000'); // low CO2 + high CO2 = 20.2 GigaTons
    const balanceA = await goellars.balanceOf(citizenA);
    assert.equal(balanceA.toString(10), '2000000000000000'); // low $ = 2 cents
    const balanceB = await goellars.balanceOf(citizenB);
    assert.equal(balanceB.toString(10), '20000000000000000'); // high $ = 20 cents
    const passA = await countryA.readData(passportA);
    assert.equal(passA, `0x${dataAfterColaborate}`);
  });

  it('should allow to shake, citizen A defect', async () => {

    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    // fund earth
    await goellars.transfer(earth.address, '500000000000000000000');
    await co2.transfer(earth.address, totalCo2);

    // citizen A sharing signed receipt through QR code
    const dataAfterDefect = '0000000000000000000000000000000000000000000000000000000100004e21';
    const hash = ethUtil.hashPersonalMessage(Buffer.from(dataBefore + dataAfterDefect, 'hex'));
    const sig = ethUtil.ecsign(
      hash,
      Buffer.from(citizenAPriv.replace('0x', ''), 'hex'),
    );
    // citizen B signing transaction
    await countryB.approve(earth.address, passportB, {from: citizenB});

    // sending transaction
    const tx = await earth.trade(
      passportA,           // uint256 passportA,
      `0x${dataAfterDefect}`,      // bytes32 passDataAfter, 
      `0x${sig.r.toString('hex')}${sig.s.toString('hex')}${sig.v.toString(16)}`, // sig
      passportB,           // uint256 passportB,
      countryA.address,    // NFT contract 
      countryB.address,    // NFT contract 
    ).should.be.fulfilled;

    // check result when citizen A defects and citizen B collaborates ?!?!?!
    const emission = await co2.balanceOf(air);
    assert.equal(emission.toString(10), '40000000000000000000'); // high CO2 + high CO2 = 40 Gigatons
    const balanceA = await goellars.balanceOf(citizenA);
    assert.equal(balanceA.toString(10), '20000000000000000'); // high $ = 20 cents
    const balanceB = await goellars.balanceOf(citizenB);
    assert.equal(balanceB.toString(10), '2000000000000000'); // low $ = 2 cents
    const passA = await countryA.readData(passportA);
    assert.equal(passA, `0x${dataAfterDefect}`);
  });

  it('should allow to shake, both defect', async () => {

    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    // only needed for testnet deployment
    // let code = Earth._json.deployedBytecode;
    // code = replaceAll(code, '1231111111111111111111111111111111111123', 'F64fFBC4A69631D327590f4151B79816a193a8c6'.toLowerCase());
    // code = replaceAll(code, '2341111111111111111111111111111111111234', '1f89Fb2199220a350287B162B9D0A330A2D2eFAD'.toLowerCase());
    // code = replaceAll(code, '4561111111111111111111111111111111111456', '8db6B632D743aef641146DC943acb64957155388');
    // console.log('code: ', code);
    // const script = Buffer.from(code.replace('0x', ''), 'hex');
    // const scriptHash = ethUtil.ripemd160(script);
    // console.log(`earth contract address: 0x${scriptHash.toString('hex')}`);

    // fund earth
    await goellars.transfer(earth.address, totalGoe);
    await co2.transfer(earth.address, totalCo2);

    // citizen A sharing signed receipt through QR code
    const dataAfterDefect = '0000000000000000000000000000000000000000000000000000000100004e21';
    const hash = ethUtil.hashPersonalMessage(Buffer.from(dataBefore + dataAfterDefect, 'hex'));
    const sig = ethUtil.ecsign(
      hash,
      Buffer.from(citizenAPriv.replace('0x', ''), 'hex'),
    );
    // citizen B signing transaction
    await countryB.approve(earth.address, passportB, {from: citizenB});

    // citizen B collaborates
    await goellars.approve(earth.address, 1, {from: citizenB});

    // sending transaction
    const tx = await earth.trade(
      passportA,           // uint256 passportA,
      `0x${dataAfterDefect}`,      // bytes32 passDataAfter, 
      `0x${sig.r.toString('hex')}${sig.s.toString('hex')}${sig.v.toString(16)}`, // sig
      passportB,           // uint256 passportB,
      countryA.address,    // NFT contract 
      countryB.address,    // NFT contract 
    ).should.be.fulfilled;

    // check result when citizen A defects and citizen B defects
    const emission = await co2.balanceOf(air);
    assert.equal(emission.toString(10), '40000000000000000000'); // high CO2 + high CO2 = 40 GigaTonnes
    const balanceA = await goellars.balanceOf(citizenA);
    assert.equal(balanceA.toString(10), '2000000000000000'); // low $ = 2 cents
    const balanceB = await goellars.balanceOf(citizenB);
    assert.equal(balanceB.toString(10), '2000000000000000'); // low $ = 2 cents
    const passA = await countryA.readData(passportA);
    assert.equal(passA, `0x${dataAfterDefect}`);
  });

  it('should allow to unlock', async () => {
    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    tmp = replaceAll(tmp, '5671111111111111111111111111111111111567', citizenA);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    await co2.transfer(earth.address, totalCo2);

    const buf = Buffer.alloc(32, 0);
    Buffer.from(earth.address.replace('0x', ''), 'hex').copy(buf, 12);
    buf.writeUInt32BE(123, 8);
    const sig = ethUtil.ecsign(buf, Buffer.from(citizenAPriv.replace('0x', '') , 'hex'));

    // sending transaction
    const tx = await earth.unlockCO2(123, sig.v, sig.r, sig.s).should.be.fulfilled;    
  });


  it('should allow to consolidate', async () => {
    // deploy earth
    let tmp = Earth._json.bytecode;
    // replace token address placeholder to real token address
    tmp = replaceAll(tmp, '1231111111111111111111111111111111111123', co2.address);
    tmp = replaceAll(tmp, '2341111111111111111111111111111111111234', goellars.address);
    tmp = replaceAll(tmp, '4561111111111111111111111111111111111456', air);
    tmp = replaceAll(tmp, '5671111111111111111111111111111111111567', citizenA);
    Earth._json.bytecode = tmp;
    const earth = await Earth.new();

    await co2.transfer(earth.address, totalCo2);

    const buf = Buffer.alloc(32, 0);
    Buffer.from(earth.address.replace('0x', ''), 'hex').copy(buf);
    //buf.writeUInt32BE(123, 8);
    const sig = ethUtil.ecsign(buf, Buffer.from(citizenAPriv.replace('0x', '') , 'hex'));

    // sending transaction
    const tx = await earth.consolidate(sig.v, sig.r, sig.s).should.be.fulfilled;    
  });

});
