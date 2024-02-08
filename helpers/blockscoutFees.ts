import { getTimestampAtStartOfDayUTC } from "../utils/date";
import { getPrices } from "../utils/prices";
import { Adapter, ProtocolType } from "../adapters/types";
import { httpGet } from '../utils/fetchURL';

export function blockscoutFeeAdapter(chain:string, url:string, coin:string){
    const adapter: Adapter = {
        adapter: {
          [chain]: {
              fetch:  async (timestamp: number) => {
                    const ts = getTimestampAtStartOfDayUTC(timestamp)
                  const date = new Date(ts*1000).toISOString().slice(0, "2011-10-05".length)
                  const fees = await httpGet(`${url}&date=${date}`)
                  const prices = await getPrices([coin], timestamp);
                  const usdFees = Number(fees.result)/1e18*prices[coin].price

                  return {
                      timestamp,
                      dailyFees: usdFees.toString(), 
                  };
              },
              start: 1575158400
          },
      },
        protocolType: ProtocolType.CHAIN
      }
    
    return adapter
}
