// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "../TornadoInstanceCloneFactory.sol";
import "../tornado_proxy/TornadoProxy.sol";

contract Add1Instance {
  TornadoInstanceCloneFactory public immutable instanceFactory;
  address public immutable token;
  address public immutable proxyAddress;
  uint256 public immutable denomination;

  event UpdatedInstanceForProxy(address instance, address token, uint256 denomination);

  constructor(
    address _proxyAddress,
    address _instanceFactory,
    uint256 _denomination,
    address _token
  ) {
    instanceFactory = TornadoInstanceCloneFactory(_instanceFactory);
    token = _token;
    proxyAddress = _proxyAddress;
    denomination = _denomination;
  }

  function executeProposal() external {
    TornadoProxy tornadoProxy = TornadoProxy(proxyAddress);

    ITornadoInstance instance = ITornadoInstance(instanceFactory.createInstanceClone(denomination, token));

    TornadoProxy.Instance memory newInstanceData = TornadoProxy.Instance(true, IERC20(token), TornadoProxy.InstanceState.ENABLED);

    TornadoProxy.Tornado memory tornadoForUpdate = TornadoProxy.Tornado(instance, newInstanceData);

    tornadoProxy.updateInstance(tornadoForUpdate);

    emit UpdatedInstanceForProxy(address(instance), instance.token(), instance.denomination());
  }
}
