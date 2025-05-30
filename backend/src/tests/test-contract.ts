// test-bounty.js
import { WalletClient, TopicBroadcaster, Utils, PushDrop, Transaction} from '@bsv/sdk';
import bountyContractJson from '../../artifacts/BountyContract.json' with { type: 'json' }
import { BountyContract } from '../contracts/BountyContract.js'
import { bsv, toByteString, PubKey, Sig } from 'scrypt-ts'
BountyContract.loadArtifact(bountyContractJson)

async function createAndBroadcastBounty() {
  try {
    debugger
    // Initialize the wallet
    const wallet = new WalletClient('auto', 'localhost');
    debugger
    // Sample bounty data
    const repoOwnerName = 'Ishaan Lahoti';
    const repoName = 'Pooop-generator';
    const repoOwnerKey = (await wallet.getPublicKey({ identityKey: true })).publicKey;
    const issueTitle = 'Poop in the sink';
    const issueNumber = 69;
    const description = 'The topic manager is slow when processing large transactions';

    
    const signature = Utils.toHex(
      (
        await wallet.createSignature({
          data: [1],
          protocolID: [0, 'bounty'],
          keyID: '1',
          counterparty: 'anyone'
        })
      ).signature
    )
    
    const bounty = new BountyContract(
      PubKey(repoOwnerKey),
      toByteString(repoOwnerName, true),
      toByteString(repoName, true),
      BigInt(issueNumber),
      toByteString(issueTitle, true),
    )
    //bounty.addFunds(Sig(signature), 10000n)

    const lockingScript = bounty.lockingScript.toHex()
    
    // Create the transaction
    const { txid, tx } = await wallet.createAction({
      outputs: [{
        lockingScript: lockingScript,
        satoshis: 6969, // Dust limit plus a bit extra
        outputDescription: 'GitHub Bounty'
      }],
      description: `Create bounty for ${repoOwnerName}/${repoName}#${issueNumber}`
    });
    
    console.log(`Transaction created with txid: ${txid}`);
    
    // Broadcast the transaction to the topic manager
    const broadcaster = new TopicBroadcaster(['tm_bounty'], { networkPreset: 'local' });
    //const broadcaster = new TopicBroadcaster(['tm_bounty'], {
      //networkPreset: window.location.hostname === 'localhost' ? 'local' : 'mainnet'
  //})
    await broadcaster.broadcast(Transaction.fromAtomicBEEF(tx!));
    
    console.log(`Transaction broadcast to topic manager successfully`);
    
    return txid;
  } catch (error) {
    console.error('Error creating or broadcasting bounty:', error);
    throw error;
  }
}

createAndBroadcastBounty()
  .then(txid => console.log(`Test complete! Bounty created with txid: ${txid}`))
  .catch(err => console.error('Test failed:', err));