const fs = require("fs")
const yaml = require("js-yaml")
const express = require("express")
const axios = require("axios")
const path = require("path")
const speechToText = require("@google-cloud/speech")
const textToSpeech = require("@google-cloud/text-to-speech")
const prism = require("prism-media")
const stream = require("stream")
const { exec } = require("child_process")

const startEmailReminderService = require("./startEmailReminderService")

// Load questions
const questions = {}
for (const topic of fs.readdirSync("questions/topics")) {
  if (topic == "Demo") continue

  for (const q of yaml.safeLoad(
    fs.readFileSync(`questions/topics/${topic}/questions.yaml`)
  )) {
    q["Topic"] = topic
    questions[q["Id"]] = q
  }
}

// Load questions for demo
const demoQuestions = {}
for (const q of yaml.safeLoad(
  fs.readFileSync("questions/topics/Demo/questions.yaml")
)) {
  q["Topic"] = "Demo"
  demoQuestions[q["Id"]] = q
}

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

const generateTest = (type, pretest) => {
  const test = []
  const allQs = shuffleArray(Object.values(questions))
  for (q of allQs) {
    if (type == "posttest") {
      // for post-test, skip questions that were answered correctly on pretest
      const index = pretest.findIndex((e) => e.QID == q.Id)
      const preResponse = index >= 0 ? pretest[index].response : null
      if (preResponse == q.MultipleChoice.Correct) {
        continue
      }
    }
    test.push({ QID: q.Id, response: null })
  }
  return test
}

const updateTest = (responses, test) => {
  if (responses == null)
    return

  responses.forEach((e) => {
    const index = test.findIndex((q) => e.QID == q.QID)
    if (index >= 0) {
      if (e.start) {
        if (test[index].finish == null)
          test[index].start = new Date()
      } else {
        test[index].response = e.response
        test[index].finish = new Date()
      }
    }
  })
  return test
}

const recordTestResponses = (content, email) => {
  const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  const status = getStatus(email)
  let test = []

  if (content.isPretest && status == "notStarted") {
    if (userData.pretest)
      updateTest(content.responses, userData.pretest)
    else userData.pretest = generateTest("pretest")
    test = userData.pretest
  } else {
    if (content.part === "A" && status == "studyDone") {
      if (userData.posttestA)
        updateTest(content.responses, userData.posttestA)
      else userData.posttestA = generateTest("posttest", userData.pretest)
      test = userData.posttestA
    } else if (content.part === "B" && status == "posttestPartADone") {
      if (userData.posttestB)
        updateTest(content.responses, userData.posttestB)
      else userData.posttestB = generateTest("posttest", userData.pretest)
      test = userData.posttestB
    }
  }

  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(userData))
  return test
}

const updateNumLogins = (email) => {
  const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  userData.numLogins = userData.numLogins == null ? 1 : userData.numLogins + 1
  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(userData))
}

// Call this to update the number of completed questions (in database) for a specific user
const updateCompleted = (completed, email) => {
  const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  userData.completed = completed

  if (completed.questions == 0) {
    userData.times.studyTimes[completed.days - 1].finish = new Date()

    if (completed.days == 10) {
      const start = new Date()
      start.setDate(start.getDate() + 1)
      start.setHours(0, 0, 0, 0)
      userData.times.posttest = { allowedStart: start }
    }
  }

  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(userData))
  if (completed.questions == 0 && completed.days == 10) {
    updateUserStatus({}, email)
  }
}

const getStatus = (email) => {
  if (email == "demo") {
    return "pretestDone"
  }

  const user = getUser(email)
  if (user == null) {
    return null
  }

  return user.status
}

