import React from "react"
import { Row, Col, Form, Button, Typography, Radio, Input, Pagination } from "antd"

import clientApi from "./clientApi"
import "./App.less"

const DisplayFigures = (props) => {
  return (
    <div>
      {props.Figures.map((f, i) => {
        return (
          <img
            src={f}
            key={`img-${i}`}
            className="sail-image"
          />
        )
      })}
    </div>
  )
}

class TestScreen extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      questions: {},
      currPage: 0,
      pageSize: 1,
      comebackMessage: null,
      shouldFinishBy: null
    }
  }

  componentDidMount() {
    this._ismounted = true
    this.loadQuestions()
  }

  componentWillUnmount() {
    this._ismounted = false
  }

  getPageQuestions(currPage) {
    const { questions, pageSize } = this.state
    return Object.keys(questions).slice(currPage * pageSize, currPage * pageSize + pageSize)
  }

  async loadQuestions() {
    const res = await clientApi.getTestQuestions()
    const { comebackMessage, questions, shouldFinishBy } = res
    if (comebackMessage) {
      this.setState({ questions: {}, currPage: 0, comebackMessage, shouldFinishBy: null })
      return
    }

    this.setState({ questions, currPage: 0, comebackMessage: null, shouldFinishBy })
    const QID = this.getPageQuestions(0)
    this.saveResponses([{ QID: QID, start: true }]) // set start time
  }

  chooseResponseForQuestion(QID, responseValue) {
    // Update response array with a response value for a particular question
    const { questions } = this.state
    questions[QID].Response = responseValue
    this.setState({ questions })
    this.saveResponses([{ QID: QID, response: responseValue }])
  }

  renderMultipleChoice() {
    const { questions, currPage, pageSize } = this.state
    const pageKeys = this.getPageQuestions(currPage)
    return pageKeys.map((QID, i) => {
      const { Question, Figures, Choices, Response } = questions[QID]
      return (
        <Form.Item key={`question-${QID}-mc`}>
          <b>Question {currPage * pageSize + i + 1} ({QID})</b>
          <p>{Question.replace(/<\/?[^>]+(>|$)/g, "")}</p>

          {Figures.length > 0 && (
            <DisplayFigures Figures={Figures} />
          )}

          {Choices.map((choice, j) => (
            <Row
              onClick={this.chooseResponseForQuestion.bind(this, QID, choice)}
              key={`radio-row-${j}`}
              style={{ marginBottom: "-12px" }}
            >
              <Radio value={j} checked={choice == Response} />
              <p style={{ maxWidth: "80%" }}> {choice} </p>
            </Row>
          ))}
        </Form.Item>
      )
    })
  }

  renderFreeResponse() {
    const { questions, currPage, pageSize } = this.state
    const pageKeys = this.getPageQuestions(currPage)
    return pageKeys.map((QID, i) => {
      const { Question, Figures, Response } = questions[QID]
      return (
        <Form.Item key={`question-${QID}-free`}>
          <b>Question {currPage * pageSize + i + 1} ({QID})</b>
          <p>{Question.replace(/<\/?[^>]+(>|$)/g, "")}</p>

          {Figures.length > 0 && (
            <DisplayFigures Figures={Figures} />
          )}

          <Input
            value={Response}
            onChange={(e) => {
              this.chooseResponseForQuestion(QID, e.target.value)
            }}
          ></Input>
        </Form.Item>
      )
    })
  }

  async saveResponses(responses) {
    await clientApi.saveTestResponses({
      part: !this.props.finishedPartA ? "A" : "B",
      responses: responses,
      isPretest: this.props.isPretest,
    })
  }

  async submitTest(skip) {
    const { questions } = this.state

    if (!skip) {
      const questionsTodo = []
      let qNum = 1
      for (const QID in questions) {
        const { Response } = questions[QID]
        if (Response == null || Response.trim().length == 0) questionsTodo.push(qNum)
        qNum++
      }

      if (questionsTodo.length > 0) {
        alert(`Please answer question(s): ${questionsTodo.join(", ")}.`)
        return
      }
    }

    const res = await clientApi.submitTest({ part: !this.props.finishedPartA ? "A" : "B", isPretest: this.props.isPretest })
    if (res.status === 1) {
      this.props.updateTestStatus().then(() => {
        if (this._ismounted) this.loadQuestions()
      })
    }
  }

  paginationChange(number) {
    const QID = this.getPageQuestions(number - 1)
    this.saveResponses([{ QID: QID, start: true }]) // set start time
    this.setState({ currPage: number - 1 })
  }

  paginationItemRender(current, type, originalElement) {
    if (type === 'page') {
      const { questions } = this.state
      const pageKeys = this.getPageQuestions(current - 1)

      for (let i = 0; i < pageKeys.length; i++) {
        const { Response } = questions[pageKeys[i]]
        if (Response != null && Response.trim().length > 0) {
          return <a style={{ backgroundColor: "#f0f0f0" }}>{current}</a>
        }
      }
    }
    return originalElement
  }

  render() {
    const { questions, comebackMessage, currPage, pageSize, shouldFinishBy } = this.state
    const { finishedPartA, isPretest } = this.props

    const numQs = Object.keys(questions).length
    const lastQ = currPage == Math.ceil(numQs / pageSize) - 1

    return (
      <Row justify="center">
        <Col md={22} lg={13} style={{ padding: "5vh" }} justify="center">
          <Typography.Title>
            {isPretest ? "Pre-Test" : "Post-Test"}
          </Typography.Title>
          {(!isPretest && !comebackMessage) &&
            <Typography.Title level={5} style={{ marginTop: "-10px", marginBottom: "15px" }}>
              {`Part ${finishedPartA ? "2 of 2" : "1 of 2"}`}
            </Typography.Title>
          }

          {comebackMessage &&
            <Typography.Title level={4}>{comebackMessage}</Typography.Title>
          }

          {shouldFinishBy &&
            <Typography.Title level={5} style={{ marginTop: "-10px", marginBottom: "15px" }}>
              {`Please complete this test by ${shouldFinishBy} ET.`}
            </Typography.Title>
          }

          {!comebackMessage &&
            <div>
              <Pagination
                showQuickJumper
                current={currPage + 1}
                defaultPageSize={pageSize}
                total={numQs}
                showSizeChanger={false}
                onChange={this.paginationChange.bind(this)}
                itemRender={this.paginationItemRender.bind(this)}
              />
              <br />
            </div>
          }

          <Form>
            {!finishedPartA && this.renderFreeResponse()}
            {finishedPartA && this.renderMultipleChoice()}
            {numQs > 0 &&
              <Form.Item style={{ textAlign: "center" }}>
                <Button
                  type="primary"
                  size="large"
                  key={currPage}
                  onClick={() => lastQ ? this.submitTest() : this.paginationChange(currPage + 2)}
                >
                  {lastQ ? "Submit Test" : "Next Page"}
                </Button>
              </Form.Item>
            }
            {/*numQs > 0 &&
              <Form.Item style={{ textAlign: "center" }}>
                <Button
                  danger
                  onClick={() => this.submitTest(true)}
                >
                  (Dev only) Skip the rest
                </Button>
              </Form.Item>
            */}
          </Form>
        </Col>
      </Row>
    )
  }
}

export default TestScreen
