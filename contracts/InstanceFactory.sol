// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./ERC20TornadoCloneable.sol";

contract InstanceFactory is Ownable {
  using Clones for address;
  using Address for address;

  address public implementation;
  address public verifier;
  address public hasher;
  uint32 public merkleTreeHeight;

  event NewTreeHeightSet(uint32 indexed newTreeHeight);
  event NewImplementationSet(address indexed newImplemenentation, address verifier, address hasher);
  event NewInstanceCloneCreated(address indexed clone);

  constructor(
    address _verifier,
    address _hasher,
    uint32 _merkleTreeHeight,
    address _owner
  ) {
    verifier = _verifier;
    hasher = _hasher;
    merkleTreeHeight = _merkleTreeHeight;

    ERC20TornadoCloneable implContract = new ERC20TornadoCloneable(_verifier, _hasher);
    implementation = address(implContract);

    transferOwnership(_owner);
  }

  /**
   * @dev Creates new Tornado instance.
   * @param _denomination denomination of new Tornado instance
   * @param _token address of ERC20 token for a new instance
   */
  function createInstanceClone(uint256 _denomination, address _token) public virtual returns (address) {
    bytes32 salt = keccak256(abi.encodePacked(_denomination, _token));

    address newClone = implementation.predictDeterministicAddress(salt);
    if (!newClone.isContract()) {
      implementation.cloneDeterministic(salt);
      emit NewInstanceCloneCreated(newClone);
      ERC20TornadoCloneable(newClone).init(_denomination, merkleTreeHeight, _token);
    }
    return newClone;
  }

  function getInstanceAddress(uint256 _denomination, address _token) public view returns (address) {
    bytes32 salt = keccak256(abi.encodePacked(_denomination, _token));
    return implementation.predictDeterministicAddress(salt);
  }

  function setMerkleTreeHeight(uint32 _merkleTreeHeight) external onlyOwner {
    merkleTreeHeight = _merkleTreeHeight;
    emit NewTreeHeightSet(merkleTreeHeight);
  }

  function generateNewImplementation(address _verifier, address _hasher) external onlyOwner {
    verifier = _verifier;
    hasher = _hasher;
    implementation = address(new ERC20TornadoCloneable(_verifier, _hasher));
    emit NewImplementationSet(implementation, _verifier, _hasher);
  }
}
