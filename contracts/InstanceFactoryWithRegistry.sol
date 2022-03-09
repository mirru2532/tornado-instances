// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import "./AddInstanceProposal.sol";
import "./InstanceFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/drafts/IERC20Permit.sol";

contract InstanceFactoryWithRegistry is InstanceFactory {
  using Address for address;

  address public immutable governance;
  address public immutable torn;
  address public immutable instanceRegistry;
  uint256 public creationFee;

  event NewCreationFeeSet(uint256 indexed newCreationFee);
  event NewGovernanceProposalCreated(address indexed proposal);

  /**
   * @dev Throws if called by any account other than the Governance.
   */
  modifier onlyGovernance() {
    require(owner() == _msgSender(), "Caller is not the Governance");
    _;
  }

  constructor(
    address _verifier,
    address _hasher,
    uint32 _merkleTreeHeight,
    address _governance,
    address _instanceRegistry,
    address _torn,
    uint256 _creationFee
  ) InstanceFactory(_verifier, _hasher, _merkleTreeHeight, _governance) {
    governance = _governance;
    instanceRegistry = _instanceRegistry;
    torn = _torn;
    creationFee = _creationFee;
  }

  /**
   * @dev Throws if called by any account other than the Governance.
   * @param _denomination denomination of new Tornado instance
   * @param _token address of ERC20 token for a new instance
   */
  function createInstanceClone(uint256 _denomination, address _token) public override onlyGovernance returns (address) {
    return super.createInstanceClone(_denomination, _token);
  }

  /**
   * @dev Creates AddInstanceProposal with approve.
   * @param _token address of ERC20 token for a new instance
   * @param _uniswapPoolSwappingFee fee value of Uniswap instance which will be used for `TORN/token` price determination.
   * `3000` means 0.3% fee Uniswap pool.
   * @param _denominations list of denominations for each new instance
   * @param _protocolFees list of protocol fees for each new instance.
   * `100` means that instance withdrawal fee is 1% of denomination.
   */
  function createProposalApprove(
    address _token,
    uint24 _uniswapPoolSwappingFee,
    uint256[] memory _denominations,
    uint32[] memory _protocolFees
  ) external returns (address) {
    require(IERC20(torn).transferFrom(msg.sender, governance, creationFee));
    return _createProposal(_token, _uniswapPoolSwappingFee, _denominations, _protocolFees);
  }

  /**
   * @dev Creates AddInstanceProposal with permit.
   * @param _token address of ERC20 token for a new instance
   * @param _uniswapPoolSwappingFee fee value of Uniswap instance which will be used for `TORN/token` price determination.
   * `3000` means 0.3% fee Uniswap pool.
   * @param _denominations list of denominations for each new instance
   * @param _protocolFees list of protocol fees for each new instance.
   * `100` means that instance withdrawal fee is 1% of denomination.
   */
  function createProposalPermit(
    address _token,
    uint24 _uniswapPoolSwappingFee,
    uint256[] memory _denominations,
    uint32[] memory _protocolFees,
    address creater,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (address) {
    IERC20Permit(torn).permit(creater, address(this), creationFee, deadline, v, r, s);
    require(IERC20(torn).transferFrom(creater, governance, creationFee));
    return _createProposal(_token, _uniswapPoolSwappingFee, _denominations, _protocolFees);
  }

  function _createProposal(
    address _token,
    uint24 _uniswapPoolSwappingFee,
    uint256[] memory _denominations,
    uint32[] memory _protocolFees
  ) internal returns (address) {
    require(_token.isContract(), "Token is not contract");
    require(_uniswapPoolSwappingFee > 0, "uniswapPoolSwappingFee is zero");
    require(_denominations.length > 0, "Empty denominations");
    require(_denominations.length == _protocolFees.length, "Incorrect denominations/fees length");

    address proposal = address(
      new AddInstanceProposal(address(this), instanceRegistry, _token, _uniswapPoolSwappingFee, _denominations, _protocolFees)
    );
    emit NewGovernanceProposalCreated(proposal);

    return proposal;
  }

  function setCreationFee(uint256 _creationFee) external onlyGovernance {
    creationFee = _creationFee;
    emit NewCreationFeeSet(_creationFee);
  }
}
