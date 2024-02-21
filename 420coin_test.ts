import { createJupiterApiClient } from '@jup-ag/api';
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import { PublicKey, createSignerFromKeypair, none, percentAmount, publicKey, signerIdentity, some } from "@metaplex-foundation/umi";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey} from '@metaplex-foundation/umi-web3js-adapters';


export function loadWalletKey(keypairFile:string): Keypair {
  const fs = require("fs");
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairFile).toString())),
  );
  return loaded;
}

export async function main() {

    console.log("Starting...")
    

    const jupiterQuoteApi = createJupiterApiClient(); // config is optional

    const myWallet = loadWalletKey("C:/solana/test.json");

    const connection = new Connection(
      "https://api.mainnet-beta.solana.com"
    );

    /*
    const wallet = new Wallet(
        Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY))
      );
    */
    

      const quoteResponse = await jupiterQuoteApi.quoteGet({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "GMNafqhoSERgJLgezWfoqNoYTGHXDZ8hcwhaVUNmXdt9",
        amount: 95281,
        slippageBps: 100,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      });

    if (!quoteResponse) {
        console.error("unable to quote");
        return;
     }

    console.log(quoteResponse)

  // get serialized transaction
  console.log("Performing Swap...")
  const swapResult = await jupiterQuoteApi.swapPost({
    swapRequest: {
      quoteResponse: quoteResponse,
      userPublicKey: myWallet.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
    },
  });

  console.dir(swapResult, { depth: null });

  
  // submit transaction
  const swapTransactionBuf = Buffer.from(swapResult.swapTransaction, "base64");
  var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
  console.log(transaction);

  // sign the transaction
  transaction.sign([myWallet]);

  const rawTransaction = transaction.serialize();
  const txid = await connection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 4,
  });
  await connection.confirmTransaction(txid);
  console.log(`https://solscan.io/tx/${txid}`);


  // get route map
  const tokens = await jupiterQuoteApi.tokensGet();
  //console.log(Object.keys(tokens).length);

       //Sleep 1min
       console.log("Sleeping...")
       await new Promise(f => setTimeout(f, 1000 * 60));

       //Start Transaction again
       console.log("Restarting...")
       main();

}

main()
  .then(() => {
    console.log("Done");
  })
  .catch((e) => {
    console.error(e);
    main();
  });