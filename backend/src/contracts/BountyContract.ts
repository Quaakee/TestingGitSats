import {
    assert,
    SmartContract,
    prop,
    method,
    hash256,
    Utils,
    pubKey2Addr,
    SigHash,
    byteString2Int,
    ByteString,
    PubKey,
    Sig
} from 'scrypt-ts'

/**
 * A smart contract for GitHub issues-based bounties.
 * 
 * This contract allows:
 * 1. Creating bounties for GitHub issues
 * 2. Adding funds to existing bounties
 * 3. Claiming bounties with certification from GitHub identity authority
 * 4. Withdrawing unclaimed bounties
 */
export class BountyContract extends SmartContract {
    @prop()
    repoOwnerKey: PubKey

    @prop()
    repoOwnerSig: ByteString

    /*
    @prop(true)
    certServerKey: PubKey

    @prop(true)
    certServerSig: ByteString
    */
    // GitHub repository and issue details
    @prop()
    repoOwnerName: ByteString

    @prop()
    repoName: ByteString

    @prop()
    issueNumber: bigint

    @prop()
    issueTitle: ByteString
    
    @prop(true)
    currentBalance: bigint



    constructor(
        repoOwnerKey: PubKey,
        repoOwnerSig: ByteString,
        //certServerKey: PubKey,
        //certServerSig: ByteString,
        repoOwnerName: ByteString, 
        repoName: ByteString, 
        issueNumber: bigint,
        issueTitle: ByteString,
        currentBalance: bigint
    ) {
        super(...arguments)
        this.repoOwnerKey = repoOwnerKey
        this.repoOwnerSig = repoOwnerSig
        //this.certServerKey = certServerKey
        //this.certServerSig = certServerSig
        this.repoOwnerName = repoOwnerName
        this.repoName = repoName
        this.issueNumber = issueNumber
        this.issueTitle = issueTitle
        this.currentBalance = currentBalance
    }

    /**
     * Allow the repo owner to add more funds into the contract.
     */
    @method(SigHash.ALL) 
    public addFunds() {

        const addedAmount: bigint = this.ctx.utxo.value

        //Accumulate funds
        this.currentBalance += addedAmount
    
        const newOutput = this.buildStateOutput(this.currentBalance)
        const outputs = this.buildChangeOutput()
    
        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')

        /* OLD IMPLEMENTATION
        const out = this.buildStateOutput(this.ctx.utxo.value)
        const outputs = out + this.buildChangeOutput()
        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
        */
    }
    /**
     * Pay a user for solving a GitHub issue. 
     * 
     * @param repoOwnerSig   ECDSA signature from the repoOwner for spending
     * @param certServerSig  ECDSA signature from the certificate server
     * @param userPubKey     The public key of developer who solved it
     * @param amount         How much the dev is paid (remaining stays in contract)
     */
    @method(SigHash.ANYONECANPAY_ALL)
    public payBounty(
        repoOwnerSig: Sig,
        //certServerSig: Sig,
        userPubKey: PubKey,
        amount: bigint
    ) {
        // 1) Check the repoOwner's signature for authorization
        assert(
            this.checkSig(repoOwnerSig, this.repoOwnerKey),
            'Repository owner signature invalid'
        )

        // 2) Check certificate server signature to verify GitHub identity TODO
        
        //assert(
            //this.checkSig(certServerSig, this.certServerKey),
            //'Certificate server signature invalid'
        //) 

        // 3) Ensure sufficient funds
        assert(amount <= this.ctx.utxo.value, 'Insufficient funds')

        // 4) Pay the developer
        const devAddr = pubKey2Addr(userPubKey)
        let outputs = Utils.buildPublicKeyHashOutput(devAddr, amount)

        // 5) Return remaining funds to the contract
        const remaining = this.ctx.utxo.value - amount
        if (remaining > 0n) {
            outputs += this.buildStateOutput(remaining)
        }

        // Add change output
        outputs += this.buildChangeOutput()

        // Verify outputs hash matches
        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }

    /**
     * Allow the repo owner to withdraw funds if needed
     */
    @method(SigHash.ALL)
    public withdraw(repoOwnerSig: Sig, amount: bigint) {
        // Check signature
        assert(
            this.checkSig(repoOwnerSig, this.repoOwnerKey),
            'Invalid repository owner signature'
        )

        // Add cert server verification here to prevent scams

        // Ensure sufficient funds
        assert(amount <= this.ctx.utxo.value, 'Not enough funds')

        // Pay the repo owner
        const ownerAddr = pubKey2Addr(this.repoOwnerKey)
        let outputs = Utils.buildPublicKeyHashOutput(ownerAddr, amount)

        // Return remaining funds to the contract
        const remaining = this.ctx.utxo.value - amount
        if (remaining > 0n) {
            outputs += this.buildStateOutput(remaining)
        }

        // Add change output
        outputs += this.buildChangeOutput()

        // Verify outputs hash matches
        assert(hash256(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }
}