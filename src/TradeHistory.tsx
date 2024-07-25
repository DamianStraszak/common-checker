// src/TradeHistory.tsx
import React, { useEffect, useState } from 'react';
import BN from 'bn.js';
import './TradeHistory.css'; // Assuming you have a CSS file for styling

interface MultiSwap {
  origin: string;
  token_in: string;
  token_out: string;
  path: string[];
  amount_in: string;
  amount_out: string;
  block_num: number;
  extrinsic_index: number;
}

interface QueryResult<T> {
  data: T;
  is_complete: boolean;
}

interface Token {
  address: string;
  symbol: string;
  decimals: number;
  price?: number;
}

const BACKEND_URL = 'https://common-indexer.azero-tools.com';

const TradeHistory: React.FC = () => {
  const [accountId, setAccountId] = useState<string>('');
  const [trades, setTrades] = useState<MultiSwap[]>([]);
  const [tokenMap, setTokenMap] = useState<Map<string, Token>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [totalVolume, setTotalVolume] = useState<number>(0);

  useEffect(() => {
    fetchTokens();
  }, []);

  useEffect(() => {
    calculateTotalVolume();
  }, [trades]);

  const fetchTokens = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/tokens`);
      if (!response.ok) throw new Error('Failed to fetch tokens');
      const data: Token[] = await response.json();
      const map = new Map(data.map(token => [token.address, token]));
      setTokenMap(map);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      const status = await response.json();

      const { indexed_till } = status;
      const start_query = indexed_till - 60 * 60 * 24;
      const end_query = indexed_till;

      // Construct query URL based on the presence of accountId
      let queryUrl = `${BACKEND_URL}/trades?block_start=${start_query}&block_stop=${end_query}`;
      if (accountId) {
        queryUrl += `&contract_address=${accountId}`;
      }

      const tradesResponse = await fetch(queryUrl);

      if (!tradesResponse.ok) throw new Error('Failed to fetch trades');

      const result: QueryResult<MultiSwap[]> = await tradesResponse.json();
      result.data.sort((a, b) => b.block_num - a.block_num);
      setTrades(result.data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountId(e.target.value);
  };

  const handleButtonClick = () => {
    fetchTrades();
  };

  const getSymbol = (address: string) => tokenMap.get(address)?.symbol || address;

  const formatAmountWithToken = (amount: string, address: string) => {
    const token = tokenMap.get(address);
    if (!token) return amount;
    const { decimals, symbol } = token;
    const bnAmount = new BN(amount);
    const divisor = new BN(10).pow(new BN(decimals));
  
    const integerPart = bnAmount.div(divisor).toString();
    let fractionalPart = bnAmount.mod(divisor).toString().padStart(decimals, '0');
    
    if (fractionalPart.length > 3) {
      fractionalPart = fractionalPart.slice(0, 3);
    }
  
    return `${integerPart}.${fractionalPart} ${symbol}`;
  };

  const calculateVolume = (trade: MultiSwap) => {
    const tokenIn = tokenMap.get(trade.token_in);
    const tokenOut = tokenMap.get(trade.token_out);
  
    const priceIn = tokenIn?.price || 0.0;
    const priceOut = tokenOut?.price || 0.0;
  
    const amountIn = new BN(trade.amount_in);
    const amountOut = new BN(trade.amount_out);
  
    const divisorIn = new BN(10).pow(new BN(tokenIn?.decimals || 0));
    const divisorOut = new BN(10).pow(new BN(tokenOut?.decimals || 0));
  
    // Convert to human-readable format
    const humanAmountInFloat = parseFloat(amountIn.toString()) / parseFloat(divisorIn.toString());
    const humanAmountOutFloat = parseFloat(amountOut.toString()) / parseFloat(divisorOut.toString());
  
    const valueIn = humanAmountInFloat * priceIn;
    const valueOut = humanAmountOutFloat * priceOut;
  
    const volume = Math.max(valueIn, valueOut);
  
    return volume.toFixed(3); // Show up to 3 decimal places
  };

  const calculateTotalVolume = () => {
    const total = trades.reduce((acc, trade) => acc + parseFloat(calculateVolume(trade)), 0);
    setTotalVolume(total);
  };

  return (
    <div className="trade-history">
      <h1>Trade History</h1>
      <input
        type="text"
        placeholder="Enter Account ID"
        value={accountId}
        onChange={handleInputChange}
      />
      <button onClick={handleButtonClick}>Show</button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div className="total-volume">
        <h2>Total Volume: {totalVolume.toFixed(3)}</h2>
      </div>

      <div className="table-container">
        {trades.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Block Number</th>
                <th>User</th>
                <th>Sell Amount</th>
                <th>Buy Amount</th>
                <th>Path</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr key={index}>
                  <td>{trade.block_num}</td>
                  <td>{trade.origin}</td>
                  <td>{formatAmountWithToken(trade.amount_in, trade.token_in)}</td>
                  <td>{formatAmountWithToken(trade.amount_out, trade.token_out)}</td>
                  <td>{trade.path.map(getSymbol).join(' -> ')}</td>
                  <td>{calculateVolume(trade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No trades found for this account.</p>
        )}
      </div>
    </div>
  );
};

export default TradeHistory;
