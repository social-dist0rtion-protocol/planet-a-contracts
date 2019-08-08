/**
 * Copyright (c) 2018-present, Leap DAO (leapdao.org)
 *
 * This source code is licensed under the Mozilla Public License, version 2,
 * found in the LICENSE file in the root directory of this source tree.
 */

const EVMRevert = 'revert';

const NativeToken = artifacts.require('SimpleToken');
const Goellars = artifacts.require('Goellars');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised).should();

contract('Goellars', (accounts) => {

  let dai;
  let goellars;
  let alice;
  let bob;
  let bridge;

  beforeEach(async () => {
    dai = await NativeToken.new('100000000000000000000');
    [, alice, bob, bridge] = accounts;
    goellars = await Goellars.new(dai.address, bridge, '0x00444149', '0x00444149');
  });

  it('goellars is mintable on deposit if DAI approval given', async () => {
    // have some DAI
    await dai.mint(alice, 200);
    assert.equal((await dai.balanceOf(alice)).toNumber(), 200);

    // calls executed by burner wallet on DAI => Goellars conversion
    await dai.approve(goellars.address, 200, {from: alice});
    await goellars.transferFrom(alice, bridge, 200, {from: bridge}).should.be.fulfilled;
    
    // check custody of DAI and supply on goellars after deposit
    assert.equal(await dai.balanceOf(goellars.address), 200);
    assert.equal(await dai.balanceOf(alice), 0);
    assert.equal(await goellars.balanceOf(bridge), 200);
    assert.equal(await goellars.balanceOf(alice), 0);
  });

  it('goellars deposit fails if DAI approval not given', async () => {
    // have some DAI
    await dai.mint(alice, 200);
    assert.equal(await dai.balanceOf(alice), 200);

    // calls executed by burner wallet on DAI => Goellars conversion
    // not given: await dai.approve(goellars.address, 200);
    await goellars.transferFrom(alice, bridge, 200, {from: bridge}).should.be.rejectedWith(EVMRevert);
  });

  it('goellars is mintable and burnable', async () => {
    // have some DAI
    await dai.mint(bob, 200);
    assert.equal(await dai.balanceOf(bob), 200);

    // calls executed by burner wallet on DAI => Goellars conversion
    await dai.approve(goellars.address, 200, {from: bob});
    await goellars.transferFrom(bob, bridge, 200, {from: bridge}).should.be.fulfilled;

    // mock exit by transfer, then burn
    await goellars.transfer(bob, 200, {from: bridge});
    assert.equal(await goellars.balanceOf(bob), 200);
    await goellars.burnSender({from: bob});

    // check custody of DAI and supply on goellars after deposit
    assert.equal(await dai.balanceOf(goellars.address), 0);
    assert.equal(await dai.balanceOf(bob), 200);
    assert.equal(await goellars.balanceOf(bob), 0);
  });

  it('goellars is depositable without minting if balance sufficient', async () => {
    // mock exit by mint, then burn
    await goellars.mint(alice, 200);
    await goellars.transferFrom(alice, bridge, 200, {from: bridge}).should.be.fulfilled;

    // check custody of DAI and supply on goellars after deposit
    assert.equal(await dai.balanceOf(goellars.address), 0);
    assert.equal(await dai.balanceOf(alice), 0);
    assert.equal(await goellars.balanceOf(bridge), 200);
    assert.equal(await goellars.balanceOf(alice), 0);
  });

  it('goellars is half depositable half mintable', async () => {
    // mock exit by mint, then burn
    await goellars.mint(alice, 200);
    await dai.mint(alice, 200);
    await dai.approve(goellars.address, 200, {from: alice});
    await goellars.transferFrom(alice, bridge, 400, {from: bridge}).should.be.fulfilled;

    // check custody of DAI and supply on goellars after deposit
    assert.equal(await dai.balanceOf(goellars.address), 200);
    assert.equal(await dai.balanceOf(alice), 0);
    assert.equal(await goellars.balanceOf(bridge), 400);
    assert.equal(await goellars.balanceOf(alice), 0);
  });

  it('goellars transferFrom should work if approved', async () => {
    // mock exit by mint, then burn
    await goellars.mint(alice, 200);

    await goellars.transferFrom(alice, bob, 200, {from: bob}).should.be.rejectedWith(EVMRevert);
    assert.equal(await goellars.balanceOf(alice), 200);
    assert.equal(await goellars.balanceOf(bob), 0);

    await goellars.approve(bob, 200, {from: alice});
    await goellars.transferFrom(alice, bob, 200, {from: bob}).should.be.fulfilled;
    assert.equal(await goellars.balanceOf(alice), 0);
    assert.equal(await goellars.balanceOf(bob), 200);
  });

  it('goellars transferFrom should work for bridge if approved', async () => {
    // mock exit by mint, then burn
    await goellars.mint(alice, 200);

    await goellars.transferFrom(alice, bob, 200, {from: bridge}).should.be.rejectedWith(EVMRevert);

    await goellars.approve(bridge, 200, {from: alice});
    await goellars.transferFrom(alice, bob, 200, {from: bridge}).should.be.fulfilled;
    assert.equal(await goellars.balanceOf(alice), 0);
    assert.equal(await goellars.balanceOf(bob), 200);
  });

  it('goellars collateral is burnable by minter', async () => {
    // have some DAI
    await dai.mint(bob, 200);
    assert.equal(await dai.balanceOf(bob), 200);

    // calls executed by burner wallet on DAI => Goellars conversion
    await dai.approve(goellars.address, 200, {from: bob});
    await goellars.transferFrom(bob, bridge, 200, {from: bridge}).should.be.fulfilled;
    await goellars.addMinter(alice);

    // mock exit by transfer, then burn
    await goellars.mint(alice, 200);
    assert.equal(await goellars.balanceOf(alice), 200);
    await goellars.burnSender({from: alice});

    assert.equal(await dai.balanceOf(goellars.address), 0);
    assert.equal(await dai.balanceOf(alice), 200);
    assert.equal(await goellars.balanceOf(alice), 0);
    assert.equal(await goellars.balanceOf(bridge), 200);
  });

});