import { Vue, Component, Prop, Emit } from 'vue-property-decorator'
import { ProgressInfo } from 'mishiro-core'
import { MasterData } from '../main/on-master-read'
import ProgressBar from '../../vue/component/ProgressBar.vue'
import check from './check'
import { setLatestResVer, setMaster, setResVer } from './store'

import MishiroIdol from './mishiro-idol'
// import { bgmList } from './the-player'
// import { unpackTexture2D } from './unpack-texture-2d'
// import { Client } from './typings/main'
import getPath from './get-path'
import configurer from './config'
const fs = window.node.fs
// const path = window.node.path
const { manifestPath, masterPath, bgmDir/* , iconDir */ } = getPath
const ipcRenderer = window.node.electron.ipcRenderer

@Component({
  components: {
    ProgressBar
  }
})
export default class extends Vue {
  dler = new this.core.Downloader()
  loading: number = 0
  isReady: boolean = false
  text: string = ''
  // appData: { resVer: number | string; latestResVer: number | string; master: MasterData | any} = {
  //   resVer: 'Unknown',
  //   latestResVer: 'Unknown',
  //   master: {}
  // }

  get wavProgress (): boolean {
    return this.core.config.getProgressCallback()
  }

  // @Prop() value!: { resVer: number | string, latestResVer: number | string, master: MasterData | any }
  @Prop() isTouched!: boolean

  getEventCardId (eventAvailable: any[], eventData: any): number[] {
    if (!eventAvailable.length) return (eventData.bg_id as string).split(',').map((id: string) => (Number(id) - 1))
    eventAvailable.sort(function (a, b) {
      return a.recommend_order - b.recommend_order
    })
    // console.log(eventAvailable)
    return [eventAvailable[0].reward_id, eventAvailable[eventAvailable.length - 1].reward_id]
  }

  @Emit('ready')
  emitReady (): void {
    this.event.$emit('play-studio-bgm')
  }

  async getResVer (): Promise<number> {
    const resVer = await check()
    return resVer
  }

  async getManifest (resVer: number): Promise<string> {
    this.loading = 0
    this.text = this.$t('update.manifest') as string

    let manifestFile = ''
    if (fs.existsSync(manifestPath(resVer, '.db'))) {
      this.loading = 100
      manifestFile = manifestPath(resVer, '.db')
      return manifestFile
    }
    try {
      const manifestFile = await this.dler.downloadManifest(resVer, manifestPath(resVer), prog => {
        this.text = (this.$t('update.manifest') as string) + `${Math.ceil(prog.current / 1024)}/${Math.ceil(prog.max / 1024)} KB`
        this.loading = prog.loading
      })
      if (manifestFile) {
        fs.unlinkSync(manifestPath(resVer))
        return manifestFile
      } else throw new Error('Download failed.')
    } catch (errorPath) {
      this.event.$emit('alert', this.$t('home.errorTitle'), (this.$t('home.downloadFailed') as string) + '<br/>' + (errorPath as string))
      return ''
    }
  }

  downloadMaster (resVer: number, hash: string, progressing: (prog: ProgressInfo) => void): Promise<string> {
    const downloader = new this.core.Downloader()
    return downloader.downloadDatabase(hash, masterPath(resVer), progressing, '.db')
    // return downloader.downloadOne(
    //   `http://storage.game.starlight-stage.jp/dl/resources/Generic/${hash}`,
    //   masterPath(resVer),
    //   progressing
    // )
  }

  async getMaster (resVer: number, masterHash: string): Promise<string> {
    this.loading = 0
    this.text = this.$t('update.master') as string

    let masterFile = ''
    if (fs.existsSync(masterPath(resVer, '.db'))) {
      this.loading = 100
      masterFile = masterPath(resVer, '.db')
      return masterFile
    }
    try {
      const masterFile = await this.downloadMaster(resVer, masterHash, prog => {
        this.text = (this.$t('update.master') as string) + `${Math.ceil(prog.current / 1024)}/${Math.ceil(prog.max / 1024)} KB`
        this.loading = prog.loading
      })
      if (masterFile) {
        // masterFile = this.core.util.lz4dec(masterLz4File, '.db')
        fs.unlinkSync(masterPath(resVer))
        // return masterFile
        return masterFile
      } else throw new Error('Download master.mdb failed.')
    } catch (errorPath) {
      this.event.$emit('alert', this.$t('home.errorTitle'), (this.$t('home.downloadFailed') as string) + '<br/>' + (errorPath as string))
      throw errorPath
    }
  }

  // sleep (ms: number): Promise<undefined> {
  //   return new Promise(resolve => {
  //     setTimeout(() => {
  //       resolve()
  //     }, ms)
  //   })
  // }

