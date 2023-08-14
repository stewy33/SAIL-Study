import React from "react"
import { Row, Col } from "antd"

import InputBar from "./InputBar"
import UserQuery from "./UserQuery"
import MultipleChoice from "./MultipleChoice"
import Explanation from "./Explanation"
import ContestButton from "./ContestButton"
import clientApi from "./clientApi"
import speechController from "./speechController"
import "./App.less"

const renderElement = ({ type, content }, i) => {
  const key = `element-${i}`
  switch (type) {
    case "text":
      return (
        <p style={{ fontSize: "1.2em" }} key={key}>
          {content.replace(/<\/?[^>]+(>|$)/g, "") /* Strip SSML tags */}
        </p>
      )
    case "img":
      return <img src={content} key={key} className="sail-image" />
    case "contestButton":
      return <ContestButton key={key} {...content} />
  }
}

const ChatBubble = (props) => {    
  const {
    isUser,
    content,
    answerChoices,
    explanation,
    submitUserResponse,
    submitUserQuery,
    askNewQuestion,
    QID,
    queryUser
  } = props


  return (
    <div>
      {content && (
        <div className={isUser ? "user-chat-bubble" : "sail-chat-bubble"}>
          <b>{QID}</b>
          {content.map(renderElement)}
          {queryUser && (
            <UserQuery submitUserQuery={submitUserQuery} />
          )}
        </div>
      )}
      {answerChoices && answerChoices.length > 0 && (
        <MultipleChoice
          answerChoices={answerChoices}
          submitUserResponse={submitUserResponse}
        />
      )}
      {explanation && (
        <Explanation
          explanation={explanation}
          askNewQuestion={askNewQuestion}
        />
      )}
      <div style={{ clear: "both" }}></div>
    </div>
  )
}

