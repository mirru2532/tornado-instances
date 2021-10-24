// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./TornadoInstanceCloneFactory.sol";
import "./tornado_proxy/TornadoProxy.sol";

contract CreateFactoryAndAddInstancesProposal {
  address public constant verifier = 0xce172ce1F20EC0B3728c9965470eaf994A03557A;
  address public constant hasher = 0x83584f83f26aF4eDDA9CBe8C730bc87C364b28fe;
  address public constant governance = 0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce;

  TornadoInstanceCloneFactory public immutable instanceFactory;
  address public immutable token;
  address public immutable proxyAddress;

  uint256 public immutable denomination1;
  uint256 public immutable denomination2;
  uint256 public immutable denomination3;
  uint256 public immutable denomination4;

  event UpdatedInstanceForProxy(address indexed instance, address indexed token, uint256 indexed denomination);

  constructor(
    address _proxyAddress,
    uint256[4] memory _denominations,
    address _token
  ) {
    TornadoInstanceCloneFactory cachedFactory = new TornadoInstanceCloneFactory(verifier, hasher, 20);
    cachedFactory.transferOwnership(governance);
    instanceFactory = cachedFactory;

    token = _token;
    proxyAddress = _proxyAddress;

    denomination1 = _denominations[0];
    denomination2 = _denominations[1];
    denomination3 = _denominations[2];
    denomination4 = _denominations[3];
  }

  function executeProposal() external {
    TornadoProxy tornadoProxy = TornadoProxy(proxyAddress);

    for (uint256 i = 0; i < 4; i++) {
      ITornadoInstance instance = ITornadoInstance(instanceFactory.createInstanceClone(denominations(i), token));

      TornadoProxy.Instance memory newInstanceData = TornadoProxy.Instance(
        true,
        IERC20(token),
        TornadoProxy.InstanceState.ENABLED
      );

      TornadoProxy.Tornado memory tornadoForUpdate = TornadoProxy.Tornado(instance, newInstanceData);

      tornadoProxy.updateInstance(tornadoForUpdate);

      emit UpdatedInstanceForProxy(address(instance), instance.token(), instance.denomination());
    }
  }

  function denominations(uint256 index) private view returns (uint256) {
    if (index > 2) {
      return denomination4;
    } else if (index > 1) {
      return denomination3;
    } else if (index > 0) {
      return denomination2;
    } else {
      return denomination1;
    }
  }
}
