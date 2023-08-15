import axios from "axios";

const apiUrl = "https://app.sentio.xyz/api/v1/insights/wayne/typus/query";

const headers = {
  "api-key": "UcELWyfhQjJcb26aSc59JvAYXU3x3eBGh",
  "Content-Type": "application/json",
};

const requestData = {
  timeRange: {
    start: "-1M",
    end: "now",
    step: 86400,
    timezone: "Asia/Taipei",
  },
  limit: 20,
  queries: [
    {
      metricsQuery: {
        query: "deliverySizeUSD",
        alias: "SUM",
        id: "a",
        labelSelector: {},
        aggregate: {
          op: "SUM",
          grouping: [],
        },
        functions: [],
        disabled: false,
      },
      dataSource: "METRICS",
      sourceName: "",
    },
  ],
};

export async function getDataFromSentio(
  query: string,
  start?: string,
  end?: string,
  step?: number
): Promise<Value[]> {
  if (start) {
    requestData.timeRange.start = start;
  }
  if (end) {
    requestData.timeRange.end = end;
  }
  if (step) {
    requestData.timeRange.step = step;
  }

  requestData.queries[0].metricsQuery.query = query;


  const response = await axios.post(apiUrl, requestData, { headers: headers});

  const data = response.data;

  const r: Value[] = data.results[0].matrix.samples[0].values;

  return r;
}

interface Value {
  timestamp: string;
  value: number;
}

interface ChainData {
  totalPremiumVolume: number;
  dailyPremiumVolume: number;
  totalNotionalVolume: number;
  dailyNotionalVolume: number;
  timestamp: string;
}

async function getChainData(timestamp: string): Promise<ChainData> {
  let ts = Number(timestamp);
  ts = ts - (ts % (24 * 60 * 60)) + 16 * 60 * 60;
  timestamp = ts.toString();

  let deliverySizeUSDs = await getDataFromSentio(
    "deliverySizeUSD",
    "1677918120",
    timestamp
  );

  let totalNotionalVolume = deliverySizeUSDs.reduce(
    (acc, curr) => curr.value + acc,
    0
  );
  let dailyNotionalVolume = 0;
  let deliverySizeUSD = deliverySizeUSDs.find((v) => v.timestamp == timestamp);
  if (deliverySizeUSD) {
    dailyNotionalVolume = deliverySizeUSD.value;
  }

  // console.log(deliverySizeUSDs);

  let premiumUSDs = await getDataFromSentio(
    "premiumUSD",
    "1677918120",
    timestamp
  );

  let totalPremiumVolume = premiumUSDs.reduce(
    (acc, curr) => curr.value + acc,
    0
  );
  let dailyPremiumVolume = 0;
  let premiumUSD = premiumUSDs.find((v) => v.timestamp == timestamp);
  if (premiumUSD) {
    dailyPremiumVolume = premiumUSD.value;
  }

  // console.log(premiumUSDs);

  return {
    timestamp,
    totalNotionalVolume,
    dailyNotionalVolume,
    totalPremiumVolume,
    dailyPremiumVolume,
  };
}

export default getChainData;

// (async () => {
//   console.log(await getChainData("1689984000"));
// })();
