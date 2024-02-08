import { Adapter } from "../adapters/types";
import { getTimestampAtStartOfPreviousDayUTC } from "../utils/date";
import fetchURL from "../utils/fetchURL";
import { CHAIN } from "../helpers/chains";

const feeEndpoint = "https://api-osmosis.imperator.co/fees/v1/total/historical"

interface IChartItem {
  time: string
  fees_spent: number
}

const fetch = async (timestamp: number) => {
  const dayTimestamp = getTimestampAtStartOfPreviousDayUTC(timestamp)
  const historicalFees: IChartItem[] = (await fetchURL(feeEndpoint))

  const totalFee = historicalFees
    .filter(feeItem => (new Date(feeItem.time).getTime() / 1000) <= dayTimestamp)
    .reduce((acc, { fees_spent }) => acc + fees_spent, 0)

  const dailyFee = historicalFees
    .find(dayItem => (new Date(dayItem.time).getTime() / 1000) === dayTimestamp)?.fees_spent

  return {
    timestamp: dayTimestamp,
    totalFees: `${totalFee}`,
    dailyFees: dailyFee ? `${dailyFee}` : undefined,
    totalRevenue: "0",
    dailyRevenue: "0",
  };
};

const adapter: Adapter = {
  adapter: {
    [CHAIN.COSMOS]: {
      fetch,
      runAtCurrTime: true,
      start: 1665964800,
    },
  }
}

export default adapter;
