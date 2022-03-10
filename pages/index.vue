<template>
  <div class="editor">
    <AppBar
      :projectSync.sync="project"
      @renderVideo="renderVideo"
      @openProject="openProject"
      @downloadProject="downloadProject"
    />
    <sp-divider style="margin: 0" />
    <sp-split-view style="height: calc(100vh - 32px)">
      <sp-split-view-pane>
        <sp-split-view :vertical="true" style="height: 100%; width: 80vw">
          <sp-split-view-pane>
            <sp-split-view>
              <sp-split-view-pane style="width: 200px">
                <sp-split-view :vertical="true" style="height: 100%">
                  <sp-split-view-pane>
                    <AssetWindow
                      :assets="project.assets"
                      @changeSelectedAsset="changeSelectedAsset"
                      @addAsset="addAsset"
                    />
                  </sp-split-view-pane>
                  <sp-split-view-splitter />
                  <sp-split-view-pane>
                    <AssetInspectorWindow
                      :asset="selectedAsset"
                      @changeAsset="changeAsset"
                      @deleteAsset="deleteAsset"
                    />
                  </sp-split-view-pane>
                </sp-split-view>
              </sp-split-view-pane>
              <sp-split-view-splitter class="gripper-horizontal splitter-horizontal"></sp-split-view-splitter>
              <sp-split-view-pane :style="`height: ${aboveTimeline}px; max-width: 80%`">
                <PreviewWindow
                  ref="previewWindow"
                  :currentTime="currentTime"
                  :selectedStrip="selectedStrip"
                  :fps="project.fps"
                  :width="project.width"
                  :height="project.height"
                  @changeStripPos="changeStripPos"
                />
              </sp-split-view-pane>
            </sp-split-view>
          </sp-split-view-pane>
          <sp-split-view-splitter
            class="gripper-vertical"
            :gripper="true"
            :vertical="true"
            @change="v => (aboveTimeline += v)"
          ></sp-split-view-splitter>
          <sp-split-view-pane :style="`height: 100%; width: 100%; overflow-y: scroll`">
            <!-- sync绑定了project.strips，实现了同步更新 -->
            <TimelinePanel
              :currentTime="currentTime"
              :stripsSync.sync="project.strips"
              :selectedStrips="selectedStrips"
              :duration="project.duration"
              :isPlay="isPlay"
              :fps="project.fps"
              @addAsset="addAsset"
              @addStrip="addStrip"
              @changeCurrentTime="changeCurrentTime"
              @changeSelectedStrips="changeSelectedStrips"
              @deleteStrip="deleteStrip"
              @togglePlay="play"
            />
          </sp-split-view-pane>
        </sp-split-view>
      </sp-split-view-pane>
      <sp-split-view-splitter class="gripper-horizontal"></sp-split-view-splitter>
      <sp-split-view-pane style="width: 100%">
        <!-- sync绑定了selectedStrips（selectedStrip函数return值），实现了同步更新 -->
        <StripInspector :stripSync.sync="selectedStrip" :assets="project.assets" />
      </sp-split-view-pane>
    </sp-split-view>
    <Snakbar ref="snakbar" />

    <RendererWindow ref="rendererWindow" :project="project" :scene="scene" :camera="camera" />
  </div>
</template>

