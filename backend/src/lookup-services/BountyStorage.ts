// backend/src/lookup-services/BountyStorage.ts
import { Collection, Db } from 'mongodb'
import { BountyReference, RepoIssueReference, UTXOReference } from '../types/bounty.js'

/**
 * Storage class for managing bounty records
 */
export class BountyStorage {
  private readonly bounties: Collection<BountyReference>

  /**
   * Constructs a new BountyStorage instance
   * @param {Db} db - connected mongo database instance
   */
  constructor(private readonly db: Db) {
    this.bounties = db.collection<BountyReference>('GitHubBounties')
  }

  /**
   * Stores a bounty record in the database
   */
  async storeBounty(
    repoOwnerKey: string,
    repoOwnerSig: string,
    repoOwnerName: string,
    repoName: string,
    issueNumber: number,
    issueTitle: string,
    txid: string,
    outputIndex: number,
    status: string,
    createdAt: Date,
    description: string
  ): Promise<void> {
    console.log("Storing bounty in MongoDB:", {
      repoOwnerKey,
      repoOwnerName,
      repoName,
      issueNumber,
      txid,
      outputIndex,
      issueTitle,
      status,
      createdAt,
      description
    })
    
    try {
      await this.bounties.insertOne({
        repoOwnerKey,
        repoOwnerSig,
        repoOwnerName,
        repoName,
        issueNumber,
        txid,
        outputIndex,
        issueTitle,
        status,
        createdAt,
        description
      })
    } catch (error) {
      console.error("Failed to store bounty record:", error)
      throw error
    }
  }

  /**
   * Updates a bounty's status
   */
  async updateBountyStatus(txid: string, outputIndex: number, status: string): Promise<void> {
    await this.bounties.updateOne(
      { txid, outputIndex },
      { 
        $set: { 
          status, 
          updatedAt: new Date() 
        } 
      }
    )
  }

  /**
   * Updates a bounty's solver information
   */
  async updateBountySolver(txid: string, outputIndex: number, solver: string, solverPublicKey: string): Promise<void> {
    await this.bounties.updateOne(
      { txid, outputIndex },
      { 
        $set: { 
          solver,
          solverPublicKey,
          status: 'in-progress',
          updatedAt: new Date() 
        } 
      }
    )
  }

  /**
   * Delete a bounty record
   */
  async deleteBounty(txid: string, outputIndex: number): Promise<number> {
    const result = await this.bounties.deleteMany({ txid, outputIndex })
    return result.deletedCount
  }

  async findAll(): Promise<UTXOReference[]> {
    return await this.bounties.find({})
      .project<UTXOReference>({ txid: 1, outputIndex: 1 })
      .toArray()
      .then(results => results.map(record => ({
        txid: record.txid,
        outputIndex: record.outputIndex
      })))
  }

  /**
   * Returns all bounties
   */
  async findAllBounties(): Promise<BountyReference[]> {
    return await this.bounties.find({})
      .project<BountyReference>({
        repoOwnerKey: 1,
        repoOwnerSig: 1,
        repoOwnerName: 1,
        repoName: 1,
        issueNumber: 1,
        issueTitle: 1,
        status: 1,
        txid: 1,
        outputIndex: 1
      })
      .toArray()
  }

  /**
   * Returns all bounties for a specific repo
   */
  async findBountiesByRepo(repoOwnerKey: string, repoName: string): Promise<BountyReference[]> {
    return await this.bounties.find({ repoOwnerKey, repoName })
      .project<BountyReference>({
        repoOwnerKey: 1,
        repoName: 1,
        issueNumber: 1,
        issueTitle: 1,
        amount: 1,
        status: 1,
        txid: 1,
        outputIndex: 1
      })
      .toArray()
  }

  /**
   * Returns all bounties for a specific issue
   */
  async findBountiesByIssue(repoOwnerKey: string, repoName: string, issueNumber: number): Promise<BountyReference[]> {
    return await this.bounties.find({ repoOwnerKey, repoName, issueNumber })
      .toArray()
  }

  /**
   * Returns all bounties funded by a specific user
   */
  async findBountiesByFunder(funderPublicKey: string): Promise<BountyReference[]> {
    return await this.bounties.find({ funderPublicKey })
      .project<BountyReference>({
        repoOwnerKey: 1,
        repoName: 1,
        issueNumber: 1,
        issueTitle: 1,
        amount: 1,
        status: 1,
        txid: 1,
        outputIndex: 1
      })
      .toArray()
  }

  /**
   * Returns detailed information about a specific bounty
   */
  async findBountyDetails(txid: string, outputIndex: number): Promise<BountyReference[]> {
    return await this.bounties.find({ txid, outputIndex })
      .toArray()
  }

  /**
   * Returns a list of repositories with bounties
   */
  async findReposWithBounties(): Promise<RepoIssueReference[]> {
    const repos = await this.bounties.aggregate([
      {
        $group: {
          _id: { repoOwnerKey: "$repoOwnerKey", repoName: "$repoName" },
          totalBounties: { $sum: 1 },
          totalAmount: { $sum: "$amount" }
        }
      },
      {
        $project: {
          _id: 0,
          repoOwnerKey: "$_id.repoOwnerKey",
          repoName: "$_id.repoName",
          totalBounties: 1,
          totalAmount: 1
        }
      }
    ]).toArray()
    
    return repos as RepoIssueReference[]
  }
}