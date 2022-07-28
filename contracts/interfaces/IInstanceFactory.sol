// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

interface IInstanceFactory {
  function createInstanceClone(uint256 denomination, address token) external returns (address);
}
