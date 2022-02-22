// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IInstanceRegistry {
  enum InstanceState {
    DISABLED,
    ENABLED
  }

  struct Instance {
    bool isERC20;
    IERC20 token;
    InstanceState state;
    // the fee of the uniswap pool which will be used to get a TWAP
    uint24 uniswapPoolSwappingFee;
    // the fee the protocol takes from relayer, it should be multiplied by PROTOCOL_FEE_DIVIDER from FeeManager.sol
    uint32 protocolFeePercentage;
  }

  struct Tornado {
    address addr;
    Instance instance;
  }

  function updateInstance(Tornado calldata _tornado) external;
}
