import clientApi from "./clientApi"

let mediaRecorder = null
let chunks = []

let audioObj = null
// onClick of first interaction on page before I need the sounds
// (This is a tiny MP3 file that is silent and extremely short - retrieved from https://bigsoundbank.com and then modified)
//soundEffect.src = "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV"

const getMediaRecorder = async () => {
  if (mediaRecorder !== null) {
    return mediaRecorder
  }

  // Create MediaRecord after checking that the browser is MediaRecorder enabled
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      mediaRecorder = new MediaRecorder(stream)
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data)
      }
      return mediaRecorder
    } catch (err) {
      console.log(`The following getUserMedia error occurred: ${err}`)
    }
  } else {
    console.log("getUserMedia not supported on your browser!")
  }
}

const stopMediaRecorder = () =>
  new Promise((resolve, reject) => {
    getMediaRecorder().then((recorder) => {
      recorder.stop()

      recorder.onstop = (e) => {
        const blob = new Blob(chunks, { type: chunks[0].type })
        chunks = []
        resolve(blob)
      }
    })
  })

let textsToSpeak = []
// false when is already speaking or when is listening to user speak
let speechState = "none"

let stopAudio = () => null

const playAudio = (audioObj) =>
  new Promise(async (resolve) => {
    try {
      await audioObj.play()
      console.log('bot speaking')
    } catch (err) {
      console.log('bot not speaking')
      console.log(err)
    }
    stopAudio = () => {
      audioObj.pause()
      textsToSpeak = []
      resolve()
    }
    audioObj.onended = resolve
  })

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const speechController = {
  isSupportedInBrowser: () =>
    Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),

  startListening: async () => {
    stopAudio()
    const recorder = await getMediaRecorder()
    recorder.start()
  },

  stopListening: async () => {
    const blob = await stopMediaRecorder()
    console.log(blob)
    const text = await clientApi.speechToText(blob)
    return text
  },

  speak: async (text) => {
    // Get audio and push to `textsToSpeak` queue
    const audio = await clientApi.textToSpeech(text)
    textsToSpeak.push(audio)

    // Check if we are currently speaking. If so, do nothing.
    // If not, asynchronously loop through all `textsToSpeak` and play them.
    if (speechState === "none") {
      speechState = "speaking"
      while (speechState === "speaking" && textsToSpeak.length > 0) {
        const audioToSpeak = textsToSpeak.shift()
        const audioBlob = new Blob([audioToSpeak], { type: "audio/mp3" })
        const blobUrl = URL.createObjectURL(audioBlob)

        if (audioObj === null) {
          audioObj = new Audio()
          audioObj.autoplay = true
        }
        audioObj.src = blobUrl
        await playAudio(audioObj)
        await sleep(500) // wait 500 milliseconds before next speech bubble
      }
      speechState = "none"
    }
  },
}

export default speechController
