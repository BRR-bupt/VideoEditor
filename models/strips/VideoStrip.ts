import * as T from 'three'
import { VideoAsset } from '../assets'
import { IVector3 } from '../math/Vector3'
import { IStrip, Strip } from './Strip'
import { PlayMode, PLAY_EVERY_FRAME } from '~/plugins/config'
import { ProjError } from '~/plugins/error'

const FPS_ERROR_TOLERANCE = 0.01
const ASSET_SEEK_TIMEOUT_MS = 10000

export type IVideoStrip = IStrip & {
  id?: string
  start?: number
  length?: number
  position: IVector3
  percent?: number
  layer?: number
  type?: string
  src: string
  videoOffset: number
  readonly assetId: string
}

export class VideoStrip extends Strip {
  position: T.Vector3 = new T.Vector3(0, 0, 0)
  type: string = 'Video'

  loaded: boolean = false

  videoOffset: number = 0

  video!: HTMLVideoElement
  canvas?: HTMLCanvasElement
  obj!: T.Mesh
  ctx?: CanvasRenderingContext2D | null
  tex?: T.VideoTexture

  playRequests: number[] = []
  videoDuration: number = 0

  event: EventTarget = new EventTarget()

  videoAsset?: VideoAsset

  get src() {
    return this.video.src
  }

  constructor(iface: IVideoStrip, videoAsset?: VideoAsset) {
    super()
    this.videoAsset = videoAsset
    this.video = document.createElement('video')
    this.videoOffset = iface.videoOffset
    if (videoAsset) this.video.src = videoAsset.path
    this.position = new T.Vector3(iface.position.x, iface.position.y, iface.position.z)
    if (iface.length) this.length = iface.length
    if (iface.layer) this.layer = iface.layer
    if (iface.start) this.start = iface.start

    this.canvas = document.createElement('canvas')
    this.canvas.width = this.video.videoWidth
    this.canvas.height = this.video.videoHeight

    this.ctx = this.canvas.getContext('2d')
    if (!this.ctx) throw new Error('context2d error')
    this.ctx.fillStyle = '#ffffff'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    this.tex = new T.VideoTexture(this.video)
    this.tex.minFilter = T.LinearFilter
    this.tex.magFilter = T.LinearFilter

    const mat = new T.MeshBasicMaterial({
      map: this.tex,
      side: T.DoubleSide
    })
    const movieGeometry = new T.PlaneGeometry(this.canvas.width, this.canvas.height)
    this.obj = new T.Mesh(movieGeometry, mat)
    if (iface.id) {
      this.obj.uuid = iface.id
    }
    this.id = this.obj.uuid
    this.obj.position.copy(this.position)
    this.updateAsset(videoAsset)
  }

  public toInterface(): IVideoStrip {
    return {
      id: this.id,
      length: this.length,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      start: this.start,
      videoOffset: this.videoOffset,
      type: this.type,
      layer: this.layer,
      src: this.video.src,
      assetId: this.videoAsset?.id || ''
    }
  }

  public updateAsset(asset?: VideoAsset) {
    if (!asset) {
      this.video.src = ''
      this.loaded = false
      return
    }
    this.videoAsset = asset
    this.loaded = false
    asset.valid = false
    const onLoad = () => {
      if (!this.canvas) return
      if (this.loaded) return
      this.videoDuration = this.video.duration
      this.canvas.width = this.video.videoWidth
      this.canvas.height = this.video.videoHeight

      this.obj.geometry = new T.PlaneGeometry(this.canvas.width, this.canvas.height)
      console.log(this.video.videoWidth)
      console.log(this.video)

      this.loaded = true
      asset.valid = true
      this.event.dispatchEvent(new CustomEvent('update'))
    }
    this.video.onloadedmetadata = () => onLoad()
    this.video.src = asset.path
    this.video.load()
  }

  // 修改mesh.material的参数，可达到缩放效果
  fixPercent(percent: number) {
    this.obj.geometry = new T.PlaneGeometry(
      (this.video.videoWidth * percent) / 100,
      (this.video.videoHeight * percent) / 100
    )
  }

  public async update(time: number, delta: number, isPlay: boolean, playMode: PlayMode, fps: number) {
    const lwoFps = delta < 1000 / fps - FPS_ERROR_TOLERANCE
    if (this.tex) this.tex.needsUpdate = true
    if (this.ctx && this.video) this.ctx.drawImage(this.video, 0, 0)
    this.obj.position.copy(this.position)
    this.obj.position.setZ(this.layer)

    if (!this.loaded) {
      this.obj.visible = false
      return
    }
    if (this.start < time && time < this.end) {
      this.obj.visible = true
      this.video.volume = 1
      if (isPlay && this.video.paused) {
        this.playRequests.push(0)
        this.video.play().then(() => {
          this.playRequests.pop()
        })
        // 根据参数time：时间轴游标位置（editor.currentTime）和 strip.start及videoOffset
        // 计算得到该视频播放的位置
        this.video.currentTime = time - this.start + this.videoOffset
      }
      if (!isPlay) {
        this.video.pause()
      }
      if (lwoFps) {
        this.video.currentTime = time - this.start + this.videoOffset
      }
      // if渲染模式
      if (playMode == PLAY_EVERY_FRAME) {
        await this.wait(time - this.start + this.videoOffset)
      }
    } else {
      // else 为编辑模式
      // 如果时间游标不在视频范围内，则执行 this.obj.visible = false 操作，隐藏视频
      // this.obj（videoStrip.obj） 正是 scene 的内容，从而完成对scene的更新
      // three.js渲染scene的结果便得到更新
      this.video.volume = 0
      if (!this.video.paused) {
        this.video.pause()
      }
      this.obj.visible = false
    }
  }

  wait(time: number) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ProjError('Video Seek Timeout'))
      }, ASSET_SEEK_TIMEOUT_MS)
      this.video.onseeked = () => {
        clearTimeout(timeout)
        resolve(true)
      }
      this.video.currentTime = time + this.videoOffset
    })
  }
}
