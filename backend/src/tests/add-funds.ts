// backend/tests/test-bounty-add-funds.ts
import { WalletClient, TopicBroadcaster, Transaction, Utils, ProtoWallet, ECDSA, Signature, LockingScript, Script, WalletInterface} from '@bsv/sdk'
import TransactionSignature from '@bsv/sdk/primitives/TransactionSignature'
import UnlockingScript from '@bsv/sdk/script/UnlockingScript'
import bountyContractJson from '../../artifacts/BountyContract.json' with { type: 'json' }
import { BountyContract } from '../../src/contracts/BountyContract.js'
import { bsv, toByteString, PubKey, Sig, findSig, SignatureHashType, SigHashPreimage, MethodCallOptions, P2PKH} from 'scrypt-ts'
import { sha256 } from '@bsv/sdk/primitives/Hash'
import { hash } from 'crypto'
import { toArray } from '@bsv/sdk/primitives/utils'
BountyContract.loadArtifact(bountyContractJson)

function verifyTruthy<T>(v: T | undefined): T {
  if (v == null) throw new Error('must have value')
  return v
}

// For signature verification
const anyoneWallet = new ProtoWallet('anyone')


// Main wallet for transactions
const walletClient = new WalletClient('auto', 'localhost')

async function testBountyAddFunds() {
  try {
    console.log('Starting BountyContract add funds test...')

    // 1. First, create a new bounty contract

    const repoOwnerPublicKeyHex = (await walletClient.getPublicKey({
      protocolID: [0, 'bounty'],
      keyID: '1',
      counterparty: 'self',
      forSelf: true
    })).publicKey



    const repoOwnerPublicKey = bsv.PublicKey.fromString(repoOwnerPublicKeyHex)

    console.log('Compressed: ', bsv.PublicKey.fromString(repoOwnerPublicKeyHex).compressed)

    const repoOwnerName = 'test-owner'
    const repoName = 'test-repo'
    const issueNumber = 123
    const issueTitle = 'Test Issue'

    // Initial funding amount
    const initialFunding = 1000 // satoshis
    
    // Create signature for the bounty
    
    console.log('Creating bounty contract...')
    let bounty = new BountyContract(
      PubKey(repoOwnerPublicKey.toByteString()),
      toByteString(repoOwnerName, true),
      toByteString(repoName, true),
      BigInt(issueNumber),
      toByteString(issueTitle, true)
    )

    
    // Deploy the initial contract
    const lockingScript = bounty.lockingScript.toHex()
    
    const { txid, tx } = await walletClient.createAction({
      outputs: [{
        lockingScript: lockingScript,
        satoshis: initialFunding,
        outputDescription: 'Initial Bounty Contract'
      }],
      description: `Create bounty for ${repoOwnerName}/${repoName}#${issueNumber}`
    })

    
    if (!tx) {
      throw new Error('Transaction is undefined after contract creation')
    }
    
    console.log(`Bounty contract created with txid: ${txid}`)
    console.log(`Initial funding: ${initialFunding} satoshis`)
    
    // Broadcast the transaction to the topic manager
    const broadcaster = new TopicBroadcaster(['tm_bounty'], { networkPreset: 'local' })
    let broadcasterResult = await broadcaster.broadcast(Transaction.fromAtomicBEEF(tx))
    
    if (broadcasterResult.status === 'error') {
      throw new Error(`Transaction failed to broadcast: ${broadcasterResult.description}`)
    }
    
    console.log('Initial contract successfully broadcast to topic manager')
    
    // Convert transaction to format needed for later operations



    const atomicBeefTX = Utils.toHex(tx)
    // Wait a moment to ensure the transaction is processed
    
    // ------------------------------
    // 2. Test addFunds function
    // ------------------------------
    console.log('\nTesting addFunds function...')
    
    // Amount of funds to add - this will be passed as a parameter to addFunds

    const additionalFunds = BigInt(5000) // satoshis
    const newTotalFunds = initialFunding + Number(additionalFunds)


    // Create a BSV Transaction for sCrypt Smart Contract usage

    // Parsed Bounty TX returns transaction
    const parsedFromTx = Transaction.fromAtomicBEEF(Utils.toArray(tx, 'base64'))

    let index = 0
    let bountyScript = parsedFromTx.outputs[0].lockingScript

    if(parsedFromTx.outputs[0].satoshis !== Number(1000)) {
      bountyScript = parsedFromTx.outputs[1].lockingScript
      index = 1
    }

    console.log(parsedFromTx.outputs)

    const existingBounty: BountyContract = BountyContract.fromLockingScript(
      bountyScript.toHex()
    ) as BountyContract

    console.log("Contract repoOwnerPublicKey", repoOwnerPublicKey)

    const unlockingScript = await existingBounty.getUnlockingScript(
      async (self: BountyContract) => {
        // Create the spending transaction

        debugger
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: parsedFromTx.id('hex'),
          outputIndex: index,
          script: bountyScript.toHex(),
          satoshis: initialFunding
        })
        
        // Add output with increased satoshi value
        bsvtx.addOutput(
          new bsv.Transaction.Output({
            script: bounty.lockingScript, // Same locking script since contract state doesn't change
            satoshis: newTotalFunds // The new total with added funds
          })
        )

        const hashType =
          bsv.crypto.Signature.SIGHASH_ALL |
          bsv.crypto.Signature.SIGHASH_FORKID

        const hashBuf = bsv.crypto.Hash.sha256(bsv.Transaction.Sighash.sighashPreimage(
          bsvtx,
          hashType,
          0,
          bsv.Script.fromBuffer(Buffer.from(bountyScript.toHex(), 'hex')),
          new bsv.crypto.BN(initialFunding)))
        

        const { signature: SDKSignature } = await walletClient.createSignature({
          protocolID: [0, 'bounty'],
          keyID: '1',
          counterparty: 'self',
          data: Array.from(hashBuf)
        })

        const signature = bsv.crypto.Signature.fromString(Buffer.from(SDKSignature).toString('hex'))
        signature.nhashtype = hashType
        const signatureHex = signature.toTxFormat().toString('hex')

        // Set transaction context for the smart contract call
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: new bsv.Transaction(parsedFromTx.toHex()), outputIndex: index }
        
        // Call the addFunds method with explicit amount parameter
        await self.methods.addFunds(Sig(toByteString(signatureHex)), additionalFunds)
      }
    )
    
    // Prepare and send the transaction
    const addFundsAction = await walletClient.createAction({
      inputs: [
        {
          inputDescription: 'Add funds to bounty contract',
          outpoint: `${txid}.0`,
          unlockingScript: unlockingScript.toHex()
        }
      ],
      inputBEEF: Utils.toArray(atomicBeefTX, 'hex'),
      outputs: [
        {
          lockingScript: lockingScript, // Same locking script since state doesn't change
          satoshis: newTotalFunds, // The new total amount with added funds
          outputDescription: 'Updated Bounty Contract with more funds'
        }
      ],
      description: `Adding ${additionalFunds} satoshis to bounty, new total: ${newTotalFunds}`,
      options: { acceptDelayedBroadcast: false, randomizeOutputs: false }
    })
    
    if (!addFundsAction.tx) {
      throw new Error('Transaction is undefined after adding funds')
    }
    
    // Broadcast the addFunds transaction
    const addFundsTx = Transaction.fromAtomicBEEF(addFundsAction.tx)
    const addFundsTxid = addFundsTx.id('hex')
    
    broadcasterResult = await broadcaster.broadcast(addFundsTx)
    
    if (broadcasterResult.status === 'error') {
      throw new Error(`addFunds transaction failed to broadcast: ${broadcasterResult.description}`)
    }
    
    console.log(`Successfully added funds to bounty. New txid: ${addFundsTxid}`)
    console.log(`Added amount: ${additionalFunds} satoshis`)
    console.log(`New total balance: ${newTotalFunds} satoshis`)
    
    console.log('\nBountyContract addFunds test completed successfully!')
    debugger
    return {
      createTxid: txid,
      addFundsTxid: addFundsTxid,
      initialFunding,
      additionalFunds: Number(additionalFunds),
      newTotalFunds
    }

  } catch (error) {
    console.error('Error in bounty function tests:', error)
    throw error
  }
}

// Run the test
testBountyAddFunds()
  .then(results => {
    console.log('Test completed with the following details:')
    console.log(JSON.stringify(results, null, 2))
    process.exit(0)
  })
  .catch(err => {
    console.error('Test failed:', err)
    process.exit(1)
  })