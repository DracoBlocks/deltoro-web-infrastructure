const Provider = require("@truffle/hdwallet-provider");
const Web3 = require("web3");
const { Contract } = require("./contract.js");

const addressFrom = process.env.ETH_FROM_ADDRESS;
const privateKey = process.env.ETH_PRIV_KEY;
const provider = new Provider(privateKey, Contract.rpcUrls[0]);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(Contract.abi, Contract.address);

const processEvent = async (messageId, event) => {
  try {
    var transactionValue = event["resource"]["amount"]["value"];
    var eventId = event["id"];
    var resourceId = event["resource"]["id"];
    var supplimentaryData = event["resource"]["supplementary_data"];
    var addressTo = event["resource"]["custom_id"];
    var amount = Math.floor(transactionValue / 20);

    if (amount > 0) {
      return contract.methods
        .mint(addressTo, amount)
        .send({ from: addressFrom })
        .then((receipt) => {
          return {
            sqsMessageId: messageId,
            addressTo: addressTo,
            amount: amount,
            hash: receipt ? receipt.transactionHash : "",
            eventId: eventId,
            resourceId: resourceId,
            supplimentaryData: supplimentaryData,
            success: receipt.transactionHash != "",
          };
        })
        .catch((e) => {
          console.log("Error: " + e);
        });
    } else {
      console.log("Error, amount of NFTs minted must be greater than 0");
    }
  } catch (e) {
    console.log("Error: " + e);
  }

  return {
    sqsMessageId: messageId,
    addressTo: addressTo,
    eventId: eventId,
    resourceId: resourceId,
    success: false,
  };
};

async function handler(message) {
  const record = message["Records"][0];

  await processEvent(record["messageId"], JSON.parse(record["body"]))
    .then(
      (result) => {
        console.log("Mint event processed: ", result);
        if (!result.success) {
          throw "Failed mint, transaction failed";
        }
      },
      (reason) => {
        throw `Failed mint, promise rejected: ${reason}`;
      },
    )
    .catch((error) => {
      throw `Failed mint, promise rejected: ${error}`;
    });
}

module.exports = {
  handler,
};
