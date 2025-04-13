// frontend/src/services/BountyService.ts
import { WalletClient, TopicBroadcaster, PushDrop, Transaction, Utils, LookupResolver, ProtoWallet } from '@bsv/sdk';
import { toast } from 'react-toastify';
import { CreateBountyParams, Bounty, BountyReference, Token } from '../types/types';
import { BountyContract, BountyArtifact } from '@bsv/backend';
import { parse } from 'path';

BountyContract.loadArtifact(BountyArtifact);

// BountyService class handles blockchain operations for bounties
export class BountyService {
  private walletClient: WalletClient;
  private topicBroadcaster: TopicBroadcaster;
  private lookupResolver: LookupResolver;
  private anyoneWallet: ProtoWallet;

 

  constructor() {
    this.walletClient = new WalletClient('auto', 'localhost');
    this.topicBroadcaster = new TopicBroadcaster(['tm_bounty'], { 
      networkPreset: 'local'
    });
    this.lookupResolver = new LookupResolver({ 
      networkPreset: 'local'
    });
    this.anyoneWallet = new ProtoWallet('anyone');
  }

  /**
   * Create and broadcast a bounty to the overlay network
   */
  async createAndBroadcastBounty(
    repoOwner: string,
    repoName: string,
    issueNumber: number,
    amount: number,
    issueTitle: string,
    description: string
  ): Promise<string> {
    try {
      // Get the funder's public key
      const { publicKey: funderPublicKey } = await this.walletClient.getPublicKey({ 
        identityKey: true 
      });
      console.log(repoOwner)
      console.log(repoName)
      console.log(issueNumber.toString())
      console.log(amount.toString())
      // Create fields for the pushdrop - with proper string encoding
      const fields = [
        Utils.toArray(repoOwner, 'utf8'),
        Utils.toArray(repoName, 'utf8'),
        Utils.toArray(issueNumber.toString(), 'utf8'),
        Utils.toArray(amount.toString(), 'utf8'),
        Utils.toArray(funderPublicKey, 'utf8'),
        Utils.toArray(issueTitle, 'utf8'),
        Utils.toArray(description, 'utf8')
      ];
      console.log(fields);
      // Create the pushdrop
      const pushdrop = new PushDrop(this.walletClient);
      const lockingScript = await pushdrop.lock(
        fields,
        [2, 'githubbounty'],
        '1',
        'anyone',
        true
      );
      
      // Create the transaction
      const { txid, tx } = await this.walletClient.createAction({
        outputs: [{
          lockingScript: lockingScript.toHex(),
          satoshis: amount, // Use the actual bounty amount
          outputDescription: 'GitHub Bounty'
        }],
        description: `Create bounty for ${repoOwner}/${repoName}#${issueNumber}`
      });
      
      if (!txid || !tx) {
        throw new Error('Failed to create transaction');
      }
      
      // Broadcast to the topic manager
      await this.topicBroadcaster.broadcast(Transaction.fromAtomicBEEF(tx));
      
      console.log(`Bounty created with txid: ${txid}`);
      return txid;
    } catch (error) {
      console.error('Error creating or broadcasting bounty:', error);
      throw error;
    }
  }

  /**
   * Query all bounties from the lookup service and parse them
   */
  async getAllBounties(): Promise<BountyReference[]> {
    let lookupResult: any = undefined
    try {
      lookupResult = await this.lookupResolver.query({
        service: 'ls_bounty',
        query: 'findAllBounties'
      });
      
      if (lookupResult.type !== 'freeform') {
        throw new Error('Unexpected response type');
      }
      
      
      //return response.result as BountyReference[];
    } catch (error) {
      console.error('Error querying bounties:', error);
      throw error;
    }

    const parsedResults: BountyReference[] = []

    for (const result of lookupResult.result) {
      try {
        const tx = Transaction.fromBEEF(result.beef)
        const script = tx.outputs[
          Number(result.outputIndex)
        ].lockingScript.toHex()
        const bounty = BountyContract.fromLockingScript(
          script
        ) as BountyContract

        console.log("Repo name:", bounty.repoName)
        console.log("Repo owner:", bounty.repoOwnerKey)

        // Verify signature using protowallet
        const verifyResult = await this.anyoneWallet.verifySignature({
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

        console.log('fetchMeters Transaction atomicBeefTX:', atomicBeefTX)

        parsedResults.push({
          repoOwner: bounty.repoOwnerKey,
          repoName: bounty.repoName,
          issueNumber: bounty.issueNumber,
          issueTitle: bounty.issueTitle,
          token: {
            atomicBeefTX,
            txid: tx.id('hex'),
            outputIndex: result.outputIndex,
            lockingScript: script,
            satoshis: tx.outputs[Number(result.outputIndex)].satoshis as number,
          } as Token
        })

      } catch (error) {
        console.error('Failed to load bounties', error)
        throw error
      }
    }

    return parsedResults

  }

  /**
   * Query bounties for a specific repository
   */
  async getBountiesByRepo(repoOwner: string, repoName: string): Promise<BountyReference[]> {
    try {
      const response = await this.lookupResolver.query({
        service: 'ls_bounty',
        query: {
          type: 'findByRepo',
          value: {
            repoOwner,
            repoName
          }
        }
      });
      
      if (response.type !== 'freeform') {
        throw new Error('Unexpected response type');
      }
      
      return response.result as BountyReference[];
    } catch (error) {
      console.error('Error querying repository bounties:', error);
      throw error;
    }
  }

  /**
   * Query bounties for a specific issue
   */
  async getBountiesByIssue(repoOwner: string, repoName: string, issueNumber: number): Promise<Bounty[]> {
    try {
      const response = await this.lookupResolver.query({
        service: 'ls_bounty',
        query: {
          type: 'findByIssue',
          value: {
            repoOwner,
            repoName,
            issueNumber
          }
        }
      });
      
      if (response.type !== 'freeform') {
        throw new Error('Unexpected response type');
      }
      
      return response.result as Bounty[];
    } catch (error) {
      console.error('Error querying issue bounties:', error);
      throw error;
    }
  }

  /**
   * Query repositories with bounties
   */
  async getReposWithBounties(): Promise<any[]> {
    try {
      const response = await this.lookupResolver.query({
        service: 'ls_bounty',
        query: 'findReposWithBounties'
      });
      
      if (response.type !== 'freeform') {
        throw new Error('Unexpected response type');
      }
      
      return response.result as any[];
    } catch (error) {
      console.error('Error querying repositories with bounties:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const bountyService = new BountyService();