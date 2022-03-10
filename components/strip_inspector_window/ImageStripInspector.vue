<template>
  <div style="padding: 4px">
    <sp-field-label>
      Image
      <sp-icon name="Image" style="width: 12px" />
    </sp-field-label>
    <Select v-model="currentAssetId" :items="selectItems" @change="changeSrc" />
    <sp-field-label> Start </sp-field-label>
    <sp-textfield v-model="strip.start" size="S" type="number" :step="0.01" />

    <sp-field-label>Length</sp-field-label>
    <sp-textfield v-model="strip.length" size="S" type="number" :step="0.01" />

    <sp-field-label>Percent (%)</sp-field-label>
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
import { Asset, ImageStrip, ImageAsset } from '../../models'

@Component({
  components: {
    Select
  }
})
export default class ImageStripInspector extends Vue {
  @PropSync('stripSync') strip!: ImageStrip

  @Prop({ default: () => [] })
  assets!: Asset[]

  get currentAssetId() {
    return this.strip.imageAsset?.id
  }

  get videoAssets(): ImageAsset[] {
    return this.assets.filter(a => a instanceof ImageAsset) as ImageAsset[]
  }

  get selectItems() {
    const items: OptionKeyValue[] = [{ value: '', text: 'No selected', disabled: true }]
    return items.concat(
      this.videoAssets.map((va: ImageAsset) => {
        return {
          value: va.id,
          text: va.name
        }
      })
    )
  }

  // 将资产添加到strip中
  changeSrc(e: OptionKeyValue) {
    const targetAsset = this.assets.find(a => a.id == e.value)
    if (!targetAsset || !(targetAsset instanceof ImageAsset)) return
    this.strip.updateAsset(targetAsset)
    console.log(this.strip)
  }

  fixPer() {
    this.strip.fixPercent(this.strip.percent)
  }
}
</script>
