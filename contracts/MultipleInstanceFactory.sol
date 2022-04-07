// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "./InstanceFactory.sol";

contract MultipleInstanceFactory is InstanceFactory {
  constructor(
    address _verifier,
    address _hasher,
    uint32 _merkleTreeHeight,
    address _owner
  ) InstanceFactory(_verifier, _hasher, _merkleTreeHeight, _owner) {}

  /**
   * @dev Creates new Tornado instances.
   * @param _token address of ERC20 token for a new instance
   * @param _denominations list of denominations for each new instance
   */
  function createInstanceClones(address _token, uint256[] memory _denominations) external returns (address[] memory) {
    address[] memory newClones = new address[](_denominations.length);
    for (uint256 i = 0; i < _denominations.length; i++) {
      newClones[i] = createInstanceClone(_denominations[i], _token);
    }
    return newClones;
  }
}
