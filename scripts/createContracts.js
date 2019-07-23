const { bufferToHex, ripemd160 } = require('ethereumjs-util');
const Earth = require('../build/contracts/Earth');
const Air = require('../build/contracts/Air');

const testnetCO2 = '0xF64fFBC4A69631D327590f4151B79816a193a8c6';
const testnetGOL = '0x1f89Fb2199220a350287B162B9D0A330A2D2eFAD';
const gameMaster = '0xaf0939af286A35DBfab7DEd7c777A5F6E8BE26A8';

const replaceAll = (str, find, replace) =>
  str.replace(new RegExp(find, 'g'), replace.replace('0x', '').toLowerCase());

// deploy air
let airCode = Air.deployedBytecode;
// replace token address placeholder to real token address
airCode = replaceAll(airCode, '1231111111111111111111111111111111111123', testnetCO2);
airCode = replaceAll(airCode, '2341111111111111111111111111111111111234', testnetGOL);
airCode = replaceAll(airCode, '5671111111111111111111111111111111111567', gameMaster);
console.log('\nAir code: ', airCode);
const airContractAddr = bufferToHex(ripemd160(airCode));
console.log(`\nAir contract address: ${airContractAddr}`);
// only needed for testnet deployment
let code = Earth.deployedBytecode;
code = replaceAll(code, '1231111111111111111111111111111111111123', testnetCO2);
code = replaceAll(code, '2341111111111111111111111111111111111234', testnetGOL);
code = replaceAll(code, '4561111111111111111111111111111111111456', airContractAddr);
code = replaceAll(code, '5671111111111111111111111111111111111567', gameMaster);
console.log('\nEarth code: ', code);
const earthContractAddr = bufferToHex(ripemd160(code));
console.log(`\nEarth contract address: ${earthContractAddr}`);