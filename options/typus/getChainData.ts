import axios from "axios";
import * as sdk from "@defillama/sdk"

interface ChainData {
  totalPremiumVolume: { [key: string]: number };
  dailyPremiumVolume: { [key: string]: number };
  totalNotionalVolume: { [key: string]: number };
  dailyNotionalVolume: { [key: string]: number };
  timestamp: string;
}

async function getChainData(
  timestamp: string,
  backFillTimestamp: string | undefined = undefined
): Promise<ChainData> {
  let end_timestamp = Number(timestamp);
  let start_timestamp = end_timestamp - 24 * 60 * 60;

  var response = await axios.post(
    "https://fullnode.mainnet.sui.io:443",
    {
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: {
        query: {
          MoveEventType:
            "0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::DeliveryEvent",
        },
        descending_order: true,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  var data = response.data.result.data;

  if (backFillTimestamp) {
    while (response.data.result.hasNextPage) {
      response = await axios.post(
        "https://fullnode.mainnet.sui.io:443",
        {
          jsonrpc: "2.0",
          id: 1,
          method: "suix_queryEvents",
          params: {
            query: {
              MoveEventType:
                "0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::DeliveryEvent",
            },
            descending_order: true,
            cursor: response.data.result.nextCursor,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      data = data.concat(response.data.result.data);

      const timestamp = Number(data.at(-1).timestampMs) / 1000;
      if (timestamp <= Number(backFillTimestamp)) {
        break;
      }
    }
  }

  const acc: ChainData = {
    timestamp,
    totalNotionalVolume: {},
    dailyNotionalVolume: {},
    totalPremiumVolume: {},
    dailyPremiumVolume: {},
  };

  for (const curr of data) {
    const parsedJson = curr.parsedJson;
    const dailyNotionalVolume =
      Number(parsedJson.delivery_size)

    const dailyPremiumVolume =
      (Number(parsedJson.bidder_bid_value) +
        Number(parsedJson.bidder_fee) +
        Number(parsedJson.incentive_bid_value) +
        Number(parsedJson.incentive_fee))

    if ("sui:0x" + parsedJson.o_token.name in acc.totalNotionalVolume) {
      acc.totalNotionalVolume["sui:0x" + parsedJson.o_token.name] +=
        dailyNotionalVolume;
    } else {
      acc.totalNotionalVolume["sui:0x" + parsedJson.o_token.name] =
        dailyNotionalVolume;
    }

    if ("sui:0x" + parsedJson.b_token.name in acc.totalPremiumVolume) {
      acc.totalPremiumVolume["sui:0x" + parsedJson.b_token.name] +=
        dailyPremiumVolume;
    } else {
      acc.totalPremiumVolume["sui:0x" + parsedJson.b_token.name] =
        dailyPremiumVolume;
    }

    const timestamp = Number(curr.timestampMs) / 1000;
    if (timestamp > start_timestamp && timestamp <= end_timestamp) {
      if ("sui:0x" + parsedJson.o_token.name in acc.dailyNotionalVolume) {
        acc.dailyNotionalVolume["sui:0x" + parsedJson.o_token.name] +=
          dailyNotionalVolume;
      } else {
        acc.dailyNotionalVolume["sui:0x" + parsedJson.o_token.name] =
          dailyNotionalVolume;
      }

      if ("sui:0x" + parsedJson.b_token.name in acc.dailyPremiumVolume) {
        acc.dailyPremiumVolume["sui:0x" + parsedJson.b_token.name] +=
          dailyPremiumVolume;
      } else {
        acc.dailyPremiumVolume["sui:0x" + parsedJson.b_token.name] =
          dailyPremiumVolume;
      }
    }
  }

  acc.dailyNotionalVolume = await sdk.Balances.getUSDString(acc.dailyNotionalVolume, end_timestamp) as any
  acc.dailyPremiumVolume = await sdk.Balances.getUSDString(acc.dailyPremiumVolume, end_timestamp) as any
  acc.totalPremiumVolume = await sdk.Balances.getUSDString(acc.totalPremiumVolume, end_timestamp) as any
  acc.totalNotionalVolume = await sdk.Balances.getUSDString(acc.totalNotionalVolume, end_timestamp) as any

  return acc;
}

export default getChainData;
