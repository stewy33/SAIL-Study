let conversation = {}

const sendRequest = async (url, body = null) => {
  const res = await fetch(url, {
    method: "post",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: body, conv: conversation }),
  })

  // Update conversation object and return content
  if (res.status === 500) {
    return "error"
  }
  const { content, conv } = await res.json()
  conversation = conv
  return content
}

const clientApi = {
  speechToText: async (speechBlob) => {
    const res = await fetch("/api/speech-to-text", {
      method: "post",
      headers: { "Content-Type": speechBlob.type },
      body: speechBlob,
    })

    return await res.json()
  },

  textToSpeech: async (text) => {
    const res = await fetch("/api/text-to-speech", {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })

    return await res.arrayBuffer()
  },

  // Checks if user exists. If so, updates `conversation` object with user email.
  login: async (rawEmail) => {
    const email = rawEmail.trim().toLowerCase()
    const userExists = await sendRequest("/api/login", email)
    if (userExists) {
      conversation.email = email
    }
    return userExists
  },

  getTestQuestions: async () => sendRequest("/api/getTestQuestions"),

  getQuestion: async () => sendRequest("/api/getQuestion/"),

  getExplanation: async () => {
    const res = await fetch(
      `/api/getExplanation?email=${conversation.email}&&QID=${conversation.currentQuestionId}`
    )
    return await res.json()
  },

  // response comes in as [final answer, original answer before rectifying]
  submitUserResponse: async (response) =>
    sendRequest("/api/submitUserResponse/", response),

  getUserStatus: async () => {
    const res = await fetch(`/api/getUserStatus?email=${conversation.email}`)
    return await res.json()
  },

  getUserProgress: async () => {
    const res = await fetch(
      `/api/getUserProgress?email=${conversation.email}&&keyId=${conversation.keyId}`
    )
    return await res.json()
  },

  saveTestResponses: async (response) => sendRequest("/api/saveTestResponses", response),

  submitTest: async (response) => sendRequest("/api/submitTest", response),

  submitUserQuery: async (response) => sendRequest("/api/submitUserQuery", response),

  contestEvaluation: async (QID, userResponse, score) =>
    sendRequest("/api/contestEvaluation", {
      QID,
      userResponse,
      score,
    }),
}

export default clientApi
