import { FetchOptions, FetchResult, SimpleAdapter } from "../../adapters/types"
import { CHAIN } from "../../helpers/chains"
import { addOneToken } from "../../helpers/prices";

interface ILog {
  address: string;
  data: string;
  transactionHash: string;
  topics: string[];
}
const event_swap = 'event Swap(address indexed sender, address indexed to, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out)'

const fetch = async (fetchOptions: FetchOptions): Promise<FetchResult> => {
  const { api, getLogs, createBalances, } = fetchOptions
  const chain = api.chain
  const dailyVolume = createBalances()
  const dailyFees = createBalances()
  let pairs = await api.fetchList({ lengthAbi: 'allPoolsLength', itemAbi: 'allPools', target: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da' })
  let token0s = await api.multiCall({ abi: 'address:token0', calls: pairs })
  let token1s = await api.multiCall({ abi: 'address:token1', calls: pairs })
  let stables = await api.multiCall({ abi: 'bool:stable', calls: pairs })

  const poolsCalls: any[] = [];
  pairs.forEach((pair: any, i) => {
    poolsCalls.push({
      target: '0x420DD381b31aEf6683db6B902084cB0FFECe40Da',
      params: [pair, stables[i]]
    })
  });
  
  const fees = await api.multiCall({ abi: 'function getFee(address pool, bool _stable) external view returns (uint256)', calls: poolsCalls })

  let logs: ILog[][] = [];
  const targetChunkSize = 5;
  let currentTargetOffset = 0;
  let unfinished = true;

  while (unfinished) {
    let endOffset = currentTargetOffset + targetChunkSize;
    if (endOffset >= pairs.length) {
      unfinished = false;
      endOffset = pairs.length;
    }

    let currentLogs: ILog[][] = await getLogs({
      targets: pairs.slice(currentTargetOffset, endOffset),
      eventAbi: event_swap,
      flatten: false,
    })

    logs.push(...currentLogs);
    currentTargetOffset += targetChunkSize;
  }

  logs.forEach((logs: ILog[], idx: number) => {
    const token0 = token0s[idx]
    const token1 = token1s[idx]
    const fee = fees[idx]/1e4
    logs.forEach((log: any) => {
      addOneToken({ chain, balances: dailyVolume, token0, token1, amount0: log.amount0, amount1: log.amount1 })
      addOneToken({ chain, balances: dailyFees, token0, token1, amount0: Number(log.amount0) * fee, amount1: Number(log.amount1) * fee })
    })
  })

  return { dailyVolume, dailyFees, dailyRevenue: dailyFees, dailyHoldersRevenue: dailyFees } as any
}

const adapters: SimpleAdapter = {
  version: 2,
  adapter: {
    [CHAIN.BASE]: {
      fetch: fetch as any,
      start: '2023-08-28',
    }
  }
}
export default adapters;
