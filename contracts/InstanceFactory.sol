// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./ERC20TornadoCloneable.sol";
import "./AddInstanceProposal.sol";
import "./interfaces/IGovernance.sol";


contract InstanceFactory is Ownable {
  using Clones for address;
  using Address for address;

  address public immutable governance;
  address public immutable instanceRegistry;
  address public implementation;
  address public verifier;
  address public hasher;
  uint32 public merkleTreeHeight;

  event NewVerifierSet(address indexed newVerifier);
  event NewHasherSet(address indexed newHasher);
  event NewTreeHeightSet(uint32 indexed newTreeHeight);
  event NewImplementationSet(address indexed newImplemenentation);
  event NewInstanceCloneCreated(address indexed clone);
  event NewGovernanceProposalCreated(address indexed proposal);

  constructor(
    address _verifier,
    address _hasher,
    uint32 _merkleTreeHeight,
    address _governance,
    address _instanceRegistry
  ) {
    verifier = _verifier;
    hasher = _hasher;
    merkleTreeHeight = _merkleTreeHeight;
    governance = _governance;
    instanceRegistry = _instanceRegistry;

    ERC20TornadoCloneable implContract = new ERC20TornadoCloneable(_verifier, _hasher);
    implementation = address(implContract);

    transferOwnership(_governance);
  }

  function createInstanceClone(uint256 _denomination, address _token) external onlyOwner returns (address) {
    bytes32 salt = keccak256(abi.encodePacked(_denomination, _token));

    require(!implementation.predictDeterministicAddress(salt).isContract(), "Instance already exists");

    address newClone = implementation.cloneDeterministic(salt);

    emit NewInstanceCloneCreated(newClone);
    ERC20TornadoCloneable(newClone).init(_denomination, merkleTreeHeight, _token);
    return newClone;
  }

  function getInstanceAddress(uint256 _denomination, address _token) public view returns (address) {
    bytes32 salt = keccak256(abi.encodePacked(_denomination, _token));
    return implementation.predictDeterministicAddress(salt);
  }

  function createNewProposal(
    address _token,
    uint24 _uniswapPoolSwappingFee,
    uint256[] memory _denominations,
    uint32[] memory _protocolFees
  ) external returns (address) {
    require(_token.isContract(), "Token is not contract"); // TODO should we check that such instance already exist?
    require(_uniswapPoolSwappingFee > 0, "uniswapPoolSwappingFee is zero"); // TODO should we check > 0 ?
    require(_denominations.length > 0, "Empty denominations");
    require(_denominations.length == _protocolFees.length, "Incorrect denominations/fees length");

    address proposal = address(new AddInstanceProposal(
      address(this),
      instanceRegistry,
      _token,
      _uniswapPoolSwappingFee,
      _denominations,
      _protocolFees
    ));
    emit NewGovernanceProposalCreated(proposal);

    return proposal;
  }

  function setVerifier(address _verifier) external onlyOwner {
    verifier = _verifier;
    emit NewVerifierSet(verifier);
  }

  function setHasher(address _hasher) external onlyOwner {
    hasher = _hasher;
    emit NewHasherSet(hasher);
  }

  function setMerkleTreeHeight(uint32 _merkleTreeHeight) external onlyOwner {
    merkleTreeHeight = _merkleTreeHeight;
    emit NewTreeHeightSet(merkleTreeHeight);
  }

  function setImplementation(address _newImplementation) external onlyOwner {
    implementation = _newImplementation;
    emit NewImplementationSet(implementation);
  }

  function generateNewImplementation() external onlyOwner {
    implementation = address(new ERC20TornadoCloneable(verifier, hasher));
  }
}
