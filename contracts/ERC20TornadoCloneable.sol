// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import "./ERC20TornadoVirtual.sol";

contract ERC20TornadoCloneable is ERC20Tornado {
  constructor() ERC20Tornado(IVerifier(address(0)), IHasher(address(0)), 1, 1, IERC20(address(0))) {}

  function init(
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    IERC20 _token
  ) external {
    require(address(verifier) == address(0) && address(hasher) == address(0), "already initialized");
    /// In Constructor: ERC20Tornado from ERC20TornadoVirtual.sol
    token = _token;
    /// In Constructor: Tornado from ERC20TornadoVirtual.sol
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    denomination = _denomination;
    /// In Constructor: MerkleTreeWithHistory from ERC20TornadoVirtual.sol
    require(_merkleTreeHeight > 0, "_levels should be greater than zero");
    require(_merkleTreeHeight < 32, "_levels should be less than 32");

    hasher = _hasher;
    levels = _merkleTreeHeight;

    for (uint32 i = 0; i < _merkleTreeHeight; i++) {
      filledSubtrees[i] = zeros(i);
    }
    roots[0] = zeros(_merkleTreeHeight - 1);
  }
}
