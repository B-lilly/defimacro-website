// --- Crypto Data ---
const CURRENCIES = [
  { symbol: 'ETH', name: 'Ethereum', pair: 'ETH/USD', basePrice: 2450, volatility: 80, gdp: 28.5, moneyMultiplier: 3.42, networkYield: 4.12, moneyMarketYield: 5.87, flexRating: 92 },
  { symbol: 'BTC', name: 'Bitcoin', pair: 'BTC/USD', basePrice: 68500, volatility: 2200, gdp: 52.1, moneyMultiplier: 2.18, networkYield: 0.00, moneyMarketYield: 3.21, flexRating: 88 },
  { symbol: 'SOL', name: 'Solana', pair: 'SOL/USD', basePrice: 142, volatility: 8, gdp: 8.7, moneyMultiplier: 4.85, networkYield: 6.73, moneyMarketYield: 7.45, flexRating: 78 },
  { symbol: 'AVAX', name: 'Avalanche', pair: 'AVAX/USD', basePrice: 38, volatility: 2.5, gdp: 3.2, moneyMultiplier: 2.91, networkYield: 8.24, moneyMarketYield: 6.12, flexRating: 71 },
  { symbol: 'MATIC', name: 'Polygon', pair: 'MATIC/USD', basePrice: 0.92, volatility: 0.06, gdp: 1.8, moneyMultiplier: 3.67, networkYield: 5.18, moneyMarketYield: 4.93, flexRating: 69 },
  { symbol: 'ARB', name: 'Arbitrum', pair: 'ARB/USD', basePrice: 1.18, volatility: 0.08, gdp: 4.1, moneyMultiplier: 5.12, networkYield: 0.00, moneyMarketYield: 8.34, flexRating: 74 },
  { symbol: 'OP', name: 'Optimism', pair: 'OP/USD', basePrice: 2.85, volatility: 0.18, gdp: 3.5, moneyMultiplier: 4.28, networkYield: 0.00, moneyMarketYield: 7.56, flexRating: 72 },
  { symbol: 'LINK', name: 'Chainlink', pair: 'LINK/USD', basePrice: 18.50, volatility: 1.2, gdp: 6.4, moneyMultiplier: 1.95, networkYield: 4.52, moneyMarketYield: 3.88, flexRating: 81 },
  { symbol: 'UNI', name: 'Uniswap', pair: 'UNI/USD', basePrice: 12.40, volatility: 0.8, gdp: 5.2, moneyMultiplier: 2.73, networkYield: 0.00, moneyMarketYield: 5.14, flexRating: 76 },
  { symbol: 'AAVE', name: 'Aave', pair: 'AAVE/USD', basePrice: 105, volatility: 6, gdp: 7.8, moneyMultiplier: 6.24, networkYield: 3.89, moneyMarketYield: 9.42, flexRating: 85 },
  { symbol: 'TOTAL', name: 'Total Crypto', pair: 'TOTAL/USD', basePrice: 2850000000000, volatility: 95000000000, gdp: 121.4, moneyMultiplier: 3.15, networkYield: 2.84, moneyMarketYield: 5.62, flexRating: 82 },
];

const METRIC_CONFIG = {
  gdp: { label: 'GDP', base: 'gdp', vol: 2 },
  moneyMultiplier: { label: 'Money Multiplier', base: 'moneyMultiplier', vol: 0.3 },
  networkYield: { label: 'Network Yield', base: 'networkYield', vol: 0.4 },
  moneyMarketYield: { label: 'Money Market Yield', base: 'moneyMarketYield', vol: 0.5 },
  flexRating: { label: 'Flex Rating', base: 'flexRating', vol: 3 },
};

const OVERLAY_COLORS = ['#E9072B', '#68B8B8'];

const tfDaysMap = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365, '5Y': 1825 };

// --- Sample Data Generation ---
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateLineData(days, basePrice, volatility, seed) {
  const rng = seededRandom(seed);
  const data = [];
  let price = basePrice;
  const now = new Date();
  now.setDate(now.getDate() - days);
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    price += (rng() - 0.48) * volatility;
    price = Math.max(price * 0.95, price);
    data.push({ time: dateStr, value: parseFloat(price.toFixed(2)) });
  }
  return data;
}

function generateMetricData(days, baseValue, volatility, seed) {
  const rng = seededRandom(seed);
  const data = [];
  let value = baseValue;
  const now = new Date();
  now.setDate(now.getDate() - days);
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    value += (rng() - 0.5) * volatility;
    value = Math.max(0.01, value);
    data.push({ time: dateStr, value: parseFloat(value.toFixed(4)) });
  }
  return data;
}

function generateBarData(days, basePrice, volatility, seed) {
  const rng = seededRandom(seed);
  const data = [];
  let price = basePrice;
  const now = new Date();
  now.setDate(now.getDate() - days);
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const open = price;
    price += (rng() - 0.48) * volatility;
    const close = parseFloat(price.toFixed(2));
    const high = Math.max(open, close) + rng() * volatility * 0.5;
    const low = Math.min(open, close) - rng() * volatility * 0.5;
    data.push({
      time: dateStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: close,
    });
  }
  return data;
}

function getDaysForTf(tf) { return tfDaysMap[tf] || 30; }
function getPriceSeed(c, tf) { return hashStr(c.symbol + '_price_' + tf); }
function getMetricSeed(c, m, tf) { return hashStr(c.symbol + '_' + m + '_' + tf); }
