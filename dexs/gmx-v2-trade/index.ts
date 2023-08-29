import { FetchResultVolume, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import * as sdk from "@defillama/sdk";
import { getBlock } from "../../helpers/getBlock";
import { Chain } from "@defillama/sdk/build/general";

interface ILog {
  data: string;
  transactionHash: string;
  topics: string[];
}

const topic0_ins = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
const topic1_ins = '0xf94196ccb31f81a3e67df18f2a62cbfb50009c80a7d3c728a3f542e3abc5cb63';

const topic0_des = '0x137a44067c8961cd7e1d876f4754a5a3a75989b4552f1843fc69c3b372def160';
const topic1_des = '0x07d51b51b408d7c62dcc47cc558da5ce6a6e0fd129a427ebce150f52b0e5171a';

type TChain  = {
  [s: Chain | string]: string;
}

const contract: TChain = {
  [CHAIN.ARBITRUM]: '0xc8ee91a54287db53897056e12d9819156d3822fb',
  [CHAIN.AVAX]: '0xdb17b211c34240b014ab6d61d4a31fa0c0e20c26'
}

const fetch = (chain: Chain) => {
    return async (timestamp: number): Promise<FetchResultVolume> => {
      const fromTimestamp = timestamp - 60 * 60 * 24
      const toTimestamp = timestamp
      try {
        const fromBlock = (await getBlock(fromTimestamp, chain, {}));
        const toBlock = (await getBlock(toTimestamp, chain, {}));

        const posistion_logs: ILog[] = (await sdk.api.util.getLogs({
          target: contract[chain],
          topic: '',
          toBlock: toBlock,
          fromBlock: fromBlock,
          keys: [],
          chain: chain,
          topics: [topic0_ins, topic1_ins]
        })).output as ILog[];

        const decress_logs: ILog[] = (await sdk.api.util.getLogs({
          target: contract[chain],
          topic: '',
          toBlock: toBlock,
          fromBlock: fromBlock,
          keys: [],
          chain: chain,
          topics: [topic0_des, topic1_des]
        })).output as ILog[];

        const raw_in = posistion_logs.map((e: ILog) => {
          const data = e.data.replace('0x', '');
          const volume = data.slice(50 * 64, (50 * 64) + 64);
          return Number('0x'+volume) / 1e30;
        })

        const raw_des = decress_logs.map((e: ILog) => {
          const data = e.data.replace('0x', '');
          const volume = data.slice(102 * 64, (102 * 64) + 64);
          return Number('0x'+volume) / 1e30;
        })

        const dailyVolume: number = [...raw_des, ...raw_in]
          .reduce((a: number, b: number) => a+b, 0);

        return {
          dailyVolume: `${dailyVolume}`,
          timestamp
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }
}


const adapter: SimpleAdapter = {
  adapter: {
    [CHAIN.ARBITRUM]: {
      fetch: fetch(CHAIN.ARBITRUM),
      start: async () => 1688428800,
    },
    [CHAIN.AVAX]: {
      fetch: fetch(CHAIN.AVAX),
      start: async () => 1688428800,
    },
  },
};
export default adapter;
