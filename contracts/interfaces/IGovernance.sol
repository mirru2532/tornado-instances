// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

interface IGovernance {
  function propose(address target, string memory description) external returns (uint256);
}
