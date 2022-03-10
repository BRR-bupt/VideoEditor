// @ts-ignore
import packageJson from '../package.json'
import { Asset, AudioAsset, FontAsset, VideoAsset, ImageAsset } from './assets'
import { Strip, AudioStrip, VideoStrip, TextStrip, ImageStrip } from './strips'
import type { IProject } from './Project'

const _VERSION_ = packageJson.version

export {
  Strip,
  TextStrip,
  AudioStrip,
  VideoStrip,
  Asset,
  AudioAsset,
  FontAsset,
  VideoAsset,
  IProject,
  ImageStrip,
  ImageAsset,
  _VERSION_
}
