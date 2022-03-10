import { v4 } from 'uuid'
import { AudioAsset } from '../assets'
import { IStrip, Strip } from './Strip'
import { PlayMode, PLAY_EVERY_FRAME } from '~/plugins/config'
import { ProjError } from '~/plugins/error'

const FPS_ERROR_TOLERANCE = 0.01
const ASSET_SEEK_TIMEOUT_MS = 10000

export type IAudioStrip = IStrip & {
  id?: string
  start?: number
  length?: number
  layer?: number
  type?: string
  src: string
  readonly assetId: string
}

export class AudioStrip extends Strip {
  readonly audio!: HTMLAudioElement
  readonly type: string = 'Audio'
  asset: AudioAsset | null = null

  playRequests: number[] = []

  loaded: boolean = false

  get src() {
    return this.audio.src
  }

  constructor(iface: IStrip, asset?: AudioAsset) {
    super()
    this.audio = document.createElement('audio')
    this.audio.loop = false

    this.start = iface.start
    this.id = iface.id
    this.layer = iface.layer
    this.length = iface.length
    this.updateAsset(asset)

    if (iface.id) {
      this.id = iface.id
    } else {
      this.id = v4()
    }
  }

  public updateAsset(asset?: AudioAsset) {
    if (!asset) {
      this.audio.src = ''
      this.loaded = false
      return
    }
    this.loaded = false
    this.asset = asset
    this.audio.src = asset.path
    this.audio.onloadedmetadata = () => {
      this.loaded = true
    }
    this.audio.load()
  }

  public toInterface(): IAudioStrip {
    return {
      id: this.id,
      length: this.length,
      start: this.start,
      type: this.type,
      layer: this.layer,
      src: this.asset?.path || '',
      assetId: this.asset?.id || ''
    }
  }

  wait(time: number) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ProjError('Audio Seek Timeout'))
      }, ASSET_SEEK_TIMEOUT_MS)
      this.audio.onseeked = () => {
        clearTimeout(timeout)
        resolve(true)
      }
      this.audio.currentTime = time
    })
  }

  public async update(time: number, delta: number, isPlay: boolean, playMode: PlayMode, fps: number) {
    if (!this.loaded) return
    const lwoFps = delta < 1000 / fps - FPS_ERROR_TOLERANCE
    if (this.start < time && time < this.end) {
      this.audio.volume = 1
      if (isPlay && this.audio.paused) {
        this.playRequests.push(0)
        this.audio.play().then(() => {
          this.playRequests.pop()
        })
        this.audio.currentTime = time - this.start
      }
      if (!isPlay) {
        this.audio.pause()
      }
      if (lwoFps) {
        this.audio.currentTime = time - this.start
      }
      if (playMode == PLAY_EVERY_FRAME) {
        await this.wait(time - this.start)
      }
    } else {
      this.audio.volume = 0
    }
  }
}
