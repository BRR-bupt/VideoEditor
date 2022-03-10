<template>
  <div style="padding: 4px">
    <sp-field-label>
      Video
      <sp-icon name="VideoOutline" style="width: 12px" />
    </sp-field-label>
    <Select v-model="currentAssetId" :items="selectItems" @change="changeSrc" />

    <sp-field-label> Start </sp-field-label>
    <sp-textfield v-model="strip.start" size="S" type="number" :step="0.01" />

    <sp-field-label> Offset </sp-field-label>
    <sp-textfield v-model="strip.videoOffset" size="S" type="number" :step="0.01" />

    <sp-field-label>Length</sp-field-label>
    <sp-textfield v-model="strip.length" size="S" type="number" :step="0.01" />

    <sp-field-label>Percent</sp-field-label>
    <sp-textfield v-model="strip.percent" size="S" type="number" :step="0.01" @change="fixPer" />

    <sp-field-label>Position</sp-field-label>
    <div style="display: flex">
      <div>
        <sp-field-label>X</sp-field-label>
        <sp-textfield v-model="strip.position.x" size="S" type="number" style="width: 100%" />
      </div>
      <div>
        <sp-field-label>Y</sp-field-label>
        <sp-textfield v-model="strip.position.y" size="S" style="width: 100%" type="number" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import { Component, Prop, PropSync } from 'vue-property-decorator'
import Select, { OptionKeyValue } from '../widget/Select.vue'
import { Asset, VideoAsset, VideoStrip } from '../../models'

@Component({
  components: {
    Select
  }
})
export default class VideoStripInspector extends Vue {
  @PropSync('stripSync') strip!: VideoStrip

  @Prop({ default: () => [] }) assets!: Asset[]

  get currentAssetId() {
    return this.strip.videoAsset?.id
  }

  // 过滤出资产中的video资产集
  get videoAssets(): VideoAsset[] {
    return this.assets.filter(a => a instanceof VideoAsset) as VideoAsset[]
  }

  // 将上述video资产集解构重组为符合OptionKeyValue样式的集合
  get selectItems() {
    const items: OptionKeyValue[] = [{ value: '', text: '' }]
    return items.concat(
      this.videoAssets.map((va: VideoAsset) => {
        return {
          value: va.id,
          text: va.name
        }
      })
    )
  }

  // 根据select选择的资产id匹配到assets中的资产，定义为targetAsset，调用updateAsset函数，对strip进行更新
  // 由于strip对象层层.sync同步双向绑定，导致父级StripInspectorWindow组件的Strip对象被更新
  changeSrc(e: OptionKeyValue) {
    const targetAsset = this.assets.find(a => a.id == e.value)
    if (!targetAsset || !(targetAsset instanceof VideoAsset)) return
    this.strip.updateAsset(targetAsset)
  }

  fixPer() {
    this.strip.fixPercent(this.strip.percent)
  }
}
</script>
