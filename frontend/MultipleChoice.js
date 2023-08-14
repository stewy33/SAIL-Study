import React from "react"
import { Row, Button, message, Radio } from "antd"
import "./App.less"

class MultipleChoice extends React.Component {
  constructor(props) {
    super(props)
    this.state = { disabled: false, index: -1 }
  }

  onClick(index) {
    if (this.state.disabled) return
    this.setState({ index })
  }

  onSubmit() {
    const { submitUserResponse, answerChoices } = this.props
    const { index } = this.state

    if (index === -1) {
      message.error("Please select an answer.")
      return
    }

    this.setState({ disabled: true })
    submitUserResponse(answerChoices[index])
  }

  render() {
    const { answerChoices } = this.props
    const { disabled, index } = this.state

    return (
      <div className={"sail-chat-bubble"}>
        {answerChoices.map((choice, i) => {
          return (
            <Row 
              onClick={this.onClick.bind(this, i)} 
              key={`element-${i}`}
              style={{ marginBottom: "-5px" }}
            >
              <Radio disabled={disabled} checked={i == index} />
              <p style={{ maxWidth: "80%" }}> {choice} </p>
            </Row>
          )
        })}
        <Button
          onClick={this.onSubmit.bind(this)}
          type="primary"
          disabled={this.state.disabled}
          style={{ marginBottom: "10px" }}
        >
          Submit
        </Button>
      </div>
    )
  }
}

export default MultipleChoice
