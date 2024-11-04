import { Adapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import { request } from "graphql-request";
import { query } from "./query";
import { getChainUnderlyingPrices } from "./prices";
import { BLACKLIST } from "./blacklist";

const methodology = {
  Fees: "Fees is the interest rate paid by borrowers",
  Revenue: "Percentage of interest going to treasury, based on each lending pool's reserve factor.",
};

const config = {
  ethereum: [
    "https://api.studio.thegraph.com/query/46041/impermax-mainnet-v1/v0.0.1",
  ],
  polygon: [
    "https://api.studio.thegraph.com/query/46041/impermax-x-uniswap-v2-polygon-v2/v0.0.1",
    "https://api.studio.thegraph.com/query/46041/impermax-polygon-solv2/v0.0.1",
    "https://api.studio.thegraph.com/query/46041/impermax-polygon-sol-stable/v0.0.1",
  ],
  arbitrum: [
    "https://api.studio.thegraph.com/query/46041/impermax-arbitrum-v1/v0.0.1",
    "https://api.studio.thegraph.com/query/46041/impermax-arbitrum-v2/v0.0.1",
    "https://api.studio.thegraph.com/query/46041/impermax-arbitrum-solv2/v0.0.2",
  ],
  optimism: [
    "https://api.studio.thegraph.com/query/46041/impermax-optimism-solv2/v0.0.1",
  ],
  fantom: [
    "https://api.studio.thegraph.com/query/46041/impermax-fantom-solv2/v0.0.2",
  ],
  base: [
    "https://api.studio.thegraph.com/query/46041/impermax-base-solv2/v0.0.2",
    "https://api.studio.thegraph.com/query/46041/impermax-base-solv2-stable/v0.0.1",
  ],
  scroll: [
    "https://api.studio.thegraph.com/query/46041/impermax-scroll-solv2/v0.0.2",
    "https://api.studio.thegraph.com/query/46041/impermax-scroll-solv2-stable/0.0.9",
  ],
  real: [
    "https://api.goldsky.com/api/public/project_cm2d5q4l4w31601vz4swb3vmi/subgraphs/impermax-finance/impermax-real-v2-stable/gn",
    "https://api.goldsky.com/api/public/project_cm2rhb30ot9wu01to8c9h9e37/subgraphs/impermax-real-solv2/3.0/gn",
  ],
  avax: [
    "https://api.studio.thegraph.com/query/46041/impermax-avalanche-v1/v0.0.1",
    "https://api.studio.thegraph.com/query/46041/impermax-avalanche-v2/v0.0.2",
    "https://api.studio.thegraph.com/query/46041/impermax-avalanche-solv2/v0.0.2",
  ],
};

interface IBorrowable {
  id: string;
  borrowRate: string;
  reserveFactor: string;
  totalBorrows: string;
  accrualTimestamp: string;
  underlying: {
    id: string;
  };
  lendingPool: {
    id: string;
  };
}

const getChainBorrowables = async (chain: CHAIN): Promise<IBorrowable[]> => {
  const urls = config[chain];
  let allBorrowables: IBorrowable[] = [];

  for (const url of urls) {
    const queryResult = await request(url, query);
    allBorrowables = allBorrowables.concat(queryResult.borrowables);
  }

  const blacklist = BLACKLIST[chain] || [];
  return allBorrowables.filter(i => !blacklist.includes(i.lendingPool.id));
};

const calculate = (
  borrowable: IBorrowable,
  prices: object,
  chain: CHAIN,
): { dailyFees: number; dailyRevenue: number } => {
  const { totalBorrows, borrowRate, reserveFactor, underlying } = borrowable;

  const underlyingPrice = prices[`${chain}:${underlying.id}`];
  if (!underlyingPrice) return { dailyFees: 0, dailyRevenue: 0 };

  const dailyBorrowAPR = Number(borrowRate) * 86400;
  const dailyFees = Number(totalBorrows) * underlyingPrice * dailyBorrowAPR;
  const dailyRevenue = dailyFees * Number(reserveFactor);

  return { dailyFees, dailyRevenue };
};

const graphs = () => {
  return (chain: CHAIN) => {
    return async (timestamp: number) => {
      // 1. Get all the chain borrowables
      const borrowables: IBorrowable[] = await getChainBorrowables(chain);

      // 2. Get the prices of all underlyings on this chain using llama + gecko
      const underlyings = borrowables.map((i) => i.underlying.id);
      const prices = await getChainUnderlyingPrices(chain, underlyings);

      // 3. Add the daily fees/revenue of each borrowable's based on their reserve factor
      const { dailyFees, dailyRevenue } = borrowables
        .map((b: IBorrowable) => calculate(b, prices, chain))
        .reduce(
          (acc, val) => ({
            dailyFees: acc.dailyFees + val.dailyFees,
            dailyRevenue: acc.dailyRevenue + val.dailyRevenue,
          }),
          { dailyFees: 0, dailyRevenue: 0 },
        );

      return {
        timestamp,
        dailyFees: dailyFees.toString(),
        dailyRevenue: dailyRevenue.toString(),
      };
    };
  };
};

const adapter: Adapter = {
  adapter: {
    [CHAIN.ETHEREUM]: {
      fetch: graphs()(CHAIN.ETHEREUM),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.POLYGON]: {
      fetch: graphs()(CHAIN.POLYGON),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.ARBITRUM]: {
      fetch: graphs()(CHAIN.ARBITRUM),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.FANTOM]: {
      fetch: graphs()(CHAIN.FANTOM),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.BASE]: {
      fetch: graphs()(CHAIN.BASE),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.SCROLL]: {
      fetch: graphs()(CHAIN.SCROLL),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.OPTIMISM]: {
      fetch: graphs()(CHAIN.OPTIMISM),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.REAL]: {
      fetch: graphs()(CHAIN.REAL),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
    [CHAIN.AVAX]: {
      fetch: graphs()(CHAIN.AVAX),
      runAtCurrTime: true,
      start: 1698019200,
      meta: {
        methodology,
      },
    },
  },
};

export default adapter;
