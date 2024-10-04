import * as sdk from "@defillama/sdk";
import { Adapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import { gql, GraphQLClient } from "graphql-request";
import type { ChainEndpoints, FetchOptions } from "../../adapters/types";
import { Chain } from "@defillama/sdk/build/general";



const endpoints = {
    [CHAIN.FLOW]: "https://perpgql.trado.one/subgraphs/name/trado/flow"
  };
  
const blockNumberGraph = {
    [CHAIN.FLOW]: "https://perpgql.trado.one/subgraphs/name/trado/flow_blocks" 
}

const headers = { 'sex-dev': 'ServerDev'}

const graphs = (graphUrls: ChainEndpoints) => {
  return (chain: Chain) => {
    return async ({ toTimestamp }: FetchOptions) => {

        // Get blockNumers
        const blockNumerQuery = gql`
        {
            blocks(
              where: {timestamp_lte:${toTimestamp}}
              orderBy: timestamp
              orderDirection: desc
              first: 1
            ) {
              id
              number
            }
          }
        `;
        const last24hBlockNumberQuery = gql`
        {
            blocks(
              where: {timestamp_lte:${toTimestamp - 24 * 60 * 60}}
              orderBy: timestamp
              orderDirection: desc
              first: 1
            ) {
              id
              number
            }
          }
        `;

        const blockNumberGraphQLClient = new GraphQLClient(blockNumberGraph[chain], {
                headers: chain === CHAIN.ZETA ? headers: null,
        });
        const graphQLClient = new GraphQLClient(graphUrls[chain], {
      		headers: chain === CHAIN.ZETA ? headers: null,
    	});


        const blockNumber = (
          await blockNumberGraphQLClient.request(blockNumerQuery)
        ).blocks[0].number;
        const last24hBlockNumber = (
          await blockNumberGraphQLClient.request(last24hBlockNumberQuery)
        ).blocks[0].number;


        // get total fee
        const totalFeeQuery = gql`
            {
              protocolMetrics(block:{number:${blockNumber}}){
                totalFee
              }
            }
          `;

        // get total fee 24 hours ago
        const last24hTotalFeeQuery = gql`
          {
            protocolMetrics(block:{number:${last24hBlockNumber}}){
                totalFee
            }
          }
        `;
          

        let totalFee = (
          await graphQLClient.request(totalFeeQuery)
        ).protocolMetrics[0].totalFee

        let last24hTotalFee = (
          await graphQLClient.request(last24hTotalFeeQuery)
        ).protocolMetrics[0].totalFee

        totalFee = Number(totalFee) / 10 ** 6
        const dailyFee = Number(totalFee) - (Number(last24hTotalFee) / 10 ** 6)

        return {
          dailyFees: dailyFee.toString(),
          totalFees: totalFee.toString(),
        };
      }

      return {
        dailyFees: "0",
        totalFees: "0",
      };
    };
};

const adapter: Adapter = {
  version: 2,
  adapter: {
    [CHAIN.FLOW]: {
      fetch: graphs(endpoints)(CHAIN.FLOW),
      start: 1430971,
    },
  },
};

export default adapter;
