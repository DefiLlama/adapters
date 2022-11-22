import { Adapter, FetchResultFees } from "../adapters/types";
import { CHAIN } from "../helpers/chains";
import { getTimestampAtStartOfDayUTC, getTimestampAtStartOfNextDayUTC } from "../utils/date";
import fetchURL from "../utils/fetchURL";
import * as sdk from "@defillama/sdk"
import { Chain } from "@defillama/sdk/build/general";
import { getPrices } from "../utils/prices";
import BigNumber from "bignumber.js";

const getBridgesVolumeData = (starttimestamp: number, endtimestamp: number, chain: string) => `https://bridges.llama.fi/transactions/12?starttimestamp=${starttimestamp}&endtimestamp=${endtimestamp}&sourcechain=${chain}`;
interface IBridgesVolumeData {
  tx_hash: string;
  ts: string;
  tx_block: string;
  tx_from: string;
  tx_to: string;
  token: string;
  amount: string;
  chain: string;
  bridge_name: string;
  volumeUsd: string;
}


const fetch = (chain: Chain) => {
  return async (timestamp: number): Promise<FetchResultFees> => {
    const todaysTimestamp = getTimestampAtStartOfDayUTC(timestamp);
    const endToDayTimestamp = getTimestampAtStartOfNextDayUTC(timestamp);
    const bridgesVolume: IBridgesVolumeData[] = (await fetchURL(getBridgesVolumeData(todaysTimestamp, endToDayTimestamp, chain === "avax" ? "avalanche" : chain))).data;
    const tokenAdreess = [...new Set([...bridgesVolume.map((e: IBridgesVolumeData) => e.token)])];
    const decimals = (await sdk.api.abi.multiCall({
      abi: 'erc20:decimals',
      calls: tokenAdreess.map((address: string) => { return {  target: address, params: [] }}),
      chain
    })).output.map((e: any) => e.output);
    const prices = await getPrices(tokenAdreess.map((e: string) => `${chain}:${e}`), todaysTimestamp);
    const bridgesVolumeInfo = bridgesVolume.map((e: IBridgesVolumeData) => {
      const index = tokenAdreess.findIndex((i: string) => i === e.token);
      const _decimals = Number(decimals[index]);
      // STC not charges fees
      const price = prices[`${chain}:${e.token.toLowerCase()}`]?.symbol === 'STG' ? 0 : (prices[`${chain}:${e.token.toLowerCase()}`]?.price || 1);
      const amount = new BigNumber(e.amount).div(new BigNumber(10).pow(_decimals))
        .times(price);
      return {
        ...e,
        volumeUsd: amount.toString(),
        amount: e.amount,
      }
    });
    const dailyVolume = bridgesVolumeInfo.reduce((acc, { volumeUsd }) => acc + Number(volumeUsd), 0);
    const dailyFees = dailyVolume * 0.0006;
    const dailyRevenue = dailyVolume * 0.0005;
    return {
      dailyFees: dailyFees.toString(),
      dailyRevenue: dailyRevenue.toString(),
      timestamp: todaysTimestamp
    }
  }
}

const adapter: Adapter = {
  adapter: {
    [CHAIN.ETHEREUM]: {
        fetch: fetch(CHAIN.ETHEREUM),
        start: async ()  => 1661990400,
    },
    [CHAIN.AVAX]: {
      fetch: fetch(CHAIN.AVAX),
      start: async ()  => 1661990400,
    },
    [CHAIN.POLYGON]: {
      fetch: fetch(CHAIN.POLYGON),
      start: async ()  => 1661990400,
    },
    [CHAIN.ARBITRUM]: {
      fetch: fetch(CHAIN.ARBITRUM),
      start: async ()  => 1661990400,
    },
    [CHAIN.FANTOM]: {
      fetch: fetch(CHAIN.FANTOM),
      start: async ()  => 1661990400,
    },
    [CHAIN.OPTIMISM]: {
      fetch: fetch(CHAIN.OPTIMISM),
      start: async ()  => 1661990400,
    },
  }
}

export default adapter;
