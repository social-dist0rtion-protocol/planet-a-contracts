/**
 * Copyright (c) 2019-present, Social Dist0rtion Protocol
 *
 * This source code is licensed under the Mozilla Public License, version 2,
 * found in the LICENSE file in the root directory of this source tree.
 */
pragma solidity ^0.5.2;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./IERC1948.sol";

contract Air {

  bytes32 constant LOCK_MAP = 0xffffffffffffffffffffffffffffffffffffffffffffffff00000000ffffffff;
  address constant CO2_ADDR = 0x1231111111111111111111111111111111111123;
  address constant GOELLARS_ADDR = 0x2341111111111111111111111111111111111234;
  uint256 constant CO2_PER_GEOLLAR = 2;
  uint256 constant PASSPORT_FACTOR = 10**15;  // needed to save bytes in passport

  function getLocked(bytes32 data) internal pure returns (uint32) {
    return uint32(uint256(data) >> 32);
  }

  function addLocked(bytes32 prevData, uint32 more) internal pure returns (bytes32 rv) {
    uint32 locked = getLocked(prevData);
    uint32 sum = locked + more;
    require(sum > locked, "buffer overflow");
    rv = LOCK_MAP & prevData;
    rv = rv | bytes32(uint256(sum) << 32);
  }
  
  function plantTree(
    uint256 goellarAmount,
    address countryAddr,
    uint256 passport,
    address earthAddr) public {

    // signer information
    IERC1948 country = IERC1948(countryAddr);
    address signer = country.ownerOf(passport);

    // pull payment
    IERC20 dai = IERC20(GOELLARS_ADDR);
    dai.transferFrom(signer, address(this), goellarAmount);
    
    // update passports
    bytes32 data = country.readData(passport);
    // TODO: apply formula
    country.writeData(passport, addLocked(data, uint32(goellarAmount * CO2_PER_GEOLLAR / PASSPORT_FACTOR)));

    // lock CO2
    IERC20 co2 = IERC20(CO2_ADDR);
    co2.transfer(earthAddr, goellarAmount * CO2_PER_GEOLLAR);
  }

  // account used as game master.
  address constant GAME_MASTER = 0x5671111111111111111111111111111111111567;

  // used to model natural reduction of CO2 if below run-away point.
  function lockCO2(uint256 amount, uint8 v, bytes32 r, bytes32 s, address earthAddr) public {
    require(ecrecover(bytes32(uint256(uint160(address(this))) | amount << 160), v, r, s) == GAME_MASTER, "signer does not match");
    // unlock CO2
    IERC20(CO2_ADDR).transfer(earthAddr, amount);
  }

  // used to combine multiple contract UTXOs into one.
  function consolidate(uint8 v, bytes32 r, bytes32 s) public {
    require(ecrecover(bytes32(bytes20(address(this))), v, r, s) == GAME_MASTER, "signer does not match");
    uint256 bal;
    IERC20 co2 = IERC20(CO2_ADDR);
    IERC20 goellars = IERC20(GOELLARS_ADDR);
    bal = co2.balanceOf(address(this));
    if (bal > 0) {
      co2.transfer(address(this), bal);
    }
    bal = goellars.balanceOf(address(this));
    if (bal > 0) {
      goellars.transfer(address(this), bal);
    }
  }
}