<style scoped>
.editor {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>

<style>
/* Nested SplitView is not working. So override force. */
.gripper-vertical > .spectrum-SplitView-gripper {
  left: 50% !important;
}
.gripper-horizontal {
  height: auto !important;
  min-height: auto !important;
  width: 2px !important;
  min-width: 2px !important;
}
.gripper-horizontal > .spectrum-SplitView-gripper {
  /* override props */
  left: -4px !important;
  /* default horizontal */
  content: '';
  display: block;
  position: absolute;
  border-style: solid;
  border-radius: var(--spectrum-alias-border-radius-small);
  border-radius: var(--spectrum-dragbar-gripper-border-radius, var(--spectrum-alias-border-radius-small));
  top: 50%;
  transform: translate(0, -50%);
  width: var(--spectrum-global-dimension-static-size-50);
  width: var(--spectrum-dragbar-gripper-width, var(--spectrum-global-dimension-static-size-50));
  height: var(--spectrum-global-dimension-static-size-200);
  height: var(--spectrum-dragbar-gripper-height, var(--spectrum-global-dimension-static-size-200));
  border-top-width: 4 px;
  border-top-width: var(--spectrum-dragbar-gripper-border-width-vertical, 4px);
  border-bottom-width: 4 px;
  border-bottom-width: var(--spectrum-dragbar-gripper-border-width-vertical, 4px);
  border-left-width: 3 px;
  border-left-width: var(--spectrum-dragbar-gripper-border-width-horizontal, 3px);
  border-right-width: 3 px;
  border-right-width: var(--spectrum-dragbar-gripper-border-width-horizontal, 3px);
}
</style>

<script lang="ts">
import Vue from 'vue'
import * as T from 'three'
import { Component, Ref, Watch } from 'vue-property-decorator'
import loadicons from 'loadicons'
import RendererWindow from '../components/RendererWindow.vue'
import AppBar from '../components/app_bar/AppBar.vue'
import PreviewWindow from '../components/PreviewWindow.vue'
import {
  Asset,
  FontAsset,
  Strip,
  _VERSION_,
  VideoAsset,
  VideoStrip,
  ImageStrip,
  ImageAsset,
  AudioStrip,
  AudioAsset
} from '../models'
import AssetWindow from '../components/asset_window/AssetWindow.vue'
import AssetInspectorWindow from '../components/asset_inspector/AssetInspectorWindow.vue'
import StripInspector from '../components/strip_inspector_window/StripInspectorWindow.vue'
import TimelinePanel from '../components/timeline_panel/TimelinePanel.vue'
import { download } from '../plugins/download'
import { StripUtil } from '../plugins/strip'
import { IVector3 } from '../models/math/Vector3'
import Snakbar from '../components/Snakbar.vue'
import { ProjError } from '../plugins/error'
import { PlayMode, PLAY_EVERY_FRAME, SYNC_TO_AUDIO } from '../plugins/config'
import { Project } from '../models/Project'
import ProjectWindow from '../components/ProjectWindow.vue'
import ControllerWindow from '../components/ControllerWindow.vue'
import { DragAndDrop } from '../plugins/dragAndDrop'

@Component({
  components: {
    ProjectWindow,
    RendererWindow,
    ControllerWindow,
    AppBar,
    PreviewWindow,
    AssetWindow,
    AssetInspectorWindow,
    StripInspector,
    TimelinePanel,
    Snakbar
  }
})
export default class IndexPage extends Vue {
  @Ref() previewWindow?: PreviewWindow
  @Ref() snakbar?: Snakbar
  @Ref() rendererWindow?: RendererWindow

  camera: T.OrthographicCamera | null = null
  scene: T.Scene | null = null
  isPlay: boolean = false
  currentTime: number = 0
  lastAnimationTime: number = 0
  playRequests: number[] = []
  selectedAsset: Asset | null = null
  selectedStrips: Strip[] = []
  canvas: HTMLCanvasElement | null = null

  project: Project = new Project({
    version: _VERSION_,
    name: 'untitled',
    width: 1920,
    height: 1080,
    fps: 60,
    duration: 10,
    assets: [],
    strips: []
  })

  playMode: PlayMode = SYNC_TO_AUDIO

  lastUpdate: number = 0

  aboveTimeline: number = 400

  // strip条拖动时触发
  // 该函数的return值为selectedStrips，所以与组件StripInspector的sync绑定为selectedStrips
  // 在stripInspect窗口修改selectedStrips时，经过sync使本页面的selectedStrips得到修改，而并非调用了changeStrip函数
  get selectedStrip() {
    console.log('selectedStrip')

    if (this.selectedStrips.length > 0) {
      return this.selectedStrips[0]
    }
    return null
  }

  async mounted() {
    DragAndDrop.init()
    loadicons('/static/svg/spectrum-css-icons.svg', () => {})
    loadicons('/static/svg/spectrum-icons.svg', () => {})
    // 创建scene与camera，并预设了位置参数
    this.scene = new T.Scene()
    this.camera = new T.OrthographicCamera(0, this.project.width, this.project.height, 0)
    this.camera.position.set(0, 0, 10)
    this.canvas = this.previewWindow?.renderCanvas || null
    await FontAsset.init()
    // 调用update函数，进行数据更新
    this.update(0)
  }

  @Watch('project')
  openProject() {
    this.project.strips.forEach(s => {
      if (StripUtil.isThreeJsStrip(s)) {
        this.scene?.add(s.obj)
      }
    })
    console.log('projectChanged')

    this.previewWindow?.resize()
  }

  // @Watch('project.strips', { deep: true })
  // openis() {
  //   console.log('watchStripsChanged')
  // }

  @Watch('selectedStrips')
  fixDuration() {
    this.changeDuration()
  }

  addAsset(asset: Asset) {
    this.project.assets.push(asset)
  }

  changeAsset(newAsset: Asset) {
    console.log('changeAsset')

    const i = this.project.assets.findIndex(a => a == this.selectedAsset)
    const oldAsset = this.project.assets[i]
    this.project.assets.splice(i, 1, newAsset)
    this.project.strips.forEach(s => {
      if (s instanceof VideoStrip && newAsset instanceof VideoAsset) {
        if (s.videoAsset == oldAsset) {
          s.updateAsset(newAsset)
        }
      } else if (s instanceof ImageStrip && newAsset instanceof ImageAsset) {
        s.updateAsset(newAsset)
      } else if (s instanceof AudioStrip && newAsset instanceof AudioAsset) {
        s.updateAsset(newAsset)
      }
    })
    this.selectedAsset = newAsset
  }

  // Gizmo拖动的时候触发，修改selectedStrip的position信息
  // 而selectStrip数据是共享到stripinspect组件的，其发生变化时，会调用changeStrip方法
  // 从而更新strip，scene，以完成Gizmo带着渲染的selectedStrip拖动的效果
  changeStripPos(pos: IVector3) {
    console.log('changeStripPos')

    if (this.selectedStrip && StripUtil.isThreeJsStrip(this.selectedStrip)) {
      this.selectedStrip.position.set(pos.x, pos.y, pos.z)
    }
  }

  deleteStrip(strip: Strip) {
    const i = this.project.strips.findIndex(s => s == strip)
    if (i != -1) {
      const strip = this.project.strips[i]
      if (StripUtil.isThreeJsStrip(strip)) {
        strip.obj.removeFromParent()
      }
      this.project.strips.splice(i, 1)
      this.selectedStrips = []
    }
    this.changeDuration()
  }

  changeCurrentTime(time: number) {
    this.currentTime = time
    this.change()
  }

  changeDuration() {
    let duration = 0
    for (let i = 0; i < this.project.strips.length; i++) {
      const s = this.project.strips[i]
      if (duration < s.start + s.length) {
        duration = s.start + s.length
      }
    }
    this.project.duration = duration
    console.log(duration)
  }

  // 拖动strip条触发，该函数接收参数strip，完成了对SelectedStrips的修改
  changeSelectedStrips(strips: Strip[]) {
    console.log('changeSelectedStrips')

    this.selectedStrips = strips
  }

  changeSelectedAsset(asset: Asset) {
    this.selectedAsset = asset
  }

  // 改变playmode，暂时未找到该方法的调用，应该是第二种mode还没开发
  changePlayMode(playMode: PlayMode) {
    this.playMode = playMode
  }

  deleteAsset() {
    const i = this.project.assets.findIndex(a => a == this.selectedAsset)
    this.project.assets.splice(i, 1)
  }

  // mounted中进行了该函数调用
  // 由于函数内window.requestAnimationFrame(this.update)，update函数将以60帧的速率循环运行
  // 60帧的运行，完成60帧的数据更新，即完成60帧视频播放
  async update(time: number = 0) {
    // 若正在渲染，则一直处于该段循环，即无其他操作
    // 这样处理可避免与渲染过程冲突
    if (this.rendererWindow && this.rendererWindow.isEncoding) {
      window.requestAnimationFrame(this.update)
      return
    }

    // 该判断的打印处理函数执行了两次
    if (time - this.lastUpdate + 0.02 <= 1000 / this.project.fps) {
      window.requestAnimationFrame(this.update)
      return
    }
    if (this.previewWindow) this.previewWindow.start()

    // delta为两次循环的时间差，大致为18.2ms（60帧），即每18.2ms，该循环跑一便，数据更新一遍
    let delta = time - this.lastAnimationTime
    this.lastAnimationTime = time

    // playmode似乎一直是SYNC_TO_AUDIO，因此此函数 {无作用}
    if (this.playMode == PLAY_EVERY_FRAME) {
      delta = 1000 / this.project.fps
    }

    // 播放功能实现：修改currentTime，每次循环让currentTime增加delta/1000 = 0.0182秒，时间游标便向前滚动
    // 借助requestAnimationFrame的60帧计时，达到播放速度与现实中视频速度一致的效果
    if (this.isPlay) {
      this.currentTime += delta / 1000
    }

    // 实现了对strip更新，update函数内部更新了this.obj(scene)
    // strip.update是声明，具体函数内容在VideoStrip.update
    // 这个VideoStrip.update函数控制了视频的不同播放位置的显示，若进度未到或已过，则隐藏之
    for (let i = 0; i < this.project.strips.length; i++) {
      const s = this.project.strips[i]
      await s.update(this.currentTime, delta, this.isPlay, this.playMode, this.project.fps)
    }

    // 根据strip修改duration
    // let duration = 0
    // for (let i = 0; i < this.project.strips.length; i++) {
    //   const s = this.project.strips[i]
    //   if (duration < s.start + s.length) {
    //     duration = s.start + s.length
    //   }
    // }
    // this.project.duration = duration

    // 该段条件恒成立
    // threejs的渲染scene到页面的操作
    if (this.previewWindow && this.scene && this.camera) {
      this.previewWindow.renderPreview(this.scene, this.camera)
      // 如果project设置被修改，这里将重新设置camera
      this.camera.top = this.project.height
      this.camera.right = this.project.width
      this.camera.updateProjectionMatrix()
      this.previewWindow.resize()
    }

    if (this.previewWindow) this.previewWindow.end()
    this.lastUpdate = time
    // 该windowAPI实现了计时功能，且循环这段upadte代码
    window.requestAnimationFrame(this.update)
  }

  // 添加strip并将strip.obj(mesh)同步添加到scene
  addStrip(ts: Strip) {
    console.log('addStrip')
    console.log(ts)
    console.log(ts.obj)

    this.project.strips.push(ts)
    if (StripUtil.isThreeJsStrip(ts)) {
      this.scene?.add(ts.obj)
    }
    this.changeDuration()
  }

  // 视频播放处理函数
  play() {
    this.isPlay = !this.isPlay
  }

  downloadProject() {
    download(new Blob([JSON.stringify(this.project.toJSON())]), this.project.name + '.json')
  }

  getAssetById(id: string) {
    return this.project.assets.find(a => a.id == id)
  }

  // 数据更新，注意：播放即为数据按帧率更新
  // forEach 为对数组每一个元素进行一次函数处理，在这里为对strips数组的每个strip对象进行一次update函数处理
  // 核心是传递currentTime参数，计算得到具体strip的所处时间点
  change() {
    this.project.strips.forEach((s: Strip) => {
      s.update(this.currentTime, 0, false, SYNC_TO_AUDIO, this.project.fps)
    })
  }

  errorCaptured(err: Error, _vm: any, _info: any) {
    if (err instanceof ProjError) {
      this.snakbar?.open(3000, err.message)
      return false
    }
  }

  // appbar的export按钮点击事件处理函数
  // 打开renderWindow窗口
  renderVideo() {
    if (!this.rendererWindow) return
    this.rendererWindow.open()
  }
}
</script>
