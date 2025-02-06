import { FetchOptions, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import fetchURL from "../../utils/fetchURL";

const adapter: SimpleAdapter = {
  adapter: {
    [CHAIN.TON]: {
      fetch: async (timestamp: number, _t: any, options: FetchOptions) => {
        const result = await fetchURL(
          `https://api.prophet.click/history?timestamp=${options.startOfDay * 1000}`
        );

        return {
          ...result,
          timestamp,
        };
      },
      start: 1719847914,
      meta: {
        methodology: {
          Volume: "Parimutual bets volume",
        },
      },
    },
  },
};

export default adapter;
