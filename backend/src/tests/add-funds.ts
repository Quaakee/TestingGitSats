// backend/tests/test-bounty-add-funds.ts
import { WalletClient, TopicBroadcaster, Transaction, Utils, ProtoWallet, ECDSA } from '@bsv/sdk'
import bountyContractJson from '../../artifacts/BountyContract.json' with { type: 'json' }
import { BountyContract } from '../../src/contracts/BountyContract.js'
import { bsv, toByteString, PubKey, Sig, findSig } from 'scrypt-ts'
BountyContract.loadArtifact(bountyContractJson)

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
      counterparty: 'anyone'
    })).publicKey


    const repoOwnerPublicKey = PubKey(bsv.PublicKey.fromString(repoOwnerPublicKeyHex).toByteString())

    const repoOwnerName = 'test-owner'
    const repoName = 'test-repo'
    const issueNumber = 123
    const issueTitle = 'Test Issue'

    // Initial funding amount
    const initialFunding = 1000 // satoshis
    
    // Create signature for the bounty
    
    console.log('Creating bounty contract...')
    let bounty = new BountyContract(
      repoOwnerPublicKey,
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
    const transaction = Transaction.fromAtomicBEEF(tx)
    const atomicBeefTX = Utils.toHex(tx)
    
    // Wait a moment to ensure the transaction is processed
    
    // ------------------------------
    // 2. Test addFunds function
    // ------------------------------
    console.log('\nTesting addFunds function...')
    
    // Amount of funds to add - this will be passed as a parameter to addFunds
    const additionalFunds = BigInt(5000) // satoshis
    const newTotalFunds = initialFunding + Number(additionalFunds)

    debugger
    // Create a BSV Transaction for sCrypt Smart Contract usage


    const parsedFromTx = Transaction.fromAtomicBEEF(Utils.toArray(tx, 'base64'))
    const offerScript = parsedFromTx.outputs[0].lockingScript

    console.log(parsedFromTx.outputs)

    const existingBounty: BountyContract = BountyContract.fromLockingScript(
      offerScript.toHex()
    ) as BountyContract
    

    const sigKeyInfo = await walletClient.getPublicKey({
      protocolID: [0, 'bounty'],
      keyID: '1',
      counterparty: 'anyone'
    })

    console.log("Contract repoOwnerPublicKey", repoOwnerPublicKey)
    console.log("Signature used publickey: ", sigKeyInfo.publicKey)


    const unlockingScript = await existingBounty.getUnlockingScript(
      async (self: BountyContract) => {
        // Create the spending transaction

        debugger
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: txid!,
          outputIndex: 0,
          script: offerScript.toHex(),
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

          const hashBuf = bsv.Transaction.Sighash.sighashPreimage(
            bsvtx,
            hashType,
            0,
            bsv.Script.fromBuffer(Buffer.from(offerScript.toHex(), 'hex')),
            new bsv.crypto.BN(initialFunding)
          )
        
        const { signature: SDKSignature } = await walletClient.createSignature({
          protocolID: [0, 'bounty'],
          keyID: '1',
          counterparty: 'anyone',
          data: Array.from(hashBuf)
        })

        const formattedSig = bsv.crypto.Signature.fromString(Buffer.from(SDKSignature).toString('hex'))
        formattedSig.nhashtype = hashType
        const finalSigHex = formattedSig.toTxFormat().toString('hex')


        // Set transaction context for the smart contract call
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: new bsv.Transaction(parsedFromTx.toHex()), outputIndex: 0 }
        
        // Call the addFunds method with explicit amount parameter
        await self.addFunds(
          Sig(toByteString(finalSigHex)),
          additionalFunds // Pass the amount to add as parameter
        )
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