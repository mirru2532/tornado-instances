// SPDX-License-Identifier: MIT

pragma solidity ^0.7.6;

interface ITornadoTrees {
  function registerDeposit(address instance, bytes32 commitment) external;

  function registerWithdrawal(address instance, bytes32 nullifier) external;
}