const updateUserStatus = (content, email) => {
  const user = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  const { status } = user
  const { isPretest, part } = content

  if (status == "notStarted" && isPretest) {
    user.times.pretest.finish = new Date()
    user.status = "pretestDone"
    fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(user))
    exec("cd backend/users && /home/arpan/miniconda3/bin/python make_question_schedules.py", (error, stdout, stderr) => { console.log(error, stdout, stderr) })

    user.times.studyTimes = createStudyTimes(
      user.times.pretest.finish,
      10 // user.questionSchedule.length
    )
  } else if (
    status == "pretestDone" &&
    user.completed.days >= user.questionSchedule.length
  ) {
    user.status = "studyDone"
  } else if (status == "studyDone" && !isPretest && part == "A") {
    user.status = "posttestPartADone"
  } else if (status == "posttestPartADone" && !isPretest && part == "B") {

    user.times.posttest.finish = new Date()

    if (user.first_posttest == null || user.second_posttest == null) {

      const newDate = new Date()
      newDate.setHours(0, 0, 0, 0)
      const copy_posttest = { A: user.posttestA, B: user.posttestB }

      if (user.first_posttest == null) {
        user.times.first_posttest = user.times.posttest
        newDate.setDate(newDate.getDate() + 7) // edit this to be + 7
        user.first_posttest = copy_posttest;
      } else if (user.second_posttest == null) {
        user.times.second_posttest = user.times.posttest
        newDate.setDate(newDate.getDate() + 60) // edit this to be + 60
        user.second_posttest = copy_posttest
      }

      // we saved a copy of the post-test, then we reset the user and they'll retest in 7 or 60 days
      user.status = "studyDone"
      user.posttestA = null
      user.posttestB = null
      user.times.posttest = { allowedStart: newDate }

    } else {
      user.status = "posttestDone"
    }

  }

  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(user))
}

const updateUserQuestionData = (completed, data, email) => {
  if (email == "demo") {
    return
  }
  const user = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  user.questionSchedule[completed.days][completed.questions] = data
  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(user))
}

const setPretestStartTime = (email) => {
  const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  userData.times = { pretest: { start: new Date() } }
  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(userData))
}

const setPosttestStartTime = (email) => {
  const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  userData.times.posttest.start = new Date()
  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(userData))
}

const createStudyTimes = (pretestFinishTime, numDays) => {
  const studyTimes = []
  for (let i = 1; i <= numDays; i++) {
    const newDate = new Date(pretestFinishTime)
    newDate.setDate(pretestFinishTime.getDate() + i)
    newDate.setHours(0, 0, 0, 0)
    studyTimes.push({ allowedStart: newDate })
  }

  return studyTimes
}

const setDayStartTime = (email) => {
  const userData = yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
  userData.times.studyTimes[userData.completed.days].start = new Date()
  fs.writeFileSync(`backend/users/${email}.yaml`, yaml.safeDump(userData))
}

const getUser = (email) => {
  const exists = email && fs.existsSync(`backend/users/${email}.yaml`)
  return exists
    ? yaml.safeLoad(fs.readFileSync(`backend/users/${email}.yaml`))
    : null
}

const finishedStudy = (status) => {
  return (
    status == "studyDone" ||
    status == "posttestPartADone" ||
    status == "posttestDone"
  )
}

const SPEECH_ADAPTATION_VOCAB = yaml.safeLoad(
  fs.readFileSync("backend/speech_adaptation_dictionary.yaml")
).speech_adaption_vocab

const speechToTextClient = new speechToText.SpeechClient()
const textToSpeechClient = new textToSpeech.TextToSpeechClient()

const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(express.raw({ type: "*/*", limit: "200mb" }))
app.use(express.static("build"))
app.use(express.static("questions/topics"))

// Take a stream and return concatenated contents once finished reading.
const streamToBuffer = (strm) =>
  new Promise((resolve) => {
    const chunks = []
    strm.on("data", (data) => chunks.push(data))
    strm.on("end", () => resolve(Buffer.concat(chunks)))
  })

app.post("/api/speech-to-text", async (req, res) => {
  const contentType = req.get("Content-Type")
  console.log(contentType)

  let rawAudioStream
  // Process opus encoded audio
  if (contentType.includes("codecs=opus")) {
    // Add correct demuxer based on container type
    let demuxer
    if (contentType.includes("ogg")) {
      demuxer = new prism.opus.OggDemuxer()
    } else if (contentType.includes("webm")) {
      demuxer = new prism.opus.WebmDemuxer()
    } else {
      throw "Codec is opus, but container type is neither ogg or webm."
    }

    // Opus decoder
    rawAudioStream = stream.Readable.from(req.body)
      .pipe(demuxer)
      .pipe(
        new prism.opus.Decoder({ rate: 16000, channels: 1, frameSize: 960 })
      )

    // Process mpeg audio with ffmpeg
  } else if (contentType.includes("mp4") || contentType.includes("mp3")) {
    rawAudioStream = stream.Readable.from(req.body).pipe(
      new prism.FFmpeg({
        args: ["-f", "s16le", "-ar", "16000", "-ac", "1"],
      })
    )
  } else {
    return JSON.stringify(undefined)
  }

  const audioBuffer = await streamToBuffer(rawAudioStream)

  // Send audio to Google Speech-to-Text service and return
  // the most confident transcription. If none, return null.
  const [response] = await speechToTextClient.recognize({
    config: {
      encoding: "LINEAR16",
      sampleRateHertz: 16000,
      languageCode: "en-US",
      speechContexts: [{phrases: ["radial head", "ulnar nerve", "polyethalene"]}],//[{ phrases: SPEECH_ADAPTATION_VOCAB }],
    },
    audio: { content: audioBuffer.toString("base64") },
  })
  res.send(
    JSON.stringify(
      response.results.length != 0
        ? response.results[0].alternatives[0].transcript
        : null // Send null if no potential transcripts given
    )
  )
})

