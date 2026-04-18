import { calcNetApr, calcEarningsUsd } from "./lite-position-math";

export type LitePositionStatus = "active" | "risky" | "liquidation";

export interface LitePosition {
  id: string;
  poolId: string;
  poolLabel: string;
  protocol: string;
  poolVersion: string;
  collateralAsset: string;
  collateralAmount: number;
  collateralUsd: number;
  borrowAsset: string;
  borrowAmount: number;
  borrowUsd: number;
  leverage: number;
  supplyApr: number;
  vannaFeeApr: number;
  netApr: number;
  earningsUsd: number;
  healthFactor: number;
  liquidationLtv: number;
  status: LitePositionStatus;
  openedAt: string;
}

/* ═══ Mock positions — numbers derived from lite-position-math ═══
 *
 * All rows use the SAME formulas shipped with the math helper, so whatever the
 * sidebar displays matches the list. Stellar EOA integration will replace this
 * array with a real fetch; the shape and math are unchanged.
 */

interface BuildArgs {
  id: string;
  poolId: string;
  protocol: string;
  poolVersion: string;
  asset: string;
  priceUsd: number;
  collateralAmount: number;
  leverage: number;
  supplyApr: number;
  vannaFeeApr: number;
  healthFactor: number;
  liquidationLtv: number;
  status: LitePositionStatus;
  openedAt: string;
  elapsedYears: number;
}

const buildPosition = (a: BuildArgs): LitePosition => {
  const collateralUsd = a.collateralAmount * a.priceUsd;
  const borrowAmount = a.collateralAmount * (a.leverage - 1);
  const borrowUsd = borrowAmount * a.priceUsd;
  const netApr = calcNetApr({
    supplyApr: a.supplyApr,
    vannaFeeApr: a.vannaFeeApr,
    leverage: a.leverage,
  });
  const earningsUsd = calcEarningsUsd(collateralUsd, netApr, a.elapsedYears);
  return {
    id: a.id,
    poolId: a.poolId,
    poolLabel: a.asset,
    protocol: a.protocol,
    poolVersion: a.poolVersion,
    collateralAsset: a.asset,
    collateralAmount: a.collateralAmount,
    collateralUsd,
    borrowAsset: a.asset,
    borrowAmount,
    borrowUsd,
    leverage: a.leverage,
    supplyApr: a.supplyApr,
    vannaFeeApr: a.vannaFeeApr,
    netApr,
    earningsUsd,
    healthFactor: a.healthFactor,
    liquidationLtv: a.liquidationLtv,
    status: a.status,
    openedAt: a.openedAt,
  };
};

export const MOCK_LITE_POSITIONS: LitePosition[] = [
  /* User's spec: deposit 1 ETH, borrow 5 ETH → 6× leverage, ETH 5%, fee 6%.
     netApr = 6·5 − 5·6 = 0%.  Shown so user can see break-even rendering. */
  buildPosition({
    id: "pos-eth-6x",
    poolId: "eth-aave",
    protocol: "Aave",
    poolVersion: "V3",
    asset: "ETH",
    priceUsd: 3500,
    collateralAmount: 1,
    leverage: 6,
    supplyApr: 5,
    vannaFeeApr: 6,
    healthFactor: 1.38,
    liquidationLtv: 82,
    status: "risky",
    openedAt: "1d ago",
    elapsedYears: 1 / 365,
  }),
  /* Same deposit size, USDC pool.  USDC 3%, fee 6%, 6×.
     netApr = 6·3 − 5·6 = −12% (loss — realistic at these rates). */
  buildPosition({
    id: "pos-usdc-6x",
    poolId: "usdc-aave",
    protocol: "Aave",
    poolVersion: "V3",
    asset: "USDC",
    priceUsd: 1,
    collateralAmount: 1000,
    leverage: 6,
    supplyApr: 3,
    vannaFeeApr: 6,
    healthFactor: 1.42,
    liquidationLtv: 86,
    status: "risky",
    openedAt: "3d ago",
    elapsedYears: 3 / 365,
  }),
  /* Healthy profitable scenario: USDC 10% / fee 6% / 5× → netApr = 26%. */
  buildPosition({
    id: "pos-usdc-5x",
    poolId: "usdc-aave-prime",
    protocol: "Aave",
    poolVersion: "V3",
    asset: "USDC",
    priceUsd: 1,
    collateralAmount: 1000,
    leverage: 5,
    supplyApr: 10,
    vannaFeeApr: 6,
    healthFactor: 1.67,
    liquidationLtv: 86,
    status: "active",
    openedAt: "12d ago",
    elapsedYears: 12 / 365,
  }),
];
