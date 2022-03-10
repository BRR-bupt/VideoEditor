import { ProjError } from './error'
import { Asset, AudioAsset, ImageAsset, VideoAsset } from '~/models'
import {
  AudioStrip,
  IImageStrip,
  ImageStrip,
  IStrip,
  ITextStrip,
  TextStrip,
  IVideoStrip,
  VideoStrip,
  Strip
} from '~/models/strips'

export class StripUtil {
  public static isThreeJsStrip(strip: Strip): strip is VideoStrip | TextStrip | ImageStrip {
    return strip instanceof VideoStrip || strip instanceof TextStrip || strip instanceof ImageStrip
  }

  public static interfacesToInstances(strips: IStrip[], assets: Asset[]) {
    const getAssetById = (id: string) => {
      return assets.find(a => a.id == id)
    }
    return strips.map(s => {
      if (s.type == 'Video') {
        const ivs = JSON.parse(JSON.stringify(s)) as IVideoStrip
        const va = getAssetById(ivs.assetId) as VideoAsset | undefined
        return new VideoStrip(ivs, va)
      } else if (s.type == 'Audio') {
        const ias = JSON.parse(JSON.stringify(s)) as IVideoStrip
        const aa = getAssetById(ias.assetId) as AudioAsset | undefined
        return new AudioStrip(s, aa)
      } else if (s.type == 'Image') {
        const is = JSON.parse(JSON.stringify(s)) as IImageStrip
        const aa = getAssetById(is.assetId) as ImageAsset | undefined
        return new ImageStrip(is, aa)
      } else if (s.type == 'Text') {
        const is = JSON.parse(JSON.stringify(s)) as ITextStrip
        return new TextStrip(is)
      } else {
        throw new ProjError('Error Undefined Strip Type: ' + s.type)
      }
    })
  }
}
