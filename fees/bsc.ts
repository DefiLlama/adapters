import { Adapter, ProtocolType } from "../adapters/types";
import { BSC } from "../helpers/chains";
import { request, gql } from "graphql-request";
import type { ChainEndpoints } from "../adapters/types"
import { Chain } from '@defillama/sdk/build/general';
import { getPrices } from "../utils/prices";
import { getBlock } from "../helpers/getBlock";
import { ChainBlocks } from "../adapters/types";
import BigNumber from "bignumber.js";
import { getTimestampAtStartOfPreviousDayUTC, getTimestampAtStartOfDayUTC } from "../utils/date";

const endpoints = {
  [BSC]:
    "https://api.thegraph.com/subgraphs/name/dmihal/bsc-validator-rewards"
}


const graphs = (graphUrls: ChainEndpoints) => {
  return (chain: Chain) => {
    return async (timestamp: number, chainBlocks: ChainBlocks) => {
      const todaysTimestamp = getTimestampAtStartOfDayUTC(timestamp)
      const yesterdaysTimestamp = getTimestampAtStartOfPreviousDayUTC(timestamp)

      const todaysBlock = (await getBlock(todaysTimestamp, chain, chainBlocks));
      const yesterdaysBlock = (await getBlock(yesterdaysTimestamp, chain, {}));

      const graphQuery = gql
      `query txFees {
        yesterday: fee(id: "1", block: { number: ${yesterdaysBlock} }) {
          totalFees
        }
        today: fee(id: "1", block: { number: ${todaysBlock} }) {
          totalFees
        }
      }`;

      const graphRes = await request(graphUrls[chain], graphQuery);

      const dailyFee = new BigNumber(graphRes["today"]["totalFees"]).minus(new BigNumber(graphRes["yesterday"]["totalFees"]))

      const bnbAddress = "bsc:0x0000000000000000000000000000000000000000";
      const pricesObj: any = await getPrices([bnbAddress], todaysTimestamp);
      const latestPrice = new BigNumber(pricesObj[bnbAddress]["price"])

      const finalDailyFee = dailyFee.multipliedBy(latestPrice)
      const finalTotalFee = new BigNumber(graphRes["today"]["totalFees"]).multipliedBy(latestPrice)

      return {
        timestamp,
        totalFees: finalTotalFee.toString(),
        dailyFees: finalDailyFee.toString(),
        dailyRevenue: timestamp<1638234000?"0":(finalDailyFee.times(0.1)).toString(), // https://github.com/bnb-chain/BEPs/blob/master/BEP95.md
      };
    };
  };
};


const adapter: Adapter = {
  adapter: {
    [BSC]: {
        fetch: graphs(endpoints)(BSC),
        start: 1598671449,
    },
  },
  protocolType: ProtocolType.CHAIN
}

export default adapter;
