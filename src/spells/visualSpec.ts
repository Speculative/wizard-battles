import { deepFreeze } from "./deepFreeze";
export interface BurstPalette {
  inner: string;
  mid: string;
  outer: string;
  edge: string;
}

export const FIRE_PALETTE: BurstPalette = {
  inner: "rgba(255,140,40,1)",
  mid: "rgba(235,80,10,0.85)",
  outer: "rgba(180,30,0,0.3)",
  edge: "rgba(100,10,0,0)",
};

export const ICE_PALETTE: BurstPalette = {
  inner: "rgba(220,240,255,1)",
  mid: "rgba(120,180,240,0.85)",
  outer: "rgba(60,120,200,0.3)",
  edge: "rgba(20,40,80,0)",
};


deepFreeze(FIRE_PALETTE);
deepFreeze(ICE_PALETTE);
