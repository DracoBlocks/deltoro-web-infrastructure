const Provider = require("@truffle/hdwallet-provider");
const Web3 = require("web3");
const { Contract } = require("./contract.js");

const addressFrom = process.env.ETH_FROM_ADDRESS;
const privateKey = process.env.ETH_PRIV_KEY;
const provider = new Provider(privateKey, Contract.rpcUrls[0]);
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(Contract.abi, Contract.address);
const gasPricePromise = web3.eth.getGasPrice();

const processEvent = async (messageId, event) => {
  try {
    const transactionValue = event["resource"]["amount"]["value"];
    const eventId = event?.["id"];
    const resourceId = event?.["resource"]?.["id"];
    const supplimentaryData = event?.["resource"]?.["supplementary_data"];
    const addressTo = event["resource"]["custom_id"];
    const amount = Math.floor(transactionValue / 20);

    console.log("Processing mint event", {
      sqsMessageId: messageId,
      addressTo: addressTo,
      amount: amount,
      eventId: eventId,
      resourceId: resourceId,
    });

    const method = contract.methods.mint(addressTo, amount);

    const estimatedGas = await method.estimateGas({
      from: addressFrom,
    });

    if (amount > 0) {
      return method
        .send({
          from: addressFrom,
          gasLimit: Math.ceil(estimatedGas * 1.25),
          gasPrice: Math.ceil((await gasPricePromise) * 1.1),
        })
        .then((receipt) => {
          return {
            sqsMessageId: messageId,
            addressTo: addressTo,
            amount: amount,
            hash: receipt?.transactionHash,
            eventId: eventId,
            resourceId: resourceId,
            supplimentaryData: supplimentaryData,
            success: !!receipt?.transactionHash,
          };
        })
        .catch((e) => {
          console.log("Error: ", e);
        });
    } else {
      console.log("Error, amount of NFTs minted must be greater than 0");
    }
  } catch (e) {
    console.log("Error: ", e);
  }

  return {
    sqsMessageId: messageId,
    addressTo: addressTo,
    amount: amount,
    eventId: eventId,
    resourceId: resourceId,
    success: false,
  };
};

async function handler(message) {
  const record = message["Records"][0];

  return processEvent(record["messageId"], JSON.parse(record["body"]))
    .then(
      (result) => {
        if (!result || !result?.success) {
          throw `Failed mint, transaction failed`;
        }
        console.log("Event processed correctly", result);
      },
      (reason) => {
        throw `Failed mint, rejected for SQS id ${record["messageId"]}: ${reason}`;
      },
    )
    .catch((error) => {
      throw `Failed mint, rejected for SQS id ${record["messageId"]}: ${error}`;
    });
}

module.exports = {
  handler,
};
