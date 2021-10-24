require('dotenv').config()
const { task } = require('hardhat/config')
const { BigNumber } = require('@ethersproject/bignumber')
const instancesData = require('../resources/instances')

task('deploy_proposal', 'deploy proposal that uses factory')
  .addParam('factoryAddress', 'address of factory')
  .setAction(async (taskArgs, hre) => {
    const contractName = `Add${instancesData.length}Instance${instancesData.length == 1 ? '' : 's'}`

    const ProposalFactory = await hre.ethers.getContractFactory(contractName)

    let denominations = []
    for (let i = 0; i < instancesData.length; i++) {
      denominations[i] = BigNumber.from(instancesData[i].denomination)
    }

    const tokenAddress = instancesData[0].tokenAddress

    const ProposalContract = await ProposalFactory.deploy(
      `${process.env.PROXY}`,
      taskArgs.factoryAddress,
      denominations.length == 1 ? denominations[0] : denominations,
      tokenAddress,
    )

    await ProposalContract.deployTransaction.wait(5)

    await hre.run('verify:verify', {
      address: ProposalContract.address,
      constructorArguments: [
        `${process.env.PROXY}`,
        taskArgs.factoryAddress,
        denominations.length == 1 ? denominations[0] : denominations,
        tokenAddress,
      ],
    })

    console.log(`Verified ${contractName} deployed at: `, ProposalContract.address)
  })
