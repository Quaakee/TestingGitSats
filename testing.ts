import { WalletClient, PushDrop, Transaction, Utils } from '@bsv/sdk';

async function signTransaction() {
  const wallet = new WalletClient('auto', 'localhost');

  // create a locking script for the initial transaction, here I'm using PushDrop as an example but there are many ways to get one
  const pushdrop = new PushDrop(wallet)
  const initialLockingScript = await pushdrop.lock(
    [Utils.toArray('this is an example locking script')],
    [0, 'signing'],
    '1',
    'anyone',
    true
  )

  // for demo purposes, putting tokens into a basket is an easy way of viewing redeemable tokens
  const basket = 'signing demo'

  // build the initial action that is automatically signed and will be redeemed and putting it into a basket for demo purposes
  const initialToken = await wallet.createAction({
    outputs: [{
      lockingScript: initialLockingScript.toHex(),
      satoshis: 1000,
      basket,   // specifying which basket we want the token to be stored in until redemption
      outputDescription: 'Automatically signed and to be redeemed'
    }],
    description: 'This is an output that is created to be redeemed',
    options: {
      randomizeOutputs: false,        // to have the output's index in the tx to always be 0
      acceptDelayedBroadcast: false   // to have the broadcast happen immediately so we can work with the token
    }
  });

  // showing the newly created token in the basket
  const initialBasket = await wallet.listOutputs({
    basket
  });
  console.log('The basket has', initialBasket.totalOutputs, 'spendable outputs (init)');

  // extracting the details of the UTXO token that will be redeemed
  const inputBEEF = initialToken.tx as number[]   // the details of the transaction in BEEF (Background‑Evaluated Extended Format)
  const outpoint = `${initialToken.txid}.0`       // the txid and output index of the wanted UTXO

  // optionally build a new locking script that will replace the redeemed token
  const redeemingLockingScript = await pushdrop.lock(
    [Utils.toArray('this is an example redeeming locking script')],
    [0, 'signing'],
    '1',
    'anyone',
    true
  )

  // redeeming the initial action, this is the action that will require a signature
  const { signableTransaction } = await wallet.createAction({
    // input: tell WalletClient which UTXO to spend.
    inputBEEF,
    inputs: [{
      outpoint,
      unlockingScriptLength: 74,    // estimated length of the final unlocking script, PushDrop scripts will generally be 74
      inputDescription: 'Token to be redeemed',
    }],

    // outputs: where the 1000 sats inside the token should go after redemption.
    // if no outputs are given, the 1000 sats would return to the user's wallet balance
    outputs: [{
      satoshis: 1000,
      lockingScript: redeemingLockingScript.toHex(),
      outputDescription: 'Token redeemed'
    }],

    options: {
      acceptDelayedBroadcast: false
    },
    description: 'Redeem token',
  });

  // signableTransaction will be undefined if the action had no inputs to spend
  if (!signableTransaction) throw new Error('This transaction is not signable!')

  // create an unlocking script, here I'm using PushDrop as an example again
  const unlocker = pushdrop.unlock([0, 'signing'], '1', 'anyone', undefined, true)
  // specify the index of the input that we are signing
  const partialTx = Transaction.fromAtomicBEEF(signableTransaction.tx)
  const unlockingScript = await unlocker.sign(partialTx, 0)

  // sign the action to be redeemed
  const action = await wallet.signAction({
    reference: signableTransaction.reference,
    spends: {
      0: {
        unlockingScript: unlockingScript.toHex()
      }
    }
  });

  const endBasket = await wallet.listOutputs({
    basket
  });

  console.log('The basket has', endBasket.totalOutputs, 'spendable outputs (end)');
}

signTransaction();