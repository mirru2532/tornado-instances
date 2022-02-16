require('dotenv').config()
const { ethers } = require('hardhat')
const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')
const { rbigint, createDeposit, toHex, generateProof, initialize } = require('tornado-cli')

const { propose } = require('../scripts/helper/propose_proposal.js')

const MixerContractABI = require('tornado-cli/build/contracts/Mixer.abi.json')

describe('Deployments test setup', () => {
  const Verifier = `${process.env.VERIFIER}`
  const Hasher = `${process.env.HASHER}`
  const Proxy = `${process.env.PROXY}`

  //// IMPERSONATED ACCOUNTS
  let accounts
  let whale
  let impGov

  //// CONTRACTS / FACTORIES
  let ProposalFactory
  let ProposalContract

  let GovernanceContract
  let TornToken
  let RAIToken
  let TornadoProxy

  let TornadoInstanceFactoryContract

  /// HARDCODED // TODO take from config
  let denominations = [
    '33333333333333333333',
    '333333333333333333333',
    '3333333333333333333333',
    '33333333333333333333333',
  ]
  let tokenAddress = '0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919'

  let minewait = async (time) => {
    await ethers.provider.send('evm_increaseTime', [time])
    await ethers.provider.send('evm_mine', [])
  }

  let sendr = async (method, params) => {
    return await ethers.provider.send(method, params)
  }

  let clog = (...x) => {
    console.log(x)
  }

  let pE = (x) => {
    return ethers.utils.parseEther(`${x}`)
  }

  const ProposalState = {
    Pending: 0,
    Active: 1,
    Defeated: 2,
    Timelocked: 3,
    AwaitingExecution: 4,
    Executed: 5,
    Expired: 6,
  }

  before(async () => {
    accounts = await ethers.getSigners()
    ProposalFactory = await ethers.getContractFactory('CreateFactoryAndAddInstancesProposal')
    GovernanceContract = await ethers.getContractAt(
      'Governance',
      '0x5efda50f22d34F262c29268506C5Fa42cB56A1Ce',
    )
    TornToken = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      '0x77777FeDdddFfC19Ff86DB637967013e6C6A116C',
    )
    TornadoProxy = await ethers.getContractAt('TornadoProxy', '0x722122dF12D4e14e13Ac3b6895a86e84145b6967')
  })

  describe('Test instance deployment', () => {
    let snapshotId

    it('Should have initialized all successfully', () => {
      expect(accounts[0].address).to.exist
      expect(GovernanceContract.address).to.exist
      expect(TornToken.address).to.exist
      expect(TornadoProxy.address).to.exist
    })

    it('Should successfully imitate whale', async () => {
      await sendr('hardhat_impersonateAccount', ['0xA2b2fBCaC668d86265C45f62dA80aAf3Fd1dEde3'])
      whale = await ethers.getSigner('0xA2b2fBCaC668d86265C45f62dA80aAf3Fd1dEde3')
      GovernanceContract = await GovernanceContract.connect(whale)

      let balance = await TornToken.balanceOf(whale.address)
      TornToken = await TornToken.connect(whale)

      await TornToken.approve(GovernanceContract.address, ethers.utils.parseEther('8000000000'))
      await expect(GovernanceContract.lockWithApproval(balance)).to.not.be.reverted

      expect((await GovernanceContract.lockedBalance(whale.address)).toString()).to.equal(balance.toString())
    })

    it('Should successfully deploy proposal', async () => {
      ProposalContract = await ProposalFactory.deploy(Proxy, denominations, tokenAddress)
      expect(await ProposalContract.token()).to.equal(tokenAddress)
      expect(await ProposalContract.denomination1()).to.equal(denominations[0])
      expect(await ProposalContract.denomination2()).to.equal(denominations[1])
      expect(await ProposalContract.denomination3()).to.equal(denominations[2])
      expect(await ProposalContract.denomination4()).to.equal(denominations[3])

      TornadoInstanceFactoryContract = await ethers.getContractAt(
        'TornadoInstanceCloneFactory',
        await ProposalContract.instanceFactory(),
      )
    })

    it('Should successfully pass the proposal', async () => {
      let response, id, state
      ;[response, id, state] = await propose([whale, ProposalContract, 'Instances'])

      let { events } = await response.wait()
      let args = events.find(({ event }) => event == 'ProposalCreated').args
      expect(args.id).to.be.equal(id)
      expect(args.proposer).to.be.equal(whale.address)
      expect(args.target).to.be.equal(ProposalContract.address)
      expect(args.description).to.be.equal('Instances')
      expect(state).to.be.equal(ProposalState.Pending)

      await minewait((await GovernanceContract.VOTING_DELAY()).add(1).toNumber())
      await expect(GovernanceContract.castVote(id, true)).to.not.be.reverted
      state = await GovernanceContract.state(id)
      expect(state).to.be.equal(ProposalState.Active)
      await minewait(
        (
          await GovernanceContract.VOTING_PERIOD()
        )
          .add(await GovernanceContract.EXECUTION_DELAY())
          .add(86400)
          .toNumber(),
      )
      const overrides = {
        gasLimit: BigNumber.from('30000000'),
      }
      await GovernanceContract.execute(id, overrides)
      
      expect(await GovernanceContract.state(id)).to.be.equal(ProposalState.Executed)
    })

    it('Should set correct params for factory', async () => {
      expect(await TornadoInstanceFactoryContract.verifier()).to.equal(Verifier)
      expect(await TornadoInstanceFactoryContract.hasher()).to.equal(Hasher)
      expect(await TornadoInstanceFactoryContract.merkleTreeHeight()).to.equal(20)
      // clog(await TornadoInstanceFactoryContract.implementation())
    })

    it('Factory should be able to generate an instance without reverting', async () => {
      const OHMAddress = '0x383518188C0C6d7730D91b2c03a03C837814a899'

      await sendr('hardhat_impersonateAccount', [GovernanceContract.address])
      await sendr('hardhat_setBalance', [GovernanceContract.address, '0xDE0B6B3A764000000'])
      impGov = await ethers.getSigner(GovernanceContract.address)

      const factory = await TornadoInstanceFactoryContract.connect(impGov)

      await factory.createInstanceClone(333, OHMAddress)
      const instanceAddress = await TornadoInstanceFactoryContract.getInstanceAddress(333, OHMAddress)

      const instance = await ethers.getContractAt('ERC20TornadoCloneable', instanceAddress)

      const token = await instance.token()
      const denomination = await instance.denomination()
      const verifier = await instance.verifier()
      const hasher = await instance.hasher()
      const levels = await instance.levels()

      expect(token).to.equal(OHMAddress)
      expect(denomination).to.equal(333)
      expect(verifier).to.equal(Verifier)
      expect(hasher).to.equal(Hasher)
      expect(levels).to.equal(20)
    })

    it('Governance should be able to set factory params', async () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000'

      const factory = await TornadoInstanceFactoryContract.connect(impGov)
      await factory.setVerifier(zeroAddress)
      await factory.setHasher(zeroAddress)
      await factory.setMerkleTreeHeight(25)

      let fverifier = await factory.verifier()
      let fhasher = await factory.hasher()
      let merkleTreeHeight = await factory.merkleTreeHeight()

      expect(fverifier).to.equal(zeroAddress)
      expect(fhasher).to.equal(zeroAddress)
      expect(merkleTreeHeight).to.equal(25)

      await factory.setVerifier(Verifier)
      await factory.setHasher(Hasher)
      await factory.setMerkleTreeHeight(20)

      fverifier = await factory.verifier()
      fhasher = await factory.hasher()
      merkleTreeHeight = await factory.merkleTreeHeight()

      expect(fverifier).to.equal(Verifier)
      expect(fhasher).to.equal(Hasher)
      expect(merkleTreeHeight).to.equal(20)
    })

    let whaleRAI, whaleRAIBalance, TornadoInstance, mixerContract, instanceAddresses
    instanceAddresses = []

    it('Should prepare data for instance deposit/withdraw tests', async () => {
      const RAITokenAddress = '0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919'
      await sendr('hardhat_impersonateAccount', ['0x46a0B4Fa58141ABa23185e79f7047A7dFd0FF100'])
      RAIToken = await ethers.getContractAt(
        '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
        RAITokenAddress,
      )
      whaleRAI = await ethers.getSigner('0x46a0B4Fa58141ABa23185e79f7047A7dFd0FF100')

      const tx = {
        to: whaleRAI.address,
        value: pE(50),
      }
      await accounts[0].sendTransaction(tx)

      whaleRAIBalance = await RAIToken.balanceOf(whaleRAI.address)
      RAIToken = await RAIToken.connect(whaleRAI)
      TornadoProxy = await TornadoProxy.connect(whaleRAI)

      for (let i = 0; i < 4; i++) {
        instanceAddresses[i] = await TornadoInstanceFactoryContract.getInstanceAddress(
          denominations[i],
          RAIToken.address,
        )
      }

      mixerContract = await ethers.getContractAt(MixerContractABI, instanceAddresses[0])
      mixerContract = await mixerContract.connect(whaleRAI)

      snapshotId = await sendr('evm_snapshot', [])
    })

    it('Should test depositing and withdrawing into the new instance over proxy', async () => {
      const depo = createDeposit({
        nullifier: rbigint(31),
        secret: rbigint(31),
      })

      // const note = toHex(depo.preimage, 62)
      // const noteString = `tornado-RAI-33-1-${note}`
      // clog('Note: ', note)
      // clog('Note string: ', noteString)
      // clog('Commitment: ', toHex(depo.commitment))

      await expect(RAIToken.approve(TornadoProxy.address, pE(5000000))).to.not.be.reverted
      TornadoInstance = await ethers.getContractAt(
        'contracts/tornado_proxy/ITornadoInstance.sol:ITornadoInstance',
        instanceAddresses[0],
      )

      await expect(() =>
        TornadoProxy.deposit(instanceAddresses[0], toHex(depo.commitment), []),
      ).to.changeTokenBalance(RAIToken, whaleRAI, BigNumber.from(0).sub(await TornadoInstance.denomination()))

      let pevents = await mixerContract.queryFilter('Deposit')
      await initialize({ merkleTreeHeight: 20 })

      const { proof, args } = await generateProof({
        deposit: depo,
        recipient: whaleRAI.address,
        events: pevents,
      })

      await expect(() =>
        TornadoProxy.withdraw(TornadoInstance.address, proof, ...args),
      ).to.changeTokenBalance(RAIToken, whaleRAI, await TornadoInstance.denomination())

      await sendr('evm_revert', [snapshotId])
      snapshotId = await sendr('evm_snapshot', [])
    })

    it('Should prepare for multiple account deposits', async () => {
      let toSend = whaleRAIBalance.div(5)

      for (let i = 0; i < 3; i++) {
        await RAIToken.transfer(accounts[i].address, toSend)
        const rai = await RAIToken.connect(accounts[i])
        await rai.approve(TornadoProxy.address, pE(600000))
      }
    })

    it('Should test depositing with multiple accounts over proxy', async () => {
      for (let i = 0; i < 3; i++) {
        const depo = createDeposit({
          nullifier: rbigint(31),
          secret: rbigint(31),
        })
        // const note = toHex(depo.preimage, 62)
        // const noteString = `tornado-RAI-33-1-${note}`
        // clog('Note: ', note)
        // clog('Note string: ', noteString)
        // clog('Commitment: ', toHex(depo.commitment))
        const proxy = await TornadoProxy.connect(accounts[i])

        await expect(() =>
          proxy.deposit(TornadoInstance.address, toHex(depo.commitment), []),
        ).to.changeTokenBalance(
          RAIToken,
          accounts[i],
          BigNumber.from(0).sub(await TornadoInstance.denomination()),
        )

        let pevents = await mixerContract.queryFilter('Deposit')
        await initialize({ merkleTreeHeight: 20 })

        const { proof, args } = await generateProof({
          deposit: depo,
          recipient: accounts[i].address,
          events: pevents,
        })

        await expect(() => proxy.withdraw(TornadoInstance.address, proof, ...args)).to.changeTokenBalance(
          RAIToken,
          accounts[i],
          await TornadoInstance.denomination(),
        )
      }
    })
  })

  after(async function () {
    await ethers.provider.send('hardhat_reset', [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_KEY}`,
          blockNumber: process.env.use_latest_block == 'true' ? undefined : 13017436,
        },
      },
    ])
  })
})
