"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BountyContract = void 0;
const scrypt_ts_1 = require("scrypt-ts");
/**
 * A smart contract for GitHub issues-based bounties.
 *
 * This contract allows:
 * 1. Creating bounties for GitHub issues
 * 2. Adding funds to existing bounties
 * 3. Claiming bounties with certification from GitHub identity authority
 * 4. Withdrawing unclaimed bounties
 */
class BountyContract extends scrypt_ts_1.SmartContract {
    constructor(repoOwnerKey, repoOwnerSig, certServerKey, certServerSig, repoOwnerName, repoName, issueNumber, issueTitle) {
        super(...arguments);
        this.repoOwnerKey = repoOwnerKey;
        this.repoOwnerSig = repoOwnerSig;
        this.certServerKey = certServerKey;
        this.certServerSig = certServerSig;
        this.repoOwnerName = repoOwnerName;
        this.repoName = repoName;
        this.issueNumber = issueNumber;
        this.issueTitle = issueTitle;
    }
    /**
     * Allow the repo owner to add more funds into the contract.
     */
    addFunds() {
        const out = this.buildStateOutput(this.ctx.utxo.value);
        const outputs = out + this.buildChangeOutput();
        (0, scrypt_ts_1.assert)((0, scrypt_ts_1.hash256)(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch');
    }
    /**
     * Pay a user for solving a GitHub issue.
     *
     * @param repoOwnerSig   ECDSA signature from the repoOwner for spending
     * @param certServerSig  ECDSA signature from the certificate server
     * @param userPubKey     The public key of developer who solved it
     * @param amount         How much the dev is paid (remaining stays in contract)
     */
    payBounty(repoOwnerSig, certServerSig, userPubKey, amount) {
        // 1) Check the repoOwner's signature for authorization
        (0, scrypt_ts_1.assert)(this.checkSig(repoOwnerSig, this.repoOwnerKey), 'Repository owner signature invalid');
        // 2) Check certificate server signature to verify GitHub identity TODO
        (0, scrypt_ts_1.assert)(this.checkSig(certServerSig, this.certServerKey), 'Certificate server signature invalid');
        // 3) Ensure sufficient funds
        (0, scrypt_ts_1.assert)(amount <= this.ctx.utxo.value, 'Insufficient funds');
        // 4) Pay the developer
        const devAddr = (0, scrypt_ts_1.pubKey2Addr)(userPubKey);
        let outputs = scrypt_ts_1.Utils.buildPublicKeyHashOutput(devAddr, amount);
        // 5) Return remaining funds to the contract
        const remaining = this.ctx.utxo.value - amount;
        if (remaining > 0n) {
            outputs += this.buildStateOutput(remaining);
        }
        // Add change output
        outputs += this.buildChangeOutput();
        // Verify outputs hash matches
        (0, scrypt_ts_1.assert)((0, scrypt_ts_1.hash256)(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch');
    }
    /**
     * Allow the repo owner to withdraw funds if needed
     */
    withdraw(repoOwnerSig, amount) {
        // Check signature
        (0, scrypt_ts_1.assert)(this.checkSig(repoOwnerSig, this.repoOwnerKey), 'Invalid repository owner signature');
        // Ensure sufficient funds
        (0, scrypt_ts_1.assert)(amount <= this.ctx.utxo.value, 'Not enough funds');
        // Pay the repo owner
        const ownerAddr = (0, scrypt_ts_1.pubKey2Addr)(this.repoOwnerKey);
        let outputs = scrypt_ts_1.Utils.buildPublicKeyHashOutput(ownerAddr, amount);
        // Return remaining funds to the contract
        const remaining = this.ctx.utxo.value - amount;
        if (remaining > 0n) {
            outputs += this.buildStateOutput(remaining);
        }
        // Add change output
        outputs += this.buildChangeOutput();
        // Verify outputs hash matches
        (0, scrypt_ts_1.assert)((0, scrypt_ts_1.hash256)(outputs) == this.ctx.hashOutputs, 'hashOutputs mismatch');
    }
}
exports.BountyContract = BountyContract;
__decorate([
    (0, scrypt_ts_1.prop)(true)
], BountyContract.prototype, "repoOwnerKey", void 0);
__decorate([
    (0, scrypt_ts_1.prop)(true)
], BountyContract.prototype, "repoOwnerSig", void 0);
__decorate([
    (0, scrypt_ts_1.prop)(true)
], BountyContract.prototype, "certServerKey", void 0);
__decorate([
    (0, scrypt_ts_1.prop)(true)
], BountyContract.prototype, "certServerSig", void 0);
__decorate([
    (0, scrypt_ts_1.prop)()
], BountyContract.prototype, "repoOwnerName", void 0);
__decorate([
    (0, scrypt_ts_1.prop)()
], BountyContract.prototype, "repoName", void 0);
__decorate([
    (0, scrypt_ts_1.prop)()
], BountyContract.prototype, "issueNumber", void 0);
__decorate([
    (0, scrypt_ts_1.prop)()
], BountyContract.prototype, "issueTitle", void 0);
__decorate([
    (0, scrypt_ts_1.method)()
], BountyContract.prototype, "addFunds", null);
__decorate([
    (0, scrypt_ts_1.method)()
], BountyContract.prototype, "payBounty", null);
__decorate([
    (0, scrypt_ts_1.method)()
], BountyContract.prototype, "withdraw", null);
//# sourceMappingURL=BountyContract.js.map