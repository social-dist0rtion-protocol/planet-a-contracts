/**
 * Copyright (c) 2019-present, Social Dist0rtion Protocol
 *
 * This source code is licensed under the Mozilla Public License, version 2,
 * found in the LICENSE file in the root directory of this source tree.
 */
pragma solidity ^0.5.2;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./IERC1948.sol";

contract Earth {
  address constant CO2_ADDR = 0x1231111111111111111111111111111111111123;
  address constant DAI_ADDR = 0x2341111111111111111111111111111111111234;
  address constant AIR_ADDR = 0x4561111111111111111111111111111111111456;

  uint256 constant MAX_CO2_EMISSION = 25000000000000000000; // 25 gigatonnes
  uint256 constant PASSPORT_FACTOR = 10**15;  // needed to save bytes in passport
  
  uint256 constant CO2_TO_GOELLARS_FACTOR = 1000;
  uint256 constant LOW_TO_HIGH_FACTOR = 4;

  struct Citizen {
    address addr;
    bool isDefect;
    bytes32 dataBefore;
    uint256 co2;
  }

  function trade(
    uint256 passportA,
    bytes32 passDataAfter, 
    bytes memory sigA,
    uint256 passportB,
    address countryAaddr,
    address countryBaddr
  ) public {
    IERC1948 countryA = IERC1948(countryAaddr);
    IERC1948 countryB = IERC1948(countryBaddr);
    Citizen memory citizenA = Citizen({
      addr: countryA.ownerOf(passportA),
      isDefect: false,
      dataBefore: countryA.readData(passportA),
      co2: 0
    });
    Citizen memory citizenB = Citizen({
      addr: countryB.ownerOf(passportB),
      isDefect: false,
      dataBefore: countryB.readData(passportB),
      co2: 0
    });

    IERC20 dai = IERC20(DAI_ADDR);
    IERC20 co2 = IERC20(CO2_ADDR);

    // calculate payout for A
    uint256 lowCO2 = uint256(uint32(uint256(passDataAfter)) - uint32(uint256(citizenA.dataBefore)));
    citizenA.co2 = lowCO2 * PASSPORT_FACTOR;
    // sender can up to a bound decide the size of the emission
    require(citizenA.co2 <= MAX_CO2_EMISSION, "invalid emission");
    if (uint256(passDataAfter) - uint256(citizenA.dataBefore) == lowCO2) {
      // if CO2locked unchanged, then consider defect by player 1
      lowCO2 = lowCO2 / LOW_TO_HIGH_FACTOR;
      citizenA.isDefect = true;
    }
    
    // update passports
    countryA.writeDataByReceipt(passportA, passDataAfter, sigA);
    citizenB.isDefect = (dai.allowance(citizenB.addr, address(this)) == 0);
    citizenB.co2 = (citizenB.isDefect) ? lowCO2 * LOW_TO_HIGH_FACTOR : lowCO2;
    countryB.writeData(passportB, bytes32(uint256(citizenB.dataBefore) + citizenB.co2));
    citizenB.co2 *= PASSPORT_FACTOR;

    // pay out trade
    lowCO2 = lowCO2 * PASSPORT_FACTOR / CO2_TO_GOELLARS_FACTOR;
    uint256 amount = (citizenA.isDefect) ? ((citizenB.isDefect) ? lowCO2 : lowCO2 * LOW_TO_HIGH_FACTOR) : ((citizenB.isDefect) ? lowCO2 * LOW_TO_HIGH_FACTOR : lowCO2);
    dai.transfer(citizenA.addr, amount);
    dai.transfer(citizenB.addr, amount);

    // emit CO2
    co2.transfer(AIR_ADDR, citizenA.co2 + citizenB.co2);
  }

  // account used as game master.
  address constant GAME_MASTER = 0x5671111111111111111111111111111111111567;

  // used to model natural increase of CO2 if above run-away point.
  function unlockCO2(uint256 amount, uint8 v, bytes32 r, bytes32 s) public {
    require(ecrecover(bytes32(uint256(uint160(address(this))) | amount << 160), v, r, s) == GAME_MASTER, "signer does not match");
    // unlock CO2
    IERC20(CO2_ADDR).transfer(AIR_ADDR, amount);
  }

  // used to combine multiple contract UTXOs into one.
  function consolidate(uint8 v, bytes32 r, bytes32 s) public {
    require(ecrecover(bytes32(bytes20(address(this))), v, r, s) == GAME_MASTER, "signer does not match");
    // lock CO2
    IERC20 co2 = IERC20(CO2_ADDR);
    co2.transfer(address(this), co2.balanceOf(address(this)));
  }
}