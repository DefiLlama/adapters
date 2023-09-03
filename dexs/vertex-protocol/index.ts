import { BreakdownAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import axios from "axios";

interface IVolumeall {
  timestamp: string;
  volume: string;
  close_x18: string;
}

interface IProducts {
  spot_products: number[];
  perp_products: number[];
  margined_products: number[];
}

const baseUrl = "https://prod.vertexprotocol-backend.com";

const fetchProducts = async (): Promise<IProducts> => {
  const allProducts = (await axios.get(`${baseUrl}/query?type=all_products`))
    .data.data;
  return {
    spot_products: allProducts.spot_products
      .map((product: { product_id: number }) => product.product_id)
      .filter((id: number) => id > 0),
    perp_products: allProducts.perp_products.map(
      (product: { product_id: number }) => product.product_id
    ),
    margined_products: allProducts.spot_products
      .map((product: { product_id: number }) => product.product_id)
      .filter((id: number) => id > 0),
  };
};

const computeVolume = async (timestamp: number, productIds: number[]) => {
  const toTimestamp = timestamp;
  const fromTimestamp = timestamp - 60 * 60 * 24;
  const GRANULARITY = 300;
  const LIMIT = 86400 / GRANULARITY;
  const historicalVolume: IVolumeall[] = (
    await Promise.all(
      productIds.map((productId: number) =>
        axios.post(`${baseUrl}/indexer`, {
          candlesticks: {
            product_id: productId,
            granularity: GRANULARITY,
            limit: LIMIT,
            max_time: toTimestamp,
          },
        })
      )
    )
  )
    .map((e: any) => e.data.candlesticks)
    .flat();
  const volume = historicalVolume
    .filter((e: IVolumeall) => Number(e.timestamp) >= fromTimestamp)
    .reduce(
      (acc: number, b: IVolumeall) =>
        acc + (Number(b.volume) * Number(b.close_x18)) / 10 ** 18,
      0
    );
  const dailyVolume = volume / 10 ** 18;
  const cumulativeVolumes: Record<string, string> = (
    await axios.post(`${baseUrl}/indexer`, {
      market_snapshots: {
        interval: {
          count: 1,
          granularity: 3600,
        },
        product_ids: productIds,
      },
    })
  ).data.snapshots[0].cumulative_volumes;
  const totalVolume = Number(
    Object.values(cumulativeVolumes).reduce(
      (acc, current) => acc + BigInt(current),
      BigInt(0)
    ) / BigInt(10 ** 18)
  );
  return {
    totalVolume: totalVolume ? `${totalVolume}` : undefined,
    dailyVolume: dailyVolume ? `${dailyVolume}` : undefined,
    timestamp: timestamp,
  };
};

const fetchSpots = async (timeStamp: number) => {
  const spotProductIds = (await fetchProducts()).spot_products;
  return await computeVolume(timeStamp, spotProductIds);
};

const fetchPerps = async (timeStamp: number) => {
  const perpProductIds = (await fetchProducts()).perp_products;
  const marginedProductIds = (await fetchProducts()).margined_products;
  return await computeVolume(
    timeStamp,
    perpProductIds.concat(marginedProductIds)
  );
};

const startTime = 1682514000;

const adapter: BreakdownAdapter = {
  breakdown: {
    swap: {
      [CHAIN.ARBITRUM]: {
        fetch: fetchSpots,
        start: async () => startTime,
      },
    },
    derivatives: {
      [CHAIN.ARBITRUM]: {
        fetch: fetchPerps,
        start: async () => startTime,
      },
    },
  },
};

export default adapter;
