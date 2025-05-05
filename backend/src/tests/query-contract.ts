// backend/tests/test-query.ts
import { LookupResolver, ProtoWallet, Transaction, Utils, LookupAnswer } from '@bsv/sdk'
import { BountyReference } from '../types/bounty.js'
import bountyContractJson from '../../artifacts/BountyContract.json' with { type: 'json' }
import { BountyContract } from '../contracts/BountyContract.js'
import { bsv, toByteString, PubKey, fromByteString} from 'scrypt-ts'
BountyContract.loadArtifact(bountyContractJson)

async function queryBounties(): Promise<BountyReference[]> {
  try {
    const anyoneWallet = new ProtoWallet('anyone')
    const lookupResolver = new LookupResolver({ networkPreset: 'local' });
    
    // Query all bounties
    const lookupResult = await lookupResolver.query({
      service: 'ls_bounty',
      query: 'findAll'
    });
    
    debugger
    if (lookupResult.type !== 'output-list') {
      throw new Error('Unexpected response type');
    }

    const parsedResults: BountyReference[] = []

    for (const result of lookupResult.outputs) {
      try {
        const tx = Transaction.fromBEEF(result.beef)
        const output = tx.outputs[Number(result.outputIndex)];
        const script = output.lockingScript.toHex();
        const balance = output.satoshis
        const bounty = BountyContract.fromLockingScript(
          script
        ) as BountyContract


        console.log("Repo name:", bounty.repoName)
        console.log("Repo owner:", bounty.repoOwnerName)
        console.log("Contract balance: ", balance)

        // Verify signature using protowallet
        const verifyResult = await anyoneWallet.verifySignature({
          protocolID: [0, 'bounty'],
          keyID: '1',
          counterparty: bounty.repoOwnerKey,
          data: [1],
          signature: Utils.toArray(bounty.repoOwnerSig, 'hex')
        })

        if (!verifyResult.valid) {
          throw new Error('Signature invalid')
        }

        const atomicBeefTX = Utils.toHex(tx.toAtomicBEEF())

        //console.log('fetchMeters Transaction atomicBeefTX:', atomicBeefTX)

        parsedResults.push({
          repoOwnerKey: bounty.repoOwnerKey,
          repoOwnerSig: bounty.repoOwnerSig,
          repoOwnerName: fromByteString(bounty.repoOwnerName),
          repoName: fromByteString(bounty.repoName),
          issueNumber: Number(bounty.issueNumber),
          issueTitle: fromByteString(bounty.issueTitle),
          txid: tx.id('hex'),
          outputIndex: result.outputIndex,
          status: 'open',
          createdAt: new Date(),
          description: 'Test description bussy'
        })

      } catch (error) {
        console.error('Failed to load bounties', error)
        throw error
      }
    }
    console.log(parsedResults)
    return parsedResults as BountyReference[]
    debugger
  } catch (error) {
    console.error('Error querying bounties:', error);
    throw error;
  }
}

queryBounties()
  .then(parsedResults => console.log(`Query complete! Found ${parsedResults.length} bounties`))
  .catch(err => console.error('Query failed:', err));