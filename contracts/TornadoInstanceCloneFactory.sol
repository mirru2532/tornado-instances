// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma abicoder v2;

import { Ownable } from "openzeppelin-solidity/contracts/access/Ownable.sol";
import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

import "openzeppelin-solidity/contracts/proxy/Clones.sol";
import "./ERC20TornadoCloneable.sol";

contract TornadoInstanceCloneFactory is Ownable {
  using Clones for address;

  mapping(address => mapping(uint256 => address)) public instanceClones;

  address public implementation;
  address public verifier;
  address public hasher;
  uint32 public merkleTreeHeight;

  constructor(
    address _verifier,
    address _hasher,
    uint32 _merkleTreeHeight
  ) {
    verifier = _verifier;
    hasher = _hasher;
    merkleTreeHeight = _merkleTreeHeight;

    ERC20TornadoCloneable implContract = new ERC20TornadoCloneable();
    implementation = address(implContract);
  }

  function setVerifier(address _verifier) external onlyOwner {
    verifier = _verifier;
  }

  function setHasher(address _hasher) external onlyOwner {
    hasher = _hasher;
  }

  function setMerkleTreeHeight(uint32 _merkleTreeHeight) external onlyOwner {
    merkleTreeHeight = _merkleTreeHeight;
  }

  function setImplementation(address _newImplementation) external onlyOwner {
    implementation = _newImplementation;
  }

  function createInstanceClone(uint256 _denomination, address _token) external onlyOwner returns (address) {
    require(instanceClones[_token][_denomination] == address(0), "Instance for this denomination already exists");
    address newImpl = implementation.clone();
    ERC20TornadoCloneable(newImpl).init(IVerifier(verifier), IHasher(hasher), _denomination, merkleTreeHeight, IERC20(_token));
    instanceClones[_token][_denomination] = newImpl;
    return newImpl;
  }

  function getInstanceAddress(uint256 _denomination, address _token) external view returns (address) {
    return instanceClones[_token][_denomination];
  }
}
