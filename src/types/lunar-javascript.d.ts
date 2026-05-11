declare module 'lunar-javascript' {
  export interface SolarDate {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }

  export interface LunarDate {
    getSolar(): SolarDate;
  }

  export const Lunar: {
    fromYmd(year: number, month: number, day: number): LunarDate;
  };
}
