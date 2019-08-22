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


  function safer_ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal returns (bool, address) {
    // We do our own memory management here. Solidity uses memory offset
    // 0x40 to store the current end of memory. We write past it (as
    // writes are memory extensions), but don't update the offset so
    // Solidity will reuse it. The memory used here is only needed for
    // this context.

    // FIXME: inline assembly can't access return values
    bool ret;
    address addr;

    assembly {
      let size := mload(0x40)
      mstore(size, hash)
      mstore(add(size, 32), v)
      mstore(add(size, 64), r)
      mstore(add(size, 96), s)

      // NOTE: we can reuse the request memory because we deal with
      //       the return code
      ret := call(3000, 1, 0, size, 128, size, 32)
      addr := mload(size)
    }

    return (ret, addr);
  }

  // used to combine multiple contract UTXOs into one.
  function consolidate(address token, uint8 v, bytes32 r, bytes32 s) public {
    bool success;
    address signer;
    (success, signer) = safer_ecrecover(bytes32(uint256(uint160(address(this)))), v, r, s);
    require(success == true, "recover failed");
    require(signer == GAME_MASTER, "signer does not match");
    IERC20 erc20 = IERC20(token);
    erc20.transfer(address(this), erc20.balanceOf(address(this)));
  }
}