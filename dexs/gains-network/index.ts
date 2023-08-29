import { FetchResultVolume, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import * as sdk from "@defillama/sdk";
import { getBlock } from "../../helpers/getBlock";
import { Chain } from "@defillama/sdk/build/general";

const topic0_limit_ex = '0x165b0f8d6347f7ebe92729625b03ace41aeea8fd7ebf640f89f2593ab0db63d1'
const topic0_market_ex = '0x2739a12dffae5d66bd9e126a286078ed771840f2288f0afa5709ce38c3330997'

type IAddress = {
  [s: string|Chain]: string
}


interface ILog {
  data: string;
  transactionHash: string;
  topics: string[];
}

const contract_address: IAddress = {
  [CHAIN.POLYGON]: '0x82e59334da8c667797009bbe82473b55c7a6b311',
  [CHAIN.ARBITRUM]: '0x298a695906e16aeA0a184A2815A76eAd1a0b7522',
}

const fetch = (chain: Chain) => {
  return async (timestamp: number): Promise<FetchResultVolume> => {
    const fromTimestamp = timestamp - 60 * 60 * 24
    const toTimestamp = timestamp

    const fromBlock = (await getBlock(fromTimestamp, chain, {}));
    const toBlock = (await getBlock(toTimestamp, chain, {}));
    try {
      const logs_limit_ex: ILog[] = (await sdk.api.util.getLogs({
        target: contract_address[chain],
        topic: '',
        toBlock: toBlock,
        fromBlock: fromBlock,
        keys: [],
        chain: chain,
        topics: [topic0_limit_ex]
      })).output as ILog[];

      const logs_market_ex: ILog[] = (await sdk.api.util.getLogs({
        target: contract_address[chain],
        topic: '',
        toBlock: toBlock,
        fromBlock: fromBlock,
        keys: [],
        chain: chain,
        topics: [topic0_market_ex]
      })).output as ILog[];


      const limit_volume = logs_limit_ex.map((e: ILog) => {
        const data = e.data.replace('0x', '');
        const leverage = Number('0x' + data.slice(512, 576));
        const positionSizeDai =  Number('0x' + data.slice(896, 960)) / 10 **  18;
        return (leverage * positionSizeDai)
      }).reduce((a: number, b: number) => a + b, 0);

      const market_volume = logs_market_ex.map((e: ILog) => {
        const data = e.data.replace('0x', '');
        const leverage = Number('0x' + data.slice(448, 512));
        const positionSizeDai =  Number('0x' + data.slice(832, 896)) / 10 **  18;
        return (leverage * positionSizeDai)
      }).reduce((a: number, b: number) => a + b, 0);

      const dailyVolume = (limit_volume+market_volume)
      return {
        dailyVolume: `${dailyVolume}`,
        timestamp
      }
    } catch (error) {
      console.error(error)
      throw error;
    }
  }
}


const adapter: SimpleAdapter = {
  adapter: {
    [CHAIN.ARBITRUM]: {
      fetch: fetch(CHAIN.ARBITRUM),
      start: async () => 1684972800,
    },
    [CHAIN.POLYGON]: {
      fetch: fetch(CHAIN.POLYGON),
      start: async () => 1684972800,
    },
  }
};

export default adapter;
