require('dotenv').config()
const { task } = require('hardhat/config')
const { BigNumber } = require('@ethersproject/bignumber')

task('deploy_factory', 'deploy the instance factory').setAction(async (taskArgs, hre) => {
  const GovernanceAddress = '0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce'
  const Verifier = `${process.env.VERIFIER}`
  const Hasher = `${process.env.HASHER}`

  const TornadoInstanceFactoryFactory = await hre.ethers.getContractFactory('TornadoInstanceCloneFactory')
  const TornadoInstanceFactoryContract = await TornadoInstanceFactoryFactory.deploy(
    Verifier,
    Hasher,
    BigNumber.from(20),
  )

  await TornadoInstanceFactoryContract.transferOwnership(GovernanceAddress)
  await TornadoInstanceFactoryContract.deployTransaction.wait(5)

  await hre.run('verify:verify', {
    address: TornadoInstanceFactoryContract.address,
    constructorArguments: [Verifier, Hasher, BigNumber.from(20)],
  })

  console.log('Verified TornadoInstanceFactory deployed at: ', TornadoInstanceFactoryContract.address)
})