app.post("/api/text-to-speech", async (req, res) => {
  const { text } = req.body

  const [response] = await textToSpeechClient.synthesizeSpeech({
    input: { ssml: text },
    voice: { languageCode: "en-US", ssmlGender: "MALE" },
    audioConfig: { audioEncoding: "MP3" },
  })
  res.send(response.audioContent)
})

// For now, login returns whether that user exists or not.
app.post("/api/login", (req, res) => {
  const { content, conv } = req.body
  const email = content
  const user = getUser(email)

  if (user) {
    updateNumLogins(email)
    if (user.pretest == null) setPretestStartTime(email)
  }

  res.send(JSON.stringify({ content: user !== null, conv }))
})

app.get("/api/getUserStatus", (req, res) => {
  const { email } = req.query
  const user = getUser(email)
  if (user == null) {
    res.sendStatus(500)
    return
  }

  const status = getStatus(email)
  res.send({ status })
})

app.get("/api/getUserProgress", (req, res) => {
  const { email, keyId } = req.query
  const user = getUser(email)
  if (user == null) {
    res.status(500).send({ day: 0, question: 0, numQuestions: 0 })
    return
  }

  if (email == "demo") {
    res.send({ day: 1, question: parseInt(keyId) + 1, numQuestions: 5 })
    return
  }

  const { completed, questionSchedule } = user
  const todaysQuestions = questionSchedule ? questionSchedule[completed.days] : []
  res.send({
    day: completed.days + 1,
    question: completed.questions + 1,
    numQuestions: todaysQuestions.length,
  })
})

app.get("/api/getExplanation", (req, res) => {
  const { QID, email } = req.query

  if (email === "demo") {
    res.send({ content: demoQuestions[QID].Explanation })
    return
  }

  const user = getUser(email)
  const status = getStatus(email)
  if (user == null || status == "notStarted") {
    res.sendStatus(500)
    return
  }

  // getExplanation allowed only if user just answered this question
  const { completed, questionSchedule } = user
  const todaysQuestions =
    questionSchedule[
    completed.questions > 0 ? completed.days : completed.days - 1
    ]
  const question =
    todaysQuestions[
    completed.questions > 0
      ? completed.questions - 1
      : todaysQuestions.length - 1
    ]
  if (question.qid !== QID) {
    res.send({ content: "undefined" })
    return
  }

  res.send({ content: questions[QID].Explanation })
})

