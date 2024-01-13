import { Chain } from "@defillama/sdk/build/general";
import { FetchResultVolume, SimpleAdapter } from "../../adapters/types";
import { getBlock } from "../../helpers/getBlock";
import { ethers } from "ethers";
import { getPrices } from "../../utils/prices";
import { CHAIN } from "../../helpers/chains";
import * as sdk from "@defillama/sdk";
import { type } from "os";

const topic0 =
  "0xf759b8879b7c58816b62c8cb8572a777bed770ca90e4a5b3bb4c7a8f7e94cf13";

type IContract = {
  [c: string | Chain]: string;
};
type TPrice = {
  [s: string]: {
    price: number;
    decimals: number;
  };
};
const contract: IContract = {
  [CHAIN.ARBITRUM]: "0xA1BB807fF6701f4e1b404Eb35Da55d8E9f3fb25c",
  [CHAIN.AVAX]: "0xA1BB807fF6701f4e1b404Eb35Da55d8E9f3fb25c",
  [CHAIN.POLYGON]: "0xA1BB807fF6701f4e1b404Eb35Da55d8E9f3fb25c",
  [CHAIN.BSC]: "0xA1BB807fF6701f4e1b404Eb35Da55d8E9f3fb25c",
  [CHAIN.ETHEREUM]: "0xA1BB807fF6701f4e1b404Eb35Da55d8E9f3fb25c",
  [CHAIN.ZKSYNC]: "0x18f79872b0255f7B57a131890739539B0Ad6ad4E",
};

interface ILog {
  address: string;
  data: string;
  transactionHash: string;
  topics: string[];
}
interface IData {
  fromAssetId: string;
  toAssetId: string;
  fromAmount: number;
  toAmount: number;
}

const fetch = (chain: Chain) => {
  return async (timestamp: number): Promise<FetchResultVolume> => {
    const fromTimestamp = timestamp - 60 * 60 * 24;
    const toTimestamp = timestamp;
    try {
      const fromBlock = await getBlock(fromTimestamp, chain, {});
      const toBlock = await getBlock(toTimestamp, chain, {});
      const logs = (await sdk.getEventLogs({
        target: contract[chain],
        topic: topic0,
        toBlock: toBlock,
        fromBlock: fromBlock,
        chain: chain,
        topics: [topic0],
      })) as ILog[];

      const data: IData[] = logs.map((e: ILog) => {
        const _data = e.data.replace("0x", "");
        const fromAssetId = "0x" + `0x${_data.slice(128, 192)}`.slice(26, 66);
        const toAssetId = "0x" + `0x${_data.slice(192, 256)}`.slice(26, 66);
        const fromAmount = Number(`0x${_data.slice(280, 320)}`);
        const toAmount = Number(`0x${_data.slice(320, 384)}`);
        return {
          tx: e.transactionHash,
          fromAssetId,
          toAssetId,
          toAmount,
          fromAmount,
        };
      });

      const coins: string[] = [
        ...new Set([
          ...new Set(data.map((e: IData) => `${chain}:${e.fromAssetId}`)),
          ...new Set(data.map((e: IData) => `${chain}:${e.toAssetId}`)),
        ]),
      ];

      const coins_split: string[][] = [];
      for (let i = 0; i < coins.length; i += 100) {
        coins_split.push(coins.slice(i, i + 100));
      }
      const prices_result: any = (
        await Promise.all(
          coins_split.map((a: string[]) => getPrices(a, timestamp))
        )
      )
        .flat()
        .flat()
        .flat();
      const prices: TPrice = Object.assign({}, {});
      prices_result.map((a: any) => Object.assign(prices, a));
      const volumeUSD = data
        .map((e: IData) => {
          const fromPrice = prices[`${chain}:${e.fromAssetId}`]?.price || 0;
          const toPrice = prices[`${chain}:${e.toAssetId}`]?.price || 0;
          const fromDecimals =
            prices[`${chain}:${e.fromAssetId}`]?.decimals || 0;
          const toDecimals = prices[`${chain}:${e.toAssetId}`]?.decimals || 0;
          const fromAmount = (e.fromAmount / 10 ** fromDecimals) * fromPrice;
          const toAmount = (e.toAmount / 10 ** toDecimals) * toPrice;
          return fromPrice ? fromAmount : toAmount;
        })
        .reduce((a: number, b: number) => a + b, 0);
      const dailyVolume = volumeUSD;
      return {
        dailyVolume: `${dailyVolume}`,
        timestamp,
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  };
};

const adapter: SimpleAdapter = {
  adapter: Object.keys(contract).reduce((acc, chain) => {
    return {
      ...acc,
      [chain]: {
        fetch: fetch(chain),
        start: async () => 1695897839,
      },
    };
  }, {}),
};

export default adapter;
