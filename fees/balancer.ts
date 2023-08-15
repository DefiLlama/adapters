import { Adapter } from "../adapters/types";
import { ARBITRUM, ETHEREUM, POLYGON } from "../helpers/chains";
import { request, gql } from "graphql-request";
import type { ChainEndpoints } from "../adapters/types"
import { Chain } from '@defillama/sdk/build/general';
import { getBlock } from "../helpers/getBlock";
import { ChainBlocks } from "../adapters/types";
import BigNumber from "bignumber.js";
import { getTimestampAtStartOfPreviousDayUTC, getTimestampAtStartOfDayUTC } from "../utils/date";

const v1Endpoints = {
  [ETHEREUM]:
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer",
}

const v2Endpoints = {
  [ETHEREUM]:
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2-beta",
  [ARBITRUM]:
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2",
  [POLYGON]:
    "https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2",
};

const v1Graphs = (graphUrls: ChainEndpoints) => {
  return (chain: Chain) => {
    return async (timestamp: number, chainBlocks: ChainBlocks) => {
      const todaysTimestamp = getTimestampAtStartOfDayUTC(timestamp)
      const yesterdaysTimestamp = getTimestampAtStartOfPreviousDayUTC(timestamp)

      const todaysBlock = (await getBlock(todaysTimestamp, chain, chainBlocks));
      const yesterdaysBlock = (await getBlock(yesterdaysTimestamp, chain, {}));

      const graphQuery = gql
        `{
        today: balancer(id: "1", block: { number: ${todaysBlock} }) {
          totalSwapFee
        }
        yesterday: balancer(id: "1", block: { number: ${yesterdaysBlock} }) {
          totalSwapFee
        }
      }`;

      const graphRes = await request(graphUrls[chain], graphQuery);
      const dailyFee = (new BigNumber(graphRes["today"]["totalSwapFee"]).minus(new BigNumber(graphRes["yesterday"]["totalSwapFee"])))

      return {
        timestamp,
        totalFees: graphRes["today"]["totalSwapFee"],
        dailyFees: dailyFee.toString(),
        totalUserFees: graphRes["today"]["totalSwapFee"],
        dailyUserFees: dailyFee.toString(),
        totalRevenue: "0",
        dailyRevenue: "0",
        totalProtocolRevenue: "0",
        dailyProtocolRevenue: "0",
        totalSupplySideRevenue: graphRes["today"]["totalSwapFee"],
        dailySupplySideRevenue: dailyFee.toString(),
      };
    };
  };
};