app.post("/api/getQuestion/", (req, res) => {
  const { conv } = req.body
  if (conv == null) {
    res.sendStatus(500)
    return
  }

  const user = getUser(conv.email)
  const status = getStatus(conv.email)
  if (user == null || status == "notStarted") {
    res.sendStatus(500)
    return
  }

  // Has already completed study
  if (finishedStudy(status)) {
    res.send(JSON.stringify({ content: "already completed study", conv }))
    return
  }

  // Choose a question
  let currentQInfo
  let currentQuestion

  let shouldFinishBy
  if (user.times && user.times.studyTimes) {
    shouldFinishBy = new Date(
      user.times.studyTimes[user.completed.days].allowedStart
    )
    shouldFinishBy.setDate(shouldFinishBy.getDate() + 1)
  } else {
    shouldFinishBy = null
  }

  // Use this code to select specific questions for demo.
  if (conv.email === "demo") {
    const qInfo = [
      { qid: "Demo 1", modality: "voice" },
      { qid: "Demo 2", modality: "voice" },
      { qid: "Demo 3", modality: "voice" },
      { qid: "Demo 4", modality: "voiceless" },
      { qid: "Demo 5", modality: "mc" },
    ]
    conv.keyId = (conv.keyId + 1) % qInfo.length || 0
    currentQInfo = qInfo[conv.keyId]
    currentQuestion = demoQuestions[currentQInfo.qid]
    // Otherwise, choose question according to schedule
  } else {
    const { completed, questionSchedule, sleepData } = user
    const { studyTimes } = user.times

    const startTime = studyTimes[completed.days].allowedStart
    const now = new Date()
    if (now - startTime < 0) {
      res.send(
        JSON.stringify({
          content: {
            content: [
              {
                type: "text",
                content: `You're done for the day! Please come back on ${startTime.toDateString()}.`,
              },
            ],
          },
          conv,
        })
      )
      return
    }

    let num_days = 0
    let num_hours = 0
    if (sleepData != null) {
      const currDate = new Date(now)
      const pastDate = new Date(sleepData[sleepData.length - 1].time)
      num_hours = (currDate - pastDate) / (1000 * 3600)
      currDate.setHours(0, 0, 0, 0)
      pastDate.setHours(0, 0, 0, 0)
      num_days = (currDate - pastDate) / (1000 * 3600 * 24)
    }

    if (sleepData == null || (num_days >= 1 && num_hours >= 4)) {
      res.send(
        JSON.stringify({
          content: {
            content: [
              {
                type: "text",
                content: `How many hours did you sleep last night?`,
              }
            ],
            queryUser: true,
            shouldFinishBy,
          },
          conv,
        })
      )
      return
    }

    if (completed.questions == 0) {
      setDayStartTime(conv.email)
    }

    currentQInfo = questionSchedule[completed.days][completed.questions]
    currentQuestion = questions[currentQInfo.qid]
  }

  const modality = currentQInfo.modality

  // Response content includes the question text
  const resContent = [
    {
      type: "text",
      content: currentQuestion.Question,
    },
  ]

  const answerChoices = []
  if (modality == "mc") {
    answerChoices.push(currentQuestion.MultipleChoice.Correct)
    answerChoices.push(...currentQuestion.MultipleChoice.Incorrect)
  }

  for (const fname of currentQuestion.Figures || []) {
    resContent.push({
      type: "img",
      content: `${currentQuestion.Topic}/${fname}`,
    })
  }

  conv.currentQuestionId = currentQuestion.Id
  conv.modality = modality

  res.send(
    JSON.stringify({
      content: {
        content: resContent,
        answerChoices: shuffleArray(answerChoices),
        modality,
        QID: currentQuestion.Id,
        shouldFinishBy,
      },
      conv,
    })
  )

  currentQInfo.started = new Date()
  updateUserQuestionData(user.completed, currentQInfo, conv.email)
})

app.post("/api/getTestQuestions", async (req, res) => {
  const { conv } = req.body
  if (conv == null || getUser(conv.email) == null) {
    res.sendStatus(401)
    return
  }

  const { email } = conv
  const user = getUser(email)

  const { pretest, posttestA, posttestB, times } = user
  const status = getStatus(email)
  const isPretest = status == "notStarted"
  const isPosttest = finishedStudy(status) && status != "posttestDone"

  if (isPretest || isPosttest) {
    let test = pretest

    if (isPosttest) {
      const startTime = times.posttest.allowedStart
      const now = new Date()
      if (now - startTime < 0) {
        const type = user.second_posttest ? "2 month follow-up" :
                     user.first_posttest ? "1 week follow-up" :
                     ""
        res.send(
          JSON.stringify({
            content: { comebackMessage: `Please come back on ${startTime.toDateString()} to complete your ${[type, "post-test"].join(" ")}.` },
            conv
          })
        )
        return
      }

      test = status == "studyDone" ? posttestA : posttestB
      if (status == "studyDone" && posttestA == null) {
        setPosttestStartTime(email)
      }
    }

    // generate test questions
    if (test == null) {
      test = recordTestResponses(
        { isPretest: isPretest, part: status == "studyDone" ? "A" : "B" },
        email
      )
    }

    const testQuestions = {}
    test.forEach((e) => {
      const q = questions[e.QID]

      const choices =
        status == "studyDone"
          ? []
          : shuffleArray([q.MultipleChoice.Correct, ...q.MultipleChoice.Incorrect,])

      const figures = []
      for (const fname of q.Figures || []) {
        figures.push(`${q.Topic}/${fname}`)
      }

      testQuestions[q.Id] = {
        Question: q.Question,
        Figures: figures,
        Choices: choices,
        Response: e.response,
      }
    })

    const shouldFinishBy = isPretest ? new Date(times.pretest.start) : new Date(times.posttest.allowedStart)
    shouldFinishBy.setDate(shouldFinishBy.getDate() + 1)

    res.send(JSON.stringify({ content: { questions: testQuestions, shouldFinishBy: shouldFinishBy.toLocaleString() }, conv }))
    return
  }

  res.sendStatus(403)
})

