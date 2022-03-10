import * as T from 'three'
import { MeshBasicMaterial, PlaneBufferGeometry } from 'three'
import { ImageAsset } from '../assets'
import { IVector3 } from '../math/Vector3'
import { IStrip, Strip } from './Strip'
import { PlayMode } from '~/plugins/config'

export type IImageStrip = IStrip & {
  id?: string
  start?: number
  length?: number
  position: IVector3
  percent?: number
  layer?: number
  type?: string
  src: string
  readonly assetId: string
}

export class ImageStrip extends Strip {
  position: T.Vector3 = new T.Vector3(0, 0, 0)
  type: string = 'Image'

  videoOffset: number = 0

  obj!: T.Mesh
  tex?: T.Texture

  playRequests: number[] = []
  videoDuration: number = 0

  event: EventTarget = new EventTarget()

  /**
   * quad plane geometry that forward -Z.
   * size is 1x1.
   */
  geometry!: PlaneBufferGeometry

  /**
   * material
   */
  material!: MeshBasicMaterial

  imageAsset?: ImageAsset

  get width() {
    return this.tex?.image ? this.tex.image.width : 0
  }

  get height() {
    return this.tex?.image ? this.tex.image.height : 0
  }

  constructor(iface: IImageStrip, imageAsset?: ImageAsset) {
    super()
    this.imageAsset = imageAsset
    this.position = new T.Vector3(iface.position.x, iface.position.y, iface.position.z)
    if (iface.length) this.length = iface.length
    if (iface.layer) this.layer = iface.layer
    if (iface.start) this.start = iface.start

    if (imageAsset) {
      this.tex = new T.TextureLoader().load(imageAsset?.path, () => {
        if (this.obj) {
          this.obj.scale.set(this.tex?.image.width, this.tex?.image.height, 1)
          // console.log('changeScale')
        }
      })
      this.tex.minFilter = T.LinearFilter
      this.tex.magFilter = T.LinearFilter
    }
    // 创建mesh所需的材料和物体，并创建mesh
    this.material = new T.MeshBasicMaterial({
      map: this.tex
    })
    this.geometry = new PlaneBufferGeometry(1, 1, 1, 1)
    this.obj = new T.Mesh(this.geometry, this.material)
    if (iface.id) {
      this.obj.uuid = iface.id
    }

    this.id = this.obj.uuid
    this.obj.position.set(this.position.x, this.position.y, this.position.z)
    // this.obj.scale.set((this.tex?.image.width * this.percent) / 100, (this.tex?.image.height * this.percent) / 100, 1)
  }

  public toInterface(): IImageStrip {
    return {
      id: this.id,
      length: this.length,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      start: this.start,
      type: this.type,
      layer: this.layer,
      src: this.imageAsset?.path || '',
      assetId: this.imageAsset?.id || ''
    }
  }

  // 将asset添加到strip中
  updateAsset(imageAsset: ImageAsset) {
    // 在strip模板中添加tex对象
    this.tex?.dispose()
    // 添加asset
    this.imageAsset = imageAsset

    new T.TextureLoader().load(imageAsset?.path, tex => {
      if (this.obj) {
        // 设置了obj:mesh的scale（规模），***利用该属性可实现渲染物体的缩放***
        // tex.image是image标签，具有src（path），应该是T.TextureLoader().load的作用创建
        this.obj.scale.set((tex.image.width * this.percent) / 100, (tex.image.height * this.percent) / 100, 1)
        console.log(tex.image)
      }
      tex.needsUpdate = true
      tex.minFilter = T.LinearFilter
      tex.magFilter = T.LinearFilter
      this.tex = tex
      // 没有material，scene渲染出来是纯白
      // 将tex：texture添加到了material.map中
      // 实现了把具有资产path的tex传递给了material.map
      // 而material是构造obj:mesh的参数，导致mesh链接到asset，渲染出资产
      this.material.map = this.tex
      this.material.needsUpdate = true
    })
  }

  fixPercent(percent: number) {
    if (this.obj) {
      this.obj.scale.set((this.width * percent) / 100, (this.height * percent) / 100, 1)
    }
  }

  public async update(time: number, _delta: number, _isPlay: boolean, _playMode: PlayMode, _fps: number) {
    this.obj.position.set(this.position.x, this.position.y, this.position.z)
    this.obj.position.setZ(this.layer)

    // 超出或未到存在时间段，visible = flase，不可见
    if (this.start < time && time < this.end) {
      this.obj.visible = true
    } else {
      this.obj.visible = false
    }

    return await new Promise<void>((resolve, reject) => {
      try {
        return resolve()
      } catch (e) {
        reject(e)
      }
    })
  }
}
