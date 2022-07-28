// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "./ERC20TornadoCloneable.sol";
import "./ETHTornadoCloneable.sol";

contract InstanceFactory is Initializable {
  using Clones for address;
  using Address for address;

  address public admin;
  address public ERC20Impl;
  address public nativeCurImpl;
  address public verifier;
  address public hasher;
  uint32 public merkleTreeHeight;

  event NewTreeHeightSet(uint32 indexed newTreeHeight);
  event NewImplementationSet(address indexed ERC20Impl, address indexed nativeCurImpl, address verifier, address hasher);
  event NewInstanceCloneCreated(address indexed clone);

  modifier onlyAdmin() {
    require(admin == msg.sender, "IF: caller is not the admin");
    _;
  }

  /**
   * @notice initialize function for upgradeability
   * @dev this contract will be deployed behind a proxy and should not assign values at logic address,
   *      params left out because self explainable
   * */
  function initialize(
    address _verifier,
    address _hasher,
    uint32 _merkleTreeHeight,
    address _admin
  ) public initializer {
    verifier = _verifier;
    hasher = _hasher;
    merkleTreeHeight = _merkleTreeHeight;
    admin = _admin;

    ERC20TornadoCloneable ERC20ImplContract = new ERC20TornadoCloneable(_verifier, _hasher);
    ERC20Impl = address(ERC20ImplContract);
    ETHTornadoCloneable nativeCurImplContract = new ETHTornadoCloneable(_verifier, _hasher);
    nativeCurImpl = address(nativeCurImplContract);
  }

  /**
   * @dev Creates new Tornado instance.
   * @param _denomination denomination of new Tornado instance
   * @param _token address of ERC20 token for a new instance, if zero address, then it will be ETH
   */
  function createInstanceClone(uint256 _denomination, address _token) public virtual onlyAdmin returns (address clone) {
    return _createInstanceClone(_denomination, _token);
  }

  function _createInstanceClone(uint256 _denomination, address _token) internal returns (address clone) {
    bytes32 salt = keccak256(abi.encodePacked(_denomination, _token));

    if (_token == address(0)) {
      clone = nativeCurImpl.predictDeterministicAddress(salt);
      if (!clone.isContract()) {
        nativeCurImpl.cloneDeterministic(salt);
        emit NewInstanceCloneCreated(clone);
        ETHTornadoCloneable(clone).init(_denomination, merkleTreeHeight);
      }
    } else {
      clone = ERC20Impl.predictDeterministicAddress(salt);
      if (!clone.isContract()) {
        ERC20Impl.cloneDeterministic(salt);
        emit NewInstanceCloneCreated(clone);
        ERC20TornadoCloneable(clone).init(_denomination, merkleTreeHeight, _token);
      }
    }
    return clone;
  }

  function getInstanceAddress(uint256 _denomination, address _token) public view returns (address) {
    bytes32 salt = keccak256(abi.encodePacked(_denomination, _token));
    if (_token == address(0)) {
      return nativeCurImpl.predictDeterministicAddress(salt);
    } else {
      return ERC20Impl.predictDeterministicAddress(salt);
    }
  }

  function setMerkleTreeHeight(uint32 _merkleTreeHeight) external onlyAdmin {
    merkleTreeHeight = _merkleTreeHeight;
    emit NewTreeHeightSet(merkleTreeHeight);
  }

  function generateNewImplementation(address _verifier, address _hasher) external onlyAdmin {
    verifier = _verifier;
    hasher = _hasher;
    ERC20Impl = address(new ERC20TornadoCloneable(_verifier, _hasher));
    nativeCurImpl = address(new ETHTornadoCloneable(_verifier, _hasher));
    emit NewImplementationSet(ERC20Impl, nativeCurImpl, _verifier, _hasher);
  }
}