  // async getGachaIcon (icons: { name: string; hash: string; [x: string]: any }[]) {
  //   const card = configurer.get('card')
  //   for (let i = 0; i < icons.length; i++) {
  //     let cacheName = iconDir(path.parse(icons[i].name).name)
  //     this.text = ((!card || card === 'default') ? icons[i].name : path.basename(cacheName + '.png')) + '　' + i + '/' + icons.length
  //     this.loading = 100 * i / icons.length
  //     if (!fs.existsSync(cacheName + '.png')) {
  //       try {
  //         if (!card || card === 'default') {
  //           let asset = await this.dler.downloadAsset(icons[i].hash, cacheName)
  //           if (asset) {
  //             fs.removeSync(cacheName)
  //             await unpackTexture2D(asset)
  //           }
  //         } else {
  //           await this.dler.downloadIcon(icons[i].name.slice(5, 5 + 6), cacheName + '.png')
  //         }
  //       } catch (err) {
  //         console.log(err)
  //         continue
  //       }
  //     }
  //   }
  // }

  async afterMasterRead (masterData: MasterData): Promise<void> {
    // console.log(masterData);
    const downloader = new this.core.Downloader()
    // const toName = (p: string) => path.parse(p).name

    setMaster(masterData)
    setLatestResVer(configurer.get('latestResVer') || -1)

    const bgmManifest = masterData.bgmManifest
    // for (let k in bgmList) {
    //   if (!fs.existsSync(path.join(getPath('./public'), bgmList[k].src))) {
    //     let acbName = `b/${toName(bgmList[k].src)}.acb`
    //     let hash: string = bgmManifest.filter(row => row.name === acbName)[0].hash
    //     try {
    //       this.text = path.basename(`${toName(bgmList[k].src)}.acb`)
    //       this.loading = 0
    //       let result = await downloader.downloadSound(
    //         'b',
    //         hash,
    //         bgmDir(`${toName(bgmList[k].src)}.acb`),
    //         prog => {
    //           this.text = prog.name + '　' + Math.ceil(prog.current / 1024) + '/' + Math.ceil(prog.max / 1024) + ' KB'
    //           this.loading = prog.loading / (this.wavProgress ? 2 : 1)
    //         }
    //       )
    //       if (result) {
    //         await this.acb2mp3(bgmDir(`${toName(bgmList[k].src)}.acb`), void 0, (_current, _total, prog) => {
    //           this.text = prog.name + '　' + this.$t('live.decoding')
    //           this.loading = 50 + prog.loading / 2
    //         })
    //       }
    //     } catch (errorPath) {
    //       this.event.$emit('alert', this.$t('home.errorTitle'), this.$t('home.downloadFailed') + '<br/>' + errorPath)
    //     }
    //   }
    // }
    if (masterData.eventHappening) {
      if (Number(masterData.eventData.type) !== 2 && Number(masterData.eventData.type) !== 6 && !fs.existsSync(bgmDir(`bgm_event_${masterData.eventData.id}.mp3`))) {
        const eventBgmHash = bgmManifest.filter(row => row.name === `b/bgm_event_${masterData.eventData.id}.acb`)[0].hash
        try {
          // let result = await downloader.download(
          //   this.getBgmUrl(eventBgmHash),
          //   bgmDir(`bgm_event_${masterData.eventData.id}.acb`),
          //   (prog: ProgressInfo) => {
          //     this.text = prog.name + '　' + Math.ceil(prog.current / 1024) + '/' + Math.ceil(prog.max / 1024) + ' KB'
          //     this.loading = prog.loading
          //   }
          // )
          this.text = `bgm_event_${masterData.eventData.id}.acb`
          this.loading = 0
          const result = await downloader.downloadSound(
            'b',
            eventBgmHash,
            bgmDir(`bgm_event_${masterData.eventData.id}.acb`),
            prog => {
              this.text = (prog.name || '') + '　' + `${Math.ceil(prog.current / 1024)}/${Math.ceil(prog.max / 1024)} KB`
              this.loading = prog.loading / (this.wavProgress ? 2 : 1)
            }
          )
          if (result) {
            await this.acb2mp3(bgmDir(`bgm_event_${masterData.eventData.id}.acb`), undefined, (_current, _total, prog) => {
              this.text = (prog.name || '') + '　' + (this.$t('live.decoding') as string)
              this.loading = 50 + prog.loading / 2
            })
          }
        } catch (errorPath) {
          this.event.$emit('alert', this.$t('home.errorTitle'), (this.$t('home.downloadFailed') as string) + '<br/>' + (errorPath as string))
        }
      }
    }

    const cardId = this.getEventCardId(masterData.eventAvailable, masterData.eventData)

    if (masterData.eventHappening) {
      const storageCardId: number = Number(cardId[0]) + 1
      if (!isNaN(storageCardId)) {
        localStorage.setItem('msrEvent', `{"id":${masterData.eventData.id},"card":${storageCardId}}`)
      }
    } else {
      localStorage.removeItem('msrEvent')
    }

    const downloadCard = new MishiroIdol().downloadCard

    // const tmpawait = () => new Promise((resolve) => {
    //   this.event.$once('_eventBgReady', () => {
    //     resolve()
    //   })
    // })

    let getBackgroundResult: string = ''

    const getBackground = async (id: string | number): Promise<void> => {
      try {
        this.text = `Download card_bg_${id}`
        this.loading = 0
        getBackgroundResult = await downloadCard.call(this, id, 'eventBgReady', (prog: ProgressInfo) => {
          this.text = (prog.name || '') + '　' + `${Math.ceil(prog.current / 1024)}/${Math.ceil(prog.max / 1024)} KB`
          this.loading = prog.loading
        })

        this.loading = 99.99
        if (getBackgroundResult/*  && getBackgroundResult !== 'await ipc' */) {
          this.event.$emit('eventBgReady', id)
        }
      } catch (err) {
        this.event.$emit('alert', this.$t('home.errorTitle'), (this.$t('home.downloadFailed') as string) + '<br/>' + (err.toString() as string))
      }
    }

    const background = configurer.get('background')
    if (background) {
      await getBackground(background)
    } else {
      // const cardIdEvolution = [(Number(cardId[0]) + 1), (Number(cardId[1]) + 1)];
      if (masterData.eventHappening) {
        await getBackground(Number(cardId[0]) + 1)
      }
    }

    // if (getBackgroundResult === 'await ipc') await tmpawait()

    if (masterData.eventHappening) this.event.$emit('eventRewardCard', cardId)

    /* let iconId = []
    for (let index = 0; index < masterData.gachaAvailable.length; index++) {
      iconId.push(masterData.gachaAvailable[index].reward_id)
    }
    const iconTask = this.createCardIconTask(iconId)
    await downloader.download(iconTask, ([_url, filepath]) => {
      const name = path.basename(filepath)
      this.text = name + '　' + downloader.index + '/' + iconTask.length
      this.loading = 100 * downloader.index / iconTask.length
    }, prog => {
      this.loading = 100 * downloader.index / iconTask.length + prog.loading / iconTask.length
    }) */

    // await this.getGachaIcon(masterData.gachaIcon)
    // console.log(failedList)
    this.emitReady()
  }

