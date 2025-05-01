import {
    assert,
    SmartContract,
    prop,
    method,
    hash256,
    Utils,
    pubKey2Addr,
    SigHash,
    ByteString,
    PubKey,
    Sig
} from 'scrypt-ts'

/**
 * A smart contract for GitHub issue bounties.
 * 
 * This contract allows:
 * - Adding funds to a specific GitHub issue
 * - Paying out the full bounty to a developer
 * - Allowing the repo owner to withdraw unclaimed funds
 */
export class BountyContract extends SmartContract {
    // Static (unchanging) properties
    @prop()
    repoOwnerKey: PubKey

    @prop(true)
    repoOwnerName: ByteString

    @prop(true)
    repoName: ByteString

    @prop(true)
    issueNumber: bigint

    @prop(true)
    issueTitle: ByteString

    constructor(
        repoOwnerKey: PubKey,
        repoOwnerName: ByteString,
        repoName: ByteString,
        issueNumber: bigint,
        issueTitle: ByteString
    ) {
        super(...arguments)
        this.repoOwnerKey = repoOwnerKey
        this.repoOwnerName = repoOwnerName
        this.repoName = repoName
        this.issueNumber = issueNumber
        this.issueTitle = issueTitle
    }

    /**
     * Add more funds to the contract. The sender must be the repo owner.
     */
    @method(SigHash.ALL)
    public addFunds(sig: Sig) {
        // Verify the repo owner signed this
        assert(this.checkSig(sig, this.repoOwnerKey), 'Only repo owner can add funds')

        // New contract output must match updated balance
        const newBalance = this.ctx.utxo.value  // The input UTXO (contract)
        const outputs = this.buildStateOutput(newBalance)

        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }

    /**
     * Pay the full bounty to a developer who completed the GitHub issue.
     */
    @method(SigHash.ANYONECANPAY_ALL)
    public payBounty(
        repoOwnerSig: Sig,
        userPubKey: PubKey
    ) {
        // Must be signed by repo owner
        assert(
            this.checkSig(repoOwnerSig, this.repoOwnerKey),
            'Invalid repo owner signature'
        )

        // Optional: Add identity verification logic here (e.g., from cert server)

        const bountyAmount = this.ctx.utxo.value

        // Pay the developer full bounty amount
        const devAddr = pubKey2Addr(userPubKey)
        const outputs = Utils.buildPublicKeyHashOutput(devAddr, bountyAmount)

        // No change or remaining funds — full payout
        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }

    /**
     * Allow repo owner to withdraw unclaimed bounty.
     */
    @method(SigHash.ALL)
    public withdraw(repoOwnerSig: Sig, amount: bigint) {
        assert(
            this.checkSig(repoOwnerSig, this.repoOwnerKey),
            'Invalid repository owner signature'
        )

        // Validate sufficient funds
        assert(amount <= this.ctx.utxo.value, 'Not enough funds')

        const ownerAddr = pubKey2Addr(this.repoOwnerKey)
        let outputs = Utils.buildPublicKeyHashOutput(ownerAddr, amount)

        // Return remaining funds to new contract state
        const remaining = this.ctx.utxo.value - amount
        if (remaining > 0n) {
            outputs += this.buildStateOutput(remaining)
        }

        // Add wallet change output
        outputs += this.buildChangeOutput()

        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }
}
