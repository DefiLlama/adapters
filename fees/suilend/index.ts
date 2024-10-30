import {
  Adapter,
  FetchOptions,
} from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import fetchURL from "../../utils/fetchURL";

const suilendFeesURL = 'https://api.suilend.fi/stats/daily-fees';

interface DailyStats {
  date: string;
  start: number;
  end: number;
  borrowFees: number;
  borrowInterestPaid: number;
  protocolFees: number;
  liquidatorBonuses: number;
  liquidationProtocolFees: number;
  previous: string;
  next: string;
}

const methodology = {
  Fees: 'Interest and fees paid by borrowers and the liquidated',
  ProtocolReveneue: 'The portion of the total fees going to the Suilend treasury'
}

const fetchSuilendStats = async ({ endTimestamp }: FetchOptions) => {
  const url = `${suilendFeesURL}?ts=${endTimestamp}`
  const stats: DailyStats = (await fetchURL(url));

  const userFees =
    stats.borrowInterestPaid +
    stats.borrowFees +
    stats.protocolFees +
    stats.liquidationProtocolFees;

  const dailyRevenue = stats.borrowInterestPaid +
    stats.liquidationProtocolFees;

  return {
    dailyFees: userFees,
    dailyUserFees: userFees,
    dailyRevenue: dailyRevenue,
    dailyProtocolRevenue: dailyRevenue,
  };
};



const adapter: Adapter = {
  version: 2,
  adapter: {
    [CHAIN.SUI]: {
      runAtCurrTime: false,
      customBackfill: undefined,
      fetch: fetchSuilendStats,
      start: 1709280000,
      meta: {
        methodology,
      },
    },
  },
};

export default adapter;
