require('dotenv').config()
const { task } = require('hardhat/config')
const instancesData = require('../resources/instances')

task('propose_proposal', 'propose proposal that uses factory')
  .addParam('proposalAddress', 'address of proposal')
  .setAction(async (taskArgs, hre) => {
    const proposalName = `add-${instancesData[0].symbol}-instances`

    const GovernanceContract = await hre.ethers.getContractAt(
      '../artifacts/tornado-governance/contracts/Governance.sol:Governance',
      '0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce',
    )
    await GovernanceContract.propose(taskArgs.proposalAddress, proposalName)

    const id = await GovernanceContract.latestProposalIds((await hre.ethers.getSigners())[0].address)
    const state = await GovernanceContract.state(id)

    console.log('Proposal with name: ', proposalName, ' proposed with id: ', id, ', has state: ', state)
  })
