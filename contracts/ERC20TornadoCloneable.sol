// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import "tornado-core/contracts/ERC20Tornado.sol";

contract ERC20TornadoCloneable is ERC20Tornado {
  constructor(address verifier, address hasher) ERC20Tornado(IVerifier(verifier), IHasher(hasher), 1, 1, IERC20(address(0))) {}

  function init(
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    address _token
  ) external {
    require(denomination == 0 && levels == 0, "already initialized");

    token = IERC20(_token);
    require(_denomination > 0, "denomination should be greater than 0");
    denomination = _denomination;
    require(_merkleTreeHeight > 0, "_levels should be greater than zero");
    require(_merkleTreeHeight < 32, "_levels should be less than 32");
    levels = _merkleTreeHeight;

    for (uint32 i = 0; i < _merkleTreeHeight; i++) {
      filledSubtrees[i] = zeros(i);
    }

    roots[0] = zeros(_merkleTreeHeight - 1);
  }
}
