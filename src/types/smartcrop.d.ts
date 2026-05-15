declare module 'smartcrop' {
  export interface CropOptions {
    width: number;
    height: number;
    minScale?: number;
    ruleOfThirds?: boolean;
    debug?: boolean;
  }
  
  export interface CropResult {
    topCrop: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }

  export function crop(image: HTMLImageElement | HTMLCanvasElement, options: CropOptions): Promise<CropResult>;
}