const v2Graphs = (graphUrls: ChainEndpoints) => {
  return (chain: Chain) => {
    return async (timestamp: number) => {
      const startTimestamp = getTimestampAtStartOfDayUTC(timestamp)
      const dayId = Math.floor(startTimestamp / 86400)

      const graphQuery = gql
        `query fees($dayId: String!, $yesterdayId: String!) {
        today: balancerSnapshot(id: $dayId) {
          totalProtocolFee
          totalSwapFee
        }
        yesterday: balancerSnapshot(id: $yesterdayId) {
          totalProtocolFee
          totalSwapFee
        }
        tenPcFeeChange: balancerSnapshot(id: "2-18972") {
          totalSwapFee
          timestamp
        }
        fiftyPcFeeChange: balancerSnapshot(id: "2-19039") {
          totalSwapFee
          timestamp
        }
      }`;

      const graphRes = await request(graphUrls[chain], graphQuery, {
        dayId: `2-${dayId}`,
        yesterdayId: `2-${dayId - 1}`
      });
      const currentTotalSwapFees = new BigNumber(graphRes["today"]["totalSwapFee"])

      const dailyFee = currentTotalSwapFees.minus(new BigNumber(graphRes["yesterday"]["totalSwapFee"]))
      const tenPcFeeTimestamp = graphRes["tenPcFeeChange"]["timestamp"]
      const fiftyPcFeeTimestamp = graphRes["fiftyPcFeeChange"]["timestamp"]
      const tenPcTotalSwapFees = new BigNumber(graphRes["tenPcFeeChange"]["totalSwapFee"])
      const fiftyPcTotalSwapFees = new BigNumber(graphRes["fiftyPcFeeChange"]["totalSwapFee"])

      // 10% gov vote enabled: https://vote.balancer.fi/#/proposal/0xf6238d70f45f4dacfc39dd6c2d15d2505339b487bbfe014457eba1d7e4d603e3
      // 50% gov vote change: https://vote.balancer.fi/#/proposal/0x03e64d35e21467841bab4847437d4064a8e4f42192ce6598d2d66770e5c51ace
      const dailyRevenue = startTimestamp < tenPcFeeTimestamp ? "0" : (
        startTimestamp < fiftyPcFeeTimestamp ? dailyFee.multipliedBy(0.1) : dailyFee.multipliedBy(0.5))
      const totalRevenue = startTimestamp < tenPcFeeTimestamp ? "0" : (
        startTimestamp < fiftyPcFeeTimestamp ? currentTotalSwapFees.minus(tenPcTotalSwapFees).multipliedBy(0.1) : currentTotalSwapFees.minus(fiftyPcTotalSwapFees).multipliedBy(0.5))

      const currentTotalProtocolFee = new BigNumber(graphRes["today"]["totalProtocolFee"])
      const dailyProtocolFee = currentTotalProtocolFee.minus(new BigNumber(graphRes["yesterday"]["totalProtocolFee"]))

      return {
        timestamp,
        totalUserFees: graphRes["today"]["totalSwapFee"],
        dailyUserFees: dailyFee.toString(),
        totalFees: graphRes["today"]["totalSwapFee"],
        dailyFees: dailyFee.toString(),
        totalRevenue: graphRes["today"]["totalProtocolFee"], // balancer v2 subgraph does not flash loan fees yet
        dailyRevenue: dailyProtocolFee.toString(), // balancer v2 subgraph does not flash loan fees yet
        totalProtocolRevenue: totalRevenue.toString(),
        dailyProtocolRevenue: dailyRevenue.toString(),
        totalSupplySideRevenue: new BigNumber(graphRes["today"]["totalSwapFee"]).minus(totalRevenue.toString()).toString(),
        dailySupplySideRevenue: new BigNumber(dailyFee.toString()).minus(dailyRevenue.toString()).toString(),
      };
    };
  };
};

const methodology = {
  UserFees: "Trading fees paid by users, ranging from 0.0001% to 10%",
  Fees: "All trading fees collected (doesn't include withdrawal and flash loan fees)",
  Revenue: "Protocol revenue from all fees collected",
  ProtocolRevenue: "Set to 10% of collected fees by a governance vote",
  SupplySideRevenue: "A small percentage of the trade paid by traders to pool LPs, set by the pool creator or dynamically optimized by Gauntlet",
}

const adapter: Adapter = {
  breakdown: {
    v1: {
      [ETHEREUM]: {
        fetch: v1Graphs(v1Endpoints)(ETHEREUM),
        start: async () => 1582761600,
        meta: {
          methodology: {
            UserFees: "Trading fees paid by users, ranging from 0.0001% and 10%",
            Fees: "All trading fees collected",
            Revenue: "Balancer V1 protocol fees are set to 0%",
            ProtocolRevenue: "Balancer V1 protocol fees are set to 0%",
            SupplySideRevenue: "Trading fees are distributed among LPs",
          }
        }
      },
    },
    v2: {
      [ETHEREUM]: {
        fetch: v2Graphs(v2Endpoints)(ETHEREUM),
        start: async () => 1619136000,
        meta: {
          methodology
        }
      },
      [POLYGON]: {
        fetch: v2Graphs(v2Endpoints)(POLYGON),
        start: async () => 1624492800,
        meta: {
          methodology
        }
      },
      [ARBITRUM]: {
        fetch: v2Graphs(v2Endpoints)(ARBITRUM),
        start: async () => 1630368000,
        meta: {
          methodology
        }
      }
    }
  }
}

export default adapter;
