import { IAsset, IAudioAsset, IFontAsset, IImageAsset, IVideoAsset, Asset } from './assets'
import { Strip, IImageStrip, IStrip, IVideoStrip } from './strips'
import { _VERSION_ } from '.'
import { AssetUtil } from '~/plugins/asset'
import { StripUtil } from '~/plugins/strip'

export interface IProject {
  version: string
  name: string
  width: number
  height: number
  fps: number
  duration: number

  assets: (IAsset | IAudioAsset | IVideoAsset | IFontAsset | IImageAsset)[]
  strips: (IStrip | IVideoStrip | IImageStrip)[]
}

export class Project implements IProject {
  version: string
  name: string
  width: number
  height: number
  fps: number
  duration: number
  assets: Asset[]
  strips: Strip[]
  constructor(i: IProject) {
    i = migrationProject(i)
    this.version = i.version
    this.name = i.name
    this.width = i.width
    this.height = i.height
    this.fps = i.fps
    this.duration = i.duration
    this.assets = AssetUtil.interfacesToInstances(i.assets)
    this.strips = StripUtil.interfacesToInstances(i.strips, this.assets)
  }

  toJSON(): IProject {
    return {
      name: this.name,
      width: this.width,
      height: this.height,
      fps: this.fps,
      duration: this.duration,
      version: _VERSION_,
      assets: this.assets.map(a => a.toInterface()),
      strips: this.strips.map(s => s.toInterface())
    }
  }
}

/**
 * compare two version like v1.2.3
 * @param a
 * @param b
 * @returns a > b
 */
function newVersion(a: string, b: string) {
  a = a.replace('v', '')
  b = b.replace('v', '')
  return (
    a
      .split('.')
      .map(x => x.padStart(5, '0'))
      .join('') >
    b
      .split('.')
      .map(x => x.padStart(5, '0'))
      .join('')
  )
}

export function migrationProject(project: IProject) {
  if (newVersion('v0.0.4', project.version)) {
    project.strips.forEach(s => {
      if (s.type == 'Text') {
        // @ts-ignore
        // force update readonly property.
        s.type = 'Text3D'
      }
    })
  }
  return project
}

export function isProject(input: any): input is IProject {
  return (
    typeof input.version == 'string' &&
    typeof input.name == 'string' &&
    typeof input.width == 'number' &&
    typeof input.height == 'number' &&
    typeof input.fps == 'number' &&
    typeof input.duration == 'number' &&
    Array.isArray(input.assets) &&
    input.assets.every((v: any) => isAsset(v)) &&
    Array.isArray(input.strips) &&
    input.strips.every((v: any) => isStrip(v))
  )
}

export function isAsset(input: any): input is IAsset {
  return typeof input.id == 'string' && typeof input.name == 'string' && typeof input.type == 'string'
}

export function isStrip(input: any): input is IStrip {
  return (
    typeof input.id == 'string' &&
    typeof input.start == 'number' &&
    typeof input.length == 'number' &&
    typeof input.layer == 'number' &&
    typeof input.type == 'string'
  )
}
