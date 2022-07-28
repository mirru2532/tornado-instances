// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "./InstanceFactory.sol";

contract SidechainInstanceFactory is InstanceFactory {
  /**
   * @dev Creates new Tornado instance. Overriding to move onlyAdmin check for sidechains.
   * @param _denomination denomination of new Tornado instance
   * @param _token address of ERC20 token for a new instance, if zero address, then it will be ETH
   */
  function createInstanceClone(uint256 _denomination, address _token) public override returns (address clone) {
    return _createInstanceClone(_denomination, _token);
  }

  /**
   * @dev Creates new Tornado instances.
   * @param _token address of ERC20 token for a new instance
   * @param _denominations list of denominations for each new instance
   */
  function createInstanceClones(address _token, uint256[] memory _denominations) external returns (address[] memory) {
    address[] memory newClones = new address[](_denominations.length);
    for (uint256 i = 0; i < _denominations.length; i++) {
      newClones[i] = _createInstanceClone(_denominations[i], _token);
    }
    return newClones;
  }
}
