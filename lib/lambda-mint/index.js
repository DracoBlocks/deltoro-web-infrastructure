import Provider from "@truffle/hdwallet-provider";
import Web3 from "web3";
import { Contract } from "./contract.js";

const addressFrom = process.env.ETH_FROM_ADDRESS;
const privateKey = process.env.ETH_PRIV_KEY;
const provider = new Provider(privateKey, Contract.rpcUrls[0]);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(Contract.abi, Contract.address);

const processEvent = async (messageId, event) => {
  var transactionValue = event["resource"]["amount"]["value"];
  var addressTo = event["resource"]["custom_id"];
  var amount = Math.floor(transactionValue / 20);

  let receipt;
  let success = false;
  try {
    receipt = await contract.methods
      .mint(addressTo, amount)
      .send({ from: addressFrom });
    success = receipt.transactionHash != "";
  } catch (e) {
    console.log(e);
  }

  const result = {
    sqsMessageId: messageId,
    addressTo: addressTo,
    amount: amount,
    hash: receipt ? receipt.transactionHash : "",
    success: success,
  };

  console.log("Processing batch: ", result);
  return result;
};

export async function handler(message) {
  const records = message["Records"];
  return {
    batchItemFailures: [
      (
        await Promise.all(
          records.map((record) => {
            return processEvent(
              record["messageId"],
              JSON.parse(record["body"]),
            );
          }),
        )
      )
        .filter((result) => {
          return !result.success;
        })
        .map((result) => {
          itemIdentifier: result.sqsMessageId;
        }),
    ],
  };
}
