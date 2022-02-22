const hre = require('hardhat')
const { ethers, waffle } = hre
const { loadFixture } = waffle
const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')
const { rbigint, createDeposit, toHex, generateProof, initialize } = require('tornado-cli')
const MixerContractABI = require('tornado-cli/build/contracts/Mixer.abi.json')
const config = require('../config')
const { getSignerFromAddress, minewait } = require('./utils')


describe('Instance Factory Tests', () => {
  const ProposalState = {
    Pending: 0,
    Active: 1,
    Defeated: 2,
    Timelocked: 3,
    AwaitingExecution: 4,
    Executed: 5,
    Expired: 6,
  }

  const addressZero = ethers.constants.AddressZero

  async function fixture() {
    const [sender, deployer, multisig] = await ethers.getSigners()

    const tornWhale = await getSignerFromAddress(config.tornWhale)
    
    const gov = await ethers.getContractAt(
      'Governance',
      config.governance,
    )

    const tornToken = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      config.TORN,
    )

    const compToken = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      config.COMP,
    )

    instanceRegistry = await ethers.getContractAt(
      'tornado-relayer-registry/contracts/tornado-proxy/InstanceRegistry.sol:InstanceRegistry', 
      config.instanceRegistry,
    )

    // deploy instance factory
    InstanceFactory = await ethers.getContractFactory('InstanceFactory')
    const instanceFactory = await InstanceFactory.connect(deployer).deploy(
      config.verifier,
      config.hasher,
      config.merkleTreeHeight,
      config.governance,
      config.instanceRegistry
    )
    await instanceFactory.deployed()

    return { sender, deployer, multisig, tornWhale, gov, tornToken, compToken, instanceRegistry, instanceFactory }
  }

  it('Should have initialized all successfully', async function () {
    const { sender, gov, tornToken, instanceRegistry, instanceFactory } = await loadFixture(fixture)
    expect(sender.address).to.exist
    expect(gov.address).to.exist
    expect(tornToken.address).to.exist
    expect(instanceRegistry.address).to.exist
    expect(instanceFactory.address).to.exist
  })

  it('Should set correct params for factory', async function () {
    const { instanceFactory } = await loadFixture(fixture)

    expect( await instanceFactory.governance()).to.be.equal(config.governance)
    expect( await instanceFactory.verifier()).to.be.equal(config.verifier)
    expect( await instanceFactory.hasher()).to.be.equal(config.hasher)
    expect( await instanceFactory.merkleTreeHeight()).to.be.equal(config.merkleTreeHeight)
    expect(await instanceFactory.implementation()).to.exist
  })

  it('Governance should be able to set factory params', async function () {
    let { instanceFactory, gov } = await loadFixture(fixture)

    await expect(instanceFactory.setVerifier(addressZero)).to.be.reverted

    const govSigner = await getSignerFromAddress(gov.address)
    instanceFactory = await instanceFactory.connect(govSigner)
    
    await instanceFactory.setVerifier(addressZero)
    await instanceFactory.setHasher(addressZero)
    await instanceFactory.setMerkleTreeHeight(1)

    expect( await instanceFactory.verifier()).to.be.equal(addressZero)
    expect( await instanceFactory.hasher()).to.be.equal(addressZero)
    expect( await instanceFactory.merkleTreeHeight()).to.be.equal(1)

    await instanceFactory.setVerifier(config.verifier)
    await instanceFactory.setHasher(config.hasher)
    await instanceFactory.setMerkleTreeHeight(config.merkleTreeHeight)

    expect( await instanceFactory.verifier()).to.be.equal(config.verifier)
    expect( await instanceFactory.hasher()).to.be.equal(config.hasher)
    expect( await instanceFactory.merkleTreeHeight()).to.be.equal(config.merkleTreeHeight)
  })

  it('Should successfully deploy/propose/execute proposal - add instance', async function () {
    let { instanceFactory, gov, instanceRegistry, tornWhale, tornToken } = await loadFixture(fixture)

    // deploy proposal ----------------------------------------------
    let tx = await instanceFactory.createNewProposal(
      config.COMP,
      3000,
      [ethers.utils.parseEther('100')],
      [30]
    )
    let receipt = await tx.wait()

    const proposal = await ethers.getContractAt(
      'AddInstanceProposal', 
      receipt.events[0].args[0],
    )
    
    expect( await proposal.instanceFactory()).to.be.equal(instanceFactory.address)
    expect( await proposal.instanceRegistry()).to.be.equal(instanceRegistry.address)
    expect( await proposal.token()).to.be.equal(config.COMP)
    expect( await proposal.uniswapPoolSwappingFee()).to.be.equal(3000)
    expect( await proposal.numInstances()).to.be.equal(1)
    expect( await proposal.protocolFeeByIndex(0)).to.be.equal(30)
    expect( await proposal.denominationByIndex(0)).to.be.equal(ethers.utils.parseEther('100'))

    // propose proposal ---------------------------------------------
    let response, id, state
    gov = await gov.connect(tornWhale)
    await tornToken.connect(tornWhale).approve(gov.address, ethers.utils.parseEther('26000'))
    await gov.lockWithApproval(ethers.utils.parseEther('26000'))

    response = await gov.propose(proposal.address, 'COMP token instance proposal')
    id = await gov.latestProposalIds(tornWhale.address)
    state = await gov.state(id)

    const { events } = await response.wait()
    const args = events.find(({ event }) => event == 'ProposalCreated').args
    expect(args.id).to.be.equal(id)
    expect(args.proposer).to.be.equal(tornWhale.address)
    expect(args.target).to.be.equal(proposal.address)
    expect(args.description).to.be.equal('COMP token instance proposal')
    expect(state).to.be.equal(ProposalState.Pending)
    
    // execute proposal ---------------------------------------------
    await minewait((await gov.VOTING_DELAY()).add(1).toNumber())
    await expect(gov.castVote(id, true)).to.not.be.reverted
    expect(await gov.state(id)).to.be.equal(ProposalState.Active)
    await minewait(
      (
        await gov.VOTING_PERIOD()
      )
        .add(await gov.EXECUTION_DELAY())
        .add(96400)
        .toNumber(),
    )
    expect(await gov.state(id)).to.be.equal(ProposalState.AwaitingExecution)
    
    tx = await gov.execute(id)

    expect(await gov.state(id)).to.be.equal(ProposalState.Executed)

    // check instance initialization --------------------------------
    receipt = await tx.wait()
    const instanceAddr = '0x' + receipt.events[0].topics[1].toString().slice(-40)
    const instance = await ethers.getContractAt(
      'ERC20TornadoCloneable', 
      instanceAddr,
    )

    expect( await instance.token()).to.be.equal(config.COMP)
    expect( await instance.verifier()).to.be.equal(config.verifier)
    expect( await instance.hasher()).to.be.equal(config.hasher)
    expect( await instance.levels()).to.be.equal(config.merkleTreeHeight)
    expect( await instance.denomination()).to.equal(ethers.utils.parseEther('100'))

    const instanceData =  await instanceRegistry.instances(instance.address)
    expect(instanceData.isERC20).to.be.equal(true)
    expect(instanceData.token).to.be.equal(config.COMP)
    expect(instanceData.state).to.be.equal(1)
    expect(instanceData.uniswapPoolSwappingFee).to.be.equal(3000)
    expect(instanceData.protocolFeePercentage).to.be.equal(30)
  })
  
  // it('Should prepare data for instance deposit/withdraw tests', async () => {
  //   const RAITokenAddress = '0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919'
  //   await sendr('hardhat_impersonateAccount', ['0x46a0B4Fa58141ABa23185e79f7047A7dFd0FF100'])
  //   RAIToken = await ethers.getContractAt(
  //     '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
  //     RAITokenAddress,
  //   )
  //   whaleRAI = await ethers.getSigner('0x46a0B4Fa58141ABa23185e79f7047A7dFd0FF100')

  //   const tx = {
  //     to: whaleRAI.address,
  //     value: pE(50),
  //   }
  //   await accounts[0].sendTransaction(tx)

  //   whaleRAIBalance = await RAIToken.balanceOf(whaleRAI.address)
  //   RAIToken = await RAIToken.connect(whaleRAI)
  //   TornadoProxy = await TornadoProxy.connect(whaleRAI)

  //   for (let i = 0; i < 4; i++) {
  //     instanceAddresses[i] = await TornadoInstanceFactoryContract.getInstanceAddress(
  //       denominations[i],
  //       RAIToken.address,
  //     )
  //   }

  //   mixerContract = await ethers.getContractAt(MixerContractABI, instanceAddresses[0])
  //   mixerContract = await mixerContract.connect(whaleRAI)

  //   snapshotId = await sendr('evm_snapshot', [])
  // })

  // it('Should test depositing and withdrawing into the new instance over proxy', async () => {
  //   const depo = createDeposit({
  //     nullifier: rbigint(31),
  //     secret: rbigint(31),
  //   })

  //   // const note = toHex(depo.preimage, 62)
  //   // const noteString = `tornado-RAI-33-1-${note}`
  //   // clog('Note: ', note)
  //   // clog('Note string: ', noteString)
  //   // clog('Commitment: ', toHex(depo.commitment))

  //   await expect(RAIToken.approve(TornadoProxy.address, pE(5000000))).to.not.be.reverted
  //   TornadoInstance = await ethers.getContractAt(
  //     'contracts/tornado_proxy/ITornadoInstance.sol:ITornadoInstance',
  //     instanceAddresses[0],
  //   )

  //   await expect(() =>
  //     TornadoProxy.deposit(instanceAddresses[0], toHex(depo.commitment), []),
  //   ).to.changeTokenBalance(RAIToken, whaleRAI, BigNumber.from(0).sub(await TornadoInstance.denomination()))

  //   let pevents = await mixerContract.queryFilter('Deposit')
  //   await initialize({ merkleTreeHeight: 20 })

  //   const { proof, args } = await generateProof({
  //     deposit: depo,
  //     recipient: whaleRAI.address,
  //     events: pevents,
  //   })

  //   await expect(() =>
  //     TornadoProxy.withdraw(TornadoInstance.address, proof, ...args),
  //   ).to.changeTokenBalance(RAIToken, whaleRAI, await TornadoInstance.denomination())

  //   await sendr('evm_revert', [snapshotId])
  //   snapshotId = await sendr('evm_snapshot', [])
  // })

  // it('Should prepare for multiple account deposits', async () => {
  //   let toSend = whaleRAIBalance.div(5)

  //   for (let i = 0; i < 3; i++) {
  //     await RAIToken.transfer(accounts[i].address, toSend)
  //     const rai = await RAIToken.connect(accounts[i])
  //     await rai.approve(TornadoProxy.address, pE(600000))
  //   }
  // })

  // it('Should test depositing with multiple accounts over proxy', async () => {
  //   for (let i = 0; i < 3; i++) {
  //     const depo = createDeposit({
  //       nullifier: rbigint(31),
  //       secret: rbigint(31),
  //     })
  //     // const note = toHex(depo.preimage, 62)
  //     // const noteString = `tornado-RAI-33-1-${note}`
  //     // clog('Note: ', note)
  //     // clog('Note string: ', noteString)
  //     // clog('Commitment: ', toHex(depo.commitment))
  //     const proxy = await TornadoProxy.connect(accounts[i])

  //     await expect(() =>
  //       proxy.deposit(TornadoInstance.address, toHex(depo.commitment), []),
  //     ).to.changeTokenBalance(
  //       RAIToken,
  //       accounts[i],
  //       BigNumber.from(0).sub(await TornadoInstance.denomination()),
  //     )

  //     let pevents = await mixerContract.queryFilter('Deposit')
  //     await initialize({ merkleTreeHeight: 20 })

  //     const { proof, args } = await generateProof({
  //       deposit: depo,
  //       recipient: accounts[i].address,
  //       events: pevents,
  //     })

  //     await expect(() => proxy.withdraw(TornadoInstance.address, proof, ...args)).to.changeTokenBalance(
  //       RAIToken,
  //       accounts[i],
  //       await TornadoInstance.denomination(),
  //     )
  //   }
  // })
})