app.post("/api/submitUserResponse/", async (req, res) => {
  const { content, conv } = req.body
  if (conv == null) {
    res.sendStatus(500)
    return
  }

  const user = getUser(conv.email)
  const currQ =
    conv.email == "demo"
      ? demoQuestions[conv.currentQuestionId]
      : questions[conv.currentQuestionId]
  if (user == null || currQ == null) {
    res.sendStatus(500)
    return
  }

  const status = getStatus(conv.email)
  if (status == "notStarted" || finishedStudy(status)) {
    res.sendStatus(500)
    return
  }

  const userFinalResponse = content[0]
  const correctResponse = currQ.MultipleChoice.Correct
  const { modality } = conv

  const score =
    modality == "mc"
      ? Number(userFinalResponse === correctResponse) // if multiple choice
      : (
        await axios.post("http://localhost:3001/score", {
          // otherwise send to server for evaluation
          question_id: conv.currentQuestionId,
          response: userFinalResponse,
        })
      ).data

  res.send(
    JSON.stringify({
      content: { score, correctResponse, QID: conv.currentQuestionId },
      conv,
    })
  )

  if (conv.email === "demo") return

  // Record data on user's response, unless is demo user
  const { questionSchedule, completed } = user
  const currentQInfo = questionSchedule[completed.days][completed.questions]
  currentQInfo.userResponse = userFinalResponse
  currentQInfo.score = score
  currentQInfo.finished = new Date()
  if (modality == "voice") {
    const userOriginalResponse = content[1]
    currentQInfo.originalResponse = userOriginalResponse
  }
  updateUserQuestionData(completed, currentQInfo, conv.email)

  // Also update the completed question counter, unless is demo user
  completed.questions += 1
  const numQuestionsOnDay = questionSchedule[completed.days].length
  if (completed.questions >= numQuestionsOnDay) {
    completed.questions = 0
    completed.days += 1
  }
  updateCompleted(completed, conv.email)
})

app.post("/api/contestEvaluation", async (req, res) => {
  const { content, conv } = req.body
  content.user = conv.email
  content.timestamp = new Date()

  const filename = "backend/scoring/contestedEvaluations.yaml"
  let contestedEvaluations = yaml.safeLoad(fs.readFileSync(filename))
  if (contestedEvaluations == null) {
    contestedEvaluations = []
  }
  contestedEvaluations.push(content)
  fs.writeFileSync(filename, yaml.safeDump(contestedEvaluations))

  res.send(JSON.stringify({ content: null, conv }))
})

app.post("/api/saveTestResponses", async (req, res) => {
  const { content, conv } = req.body
  if (conv == null || getUser(conv.email) == null || content == null) {
    res.sendStatus(500)
    return
  }

  const status = getStatus(conv.email)
  if (
    status == "notStarted" ||
    (finishedStudy(status) && status != "posttestDone")
  ) {
    recordTestResponses(content, conv.email)
    res.send(JSON.stringify({ content: null, conv }))
    return
  }

  res.sendStatus(500)
})

app.post("/api/submitTest", async (req, res) => {
  const { content, conv } = req.body
  if (conv == null || getUser(conv.email) == null || content == null) {
    res.sendStatus(500)
    return
  }

  const status = getStatus(conv.email)
  if (
    status == "notStarted" ||
    (finishedStudy(status) && status != "posttestDone")
  ) {
    updateUserStatus(content, conv.email)
    res.send(JSON.stringify({ content: { status: 1 }, conv }))
    return
  }

  res.sendStatus(500)
})

// right now, this just handles the user sending # of hours slept to server
// can potentially be used later to handle user submitting a whole form of information
app.post("/api/submitUserQuery", async (req, res) => {
  const { content, conv } = req.body
  if (conv == null || getUser(conv.email) == null || content == null) {
    res.sendStatus(500)
    return
  }

  const user = getUser(conv.email);
  if (user.sleepData == null) {
    user.sleepData = []
  }
  user.sleepData.push({ time: new Date(), numHours: content })
  fs.writeFileSync(`backend/users/${conv.email}.yaml`, yaml.safeDump(user))
  res.send(JSON.stringify({ content: null, conv }))
})

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "../build/index.html"))
})

startEmailReminderService()

let port
if (process.argv.includes("--stewy-dev")) {
  port = 8083
} else if (process.argv.includes("--arpan-dev")) {
  port = 8082
} else{
  port = 8081
}
app.listen(port, () => {
  console.log(`Express server running on port ${port}`)
})
