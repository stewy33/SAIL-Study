import React from "react"
import { Row, Col, Input } from "antd"

class UserQuery extends React.Component {
  constructor(props) {
    super(props)
    this.state = { userInput: "", disabled: false }
  }

  onChange(e) {
    this.setState({ userInput: e.target.value })
  }

  submitResponse() {
    const { submitUserQuery } = this.props
    const { userInput } = this.state
    if (userInput.trim().length > 0) {
      submitUserQuery(userInput)
      this.setState({ disabled: true })
    }
  }

  render() {
    const { userInput, disabled } = this.state
    return (
      <Row justify="left" style={{ marginBottom: "10px" }}>
        <Col span={14}>
          <Input
            value={userInput}
            onChange={(e) => this.onChange(e)}
            rows={1}
            onPressEnter={this.submitResponse.bind(this)}
            placeholder="Respond here (press enter to submit)"
            size="large"
            autoFocus
            disabled={disabled}
          />
        </Col>
      </Row>
    )
  }

}

export default UserQuery