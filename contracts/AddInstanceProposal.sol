// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import "./interfaces/IInstanceRegistry.sol";
import "./interfaces/IInstanceFactory.sol";

contract AddInstanceProposal {
  IInstanceFactory public immutable instanceFactory;
  IInstanceRegistry public immutable instanceRegistry;
  address public immutable token;
  uint24 public immutable uniswapPoolSwappingFee;

  uint256 public immutable numInstances;
  uint256 internal immutable denomination0;
  uint256 internal immutable denomination1;
  uint256 internal immutable denomination2;
  uint256 internal immutable denomination3;
  uint32 internal immutable protocolFee0;
  uint32 internal immutable protocolFee1;
  uint32 internal immutable protocolFee2;
  uint32 internal immutable protocolFee3;

  event AddInstanceForRegistry(address instance, address token, uint256 denomination);

  constructor(
    address _instanceFactory,
    address _instanceRegistry,
    address _token,
    uint24 _uniswapPoolSwappingFee,
    uint256[] memory _denominations,
    uint32[] memory _protocolFees
  ) {
    instanceFactory = IInstanceFactory(_instanceFactory);
    instanceRegistry = IInstanceRegistry(_instanceRegistry);
    token = _token;
    uniswapPoolSwappingFee = _uniswapPoolSwappingFee;

    require(_denominations.length == _protocolFees.length, "Incorrect denominations/fees length");
    uint256 _numInstances = _denominations.length;
    require(_numInstances > 0 && _numInstances <= 4, "incorrect instances number");
    numInstances = _numInstances;

    denomination0 = _numInstances > 0 ? _denominations[0] : 0;
    denomination1 = _numInstances > 1 ? _denominations[1] : 0;
    denomination2 = _numInstances > 2 ? _denominations[2] : 0;
    denomination3 = _numInstances > 3 ? _denominations[3] : 0;
    protocolFee0 = _numInstances > 0 ? _protocolFees[0] : 0;
    protocolFee1 = _numInstances > 1 ? _protocolFees[1] : 0;
    protocolFee2 = _numInstances > 2 ? _protocolFees[2] : 0;
    protocolFee3 = _numInstances > 3 ? _protocolFees[3] : 0;
  }

  function executeProposal() external {
    for (uint256 i = 0; i < numInstances; i++) {
      address instance = instanceFactory.createInstanceClone(denominationByIndex(i), token);

      IInstanceRegistry.Instance memory newInstanceData = IInstanceRegistry.Instance(
        token != address(0),
        IERC20(token),
        IInstanceRegistry.InstanceState.ENABLED,
        uniswapPoolSwappingFee,
        protocolFeeByIndex(i)
      );

      IInstanceRegistry.Tornado memory tornadoForUpdate = IInstanceRegistry.Tornado(instance, newInstanceData);

      instanceRegistry.updateInstance(tornadoForUpdate);

      emit AddInstanceForRegistry(address(instance), token, denominationByIndex(i));
    }
  }

  function denominationByIndex(uint256 _index) public view returns (uint256) {
    if (_index == 0) {
      return denomination0;
    } else if (_index == 1) {
      return denomination1;
    } else if (_index == 2) {
      return denomination2;
    } else if (_index == 3) {
      return denomination3;
    } else {
      revert("Invalid instance index");
    }
  }

  function protocolFeeByIndex(uint256 _index) public view returns (uint32) {
    if (_index == 0) {
      return protocolFee0;
    } else if (_index == 1) {
      return protocolFee1;
    } else if (_index == 2) {
      return protocolFee2;
    } else if (_index == 3) {
      return protocolFee3;
    } else {
      revert("Invalid instance index");
    }
  }
}
