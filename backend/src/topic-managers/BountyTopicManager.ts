import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, Utils, PublicKey, Script, PushDrop, ProtoWallet} from '@bsv/sdk'
import bountyContractJson from '../../artifacts/BountyContract.json' with { type: 'json' }
import { BountyContract } from '../contracts/BountyContract.js'
BountyContract.loadArtifact(bountyContractJson)

const anyoneWallet = new ProtoWallet('anyone')

export default class BountyTopicManager implements TopicManager {
  /**
   * Identifies which outputs in a transaction contain valid bounty contracts
   * 
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns Instructions on which outputs to admit and which coins to retain
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    const admissibleOutputs: number[] = [];

    try {
      const decodedTx = Transaction.fromBEEF(beef)
      const outputs = decodedTx.outputs

      // 1. First, check if this transaction interacts with existing bounty contracts
      // If previousCoins is non-empty, this is likely updating or claiming a bounty
      if (previousCoins.length > 0) {
        return {
          outputsToAdmit: previousCoins,
          coinsToRetain: previousCoins
        }
      }

      // 2. For new transactions, check each output for valid bounty contract creation
      for (const [index, output] of outputs.entries()) {
        try {
          // Using pushdrop to decode the script
          //const decodedScript = PushDrop.decode(output.lockingScript)

          const bounty = BountyContract.fromLockingScript(output.lockingScript.toHex()) as BountyContract

          // Verify repo owner signature
          const verifyResult = await anyoneWallet.verifySignature({
            protocolID: [0, 'bounty'],
            keyID: '1',
            counterparty: bounty.repoOwnerKey,
            data: [1],
            signature: Utils.toArray(bounty.repoOwnerSig, 'hex')
          })
          console.log(verifyResult)
          if (verifyResult.valid !== true) {
            throw new Error('Signature invalid')
          }
          // I would add certserversig verification here as well
          //const fields = decodedScript.fields
          
          /*
          // Validate expected fields for a bounty
          // 1. Repository owner 
          if (!fields[0] || fields[0].length === 0) continue
          
          // 2. Repository name
          if (!fields[1] || fields[1].length === 0) continue
          
          // 3. Issue number
          const issueNumber = parseInt(fields[2].toString(), 10)
          if (isNaN(issueNumber) || issueNumber <= 0) continue
          
          // 4. Bounty amount
          const amount = parseInt(fields[3].toString(), 10)
          if (isNaN(amount) || amount <= 0) continue
          
          // 5. Funder's public key
          if (!fields[4] || fields[4].length === 0) continue
          
          try {
            // Validate public key format
            //PublicKey.fromString(fields[4].toString('utf8'))
          } catch {
            continue
          } */
          
          // Valid bounty format - add to admissible outputs
          admissibleOutputs.push(index)
          console.log(`Topic Manager: Valid bounty found at output ${index}`)
        } catch (error) {
          console.log(`Topic Manager: Error processing output ${index}:`, error)
          continue
        }
      }
      if (admissibleOutputs.length === 0) {
        console.warn('No outputs admitted!')
        // throw new ERR_BAD_REQUEST('No outputs admitted!')
      }
    } catch (error) {
      const beefStr = JSON.stringify(beef, null, 2)
      console.error('Topic Manager: Error identifying admissible outputs:', error, " beef: ", beefStr)
    }

    return {
      outputsToAdmit: admissibleOutputs,
      coinsToRetain: previousCoins
    }
  }

  /**
   * Returns documentation for this topic manager
   */
  async getDocumentation(): Promise<string> {
    return `
    # GitHub Bounty Topic Manager
    
    This topic manager processes transactions related to GitHub bounties.
    
    ## Supported Transaction Types
    
    1. **Bounty Creation**: Create a new bounty for a GitHub issue
    2. **Fund Addition**: Add more funds to an existing bounty
    3. **Bounty Claim**: Claim funds for solving an issue
    4. **Withdrawal**: Repository owner withdrawing bounty funds
    
    ## Data Structure
    
    The bounty transactions contain the following data:
    - Repository owner and certification authority public keys
    - GitHub repository owner name
    - GitHub repository name 
    - GitHub issue number
    - Bounty amount in satoshis
    `
  }

  /**
   * Returns metadata about this topic manager
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'GitHub Bounty Topic Manager',
      shortDescription: 'Processes transactions for GitHub issue bounties',
      version: '1.0.0',
      informationURL: 'https://github.com/yourusername/github-bounties'
    }
  }
}