  mounted (): void {
    this.$nextTick(() => {
      this.event.$on('enter', async ($resver?: number) => {
        // ipcRenderer.on('readManifest', async (_event: Event, masterHash: string, resVer: number) => {
        //   const masterFile = await this.getMaster(resVer, masterHash)
        //   if (masterFile) ipcRenderer.send('readMaster', masterFile, resVer)
        // })
        ipcRenderer.once('readMaster', async (_event: Event, masterData: MasterData) => {
          await this.afterMasterRead(masterData)
        })

        // if (!client.user) {
        // try {
        //   this.text = 'Loading...'
        //   this.loading = 0
        //   const acc = await client.signup((step) => {
        //     this.loading = step
        //   })
        //   if (acc !== '') {
        //     configurer.set('account', acc)
        //   } else {
        //     throw new Error('')
        //   }
        // } catch (err) {
        //   console.log(err)
        // }
        // }

        if (navigator.onLine) {
          let resVer: number
          if ($resver) {
            resVer = $resver
          } else {
            try {
              this.text = this.$t('update.check') as string
              this.loading = 0
              resVer = await this.getResVer()
            } catch (err) {
              console.log(err)
              if (Number(err.message) === 203) {
                this.event.$emit('alert', this.$t('home.errorTitle'), 'Current account has been banned. Please use another account.')
                return
              }
              resVer = configurer.get('latestResVer')!
            }
          }

          setResVer(Number(resVer))
          const manifestFile = await this.getManifest(resVer)
          if (manifestFile) {
            const masterHash = await (window.preload.readManifest as any)(manifestFile)
            delete window.preload.readManifest
            const masterFile = await this.getMaster(resVer, masterHash)
            if (masterFile) ipcRenderer.send('readMaster', masterFile, resVer)
            // const masterData = await window.preload.readMaster(masterFile)
            // await this.afterMasterRead(masterData)
          }
        } else {
          const resVer = configurer.get('latestResVer')!
          setResVer(Number(resVer))
          if (fs.existsSync(manifestPath(resVer, '.db')) && fs.existsSync(masterPath(resVer, '.db'))) {
            const manifestFile = manifestPath(resVer, '.db')
            if (manifestFile) {
              const masterHash: string = await (window.preload.readManifest as any)(manifestFile)
              delete window.preload.readManifest
              const masterFile = await this.getMaster(resVer, masterHash)
              if (masterFile) ipcRenderer.send('readMaster', masterFile, resVer)
              // const masterData = await window.preload.readMaster(masterFile)
              // await this.afterMasterRead(masterData)
            }
          } else {
            this.event.$emit('alert', this.$t('home.errorTitle'), this.$t('home.noNetwork'))
          }
        }
      })
    })
  }
}
