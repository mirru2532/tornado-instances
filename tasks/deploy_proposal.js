require('dotenv').config()
const { task } = require('hardhat/config')
const { BigNumber } = require('@ethersproject/bignumber')
const instancesData = require('../resources/instances')

task('deploy_proposal', 'deploy proposal that uses factory').setAction(async (taskArgs, hre) => {
  const ProposalFactory = await hre.ethers.getContractFactory('CreateFactoryAndAddInstancesProposal')

  let denominations = []
  for (let i = 0; i < 4; i++) {
    denominations[i] = BigNumber.from(instancesData[i].denomination)
  }
  const tokenAddress = instancesData[0].tokenAddress

  const ProposalContract = await ProposalFactory.deploy(denominations, tokenAddress)

  await ProposalContract.deployTransaction.wait(5)

  await hre.run('verify:verify', {
    address: ProposalContract.address,
    constructorArguments: [denominations, tokenAddress],
  })

  console.log('Verified CreateFactoryAndAddInstancesProposal deployed at: ', ProposalContract.address)
})
