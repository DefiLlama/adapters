import {Adapter, ChainEndpoints} from "../../adapters/types";
import {CHAIN} from "../../helpers/chains";
import {Bet, BetResult} from "./types";
import {Chain} from "@defillama/sdk/build/general";
import {request, gql} from "graphql-request";
import {getTimestampAtStartOfDayUTC} from "../../utils/date";

const endpoints = {
    [CHAIN.ARBITRUM]: "https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-arbitrum-one-v2",
    [CHAIN.POLYGON]: "https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-polygon-v2",
    [CHAIN.XDAI]: "https://thegraph.azuro.org/subgraphs/name/azuro-protocol/azuro-api-gnosis-v2",
}

const graphs = (graphUrls: ChainEndpoints) => {
    return (chain: Chain) => {
        return async (timestamp: number) => {
            const todaysTimestamp = getTimestampAtStartOfDayUTC(timestamp)
            const fromTimestamp = todaysTimestamp - 60 * 60 * 24
            const toTimestamp = todaysTimestamp
            const bets: Bet[] = []
            let skip = 0

            while (true) {
                const graphQuery = gql`
                    {
                        bets(
                            where: {
                            status: Resolved,
                            _isFreebet: false
                            createdBlockTimestamp_gte: ${fromTimestamp},
                            createdBlockTimestamp_lte: ${toTimestamp},
                            }
                            first: 1000,
                            skip: ${skip}
                        ) {
                            amount
                            odds
                            result
                        }
                    }
                    `;
                const graphRes = await request(graphUrls[chain], graphQuery);

                bets.push(...graphRes.bets)
                skip += 1000

                if (graphRes.bets.length < 1000) break
            }

            const totalBetsAmount = bets.reduce((e: number, {amount}) => e+Number(amount), 0)
            const wonAmount = bets.filter(({result}) => result === BetResult.Won)
                                 .reduce((e: number, {amount, odds}) => e+Number(amount) * Number(odds), 0)

            const totalPoolProfit = totalBetsAmount - wonAmount;
            const dailyFees = totalPoolProfit;
            const dailyRevenue = totalPoolProfit;

            return {
                timestamp,
                dailyFees: dailyFees.toString(),
                dailyRevenue: dailyRevenue.toString(),
            };
        }
    }
}

const methodology = {
    Fees: "Total pools profits (equals total bets amount minus total won bets amount)",
    Revenue: "Total pools profits (equals total bets amount minus total won bets amount)",
}

const adapter: Adapter = {
    adapter: {
        [CHAIN.POLYGON]: {
            fetch: graphs(endpoints)(CHAIN.POLYGON),
            start: async () => 1657756800,
            meta: {
                methodology
            }
        },
        [CHAIN.XDAI]: {
            fetch: graphs(endpoints)(CHAIN.XDAI),
            start: async () => 1657756800,
            meta: {
                methodology
            }
        },
        [CHAIN.ARBITRUM]: {
            fetch: graphs(endpoints)(CHAIN.ARBITRUM),
            start: async () => 1657756800,
            meta: {
                methodology
            }
        },
    }
}

export default adapter;
