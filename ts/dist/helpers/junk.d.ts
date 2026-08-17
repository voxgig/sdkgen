declare const NOISE: RegExp[];
declare const BUILD: RegExp[];
declare const JUNK: RegExp[];
declare function isJunk(name: string): boolean;
declare function isNoise(name: string): boolean;
declare function copyOpts(): {
    Copy: {
        ignore: RegExp[];
    };
};
export { JUNK, NOISE, BUILD, isJunk, isNoise, copyOpts, };
