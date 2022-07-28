// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import "./AddInstanceProposal.sol";
import "./interfaces/IInstanceFactory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Permit } from "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import { IUniswapV3PoolState } from "@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolState.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/Initializable.sol";

contract InstanceProposalCreator is Initializable {
  using Address for address;

  address public immutable governance;
  address public immutable torn;
  IInstanceFactory public immutable instanceFactory;
  address public immutable instanceRegistry;
  IUniswapV3Factory public immutable UniswapV3Factory;
  address public immutable WETH;
  uint16 public TWAPSlotsMin;
  uint256 public creationFee;

  event NewCreationFeeSet(uint256 newCreationFee);
  event NewTWAPSlotsMinSet(uint256 newTWAPSlotsMin);
  event NewGovernanceProposalCreated(address indexed proposal);

  /**
   * @dev Throws if called by any account other than the Governance.
   */
  modifier onlyGovernance() {
    require(governance == msg.sender, "IF: caller is not the Governance");
    _;
  }

  constructor(
    address _governance,
    address _instanceFactory,
    address _instanceRegistry,
    address _torn,
    address _UniswapV3Factory,
    address _WETH
  ) {
    governance = _governance;
    instanceFactory = IInstanceFactory(_instanceFactory);
    instanceRegistry = _instanceRegistry;
    torn = _torn;
    UniswapV3Factory = IUniswapV3Factory(_UniswapV3Factory);
    WETH = _WETH;
  }

  /**
   * @notice initialize function for upgradeability
   * @dev this contract will be deployed behind a proxy and should not assign values at logic address,
   *      params left out because self explainable
   * */
  function initialize(uint16 _TWAPSlotsMin, uint256 _creationFee) external initializer {
    TWAPSlotsMin = _TWAPSlotsMin;
    creationFee = _creationFee;
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
    require(_token == address(0) || _token.isContract(), "Token is not contract");
    require(_denominations.length > 0, "Empty denominations");
    require(_denominations.length == _protocolFees.length, "Incorrect denominations/fees length");

    // check Uniswap Pool
    for (uint8 i = 0; i < _protocolFees.length; i++) {
      require(_protocolFees[i] <= 10000, "Protocol fee is more than 100%");
      if (_protocolFees[i] > 0 && _token != address(0)) {
        // pool exists
        address poolAddr = UniswapV3Factory.getPool(_token, WETH, _uniswapPoolSwappingFee);
        require(poolAddr != address(0), "Uniswap pool is not exist");
        // TWAP slots
        (, , , , uint16 observationCardinalityNext, , ) = IUniswapV3PoolState(poolAddr).slot0();
        require(observationCardinalityNext >= TWAPSlotsMin, "Uniswap pool TWAP slots number is low");
        break;
      }
    }

    address proposal = address(
      new AddInstanceProposal(
        address(instanceFactory),
        instanceRegistry,
        _token,
        _uniswapPoolSwappingFee,
        _denominations,
        _protocolFees
      )
    );
    emit NewGovernanceProposalCreated(proposal);

    return proposal;
  }

  function setCreationFee(uint256 _creationFee) external onlyGovernance {
    creationFee = _creationFee;
    emit NewCreationFeeSet(_creationFee);
  }

  function setTWAPSlotsMin(uint16 _TWAPSlotsMin) external onlyGovernance {
    TWAPSlotsMin = _TWAPSlotsMin;
    emit NewTWAPSlotsMinSet(_TWAPSlotsMin);
  }
}