class SAILScreen extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      chatBubbles: [],
      modality: "voiceless",
      disableUser: false,
      userProgress: { day: 0, question: 0, numQuestions: 0 },
      timeLeft: { hours: null, minutes: null },
    }
    this.bottomRef = React.createRef()
  }

  // Helper function to add chat bubble
  async addChatBubble(newBubble) {
    const { chatBubbles, modality } = this.state
    chatBubbles.push(newBubble)
    this.setState({ chatBubbles })

    // this.bottomRef.current !== undefined only when componentMounted
    if (this.bottomRef.current) {
      this.bottomRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }

    // Only read out loud if in voice mode and SAIL said this bubble
    if (modality === "voice" && !newBubble.isUser && newBubble.content) {
      const text = newBubble.content
        .filter((elem) => elem.type === "text")
        .map((elem) => elem.content)
        .join(". ")
      speechController.speak(text)
    }
  }

  // Show welcome text and first question.
  async componentDidMount() {
    const welcomeText = "Hi! Welcome to SAIL. Let's begin."
    this.addChatBubble({
      isUser: false,
      content: [{ type: "text", content: welcomeText }],
    })

    this.askNewQuestion()
  }

  async askNewQuestion() {
    const question = await clientApi.getQuestion()

    if (question === "already completed study") {
      await this.props.handleCompletedStudy()
      return
    }

    const { content, answerChoices, modality, QID, shouldFinishBy, queryUser } = question
    const res = await clientApi.getUserProgress()
    const minutesLeft = Math.max(
      0,
      Math.floor((new Date(shouldFinishBy) - new Date()) / 60000)
    )
    const timeLeft = {
      hours: Math.floor(minutesLeft / 60),
      minutes: minutesLeft % 60,
    }
    if (shouldFinishBy == null) {
      timeLeft.hours = 0
      timeLeft.minutes = 0
    }
    this.setState({ modality, disableUser: false, userProgress: res, timeLeft })
    this.addChatBubble({
      isUser: false,
      content: content,
      answerChoices: answerChoices, // empty if not in MC mode
      QID,
      queryUser,
    })
  }

  async showExplanation() {
    const res = await clientApi.getExplanation()
    this.addChatBubble({
      isUser: false,
      explanation: res.content,
    })
  }

  // When user submits response, add their response as a chat bubble, evaluate it
  // on the server, and then show the server's response.
  async submitUserResponse(userResponseText, originalResponse="") {
    if (userResponseText == null) {
      return
    }

    this.addChatBubble({
      isUser: true,
      content: [{ type: "text", content: userResponseText.trim() }],
    })

    const { score, correctResponse, QID } = await clientApi.submitUserResponse(
      [userResponseText, originalResponse]
    )

    this.setState({ disableUser: true })
    if (score === 1) {
      this.addChatBubble({
        isUser: false,
        content: [
          {
            type: "text",
            content: `Correct, the answer is: ${correctResponse}`,
          },
          { type: "contestButton", content: { userResponseText, score, QID } },
        ],
      })
    } else {
      this.addChatBubble({
        isUser: false,
        content: [
          {
            type: "text",
            content: `Incorrect. The correct answer is: ${correctResponse}`,
          },
          { type: "contestButton", content: { userResponseText, score, QID } },
        ],
      })
    }
    this.showExplanation()
  }

  // right now, this just handles the user sending # of hours slept to server
  // can potentially be used later to handle user submitting a whole form of information
  async submitUserQuery(text) {
    await clientApi.submitUserQuery(text)
    this.askNewQuestion()
  }

  render() {
    const {
      chatBubbles,
      modality,
      disableUser,
      userProgress,
      timeLeft,
    } = this.state

    return (
      <>
        {/* Render chat bubbles. Place autoscroll anchor above last one. */}
        <Row className="chat-screen" justify="center">
          <Col md={22} lg={18}>
            {chatBubbles.map(
              (
                {
                  content,
                  answerChoices,
                  explanation,
                  isUser,
                  QID,
                  queryUser,
                },
                i
              ) => (
                <div
                  key={`ChatBubble-${i}`}
                  ref={i === chatBubbles.length - 1 && this.bottomRef}
                >
                  <ChatBubble
                    content={content}
                    answerChoices={answerChoices}
                    explanation={explanation}
                    isUser={isUser}
                    submitUserResponse={this.submitUserResponse.bind(this)}
                    submitUserQuery={this.submitUserQuery.bind(this)}
                    askNewQuestion={this.askNewQuestion.bind(this)}
                    QID={QID}
                    queryUser={queryUser}
                  />
                </div>
              )
            )}
          </Col>
        </Row>

        {/* Bar for user input */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            paddingTop: "15px",
            width: "100%",
            //height: "100%",
            backgroundColor: "white",
          }}
        >
          <div>
            <InputBar
              modality={modality}
              submitUserResponse={this.submitUserResponse.bind(this)}
              disabled={disableUser}
            />
          </div>

          {/* User status */}
          <div
            style={{
              textAlign: "center",
              paddingTop: "10px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                color: "#1890ff",
                fontSize: "1em",
              }}
            >
              <b style={{ paddingRight: "5px" }}>Day: </b>
              <p style={{ paddingRight: "10px" }}>{userProgress.day}</p>

              <b style={{ paddingRight: "5px" }}>Question: </b>
              <p style={{ paddingRight: "10px" }}>
                {userProgress.question}/{userProgress.numQuestions}
              </p>

              <b style={{ paddingRight: "5px" }}>Time Left: </b>
              <p style={{ paddingRight: "10px" }}>
                {timeLeft.hours}h:{timeLeft.minutes}m
              </p>

              <b style={{ paddingRight: "5px" }}>Mode: </b>
              <p>
                {modality == null
                  ? "Waiting"
                  : modality === "mc"
                  ? "Multiple Choice"
                  : modality === "voice"
                  ? "Voice"
                  : "Open Ended"}
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }
}

export default SAILScreen
