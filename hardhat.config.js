require('dotenv').config()
require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-etherscan')
require('@nomiclabs/hardhat-waffle')
require('hardhat-log-remover')
require('solidity-coverage')

require('./tasks/deploy_proposal.js')
require('./tasks/deploy_factory_proposal.js')
require('./tasks/propose_proposal.js')
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 2000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
        blockNumber: process.env.use_latest_block == 'true' ? undefined : 13017436,
      },
      loggingEnabled: false,
    },
    localhost: {
      url: 'http://localhost:8545',
      timeout: 120000,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.mainnet_rpc_key}`,
      accounts: [`${process.env.mainnet_account_pk}`],
      timeout: 2147483647,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.goerli_rpc_key}`,
      accounts: [`${process.env.goerli_account_pk}`],
      timeout: 2147483647,
    },
  },
  mocha: { timeout: 9999999999 },
  spdxLicenseIdentifier: {
    overwrite: true,
    runOnCompile: true,
  },
  etherscan: {
    apiKey: `${process.env.etherscan_api_key}`,
  },
}
