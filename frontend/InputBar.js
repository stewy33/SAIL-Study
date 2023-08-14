import React from "react"
import { Row, Col, Input, Button } from "antd"
import { AudioOutlined } from "@ant-design/icons"

import speechController from "./speechController"
import "./App.less"

class InputBar extends React.Component {
  constructor(props) {
    super(props)

    // inputState = "done", "listening", or "rectifying"
    this.state = { userResponseText: "", inputState: "done", originalResponse: "" }
  }

  async startListening() {
    this.setState({ inputState: "listening" })
    await speechController.startListening()
  }

  async stopListening() {
    const userResponseText = await speechController.stopListening()
    this.setState({ userResponseText, inputState: "rectifying", originalResponse: userResponseText })
  }

  submitTypedResponse() {
    const { submitUserResponse } = this.props
    const { userResponseText, originalResponse } = this.state
    if (userResponseText.trim().length > 0) {
      submitUserResponse(userResponseText, originalResponse)
      this.setState({ userResponseText: "", inputState: "done", originalResponse: "" })
    }
  }

  onChange(e) {
    this.setState({ userResponseText: e.target.value })
  }

  render() {
    const { modality, disabled } = this.props

    if (modality === "voice") {
      const { inputState } = this.state

      let inputComponent
      if (inputState === "listening") {
        inputComponent = (
          <Button
            type="danger"
            size="large"
            onClick={this.stopListening.bind(this)}
          >
            Click when done speaking
          </Button>
        )
      } else if (inputState === "rectifying") {
        const { userResponseText } = this.state
        inputComponent = (
          <Col span={14}>
            <Input.Group compact style={{display: "flex"}}>
              <Input
                value={userResponseText}
                onChange={(e) => this.onChange(e)}
                rows={1}
                onPressEnter={this.submitTypedResponse.bind(this)}
                placeholder="Respond here (press enter to submit)"
                size="large"
                autoFocus
              />
              <Button
                type="primary"
                onClick={this.submitTypedResponse.bind(this)}
                size="large"
                style={{flex: 1}}
              >
                Confirm Voice Input
              </Button>
            </Input.Group>
          </Col>
        )
      } else if (inputState === "done") {
        inputComponent = (
          <Button
            type="primary"
            size="large"
            icon={<AudioOutlined />}
            onClick={this.startListening.bind(this)}
            disabled={disabled}
          >
            Speak
          </Button>
        )
      }

      return <Row justify="center">{inputComponent}</Row>
    } else if (modality === "voiceless") {
      const { userResponseText } = this.state
      return (
        <Row justify="center">
          <Col span={14}>
            <Input
              value={userResponseText}
              onChange={(e) => this.onChange(e)}
              rows={1}
              onPressEnter={this.submitTypedResponse.bind(this)}
              placeholder="Respond here (press enter to submit)"
              size="large"
              autoFocus
              disabled={disabled}
            />
          </Col>
        </Row>
      )
    }
    return <></>
  }
}

export default InputBar
