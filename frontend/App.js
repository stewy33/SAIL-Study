import React from "react"
import { Row, Col, Form, Input, Image, Button, Typography, message } from "antd"
import is from "is_js"

import TestScreen from "./TestScreen"
import SAILScreen from "./SAILScreen"
import clientApi from "./clientApi"
import "./App.less"
import logo from "./images/logo.png"
import congrats from "./images/congrats.png"
import speechController from "./speechController"

const CongratsScreen = () => {
  return (
    <div>
      <Row justify="center" style={{ padding: "5vh" }}>
        <Typography.Title level={2}>
          Congrats, you've completed the study!
        </Typography.Title>
      </Row>
      <Row justify="center">
        <Image width={"40vh"} src={congrats} preview={false} />
      </Row>
    </div>
  )
}

class LoginScreen extends React.Component {
  constructor(props) {
    super(props)

    this.state = { loginEmail: "" }
  }

  async login() {
    const { onSuccess } = this.props
    const { loginEmail } = this.state

    const userExists = await clientApi.login(loginEmail)
    if (userExists) {
      onSuccess()
    } else {
      message.error("Sorry, we can't find that email in our records.")
    }
  }

  render() {
    return (
      <Row justify="center">
        <Col>
          <Image
            src={logo}
            preview={false}
            style={{
              padding: "70px 5vh 0px 5vh",
              maxWidth: "80vh",
              height: "auto",
            }}
          />
        </Col>

        <Col
          md={22}
          lg={12}
          style={{
            backgroundColor: "white",
            padding: "5vh",
            marginTop: "25px",
          }}
          justify="center"
        >
          <Typography.Title>Login</Typography.Title>
          <p style={{ marginBottom: "2em" }}>
            Enter the email you used to sign up for the study. If you have
            questions or can&apos;t log in, email us at <a href = "mailto: tpli@jhmi.edu">tpli@jhmi.edu</a>. 
            If you're not signed up, test our system with email "demo".
          </p>
          <Form>
            <Form.Item>
              <Input
                size="large"
                onChange={(e) => this.setState({ loginEmail: e.target.value })}
                placeholder="Enter your email here"
                onPressEnter={this.login.bind(this)}
                autoFocus
              />
            </Form.Item>
            <Form.Item style={{ textAlign: "center" }}>
              <Button
                type="primary"
                size="large"
                style={{ width: "60%" }}
                onClick={this.login.bind(this)}
              >
                Login
              </Button>
            </Form.Item>
          </Form>
        </Col>
      </Row>
    )
  }
}

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = { loggedIn: false, userStatus: "notStarted" }
  }

  async onLogin() {
    const res = await clientApi.getUserStatus()
    this.setState({ loggedIn: true, userStatus: res.status })
  }

  async updateTestStatus() {
    const res = await clientApi.getUserStatus()
    this.setState({ userStatus: res.status })
  }

  async handleCompletedStudy() {
    const res = await clientApi.getUserStatus()
    this.setState({ userStatus: res.status })
  }

  render() {
    if (false) { //!(is.chrome() || is.opera())) {
      return (
        <Row justify="center" align="middle" style={{ height: "75vh" }}>
          Sorry, this platform is currently not supported.
          <br />
          Try using Chrome for the best experience. If that didn&apos;t help,
          email us with a description of your issue at slocumstewy@gmail.com
        </Row>
      )
    }

    if (!speechController.isSupportedInBrowser()) {
      return (
        <Row justify="center" align="middle" style={{ height: "75vh" }}>
          Sorry, can&apos;t access necessary microphone and audio permissions.
          Either enable these permissions or try another browser such as Chrome.
          <br />
          If you need help, don&apos;t hesitate to email us with a description
          of your issue at slocumstewy@gmail.com
        </Row>
      )
    }

    const { loggedIn, userStatus } = this.state

    if (!loggedIn) {
      return <LoginScreen onSuccess={this.onLogin.bind(this)} />
    }

    switch (userStatus) {
      case "posttestDone":
        return <CongratsScreen />
      case "posttestPartADone":
      case "studyDone":
        return (
          <TestScreen
            finishedPartA={userStatus === "posttestPartADone"}
            isPretest={false}
            updateTestStatus={this.updateTestStatus.bind(this)}
          />
        )
      case "pretestDone":
        return (
          <SAILScreen
            handleCompletedStudy={this.handleCompletedStudy.bind(this)}
          />
        )
      default:
        return (
          <TestScreen
            finishedPartA={true}
            isPretest={true}
            updateTestStatus={this.updateTestStatus.bind(this)}
          />
        )
    }
  }
}

export default App
