import { readFile } from "mz/fs";
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import { getOrca, OrcaFarmConfig, OrcaPoolConfig } from "@orca-so/sdk";
import Decimal from "decimal.js";
import { bool } from "@metaplex-foundation/umi/serializers";
import { createJupiterApiClient } from '@jup-ag/api';
import { exit } from "process";


export function loadWalletKey(keypairFile:string): Keypair {
    const fs = require("fs");
    const loaded = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(keypairFile).toString())),
    );
    return loaded;
  }

const main = async () => {
    const enviroment = "https://api.mainnet-beta.solana.com";
    const walletFileLocation = "C:/solana/test.json";

    //Prepare Secret Key for Orca interactions
    const secretKeyString = await readFile(walletFileLocation, {
        encoding: "utf8",
    });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const owner = Keypair.fromSecretKey(secretKey);

    // 2. Initialzie Orca object with mainnet connection
    const connection = new Connection(enviroment, "singleGossip");
    const orca = getOrca(connection);

    const jupiterQuoteApi = createJupiterApiClient(); // config is optional

    //Prepare Key for Jup
    const myWallet = loadWalletKey("C:/solana/test.json");

    try {
        //Initialize Flag to Perform Swap 
        let worthIt = false;

        /*** ORCA QUOTE ***/
        // 3. We will be swapping 0.0001 SOL for some  (a = first, b = second)
        const orcaPool = orca.getPool(OrcaPoolConfig.);
        const bToken = orcaPool.getTokenA();
        const bAmount = new Decimal(0.01);
        const quote = await orcaPool.getQuote(bToken, bAmount);
        const aAmount = quote.getMinOutputAmount();
        //console.log(`Orca Swap ${bAmount.toString()} SOL for at least ${aAmount.toNumber()} mSol`);
        

        //Convert Orca Output to get used by Jupiter quote
        const jupiterAmount = Number(bAmount) * 1000000000;
        const jupiterGet = Number(aAmount.toNumber());
        //console.log(Number(bAmount), " - ", jupiterGet)

        /*** JUPITER QUOTE ***/

        const quoteResponse = await jupiterQuoteApi.quoteGet({
            inputMint: "9gwTegFJJErDpWJKjPfLr2g2zrE3nL1v5zpwbtsk3c6P",
            outputMint: "So11111111111111111111111111111111111111112",
            amount: jupiterGet * 1000000,
            slippageBps: 100,
            onlyDirectRoutes: false,
            asLegacyTransaction: false,
          });
    
        if (!quoteResponse) {
            console.error("unable to quote");
            return;
         }
         //Log Jupiter Swap
        //console.log("Jupiter Swap ", Number(quoteResponse.inAmount) / 1000000000, "mSol for ", Number(quoteResponse.outAmount) / 1000000000, "Sol");

        //console.log(Number(quoteResponse.outAmount), " -----PREEEEEEEE-------- ", Number(bAmount.toString()) * 1000000000)
        if (Number(quoteResponse.outAmount) > (Number(bAmount.toString()) * 1000000000)){
            worthIt = true;
            console.log("Swap worth! ");
            console.log("Orca IN ", Number(bAmount.toString()));
            console.log("Jupiter OUT ", Number(quoteResponse.outAmount) / 1000000000);


        }else{
            console.log("Swap NOT worth! ");
            console.log("Orca IN ", Number(bAmount.toString()));
            console.log("Jupiter OUT ", Number(quoteResponse.outAmount) / 1000000000);
            console.log("\n");


            //Sleep
           await new Promise(f => setTimeout(f, 1000));

            //Start Transaction again
            main()
        }
    

    if (worthIt == true){
        //Prepare Orca Payload for Swap
        const swapPayload = await orcaPool.swap(owner, bToken, bAmount, aAmount);

        //Execute the Orca Swap 
        const swapTxId = await swapPayload.execute();

        console.log("Swapped:", swapTxId, "\n");


        // get serialized transaction
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
            maxRetries: 2,
        });
        await connection.confirmTransaction(txid);
        console.log(`https://solscan.io/tx/${txid}`);
            }else {
                console.log("Swap not worth!")
            }
    

  }catch (err){
    console.warn(err);
  }
}

main()
  .then(() => {
    console.log("Done");
  })
  .catch((e) => {
    console.error(e);
  });