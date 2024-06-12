import { Chain } from "@defillama/sdk/build/general";
import BigNumber from "bignumber.js";
import request, { gql } from "graphql-request";
import { Adapter, FetchResultFees } from "../adapters/types";
import { CHAIN } from "../helpers/chains";
import { getUniqStartOfTodayTimestamp } from "../helpers/getUniSubgraphVolume";
import { getTimestampAtStartOfDayUTC } from "../utils/date";

interface IPoolData {
  id: number;
  feesUSD: string;
}

type IURL = {
  [l: string | Chain]: string;
}

const endpoints: IURL = {
  [CHAIN.ETHEREUM]: "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/7StqFFqbxi3jcN5C9YxhRiTxQM8HA8XEHopsynqqxw3t",
  // [CHAIN.BASE]: "https://api.studio.thegraph.com/query/64631/solidly-v3-base/version/latest",
  [CHAIN.OPTIMISM]: "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/7StqFFqbxi3jcN5C9YxhRiTxQM8HA8XEHopsynqqxw3t-optimism",
  [CHAIN.ARBITRUM]: "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/7StqFFqbxi3jcN5C9YxhRiTxQM8HA8XEHopsynqqxw3t-arbitrum",
  [CHAIN.FANTOM]: "https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/7StqFFqbxi3jcN5C9YxhRiTxQM8HA8XEHopsynqqxw3t-fantom"
}

const fetch = (chain: Chain) => {
  return async (timestamp: number): Promise<FetchResultFees> => {
    const todayTimestamp = getUniqStartOfTodayTimestamp(new Date(timestamp * 1000));
    const dateId = Math.floor(getTimestampAtStartOfDayUTC(todayTimestamp) / 86400)
    const graphQuery = gql
      `
      {
        solidlyDayData(id: ${dateId}) {
          id
          feesUSD
        }
      }
    `;

    const graphRes: IPoolData = (await request(endpoints[chain], graphQuery)).solidlyDayData;
    const dailyFeeUSD = graphRes;
    const dailyFee = dailyFeeUSD?.feesUSD ? new BigNumber(dailyFeeUSD.feesUSD) : undefined
    if (dailyFee === undefined) return { timestamp }

    return {
      timestamp,
      dailyFees: dailyFee.toString(),
      dailyUserFees: dailyFee.toString(),
      dailyRevenue: dailyFee.times(0.2).toString(),
      dailyHoldersRevenue: dailyFee.times(0.2).toString(),
    };
  };
}

const adapter: Adapter = {
  adapter: {
    [CHAIN.ETHEREUM]: {
      fetch: fetch(CHAIN.ETHEREUM),
      start: 1693526400,
    },
    // [CHAIN.BASE]: {
    //   fetch: fetch(CHAIN.BASE),
    //   start: 0,
    // },
    [CHAIN.OPTIMISM]: {
      fetch: fetch(CHAIN.OPTIMISM),
      start: 0,
    },
    [CHAIN.ARBITRUM]: {
      fetch: fetch(CHAIN.ARBITRUM),
      start: 0,
    },
    [CHAIN.FANTOM]: {
      fetch: fetch(CHAIN.FANTOM),
      start: 0,
    },
  },
};

export default adapter;
