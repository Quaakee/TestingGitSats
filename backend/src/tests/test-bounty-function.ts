// backend/src/tests/test-bounty-functions.ts
import { WalletClient, TopicBroadcaster, Transaction, Utils, ProtoWallet } from '@bsv/sdk';
import bountyContractJson from '../../artifacts/BountyContract.json' with { type: 'json' }
import { BountyContract } from '../contracts/BountyContract.js'
import { bsv, toByteString, PubKey, Sig, MethodCallOptions } from 'scrypt-ts'
BountyContract.loadArtifact(bountyContractJson)

// For signature verification
const anyoneWallet = new ProtoWallet('anyone')

// Main wallet for transactions
const walletClient = new WalletClient('auto', 'localhost')

debugger
async function testBountyFunctions() {
  try {
    console.log('Starting BountyContract function tests...')
    
    // 1. First, create a new bounty contract
    const repoOwnerPublicKey = (await walletClient.getPublicKey({ identityKey: true })).publicKey
    const repoOwnerName = 'test-owner'
    const repoName = 'test-repo'
    const issueNumber = 123
    const issueTitle = 'Test Issue'
    const initialBalance = 0
    
    // Create signature for the bounty
    const signature = Utils.toHex(
      (await walletClient.createSignature({
        data: [1],
        protocolID: [0, 'bounty'],
        keyID: '1',
        counterparty: 'anyone'
      })).signature
    )
    
    console.log('Creating bounty contract...')
    let bounty = new BountyContract(
      PubKey(repoOwnerPublicKey),
      toByteString(signature, false),
      toByteString(repoOwnerName, true),
      toByteString(repoName, true),
      BigInt(issueNumber),
      toByteString(issueTitle, true),
      BigInt(initialBalance)
    )
    
    // Deploy the initial contract
    const lockingScript = bounty.lockingScript.toHex()
    const initialFunding = 1000 // Initial minimal funding in satoshis
    
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
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // ------------------------------
    // 2. Test addFunds function
    // ------------------------------
    console.log('\nTesting addFunds function...')
    
    // Create new instance from the existing contract
    const existingBounty = BountyContract.fromLockingScript(lockingScript) as BountyContract
    
    // Create the next contract state with added funds
    const addAmount = 5000n
    const nextBounty = BountyContract.fromLockingScript(lockingScript) as BountyContract
    nextBounty.currentBalance = nextBounty.currentBalance + addAmount
    const nextScript = nextBounty.lockingScript
    
    // Create a BSV Transaction for sCrypt Smart Contract usage
    const parsedFromTx = new bsv.Transaction(transaction.toHex())
    
    // Create signature for addFunds function
    const addFundsSig = await walletClient.createSignature({
      data: [2], // Different data for this operation
      protocolID: [0, 'bounty'],
      keyID: '2',
      counterparty: 'anyone'
    })
    
    // Generate unlocking script
    const unlockingScript = await existingBounty.getUnlockingScript(
      async (self) => {
        // Create the spending transaction
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: txid!,
          outputIndex: 0,
          script: lockingScript,
          satoshis: initialFunding
        })
        
        // Add output with updated balance
        bsvtx.addOutput(
          new bsv.Transaction.Output({
            script: nextScript,
            satoshis: initialFunding + Number(addAmount)
          })
        )
        
        // Set transaction context for the smart contract call
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: parsedFromTx, outputIndex: 0 }
        
        // Call the addFunds method
        await (self as BountyContract).addFunds(
          Sig(Utils.toHex(addFundsSig.signature)),
          addAmount
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
          lockingScript: nextScript.toHex(),
          satoshis: initialFunding + Number(addAmount),
          outputDescription: 'Updated Bounty Contract with more funds'
        }
      ],
      description: 'Adding 5000 satoshis to bounty',
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
    console.log(`New balance: ${initialFunding + Number(addAmount)} satoshis`)
    
    // Update references for next operations
    const updatedScript = nextScript.toHex()
    const updatedSatoshis = initialFunding + Number(addAmount)
    
    // Wait a moment to ensure the transaction is processed
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // ------------------------------
    // 3. Test payBounty function
    // ------------------------------
    console.log('\nTesting payBounty function...')
    
    // Create another wallet to simulate the developer who receives payment
    const devWallet = new WalletClient()
    const devPublicKey = (await devWallet.getPublicKey({ identityKey: true })).publicKey
    
    // Create the next contract state after paying the bounty
    const payAmount = 3000n // Amount to pay the developer
    const afterPayBounty = BountyContract.fromLockingScript(updatedScript) as BountyContract
    afterPayBounty.currentBalance = BigInt(updatedSatoshis) - payAmount
    const afterPayScript = afterPayBounty.lockingScript
    
    // Get the current bounty contract from chain
    const currentBounty = BountyContract.fromLockingScript(updatedScript) as BountyContract
    
    // Create the transaction to parse
    const updatedTx = Transaction.fromBEEF(addFundsTx.toAtomicBEEF())
    const updatedFromTx = new bsv.Transaction(updatedTx.toHex())
    
    // Create signature for payBounty function
    const payBountySig = await walletClient.createSignature({
      data: [3], // Different data for payment operation
      protocolID: [0, 'bounty'],
      keyID: '3',
      counterparty: 'anyone'
    })
    
    // Generate unlocking script for payBounty
    const payUnlockingScript = await currentBounty.getUnlockingScript(
      async (self) => {
        // Create the spending transaction
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: addFundsTxid,
          outputIndex: 0,
          script: updatedScript,
          satoshis: updatedSatoshis
        })
        
        // First output to the developer
        const devPkh = bsv.crypto.Hash.sha256ripemd160(Buffer.from(devPublicKey, 'hex'))
        bsvtx.addOutput(
          new bsv.Transaction.Output({
            script: bsv.Script.buildPublicKeyHashOut(Buffer.from(devPkh).toString('hex')),
            satoshis: Number(payAmount)
          })
        )
        
        // Second output with remaining funds in the contract
        bsvtx.addOutput(
          new bsv.Transaction.Output({
            script: afterPayScript,
            satoshis: updatedSatoshis - Number(payAmount)
          })
        )
        
        // Set transaction context
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: updatedFromTx, outputIndex: 0 }
        
        // Call the payBounty method
        await (self as BountyContract).payBounty(
          Sig(Utils.toHex(payBountySig.signature)),
          PubKey(devPublicKey),
          payAmount
        )
      }
    )
    
    // Prepare and send the transaction
    const payBountyAction = await walletClient.createAction({
      inputs: [
        {
          inputDescription: 'Pay bounty to developer',
          outpoint: `${addFundsTxid}.0`,
          unlockingScript: payUnlockingScript.toHex()
        }
      ],
      inputBEEF: updatedTx.toBEEF(),
      outputs: [
        {
          // Payment to developer
          lockingScript: `76a914${bsv.crypto.Hash.sha256ripemd160(Buffer.from(devPublicKey, 'hex')).toString('hex')}88ac`,
          satoshis: Number(payAmount),
          outputDescription: 'Payment to developer'
        },
        {
          // Remaining balance in contract
          lockingScript: afterPayScript.toHex(),
          satoshis: updatedSatoshis - Number(payAmount),
          outputDescription: 'Remaining contract balance'
        }
      ],
      description: 'Paying bounty to developer',
      options: { acceptDelayedBroadcast: false, randomizeOutputs: false }
    })
    
    if (!payBountyAction.tx) {
      throw new Error('Transaction is undefined after paying bounty')
    }
    
    // Broadcast the payBounty transaction
    const payBountyTx = Transaction.fromAtomicBEEF(payBountyAction.tx)
    const payBountyTxid = payBountyTx.id('hex')
    
    broadcasterResult = await broadcaster.broadcast(payBountyTx)
    
    if (broadcasterResult.status === 'error') {
      throw new Error(`payBounty transaction failed to broadcast: ${broadcasterResult.description}`)
    }
    
    console.log(`Successfully paid bounty to developer. Transaction ID: ${payBountyTxid}`)
    console.log(`Payment amount: ${payAmount} satoshis`)
    console.log(`Remaining in contract: ${updatedSatoshis - Number(payAmount)} satoshis`)
    
    // Update references for withdraw operation
    const remainingScript = afterPayScript.toHex()
    const remainingSatoshis = updatedSatoshis - Number(payAmount)
    
    // Wait a moment to ensure the transaction is processed
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // ------------------------------
    // 4. Test withdraw function
    // ------------------------------
    console.log('\nTesting withdraw function...')
    
    // Get the current bounty contract
    const remainingBounty = BountyContract.fromLockingScript(remainingScript) as BountyContract
    
    // Create signature for withdraw function
    const withdrawSig = await walletClient.createSignature({
      data: [4], // Different data for withdrawal operation
      protocolID: [0, 'bounty'],
      keyID: '4',
      counterparty: 'anyone'
    })
    
    // The withdrawal amount will be all remaining funds
    const withdrawAmount = BigInt(remainingSatoshis)
    
    // Get the transaction for parsing
    const remainingTx = Transaction.fromBEEF(payBountyTx.toAtomicBEEF())
    const remainingFromTx = new bsv.Transaction(remainingTx.toHex())
    
    // Generate unlocking script for withdraw
    const withdrawUnlockingScript = await remainingBounty.getUnlockingScript(
      async (self) => {
        // Create the spending transaction
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
          txId: payBountyTxid,
          outputIndex: 1, // The contract is at output index 1 after paying the bounty
          script: remainingScript,
          satoshis: remainingSatoshis
        })
        
        // Output to the repository owner
        const ownerPkh = bsv.crypto.Hash.sha256ripemd160(Buffer.from(repoOwnerPublicKey, 'hex'))
        bsvtx.addOutput(
          new bsv.Transaction.Output({
            script: bsv.Script.buildPublicKeyHashOut(Buffer.from(ownerPkh).toString('hex')),
            satoshis: Number(withdrawAmount)
          })
        )
        
        // Set transaction context
        self.to = { tx: bsvtx, inputIndex: 0 }
        self.from = { tx: remainingFromTx, outputIndex: 1 } // Important: output index 1
        
        // Call the withdraw method
        await (self as BountyContract).withdraw(
          Sig(Utils.toHex(withdrawSig.signature)),
          withdrawAmount
        )
      }
    )
    
    // Prepare and send the withdraw transaction
    const withdrawAction = await walletClient.createAction({
      inputs: [
        {
          inputDescription: 'Withdraw remaining funds',
          outpoint: `${payBountyTxid}.1`, // Important: output index 1
          unlockingScript: withdrawUnlockingScript.toHex()
        }
      ],
      inputBEEF: remainingTx.toBEEF(),
      outputs: [
        {
          // Payment to repository owner
          lockingScript: `76a914${bsv.crypto.Hash.sha256ripemd160(Buffer.from(repoOwnerPublicKey, 'hex')).toString('hex')}88ac`,
          satoshis: Number(withdrawAmount),
          outputDescription: 'Withdraw to repository owner'
        }
      ],
      description: 'Withdrawing remaining funds from bounty',
      options: { acceptDelayedBroadcast: false, randomizeOutputs: false }
    })
    
    if (!withdrawAction.tx) {
      throw new Error('Transaction is undefined after withdrawal')
    }
    
    // Broadcast the withdraw transaction
    const withdrawTx = Transaction.fromAtomicBEEF(withdrawAction.tx)
    const withdrawTxid = withdrawTx.id('hex')
    
    broadcasterResult = await broadcaster.broadcast(withdrawTx)
    
    if (broadcasterResult.status === 'error') {
      throw new Error(`withdraw transaction failed to broadcast: ${broadcasterResult.description}`)
    }
    
    console.log(`Successfully withdrawn remaining funds. Transaction ID: ${withdrawTxid}`)
    console.log(`Withdrawn amount: ${withdrawAmount} satoshis`)
    
    console.log('\nAll BountyContract function tests completed successfully!')
    return {
      createTxid: txid,
      addFundsTxid: addFundsTxid,
      payBountyTxid: payBountyTxid,
      withdrawTxid: withdrawTxid
    }
    
  } catch (error) {
    console.error('Error in bounty function tests:', error)
    throw error
  }
}

// Run the tests
testBountyFunctions()
  .then(results => {
    console.log('Test completed with the following transaction IDs:')
    console.log(JSON.stringify(results, null, 2))
  })
  .catch(err => {
    console.error('Tests failed:', err)
    process.exit(1)
  })